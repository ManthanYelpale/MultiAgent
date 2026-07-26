from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.db.base import Base

class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    file_id = Column(Integer, ForeignKey("uploaded_files.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)

    charts = relationship("Chart", back_populates="dashboard", cascade="all, delete-orphan")

class Chart(Base):
    __tablename__ = "charts"

    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False, index=True)
    
    chart_type = Column(String(50), nullable=False) # e.g. bar, line, scatter, kpi, pie
    x_column = Column(String(255), nullable=True)
    y_column = Column(String(255), nullable=True)
    agg_function = Column(String(50), nullable=True) # e.g. sum, mean, count
    
    layout = Column(JSON, nullable=True) # stores x, y, w, h for react-grid-layout

    dashboard = relationship("Dashboard", back_populates="charts")
