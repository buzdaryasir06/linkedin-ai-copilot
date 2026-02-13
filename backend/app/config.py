"""
config.py – Application settings loaded from environment variables.

Uses pydantic-settings to validate and provide typed access to config values.
Loads .env file automatically if present.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application configuration loaded from environment / .env file."""

    # Groq API (free, OpenAI-compatible)
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # Database
    database_url: str = "copilot.db"

    # Server
    cors_origins: list[str] = [
        "chrome-extension://*",
        "http://localhost",
        "http://localhost:3000",
    ]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance (singleton)."""
    return Settings()
