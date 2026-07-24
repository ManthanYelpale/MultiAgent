import json
import pandas as pd
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.dashboard import Dashboard, Chart
from app.crud.uploaded_file import get_file_for_user
from app.schemas.dashboard import DashboardResponse, ChartDataRequest, ChartLayoutUpdate, ChartResponse, ChartCreate
from app.services.storage import get_storage_service

router = APIRouter(prefix="/dashboards", tags=["dashboards"])

def generate_default_charts(db: Session, dashboard: Dashboard, columns_preview: str):
    try:
        profile = json.loads(columns_preview)
        dtypes = profile.get("dtypes", {})
    except Exception:
        return

    numeric_cols = [c for c, d in dtypes.items() if d.get("inferred") == "Numeric"]
    categorical_cols = [c for c, d in dtypes.items() if d.get("inferred") in ["Categorical", "Text"]]
    datetime_cols = [c for c, d in dtypes.items() if d.get("inferred") == "Datetime"]

    charts_to_create = []
    
    # 1. KPI for primary numeric (if any)
    if numeric_cols:
        primary_num = numeric_cols[0]
        charts_to_create.append(Chart(dashboard_id=dashboard.id, chart_type="kpi", y_column=primary_num, agg_function="sum", layout={"x":0,"y":0,"w":3,"h":2}))
    
    # 2. Bar chart (categorical vs numeric)
    if categorical_cols and numeric_cols:
        charts_to_create.append(Chart(dashboard_id=dashboard.id, chart_type="bar", x_column=categorical_cols[0], y_column=numeric_cols[0], agg_function="mean", layout={"x":3,"y":0,"w":5,"h":4}))
    
    # 3. Line chart (datetime vs numeric)
    if datetime_cols and numeric_cols:
        charts_to_create.append(Chart(dashboard_id=dashboard.id, chart_type="line", x_column=datetime_cols[0], y_column=numeric_cols[0], agg_function="sum", layout={"x":8,"y":0,"w":4,"h":4}))
    
    # 4. Pie chart (categorical count)
    if categorical_cols:
        cat = categorical_cols[0] if len(categorical_cols) == 1 else categorical_cols[1] if len(categorical_cols) > 1 else categorical_cols[0]
        charts_to_create.append(Chart(dashboard_id=dashboard.id, chart_type="pie", x_column=cat, agg_function="count", layout={"x":0,"y":2,"w":3,"h":4}))
    
    if charts_to_create:
        db.add_all(charts_to_create)
        db.commit()


@router.get("/file/{file_id}", response_model=DashboardResponse)
def get_dashboard(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify file ownership
    db_file = get_file_for_user(db, current_user.id, file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    dashboard = db.query(Dashboard).filter(Dashboard.file_id == file_id, Dashboard.user_id == current_user.id).first()
    
    if not dashboard:
        dashboard = Dashboard(user_id=current_user.id, file_id=file_id, name=f"{db_file.original_filename} Dashboard")
        db.add(dashboard)
        db.commit()
        db.refresh(dashboard)
        if db_file.columns_preview:
            generate_default_charts(db, dashboard, db_file.columns_preview)
        db.refresh(dashboard)

    return dashboard

@router.post("/charts/data")
def get_chart_data(
    req: ChartDataRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_file = get_file_for_user(db, current_user.id, req.file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    storage = get_storage_service()
    path = storage.get_file_path(current_user.id, db_file.stored_filename)

    try:
        if db_file.file_type == "csv":
            df = pd.read_csv(path)
        else:
            df = pd.read_excel(path)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error reading file")

    if req.chart_type == "kpi":
        val = 0
        if req.y_column in df.columns:
            if req.agg_function in ["sum", "mean", "max", "min"]:
                series = pd.to_numeric(df[req.y_column], errors="coerce")
                if req.agg_function == "sum": val = series.sum()
                elif req.agg_function == "mean": val = series.mean()
                elif req.agg_function == "max": val = series.max()
                elif req.agg_function == "min": val = series.min()
            elif req.agg_function == "count":
                val = df[req.y_column].count()
        
        # handle numpy types
        import numpy as np
        if isinstance(val, (np.int64, np.float64)):
            val = val.item()
            
        return {"value": round(val, 2) if isinstance(val, float) else val}

    # Groupby aggregation
    if not req.x_column or req.x_column not in df.columns:
        return []

    # Handle datetime truncating if it's a date column for cleaner lines
    if pd.api.types.is_datetime64_any_dtype(df[req.x_column]):
        df[req.x_column] = df[req.x_column].dt.strftime('%Y-%m-%d')

    if req.agg_function == "count":
        agg_df = df.groupby(req.x_column).size().reset_index(name='value')
    else:
        if not req.y_column or req.y_column not in df.columns:
            return []
        
        # Coerce to numeric for sum and mean
        if req.agg_function in ["sum", "mean"]:
            df[req.y_column] = pd.to_numeric(df[req.y_column], errors="coerce")
            
        if req.agg_function == "sum":
            agg_df = df.groupby(req.x_column)[req.y_column].sum().reset_index(name='value')
        elif req.agg_function == "mean":
            agg_df = df.groupby(req.x_column)[req.y_column].mean().reset_index(name='value')
        else:
            return []

    # Format for recharts
    agg_df = agg_df.fillna("Unknown")
    
    # Recharts prefers a simple list of dicts: [{name: 'Jan', value: 400}, ...]
    result = []
    for _, row in agg_df.iterrows():
        result.append({
            "name": str(row[req.x_column]),
            "value": round(row['value'], 2) if isinstance(row['value'], float) else row['value']
        })

    # Sort descending by value for bar/pie for better visualization, unless it's line (usually time-series)
    if req.chart_type in ["bar", "pie"]:
        result.sort(key=lambda x: x["value"], reverse=True)
        # Top 20 to avoid crashing browser
        result = result[:20]

    return result

@router.put("/charts/{chart_id}/layout")
def update_chart_layout(
    chart_id: int,
    req: ChartLayoutUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    chart = db.query(Chart).filter(Chart.id == chart_id).first()
    if not chart or chart.dashboard.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Chart not found")
    
    chart.layout = req.layout
    db.commit()
    return {"status": "ok"}

@router.delete("/charts/{chart_id}")
def delete_chart(
    chart_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    chart = db.query(Chart).filter(Chart.id == chart_id).first()
    if not chart or chart.dashboard.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Chart not found")
    
    db.delete(chart)
    db.commit()
    return {"status": "ok"}
    
@router.post("/file/{file_id}/charts", response_model=ChartResponse)
def add_chart(
    file_id: int,
    req: ChartCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    dashboard = db.query(Dashboard).filter(Dashboard.file_id == file_id, Dashboard.user_id == current_user.id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
        
    chart = Chart(
        dashboard_id=dashboard.id,
        chart_type=req.chart_type,
        x_column=req.x_column,
        y_column=req.y_column,
        agg_function=req.agg_function,
        layout=req.layout or {"x":0,"y":0,"w":4,"h":4}
    )
    db.add(chart)
    db.commit()
    db.refresh(chart)
    return chart
