from fastapi import Depends, HTTPException, status, Header
from supabase import Client
from core.supabase_client import get_supabase


def _extract_token(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token tələb olunur")
    return authorization.removeprefix("Bearer ").strip()


def require_auth(
    authorization: str = Header(...),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Validates JWT and returns the user record. Raises 401 if invalid."""
    token = _extract_token(authorization)
    try:
        resp = supabase.auth.get_user(token)
        user = resp.user
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Etibarsız token")
        return {"id": str(user.id), "email": user.email}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token doğrulama uğursuz oldu")


def require_admin_or_operator(
    authorization: str = Header(...),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Validates JWT and asserts role is admin or operator."""
    token = _extract_token(authorization)
    try:
        resp = supabase.auth.get_user(token)
        user = resp.user
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Etibarsız token")
        profile = (
            supabase.table("users")
            .select("role")
            .eq("id", str(user.id))
            .single()
            .execute()
        ).data
        role = (profile or {}).get("role", "citizen")
        if role not in ("admin", "operator"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu əməliyyat üçün icazəniz yoxdur")
        return {"id": str(user.id), "email": user.email, "role": role}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token doğrulama uğursuz oldu")


def require_admin(
    authorization: str = Header(...),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Validates JWT and asserts role is admin."""
    user = require_admin_or_operator.__wrapped__ if hasattr(require_admin_or_operator, "__wrapped__") else None
    token = _extract_token(authorization)
    try:
        resp = supabase.auth.get_user(token)
        u = resp.user
        if not u:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Etibarsız token")
        profile = (
            supabase.table("users")
            .select("role")
            .eq("id", str(u.id))
            .single()
            .execute()
        ).data
        role = (profile or {}).get("role", "citizen")
        if role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yalnız admin bu əməliyyatı edə bilər")
        return {"id": str(u.id), "email": u.email, "role": role}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token doğrulama uğursuz oldu")
