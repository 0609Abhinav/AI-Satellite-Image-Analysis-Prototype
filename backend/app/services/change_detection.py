import json
from uuid import uuid4

import cv2
import numpy as np
from fastapi import HTTPException
from PIL import Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from shapely.geometry import box

from app.core.config import settings
from app.core.database import db
from app.schemas.analysis import Artifact, CompareResult
from app.services.analysis import analysis_service
from app.services.storage import artifact_url, now_iso, storage_service
from app.services.summary import summary_service


class ChangeDetectionService:
    async def compare_images(self, before_id: str, after_id: str) -> CompareResult:
        try:
            before_analysis = analysis_service.get_analysis_for_image(before_id)
        except HTTPException:
            before_analysis = await analysis_service.analyze_image(before_id)
        try:
            after_analysis = analysis_service.get_analysis_for_image(after_id)
        except HTTPException:
            after_analysis = await analysis_service.analyze_image(after_id)
        before_image = storage_service.get_image(before_id)
        after_image = storage_service.get_image(after_id)
        compare_id = uuid4().hex
        timestamp = now_iso()
        db.execute(
            """
            INSERT INTO comparisons (id, before_image_id, after_image_id, status, created_at, updated_at)
            VALUES (?, ?, ?, 'processing', ?, ?)
            """,
            (compare_id, before_id, after_id, timestamp, timestamp),
        )
        try:
            before_masks = np.load(analysis_service.masks_path_for_image(before_id))
            after_masks = np.load(analysis_service.masks_path_for_image(after_id))
            image_area = before_image.width * before_image.height
            output_dir = settings.results_path / compare_id
            output_dir.mkdir(parents=True, exist_ok=True)
            changes: list[dict] = []
            diff_canvas = np.zeros((before_image.height, before_image.width, 4), dtype=np.uint8)

            for key in before_masks.files:
                label = key.replace("_", " ")
                before_mask = (before_masks[key] > 0).astype(np.uint8)
                after_mask = cv2.resize((after_masks[key] > 0).astype(np.uint8), (before_image.width, before_image.height), interpolation=cv2.INTER_NEAREST)
                before_mask = cv2.resize(before_mask, (before_image.width, before_image.height), interpolation=cv2.INTER_NEAREST)
                for change_type, diff_mask, color in (
                    ("new", cv2.bitwise_and(after_mask, cv2.bitwise_not(before_mask)), (232, 163, 61, 155)),
                    ("removed", cv2.bitwise_and(before_mask, cv2.bitwise_not(after_mask)), (230, 82, 82, 135)),
                ):
                    components = self._components(diff_mask, max(100, int(image_area * 0.0008)))
                    for bbox, area_px in components[:16]:
                        polygon = box(bbox[0], bbox[1], bbox[0] + bbox[2], bbox[1] + bbox[3])
                        changes.append(
                            {
                                "label": label,
                                "change_type": change_type,
                                "area_px": int(area_px),
                                "area_pct": round(float(polygon.area / image_area * 100), 2),
                                "bbox": bbox,
                                "confidence": 0.58,
                            }
                        )
                    diff_canvas[diff_mask > 0] = color

            before_rgba = Image.open(storage_service.image_path(before_id)).convert("RGBA").resize((before_image.width, before_image.height))
            overlay = Image.fromarray(diff_canvas, mode="RGBA")
            diff_path = output_dir / "difference_overlay.png"
            Image.alpha_composite(before_rgba, overlay).convert("RGB").save(diff_path)

            summary = await summary_service.summarize_changes(changes)
            report = {
                "id": compare_id,
                "before_image_id": before_id,
                "after_image_id": after_id,
                "status": "completed",
                "changes": sorted(changes, key=lambda item: item["area_px"], reverse=True),
                "artifacts": [Artifact(kind="difference_overlay", url=artifact_url(diff_path), path=str(diff_path)).model_dump()],
                "summary": summary,
                "error": None,
                "created_at": timestamp,
                "updated_at": now_iso(),
            }
            json_path = output_dir / "comparison.json"
            json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
            pdf_path = output_dir / "comparison_report.pdf"
            self._write_pdf(pdf_path, report, before_analysis.summary, after_analysis.summary)
            report["artifacts"].extend(
                [
                    Artifact(kind="json", url=artifact_url(json_path), path=str(json_path)).model_dump(),
                    Artifact(kind="pdf", url=artifact_url(pdf_path), path=str(pdf_path)).model_dump(),
                ]
            )
            db.execute(
                "UPDATE comparisons SET status = 'completed', result_json = ?, updated_at = ? WHERE id = ?",
                (db.dumps(report), report["updated_at"], compare_id),
            )
            return CompareResult(**report)
        except Exception as exc:
            updated_at = now_iso()
            db.execute("UPDATE comparisons SET status = 'failed', error = ?, updated_at = ? WHERE id = ?", (str(exc), updated_at, compare_id))
            raise HTTPException(status_code=500, detail=f"Comparison failed: {exc}") from exc

    def _components(self, mask: np.ndarray, min_area: int) -> list[tuple[list[int], int]]:
        contours, _ = cv2.findContours((mask > 0).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        results: list[tuple[list[int], int]] = []
        for contour in contours:
            area = int(cv2.contourArea(contour))
            if area < min_area:
                continue
            x, y, w, h = cv2.boundingRect(contour)
            results.append(([int(x), int(y), int(w), int(h)], area))
        return sorted(results, key=lambda item: item[1], reverse=True)

    def _write_pdf(self, path, report: dict, before_summary: str | None, after_summary: str | None) -> None:
        pdf = canvas.Canvas(str(path), pagesize=letter)
        width, height = letter
        navy = colors.HexColor("#0B1220")
        panel = colors.HexColor("#121B2E")
        teal = colors.HexColor("#3FA7A0")
        amber = colors.HexColor("#E8A33D")
        text = colors.HexColor("#E7EDF5")
        muted = colors.HexColor("#8CA0B8")

        pdf.setFillColor(navy)
        pdf.rect(0, 0, width, height, fill=1, stroke=0)
        pdf.setFillColor(panel)
        pdf.roundRect(36, height - 150, width - 72, 104, 8, fill=1, stroke=0)
        pdf.setFillColor(teal)
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(56, height - 74, "LOCAL SATELLITE CHANGE ANALYSIS")
        pdf.setFillColor(text)
        pdf.setFont("Helvetica-Bold", 24)
        pdf.drawString(56, height - 106, "Mission Report")
        pdf.setFillColor(muted)
        pdf.setFont("Helvetica", 9)
        pdf.drawRightString(width - 56, height - 74, report["id"][:18].upper())
        pdf.drawRightString(width - 56, height - 94, report["created_at"][:19].replace("T", " "))

        y = height - 188
        pdf.setFillColor(text)
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(56, y, "Executive Summary")
        y -= 20
        pdf.setFillColor(muted)
        pdf.setFont("Helvetica", 10)
        y = self._draw_wrapped(pdf, report["summary"] or "No summary available.", 56, y, width - 112, 14)

        y -= 14
        grouped = self._group_changes(report["changes"])
        cards = [
            ("Changed Regions", str(len(report["changes"])), teal),
            ("Grouped Classes", str(len(grouped)), amber),
            ("Largest Change", f"{grouped[0]['area_pct']:.2f}%" if grouped else "0%", amber),
        ]
        card_width = (width - 128) / 3
        for idx, (label, value, color) in enumerate(cards):
            x = 56 + idx * (card_width + 10)
            pdf.setFillColor(panel)
            pdf.roundRect(x, y - 58, card_width, 54, 6, fill=1, stroke=0)
            pdf.setFillColor(color)
            pdf.setFont("Helvetica-Bold", 18)
            pdf.drawString(x + 12, y - 28, value)
            pdf.setFillColor(muted)
            pdf.setFont("Helvetica", 8)
            pdf.drawString(x + 12, y - 44, label.upper())

        y -= 96
        pdf.setFillColor(text)
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(56, y, "Grouped Change Findings")
        y -= 18
        pdf.setFillColor(panel)
        pdf.roundRect(56, y - 26, width - 112, 28, 6, fill=1, stroke=0)
        pdf.setFillColor(muted)
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawString(70, y - 8, "FEATURE")
        pdf.drawString(255, y - 8, "TYPE")
        pdf.drawString(350, y - 8, "REGIONS")
        pdf.drawString(445, y - 8, "AREA")
        y -= 34
        pdf.setFont("Helvetica", 9)
        for item in grouped[:14]:
            if y < 72:
                pdf.showPage()
                pdf.setFillColor(navy)
                pdf.rect(0, 0, width, height, fill=1, stroke=0)
                y = height - 64
            pdf.setFillColor(colors.HexColor("#1A263B"))
            pdf.roundRect(56, y - 18, width - 112, 22, 4, fill=1, stroke=0)
            pdf.setFillColor(text)
            pdf.drawString(70, y - 10, item["label"].title())
            pdf.setFillColor(amber if item["change_type"] == "new" else colors.HexColor("#E65252"))
            pdf.drawString(255, y - 10, item["change_type"].upper())
            pdf.setFillColor(text)
            pdf.drawString(365, y - 10, str(item["regions"]))
            pdf.drawString(445, y - 10, f"{item['area_pct']:.2f}%")
            y -= 26

        y -= 12
        pdf.setFillColor(muted)
        pdf.setFont("Helvetica", 8)
        y = self._draw_wrapped(pdf, f"Before analysis: {before_summary or 'n/a'}", 56, y, width - 112, 11)
        y = self._draw_wrapped(pdf, f"After analysis: {after_summary or 'n/a'}", 56, y - 4, width - 112, 11)
        pdf.save()

    def _group_changes(self, changes: list[dict]) -> list[dict]:
        grouped: dict[tuple[str, str], dict] = {}
        for change in changes:
            key = (change["change_type"], change["label"])
            item = grouped.setdefault(key, {"change_type": change["change_type"], "label": change["label"], "regions": 0, "area_px": 0, "area_pct": 0.0})
            item["regions"] += 1
            item["area_px"] += change["area_px"]
            item["area_pct"] += change["area_pct"]
        return sorted(grouped.values(), key=lambda item: item["area_px"], reverse=True)

    def _draw_wrapped(self, pdf, text: str, x: int, y: int, width: int, line_height: int) -> int:
        words = text.split()
        line = ""
        for word in words:
            candidate = f"{line} {word}".strip()
            if pdf.stringWidth(candidate, "Helvetica", 10) > width and line:
                pdf.drawString(x, y, line)
                y -= line_height
                line = word
            else:
                line = candidate
        if line:
            pdf.drawString(x, y, line)
            y -= line_height
        return y


change_detection_service = ChangeDetectionService()
