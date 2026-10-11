"""Sanity test verifying environment and FastAPI health check."""

import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_health_check_endpoint():
    """Verify health endpoint returns 200 OK and healthy status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "app_name" in data


def test_api_transactions_endpoint():
    """Verify transactions route skeleton responds."""
    response = client.get("/api/transactions/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert "items" in data


def test_api_analytics_auth_required():
    """Verify analytics routes require authentication."""
    response = client.get("/api/analytics/kpis")
    assert response.status_code == 401
