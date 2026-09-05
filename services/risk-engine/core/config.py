"""
Application configuration — loaded from environment variables.
Uses pydantic-settings for validation and type coercion.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """All configuration for the risk engine, loaded from .env"""

    # --- Environment ---
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # --- Supabase ---
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # --- CORS ---
    CORS_ORIGINS: str = "http://localhost:3000"

    # --- Weather API ---
    OPENWEATHERMAP_API_KEY: str = ""

    # --- Twilio (feature-flagged) ---
    FEATURE_TWILIO: bool = False
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # --- Rate Limiting ---
    RATE_LIMIT_PER_MINUTE: int = 60

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
