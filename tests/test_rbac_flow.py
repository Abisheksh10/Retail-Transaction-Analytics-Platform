import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database.session import engine
from sqlalchemy import text

client = TestClient(app)


def cleanup_test_user(email: str = "analyst_test@retail.com"):
    """Ensure database state is clean before and after test."""
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM users WHERE email = :email"), {"email": email})


def test_rbac_approval_lifecycle():
    """Verify registration, 403 login gate, admin approval, and successful login."""
    test_email = "analyst_test@retail.com"
    test_password = "Password@123"
    admin_email = "admin@retail.com"
    admin_password = "Admin@123"

    print("\n" + "=" * 65)
    print("         RBAC & ANALYST APPROVAL GATE TEST EXECUTION")
    print("=" * 65)

    # 0. Clean prior state
    cleanup_test_user(test_email)

    # 1. Register analyst
    print("1. Registering analyst: analyst_test@retail.com...")
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": test_email, "password": test_password},
    )
    assert reg_resp.status_code == 201, f"Expected 201, got {reg_resp.status_code}: {reg_resp.text}"
    reg_data = reg_resp.json()
    assert reg_data["role"] == "analyst"
    assert reg_data["is_approved"] is False
    analyst_id = reg_data["user_id"]
    print(f"   -> Registered successfully (ID: {analyst_id}, is_approved: False)")

    # 2. Attempt login before approval (MUST receive HTTP 403)
    print("2. Attempting analyst login before approval...")
    blocked_login = client.post(
        "/api/auth/login",
        json={"email": test_email, "password": test_password},
    )
    assert blocked_login.status_code == 403, f"Expected 403, got {blocked_login.status_code}: {blocked_login.text}"
    err_detail = blocked_login.json().get("detail", "")
    assert "pending administrator approval" in err_detail.lower()
    print(f"   -> Blocked as expected: HTTP 403 ('{err_detail}')")

    # 3. Login as Seeded Admin
    print(f"3. Authenticating as administrator: {admin_email}...")
    admin_login = client.post(
        "/api/auth/login",
        json={"email": admin_email, "password": admin_password},
    )
    assert admin_login.status_code == 200, f"Expected 200, got {admin_login.status_code}: {admin_login.text}"
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("   -> Administrator authenticated with valid JWT bearer token")

    # 4. Fetch pending users list
    print("4. Fetching pending users list via GET /api/admin/pending-users...")
    pending_resp = client.get("/api/admin/pending-users", headers=admin_headers)
    assert pending_resp.status_code == 200
    pending_list = pending_resp.json()
    pending_analyst = next((u for u in pending_list if u["email"] == test_email), None)
    assert pending_analyst is not None, f"Analyst {test_email} not found in pending list"
    print(f"   -> Pending list retrieved ({len(pending_list)} pending). Found: {pending_analyst['email']}")

    # 5. Approve analyst via admin endpoint
    print(f"5. Approving analyst (ID {analyst_id}) via POST /api/admin/approve-user...")
    approve_resp = client.post(
        "/api/admin/approve-user",
        headers=admin_headers,
        json={"user_id": analyst_id, "approve": True},
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["is_approved"] is True
    print("   -> Analyst approved successfully by administrator")

    # 6. Attempt analyst login AFTER approval (MUST receive HTTP 200)
    print("6. Attempting analyst login after administrator approval...")
    approved_login = client.post(
        "/api/auth/login",
        json={"email": test_email, "password": test_password},
    )
    assert approved_login.status_code == 200, f"Expected 200, got {approved_login.status_code}: {approved_login.text}"
    analyst_token = approved_login.json()["access_token"]
    assert analyst_token
    print("   -> Login succeeded: HTTP 200 with 8-hour JWT token")

    # 7. Verify /api/auth/me profile
    print("7. Verifying analyst profile via GET /api/auth/me...")
    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}
    me_resp = client.get("/api/auth/me", headers=analyst_headers)
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["email"] == test_email
    assert me_data["role"] == "analyst"
    assert me_data["is_approved"] is True
    print(f"   -> Profile verified: Email={me_data['email']}, Role={me_data['role']}, Approved={me_data['is_approved']}")

    # 8. Verify non-admin blocked from admin endpoints
    print("8. Verifying analyst cannot access admin endpoints...")
    admin_block_resp = client.get("/api/admin/pending-users", headers=analyst_headers)
    assert admin_block_resp.status_code == 403
    print("   -> Analyst blocked from admin endpoints: HTTP 403 ('Administrator access required')")

    print("-" * 65)
    print("ALL RBAC WORKFLOW ASSERTIONS PASSED SUCCESSFULLY")
    print("=" * 65 + "\n")

    # Cleanup
    cleanup_test_user(test_email)


if __name__ == "__main__":
    test_rbac_approval_lifecycle()
