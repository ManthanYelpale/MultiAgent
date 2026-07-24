from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class ChartLayoutUpdate(BaseModel):
    layout: Dict[str, Any]

class ChartDataRequest(BaseModel):
    file_id: int
    chart_type: str
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    agg_function: Optional[str] = None

class ChartCreate(BaseModel):
    chart_type: str
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    agg_function: Optional[str] = None
    layout: Optional[Dict[str, Any]] = None

class ChartResponse(BaseModel):
    id: int
    dashboard_id: int
    chart_type: str
    x_column: Optional[str]
    y_column: Optional[str]
    agg_function: Optional[str]
    layout: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True

class DashboardResponse(BaseModel):
    id: int
    file_id: int
    user_id: int
    name: str
    charts: List[ChartResponse]

    class Config:
        from_attributes = True
