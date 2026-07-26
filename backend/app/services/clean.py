import logging
import re
import json
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple

from app.services.llm import llm
from app.services.prompts import prompts

logger = logging.getLogger(__name__)

SEMANTIC_TYPES = [
    "currency", "date", "email", "id", "category", "percentage", "free_text", "unknown"
]

# Strings treated as null placeholders by the auto-safe pass.
# "-" is deliberately NOT included: it is a legitimate value in accounting exports,
# ticker symbols and category columns, and blanking it silently destroys real data.
NULL_PLACEHOLDERS = frozenset({"n/a", "na", "null", "none", "nan", ""})


def _is_null_placeholder(value: Any) -> bool:
    """True only for *string* placeholders. Non-strings are never touched."""
    return isinstance(value, str) and value.strip().lower() in NULL_PLACEHOLDERS

def _fallback_semantic_classify(df: pd.DataFrame) -> Dict[str, str]:
    """Heuristic semantic column classification fallback."""
    classification = {}
    for col in df.columns:
        col_lower = str(col).lower()
        col_data = df[col].dropna()
        samples = col_data.astype(str).head(5).tolist() if not col_data.empty else []
        samples_str = " ".join(samples).lower()

        if any(kw in col_lower for kw in ["percent", "pct", "rate", "margin", "discount_pct"]) or any("%" in s for s in samples):
            classification[col] = "percentage"
        elif any(kw in col_lower for kw in ["price", "cost", "revenue", "amount", "salary", "fee", "tax", "discount_amount", "total", "pay", "sales", "profit"]) or any(s in samples_str for s in ["$", "€", "£", "¥"]):
            classification[col] = "currency"
        elif any(kw in col_lower for kw in ["date", "time", "year", "month", "day", "created", "updated", "timestamp"]) or (
            len(samples) > 0 and any(re.match(r'^\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', s) for s in samples)
        ):
            classification[col] = "date"
        elif any(kw in col_lower for kw in ["email", "mail"]) or any("@" in s and "." in s for s in samples):
            classification[col] = "email"
        elif col_lower == "id" or col_lower.endswith("_id") or col_lower.startswith("id_") or any(kw in col_lower for kw in ["code", "uuid", "key"]) or (
            pd.api.types.is_integer_dtype(df[col]) and len(df[col].unique()) == len(df) and len(df) > 1
        ):
            classification[col] = "id"
        elif any(kw in col_lower for kw in ["status", "type", "category", "dept", "department", "region", "country", "state", "city", "gender", "role"]) or (
            df[col].dtype == object and len(col_data.unique()) <= 10 and len(col_data) > 0
        ):
            classification[col] = "category"
        elif any(kw in col_lower for kw in ["description", "note", "comment", "text", "name", "address"]) or (
            df[col].dtype == object and len(samples) > 0 and np.mean([len(str(s)) for s in samples]) > 20
        ):
            classification[col] = "free_text"
        else:
            classification[col] = "unknown"
    return classification

def classify_columns_semantic(df: pd.DataFrame) -> Dict[str, str]:
    """Classifies dataset columns into semantic types using a batched LLM call with heuristic fallback."""
    if df.empty or len(df.columns) == 0:
        return {}

    fallback = _fallback_semantic_classify(df)
    if not llm.is_configured():
        return fallback

    try:
        col_samples = {}
        for col in df.columns:
            col_samples[str(col)] = df[col].dropna().astype(str).head(3).tolist()

        prompt = prompts.render(
            "semantic_classifier",
            columns_json=json.dumps(col_samples)
        )
        res = llm.chat_completion([{"role": "user", "content": prompt}], temperature=0.0)
        
        if "```json" in res:
            res = res.split("```json")[1].split("```")[0]
        elif "```" in res:
            res = res.split("```")[1].split("```")[0]
        
        parsed = json.loads(res.strip())
        result = {}
        for col in df.columns:
            st = parsed.get(str(col), fallback.get(str(col), "unknown"))
            if st not in SEMANTIC_TYPES:
                st = fallback.get(str(col), "unknown")
            result[str(col)] = st
        return result
    except Exception as e:
        logger.warning(f"Batched LLM semantic classification failed, using fallback: {e}")
        return fallback

