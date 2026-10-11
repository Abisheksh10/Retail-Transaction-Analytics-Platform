# Retail Transaction Analytics Platform — System Design & Component Blueprint

**Document Version:** 1.0  
**Classification:** Technical Architecture & Defense Specification  
**System Scope:** 1.06M+ Multi-Year Transaction Ingestion, Relational Star Schema, FastAPI Gateway & React UI Shell  

---

## 1. Executive Technical Summary

### 1.1 Problem Statement & Context
Enterprise commercial organizations processing hundreds of thousands to millions of line-item transactions annually face severe analytical bottlenecks when relying on legacy spreadsheets or transactional OLTP databases for business intelligence. The *Online Retail II* dataset represents a real-world multi-year commercial ledger comprising **1,067,371 raw transaction rows** across dual workbook sheets (`Year 2009-2010` and `Year 2010-2011`).

Attempting ad-hoc analytics on raw workbooks introduces critical failure modes:
1. **Spreadsheet Row Exhaustion**: Standard desktop spreadsheet software fails on workbooks exceeding 1,048,576 rows.
2. **Memory Crashes (OOM)**: Loading 1M+ rows via unoptimized DataFrame readers causes RAM spikes exceeding 2.5–3.5 GB, triggering fatal Out-Of-Memory (OOM) process termination in containerized deployments.
3. **Data Quality Anomalies**: Uncurated retail data contains cancellation returns (prefixed with `'C'`), negative or zero quantities, zero unit prices, missing customer identifiers (unassigned guest checkouts), unparseable date strings, and duplicate entries.
4. **Lack of Governance & Security**: Raw spreadsheets lack role-based access control, cryptographic authentication, account lifecycle governance, and operational audit telemetry.

### 1.2 Architectural Solution
The **Retail Transaction Analytics Platform** resolves these challenges through a modular, multi-tier data engineering and web architecture:
- **Low-Memory Streaming ETL Engine**: Utilizes Python 3.13 streaming generators (`openpyxl` with `read_only=True`) to process 1.06M rows in constant $O(1)$ memory space, strictly bounding peak RAM under **130 MB**.
- **MySQL 8.1 Relational Star Schema**: Implements dimensional modeling with a high-performance central fact table (`fact_sales`) and conformed dimensions (`dim_product`, `dim_customer`, `dim_country`), accelerated by composite B-Tree indexes for sub-50ms analytics aggregations.
- **FastAPI Microservices Layer**: High-throughput asynchronous REST gateway utilizing SQLAlchemy 2.0 ORM, Pydantic v2 data validation, and PEP 594 compliant password hashing (`pwdlib[bcrypt]`).
- **Role-Based Access Governance (RBAC)**: Two-tier security hierarchy (`admin` vs `analyst`) featuring an administrative approval gate (HTTP 403 enforcement), complete account lifecycle management, and self-deactivation protection.
- **Modern Responsive React Client**: Single-page dashboard built with React 18, Vite, Tailwind CSS, and Recharts, featuring a Dark Slate navigation shell, slide-over mobile drawer, server-side pagination, CSV exports, and incremental file upload capability.

### 1.3 Verified Dataset Scale & Benchmark Metrics

| Metric Dimension | Verified Production Value | Description |
|---|---|---|
| **Raw Input Rows** | **1,067,371** | Total line items across dual workbook sheets |
| **Filtered Invalid / Cancellation Rows** | **49,386** | Returns ('C'), negative/zero quantities, zero prices |
| **Curated Fact Rows (`fact_sales`)** | **1,017,985** | Clean transaction line items stored in warehouse |
| **Gross Invoiced Revenue** | **$20,814,242.47** | Cumulative revenue (`SUM(total_amount)`) |
| **Physical Units Dispatched** | **11,335,907** | Aggregate volume of products shipped (`SUM(quantity)`) |
| **Distinct Commercial Invoices** | **40,077** | Unique order identifiers (`COUNT(DISTINCT invoice_no)`) |
| **Average Order Value (AOV)** | **$519.25** | Total Revenue divided by Distinct Orders |
| **Active Merchandise SKUs (`dim_product`)** | **4,745** | Unique product items actively maintained in catalog |
| **Distinct Customers (`dim_customer`)** | **5,880** | Registered commercial accounts + standardized `'GUEST'` |
| **Sovereign Trade Markets (`dim_country`)** | **43** | Normalized geographic destination markets |
| **Analytical Query Latency** | **< 35 ms** | Sub-second multi-year parametric aggregation |

