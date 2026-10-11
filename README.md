# Retail Transaction Analytics Platform

An enterprise-grade, full-stack analytical data platform for retail transaction analytics, built with **Python 3.13**, **FastAPI**, **SQLAlchemy 2.0**, **MySQL 8.1**, and **React (Vite + Tailwind CSS + Recharts)**.

---

## 1. Project Overview & System Highlights

The **Retail Transaction Analytics Platform** ingests, cleans, models, and visualizes retail transactions from the *Online Retail II* dataset (spanning over 1.06 million raw records across dual sheets: `Year 2009-2010` and `Year 2010-2011`). It provides business stakeholders with executive-level financial KPIs, longitudinal sales trends, churn risk detection, product catalog management, role-based user lifecycle governance, and an auditable incremental ETL pipeline.
- **Official UCI Dataset Link:** Save it inside the project root [UCI Machine Learning Repository: Online Retail II](https://archive.ics.uci.edu/dataset/502/online+retail+ii)

![Architecture Diagram](docs/architecture%20diagram.png)

### Key Architectural Highlights

- **Streamed Low-Memory ETL Pipeline**: Built with Python 3.13 and `openpyxl` streaming iterators (`read_only=True`). Performs data validation, filters transaction cancellations (`'C'` prefixes), sanitizes non-positive prices and quantities, normalizes timestamps, maps unassigned shoppers to `'GUEST'`, and streams curated data into MySQL in chunked 10,000-row batches.
- **MySQL 8.1 Star Schema Data Warehouse**: Relational star schema comprising `fact_sales` and conformed dimensions (`dim_product`, `dim_customer`, `dim_country`), indexed with B-Tree and composite indexes for sub-second aggregations across millions of rows.
- **FastAPI Microservice Gateway**: High-performance RESTful API using SQLAlchemy 2.0 ORM, Pydantic validation, and modern `pwdlib[bcrypt]` hashing (PEP 594 compliant for Python 3.13). Guarded by PyJWT Bearer token authentication and fine-grained Role-Based Access Control (`admin` vs `analyst`).
- **Complete User Lifecycle Governance**: Analyst self-registration enters a pending queue; administrators can **Approve**, **Decline**, **Deactivate**, and **Reactivate** accounts. Features built-in protection against administrator self-deactivation.
- **Modern Responsive React Dashboard**: Built with pure JavaScript/JSX, Vite, Tailwind CSS, and Recharts. Features a Dark Slate fixed-viewport shell, mobile slide-over navigation drawer, interactive metric charts, CSV data exports, server-side paginated catalog management, and a live incremental ETL file uploader.

### Verified Dataset Metrics (Production Benchmark)

After full extraction and cleaning across both workbook sheets, the warehouse holds the following verified metrics:

| Metric | Verified Value | Description |
|---|---|---|
| **Curated Fact Rows** | **1,017,985** | Clean transaction line items stored in `fact_sales` |
| **Total Gross Revenue** | **$20,814,242.47** | Aggregated `SUM(total_amount)` across all transactions |
| **Total Units Sold** | **11,335,907** | Total volume of items sold (`SUM(quantity)`) |
| **Distinct Invoices** | **40,077** | Unique orders (`COUNT(DISTINCT invoice_no)`) |
| **Average Order Value (AOV)** | **$519.25** | Total Revenue divided by Distinct Orders |
| **Active Catalog SKUs** | **4,745** | Unique merchandise items stored in `dim_product` |
| **Registered Customers** | **5,880** | Distinct customer accounts stored in `dim_customer` |
| **Top 5 Geographic Markets** | **UK, EIRE, Netherlands, Germany, France** | Highest revenue-generating countries |

---

## 2. Repository Clone & Prerequisites

### System Requirements

- **Python**: Version **3.13+** (or 3.11+)
- **Node.js**: Version **18.x** or **20.x+** with **npm**
- **Database**: **MySQL 8.0+** or **8.1+** running locally or via Docker
- **Operating System**: Windows 10/11, macOS, or Linux

### Clone the Repository

```bash
git clone https://github.com/Abisheksh10/Retail-Transaction-Analytics-Platform.git
cd Retail Transaction Analytics Platform
```

### Backend Virtual Environment Setup

```powershell
# Windows PowerShell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

```bash
# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Frontend Dependencies Setup

```bash
cd frontend
npm install
cd ..
```

### Environment Configuration

Copy `.env.example` to create your active `.env` file in the project root:

```powershell
# Windows PowerShell
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Open `.env` and verify your MySQL database credentials:

```dotenv
# Application Environment
ENVIRONMENT=development
APP_NAME="Retail Transaction Analytics Platform"
DEBUG=True

# API Server Configuration
API_HOST=127.0.0.1
API_PORT=8000

# Database Configuration (MySQL)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=retail_analytics_db
DB_USER=root
DB_PASSWORD=your_mysql_password

# Authentication & Security
JWT_SECRET_KEY=replace_with_a_secure_random_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Default Seed Administrator Credentials
ADMIN_EMAIL=admin@retail.com
ADMIN_DEFAULT_PASSWORD=Admin@123

```

---

## 3. Database Setup & Star Schema

### Step 1: Create the Database

Log in to your MySQL terminal or workbench and execute:

```sql
CREATE DATABASE IF NOT EXISTS retail_analytics_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### Step 2: Initialize Schema & Seed Default Admin

Run the idempotent database initialization script. This creates all tables, indexes, constraints, and seeds the default administrator account:

```powershell
# Windows PowerShell
.\.venv\Scripts\python.exe -m backend.database.init_db

# macOS / Linux
python -m backend.database.init_db
```

### Star Schema Architecture

The warehouse is structured according to dimensional modeling best practices:

```text
                     +-------------------+
                     |    dim_country    |
                     +-------------------+
                     | country_id (PK)   |<--------+
                     | country_name (UQ) |         |
                     +-------------------+         |
                                                   |
+-------------------+        +---------------------+----+        +-------------------+
|    dim_product    |        |        fact_sales        |        |   dim_customer    |
+-------------------+        +--------------------------+        +-------------------+
| stock_code (PK)   |<-------| transaction_id (PK)      |------->| customer_id (PK)  |
| description       |        | invoice_no               |        | created_at        |
| unit_price        |        | stock_code (FK)          |        +-------------------+
| category          |        | customer_id (FK)         |
| is_active         |        | country_id (FK)          |
| updated_at        |        | quantity                 |
+-------------------+        | invoice_date             |
                             | unit_price               |
                             | total_amount             |
                             | sheet_source             |
                             +--------------------------+
```

#### Table Directory & Field Specifications

| Table | Type | Primary Key | Key Attributes / Indexes |
|---|---|---|---|
| `fact_sales` | Fact | `transaction_id` | `invoice_no`, `stock_code` (FK), `customer_id` (FK), `country_id` (FK), `quantity`, `invoice_date`, `unit_price`, `total_amount`, `sheet_source`. Indexed on `invoice_date`, `customer_id`, `stock_code`, and composite `(invoice_date, total_amount)`. |
| `dim_product` | Dimension | `stock_code` | `description`, `unit_price`, `category`, `is_active` (soft delete flag), `updated_at`. |
| `dim_customer` | Dimension | `customer_id` | Accommodates identified customers as well as unassigned shoppers (`'GUEST'`), `created_at`. |
| `dim_country` | Dimension | `country_id` | `country_name` (Unique, 43 countries populated). |
| `users` | System | `id` | `email` (Unique), `hashed_password` (Bcrypt), `role` (`admin` \| `analyst`), `is_approved`, `is_active`, `created_at`. |
| `etl_audit_log` | Telemetry | `run_id` | `file_name`, `sheet_name`, `records_processed`, `records_rejected`, `status`, `run_timestamp`. |

---

## 4. ETL Ingestion Runbook

### Primary Dataset Ingestion

1. Verify that `online_retail_II.xlsx` is present in the project root directory.
2. Execute the ingestion pipeline to parse, clean, transform, and load both sheets (`Year 2009-2010` and `Year 2010-2011`):

```powershell
# Windows PowerShell
.\.venv\Scripts\python.exe -m etl.pipeline --sheet all

# macOS / Linux
python -m etl.pipeline --sheet all
```

*Optional sheet-specific flags:*
```bash
# Ingest only the 2009-2010 sheet
python -m etl.pipeline --sheet "Year 2009-2010"

# Ingest only the 2010-2011 sheet
python -m etl.pipeline --sheet "Year 2010-2011"
```

### Data Cleansing & Transformation Rules

The ETL engine enforces strict data hygiene during ingestion:

1. **Cancellation Removal**: Records where `Invoice` begins with `'C'` are removed.
2. **Numeric Validation**: Only rows with `Quantity > 0` and `Price > 0` are ingested. Corrupt or zero-value entries are discarded.
3. **Timestamp Standardization**: `InvoiceDate` strings and datetimes are parsed into standard ISO timestamps. Unparseable dates are rejected.
4. **Guest Customer Handling**: Rows with missing `Customer ID` are imputed to `'GUEST'` rather than dropped, preserving revenue while distinguishing known customer behavior.
5. **Derived Metrics**: Line total is calculated as `total_amount = round(Quantity * Price, 2)`.
6. **Intra-batch Deduplication**: Duplicates matching on `(InvoiceNo, StockCode, InvoiceDate)` are purged.
7. **Chunked Database Insertion**: Dimensions are cached in memory for rapid lookup; transaction records are inserted in batches of 10,000 using PyMySQL bulk insert.
8. **Audit Trail**: Every pipeline run records execution timestamp, row counts, and error telemetry in `etl_audit_log`.

### Incremental File Upload

Subsequent transaction files (`.csv` or `.xlsx`) can be uploaded at runtime via the web dashboard ("ETL Pipeline" view) or through the REST endpoint:
- **Endpoint**: `POST /api/etl/upload-incremental`
- **Security**: Guarded by `require_admin` authorization.
- **Deduplication**: Rejects duplicate invoices that already exist in `fact_sales` to prevent double-counting.

---

## 5. Step-by-Step Local Run Instructions

To run the platform locally, open two terminal windows:

### Terminal 1: Backend API Gateway (FastAPI)

```powershell
# Windows PowerShell
.\.venv\Scripts\uvicorn.exe backend.main:app --host 127.0.0.1 --port 8000 --reload

# macOS / Linux
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

- **Backend API Base**: `http://127.0.0.1:8000`
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`
- **Alternative ReDoc Docs**: `http://127.0.0.1:8000/redoc`

### Terminal 2: Frontend Client (React + Vite)

```bash
cd frontend
npm run dev
```

- **Web Dashboard**: `http://localhost:5173`

---

## 6. Sample Usage & API Verification

The API exposes an interactive OpenAPI Swagger UI at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). Below are sample `curl` requests with verified JSON responses:

