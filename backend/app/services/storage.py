from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
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
            created_at=row["created_at"],
        )

    def image_path(self, image_id: str) -> Path:
        image = self.get_image(image_id)
        return settings.uploads_path / image.filename


storage_service = StorageService()
