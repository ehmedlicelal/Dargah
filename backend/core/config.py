from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_ANON_KEY: str
    OPENROUTER_API_KEY: str
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL: str = "google/gemini-2.0-flash-001"
    OPENROUTER_VISION_MODEL: str = "google/gemini-2.0-flash-001"
    FRONTEND_URL: str = "http://localhost:3000"
    ENVIRONMENT: str = "development"
    WATI_API_URL: str = ""    # e.g. https://live-server-12345.wati.io
    WATI_API_TOKEN: str = ""  # Bearer token from app.wati.io → Settings → API


settings = Settings()