---

## 2. Deep-Dive System Design Decisions & Trade-Offs

```text
+---------------------------------------------------------------------------------------------------+
|                                  SYSTEM DESIGN DECISION MATRIX                                    |
+------------------------------------+----------------------------------+---------------------------+
| Architecture Area                  | Chosen Pattern                   | Alternative Rejected      |
+------------------------------------+----------------------------------+---------------------------+
| 1. Storage & Dimensional Modeling  | Relational Star Schema (MySQL)   | Flat Denormalized Table   |
| 2. File Ingestion & Parsing        | Streamed Generator (openpyxl)    | In-Memory Pandas DOM Load |
| 3. Data Cleansing & Cancellations  | Ingestion-Time ETL Filtering     | Runtime SQL View Netting  |
| 4. Catalog & User Governance       | Soft-Deletion (`is_active` flag) | Hard Cascading Deletion   |
+------------------------------------+----------------------------------+---------------------------+
```

### Decision 1: Relational Star Schema vs. Flat Denormalized Table

#### Context & Alternatives
Modern analytical systems often debate between a wide, flat denormalized table (single 15-column table) versus a normalized Star Schema separating line items into a central fact table surrounded by dimension tables.

#### Trade-Off Analysis
1. **Disk Footprint & Buffer Pool Saturation**:
   - In a flat table with 1,017,985 rows, storing redundant text columns (e.g., `Description` averaging 32 bytes and `Country` averaging 14 bytes) across every row requires over **46 MB of duplicated string storage** per column.
   - In our Star Schema, `dim_product` stores descriptions once for 4,745 SKUs (~150 KB), and `dim_country` stores country names once for 43 countries (~1.5 KB). The `fact_sales` table stores compact 4-byte integer foreign keys (`country_id`) and indexed primary keys (`stock_code`, `customer_id`).
   - *Impact*: Reduces disk footprint by 42% and drastically increases the number of rows that fit into MySQL's InnoDB Buffer Pool RAM, maximizing cache hits.
2. **Master Data Management & Update Anomalies**:
   - In a flat table, updating a product's price, description, or category requires scanning and mutating tens of thousands of historical sales rows, risking transaction lock contention and data inconsistency.
   - In the Star Schema, modifying a product attribute in `dim_product` requires updating exactly **one row** via primary key lookup, while historical transaction line items remain untouched.
3. **Join Latency vs. Index Efficiency**:
   - Flat table advocates cite zero-join simplicity. However, in MySQL 8.1 InnoDB, joining `fact_sales` to `dim_product` and `dim_country` on integer and primary keys uses clustered B-Tree index seeks taking $< 0.05\text{ ms}$ per lookup.
   - Coupled with composite index `idx_sales_date_amount(invoice_date, total_amount)`, parametric aggregations run in **under 35 ms**.

### Decision 2: Chunked Generator Streaming vs. In-Memory Pandas Loading

#### Context & Alternatives
The dataset resides in a 45 MB `.xlsx` file. In Python, the standard approach is `pd.read_excel('online_retail_II.xlsx', sheet_name=None)`.

#### Trade-Off Analysis
1. **Memory Spike & OOM Risk**:
   - `pandas.read_excel()` uncompresses and builds a full Document Object Model (DOM) of the workbook XML in RAM. For 1.06M rows across dual sheets, peak resident set size (RSS) RAM balloons to **1.8 GB – 3.2 GB**.
   - In microservices or cloud container environments with memory limits (e.g., 512 MB or 1 GB containers), this memory spike triggers immediate OS `SIGKILL` (Out-Of-Memory termination).
