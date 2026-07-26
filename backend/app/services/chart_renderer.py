import os
import uuid
import logging
from typing import Any, List, Dict
import pandas as pd

logger = logging.getLogger(__name__)

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except ImportError:
    plt = None

from app.core.config import settings

REPORTS_DIR = os.path.join(settings.UPLOAD_DIR, "reports")


def render_chart_to_image(chart_type: str, data: List[Dict[str, Any]], title: str) -> str | None:
    """
    Renders chart data to a PNG file using matplotlib and returns the file path.
    data format is [{"name": "Category A", "value": 100}, ...]
    """
    if plt is None or not data:
        return None

    os.makedirs(REPORTS_DIR, exist_ok=True)
    chart_filename = f"chart_{uuid.uuid4().hex[:8]}.png"
    chart_path = os.path.join(REPORTS_DIR, chart_filename)

    plt.figure(figsize=(6.5, 3.5), dpi=150)
    
    # Extract names and values
    names = [str(item.get("name", "")) for item in data]
    values = [item.get("value", 0) for item in data]

    if chart_type == "bar":
        # Check if labels are long, if so, we might need rotation
        plt.bar(names, values, color="#8b5cf6")
        plt.xticks(rotation=45, ha="right", fontsize=8)
        plt.ylabel("Value", fontsize=8)
        
    elif chart_type == "line":
        plt.plot(names, values, marker="o", color="#3b82f6", linewidth=2)
        plt.xticks(rotation=45, ha="right", fontsize=8)
        plt.ylabel("Value", fontsize=8)
        plt.grid(True, linestyle="--", alpha=0.5)

    elif chart_type == "pie":
        plt.pie(values, labels=names, autopct="%1.1f%%", startangle=140, textprops={'fontsize': 8})
        plt.axis('equal')  # Equal aspect ratio ensures that pie is drawn as a circle.
        
    else: # Fallback to scatter
        plt.scatter(names, values, color="#10b981")
        plt.xticks(rotation=45, ha="right", fontsize=8)
        plt.ylabel("Value", fontsize=8)
        plt.grid(True, linestyle="--", alpha=0.5)

    plt.title(title, fontsize=10, fontweight="bold")
    plt.tight_layout()
    plt.savefig(chart_path)
    plt.close()

    return chart_path
