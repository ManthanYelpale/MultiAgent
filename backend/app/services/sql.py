"""Natural-language -> SQL agent.

Security model
--------------
The query text comes from an LLM steered by a user-supplied question, so it is treated
as hostile. Defence is layered, and the layers are ordered by how much they can be
trusted:

  1. Database grants (scripts/create_readonly_role.sql) — THE boundary. A non-superuser
     role with no access to `users`, read-only transactions, and row-level security
     scoping every readable table to the requesting user.
  2. Single-statement enforcement — psycopg2 will happily run "SELECT 1; COPY ...".
  3. Table allowlist + statement-shape checks — defence in depth. Useful for clear
     error messages; NOT relied upon for safety.

The previous implementation had only a keyword blocklist, which allowed
`SELECT hashed_password FROM users`, `pg_read_file('/etc/passwd')`, stacked statements,
and a LIMIT that could be commented out. A blocklist cannot work here: the dangerous
operation (reading) is the same as the permitted one.
"""

import json
import logging
import re
from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.db import readonly
from app.services.llm import llm
from app.services.prompts import prompts

logger = logging.getLogger(__name__)

# Mirrors the GRANT list in scripts/create_readonly_role.sql. `users` is absent by design.
ALLOWED_TABLES = frozenset({
    "uploaded_files",
    "dashboards",
    "charts",
    "chat_history",
    "cleaning_templates",
    "cleaning_configs",
    "datasets_cleaned",
})

MAX_ROWS = 100

# Identifiers appearing after FROM / JOIN / UPDATE / INTO. Deliberately broad: anything
# that looks like a table reference must be in the allowlist.
_TABLE_REF_RE = re.compile(
    r"\b(?:FROM|JOIN|INTO|UPDATE)\s+(?:ONLY\s+)?[\"']?([A-Za-z_][A-Za-z0-9_$]*)[\"']?",
    re.IGNORECASE,
)
_CTE_NAME_RE = re.compile(r"\b(?:WITH|,)\s+([A-Za-z_][A-Za-z0-9_$]*)\s+AS\s*\(", re.IGNORECASE)
_STRING_LITERAL_RE = re.compile(r"'(?:[^']|'')*'")
_LINE_COMMENT_RE = re.compile(r"--[^\n]*")
_BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)


class UnsafeQueryError(ValueError):
    """Raised when a generated query fails validation."""


def _strip_markdown_fence(sql_query: str) -> str:
    cleaned = sql_query.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()
    return cleaned


def _strip_comments_and_literals(sql_query: str) -> str:
    """Remove comments and string bodies before structural analysis.

    Without this a table name inside a literal, or a trailing `--`, can hide the real
    shape of the statement from the checks below.
    """
    without_strings = _STRING_LITERAL_RE.sub("''", sql_query)
    without_block = _BLOCK_COMMENT_RE.sub(" ", without_strings)
    return _LINE_COMMENT_RE.sub(" ", without_block)


def _referenced_tables(analysable_sql: str) -> set[str]:
    cte_names = {name.lower() for name in _CTE_NAME_RE.findall(analysable_sql)}
    referenced = {name.lower() for name in _TABLE_REF_RE.findall(analysable_sql)}
    # CTE aliases are query-local, not physical tables.
    return referenced - cte_names


def validate_and_sanitize_sql(sql_query: str) -> tuple[bool, str, str | None]:
    """Validate a generated statement. Returns (is_safe, sql, error_message)."""
    cleaned = _strip_markdown_fence(sql_query)
    analysable = _strip_comments_and_literals(cleaned).strip()

    if not analysable:
        return False, cleaned, "Query is empty."

    # 1. Exactly one statement. Stacked statements let a benign-looking SELECT carry a
    #    second command; psycopg2 executes all of them.
    if ";" in analysable.rstrip().rstrip(";"):
        return False, cleaned, "Only a single SQL statement is permitted."
    cleaned = cleaned.strip().rstrip(";").rstrip()
    analysable = analysable.rstrip().rstrip(";").rstrip()

    # 2. Must be a read. The read-only role enforces this too; this is for a clear error.
    if not re.match(r"^(SELECT|WITH)\b", analysable, re.IGNORECASE):
        return False, cleaned, "Query must begin with SELECT or WITH."

    # 3. Every referenced table must be allowlisted. Grants are the real control, but
    #    failing here produces an actionable message instead of a permission error.
    referenced = _referenced_tables(analysable)
    disallowed = referenced - ALLOWED_TABLES
    if disallowed:
        return (
            False,
            cleaned,
            f"Query references tables that are not available: {', '.join(sorted(disallowed))}.",
        )

    # 4. Bound the result set. Appended to the *original* text, after the comment-stripped
    #    copy confirmed no LIMIT exists — previously a trailing `--` swallowed the LIMIT.
    if not re.search(r"\bLIMIT\b", analysable, re.IGNORECASE):
        cleaned = f"{cleaned}\nLIMIT {MAX_ROWS}"

    return True, cleaned, None


