"""Authentication API routes: registration, login, and user profile."""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import User
from backend.auth.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


class UserRegisterRequest(BaseModel):
    email: str = Field(min_length=3, description="User email address")
    password: str = Field(min_length=6, description="Minimum 6 character password")


class UserLoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str
    user_id: int


class UserProfileResponse(BaseModel):
    id: int
    email: str
    role: str
    is_approved: bool
    is_active: bool
    created_at: Optional[datetime] = None


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(
    req: UserRegisterRequest,
    db: Session = Depends(get_db),
):
    """Register a new analyst account. Newly registered analysts start unapproved."""
    existing_user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists",
        )

    hashed_pw = get_password_hash(req.password)
    new_user = User(
        email=req.email.lower().strip(),
        hashed_password=hashed_pw,
        role="analyst",
        is_approved=False,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "Analyst registered successfully. Account is pending administrator approval.",
        "user_id": new_user.id,
        "email": new_user.email,
        "role": new_user.role,
        "is_approved": bool(new_user.is_approved),
        "is_active": bool(new_user.is_active),
    }


@router.post("/login", response_model=TokenResponse)
def login_user(
    req: UserLoginRequest,
    db: Session = Depends(get_db),
):
    """Authenticate email and password, check approval status, and issue JWT access token."""
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Deactivation check
    if user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact an administrator.",
        )

    # Crucial Approval Gate: Block unapproved analysts before issuing token
    if user.role == "analyst" and not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your analyst account is pending administrator approval.",
        )

    # Generate 8-hour access token
    token_payload = {
        "sub": user.email,
        "role": user.role,
        "user_id": user.id,
    }
    token = create_access_token(token_payload)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=user.role,
        email=user.email,
        user_id=user.id,
    )


@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """Retrieve profile and approval status of authenticated user."""
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        is_approved=bool(current_user.is_approved),
        is_active=bool(current_user.is_active),
        created_at=current_user.created_at,
    )
