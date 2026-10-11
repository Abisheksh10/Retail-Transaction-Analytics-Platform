"""ETL incremental data ingestion endpoints for uploaded datasets."""

import io
import logging
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database.session import get_db, engine
from backend.auth.security import require_admin
from etl.cleaner import clean_retail_data
from etl.loader import (
    bulk_upsert_countries,
    bulk_upsert_customers,
    bulk_upsert_products,
    bulk_insert_fact_sales,
    log_audit,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/etl",
    tags=["etl"],
    dependencies=[Depends(require_admin)],
)


class IncrementalUploadSummary(BaseModel):
    status: str
    file_name: str
    records_read: int
    records_cleaned: int
    duplicate_invoices_skipped: int
    records_inserted: int
    records_rejected: int


@router.post("/upload-incremental", response_model=IncrementalUploadSummary)
async def upload_incremental_etl(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Process incremental transaction batches from CSV or Excel files with duplicate prevention."""
    filename = file.filename or "unknown_file"
    lower_name = filename.lower()
    if not (lower_name.endswith(".csv") or lower_name.endswith(".xlsx") or lower_name.endswith(".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload a .csv or .xlsx file.",
        )

    try:
        content = await file.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file contains no data (empty file).",
            )
        if lower_name.endswith(".csv"):
            raw_df = pd.read_csv(io.BytesIO(content))
        else:
            raw_df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse uploaded file: {str(e)}",
        )

    records_read = len(raw_df)
    if records_read == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file contains no data rows.",
        )

    try:
        # 1. Clean and validate dataset
        cleaned_df, rejected_count = clean_retail_data(raw_df)
        records_cleaned = len(cleaned_df)

        if records_cleaned == 0:
            log_audit(
                engine=engine,
                file_name=filename,
                sheet_name="Incremental Upload",
                records_processed=0,
                records_rejected=rejected_count,
                status="ALL_REJECTED",
            )
            return IncrementalUploadSummary(
                status="ALL_REJECTED",
                file_name=filename,
                records_read=records_read,
                records_cleaned=0,
                duplicate_invoices_skipped=0,
                records_inserted=0,
                records_rejected=rejected_count,
            )

        # 2. Check for duplicate invoices already present in fact_sales
        incoming_invoices = list(cleaned_df["invoice_no"].unique())
        existing_invoices = set()

        # Query existing invoices in chunks to respect query bounds
        chunk_size = 1000
        for i in range(0, len(incoming_invoices), chunk_size):
            chunk = incoming_invoices[i : i + chunk_size]
            q = text("SELECT DISTINCT invoice_no FROM fact_sales WHERE invoice_no IN :chunk")
            found = db.execute(q, {"chunk": tuple(chunk)}).scalars().all()
            existing_invoices.update(found)

        duplicates_mask = cleaned_df["invoice_no"].isin(existing_invoices)
        duplicate_count = int(duplicates_mask.sum())
        rejected_count += duplicate_count

        new_records_df = cleaned_df[~duplicates_mask].copy()

        # 3. Load dimensions and fact records
        records_inserted = 0
        if not new_records_df.empty:
            new_records_df["sheet_source"] = f"Upload: {filename[:40]}"

            # Upsert dimensions
            country_map = bulk_upsert_countries(engine, new_records_df["country"].tolist())
            new_records_df["country_id"] = new_records_df["country"].map(country_map).fillna(1).astype(int)

            bulk_upsert_customers(engine, new_records_df["customer_id"].tolist())
            bulk_upsert_products(engine, new_records_df[["stock_code", "description", "unit_price"]])

            # Insert facts
            records_inserted = bulk_insert_fact_sales(engine, new_records_df, chunksize=10000)

        # 4. Audit Log Entry
        status_str = "SUCCESS" if records_inserted > 0 else "SKIPPED_DUPLICATES"
        log_audit(
            engine=engine,
            file_name=filename,
            sheet_name="Incremental Upload",
            records_processed=records_inserted,
            records_rejected=rejected_count,
            status=status_str,
        )

        return IncrementalUploadSummary(
            status=status_str,
            file_name=filename,
            records_read=records_read,
            records_cleaned=records_cleaned,
            duplicate_invoices_skipped=duplicate_count,
            records_inserted=records_inserted,
            records_rejected=rejected_count,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Unhandled error processing incremental ETL for {filename}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Incremental ETL processing failed: {str(exc)}",
        )
