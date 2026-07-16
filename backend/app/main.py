from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.core.config import settings
from app.core.database import db
from app.core.logging import configure_logging
from app.core.object_storage import object_storage
from app.core.redis_client import redis_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logging.getLogger(__name__).info("Starting %s %s", settings.app_name, settings.app_version)
    settings.ensure_storage_dirs()
    db.init()
    redis_client.ping()
    object_storage.init()
    app.state.models = {}
    yield
    logging.getLogger(__name__).info("Stopping %s", settings.app_name)


app = FastAPI(
    title="Satellite/Aerial Image Analysis PoC",
    description="Local FastAPI backend for upload, analysis, comparison, and export workflows.",
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
settings.ensure_storage_dirs()
app.mount("/uploads", StaticFiles(directory=str(settings.uploads_path)), name="uploads")
app.mount("/results", StaticFiles(directory=str(settings.results_path)), name="results")
