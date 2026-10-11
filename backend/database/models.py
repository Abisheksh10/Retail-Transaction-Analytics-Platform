"""SQLAlchemy ORM models matching retail_analytics_db schema."""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, BigInteger, String, Numeric, DateTime, Boolean, Enum, ForeignKey
)
from sqlalchemy.orm import relationship
from backend.database.session import Base


class DimCountry(Base):
    __tablename__ = "dim_country"

    country_id = Column(Integer, primary_key=True, autoincrement=True)
    country_name = Column(String(100), unique=True, nullable=False)

    sales = relationship("FactSales", back_populates="country")


class DimCustomer(Base):
    __tablename__ = "dim_customer"

    customer_id = Column(String(50), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DimProduct(Base):
    __tablename__ = "dim_product"

    stock_code = Column(String(50), primary_key=True)
    description = Column(String(255), nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    category = Column(String(100), default="General")
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sales = relationship("FactSales", back_populates="product")


class FactSales(Base):
    __tablename__ = "fact_sales"

    transaction_id = Column(BigInteger, primary_key=True, autoincrement=True)
    invoice_no = Column(String(50), nullable=False)
    stock_code = Column(String(50), ForeignKey("dim_product.stock_code"), nullable=False)
    customer_id = Column(String(50), nullable=True)
    country_id = Column(Integer, ForeignKey("dim_country.country_id"), nullable=False)
    invoice_date = Column(DateTime, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    sheet_source = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    country = relationship("DimCountry", back_populates="sales")
    product = relationship("DimProduct", back_populates="sales")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(120), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum("admin", "analyst", name="user_role_enum"), default="analyst", nullable=False)
    is_approved = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ETLAuditLog(Base):
    __tablename__ = "etl_audit_log"

    run_id = Column(Integer, primary_key=True, autoincrement=True)
    file_name = Column(String(255), nullable=False)
    sheet_name = Column(String(100), nullable=False)
    records_processed = Column(Integer, nullable=False)
    records_rejected = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False)
    run_timestamp = Column(DateTime, default=datetime.utcnow)
