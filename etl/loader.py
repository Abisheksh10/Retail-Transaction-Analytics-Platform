"""Database bulk loader module for dimensions, fact_sales, and audit logging."""

import logging
from typing import Optional
import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def bulk_upsert_countries(engine: Engine, countries: list[str]) -> dict[str, int]:
    """Bulk upsert unique countries into dim_country (INSERT IGNORE) and return mapping."""
    unique_countries = [c.strip() for c in set(countries) if c and str(c).strip()]
    if not unique_countries:
        return {}

    with engine.begin() as conn:
        insert_sql = text("INSERT IGNORE INTO dim_country (country_name) VALUES (:country_name)")
        conn.execute(insert_sql, [{"country_name": c} for c in unique_countries])

        result = conn.execute(text("SELECT country_name, country_id FROM dim_country"))
        country_map = {row[0]: row[1] for row in result.fetchall()}

    return country_map


def bulk_upsert_customers(engine: Engine, customer_ids: list[str]) -> int:
    """Bulk upsert unique customers into dim_customer (INSERT IGNORE)."""
    unique_customers = [c.strip() for c in set(customer_ids) if c and str(c).strip()]
    if not unique_customers:
        return 0

    batch_size = 10000
    with engine.begin() as conn:
        insert_sql = text("INSERT IGNORE INTO dim_customer (customer_id) VALUES (:customer_id)")
        for i in range(0, len(unique_customers), batch_size):
            batch = [{"customer_id": cid} for cid in unique_customers[i : i + batch_size]]
            conn.execute(insert_sql, batch)

    return len(unique_customers)


def bulk_upsert_products(engine: Engine, products_df: pd.DataFrame) -> int:
    """Bulk upsert unique products into dim_product using ON DUPLICATE KEY UPDATE."""
    prod_unique = products_df.drop_duplicates(subset=["stock_code"], keep="last")[
        ["stock_code", "description", "unit_price"]
    ].dropna(subset=["stock_code"])

    if prod_unique.empty:
        return 0

    records = prod_unique.to_dict(orient="records")
    insert_sql = text("""
        INSERT INTO dim_product (stock_code, description, unit_price, category, is_active)
        VALUES (:stock_code, :description, :unit_price, 'General', 1)
        ON DUPLICATE KEY UPDATE
            description = VALUES(description),
            unit_price = VALUES(unit_price)
    """)

    batch_size = 5000
    with engine.begin() as conn:
        for i in range(0, len(records), batch_size):
            batch = records[i : i + batch_size]
            conn.execute(insert_sql, batch)

    return len(records)


def bulk_insert_fact_sales(
    engine: Engine,
    fact_df: pd.DataFrame,
    chunksize: int = 10000,
) -> int:
    """Bulk insert records into fact_sales in chunks of 10,000 using SQLAlchemy multi-insert."""
    cols = [
        "invoice_no", "stock_code", "customer_id", "country_id",
        "invoice_date", "quantity", "unit_price", "total_amount", "sheet_source"
    ]
    df_to_load = fact_df[cols]
    df_to_load.to_sql(
        name="fact_sales",
        con=engine,
        if_exists="append",
        index=False,
        chunksize=chunksize,
        method="multi",
    )
    return len(df_to_load)


def log_audit(
    engine: Engine,
    file_name: str,
    sheet_name: str,
    records_processed: int,
    records_rejected: int,
    status: str,
) -> int:
    """Insert an execution record into etl_audit_log."""
    insert_sql = text("""
        INSERT INTO etl_audit_log (file_name, sheet_name, records_processed, records_rejected, status)
        VALUES (:file_name, :sheet_name, :records_processed, :records_rejected, :status)
    """)
    with engine.begin() as conn:
        result = conn.execute(
            insert_sql,
            {
                "file_name": file_name,
                "sheet_name": sheet_name,
                "records_processed": records_processed,
                "records_rejected": records_rejected,
                "status": status,
            },
        )
        return result.lastrowid
