from uuid import UUID
from pydantic import BaseModel


class TokenVerifyRequest(BaseModel):
    access_token: str


class UserProfile(BaseModel):
    id: UUID
    full_name: str | None = None
    role: str = "citizen"
    phone: str | None = None
    email: str | None = None

    model_config = {"from_attributes": True}