### 1. Authenticate & Retrieve JWT Token

```bash
curl -X POST "http://127.0.0.1:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@retail.com", "password": "Admin@123"}'
```

**Response Payload:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "admin@retail.com",
    "role": "admin",
    "is_approved": true,
    "is_active": true
  }
}
```

### 2. Fetch Executive KPIs

```bash
curl -X GET "http://127.0.0.1:8000/api/analytics/kpis" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

**Response Payload (Verified Figures):**
```json
{
  "total_revenue": 20814242.47,
  "total_units": 11335907,
  "total_orders": 40077,
  "average_order_value": 519.25
}
```

### 3. Fetch Top 5 Regional Markets

```bash
curl -X GET "http://127.0.0.1:8000/api/analytics/regional-sales?limit=5" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

**Response Payload:**
```json
[
  { "country": "United Kingdom", "total_sales": 17804961.35, "percentage": 85.54 },
  { "country": "EIRE", "total_sales": 664438.48, "percentage": 3.19 },
  { "country": "Netherlands", "total_sales": 554272.33, "percentage": 2.66 },
  { "country": "Germany", "total_sales": 431262.51, "percentage": 2.07 },
  { "country": "France", "total_sales": 348459.55, "percentage": 1.67 }
]
```

### 4. Fetch Paginated Product Catalog

```bash
curl -X GET "http://127.0.0.1:8000/api/products?page=1&limit=5" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

