from typing import Any, Literal

from pydantic import BaseModel


class UploadedImage(BaseModel):
    id: str
    original_name: str
    filename: str
    content_type: str
    width: int
    height: int
    size_bytes: int
    url: str
    created_at: str


class UploadResponse(BaseModel):
    image: UploadedImage


class Detection(BaseModel):
    id: str
    label: str
    confidence: float
    bbox: list[int]
    area_px: int


class ClassStat(BaseModel):
    label: str
    count: int
    area_px: int
    coverage_pct: float
    mean_confidence: float


class Artifact(BaseModel):
    kind: str
    url: str
    path: str


class AnalysisResult(BaseModel):
    id: str
    image_id: str
    status: Literal["processing", "completed", "failed"]
    mode: str
    image: UploadedImage | None = None
    detections: list[Detection] = []
    class_stats: list[ClassStat] = []
    artifacts: list[Artifact] = []
    quality_notes: list[str] = []
    summary: str | None = None
    error: str | None = None
    created_at: str
    updated_at: str


class AnalyzeResponse(BaseModel):
    analysis: AnalysisResult


class CompareRequest(BaseModel):
    before_image_id: str
    after_image_id: str


class ChangeItem(BaseModel):
    label: str
    change_type: str
    area_px: int
    area_pct: float
    bbox: list[int]
    confidence: float


class CompareResult(BaseModel):
    id: str
    before_image_id: str
    after_image_id: str
    status: Literal["processing", "completed", "failed"]
    changes: list[ChangeItem] = []
    artifacts: list[Artifact] = []
    summary: str | None = None
    error: str | None = None
    created_at: str
    updated_at: str


class CompareResponse(BaseModel):
    comparison: CompareResult
