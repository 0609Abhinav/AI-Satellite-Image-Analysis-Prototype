from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from minio.error import S3Error

from app.core.object_storage import object_storage
from app.core.config import settings
from app.schemas.analysis import AnalyzeResponse, CompareRequest, CompareResponse, FetchSatelliteRequest, UploadResponse
from app.schemas.health import HealthResponse
from app.services.storage import storage_service

router = APIRouter()


def content_type_for_object(object_key: str) -> str:
    lowered = object_key.lower()
    if lowered.endswith(".png"):
        return "image/png"
    if lowered.endswith(".jpg") or lowered.endswith(".jpeg"):
        return "image/jpeg"
    if lowered.endswith(".json"):
        return "application/json"
    if lowered.endswith(".pdf"):
        return "application/pdf"
    return "application/octet-stream"


@router.get("/health", response_model=HealthResponse, tags=["system"])
async def health() -> HealthResponse:
    """Return basic backend readiness and local storage configuration."""
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=settings.app_version,
        uploads_dir=str(settings.uploads_path),
        results_dir=str(settings.results_path),
    )


@router.get("/objects/{bucket}/{object_key:path}", tags=["storage"])
async def get_object(bucket: str, object_key: str) -> StreamingResponse:
    """Stream a stored MinIO object through the backend so browsers use one reachable app URL."""
    allowed_buckets = {settings.minio_uploads_bucket, settings.minio_results_bucket}
    if bucket not in allowed_buckets:
        raise HTTPException(status_code=404, detail="Object not found.")
    try:
        response = object_storage.get_object(bucket, object_key)
    except S3Error as exc:
        raise HTTPException(status_code=404, detail="Object not found.") from exc

    return StreamingResponse(response.stream(32 * 1024), media_type=content_type_for_object(object_key))


@router.post("/upload", response_model=UploadResponse, tags=["images"])
async def upload_image(file: UploadFile) -> UploadResponse:
    """Upload one PNG/JPG/JPEG image and return its local image id and metadata."""
    image = await storage_service.save_upload(file)
    return UploadResponse(image=image)


@router.post("/fetch-satellite", response_model=UploadResponse, tags=["images"])
async def fetch_satellite_image(payload: FetchSatelliteRequest) -> UploadResponse:
    """Fetch a clean satellite tile by coordinates and save it as an uploaded image."""
    image = await storage_service.fetch_satellite_tile(
        lat=payload.lat,
        lng=payload.lng,
        zoom=payload.zoom,
        size=payload.size,
        provider=payload.provider,
        capture_date=payload.capture_date,
    )
    return UploadResponse(image=image)


@router.post("/analyze/{image_id}", response_model=AnalyzeResponse, tags=["analysis"])
async def analyze_image(image_id: str) -> AnalyzeResponse:
    """Run local detection and segmentation for one uploaded image."""
    from app.services.analysis import analysis_service

    analysis = await analysis_service.analyze_image(image_id)
    return AnalyzeResponse(analysis=analysis)


@router.get("/analysis/{image_id}", response_model=AnalyzeResponse, tags=["analysis"])
async def get_analysis(image_id: str) -> AnalyzeResponse:
    """Fetch the latest analysis result for an uploaded image id."""
    from app.services.analysis import analysis_service

    return AnalyzeResponse(analysis=analysis_service.get_analysis_for_image(image_id))


@router.post("/compare", response_model=CompareResponse, tags=["comparison"])
async def compare_images(payload: CompareRequest) -> CompareResponse:
    """Compare two uploaded images by diffing their segmentation masks."""
    from app.services.change_detection import change_detection_service

    comparison = await change_detection_service.compare_images(payload.before_image_id, payload.after_image_id)
    return CompareResponse(comparison=comparison)
