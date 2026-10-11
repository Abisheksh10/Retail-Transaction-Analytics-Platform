"""Transformation module for data cleaning and type normalization."""

import pandas as pd


def clean_retail_data(df: pd.DataFrame) -> pd.DataFrame:
    """Standardize column names, cast types, and handle null customer IDs."""
    df_clean = df.copy()

    # Normalize column names to snake_case
    df_clean.columns = [
        col.strip().lower().replace(" ", "_")
        for col in df_clean.columns
    ]

    # Convert invoice_date to datetime if not already
    if "invoicedate" in df_clean.columns:
        df_clean.rename(columns={"invoicedate": "invoice_date"}, inplace=True)
    if "invoice_date" in df_clean.columns:
        df_clean["invoice_date"] = pd.to_datetime(df_clean["invoice_date"], errors="coerce")

    # Cast customer_id to nullable integer
    if "customer_id" in df_clean.columns:
        df_clean["customer_id"] = pd.to_numeric(df_clean["customer_id"], errors="coerce").astype("Int64")

    # Numeric conversions
    if "quantity" in df_clean.columns:
        df_clean["quantity"] = pd.to_numeric(df_clean["quantity"], errors="coerce").fillna(0).astype(int)

    if "price" in df_clean.columns:
        df_clean["price"] = pd.to_numeric(df_clean["price"], errors="coerce").fillna(0.0)

    return df_clean