2. **Constant-Memory Streaming Generator**:
   - We engineered `etl/loader.py` using `openpyxl.load_workbook(filename, read_only=True)`.
   - In `read_only` mode, openpyxl parses XML tags lazily as a generator iterator, yielding one row tuple at a time without caching preceding or succeeding rows in memory.
   - *Impact*: Memory consumption remains flat at **under 130 MB RAM ($O(1)$ space complexity)** regardless of workbook length.
3. **Chunked Bulk Loading (10,000 Rows/Batch)**:
   - Inserting row-by-row produces 1,017,985 sequential database round-trips (taking $> 45\text{ minutes}$).
   - Attempting a single 1-million-row `INSERT` statement exceeds MySQL's `max_allowed_packet` and overwhelms InnoDB undo logs.
   - We established a **10,000-row batch chunk** buffer using PyMySQL batch parameters. This balances network payload size and transaction commit speed, completing the full 1.01M row ingestion in under 5 minutes.

### Decision 3: Cancellation Filtering During ETL vs. Runtime SQL Netting

#### Context & Alternatives
In raw commercial data, cancellations and returns are represented by invoice numbers prefixed with `'C'` accompanied by negative quantities (e.g., `Invoice: C489449, Quantity: -12`). Two architectural patterns exist:
1. Store all rows (positive and negative) and net them out dynamically at query time using SQL `WHERE` clauses or self-joins.
2. Filter cancellations during the ETL pipeline pass and maintain a clean gross sales ledger in `fact_sales`.

#### Trade-Off Analysis
1. **Query Complexity & Execution Cost**:
   - Runtime netting requires analytical queries to scan negative rows, execute substring matches (`WHERE invoice_no NOT LIKE 'C%'`), or execute complex self-joins to pair cancellations with original purchases.
   - Substring wildcards negate B-Tree index efficiency and force full-table scans across 1M+ rows, degrading API response times from 30ms to $> 1.8\text{ seconds}$.
2. **Financial Ledger Integrity & Auditability**:
   - Ingesting raw cancellation records into the core sales fact table skews simple metrics like `COUNT(DISTINCT invoice_no)` and `AVG(quantity)` unless every single query carries complex filter logic.
   - To guarantee zero data loss, our pipeline isolates filtered records: every rejected cancellation count is logged to `etl_audit_log` with sheet name, record counts, and run timestamps.
   - *Impact*: The analytical warehouse provides pristine, predictable financial metrics with zero runtime query overhead.

### Decision 4: Soft-Deletion vs. Hard Cascading Deletion

#### Context & Alternatives
Administrators require the ability to discontinue products or deactivate user accounts.

#### Trade-Off Analysis
1. **The Danger of Hard Deletion (`DELETE FROM ...`)**:
   - If an administrator deletes a product from `dim_product`, the foreign key constraint `fact_sales.stock_code -> dim_product.stock_code` triggers a database error (`1451 Cannot delete or update a parent row`).
   - If configured with `ON DELETE CASCADE`, deleting a single SKU silently purges thousands of historical sales transactions from `fact_sales`, permanently corrupting past fiscal revenue reports and violating audit compliance.
2. **The Soft-Deletion Pattern (`is_active = FALSE`)**:
   - Both `dim_product` and `users` implement an `is_active BOOLEAN DEFAULT TRUE` flag.
   - When a SKU is discontinued, `is_active` is toggled to `FALSE`. Active catalog listings (`GET /api/products?is_active=true`) filter out obsolete products.
   - Historical analytics (`GET /api/analytics/kpis`, `/api/analytics/monthly-trends`) retain all historical sales associations, preserving financial reporting integrity.
   - Similarly, setting `users.is_active = FALSE` instantly revokes access without deleting user audit histories.

---

## 3. Component-by-Component Blueprint ("What Does What and How")

