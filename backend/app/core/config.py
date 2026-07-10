from functools import cached_property
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "satellite-analysis-poc"
    app_version: str = "0.1.0"
    environment: str = "local"
    backend_cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    uploads_dir: str = "uploads"
    results_dir: str = "results"
    database_url: str = "satellite_poc.db"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.2"
    model_backend: str = "grounded_sam"
    model_cache_dir: str = "models/cache"
    grounding_dino_model_id: str = "IDEA-Research/grounding-dino-tiny"
    sam_model_id: str = "facebook/sam-vit-base"
    model_box_threshold: float = Field(default=0.18, ge=0.01, le=0.99)
    model_text_threshold: float = Field(default=0.2, ge=0.01, le=0.99)
    model_use_tiling: bool = True
    model_tile_size: int = Field(default=640, ge=256)
    model_tile_overlap: float = Field(default=0.15, ge=0.0, le=0.6)
    model_disable_tiling_below_max_side: int = Field(default=1280, ge=256)
    model_max_analysis_side: int = Field(default=1536, ge=256)
    sam_max_boxes: int = Field(default=28, ge=1)
    max_upload_mb: int = Field(default=25, ge=1)
    satellite_fetch_timeout_seconds: float = Field(default=20.0, ge=3.0)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @cached_property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parents[3]

    @cached_property
    def uploads_path(self) -> Path:
        return self._resolve_path(self.uploads_dir)

    @cached_property
    def results_path(self) -> Path:
        return self._resolve_path(self.results_dir)

    @cached_property
    def database_path(self) -> Path:
        return self._resolve_path(self.database_url)

    @cached_property
    def model_cache_path(self) -> Path:
        return self._resolve_path(self.model_cache_dir)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    def ensure_storage_dirs(self) -> None:
        self.uploads_path.mkdir(parents=True, exist_ok=True)
        self.results_path.mkdir(parents=True, exist_ok=True)
        self.model_cache_path.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, value: str) -> Path:
        path = Path(value)
        if path.is_absolute():
            return path
        return (self.project_root / path).resolve()


settings = Settings()
