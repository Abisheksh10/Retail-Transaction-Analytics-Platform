"""Admin API routes for user approval and access management."""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import User
from backend.auth.security import require_admin

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


class PendingUserResponse(BaseModel):
    id: int
    email: str
    role: str
    is_approved: bool
    is_active: bool
    created_at: Optional[datetime] = None


class ApproveUserRequest(BaseModel):
    user_id: int
    approve: bool = True


class ToggleUserStatusRequest(BaseModel):
    user_id: int
    is_active: bool


class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    is_approved: bool
    is_active: bool
    created_at: Optional[datetime] = None


@router.get("/pending-users", response_model=list[PendingUserResponse])
def get_pending_users(
    db: Session = Depends(get_db),
):
    """Retrieve all analyst accounts awaiting administrator approval (unapproved and active)."""
    pending_users = (
        db.query(User)
        .filter(User.role == "analyst", User.is_approved.is_(False), User.is_active.is_(True))
        .order_by(User.created_at.desc())
        .all()
    )
    return [
        PendingUserResponse(
            id=u.id,
            email=u.email,
            role=u.role,
            is_approved=bool(u.is_approved),
            is_active=bool(u.is_active),
            created_at=u.created_at,
        )
        for u in pending_users
    ]


@router.post("/approve-user")
def approve_user(
    req: ApproveUserRequest,
    db: Session = Depends(get_db),
):
    """Update approval status for a specified user (Approve or Decline)."""
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {req.user_id} not found",
        )

    if req.approve:
        user.is_approved = True
        user.is_active = True
        action = "approved"
    else:
        user.is_approved = False
        user.is_active = False
        action = "declined"

    db.commit()
    db.refresh(user)

    return {
        "message": f"User {user.email} has been successfully {action}.",
        "user_id": user.id,
        "email": user.email,
        "is_approved": bool(user.is_approved),
        "is_active": bool(user.is_active),
    }


@router.post("/toggle-user-status")
def toggle_user_status(
    req: ToggleUserStatusRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Activate or deactivate a user account. Admins cannot deactivate their own account."""
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {req.user_id} not found",
        )

    if user.id == current_user.id and not req.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own account.",
        )

    user.is_active = req.is_active
    db.commit()
    db.refresh(user)

    action = "activated" if req.is_active else "deactivated"
    return {
        "message": f"User {user.email} has been successfully {action}.",
        "user_id": user.id,
        "email": user.email,
        "is_approved": bool(user.is_approved),
        "is_active": bool(user.is_active),
    }


@router.get("/users", response_model=list[UserResponse])
def get_all_users(
    db: Session = Depends(get_db),
):
    """Retrieve all users in the system."""
    all_users = db.query(User).order_by(User.id.asc()).all()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            role=u.role,
            is_approved=bool(u.is_approved),
            is_active=bool(u.is_active),
            created_at=u.created_at,
        )
        for u in all_users
    ]
