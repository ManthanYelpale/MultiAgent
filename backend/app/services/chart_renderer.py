import os
import uuid
import logging
from typing import Any, List, Dict
import pandas as pd

logger = logging.getLogger(__name__)

try:
    import matplotlib
    matplotlib.use("Agg")
    from matplotlib.figure import Figure
except ImportError:
    Figure = None

from app.core.config import settings

REPORTS_DIR = os.path.join(settings.UPLOAD_DIR, "reports")


def render_chart_to_image(chart_type: str, data: List[Dict[str, Any]], title: str) -> str | None:
    """
    Renders chart data to a PNG file and returns the file path.
    data format is [{"name": "Category A", "value": 100}, ...]

    Uses the object-oriented Figure API rather than pyplot. pyplot keeps global state
    that is not thread-safe, so two concurrent report builds (running in FastAPI's
    threadpool) could draw into each other's figures.
    """
    if Figure is None or not data:
        return None

    os.makedirs(REPORTS_DIR, exist_ok=True)
    chart_filename = f"chart_{uuid.uuid4().hex[:8]}.png"
    chart_path = os.path.join(REPORTS_DIR, chart_filename)

    names = [str(item.get("name", "")) for item in data]
    values = [item.get("value", 0) for item in data]

    fig = Figure(figsize=(6.5, 3.5), dpi=150)
    ax = fig.subplots()

    if chart_type == "bar":
        ax.bar(names, values, color="#8b5cf6")
        ax.tick_params(axis="x", labelrotation=45, labelsize=8)
        ax.set_ylabel("Value", fontsize=8)
    elif chart_type == "line":
        ax.plot(names, values, marker="o", color="#3b82f6", linewidth=2)
        ax.tick_params(axis="x", labelrotation=45, labelsize=8)
        ax.set_ylabel("Value", fontsize=8)
        ax.grid(True, linestyle="--", alpha=0.5)
    elif chart_type == "pie":
        ax.pie(values, labels=names, autopct="%1.1f%%", startangle=140,
               textprops={"fontsize": 8})
        ax.axis("equal")
    else:
        ax.scatter(names, values, color="#10b981")
        ax.tick_params(axis="x", labelrotation=45, labelsize=8)
        ax.set_ylabel("Value", fontsize=8)
        ax.grid(True, linestyle="--", alpha=0.5)

    for label in ax.get_xticklabels():
        label.set_horizontalalignment("right")
    ax.set_title(title, fontsize=10, fontweight="bold")
    fig.tight_layout()
    fig.savefig(chart_path)

    return chart_path