def get_schema_summary(db: Session) -> str:
    """Describe only the tables the agent is allowed to read.

    Previously this inspected the full database and handed the LLM the `users` table
    definition, including hashed_password — both an information leak in the prompt and
    an invitation to query it.
    """
    inspector = inspect(db.get_bind())
    schema_info = []
    for table_name in sorted(inspector.get_table_names()):
        if table_name not in ALLOWED_TABLES:
            continue
        columns = inspector.get_columns(table_name)
        col_desc = [f"{col['name']} ({col['type']})" for col in columns]
        schema_info.append(f"Table: {table_name}\nColumns: {', '.join(col_desc)}")
    return "\n\n".join(schema_info)


def execute_sandboxed_sql(db: Session, sql_query: str) -> tuple[list[str], list[dict[str, Any]], int]:
    """Execute a validated statement.

    Runtime limits (statement_timeout, read-only, idle timeout) are set on the role
    itself, so they cannot be skipped by the application forgetting to apply them —
    the previous code wrapped them in a try/except that swallowed failures silently.
    """
    result = db.execute(text(sql_query))
    columns = list(result.keys())
    rows = [dict(zip(columns, row)) for row in result.fetchmany(MAX_ROWS)]
    return columns, rows, len(rows)


def _result(question: str, sql: str, **overrides: Any) -> dict[str, Any]:
    payload = {
        "question": question,
        "generated_sql": sql,
        "is_safe": True,
        "error": None,
        "execution_result": None,
        "summary": None,
    }
    payload.update(overrides)
    return payload


def generate_and_execute_sql(user_id: int, question: str, execute: bool = True) -> dict[str, Any]:
    """Translate a question to SQL and optionally run it as `user_id`.

    Takes a user_id rather than a Session: the agent must never run on the application's
    privileged connection, so it opens its own restricted one.
    """
    if not readonly.is_available():
        return _result(
            question,
            "",
            is_safe=False,
            error=(
                "The data query feature is not configured. An administrator must "
                "provision the read-only database role and set READONLY_DATABASE_URL."
            ),
        )

    with readonly.readonly_session(user_id) as db:
        schema_text = get_schema_summary(db)
        system_prompt = prompts.render("sql_agent", schema_text=schema_text)

        raw_sql = llm.chat_completion(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Question: {question}\nSQL Query:"},
            ],
            temperature=0.1,
            max_tokens=300,
        )

        is_safe, sanitized_sql, error_msg = validate_and_sanitize_sql(raw_sql)
        if not is_safe:
            logger.info("Rejected generated SQL for user %s: %s", user_id, error_msg)
            return _result(question, raw_sql, is_safe=False, error=error_msg)

        if not execute:
            return _result(question, sanitized_sql)

        try:
            columns, rows, count = execute_sandboxed_sql(db, sanitized_sql)
        except Exception:
            # Never surface the driver message: it leaks schema and connection detail.
            logger.exception("SQL execution failed for user %s", user_id)
            return _result(
                question,
                sanitized_sql,
                error="The query could not be executed. It may be invalid or too expensive.",
            )

        if count == 0:
            summary = "The query returned no results."
        else:
            summary = llm.chat_completion(
                [{
                    "role": "user",
                    "content": prompts.render(
                        "sql_summary",
                        question=question,
                        sql_query=sanitized_sql,
                        results=json.dumps(rows[:5], default=str),
                    ),
                }],
                temperature=0.3,
                max_tokens=150,
            )

        return _result(
            question,
            sanitized_sql,
            execution_result={"columns": columns, "rows": rows, "row_count": count},
            summary=summary,
        )
