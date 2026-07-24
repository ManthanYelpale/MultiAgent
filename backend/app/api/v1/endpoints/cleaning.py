import json
import pandas as pd
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.cleaning import CleaningConfig, CleanedDataset
from app.crud.uploaded_file import get_file_for_user
from app.services.storage import get_storage_service
from app.services.clean import detect_issues, apply_cleaning
from app.services.prompts import prompts
from app.services.llm import llm

router = APIRouter(prefix="/cleaning", tags=["cleaning"])

class CleaningStrategyConfig(BaseModel):
    column_name: str
    issue_type: str
    strategy: str
    params: dict = {}

class ApplyCleaningRequest(BaseModel):
    configs: List[CleaningStrategyConfig]

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

@router.get("/file/{file_id}/quality-report")
def get_quality_report(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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
        
    issues = detect_issues(df)
    
    for issue in issues:
        suggestion = _get_ai_suggestion(issue["column_name"], issue["issue_type"], issue["sample_values"])
        issue["suggested_strategy"] = suggestion.get("strategy", "leave_as_is")
        issue["reason"] = suggestion.get("reason", "")
        
    return {
        "total_rows": len(df),
        "issues": issues
    }

@router.post("/file/{file_id}/apply")
def apply_cleaning_rules(
    file_id: int,
    req: ApplyCleaningRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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
        
    configs_list = [c.dict() for c in req.configs]
    
    df_clean = apply_cleaning(df, configs_list)
    
    cleaned_filename = f"cleaned_{db_file.stored_filename}"
    cleaned_path = storage.get_file_path(current_user.id, cleaned_filename)
    
    if db_file.file_type == "csv":
        df_clean.to_csv(cleaned_path, index=False)
    else:
        df_clean.to_excel(cleaned_path, index=False)
        
    for cfg in configs_list:
        db_cfg = CleaningConfig(
            file_id=file_id,
            column_name=cfg["column_name"],
            issue_type=cfg["issue_type"],
            strategy=cfg["strategy"],
            params=cfg["params"],
            applied=True
        )
        db.add(db_cfg)
        
    existing_cleaned = db.query(CleanedDataset).filter(CleanedDataset.file_id == file_id).first()
    if existing_cleaned:
        existing_cleaned.version += 1
        existing_cleaned.storage_path = cleaned_filename
        existing_cleaned.skipped = False
    else:
        db_cleaned = CleanedDataset(
            file_id=file_id,
            version=1,
            storage_path=cleaned_filename,
            skipped=False
        )
        db.add(db_cleaned)
        
    db.commit()
    return {"status": "ok", "message": "Cleaning applied successfully"}

@router.post("/file/{file_id}/skip")
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
