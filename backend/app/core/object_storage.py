from datetime import timedelta
from pathlib import Path

from minio import Minio
from minio.error import S3Error

from app.core.config import settings


class ObjectStorage:
    def __init__(self) -> None:
        self.client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )

    def init(self) -> None:
        for bucket in (settings.minio_uploads_bucket, settings.minio_results_bucket):
            if not self.client.bucket_exists(bucket):
                self.client.make_bucket(bucket)

    def upload_bytes(self, bucket: str, object_key: str, content: bytes, content_type: str) -> None:
        from io import BytesIO

        self.client.put_object(bucket, object_key, BytesIO(content), len(content), content_type=content_type)

    def upload_file(self, bucket: str, object_key: str, path: Path, content_type: str = "application/octet-stream") -> None:
        self.client.fput_object(bucket, object_key, str(path), content_type=content_type)

    def download_file(self, bucket: str, object_key: str, path: Path) -> Path:
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            self.client.fget_object(bucket, object_key, str(path))
        except S3Error:
            raise
        return path

    def presigned_url(self, bucket: str, object_key: str) -> str:
        return self.client.presigned_get_object(bucket, object_key, expires=timedelta(hours=2))


object_storage = ObjectStorage()