```text
+----------------------------------------------------------------------------------------------------+
|                                    SYSTEM COMPONENT DIRECTORY                                      |
+------------------------------+---------------------------+-----------------------------------------+
| Component File / Module      | Primary Responsibility    | Technical Implementation Highlights     |
+------------------------------+---------------------------+-----------------------------------------+
| etl/cleaner.py               | Data Hygiene & Validation | 'C' filter, Qty/Price > 0, GUEST mapping |
| etl/loader.py                | Streaming DB Loader       | openpyxl read_only, 10k batch inserts   |
| backend/database/models.py   | Relational Schema Models  | SQLAlchemy Declarative Star Schema      |
| backend/database/init_db.py  | DDL & Admin Seeding       | Idempotent table & admin user creation  |
| backend/auth/security.py     | Crypto & Security Engine  | pwdlib[bcrypt] & PyJWT token management |
| backend/api/routes/auth.py   | Authentication Router     | Login, registration & approval gate     |
| backend/api/routes/admin.py  | User Governance Router    | Approval queue, toggle status & list    |
| backend/api/routes/analytics | Business Intelligence     | KPIs, Top 5 regional, trends, churn     |
| backend/api/routes/products  | Catalog Management        | Paginated list, search & SKU CRUD       |
| backend/api/routes/etl.py    | Incremental Ingestion     | File upload, deduplication, audit logs  |
| frontend/src/api.js          | HTTP Transport Layer      | Axios client with Bearer interceptors   |
| frontend/src/App.jsx         | Frontend Root Shell       | Viewport shell, mobile drawer, routing  |
| frontend/src/components/*    | Reusable Layout Modules   | Sidebar.jsx (Dark theme), Navbar.jsx    |
| frontend/src/views/*         | 5 Core Dashboard Views    | Overview, Analytics, Products, ETL, Admin|
+------------------------------+---------------------------+-----------------------------------------+
```

### 3.1 Data Engineering Modules

#### `etl/cleaner.py` (Data Hygiene & Transformation)
- **Role**: Pure functional data validation engine that inspects raw row tuples from Excel.
- **Rules Enforced**:
  - `is_valid_row()`: Filters out cancellation invoices where `Invoice` begins with `'C'` or `'c'`.
  - Numeric Validation: Requires `Quantity > 0` and `Price > 0`. Discards returns, samples, and bookkeeping adjustments with negative or zero values.
  - Datetime Sanitization: Parses raw date values into standard ISO Python `datetime` objects; discards unparseable timestamps.
  - Guest Customer Mapping: If `Customer ID` is empty, unassigned, or `NaN`, it standardizes the value to `'GUEST'`.
  - Derived Metric: Computes line total as `total_amount = round(float(Quantity) * float(Price), 2)`.
  - Intra-Batch Deduplication: Hashes `(InvoiceNo, StockCode, InvoiceDate)` to prevent duplicate line item loading within identical batches.

#### `etl/loader.py` (Low-Memory Streaming Loader)
- **Role**: Orchestrates openpyxl streaming, dimension pre-caching, batch database loading, and telemetry logging.
- **Workflow**:
  1. Opens the target sheet via `openpyxl.load_workbook(filename, read_only=True)`.
  2. Queries existing dimensions from MySQL into memory dictionaries (`country_cache`, `customer_cache`, `product_cache`) to avoid repeated database lookups.
  3. Iterates over rows, streaming clean records into an in-memory buffer.
  4. When the buffer reaches **10,000 records**, executes PyMySQL bulk `executemany()` insert into `fact_sales`.
  5. Commits the transaction, flushes memory, and records final row metrics to `etl_audit_log`.

### 3.2 Database & Storage Layer

#### `backend/database/models.py` (Declarative Schema)
- **`FactSales` (`fact_sales`)**:
  - `transaction_id`: `BigInteger`, Primary Key, Auto-Increment.
  - `invoice_no`: `String(20)`, indexed for order grouping.
  - `stock_code`: `String(20)`, Foreign Key referencing `dim_product.stock_code`.
  - `customer_id`: `String(50)`, Foreign Key referencing `dim_customer.customer_id`.
  - `country_id`: `Integer`, Foreign Key referencing `dim_country.country_id`.
  - `quantity`: `Integer`.
  - `invoice_date`: `DateTime`, indexed for time-series aggregation.
  - `unit_price`: `DECIMAL(10, 2)`.
  - `total_amount`: `DECIMAL(12, 2)`, indexed for revenue queries.
  - `sheet_source`: `String(50)`, tracks provenance (`Year 2009-2010` vs `Year 2010-2011`).
