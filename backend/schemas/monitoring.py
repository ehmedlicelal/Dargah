from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel


class AirQualityValue(BaseModel):
    aqi: int
    pm25: float
    pm10: float
    co2: float
    no2: float | None = None
    status: str | None = None


class TrafficValue(BaseModel):
    congestion_pct: int
    avg_speed_kmh: float
    incident_count: int
    status: str | None = None


class MonitoringDataBase(BaseModel):
    zone_id: UUID | None = None
    type: Literal["air_quality", "traffic", "utilities", "incident"]
    value: dict
    source: str = "sensor"


class MonitoringDataCreate(MonitoringDataBase):
    pass


class MonitoringDataRead(MonitoringDataBase):
    id: UUID
    recorded_at: datetime

    model_config = {"from_attributes": True}
