from sqlalchemy import Column, Integer, String, JSON, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class CleaningConfig(Base):
    __tablename__ = "cleaning_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("uploaded_files.id", ondelete="CASCADE"), nullable=False)
    column_name = Column(String(255), nullable=False)
    issue_type = Column(String(50), nullable=False)
    strategy = Column(String(50), nullable=False)
    params = Column(JSON, nullable=True)
    applied = Column(Boolean, default=False)
    
class CleanedDataset(Base):
    __tablename__ = "datasets_cleaned"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("uploaded_files.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, default=1)
    storage_path = Column(String(255), nullable=True) # None if skipped and just using raw
    skipped = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
