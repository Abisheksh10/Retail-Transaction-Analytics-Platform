"""Re-export authentication dependencies."""

from backend.auth.security import get_current_user, require_admin

__all__ = ["get_current_user", "require_admin"]
