import pandas as pd
import numpy as np
from app.services.ml import MLService
from app.schemas.analytics import ColumnsListResponse, SegmentationRequest

def test_columns_list_response():
    print("Testing ColumnsListResponse schema...")
    df = pd.DataFrame({
        "Product": ["Widget A", "Widget B"],
        "Price": [10.5, 20.0],
        "Quantity": [100, 50],
        "Revenue": [1050, 1000],
        "Date": ["2026-01-01", "2026-01-02"],
        "Region": ["US", "EU"]
    })
    
    col_list = [str(c) for c in df.columns]
    response = ColumnsListResponse(file_id=1, columns=col_list)
    assert response.file_id == 1
    assert response.columns == ["Product", "Price", "Quantity", "Revenue", "Date", "Region"]
    print("[OK] ColumnsListResponse passed:", response.columns)

def test_explicit_customer_segmentation():
    print("Testing MLService.segment_customers with explicit column overrides...")
    df = pd.DataFrame({
        "client_code": [101, 101, 102, 103, 103, 104],
        "transaction_date": ["2026-01-01", "2026-01-05", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-06"],
        "order_total": [50.0, 150.0, 300.0, 20.0, 30.0, 500.0],
        "other_metric": [1, 2, 3, 4, 5, 6]
    })
    
    res = MLService.segment_customers(
        df=df,
        n_clusters=2,
        id_column="client_code",
        date_column="transaction_date",
        monetary_column="order_total"
    )
    
    assert res["n_clusters"] == 2
    assert len(res["cluster_summary"]) == 2
    assert "Cluster" in df.columns or len(res["cluster_summary"]) > 0
    print("[OK] Explicit RFM segmentation passed:", res["n_clusters"], "clusters generated.")

if __name__ == "__main__":
    test_columns_list_response()
    test_explicit_customer_segmentation()
    print("\n[SUCCESS] All simple Phase 5.1 tests passed successfully!")
