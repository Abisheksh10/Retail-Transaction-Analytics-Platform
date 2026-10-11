"""Product Master CRUD endpoints with pagination, search, and RBAC authorization."""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import DimProduct
from backend.auth.security import get_current_user, require_admin

router = APIRouter(
    prefix="/products",
    tags=["products"],
    dependencies=[Depends(get_current_user)],
)


class ProductResponse(BaseModel):
    stock_code: str
    description: str
    unit_price: float
    category: str
    is_active: bool
    updated_at: Optional[datetime] = None


class PaginatedProductResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[ProductResponse]


class ProductCreateRequest(BaseModel):
    stock_code: str = Field(..., min_length=1, max_length=50, description="Unique stock identifier")
    description: str = Field(..., min_length=1, max_length=255, description="Product catalog description")
    unit_price: float = Field(..., gt=0, description="Unit price (must be greater than 0)")
    category: str = Field("General", max_length=100, description="Merchandise category")


class ProductUpdateRequest(BaseModel):
    description: Optional[str] = Field(None, min_length=1, max_length=255)
    unit_price: Optional[float] = Field(None, gt=0)
    category: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


@router.get("", response_model=PaginatedProductResponse)
def list_products(
    search: Optional[str] = Query(None, description="Search keyword matching stock code or description"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Number of items per page (max 100)"),
    db: Session = Depends(get_db),
):
    """Retrieve paginated product catalog with keyword search."""
    query = db.query(DimProduct)

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                DimProduct.stock_code.ilike(search_pattern),
                DimProduct.description.ilike(search_pattern),
            )
        )

    total_records = query.count()
    records = (
        query.order_by(DimProduct.stock_code)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedProductResponse(
        total=total_records,
        page=page,
        page_size=page_size,
        items=[
            ProductResponse(
                stock_code=p.stock_code,
                description=p.description,
                unit_price=float(p.unit_price),
                category=p.category,
                is_active=bool(p.is_active),
                updated_at=p.updated_at,
            )
            for p in records
        ],
    )


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    req: ProductCreateRequest,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Create a new product catalog item (Administrator only)."""
    clean_code = req.stock_code.strip()
    existing = db.query(DimProduct).filter(DimProduct.stock_code == clean_code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with stock code '{clean_code}' already exists",
        )

    new_prod = DimProduct(
        stock_code=clean_code,
        description=req.description.strip(),
        unit_price=round(req.unit_price, 2),
        category=req.category.strip(),
        is_active=True,
    )
    db.add(new_prod)
    db.commit()
    db.refresh(new_prod)

    return ProductResponse(
        stock_code=new_prod.stock_code,
        description=new_prod.description,
        unit_price=float(new_prod.unit_price),
        category=new_prod.category,
        is_active=bool(new_prod.is_active),
        updated_at=new_prod.updated_at,
    )


@router.put("/{stock_code}", response_model=ProductResponse)
def update_product(
    stock_code: str,
    req: ProductUpdateRequest,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Update details for an existing product (Administrator only)."""
    product = db.query(DimProduct).filter(DimProduct.stock_code == stock_code.strip()).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with stock code '{stock_code}' not found",
        )

    if req.description is not None:
        product.description = req.description.strip()
    if req.unit_price is not None:
        product.unit_price = round(req.unit_price, 2)
    if req.category is not None:
        product.category = req.category.strip()
    if req.is_active is not None:
        product.is_active = req.is_active

    db.commit()
    db.refresh(product)

    return ProductResponse(
        stock_code=product.stock_code,
        description=product.description,
        unit_price=float(product.unit_price),
        category=product.category,
        is_active=bool(product.is_active),
        updated_at=product.updated_at,
    )


@router.delete("/{stock_code}")
def delete_product(
    stock_code: str,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Soft delete a product by toggling is_active to FALSE (Administrator only)."""
    product = db.query(DimProduct).filter(DimProduct.stock_code == stock_code.strip()).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with stock code '{stock_code}' not found",
        )

    product.is_active = False
    db.commit()
    db.refresh(product)

    return {
        "message": f"Product '{stock_code}' has been soft-deleted.",
        "stock_code": product.stock_code,
        "is_active": False,
    }
