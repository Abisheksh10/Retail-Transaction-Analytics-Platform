"""Database initialization script: creates schema, performance indexes, and initial admin user."""

import sys
from pathlib import Path
import pymysql

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.config import settings
from backend.auth.security import get_password_hash


def execute_sql_file(cursor, file_path: Path):
    """Read an SQL file, split statements by semicolon, and execute them."""
    if not file_path.exists():
        raise FileNotFoundError(f"SQL file not found: {file_path}")

    sql_content = file_path.read_text(encoding="utf-8")
    
    # Simple statement splitter respecting basic SQL blocks
    statements = [stmt.strip() for stmt in sql_content.split(";") if stmt.strip()]

    for stmt in statements:
        # Skip empty statements or comments-only statements
        clean_lines = [line for line in stmt.splitlines() if not line.strip().startswith("--")]
        clean_stmt = "\n".join(clean_lines).strip()
        if not clean_stmt:
            continue
        try:
            cursor.execute(clean_stmt)
        except pymysql.MySQLError as err:
            # 1061 is ER_DUP_KEYNAME (Duplicate key name / index already exists)
            if err.args[0] == 1061:
                pass
            else:
                raise err


def init_database() -> dict:
    """Connect to MySQL, create database, tables, indexes, and initial admin user."""
    print("Connecting to MySQL server...")

    # 1. Connect without selecting a database first
    conn = pymysql.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        charset="utf8mb4",
        autocommit=True,
    )

    try:
        with conn.cursor() as cursor:
            # 2. Create database
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{settings.DB_NAME}` "
                f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            )
            print(f"Database '{settings.DB_NAME}' ensured.")

            # 3. Switch to database
            cursor.execute(f"USE `{settings.DB_NAME}`;")

            # 4. Execute schema.sql
            schema_path = PROJECT_ROOT / "sql" / "schema.sql"
            execute_sql_file(cursor, schema_path)
            print("Applied schema definitions from sql/schema.sql.")

            # 5. Execute indexes.sql
            # indexes_path = PROJECT_ROOT / "sql" / "indexes.sql"
            # execute_sql_file(cursor, indexes_path)
            # print("Applied performance indexes from sql/indexes.sql.")

            # 5b. Migration safeguard: ensure users table has is_active column
            cursor.execute("SHOW COLUMNS FROM users LIKE 'is_active';")
            if not cursor.fetchone():
                cursor.execute("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER is_approved;")
                print("Applied migration: added 'is_active' column to users table.")

            # 6. Check and create default admin user
            cursor.execute(
                "SELECT id, email, role, is_approved, is_active, created_at FROM users WHERE email = %s;",
                (settings.ADMIN_EMAIL,),
            )
            admin_user = cursor.fetchone()

            if not admin_user:
                hashed_pw = get_password_hash(settings.ADMIN_DEFAULT_PASSWORD)
                cursor.execute(
                    "INSERT INTO users (email, hashed_password, role, is_approved, is_active) "
                    "VALUES (%s, %s, 'admin', TRUE, TRUE);",
                    (settings.ADMIN_EMAIL, hashed_pw),
                )
                cursor.execute(
                    "SELECT id, email, role, is_approved, is_active, created_at FROM users WHERE email = %s;",
                    (settings.ADMIN_EMAIL,),
                )
                admin_user = cursor.fetchone()
                admin_status = "Created"
            else:
                admin_status = "Already Exists"

            # 7. Collect verification details
            cursor.execute("SHOW TABLES;")
            tables = [row[0] for row in cursor.fetchall()]

            # Count rows for each table
            table_stats = []
            for t in tables:
                cursor.execute(f"SELECT COUNT(*) FROM `{t}`;")
                count = cursor.fetchone()[0]
                table_stats.append((t, count))

            # Indexes on fact_sales
            cursor.execute("SHOW INDEX FROM fact_sales;")
            index_names = sorted(list(set(row[2] for row in cursor.fetchall())))

        return {
            "database": settings.DB_NAME,
            "tables": table_stats,
            "indexes_on_fact_sales": index_names,
            "admin_user": {
                "id": admin_user[0],
                "email": admin_user[1],
                "role": admin_user[2],
                "is_approved": bool(admin_user[3]),
                "is_active": bool(admin_user[4]),
                "status": admin_status,
            },
        }
    finally:
        conn.close()


def print_confirmation_table(results: dict):
    """Print clean ASCII confirmation table."""
    print("\n" + "=" * 65)
    print(" " * 18 + "DATABASE INITIALIZATION REPORT")
    print("=" * 65)
    print(f"Database Name: {results['database']}")
    print("-" * 65)
    print(f"{'Table Name':<25} | {'Row Count':<12} | {'Status':<15}")
    print("-" * 65)
    for table, count in results["tables"]:
        print(f"{table:<25} | {count:<12} | {'Verified'}")
    print("-" * 65)
    print(f"Indexes on fact_sales: {', '.join(results['indexes_on_fact_sales'])}")
    print("-" * 65)
    admin = results["admin_user"]
    print("Admin User Verification:")
    print(f"  - ID:          {admin['id']}")
    print(f"  - Email:       {admin['email']}")
    print(f"  - Role:        {admin['role']}")
    print(f"  - Approved:    {admin['is_approved']}")
    print(f"  - Active:      {admin['is_active']}")
    print(f"  - Setup State: {admin['status']}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    try:
        report = init_database()
        print_confirmation_table(report)
    except pymysql.err.OperationalError as e:
        if e.args[0] == 1045:
            print(f"\n[AUTHENTICATION ERROR] Access denied for user '{settings.DB_USER}'@'{settings.DB_HOST}'.")
            print("Please ensure DB_PASSWORD is correctly set in your .env file.\n")
            sys.exit(1)
        else:
            raise e