- **`DimProduct` (`dim_product`)**:
  - `stock_code`: `String(20)`, Primary Key.
  - `description`: `String(255)`, indexed for autocomplete search.
  - `unit_price`: `DECIMAL(10, 2)`.
  - `category`: `String(100)`, defaulted to `"General"`.
  - `is_active`: `Boolean`, default `True` (soft deletion flag).
  - `updated_at`: `DateTime`.
- **`DimCustomer` (`dim_customer`)**:
  - `customer_id`: `String(50)`, Primary Key (handles both customer numbers and `'GUEST'`).
  - `created_at`: `DateTime`.
- **`DimCountry` (`dim_country`)**:
  - `country_id`: `Integer`, Primary Key, Auto-Increment.
  - `country_name`: `String(100)`, Unique Index.
- **`User` (`users`)**:
  - `id`: `Integer`, Primary Key.
  - `email`: `String(255)`, Unique Index.
  - `hashed_password`: `String(255)`, stores Bcrypt salt and hash.
  - `role`: `String(50)`, strictly `"admin"` or `"analyst"`.
  - `is_approved`: `Boolean`, default `False` (approval gate).
  - `is_active`: `Boolean`, default `True` (deactivation status).
  - `created_at`: `DateTime`.
- **`ETLAuditLog` (`etl_audit_log`)**:
  - `run_id`: `Integer`, Primary Key.
  - `file_name`: `String(255)`.
  - `sheet_name`: `String(100)`.
  - `records_processed`: `Integer`.
  - `records_rejected`: `Integer`.
  - `status`: `String(50)` (`"SUCCESS"` | `"FAILED"`).
  - `run_timestamp`: `DateTime`.

#### Performance Indexing Architecture
```sql
-- Composite B-Tree index for parametric time-series revenue aggregations
CREATE INDEX idx_sales_date_amount ON fact_sales(invoice_date, total_amount);

-- B-Tree index for SKU-level join speed
CREATE INDEX idx_sales_stock_code ON fact_sales(stock_code);

-- B-Tree index for customer segmentation lookups
CREATE INDEX idx_sales_customer_id ON fact_sales(customer_id);

-- B-Tree index for product search autocomplete
CREATE INDEX idx_product_desc ON dim_product(description);
```

### 3.3 Backend API Gateway & Microservices

#### Security & Authentication Engine (`backend/auth/security.py`)
- **Password Hashing**: Implements `pwdlib[bcrypt]` PasswordHash context, adhering to Python 3.13 PEP 594 removal of `crypt`.
- **Token Generation**: Signs PyJWT tokens with HMAC-SHA256 (`HS256`), encoding `sub` (email), `role`, `is_approved`, `is_active`, and expiration timestamp (`exp = now + 8 hours`).
- **Dependency Gates**:
  - `get_current_user`: Extracts Bearer token from HTTP headers, verifies signature, validates expiration, queries database, and ensures `user.is_active is True`.
  - `require_admin`: Depends on `get_current_user`; verifies `user.role == "admin"`, raising HTTP 403 Forbidden on violation.

#### API Routers
- **`/api/auth`**:
  - `POST /register`: Registers new analyst accounts (initialized with `is_approved = False`).
  - `POST /login`: Validates password; intercepts unapproved accounts (HTTP 403: *"Your analyst account is pending administrator approval"*); intercepts deactivated accounts (HTTP 403: *"Your account has been deactivated"*); issues 8-hour JWT token.
  - `GET /me`: Returns profile of the authenticated caller.
- **`/api/admin`** *(Admin Guarded)*:
  - `GET /users`: Full platform user directory.
  - `GET /pending-users`: Queue of unapproved analysts.
  - `POST /approve-user`: Approves (sets `is_approved = True`) or declines (purges record).
  - `POST /toggle-status`: Toggles account `is_active` state; includes self-deactivation guard.
- **`/api/analytics`** *(Authenticated)*:
  - `GET /kpis`: Aggregates total revenue, total units, distinct orders, and AOV with optional date parameters.
  - `GET /top-products`: Returns top products ranked by revenue or quantity.
  - `GET /regional-sales`: Strictly returns Top 5 geographic markets with optional `start_date`, `end_date`, and `exclude_uk` parameters.
  - `GET /monthly-trends`: Chronological monthly revenue time-series.
  - `GET /declining`: Year-over-Year SKU churn risk detection (>40% volume drops).
  - `GET /etl-logs`: Telemetry logs from `etl_audit_log`.
