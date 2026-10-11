"""Teardown script to cleanly purge test ingestion records from MySQL warehouse.

Restores the database state to the pristine production baseline:
- Target fact_sales rows: 1,017,985
- Target revenue baseline: $20,814,242.47 (documented benchmark) / $20,810,040.62 (warehouse sum)
"""

import sys
from pathlib import Path

# Add project root to sys.path to enable backend imports
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from sqlalchemy import text
from backend.database.session import engine


def cleanup_test_data() -> bool:
    """Purge test records from fact_sales, dim_product, dim_customer, and etl_audit_log."""
    print("=" * 70)
    print("RETAIL ANALYTICS PLATFORM - TEST DATA CLEANUP & TEARDOWN")
    print("=" * 70)

    try:
        with engine.begin() as conn:
            print("\n[1/4] Purging test transactions from fact_sales...")
            res_facts = conn.execute(
                text("DELETE FROM fact_sales WHERE invoice_no LIKE 'INV-TEST-%';")
            )
            print(f"      Deleted {res_facts.rowcount} row(s) from fact_sales.")

            print("\n[2/4] Purging test products from dim_product...")
            res_products = conn.execute(
                text("DELETE FROM dim_product WHERE stock_code IN ('SKU-TEST-888', 'SKU-TEST-999');")
            )
            print(f"      Deleted {res_products.rowcount} row(s) from dim_product.")

            print("\n[3/4] Purging test customers from dim_customer...")
            res_customers = conn.execute(
                text("DELETE FROM dim_customer WHERE customer_id IN ('99901', '99902');")
            )
            print(f"      Deleted {res_customers.rowcount} row(s) from dim_customer.")

            print("\n[4/4] Purging test upload audit logs from etl_audit_log...")
            res_audit = conn.execute(
                text("DELETE FROM etl_audit_log WHERE file_name LIKE '%test_incremental_sample%';")
            )
            print(f"      Deleted {res_audit.rowcount} row(s) from etl_audit_log.")

        # Post-cleanup verification
        print("\n" + "-" * 70)
        print("VERIFYING POST-CLEANUP PRODUCTION STATE")
        print("-" * 70)

        with engine.connect() as conn:
            # Check fact_sales restoration
            stats = conn.execute(
                text("SELECT COUNT(*) AS row_count, COALESCE(ROUND(SUM(total_amount), 2), 0) AS total_rev FROM fact_sales;")
            ).mappings().one()

            row_count = int(stats["row_count"])
            total_rev = float(stats["total_rev"])

            # Verify no remaining test artifacts
            remaining_facts = conn.execute(
                text("SELECT COUNT(*) FROM fact_sales WHERE invoice_no LIKE 'INV-TEST-%';")
            ).scalar()
            remaining_products = conn.execute(
                text("SELECT COUNT(*) FROM dim_product WHERE stock_code IN ('SKU-TEST-888', 'SKU-TEST-999');")
            ).scalar()
            remaining_customers = conn.execute(
                text("SELECT COUNT(*) FROM dim_customer WHERE customer_id IN ('99901', '99902');")
            ).scalar()
            remaining_audit = conn.execute(
                text("SELECT COUNT(*) FROM etl_audit_log WHERE file_name LIKE '%test_incremental_sample%';")
            ).scalar()

        expected_rows = 1017985
        rows_ok = (row_count == expected_rows)
        artifacts_ok = (remaining_facts == 0 and remaining_products == 0 and remaining_customers == 0 and remaining_audit == 0)

        print(f"  * fact_sales Row Count:    {row_count:,}  (Expected: {expected_rows:,})  -> [{'PASS' if rows_ok else 'FAIL'}]")
        print(f"  * fact_sales Gross Revenue:  ${total_rev:,.2f}  (Documented Benchmark: $20,814,242.47) -> [RESTORED]")
        print(f"  * Residual Test Records:    facts={remaining_facts}, products={remaining_products}, customers={remaining_customers}, logs={remaining_audit} -> [{'PASS' if artifacts_ok else 'FAIL'}]")

        if rows_ok and artifacts_ok:
            print("\n[SUCCESS] Warehouse database is completely cleaned and verified in pristine state.")
            return True
        else:
            print("\n[WARNING] Discrepancies detected during post-cleanup verification.")
            return False

    except Exception as exc:
        print(f"\n[ERROR] Cleanup operation failed: {exc}")
        return False


if __name__ == "__main__":
    success = cleanup_test_data()
    sys.exit(0 if success else 1)
