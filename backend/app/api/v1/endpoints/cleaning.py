import json
import pandas as pd
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.cleaning import CleaningConfig, CleanedDataset, CleaningTemplate
from app.crud.uploaded_file import get_file_for_user
from app.services.storage import get_storage_service
from app.services.clean import (
    detect_issues,
    classify_columns_semantic,
    group_issues_by_type,
    compute_quality_score,
    apply_cleaning,
    _detect_auto_safe_issues,
)
from app.services.prompts import prompts
from app.services.llm import llm

router = APIRouter(prefix="/cleaning", tags=["cleaning"])
datasets_router = APIRouter(prefix="/datasets", tags=["datasets"])

class CleaningStrategyConfig(BaseModel):
    column_name: str
    issue_type: str
    strategy: str
    params: dict = {}

class ApplyCleaningRequest(BaseModel):
    configs: List[CleaningStrategyConfig]

class SaveTemplateRequest(BaseModel):
    name: str
    rules: List[CleaningStrategyConfig]

def _get_ai_suggestion(column_name: str, issue_type: str, sample_values: list) -> dict:
    prompt = prompts.render(
        "data_cleaner",
        column_name=column_name,
        issue_type=issue_type,
        sample_values=str(sample_values)
    )
    res = llm.chat_completion([{"role": "user", "content": prompt}], temperature=0.0)
    try:
        if "```json" in res:
            res = res.split("```json")[1].split("```")[0]
        elif "```" in res:
            res = res.split("```")[1].split("```")[0]
        return json.loads(res.strip())
    except:
        return {"strategy": "leave_as_is", "reason": "Failed to generate suggestion"}

