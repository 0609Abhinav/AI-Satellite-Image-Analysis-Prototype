from datetime import datetime, timezone
from io import BytesIO
import math
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
import httpx
from PIL import Image

from app.core.config import settings
from app.core.database import db
from app.schemas.analysis import UploadedImage
from app.utils.files import is_allowed_image


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def artifact_url(path: Path) -> str:
    rel = path.resolve().relative_to(settings.project_root)
    return "/" + str(rel).replace("\\", "/")


class StorageService:
    async def save_upload(self, file: UploadFile) -> UploadedImage:
        if not file.filename or not is_allowed_image(file.filename):
            raise HTTPException(status_code=400, detail="Only PNG, JPG, and JPEG images are supported in this phase.")

        content = await file.read()
        max_bytes = settings.max_upload_mb * 1024 * 1024
        if len(content) > max_bytes:
            raise HTTPException(status_code=413, detail=f"Image exceeds {settings.max_upload_mb} MB limit.")

        image_id = uuid4().hex
        suffix = Path(file.filename).suffix.lower()
        filename = f"{image_id}{suffix}"
        path = settings.uploads_path / filename
        path.write_bytes(content)

        try:
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                width, height = image.size
        except Exception as exc:
            path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Uploaded file is not a readable image.") from exc

        if width < 64 or height < 64:
            path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Image dimensions must be at least 64x64 pixels.")

        created_at = now_iso()
        db.execute(
            """
            INSERT INTO images (id, original_name, filename, content_type, width, height, size_bytes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (image_id, file.filename, filename, file.content_type or "application/octet-stream", width, height, len(content), created_at),
        )
        return self.get_image(image_id)

    async def fetch_satellite_tile(
        self,
        *,
        lat: float,
        lng: float,
        zoom: int,
        size: int,
        provider: str = "esri",
        capture_date: str | None = None,
    ) -> UploadedImage:
        if provider.lower() != "esri":
            raise HTTPException(status_code=400, detail="Only the free Esri imagery provider is enabled in this PoC.")
        if not (-85 <= lat <= 85 and -180 <= lng <= 180):
            raise HTTPException(status_code=400, detail="Latitude or longitude is outside the supported tile range.")
        zoom = max(1, min(20, int(zoom)))
        size = max(256, min(1280, int(size)))

        west, south, east, north = self._bbox_around_point(lat, lng, zoom, size)
        params = {
            "bbox": f"{west},{south},{east},{north}",
            "bboxSR": "4326",
            "imageSR": "4326",
            "size": f"{size},{size}",
            "format": "png",
            "f": "image",
        }
        url = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
        try:
            async with httpx.AsyncClient(timeout=settings.satellite_fetch_timeout_seconds) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Could not fetch satellite imagery: {exc}") from exc

        requested_date = capture_date or datetime.now(timezone.utc).date().isoformat()
        area_name = await self._reverse_geocode(lat, lng)
        readable_area = area_name or f"{self._format_coordinate(lat, 'lat')}, {self._format_coordinate(lng, 'lng')}"
        original_name = f"esri_satellite_{readable_area.replace('/', '-')}_{requested_date}_z{zoom}.png"
        return self._save_image_bytes(
            response.content,
            original_name=original_name,
            content_type=response.headers.get("content-type", "image/png"),
            capture_date=requested_date,
            source_provider="Esri World Imagery",
            source_note=(
                f"{readable_area}. Center {self._format_coordinate(lat, 'lat')}, {self._format_coordinate(lng, 'lng')}. "
                "Fetched from current Esri World Imagery. Requested capture date is stored for comparison workflow; "
                "exact historical imagery requires a time-enabled provider such as Sentinel/Copernicus or Esri Wayback."
            ),
        )

    def get_image(self, image_id: str) -> UploadedImage:
        row = db.fetch_one("SELECT * FROM images WHERE id = ?", (image_id,))
        if not row:
            raise HTTPException(status_code=404, detail="Image not found.")
        return UploadedImage(
            id=row["id"],
            original_name=row["original_name"],
            filename=row["filename"],
            content_type=row["content_type"],
            width=row["width"],
            height=row["height"],
            size_bytes=row["size_bytes"],
            url=artifact_url(settings.uploads_path / row["filename"]),
            capture_date=row.get("capture_date"),
            source_provider=row.get("source_provider"),
            source_note=row.get("source_note"),
            created_at=row["created_at"],
        )

    def image_path(self, image_id: str) -> Path:
        image = self.get_image(image_id)
        return settings.uploads_path / image.filename

    def _save_image_bytes(
        self,
        content: bytes,
        *,
        original_name: str,
        content_type: str,
        capture_date: str | None = None,
        source_provider: str | None = None,
        source_note: str | None = None,
    ) -> UploadedImage:
        max_bytes = settings.max_upload_mb * 1024 * 1024
        if len(content) > max_bytes:
            raise HTTPException(status_code=413, detail=f"Image exceeds {settings.max_upload_mb} MB limit.")

        image_id = uuid4().hex
        filename = f"{image_id}.png"
        path = settings.uploads_path / filename
        path.write_bytes(content)

        try:
            with Image.open(BytesIO(content)) as image:
                width, height = image.size
                normalized = image.convert("RGB")
                normalized.save(path, format="PNG")
        except Exception as exc:
            path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Fetched imagery is not a readable image.") from exc

        if width < 64 or height < 64:
            path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Fetched image dimensions must be at least 64x64 pixels.")

        created_at = now_iso()
        db.execute(
            """
            INSERT INTO images (id, original_name, filename, content_type, width, height, size_bytes, capture_date, source_provider, source_note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                image_id,
                original_name,
                filename,
                content_type or "image/png",
                width,
                height,
                path.stat().st_size,
                capture_date,
                source_provider,
                source_note,
                created_at,
            ),
        )
        return self.get_image(image_id)

    def _bbox_around_point(self, lat: float, lng: float, zoom: int, size: int) -> tuple[float, float, float, float]:
        meters_per_pixel = 156543.03392 * math.cos(math.radians(lat)) / (2**zoom)
        half_meters = meters_per_pixel * size / 2
        meters_per_degree_lat = 111_320
        meters_per_degree_lng = max(1, 111_320 * math.cos(math.radians(lat)))
        delta_lat = half_meters / meters_per_degree_lat
        delta_lng = half_meters / meters_per_degree_lng
        return (
            max(-180, lng - delta_lng),
            max(-85, lat - delta_lat),
            min(180, lng + delta_lng),
            min(85, lat + delta_lat),
        )

    async def _reverse_geocode(self, lat: float, lng: float) -> str | None:
        try:
            async with httpx.AsyncClient(timeout=8.0, headers={"User-Agent": f"{settings.app_name}/{settings.app_version}"}) as client:
                response = await client.get(
                    "https://nominatim.openstreetmap.org/reverse",
                    params={"lat": lat, "lon": lng, "format": "jsonv2", "zoom": 16, "addressdetails": 1},
                )
                response.raise_for_status()
                payload = response.json()
        except Exception:
            return None

        address = payload.get("address") or {}
        parts = [
            address.get("suburb") or address.get("neighbourhood") or address.get("quarter"),
            address.get("city") or address.get("town") or address.get("village"),
            address.get("state"),
            address.get("country"),
        ]
        label = ", ".join(dict.fromkeys(part for part in parts if part))
        return label or payload.get("display_name")

    def _format_coordinate(self, value: float, axis: str) -> str:
        suffix = "N" if axis == "lat" and value >= 0 else "S" if axis == "lat" else "E" if value >= 0 else "W"
        return f"{abs(value):.5f}{suffix}"


storage_service = StorageService()