**Response Payload:**
```json
{
  "items": [
    {
      "stock_code": "10002",
      "description": "INFLATABLE POLITICAL GLOBE",
      "unit_price": 0.85,
      "category": "General",
      "is_active": true,
      "updated_at": "2026-10-10T12:00:00"
    }
  ],
  "total": 4745,
  "page": 1,
  "limit": 5,
  "pages": 949
}
```

---

## 7. Default Evaluation Credentials & Demo Walkthrough

### Credentials Directory

| Role | Email | Password | Permissions & Initial State |
|---|---|---|---|
| **Administrator** | `admin@retail.com` | `Admin@123` | **Full Access**: Analytics, Catalog CRUD, User Management, Incremental ETL Upload |
| **New Analyst** | *(Self-registered via UI)* | *(User-chosen)* | **Restricted**: Starts in pending approval queue; cannot log in until approved by admin |

---

### Step-by-Step Evaluator Demo Walkthrough

#### Step 1: Admin Login & Executive Overview
1. Navigate to `http://localhost:5173`.
2. Sign in using `admin@retail.com` and `Admin@123`.
3. The **Overview** dashboard renders 4 core KPI summary cards ($20.81M Revenue, 11.3M Units, 40,077 Orders, $519.25 AOV) alongside the longitudinal **Monthly Revenue Trends** area chart.

