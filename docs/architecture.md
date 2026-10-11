# Retail Transaction Analytics Platform - Architecture

## 1. System Overview

The Retail Transaction Analytics Platform processes, stores, and serves high-volume retail transactional records (1,067,371 rows from Online Retail II) using modern Python and Web technologies.

```mermaid
flowchart TD
    Dataset["Excel Dataset (online_retail_II.xlsx)<br/>1,067,371 records"] --> ETL["ETL Pipeline (etl/extract, transform, load)"]
    ETL --> DB[(MySQL 8.1 Database<br/>retail_analytics_db)]
    DB --> Backend["FastAPI Backend (backend/)<br/>SQLAlchemy + PyMySQL"]
    Backend --> Auth["Authentication & JWT<br/>(backend/auth/)"]
    Backend --> API["REST API Routes<br/>(/api/analytics, /api/transactions)"]
    API --> Frontend["Frontend Dashboard (frontend/)<br/>React / Vite / Chart.js"]
    API --> Reports["Automated Reports<br/>(reports/generated)"]
```

## 2. Directory Structure

* **`backend/`**: FastAPI web application, API routers, database models, and authentication services.
* **`etl/`**: Data ingestion, schema cleaning, transformation, and batch loading utilities.
* **`sql/`**: Schema DDL scripts, table definitions, and analytical query indexing scripts.
* **`frontend/`**: Single-page application dashboard for visualizations and filtering.
* **`tests/`**: Automated unit and integration test suites using pytest.
* **`docs/`**: Technical and setup documentation.
