import logging
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from core.config import settings
from routers import monitoring, complaints, auth, district_map, open_data, ai, buildings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

app = FastAPI(
    title="Nərimanov Digital API",
    version="1.0.0",
    description="Nərimanov rayonunun rəsmi rəqəmsal monitorinq və xidmət platforması",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(monitoring.router)
app.include_router(complaints.router)
app.include_router(auth.router)
app.include_router(district_map.router)
app.include_router(open_data.router)
app.include_router(ai.router)
app.include_router(buildings.router)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "Nərimanov Digital API", "environment": settings.ENVIRONMENT}


@app.on_event("startup")
async def startup():
    logger.info("Nərimanov Digital API başladı — %s mühiti", settings.ENVIRONMENT)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