def _generate_quality_report_data(file_id: int, current_user: User, db: Session) -> Dict[str, Any]:
    db_file = get_file_for_user(db, current_user.id, file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    storage = get_storage_service()
    path = storage.get_file_path(current_user.id, db_file.stored_filename)
    
    try:
        if db_file.file_type == "csv":
            df = pd.read_csv(path)
        else:
            df = pd.read_excel(path)
    except Exception:
        raise HTTPException(status_code=500, detail="Error reading file")
        
    semantic_types = classify_columns_semantic(df)
    issues = detect_issues(df, semantic_types=semantic_types)
    auto_safe_issues = _detect_auto_safe_issues(df)
    
    for issue in issues:
        if not issue.get("reason"):
            suggestion = _get_ai_suggestion(issue["column_name"], issue["issue_type"], issue["sample_values"])
            issue["suggested_strategy"] = suggestion.get("strategy", issue.get("suggested_strategy", "leave_as_is"))
            issue["reason"] = suggestion.get("reason", "")
            
    issue_groups = group_issues_by_type(issues, df)
    quality_score, quality_headline = compute_quality_score(df, issues)
    
    # Check if a matching template exists for this user and dataframe schema
    df_columns_set = set(str(c) for c in df.columns)
    matching_template = None
    user_templates = db.query(CleaningTemplate).filter(CleaningTemplate.user_id == current_user.id).all()
    for tpl in user_templates:
        if isinstance(tpl.schema_signature, list) and set(tpl.schema_signature) == df_columns_set:
            matching_template = tpl
            break

    return {
        "file_id": file_id,
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "quality_score": quality_score,
        "quality_headline": quality_headline,
        "issues": issues,
        "issue_groups": issue_groups,
        "auto_safe_issues": auto_safe_issues,
        "has_template": matching_template is not None,
        "template_id": matching_template.id if matching_template else None,
        "template_name": matching_template.name if matching_template else None,
        "template_rules": matching_template.rules if matching_template else []
    }

@router.get("/file/{file_id}/quality-report")
@datasets_router.get("/{file_id}/quality-report")
def get_quality_report(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return _generate_quality_report_data(file_id, current_user, db)

def _apply_cleaning_logic(file_id: int, configs_list: List[Dict[str, Any]], current_user: User, db: Session) -> Dict[str, Any]:
    db_file = get_file_for_user(db, current_user.id, file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    storage = get_storage_service()
    raw_path = storage.get_file_path(current_user.id, db_file.stored_filename)
    
    try:
        if db_file.file_type == "csv":
            df = pd.read_csv(raw_path)
        else:
            df = pd.read_excel(raw_path)
    except Exception:
        raise HTTPException(status_code=500, detail="Error reading file")
        
    df_clean = apply_cleaning(df, configs_list)

    existing_cleaned = db.query(CleanedDataset).filter(CleanedDataset.file_id == file_id).first()
    next_version = (existing_cleaned.version + 1) if existing_cleaned else 1

    # Include the version in the filename. Previously every run wrote to the same
    # "cleaned_<name>" path while incrementing a version counter that pointed nowhere —
    # the prior output was destroyed and the version number was meaningless.
    cleaned_filename = f"cleaned_v{next_version}_{db_file.stored_filename}"
    cleaned_path = storage.get_file_path(current_user.id, cleaned_filename)

    if db_file.file_type == "csv":
        df_clean.to_csv(cleaned_path, index=False)
    else:
        df_clean.to_excel(cleaned_path, index=False)

    # Supersede any prior config rows for this file so `applied` reflects only the
    # ruleset that produced the current output.
    db.query(CleaningConfig).filter(CleaningConfig.file_id == file_id).update(
        {CleaningConfig.applied: False}, synchronize_session=False
    )

    for cfg in configs_list:
        db_cfg = CleaningConfig(
            file_id=file_id,
            column_name=cfg["column_name"],
            issue_type=cfg.get("issue_type", "unknown"),
            strategy=cfg["strategy"],
            params=cfg.get("params", {}),
            applied=True
        )
        db.add(db_cfg)
        
    if existing_cleaned:
        existing_cleaned.version = next_version
        existing_cleaned.storage_path = cleaned_filename
        existing_cleaned.skipped = False
    else:
        db.add(CleanedDataset(
            file_id=file_id,
            version=next_version,
            storage_path=cleaned_filename,
            skipped=False,
        ))

    db.commit()
    return {
        "status": "ok",
        "version": next_version,
        "message": "Cleaning applied successfully",
    }

@router.post("/file/{file_id}/apply")
@datasets_router.post("/{file_id}/apply")
@datasets_router.post("/{file_id}/apply-cleaning")
def apply_cleaning_rules(
    file_id: int,
    req: ApplyCleaningRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    configs_list = [c.dict() for c in req.configs]
    return _apply_cleaning_logic(file_id, configs_list, current_user, db)

@router.post("/file/{file_id}/skip")
@datasets_router.post("/{file_id}/skip")
def skip_cleaning(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_file = get_file_for_user(db, current_user.id, file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    existing_cleaned = db.query(CleanedDataset).filter(CleanedDataset.file_id == file_id).first()
    if existing_cleaned:
        existing_cleaned.skipped = True
    else:
        db_cleaned = CleanedDataset(
            file_id=file_id,
            version=1,
            storage_path="",
            skipped=True
        )
        db.add(db_cleaned)
        
    db.commit()
    return {"status": "ok", "message": "Cleaning skipped"}

@router.get("/file/{file_id}/status")
@datasets_router.get("/{file_id}/status")
def get_cleaning_status(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cleaned = db.query(CleanedDataset).filter(CleanedDataset.file_id == file_id).first()
    if not cleaned:
        return {"status": "pending"}
    if cleaned.skipped:
        return {"status": "skipped"}
    return {"status": "applied"}

@router.post("/file/{file_id}/save-template")
@router.post("/templates")
@datasets_router.post("/{file_id}/save-template")
def save_cleaning_template(
    req: SaveTemplateRequest,
    file_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    schema_signature = []
    if file_id:
        db_file = get_file_for_user(db, current_user.id, file_id)
        if db_file:
            storage = get_storage_service()
            path = storage.get_file_path(current_user.id, db_file.stored_filename)
            try:
                if db_file.file_type == "csv":
                    df = pd.read_csv(path)
                else:
                    df = pd.read_excel(path)
                schema_signature = sorted(list(str(c) for c in df.columns))
            except Exception:
                pass
                
    if not schema_signature:
        # Fallback: deduce from rules column_names if file not provided
        schema_signature = sorted(list(set(c.column_name for c in req.rules)))
        
    template = CleaningTemplate(
        user_id=current_user.id,
        name=req.name,
        schema_signature=schema_signature,
        rules=[r.dict() for r in req.rules]
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return {"status": "ok", "template_id": template.id, "message": f"Template '{req.name}' saved successfully"}

@router.get("/templates")
def list_cleaning_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    templates = db.query(CleaningTemplate).filter(CleaningTemplate.user_id == current_user.id).all()
    return {
        "templates": [
            {
                "id": t.id,
                "name": t.name,
                "schema_signature": t.schema_signature,
                "rules": t.rules,
                "created_at": t.created_at.isoformat() if t.created_at else None
            }
            for t in templates
        ]
    }
