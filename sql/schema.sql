-- Retail Analytics Database DDL Schema
-- Database: retail_analytics_db
-- Compatible with MySQL 8.0+

CREATE DATABASE IF NOT EXISTS retail_analytics_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE retail_analytics_db;

-- 1. Country Dimension
CREATE TABLE IF NOT EXISTS dim_country (
    country_id INT AUTO_INCREMENT PRIMARY KEY,
    country_name VARCHAR(100) UNIQUE NOT NULL
) ENGINE=InnoDB;

-- 2. Customer Dimension
CREATE TABLE IF NOT EXISTS dim_customer (
    customer_id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Product Dimension
CREATE TABLE IF NOT EXISTS dim_product (
    stock_code VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. Sales Fact Table
CREATE TABLE IF NOT EXISTS fact_sales (
    transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_no VARCHAR(50) NOT NULL,
    stock_code VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NULL,
    country_id INT NOT NULL,
    invoice_date DATETIME NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    sheet_source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fact_sales_product FOREIGN KEY (stock_code) REFERENCES dim_product(stock_code),
    CONSTRAINT fk_fact_sales_country FOREIGN KEY (country_id) REFERENCES dim_country(country_id)
) ENGINE=InnoDB;

-- 5. Users Table for Authentication & Authorization
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(120) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'analyst') NOT NULL DEFAULT 'analyst',
    is_approved BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 6. ETL Audit Log Table
CREATE TABLE IF NOT EXISTS etl_audit_log (
    run_id INT AUTO_INCREMENT PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    sheet_name VARCHAR(100) NOT NULL,
    records_processed INT NOT NULL,
    records_rejected INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    run_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;



-- 1. Index on invoice_date for temporal queries and date range slicing
CREATE INDEX idx_fact_sales_invoice_date ON fact_sales(invoice_date);

-- 2. Index on stock_code for product-level aggregations
CREATE INDEX idx_fact_sales_stock_code ON fact_sales(stock_code);

-- 3. Index on customer_id for customer lifetime value and segmentation queries
CREATE INDEX idx_fact_sales_customer_id ON fact_sales(customer_id);

-- 4. Composite index on invoice_date and total_amount for revenue analytics over time
CREATE INDEX idx_fact_sales_date_amount ON fact_sales(invoice_date, total_amount);