#### Step 2: Deep-Dive Regional & Churn Analytics
1. Click **Analytics** in the dark sidebar.
2. View the **Top 5 Geographic Markets** horizontal bar chart (United Kingdom, EIRE, Netherlands, Germany, France).
3. Test timeline preset filters (**All Time**, **1 Year**, **90 Days**, **30 Days**) to watch real-time chart updates.
4. Click **Export CSV** to download the regional dataset.
5. Scroll down to review the **YoY Declining Products** table, identifying SKUs experiencing severe revenue contraction (>40% drop).

#### Step 3: Product Catalog Management
1. Click **Products** in the sidebar.
2. Use the live search bar to filter by SKU code or product description.
3. Test server-side pagination (**Previous**, **Next**, page indicator).
4. Click **+ Add Product** to create a new SKU or click **Edit** on an existing SKU.

#### Step 4: Incremental ETL Ingestion & Audit Logs
1. Click **ETL Pipeline** in the sidebar.
2. Upload a sample `.csv` or `.xlsx` transaction file using the drag-and-drop zone.
3. Observe the row validation, duplicate invoice checking, and batch ingestion summary.
4. Review the historical pipeline run log table populated directly from `etl_audit_log`.

#### Step 5: User Governance & RBAC Approval Flow
1. Sign out using the **Sign Out** button in the sidebar footer (or open a new Incognito browser window).
2. Click **"Don't have an account? Sign up"**.
3. Register a test analyst: `analyst@retail.com` with password `Analyst@123`.
4. Attempt to log in immediately. The authentication gate denies entry with:  
   `"Your analyst account is pending administrator approval"`.
5. Switch back to your Administrator session (`admin@retail.com`).
6. Click **User Management** in the sidebar.
7. Locate `analyst@retail.com` in the **Pending Access Requests** queue and click **Approve**.
8. Sign in as `analyst@retail.com` — access is now granted with an **Analyst** badge, giving read-only analytical access while restricting administrative settings.
9. To test account deactivation, switch back to Admin, navigate to the **Platform User Registry**, and click **Deactivate**. Deactivated users are instantly prevented from logging in.
10. Notice that the logged-in Administrator cannot deactivate their own account (enforced by frontend button disabling and backend 400 Bad Request safeguard).

---

## 8. Running Automated Tests

The platform includes a comprehensive test suite of 23 integration and functional tests verifying authentication, RBAC gates, user lifecycle, analytical SQL aggregations, product catalog CRUD, and incremental ETL loading.

### Run Tests via Pytest

```powershell
# Windows PowerShell
.\.venv\Scripts\pytest.exe -v

# macOS / Linux
pytest -v
```

### Test Suite Coverage Breakdown

```text
tests/test_admin_routes.py
  ✓ test_get_all_users_admin                 (Admin user registry listing)
  ✓ test_get_pending_users_admin             (Admin pending analyst queue)
  ✓ test_admin_routes_forbidden_for_analyst  (RBAC 403 enforcement on analyst role)
  ✓ test_admin_routes_unauthenticated        (401 Unauthorized enforcement on public requests)

tests/test_analytics_api.py
  ✓ test_analytics_kpis                      (Executive KPI aggregations)
  ✓ test_analytics_kpis_date_filter          (Parametric start/end date KPI filtering)
  ✓ test_analytics_top_products              (SKU rankings by revenue and quantity)
  ✓ test_analytics_regional_sales            (Strict Top 5 regional market limiting)
  ✓ test_analytics_regional_sales_date_and_exclude_uk (Geographic parameter filtering)
  ✓ test_analytics_monthly_trends            (Monthly longitudinal revenue series)
  ✓ test_analytics_declining_products        (YoY churn risk SKU analysis)
  ✓ test_analytics_unauthorized              (Bearer token requirement check)
  ✓ test_products_list_and_search            (Catalog pagination and text search)
  ✓ test_products_crud_rbac_lifecycle        (Create, update, soft-delete SKU lifecycle)

tests/test_etl_api.py
  ✓ test_get_etl_logs                        (ETL audit log historical query)
  ✓ test_incremental_upload_and_deduplication (File upload & duplicate invoice guard)

tests/test_health.py
  ✓ test_health_check_endpoint               (System liveness check)
  ✓ test_api_transactions_endpoint           (Legacy/core transaction queries)
  ✓ test_api_analytics_auth_required         (Protected analytics check)

tests/test_rbac_flow.py
  ✓ test_rbac_approval_lifecycle             (Analyst registration -> pending -> approved login)

tests/test_user_lifecycle.py
  ✓ test_full_user_lifecycle                 (Approve, decline, deactivate, reactivate flow)
  ✓ test_decline_analyst                     (Decline analyst access request)
  ✓ test_admin_cannot_deactivate_self        (Self-deactivation barrier protection)
```

