from uuid import UUID
from pydantic import BaseModel


class DistrictZoneRead(BaseModel):
    id: UUID
    name: str
    name_az: str
    code: str | None = None
    boundary: dict | None = None
    population: int | None = None
    area_km2: float | None = None

    model_config = {"from_attributes": True}