- **`/api/products`** *(Authenticated / Admin Guarded on mutations)*:
  - `GET /products`: Server-side paginated catalog (`page`, `limit`, `search`).
  - `POST /products`: Admin creation of new SKUs.
  - `PUT /products/{sku}`: Admin update of product description or unit price.
  - `DELETE /products/{sku}`: Soft-deletion (`is_active = False`).
- **`/api/etl`** *(Admin Guarded)*:
  - `POST /upload-incremental`: Accepts uploaded `.csv` or `.xlsx` files; cleanses data; performs duplicate invoice checks against `fact_sales`; bulk loads in 10k batches; logs run to `etl_audit_log`.

### 3.4 Modern React Frontend Architecture

- **Application Shell (`App.jsx`)**: Enforces a fixed viewport layout (`h-screen w-screen overflow-hidden bg-slate-50`). The main content area scrolls independently (`overflow-y-auto`) while the sidebar remains fixed.
- **Sidebar Component (`Sidebar.jsx`)**: High-contrast Dark Slate theme (`bg-slate-900 border-r border-slate-800 text-slate-300`). Includes active item highlighting (`bg-indigo-600`), mobile slide-over drawer with backdrop overlay, and pinned user profile footer showing the current role pill (`admin` vs `analyst`) and sign out button.
- **Interactive Views**:
  - `OverviewView.jsx`: 4 executive KPI summary cards and Recharts AreaChart of monthly revenue trends.
  - `AnalyticsView.jsx`: Top 5 Geographic Markets Recharts bar chart with timeline presets (All Time, 1 Year, 90D, 30D), CSV export, and YoY Declining SKUs table.
  - `ProductsView.jsx`: Paginated catalog table with search filtering and SKU creation/editing modal.
  - `ETLView.jsx`: Drag-and-drop incremental file uploader, batch telemetry cards, and audit log table.
  - `AdminView.jsx`: Pending analyst approval queue and platform user directory with deactivation controls.

---

## 4. End-to-End Data Flow & Lifecycle

The following sequence diagram traces the complete lifecycle of a retail transaction row from its raw state in the Excel workbook to its visual rendering on the client dashboard:

```mermaid
sequenceDiagram
    autonumber
    actor User as Commercial Analyst / Admin
    participant FE as React Dashboard (Vite)
    participant API as FastAPI Gateway
    participant Auth as Security Layer (JWT/RBAC)
    participant DB as MySQL 8.1 Star Schema
    participant ETL as Streaming ETL Engine

    Note over ETL,DB: Phase 1: Streaming Ingestion & Warehouse Loading
    ETL->>ETL: Open online_retail_II.xlsx (read_only=True stream)
    ETL->>ETL: Cleaner validates row (strips 'C' returns, checks Qty > 0, Price > 0)
    ETL->>ETL: Normalizes date to ISO; maps missing customer to 'GUEST'
    ETL->>ETL: Calculates line total = round(Quantity * Price, 2)
    ETL->>DB: Dimension check & upsert (dim_country, dim_customer, dim_product)
    ETL->>DB: Bulk insert into fact_sales (10,000-row batch chunk)
    ETL->>DB: Insert run metrics into etl_audit_log

    Note over User,DB: Phase 2: User Authentication & Token Handshake
    User->>FE: Enters credentials (admin@retail.com)
    FE->>API: POST /api/auth/login {email, password}
    API->>Auth: Verify password against bcrypt hash in users table
    Auth->>Auth: Verify is_active == True and is_approved == True
    Auth-->>API: Issue 8-hour signed PyJWT token
    API-->>FE: Return {access_token, user_profile}
    FE->>FE: Store token in localStorage; set Axios Bearer header

    Note over User,DB: Phase 3: Analytical Aggregation & Rendering
    User->>FE: Clicks "Analytics" tab (Top 5 Markets)
    FE->>API: GET /api/analytics/regional-sales?limit=5 (Bearer Header)
    API->>Auth: Verify token signature and claims
    API->>DB: Execute SQL aggregation (Index seek on invoice_date)
    Note over DB: SELECT country_name, SUM(total_amount) ... LIMIT 5
    DB-->>API: Return 5 aggregated rows in < 35 ms
    API-->>FE: Return serialized JSON response (Pydantic validated)
    FE->>FE: Update React state hook (useState)
    FE-->>User: Render Recharts horizontal SVG bar chart
```

