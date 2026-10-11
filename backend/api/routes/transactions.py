"""Transactions endpoints router placeholder."""

from fastapi import APIRouter

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("/")
async def list_transactions(limit: int = 50, offset: int = 0):
    """Retrieve paginated transactions."""
    return {
        "status": "ready",
        "message": "Transactions endpoint initialized",
        "limit": limit,
        "offset": offset,
        "items": []
    }
