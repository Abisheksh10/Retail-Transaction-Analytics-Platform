"""End-to-end ETL Orchestration Pipeline for Retail Transaction Analytics."""

import argparse
import sys
import time
from pathlib import Path
import openpyxl
import pandas as pd

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.config import settings
from backend.database.session import engine
from etl.cleaner import clean_retail_data
from etl.loader import (
    bulk_upsert_countries,
    bulk_upsert_customers,
    bulk_upsert_products,
    bulk_insert_fact_sales,
    log_audit,
)

SHEET_MAP = {
    "2009-2010": ["Year 2009-2010"],
    "2010-2011": ["Year 2010-2011"],
    "all": ["Year 2009-2010", "Year 2010-2011"],
}


def read_sheet_to_df(excel_path: Path, sheet_name: str) -> pd.DataFrame:
    """Stream Excel rows using openpyxl in read_only mode to minimize RAM."""
    print(f"[{sheet_name}] Streaming rows from {excel_path.name}...")
    t0 = time.time()
    wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
    try:
        ws = wb[sheet_name]
        rows_iter = ws.iter_rows(values_only=True)
        headers = [str(c).strip() if c is not None else "" for c in next(rows_iter)]
        rows = list(rows_iter)
    finally:
        wb.close()

    df = pd.DataFrame(rows, columns=headers)
    elapsed = time.time() - t0
    print(f"[{sheet_name}] Read {len(df):,} raw rows in {elapsed:.2f}s.")
    return df


def process_sheet(
    excel_path: Path,
    sheet_name: str,
    dry_run: bool = False,
) -> dict:
    """Execute complete ETL sequence for a single workbook sheet."""
    print(f"\n{'='*60}\nStarting ETL for: {sheet_name}\n{'='*60}")
    t_start = time.time()

    # 1. Extraction
    raw_df = read_sheet_to_df(excel_path, sheet_name)
    read_count = len(raw_df)

    # 2. Cleaning & Validation
    print(f"[{sheet_name}] Cleaning, filtering, and validating data...")
    t_clean = time.time()
    cleaned_df, rejected_count = clean_retail_data(raw_df)
    del raw_df  # Free memory immediately
    cleaned_count = len(cleaned_df)
    cleaned_df["sheet_source"] = sheet_name
    print(
        f"[{sheet_name}] Cleaned {cleaned_count:,} valid records "
        f"({rejected_count:,} rejected) in {time.time() - t_clean:.2f}s."
    )

    if dry_run:
        print(f"[{sheet_name}] [DRY-RUN] Skipping database inserts.")
        log_audit(
            engine=engine,
            file_name=excel_path.name,
            sheet_name=sheet_name,
            records_processed=cleaned_count,
            records_rejected=rejected_count,
            status="DRY_RUN",
        )
        return {
            "sheet": sheet_name,
            "read": read_count,
            "cleaned": cleaned_count,
            "rejected": rejected_count,
            "inserted": 0,
            "status": "DRY_RUN",
        }

    # 3. Loading
    print(f"[{sheet_name}] Upserting dimensions...")
    t_load = time.time()

    # Bulk upsert countries & build lookup map
    country_map = bulk_upsert_countries(engine, cleaned_df["country"].tolist())
    cleaned_df["country_id"] = cleaned_df["country"].map(country_map).fillna(1).astype(int)

    # Bulk upsert customers
    bulk_upsert_customers(engine, cleaned_df["customer_id"].tolist())

    # Bulk upsert products
    bulk_upsert_products(engine, cleaned_df[["stock_code", "description", "unit_price"]])

    # Bulk insert fact_sales in chunks of 10,000
    print(f"[{sheet_name}] Bulk inserting {cleaned_count:,} records into fact_sales (chunks of 10,000)...")
    inserted_count = bulk_insert_fact_sales(engine, cleaned_df, chunksize=10000)

    # Audit logging
    log_audit(
        engine=engine,
        file_name=excel_path.name,
        sheet_name=sheet_name,
        records_processed=inserted_count,
        records_rejected=rejected_count,
        status="SUCCESS",
    )

    total_time = time.time() - t_start
    print(f"[{sheet_name}] Completed loading in {time.time() - t_load:.2f}s (Total: {total_time:.2f}s).")

    return {
        "sheet": sheet_name,
        "read": read_count,
        "cleaned": cleaned_count,
        "rejected": rejected_count,
        "inserted": inserted_count,
        "status": "SUCCESS",
    }


def run_pipeline(sheet_arg: str = "all", dry_run: bool = False):
    """Orchestrate ETL across requested sheets."""
    excel_path = Path(settings.DATASET_PATH)
    if not excel_path.is_absolute():
        excel_path = PROJECT_ROOT / excel_path

    if not excel_path.exists():
        raise FileNotFoundError(f"Workbook not found at: {excel_path}")

    sheets_to_process = SHEET_MAP.get(sheet_arg)
    if not sheets_to_process:
        raise ValueError(f"Invalid sheet option '{sheet_arg}'. Allowed: 2009-2010, 2010-2011, all")

    print(f"\n============================================================")
    print(f"RETAIL ANALYTICS ETL PIPELINE INITIALIZED")
    print(f"Source: {excel_path.name}")
    print(f"Selected Sheets: {', '.join(sheets_to_process)}")
    print(f"Mode: {'DRY RUN' if dry_run else 'PRODUCTION LOAD'}")
    print(f"============================================================")

    results = []
    pipeline_t0 = time.time()
    for sheet in sheets_to_process:
        res = process_sheet(excel_path, sheet, dry_run=dry_run)
        results.append(res)

    total_elapsed = time.time() - pipeline_t0

    # Summary Output
    print("\n" + "=" * 65)
    print(" " * 22 + "ETL PIPELINE SUMMARY")
    print("=" * 65)
    print(f"{'Sheet':<16} | {'Read':<10} | {'Cleaned':<10} | {'Rejected':<10} | {'Inserted':<10}")
    print("-" * 65)
    tot_read = tot_clean = tot_rej = tot_ins = 0
    for r in results:
        print(f"{r['sheet']:<16} | {r['read']:<10,d} | {r['cleaned']:<10,d} | {r['rejected']:<10,d} | {r['inserted']:<10,d}")
        tot_read += r["read"]
        tot_clean += r["cleaned"]
        tot_rej += r["rejected"]
        tot_ins += r["inserted"]
    print("-" * 65)
    print(f"{'TOTAL':<16} | {tot_read:<10,d} | {tot_clean:<10,d} | {tot_rej:<10,d} | {tot_ins:<10,d}")
    print(f"Total Pipeline Runtime: {total_elapsed:.2f} seconds\n")


def main():
    parser = argparse.ArgumentParser(description="Retail Transaction ETL Pipeline")
    parser.add_argument(
        "--sheet",
        choices=["2009-2010", "2010-2011", "all"],
        default="all",
        help="Select which sheet to process (default: all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run cleaning and validation without writing to database",
    )
    args = parser.parse_args()
    run_pipeline(sheet_arg=args.sheet, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
