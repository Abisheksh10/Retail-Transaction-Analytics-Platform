"""Analytics API endpoints for KPIs, product rankings, regional sales, and trends."""

from datetime import datetime
from typing import Optional, Literal
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.auth.security import get_current_user

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(get_current_user)],
)


class KPISummaryResponse(BaseModel):
    total_revenue: float
    total_units_sold: int
    total_orders: int
    average_order_value: float


class TopProductItem(BaseModel):
    stock_code: str
    description: str
    revenue: float
    units_sold: int


class RegionalSalesItem(BaseModel):
    country_name: str
    revenue: float
    units_sold: int
    total_orders: int


class MonthlyTrendItem(BaseModel):
    month: str
    revenue: float
    units_sold: int
    order_count: int


class DecliningProductItem(BaseModel):
    stock_code: str
    description: str
    y1_units: int
    y2_units: int
    decline_pct: float
    y1_revenue: float
    y2_revenue: float


@router.get("/kpis", response_model=KPISummaryResponse)
def get_kpis(
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db: Session = Depends(get_db),
):
    """Calculate aggregate business KPIs: revenue, units sold, orders, and average order value."""
    filters = []
    params = {}
    if start_date:
        filters.append("invoice_date >= :start_date")
        params["start_date"] = f"{start_date} 00:00:00"
    if end_date:
        filters.append("invoice_date <= :end_date")
        params["end_date"] = f"{end_date} 23:59:59"

    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""

    query = text(f"""
        SELECT 
            COALESCE(ROUND(SUM(total_amount), 2), 0) AS total_revenue,
            COALESCE(SUM(quantity), 0) AS total_units_sold,
            COALESCE(COUNT(DISTINCT invoice_no), 0) AS total_orders
        FROM fact_sales
        {where_clause}
    """)

    result = db.execute(query, params).mappings().one()
    revenue = float(result["total_revenue"] or 0.0)
    units_sold = int(result["total_units_sold"] or 0)
    orders = int(result["total_orders"] or 0)
    aov = round(revenue / orders, 2) if orders > 0 else 0.0

    return KPISummaryResponse(
        total_revenue=revenue,
        total_units_sold=units_sold,
        total_orders=orders,
        average_order_value=aov,
    )


@router.get("/top-products", response_model=list[TopProductItem])
def get_top_products(
    limit: int = Query(10, ge=1, le=100, description="Max products to return (1-100)"),
    sort_by: Literal["revenue", "quantity"] = Query("revenue", description="Sorting criterion ('revenue' or 'quantity')"),
    db: Session = Depends(get_db),
):
    """Retrieve top performing products ranked by revenue or quantity sold."""
    order_col = "revenue" if sort_by == "revenue" else "units_sold"

    query = text(f"""
        SELECT 
            f.stock_code,
            COALESCE(p.description, 'Unknown Product') AS description,
            COALESCE(ROUND(SUM(f.total_amount), 2), 0) AS revenue,
            COALESCE(SUM(f.quantity), 0) AS units_sold
        FROM fact_sales f
        LEFT JOIN dim_product p ON f.stock_code = p.stock_code
        GROUP BY f.stock_code, p.description
        ORDER BY {order_col} DESC
        LIMIT :limit
    """)

    rows = db.execute(query, {"limit": limit}).mappings().all()
    return [
        TopProductItem(
            stock_code=r["stock_code"],
            description=r["description"],
            revenue=float(r["revenue"]),
            units_sold=int(r["units_sold"]),
        )
        for r in rows
    ]


@router.get("/regional-sales", response_model=list[RegionalSalesItem])
def get_regional_sales(
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    limit: int = Query(5, ge=1, le=5, description="Strict Top 5 restriction"),
    exclude_uk: bool = Query(False, description="Filter out United Kingdom to inspect international markets"),
    db: Session = Depends(get_db),
):
    """Aggregate sales metrics grouped by geographic country, ordered by revenue descending, strictly top 5."""
    where_conditions = ["1=1"]
    params = {"limit": min(limit, 5)}

    if start_date:
        where_conditions.append("f.invoice_date >= :start_date")
        params["start_date"] = f"{start_date} 00:00:00" if len(start_date) == 10 else start_date
    if end_date:
        where_conditions.append("f.invoice_date <= :end_date")
        params["end_date"] = f"{end_date} 23:59:59" if len(end_date) == 10 else end_date
    if exclude_uk:
        where_conditions.append("c.country_name != 'United Kingdom'")

    where_clause = " AND ".join(where_conditions)

    query = text(f"""
        SELECT 
            c.country_name,
            COALESCE(ROUND(SUM(f.total_amount), 2), 0) AS revenue,
            COALESCE(SUM(f.quantity), 0) AS units_sold,
            COALESCE(COUNT(DISTINCT f.invoice_no), 0) AS total_orders
        FROM fact_sales f
        JOIN dim_country c ON f.country_id = c.country_id
        WHERE {where_clause}
        GROUP BY c.country_name
        ORDER BY revenue DESC
        LIMIT :limit
    """)

    rows = db.execute(query, params).mappings().all()
    return [
        RegionalSalesItem(
            country_name=r["country_name"],
            revenue=float(r["revenue"]),
            units_sold=int(r["units_sold"]),
            total_orders=int(r["total_orders"]),
        )
        for r in rows
    ]


