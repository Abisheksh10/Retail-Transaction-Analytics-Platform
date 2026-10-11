"""Application configuration management using Pydantic Settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    APP_NAME: str = "Retail Transaction Analytics Platform"
    DEBUG: bool = True

    API_HOST: str = "127.0.0.1"
    API_PORT: int = 8000

    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3306
    DB_NAME: str = "retail_analytics_db"
    DB_USER: str = "root"
    DB_PASSWORD: str = ""

    JWT_SECRET_KEY: str = "default_insecure_development_secret_key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    ADMIN_EMAIL: str = "admin@retail.com"
    ADMIN_DEFAULT_PASSWORD: str = "Admin@123"

    DATASET_PATH: str = "online_retail_II.xlsx"
    REPORTS_DIR: str = "reports/generated"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def database_url(self) -> str:
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"


settings = Settings()