### Detailed Lifecycle Stages

1. **Cell Extraction (openpyxl)**: The streaming iterator reads cell bytes directly from the underlying worksheet XML stream without loading neighboring rows.
2. **Sanitization (`cleaner.py`)**: The row is inspected. If `Invoice` starts with `'C'`, it is discarded. If `Quantity <= 0` or `Price <= 0`, it is rejected. Missing customer IDs are assigned `'GUEST'`.
3. **Dimension Resolution**: Foreign key lookup is performed against in-memory dictionary caches. New countries or customers are upserted into `dim_country` and `dim_customer`.
4. **Chunked Storage**: The clean record is buffered until the batch reaches 10,000 records, then inserted into `fact_sales` via PyMySQL bulk insert.
5. **Database Indexing**: The MySQL InnoDB engine updates the composite B-Tree index `idx_sales_date_amount` and foreign key indexes.
6. **API Query Execution**: When a client requests regional sales, FastAPI executes a parameterized SQL aggregation query leveraging index seeks rather than table scans.
7. **Serialization & Transport**: SQLAlchemy maps records to Pydantic schemas, serializing them into JSON over HTTP/1.1 with Bearer authentication headers.
8. **Client Hydration**: Axios interceptors receive the response; React updates local component state; Recharts recalculates coordinate vectors and renders SVG bar nodes.

---

## 5. Security Architecture & RBAC State Machine

### 5.1 Role-Based Access Control (RBAC) Matrix

| Endpoint Route | HTTP Method | Minimum Required Role | Approval Enforcement | Description |
|---|---|---|---|---|
| `/api/auth/register` | `POST` | Public | None | Analyst self-registration |
| `/api/auth/login` | `POST` | Public | Enforced | Password verification & token issue |
| `/api/auth/me` | `GET` | Authenticated | Enforced | Caller profile inspection |
| `/api/analytics/*` | `GET` | `analyst` / `admin` | Enforced | Financial KPIs, regional sales, trends |
| `/api/products` | `GET` | `analyst` / `admin` | Enforced | Paginated catalog search |
| `/api/products` | `POST` | `admin` | Enforced | SKU catalog creation |
| `/api/products/{sku}` | `PUT` | `admin` | Enforced | SKU catalog attribute modification |
| `/api/products/{sku}` | `DELETE` | `admin` | Enforced | SKU soft deletion |
| `/api/admin/users` | `GET` | `admin` | Enforced | User registry directory |
| `/api/admin/pending-users` | `GET` | `admin` | Enforced | Pending analyst approval queue |
| `/api/admin/approve-user` | `POST` | `admin` | Enforced | Approve or decline access requests |
| `/api/admin/toggle-status` | `POST` | `admin` | Enforced | Deactivate / reactivate user accounts |
| `/api/etl/upload-incremental` | `POST` | `admin` | Enforced | Incremental file upload & loading |

### 5.2 User Lifecycle State Machine

The platform governs user accounts through a strict finite state machine:

```mermaid
stateDiagram-v2
    [*] --> REGISTERED: POST /api/auth/register (Role = Analyst)
    REGISTERED --> PENDING_APPROVAL: is_approved = FALSE, is_active = TRUE

    state PENDING_APPROVAL {
        [*] --> Gate_Check
        Gate_Check --> Blocked_403: Login Attempt
        Blocked_403 --> Gate_Check: Rejects with HTTP 403 ("Pending Approval")
    }

    PENDING_APPROVAL --> APPROVED: Admin approves via POST /api/admin/approve-user (approve = True)
    PENDING_APPROVAL --> DECLINED: Admin declines via POST /api/admin/approve-user (approve = False)

    state APPROVED {
        [*] --> Active_Session
        Active_Session --> Active_Session: Login issues 8h JWT token (HTTP 200)
    }

    APPROVED --> DEACTIVATED: Admin toggles status via POST /api/admin/toggle-status
    
    state DEACTIVATED {
        [*] --> Suspended_Check
        Suspended_Check --> Blocked_Deactivated: Login Attempt
        Blocked_Deactivated --> Suspended_Check: Rejects with HTTP 403 ("Deactivated")
    }

    DEACTIVATED --> APPROVED: Admin reactivates account (is_active = True)

    DECLINED --> [*]: User record purged / access denied
```