### Frontend Production Build Verification

Verify that the React production bundle compiles with zero errors:

```bash
cd frontend
npm run build
```

---

## 9. Project Directory Structure

```text
├── backend/                       # FastAPI Backend Application
│   ├── api/
│   │   └── routes/
│   │       ├── admin.py           # User approvals, directory & deactivation
│   │       ├── analytics.py       # KPIs, regional markets, trends & churn
│   │       ├── auth.py            # Login, registration, token issue
│   │       ├── etl.py             # Incremental file upload & audit endpoint
│   │       ├── products.py        # Product catalog CRUD & pagination
│   │       └── transactions.py    # Raw transaction data endpoints
│   ├── auth/
│   │   └── security.py            # Bcrypt hashing & PyJWT token handling
│   ├── database/
│   │   ├── connection.py          # SQLAlchemy engine & session dependency
│   │   ├── init_db.py             # Schema initialization & admin seeding
│   │   └── models.py              # Declarative ORM models (Star Schema)
│   ├── config.py                  # Pydantic Settings application config
│   └── main.py                    # FastAPI application initialization & CORS
├── etl/                           # Modular ETL Pipeline
│   ├── cleaner.py                 # Data hygiene, filters & sanitization
│   ├── loader.py                  # Low-memory streaming & batch loading
│   └── pipeline.py                # Command-line ETL orchestration engine
├── frontend/                      # React SPA Dashboard (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx         # Header & navigation bar
│   │   │   └── Sidebar.jsx        # Dark Slate shell & mobile drawer
│   │   ├── views/
│   │   │   ├── AdminView.jsx      # User approvals & account lifecycle
│   │   │   ├── AnalyticsView.jsx  # Top 5 markets, date filters & YoY churn
│   │   │   ├── ETLView.jsx        # Incremental file uploader & audit logs
│   │   │   ├── LoginView.jsx      # Authentication & registration modal
│   │   │   ├── OverviewView.jsx   # Financial KPI cards & monthly chart
│   │   │   └── ProductsView.jsx   # Catalog search & pagination table
│   │   ├── api.js                 # Axios client with auth interceptors
│   │   ├── App.jsx                # Root application shell & routing
│   │   ├── main.jsx               # React DOM entry point
│   │   └── index.css              # Tailwind CSS styles
│   ├── package.json               # Node.js dependencies
│   └── vite.config.js             # Vite build configuration
├── docs/                          # Documentation & Assets
│   ├── architecture_diagram.png   # High-resolution system architecture (300 DPI)
│   └── system_design.md           # In-depth technical architecture
├── scripts/                       # Maintenance & Automation Scripts
│   ├── cleanup_test_data.py       # Cleans the sample data ingested.
├── sql/                           # SQL DDL & Indexing Scripts
│   |__ schema.sql                 # Base MySQL DDL schema and performance optimization indexes
│ 
├── tests/                         # Pytest Automated Test Suite (23 Tests)
│   ├── conftest.py                # Test fixtures & database isolation
│   ├── test_admin_routes.py       # RBAC & user directory tests
│   ├── test_analytics_api.py      # Analytical queries & catalog tests
│   ├── test_etl_api.py            # ETL upload & audit log tests
│   ├── test_health.py             # System health & liveness tests
│   ├── test_rbac_flow.py          # Registration & approval flow tests
│   └── test_user_lifecycle.py     # Deactivation & self-guard tests
├── .env.example                   # Environment variable template
├── requirements.txt               # Locked Python dependencies
├── online_retail_II.xlsx          # dataset
└── README.md                      # Comprehensive evaluator documentation
```