def _detect_auto_safe_issues(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Detect auto-safe issues that can be applied silently and never shown in review."""
    auto_safe = []
    
    # Check duplicate rows
    dups = int(df.duplicated().sum())
    if dups > 0:
        auto_safe.append({
            "column_name": "_dataset_",
            "issue_type": "duplicate_rows",
            "description": f"Auto-safe: {dups} exact duplicate rows detected",
            "confidence_tier": "auto_safe",
            "suggested_strategy": "drop_duplicates",
            "rows_affected": dups,
            "sample_values": []
        })

    for col in df.columns:
        col_data = df[col].dropna()
        if col_data.empty:
            continue
        
        if df[col].dtype == object:
            # Check leading/trailing whitespace (strings only, mirroring apply_auto_safe)
            has_whitespace = col_data.map(
                lambda v: isinstance(v, str) and v != v.strip()
            ).any()
            if has_whitespace:
                auto_safe.append({
                    "column_name": str(col),
                    "issue_type": "whitespace",
                    "description": "Auto-safe: leading/trailing whitespace detected",
                    "confidence_tier": "auto_safe",
                    "suggested_strategy": "strip_whitespace",
                    "rows_affected": int(len(col_data)),
                    "sample_values": col_data.astype(str).head(3).tolist()
                })
            
            # Check null strings ("N/A", "null", "")
            null_strings = col_data.map(_is_null_placeholder)
            if null_strings.any():
                auto_safe.append({
                    "column_name": str(col),
                    "issue_type": "string_nulls",
                    "description": "Auto-safe: string null placeholders (e.g. N/A, null) detected",
                    "confidence_tier": "auto_safe",
                    "suggested_strategy": "normalize_nulls",
                    "rows_affected": int(null_strings.sum()),
                    "sample_values": col_data[null_strings].astype(str).head(3).tolist()
                })
    return auto_safe

def detect_issues(df: pd.DataFrame, semantic_types: Dict[str, str] = None) -> List[Dict[str, Any]]:
    """Detect data issues, classifying into needs_judgment, blocking, and auto_safe.
    
    Guarantees that clean columns are NEVER included in the returned list.
    """
    if semantic_types is None:
        semantic_types = classify_columns_semantic(df)
        
    issues = []
    
    for col in df.columns:
        col_str = str(col)
        st = semantic_types.get(col_str, "unknown")
        
        # 1. Check blocking issues first: conflicting date formats in the same column
        if df[col].dtype == object:
            col_data = df[col].dropna().astype(str)
            if len(col_data) >= 2:
                has_mmdd = col_data.str.match(r'^(0?[1-9]|1[012])[/-](0?[1-9]|[12][0-9]|3[01])[/-]\d{4}$').any()
                has_ddmm = col_data.str.match(r'^(1[3-9]|[23][0-9])[/-](0?[1-9]|1[012])[/-]\d{4}$').any()
                if has_mmdd and has_ddmm:
                    issues.append({
                        "column_name": col_str,
                        "issue_type": "conflicting_date_formats",
                        "description": "Blocking Issue: Column mixes MM/DD/YYYY and DD-MM-YYYY dates",
                        "confidence_tier": "blocking",
                        "semantic_type": st,
                        "suggested_strategy": "leave_as_is",
                        "reason": "Conflicting date formats require manual inspection",
                        "rows_affected": int(len(col_data)),
                        "sample_values": col_data.head(3).tolist()
                    })
                    # Fall through: a date-format conflict does not mean the column is
                    # free of missing values or type mismatches, and skipping those
                    # checks hid real issues from the review screen.

        # 2. Check missing values (needs judgment)
        missing = int(df[col].isnull().sum())
        if missing > 0:
            sample = df[col].dropna().astype(str).head(3).tolist()
            if st in ["currency", "percentage"] or pd.api.types.is_numeric_dtype(df[col]):
                default_strat = "fill_median"
                reason_msg = f"Fill missing numeric/currency ({st}) values with median"
            elif st == "category":
                default_strat = "fill_mode"
                reason_msg = "Fill missing category values with most frequent mode"
            elif st in ["date", "id"]:
                default_strat = "drop_rows"
                reason_msg = f"Drop rows with missing {st} as placeholders can distort identifiers/dates"
            else:
                default_strat = "fill_custom"
                reason_msg = "Fill missing text values with a custom placeholder"

            issues.append({
                "column_name": col_str,
                "issue_type": "missing_values",
                "description": f"{missing} missing values detected ({round(missing/len(df)*100, 1)}% of rows)",
                "confidence_tier": "needs_judgment",
                "semantic_type": st,
                "suggested_strategy": default_strat,
                "reason": reason_msg,
                "rows_affected": missing,
                "sample_values": sample
            })
            
        # 3. Check type mismatches (needs judgment)
        if df[col].dtype == object:
            col_data = df[col].dropna()
            if not col_data.empty:
                has_currency = col_data.astype(str).str.contains(r'^\$|€|£|¥', regex=True).any()
                has_commas = col_data.astype(str).str.contains(r'^[0-9]+,[0-9]+', regex=True).any()
                has_percent = col_data.astype(str).str.contains(r'%$', regex=True).any()
                
                if has_currency or has_commas or has_percent or st in ["currency", "percentage"]:
                    # Ensure at least some characters look numeric
                    looks_num = col_data.astype(str).str.contains(r'\d').any()
                    if looks_num:
                        sample = col_data.astype(str).head(3).tolist()
                        issues.append({
                            "column_name": col_str,
                            "issue_type": "type_mismatch",
                            "description": "Column looks numeric but contains strings (e.g. currency, commas, %)",
                            "confidence_tier": "needs_judgment",
                            "semantic_type": st,
                            "suggested_strategy": "convert_numeric",
                            "reason": "Extract numeric values by removing symbols and formatting",
                            "rows_affected": int(len(col_data)),
                            "sample_values": sample
                        })

    return issues

def group_issues_by_type(issues: List[Dict[str, Any]], df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Group issues by type and semantic type, sorting by rows-affected * likely-importance."""
    groups_map = {}
    
    for issue in issues:
        if issue.get("confidence_tier") == "auto_safe":
            continue
            
        issue_type = issue["issue_type"]
        st = issue.get("semantic_type", "unknown")
        strat = issue.get("suggested_strategy", "leave_as_is")
        group_key = f"{issue_type}_{st}"
        
        if group_key not in groups_map:
            if issue_type == "missing_values":
                title = f"Missing Values — {st.title()} Columns"
            elif issue_type == "type_mismatch":
                title = f"Type Mismatch — {st.title()} Columns"
            elif issue_type == "conflicting_date_formats":
                title = f"Conflicting Date Formats — {st.title()} Columns"
            else:
                title = f"{issue_type.replace('_', ' ').title()} — {st.title()} Columns"
                
            groups_map[group_key] = {
                "group_id": group_key,
                "issue_type": issue_type,
                "title": title,
                "confidence_tier": issue.get("confidence_tier", "needs_judgment"),
                "semantic_type": st,
                "columns_affected": [],
                "suggested_strategy": strat,
                "rows_affected": 0,
                "column_details": []
            }
            
        group = groups_map[group_key]
        col_name = issue["column_name"]
        if col_name not in group["columns_affected"]:
            group["columns_affected"].append(col_name)
            group["rows_affected"] += issue.get("rows_affected", 0)
            group["column_details"].append({
                "column_name": col_name,
                "missing_count": issue.get("rows_affected", 0),
                "sample_values": issue.get("sample_values", []),
                "suggested_strategy": issue.get("suggested_strategy", strat),
                "reason": issue.get("reason", "")
            })
            
    group_list = list(groups_map.values())
    
    for group in group_list:
        n_cols = len(group["columns_affected"])
        group["description"] = f"{n_cols} column{'s' if n_cols != 1 else ''} affected ({group['rows_affected']} total rows affected)"
        
        # Calculate impact_score = rows_affected * likely_importance
        importance = 1.0
        st = group.get("semantic_type", "unknown")
        col_names_str = " ".join(group["columns_affected"]).lower()
        
        if st == "currency" or any(kw in col_names_str for kw in ["price", "revenue", "cost", "sales", "profit", "amount", "discount", "tax", "total", "margin", "kpi"]):
            importance = 3.0
        elif st in ["date", "id", "category", "percentage"]:
            importance = 2.0
            
        group["impact_score"] = round(group["rows_affected"] * importance, 2)
        
    # Sort descending by impact_score
    group_list.sort(key=lambda x: x["impact_score"], reverse=True)
    return group_list

def compute_quality_score(df: pd.DataFrame, issues: List[Dict[str, Any]]) -> Tuple[int, str]:
    """Compute a single 0-100 Data Quality Score for the dataset."""
    total_cols = max(1, len(df.columns))
    total_rows = max(1, len(df))
    
    # detect_issues() never emits the auto_safe tier (those come from the separate
    # _detect_auto_safe_issues), so this filter was a no-op implying a guarantee it did
    # not provide. Kept and made explicit so callers may pass a combined list safely.
    review_issues = [iss for iss in issues if iss.get("confidence_tier") != "auto_safe"]
    if not review_issues:
        return 100, "100/100 — All columns clean"

    affected_columns = len(set(iss["column_name"] for iss in review_issues))
    
    if affected_columns == 0:
        return 100, "100/100 — All columns clean"
        
    col_ratio = affected_columns / total_cols
    # Calculate penalty
    col_penalty = col_ratio * 60.0
    
    avg_rows_affected_ratio = np.mean([iss.get("rows_affected", 0) / total_rows for iss in review_issues])
    row_penalty = avg_rows_affected_ratio * 40.0
    
    score = int(max(0, min(99, round(100.0 - col_penalty - row_penalty))))
    headline = f"{score}/100 — {affected_columns} column{'s' if affected_columns != 1 else ''} need{'s' if affected_columns == 1 else ''} attention"
    return score, headline

def apply_auto_safe(df: pd.DataFrame) -> pd.DataFrame:
    """Silently apply auto-safe cleaning rules without review.

    Operates element-wise on genuine strings only. The previous implementation called
    .astype(str) on every object column, which coerced numbers to text and turned real
    None values into the literal string "None" — neither is reversible, and neither is
    "safe" enough to apply without asking the user.
    """
    df_clean = df.copy()
    # 1. Drop exact duplicate rows
    df_clean.drop_duplicates(inplace=True)

    for col in df_clean.columns:
        if df_clean[col].dtype != object:
            continue
        # 2. Strip leading/trailing whitespace from strings, leaving other types alone
        # 3. Normalise string null placeholders to NaN
        df_clean[col] = df_clean[col].map(
            lambda v: np.nan if _is_null_placeholder(v) else (v.strip() if isinstance(v, str) else v)
        )
    return df_clean

# Strategy implementers
def _fill_numeric_statistic(df, col, statistic: str):
    """Fill nulls with a numeric statistic.

    The column is converted to numeric first. Filling a float into an untouched string
    column (e.g. "$1,200") produced a column holding both floats and strings, which then
    broke every downstream aggregation.
    """
    numeric = pd.to_numeric(df[col], errors='coerce')
    val = numeric.mean() if statistic == "mean" else numeric.median()
    if pd.isna(val):
        logger.warning(f"Column '{col}' has no numeric values; skipping fill_{statistic}.")
        return
    df[col] = numeric.fillna(val)

def _fill_mean(df, col, params):
    _fill_numeric_statistic(df, col, "mean")

def _fill_median(df, col, params):
    _fill_numeric_statistic(df, col, "median")

def _fill_mode(df, col, params):
    mode_val = df[col].mode()
    if not mode_val.empty:
        df[col] = df[col].fillna(mode_val[0])

def _fill_custom(df, col, params):
    val = params.get("value", "")
    df[col] = df[col].fillna(val)

def _drop_rows(df, col, params):
    df.dropna(subset=[col], inplace=True)

def _leave_as_is(df, col, params):
    pass

def _convert_numeric(df, col, params):
    df[col] = df[col].astype(str).str.replace(r'[$,%€£¥]', '', regex=True)
    df[col] = pd.to_numeric(df[col], errors='coerce')

STRATEGY_REGISTRY = {
    "fill_mean": _fill_mean,
    "fill_median": _fill_median,
    "fill_mode": _fill_mode,
    "fill_custom": _fill_custom,
    "drop_rows": _drop_rows,
    "leave_as_is": _leave_as_is,
    "convert_numeric": _convert_numeric,
    "strip_whitespace": _leave_as_is,
    "normalize_nulls": _leave_as_is,
    "drop_duplicates": _leave_as_is
}

def apply_cleaning(df: pd.DataFrame, configs: List[Dict[str, Any]]) -> pd.DataFrame:
    """Apply silent auto_safe rules first, followed by configured rules."""
    df_clean = apply_auto_safe(df)
    
    for cfg in configs:
        strategy_name = cfg.get("strategy")
        col = cfg.get("column_name")
        params = cfg.get("params", {})
        
        func = STRATEGY_REGISTRY.get(strategy_name)
        if func and col in df_clean.columns:
            try:
                func(df_clean, col, params)
            except Exception as e:
                logger.error(f"Error applying cleaning strategy {strategy_name} on {col}: {e}")
                
    return df_clean
