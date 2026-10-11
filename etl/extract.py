"""Extraction module to stream and sample Excel workbook sheets."""

from pathlib import Path
from typing import Optional
import pandas as pd


def extract_sheet(
    filepath: str | Path,
    sheet_name: str,
    nrows: Optional[int] = None,
) -> pd.DataFrame:
    """Extract rows from specified sheet using openpyxl engine."""
    return pd.read_excel(
        filepath,
        sheet_name=sheet_name,
        nrows=nrows,
        engine="openpyxl",
    )
