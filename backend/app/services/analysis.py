import asyncio
import json
import logging
from pathlib import Path
import time
from uuid import uuid4

from fastapi import HTTPException

from app.core.config import settings
from app.core.database import db
from app.schemas.analysis import AnalysisResult, Artifact
from app.services.storage import artifact_url, now_iso, storage_service
from app.services.summary import summary_service
from app.services.vision import vision_pipeline

logger = logging.getLogger(__name__)


class AnalysisService:
    async def analyze_image(self, image_id: str) -> AnalysisResult:
        image = storage_service.get_image(image_id)
        analysis_id = uuid4().hex
        timestamp = now_iso()
        started = time.perf_counter()
        logger.info("analysis %s accepted for image %s (%s)", analysis_id, image_id, image.original_name)
        db.execute(
            """
            INSERT INTO analyses (id, image_id, status, created_at, updated_at)
            VALUES (?, ?, 'processing', ?, ?)
            """,
            (analysis_id, image_id, timestamp, timestamp),
        )
        try:
            image_path = storage_service.image_path(image_id)
            logger.info("analysis %s running model inference", analysis_id)
            result = await asyncio.to_thread(vision_pipeline.analyze, image_path, image.original_name)
            logger.info(
                "analysis %s model inference complete: mode=%s detections=%s elapsed=%.1fs",
                analysis_id,
                result.mode,
                len(result.detections),
                time.perf_counter() - started,
            )
            output_dir = settings.results_path / analysis_id
            logger.info("analysis %s rendering artifacts", analysis_id)
            artifacts = await asyncio.to_thread(vision_pipeline.render_artifacts, image_path, result, output_dir)
            report = {
                "id": analysis_id,
                "image_id": image_id,
                "status": "completed",
                "mode": result.mode,
                "image": image.model_dump(),
                "detections": result.detections,
                "class_stats": result.class_stats,
                "artifacts": [
                    Artifact(kind=kind, url=artifact_url(path), path=str(path)).model_dump()
                    for kind, path in artifacts.items()
                    if kind != "masks"
                ],
                "quality_notes": self._quality_notes(image.original_name, result.mode),
                "summary": await summary_service.summarize_analysis(result.class_stats, result.detections, result.mode),
                "error": None,
                "created_at": timestamp,
                "updated_at": now_iso(),
            }
            json_path = output_dir / "analysis.json"
            json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
            report["artifacts"].append(Artifact(kind="json", url=artifact_url(json_path), path=str(json_path)).model_dump())
            db.execute(
                "UPDATE analyses SET status = 'completed', result_json = ?, updated_at = ? WHERE id = ?",
                (db.dumps(report), report["updated_at"], analysis_id),
            )
            logger.info("analysis %s completed in %.1fs", analysis_id, time.perf_counter() - started)
            return AnalysisResult(**report)
        except Exception as exc:
            updated_at = now_iso()
            db.execute(
                "UPDATE analyses SET status = 'failed', error = ?, updated_at = ? WHERE id = ?",
                (str(exc), updated_at, analysis_id),
            )
            logger.exception("analysis %s failed after %.1fs", analysis_id, time.perf_counter() - started)
            raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc

    def get_analysis_for_image(self, image_id: str) -> AnalysisResult:
        row = db.fetch_one("SELECT * FROM analyses WHERE image_id = ? ORDER BY updated_at DESC", (image_id,))
        if not row:
            raise HTTPException(status_code=404, detail="Analysis not found for image.")
        return self._row_to_result(row)

    def masks_path_for_image(self, image_id: str) -> Path:
        result = self.get_analysis_for_image(image_id)
        return settings.results_path / result.id / "masks.npz"

    def _row_to_result(self, row: dict) -> AnalysisResult:
        if row["result_json"]:
            return AnalysisResult(**db.loads(row["result_json"]))
        return AnalysisResult(
            id=row["id"],
            image_id=row["image_id"],
            status=row["status"],
            mode="pending",
            quality_notes=[],
            error=row["error"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _quality_notes(self, original_name: str, mode: str) -> list[str]:
        notes: list[str] = []
        lowered = original_name.lower()
        if any(term in lowered for term in ["accuweather", "weather", "openstreetmap", "osm", "map"]):
            notes.append(
                "This file appears to be a rendered map/weather screenshot, not raw satellite or aerial imagery. "
                "Grounding DINO/SAM can localize visible map regions, but building accuracy will be low because actual roofs/buildings are not visible as real image objects."
            )
        if any(term in lowered for term in ["sentinel-2", "sentinel_2", "sentinel2"]) or "sentinel-2" in mode:
            notes.append(
                "Sentinel-2 true-color imagery is medium resolution. The app still attempts buildings, paved areas, vegetation, water, and open land, but small building footprints may be missed or merged. Higher-resolution aerial/sub-meter imagery will improve building accuracy."
            )
        if "grounding-dino" in mode:
            notes.append("Detection is zero-shot: boxes come from Grounding DINO text prompts and masks come from SAM. For higher accuracy, use clearer high-resolution satellite/aerial imagery.")
        return notes


analysis_service = AnalysisService()