@router.get("/monthly-trends", response_model=list[MonthlyTrendItem])
def get_monthly_trends(
    db: Session = Depends(get_db),
):
    """Retrieve longitudinal sales performance grouped by month (YYYY-MM)."""
    query = text("""
        SELECT 
            DATE_FORMAT(invoice_date, '%Y-%m') AS month,
            COALESCE(ROUND(SUM(total_amount), 2), 0) AS revenue,
            COALESCE(SUM(quantity), 0) AS units_sold,
            COALESCE(COUNT(DISTINCT invoice_no), 0) AS order_count
        FROM fact_sales
        GROUP BY DATE_FORMAT(invoice_date, '%Y-%m')
        ORDER BY month ASC
    """)

    rows = db.execute(query).mappings().all()
    return [
        MonthlyTrendItem(
            month=r["month"],
            revenue=float(r["revenue"]),
            units_sold=int(r["units_sold"]),
            order_count=int(r["order_count"]),
        )
        for r in rows
    ]


@router.get("/declining-products", response_model=list[DecliningProductItem])
def get_declining_products(
    db: Session = Depends(get_db),
):
    """Identify products whose sales declined by >40% from Year 1 to Year 2 (min 50 units in Year 1)."""
    query = text("""
        SELECT 
            f.stock_code,
            COALESCE(p.description, 'Unknown Product') AS description,
            COALESCE(SUM(CASE WHEN f.sheet_source = 'Year 2009-2010' THEN f.quantity ELSE 0 END), 0) AS y1_units,
            COALESCE(SUM(CASE WHEN f.sheet_source = 'Year 2010-2011' THEN f.quantity ELSE 0 END), 0) AS y2_units,
            ROUND(((SUM(CASE WHEN f.sheet_source = 'Year 2009-2010' THEN f.quantity ELSE 0 END) - 
                    SUM(CASE WHEN f.sheet_source = 'Year 2010-2011' THEN f.quantity ELSE 0 END)) / 
                    SUM(CASE WHEN f.sheet_source = 'Year 2009-2010' THEN f.quantity ELSE 0 END)) * 100, 2) AS decline_pct,
            COALESCE(ROUND(SUM(CASE WHEN f.sheet_source = 'Year 2009-2010' THEN f.total_amount ELSE 0 END), 2), 0) AS y1_revenue,
            COALESCE(ROUND(SUM(CASE WHEN f.sheet_source = 'Year 2010-2011' THEN f.total_amount ELSE 0 END), 2), 0) AS y2_revenue
        FROM fact_sales f
        LEFT JOIN dim_product p ON f.stock_code = p.stock_code
        GROUP BY f.stock_code, p.description
        HAVING y1_units >= 50 AND decline_pct > 40
        ORDER BY decline_pct DESC
    """)

    rows = db.execute(query).mappings().all()
    return [
        DecliningProductItem(
            stock_code=r["stock_code"],
            description=r["description"],
            y1_units=int(r["y1_units"]),
            y2_units=int(r["y2_units"]),
            decline_pct=float(r["decline_pct"]),
            y1_revenue=float(r["y1_revenue"]),
            y2_revenue=float(r["y2_revenue"]),
        )
        for r in rows
    ]


class ETLLogItem(BaseModel):
    run_id: int
    file_name: str
    sheet_name: str
    records_processed: int
    records_rejected: int
    status: str
    run_timestamp: Optional[datetime] = None


@router.get("/etl-logs", response_model=list[ETLLogItem])
def get_etl_logs(
    db: Session = Depends(get_db),
):
    """Retrieve all execution records from etl_audit_log ordered by run_timestamp DESC."""
    query = text("""
        SELECT run_id, file_name, sheet_name, records_processed, records_rejected, status, run_timestamp
        FROM etl_audit_log
        ORDER BY run_timestamp DESC, run_id DESC
    """)
    rows = db.execute(query).mappings().all()
    return [
        ETLLogItem(
            run_id=r["run_id"],
            file_name=r["file_name"],
            sheet_name=r["sheet_name"],
            records_processed=int(r["records_processed"]),
            records_rejected=int(r["records_rejected"]),
            status=r["status"],
            run_timestamp=r["run_timestamp"],
        )
        for r in rows
    ]
