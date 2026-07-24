import pandas as pd
import numpy as np

def detect_issues(df: pd.DataFrame) -> list[dict]:
    issues = []
    
    for col in df.columns:
        # Check missing values
        missing = int(df[col].isnull().sum())
        if missing > 0:
            sample = df[col].dropna().astype(str).head(3).tolist()
            issues.append({
                "column_name": col,
                "issue_type": "missing_values",
                "description": f"{missing} missing values detected",
                "sample_values": sample
            })
            
        # Check type mismatches (e.g. numeric-looking strings)
        if df[col].dtype == object:
            # Drop na for checking
            col_data = df[col].dropna()
            if not col_data.empty:
                # Check if it contains currency symbols, commas, percent
                has_currency = col_data.astype(str).str.contains(r'^\$|€|£|¥', regex=True).any()
                has_commas = col_data.astype(str).str.contains(r'^[0-9]+,[0-9]+', regex=True).any()
                has_percent = col_data.astype(str).str.contains(r'%$', regex=True).any()
                
                if has_currency or has_commas or has_percent:
                    sample = col_data.astype(str).head(3).tolist()
                    issues.append({
                        "column_name": col,
                        "issue_type": "type_mismatch",
                        "description": "Column looks numeric but contains strings (e.g. currency, commas, %)",
                        "sample_values": sample
                    })
    return issues


def _fill_mean(df, col, params):
    val = pd.to_numeric(df[col], errors='coerce').mean()
    df[col] = df[col].fillna(val)

def _fill_median(df, col, params):
    val = pd.to_numeric(df[col], errors='coerce').median()
    df[col] = df[col].fillna(val)

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
    df[col] = df[col].astype(str).str.replace(r'[$,%]', '', regex=True)
    df[col] = pd.to_numeric(df[col], errors='coerce')

STRATEGY_REGISTRY = {
    "fill_mean": _fill_mean,
    "fill_median": _fill_median,
    "fill_mode": _fill_mode,
    "fill_custom": _fill_custom,
    "drop_rows": _drop_rows,
    "leave_as_is": _leave_as_is,
    "convert_numeric": _convert_numeric
}

def apply_cleaning(df: pd.DataFrame, configs: list[dict]) -> pd.DataFrame:
    df_clean = df.copy()
    
    for cfg in configs:
        strategy_name = cfg.get("strategy")
        col = cfg.get("column_name")
        params = cfg.get("params", {})
        
        func = STRATEGY_REGISTRY.get(strategy_name)
        if func and col in df_clean.columns:
            try:
                func(df_clean, col, params)
            except Exception as e:
                pass
                
    return df_clean
