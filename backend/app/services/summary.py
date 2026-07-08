import httpx

from app.core.config import settings


class SummaryService:
    async def summarize_analysis(self, class_stats: list[dict], detections: list[dict], mode: str) -> str:
        building_count = sum(stat["count"] for stat in class_stats if stat["label"] == "building")
        paved_pct = sum(stat["coverage_pct"] for stat in class_stats if stat["label"] in {"road", "parking lot"})
        vegetation_pct = next((stat["coverage_pct"] for stat in class_stats if stat["label"] == "vegetation"), 0)
        prompt = (
            "Write a concise satellite image analysis summary for a PoC. "
            f"Mode: {mode}. Building detections: {building_count}. "
            f"Estimated paved coverage: {paved_pct:.2f}%. Vegetation coverage: {vegetation_pct:.2f}%. "
            f"Total detections: {len(detections)}. Include a reliability caveat."
        )
        return await self._ollama_or_template(prompt, self._analysis_template(building_count, paved_pct, vegetation_pct, len(detections), mode))

    async def summarize_changes(self, changes: list[dict]) -> str:
        grouped = self._group_changes(changes)
        prompt = (
            "Write a concise satellite change-detection summary for a PoC. "
            f"Grouped changes: {grouped[:8]}. Mention major changes and reliability caveat."
        )
        if not changes:
            fallback = "No major raster-mask changes were detected. Treat this as a low-confidence PoC result until model-backed segmentation is enabled."
        else:
            biggest = grouped[:3]
            labels = ", ".join(f"{item['change_type']} {item['label']} ({item['regions']} regions, {item['area_pct']:.2f}%)" for item in biggest)
            fallback = f"Detected {len(changes)} changed regions, grouped by feature class. Largest grouped changes: {labels}. Results are approximate because this run used local map-aware raster heuristics."
        return await self._ollama_or_template(prompt, fallback)

    async def _ollama_or_template(self, prompt: str, fallback: str) -> str:
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                response = await client.post(
                    f"{settings.ollama_base_url}/api/generate",
                    json={"model": settings.ollama_model, "prompt": prompt, "stream": False},
                )
                response.raise_for_status()
                text = response.json().get("response", "").strip()
                return text or fallback
        except Exception:
            return fallback

    def _analysis_template(self, building_count: int, paved_pct: float, vegetation_pct: float, total: int, mode: str) -> str:
        return (
            f"Detected {building_count} building-like regions and {total} total feature regions. "
            f"Estimated paved coverage is {paved_pct:.2f}% and vegetation coverage is {vegetation_pct:.2f}%. "
            f"This run used {mode}; confidence is suitable for a demo but not for operational decisions."
        )

    def _group_changes(self, changes: list[dict]) -> list[dict]:
        grouped: dict[tuple[str, str], dict] = {}
        for change in changes:
            key = (change["change_type"], change["label"])
            item = grouped.setdefault(
                key,
                {
                    "change_type": change["change_type"],
                    "label": change["label"],
                    "regions": 0,
                    "area_px": 0,
                    "area_pct": 0.0,
                },
            )
            item["regions"] += 1
            item["area_px"] += change["area_px"]
            item["area_pct"] += change["area_pct"]
        return sorted(grouped.values(), key=lambda item: item["area_px"], reverse=True)


summary_service = SummaryService()
