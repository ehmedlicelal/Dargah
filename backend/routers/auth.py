from fastapi import APIRouter, Depends, HTTPException, status, Header
from supabase import Client
from core.supabase_client import get_supabase
from schemas.auth import TokenVerifyRequest, UserProfile

router = APIRouter(prefix="/auth", tags=["Auth"])


def _get_user_profile(supabase: Client, token: str) -> UserProfile:
    try:
        auth_response = supabase.auth.get_user(token)
        user = auth_response.user
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Etibarsız token")

        profile_result = (
            supabase.table("users")
            .select("*")
            .eq("id", str(user.id))
            .single()
            .execute()
        )
        profile = profile_result.data or {}
        return UserProfile(
            id=user.id,
            full_name=profile.get("full_name"),
            role=profile.get("role", "citizen"),
            phone=profile.get("phone"),
            email=user.email,
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token doğrulama uğursuz oldu")


@router.post("/verify", response_model=UserProfile)
def verify_token(
    body: TokenVerifyRequest,
    supabase: Client = Depends(get_supabase),
):
    return _get_user_profile(supabase, body.access_token)


@router.get("/me", response_model=UserProfile)
def get_me(
    authorization: str = Header(...),
    supabase: Client = Depends(get_supabase),
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token tələb olunur")
    token = authorization.removeprefix("Bearer ").strip()
    return _get_user_profile(supabase, token)

# TODO: integrate ASAN eID when credentials are available from the district authority