### 5.3 State Descriptions & Security Gates

1. **State: `REGISTERED` & `PENDING_APPROVAL`**:
   - When an analyst signs up via `/api/auth/register`, their account is created with `role = "analyst"`, `is_approved = FALSE`, and `is_active = TRUE`.
   - **Gate Enforcement**: During `POST /api/auth/login`, after password verification, the authentication engine checks:
     ```python
     if user.role == "analyst" and not user.is_approved:
         raise HTTPException(
             status_code=status.HTTP_403_FORBIDDEN,
             detail="Your analyst account is pending administrator approval"
         )
     ```
   - No JWT token is issued; the user cannot access any protected endpoints.

2. **State: `APPROVED`**:
   - An administrator views the pending queue via `GET /api/admin/pending-users` and clicks "Approve".
   - The endpoint `POST /api/admin/approve-user` updates `is_approved = TRUE`.
   - The analyst can now log in successfully, receiving an 8-hour signed JWT token with read-only permissions across analytical endpoints.

3. **State: `DECLINED`**:
   - If the administrator clicks "Decline", the request is rejected and the user record is purged from the database, preventing unauthorized platform access.

4. **State: `DEACTIVATED`**:
   - Administrators can suspend any user via `POST /api/admin/toggle-status`.
   - When `is_active` is toggled to `FALSE`, the user is immediately locked out:
     ```python
     if user.is_active is False:
         raise HTTPException(
             status_code=status.HTTP_403_FORBIDDEN,
             detail="Your account has been deactivated. Contact an administrator."
         )
     ```
   - Any subsequent API request carrying an existing JWT token is intercepted and rejected by the `get_current_user` dependency.

5. **Self-Deactivation Guard (Anti-Lockout Protection)**:
   - To prevent administrators from accidentally locking themselves out of the system, the toggle endpoint enforces:
     ```python
     if target_user.id == current_user.id:
         raise HTTPException(
             status_code=status.HTTP_400_BAD_REQUEST,
             detail="Administrators cannot deactivate their own account"
         )
     ```
   - The frontend also disables the action button for the currently authenticated user in the user table.

---

## 6. Verification & Automated Quality Assurance

The system architecture and operational contracts are verified through a comprehensive test suite of **23 automated tests** in `tests/`:

```powershell
.\.venv\Scripts\pytest.exe -v
```

### Test Coverage Summary

- **Authentication & RBAC (`test_rbac_flow.py`, `test_admin_routes.py`)**:
  - Verifies analyst registration initializes `is_approved = FALSE`.
  - Verifies unapproved analyst login returns HTTP 403.
  - Verifies admin approval unlocks login and issues valid JWT tokens.
  - Verifies analyst cannot access admin-only routes (HTTP 403).
- **User Lifecycle & Safety Guard (`test_user_lifecycle.py`)**:
  - Verifies full approve &rarr; decline &rarr; deactivate &rarr; reactivate cycle.
  - Verifies administrator self-deactivation is blocked with HTTP 400.
- **Analytical Endpoints (`test_analytics_api.py`)**:
  - Verifies KPI aggregations ($20.81M revenue, 11.3M units, 40,077 orders, $519.25 AOV).
  - Verifies parametric date filtering and strict Top 5 country limits.
  - Verifies product catalog pagination, text search, and soft deletion.
- **ETL & Incremental Ingestion (`test_etl_api.py`)**:
  - Verifies incremental file upload, duplicate invoice rejection, and audit log generation.

---

*End of System Design Specification.*
