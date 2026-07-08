from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    uploads_dir: str
    results_dir: str
