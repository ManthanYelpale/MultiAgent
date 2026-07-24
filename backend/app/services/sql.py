import re
from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
import json

from app.services.llm import llm
from app.services.prompts import prompts

FORBIDDEN_KEYWORDS = [
    r"\bINSERT\b",
    r"\bUPDATE\b",
    r"\bDELETE\b",
    r"\bDROP\b",
    r"\bALTER\b",
    r"\bTRUNCATE\b",
    r"\bCREATE\b",
    r"\bGRANT\b",
    r"\bREVOKE\b",
    r"\bEXECUTE\b",
]


def get_schema_summary(db: Session) -> str:
    """Inspect database engine tables and columns for LLM prompt context."""
    inspector = inspect(db.get_bind())
    schema_info = []
    for table_name in inspector.get_table_names():
        columns = inspector.get_columns(table_name)
        col_desc = [f"{col['name']} ({col['type']})" for col in columns]
        schema_info.append(f"Table: {table_name}\nColumns: {', '.join(col_desc)}")
    return "\n\n".join(schema_info)


def validate_and_sanitize_sql(sql_query: str) -> tuple[bool, str, str | None]:
    """
    Validates that the SQL query is strictly a read-only SELECT statement.
    Enforces a row limit if not specified.
    """
    cleaned = sql_query.strip().rstrip(";")

    # Remove markdown codeblocks if present
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()

    # Check for non-SELECT query
    if not cleaned.upper().startswith("SELECT") and not cleaned.upper().startswith("WITH"):
        return False, cleaned, "Query must begin with SELECT or WITH."

    # Check for forbidden DDL / DML keywords
    for pattern in FORBIDDEN_KEYWORDS:
        if re.search(pattern, cleaned, re.IGNORECASE):
            return False, cleaned, f"Query contains forbidden keyword: {pattern}"

    # Enforce LIMIT 100 if not present
    if not re.search(r"\bLIMIT\b", cleaned, re.IGNORECASE):
        cleaned += " LIMIT 100"

    return True, cleaned, None


def execute_sandboxed_sql(db: Session, sql_query: str) -> tuple[list[str], list[dict[str, Any]], int]:
    """
    Executes a read-only SQL query with transaction-scoped timeout against Postgres/SQLite.
    """
    # Attempt to set statement_timeout for Postgres
    try:
        db.execute(text("SET LOCAL statement_timeout = '5000ms'"))
    except Exception:
        pass  # SQLite or unsupported dialect will ignore gracefully

    result = db.execute(text(sql_query))
    columns = list(result.keys())
    rows = [dict(zip(columns, row)) for row in result.fetchall()]
    return columns, rows, len(rows)


def generate_and_execute_sql(db: Session, question: str, execute: bool = True) -> dict[str, Any]:
    schema_text = get_schema_summary(db)
    system_prompt = prompts.render("sql_agent", schema_text=schema_text)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Question: {question}\nSQL Query:"},
    ]

    raw_sql = llm.chat_completion(messages, temperature=0.1, max_tokens=300)
    is_safe, sanitized_sql, error_msg = validate_and_sanitize_sql(raw_sql)

    if not is_safe:
        return {
            "question": question,
            "generated_sql": raw_sql,
            "is_safe": False,
            "error": error_msg,
            "execution_result": None,
            "summary": None,
        }

    if not execute:
        return {
            "question": question,
            "generated_sql": sanitized_sql,
            "is_safe": True,
            "error": None,
            "execution_result": None,
            "summary": None,
        }

    try:
        columns, rows, count = execute_sandboxed_sql(db, sanitized_sql)
        
        summary = None
        if count > 0:
            summary_prompt = prompts.render(
                "sql_summary", 
                question=question, 
                sql_query=sanitized_sql, 
                results=json.dumps(rows[:5]) # limit context to top 5 rows
            )
            summary = llm.chat_completion(
                [{"role": "user", "content": summary_prompt}], 
                temperature=0.3, max_tokens=150
            )
        else:
            summary = "The query returned no results."

        return {
            "question": question,
            "generated_sql": sanitized_sql,
            "is_safe": True,
            "error": None,
            "execution_result": {
                "columns": columns,
                "rows": rows,
                "row_count": count,
            },
            "summary": summary,
        }
    except Exception as exc:
        return {
            "question": question,
            "generated_sql": sanitized_sql,
            "is_safe": True,
            "error": f"Execution error: {exc}",
            "execution_result": None,
            "summary": None,
        }
