"""Answer natural-language questions about an uploaded tabular file.

The NL-to-SQL agent queries the application's own database, which never contains the
user's uploaded rows — so it could not answer "what were my total sales?". This module
loads the actual dataset (cleaned version if present) and gives the LLM a grounded
context: the real schema, server-computed aggregates for every numeric column (so
quantitative answers are correct, not guessed from a sample), category breakdowns, and a
sample of rows. The LLM then answers from that context.
"""

import logging
import os

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.crud.uploaded_file import get_file_for_user
from app.models.cleaning import CleanedDataset
from app.services.llm import llm
from app.services.storage import get_storage_service

logger = logging.getLogger(__name__)

SAMPLE_ROWS = 15
MAX_CATEGORY_COLS = 5
MAX_CATEGORIES = 10


def _resolve_path(db: Session, user_id: int, file_id: int):
    db_file = get_file_for_user(db, user_id, file_id)
    if not db_file:
        return None, None
    storage = get_storage_service()
    cleaned = db.query(CleanedDataset).filter(CleanedDataset.file_id == file_id).first()
    path = None
    if cleaned and not cleaned.skipped and cleaned.storage_path:
        candidate = storage.get_file_path(user_id, cleaned.storage_path)
        if os.path.isfile(candidate):
            path = candidate
    if path is None:
        candidate = storage.get_file_path(user_id, db_file.stored_filename)
        if os.path.isfile(candidate):
            path = candidate
    return db_file, path


def _build_context(df: pd.DataFrame, filename: str) -> str:
    lines = [f"Dataset: {filename}", f"Rows: {len(df)}, Columns: {len(df.columns)}", ""]

    lines.append("Columns and types:")
    for col in df.columns:
        lines.append(f"  - {col} ({df[col].dtype})")
    lines.append("")

    numeric = df.select_dtypes(include=[np.number])
    if not numeric.empty:
        lines.append("Numeric column statistics (computed over the FULL dataset — use these for totals/averages):")
        for col in numeric.columns:
            s = numeric[col].dropna()
            if s.empty:
                continue
            lines.append(
                f"  - {col}: count={int(s.count())}, sum={s.sum():.2f}, "
                f"mean={s.mean():.2f}, min={s.min():.2f}, max={s.max():.2f}"
            )
        lines.append("")

    # Category breakdowns for low-cardinality object columns.
    obj_cols = [c for c in df.columns if df[c].dtype == object]
    shown = 0
    for col in obj_cols:
        if shown >= MAX_CATEGORY_COLS:
            break
        nunique = df[col].nunique(dropna=True)
        if 0 < nunique <= MAX_CATEGORIES:
            counts = df[col].value_counts(dropna=True).head(MAX_CATEGORIES)
            pairs = ", ".join(f"{k}={v}" for k, v in counts.items())
            lines.append(f"Value counts for '{col}': {pairs}")
            shown += 1
    if shown:
        lines.append("")

    sample = df.head(SAMPLE_ROWS).to_csv(index=False)
    lines.append(f"Sample rows (first {min(SAMPLE_ROWS, len(df))} of {len(df)}):")
    lines.append(sample)
    return "\n".join(lines)


def answer_file_question(db: Session, user_id: int, file_id: int, question: str) -> str | None:
    """Return an answer grounded in the file's data, or None if the file can't be used."""
    db_file, path = _resolve_path(db, user_id, file_id)
    if db_file is None:
        return "I couldn't find that file."
    if db_file.file_type not in ("csv", "xlsx") or path is None:
        return None  # not a tabular file we can load here

    try:
        df = pd.read_csv(path) if db_file.file_type == "csv" else pd.read_excel(path)
    except Exception:
        logger.exception("file_qa failed to read file %s", file_id)
        return "I couldn't read that file's data."

    context = _build_context(df, db_file.original_filename)
    system_prompt = (
        "You are a precise data analyst. Answer the user's question using ONLY the dataset "
        "context below. Prefer the pre-computed numeric statistics for any totals or averages "
        "(they cover the full dataset; the sample rows are only a preview). If the answer "
        "cannot be derived from the provided context, say so plainly.\n\n"
        f"{context}"
    )
    return llm.chat_completion(
        [{"role": "system", "content": system_prompt},
         {"role": "user", "content": question}],
        temperature=0.2,
        max_tokens=700,
    )
