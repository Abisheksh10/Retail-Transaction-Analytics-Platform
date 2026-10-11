"""Data cleaning and validation module for retail transaction datasets."""

import pandas as pd
import numpy as np


def clean_retail_data(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Clean, filter, validate, and enrich raw retail transactions.
    
    Returns:
        tuple[pd.DataFrame, int]: (cleaned_dataframe, rejected_rows_count)
    """
    initial_rows = len(df)
    if initial_rows == 0:
        return df, 0

    clean_df = df.copy()

    # 1. Standardize column names (strip whitespace and lower-case)
    col_mapping = {}
    for col in clean_df.columns:
        norm = str(col).strip().lower().replace(" ", "").replace("_", "")
        if norm in ("invoice", "invoiceno"):
            col_mapping[col] = "invoice_no"
        elif norm == "stockcode":
            col_mapping[col] = "stock_code"
        elif norm == "description":
            col_mapping[col] = "description"
        elif norm == "quantity":
            col_mapping[col] = "quantity"
        elif norm in ("invoicedate", "date"):
            col_mapping[col] = "invoice_date"
        elif norm in ("price", "unitprice"):
            col_mapping[col] = "unit_price"
        elif norm in ("customerid", "customer"):
            col_mapping[col] = "customer_id"
        elif norm == "country":
            col_mapping[col] = "country"

    clean_df.rename(columns=col_mapping, inplace=True)

    # Required columns check
    required_cols = [
        "invoice_no", "stock_code", "description", "quantity",
        "invoice_date", "unit_price", "customer_id", "country"
    ]
    for req in required_cols:
        if req not in clean_df.columns:
            clean_df[req] = np.nan

    # 2. Convert and validate invoice_no and stock_code
    clean_df["invoice_no"] = clean_df["invoice_no"].fillna("").astype(str).str.strip()
    clean_df["stock_code"] = clean_df["stock_code"].fillna("").astype(str).str.strip()

    # Drop missing / empty / nan strings in invoice_no and stock_code
    valid_invoice = ~clean_df["invoice_no"].isin(["", "nan", "None", "NULL", "NaT"])
    valid_stock = ~clean_df["stock_code"].isin(["", "nan", "None", "NULL", "NaT"])
    clean_df = clean_df[valid_invoice & valid_stock]

    # 3. Filter out cancellations (Invoice starting with 'C' or 'c')
    clean_df = clean_df[~clean_df["invoice_no"].str.upper().str.startswith("C")]

    # 4. Validate numerical bounds: Quantity > 0 and Price/UnitPrice > 0
    clean_df["quantity"] = pd.to_numeric(clean_df["quantity"], errors="coerce")
    clean_df["unit_price"] = pd.to_numeric(clean_df["unit_price"], errors="coerce")

    clean_df = clean_df[(clean_df["quantity"] > 0) & (clean_df["unit_price"] > 0)]
    clean_df["quantity"] = clean_df["quantity"].astype(int)
    clean_df["unit_price"] = clean_df["unit_price"].astype(float).round(2)

    # 5. Clean Description & Country; fill defaults and strip
    clean_df["description"] = (
        clean_df["description"]
        .astype(str)
        .str.strip()
        .replace({"nan": np.nan, "None": np.nan, "": np.nan})
        .fillna("Unknown Product")
        .str.slice(0, 255)
    )

    clean_df["country"] = (
        clean_df["country"]
        .astype(str)
        .str.strip()
        .replace({"nan": np.nan, "None": np.nan, "": np.nan})
        .fillna("Unknown")
        .str.slice(0, 100)
    )

    # 6. Parse InvoiceDate to datetime; drop invalid dates
    clean_df["invoice_date"] = pd.to_datetime(clean_df["invoice_date"], errors="coerce")
    clean_df = clean_df[clean_df["invoice_date"].notna()]

    # 7. Map missing Customer ID to 'GUEST'
    def format_customer_id(val):
        if pd.isna(val):
            return "GUEST"
        val_str = str(val).strip()
        if val_str in ("", "nan", "None", "NULL", "NaT"):
            return "GUEST"
        # If stored as float like 13085.0 -> convert to integer string '13085'
        try:
            float_val = float(val_str)
            if float_val.is_integer():
                return str(int(float_val))
        except (ValueError, OverflowError):
            pass
        return val_str[:50]

    clean_df["customer_id"] = clean_df["customer_id"].apply(format_customer_id)

    # 8. Calculate derived metric: total_amount = round(Quantity * UnitPrice, 2)
    clean_df["total_amount"] = (clean_df["quantity"] * clean_df["unit_price"]).round(2)

    # 9. Deduplicate rows on subset (InvoiceNo, StockCode, InvoiceDate)
    clean_df = clean_df.drop_duplicates(
        subset=["invoice_no", "stock_code", "invoice_date"],
        keep="first"
    )

    rejected_count = initial_rows - len(clean_df)
    return clean_df, rejected_count
