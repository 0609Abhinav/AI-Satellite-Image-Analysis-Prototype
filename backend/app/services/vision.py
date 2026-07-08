from dataclasses import dataclass
import logging
import os
from pathlib import Path
import time
from uuid import uuid4

import cv2
import numpy as np
from PIL import Image, ImageDraw

from app.core.config import settings

logger = logging.getLogger(__name__)

CLASS_COLORS = {
    "building": (232, 163, 61),
    "road": (140, 160, 184),
    "parking lot": (164, 174, 186),
    "vegetation": (63, 167, 112),
    "water": (63, 128, 167),
    "open land": (184, 150, 96),
}


@dataclass
class VisionResult:
    mode: str
    detections: list[dict]
    class_stats: list[dict]
    masks: dict[str, np.ndarray]


class GroundedSamPipeline:
    """Grounding DINO + Segment Anything model pipeline with explicit fallback."""

    def __init__(self) -> None:
        self.mode = settings.model_backend
        self._model_bundle = None

    def analyze(self, image_path: Path, source_name: str | None = None) -> VisionResult:
        if settings.model_backend == "grounded_sam":
            try:
                return self._analyze_with_grounded_sam(image_path)
            except Exception as exc:
                if settings.environment.lower() == "local":
                    print(f"Grounded-SAM model path failed, falling back to OpenCV: {exc}")
                    return self._analyze_with_opencv(image_path, mode=f"opencv-fallback-after-model-error: {exc}")
                raise
        return self._analyze_with_opencv(image_path, mode="opencv-map-aware-fallback")

    def _analyze_with_grounded_sam(self, image_path: Path) -> VisionResult:
        started = time.perf_counter()
        bundle = self._load_model_bundle()
        image = Image.open(image_path).convert("RGB")
        width, height = image.size
        prompt_labels = ["building", "road", "parking lot", "vegetation", "water", "open land"]
        prompt_terms = [
            "building",
            "house",
            "roof",
            "road",
            "street",
            "highway",
            "parking lot",
            "pavement",
            "vehicle lot",
            "vegetation",
            "tree",
            "grass",
            "forest",
            "water",
            "river",
            "lake",
            "pond",
            "open land",
            "field",
            "bare ground",
        ]
        text_prompt = ". ".join(prompt_terms) + "."

        detections = self._detect_with_grounding(bundle, image, text_prompt, prompt_labels)
        detections = self._nms_detections(detections, iou_threshold=0.55)
        logger.info("Grounding DINO inference finished: boxes=%s elapsed=%.1fs", len(detections), time.perf_counter() - started)
        if not detections:
            empty_masks = {label: np.zeros((height, width), dtype=np.uint8) for label in prompt_labels}
            return VisionResult(
                mode=f"grounding-dino:{settings.grounding_dino_model_id}+sam:{settings.sam_model_id}",
                detections=[],
                class_stats=self._stats_from_masks(empty_masks, [], width * height),
                masks=empty_masks,
            )

        logger.info("SAM segmentation started: boxes=%s", len(detections))
        masks = self._segment_boxes_with_sam(bundle, image, detections, width, height)
        logger.info("SAM segmentation finished: elapsed=%.1fs", time.perf_counter() - started)
        class_stats = self._stats_from_masks(masks, detections, width * height)
        return VisionResult(
            mode=f"grounding-dino:{settings.grounding_dino_model_id}+sam:{settings.sam_model_id}+tiling:{settings.model_use_tiling}",
            detections=detections,
            class_stats=class_stats,
            masks=masks,
        )

    def _detect_with_grounding(self, bundle: dict, image: Image.Image, text_prompt: str, prompt_labels: list[str]) -> list[dict]:
        width, height = image.size
        detections = self._detect_tile(bundle, image, text_prompt, prompt_labels, 0, 0)
        if not settings.model_use_tiling or max(width, height) <= settings.model_tile_size:
            return detections

        tile_size = min(settings.model_tile_size, width, height)
        stride = max(128, int(tile_size * (1 - settings.model_tile_overlap)))
        tile_count = 0
        for y in self._tile_offsets(height, tile_size, stride):
            for x in self._tile_offsets(width, tile_size, stride):
                if x == 0 and y == 0 and width <= tile_size and height <= tile_size:
                    continue
                tile = image.crop((x, y, min(width, x + tile_size), min(height, y + tile_size)))
                tile_count += 1
                detections.extend(self._detect_tile(bundle, tile, text_prompt, prompt_labels, x, y))
        logger.info("Grounding DINO tiled pass finished: tiles=%s raw_boxes=%s", tile_count, len(detections))
        return detections

    def _tile_offsets(self, length: int, tile_size: int, stride: int) -> list[int]:
        if length <= tile_size:
            return [0]
        offsets = list(range(0, max(1, length - tile_size + 1), stride))
        last = length - tile_size
        if offsets[-1] != last:
            offsets.append(last)
        return offsets

    def _detect_tile(self, bundle: dict, image: Image.Image, text_prompt: str, prompt_labels: list[str], offset_x: int, offset_y: int) -> list[dict]:
        import torch

        width, height = image.size
        logger.info("Grounding DINO inference tile started: offset=%s,%s size=%sx%s", offset_x, offset_y, width, height)
        with torch.inference_mode():
            inputs = bundle["grounding_processor"](images=image, text=text_prompt, return_tensors="pt").to(bundle["device"])
            outputs = bundle["grounding_model"](**inputs)
            target_sizes = torch.tensor([[height, width]], device=bundle["device"])
            results = bundle["grounding_processor"].post_process_grounded_object_detection(
                outputs,
                inputs.input_ids,
                box_threshold=settings.model_box_threshold,
                text_threshold=settings.model_text_threshold,
                target_sizes=target_sizes,
            )[0]
        return self._grounding_results_to_detections(results, prompt_labels, width, height, offset_x, offset_y)

    def _load_model_bundle(self):
        if self._model_bundle is not None:
            return self._model_bundle

        started = time.perf_counter()
        cache_path = settings.model_cache_path
        cache_path.mkdir(parents=True, exist_ok=True)
        os.environ.setdefault("HF_HOME", str(cache_path / "hf_home"))
        os.environ.setdefault("HF_HUB_CACHE", str(cache_path / "hub"))

        import torch
        from transformers import AutoProcessor, GroundingDinoForObjectDetection, SamModel, SamProcessor

        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(
            "Loading local model bundle: grounding=%s sam=%s device=%s cache=%s",
            settings.grounding_dino_model_id,
            settings.sam_model_id,
            device,
            cache_path,
        )
        grounding_processor = self._from_pretrained(AutoProcessor, settings.grounding_dino_model_id, cache_path)
        grounding_model = self._from_pretrained(GroundingDinoForObjectDetection, settings.grounding_dino_model_id, cache_path).to(device)
        grounding_model.eval()
        sam_processor = self._from_pretrained(SamProcessor, settings.sam_model_id, cache_path)
        sam_model = self._from_pretrained(SamModel, settings.sam_model_id, cache_path).to(device)
        sam_model.eval()
        self._model_bundle = {
            "device": device,
            "grounding_processor": grounding_processor,
            "grounding_model": grounding_model,
            "sam_processor": sam_processor,
            "sam_model": sam_model,
        }
        logger.info("Model bundle loaded in %.1fs", time.perf_counter() - started)
        return self._model_bundle

    def _from_pretrained(self, cls, model_id: str, cache_path: Path):
        try:
            logger.info("Loading %s from local cache", model_id)
            return cls.from_pretrained(model_id, cache_dir=str(cache_path), local_files_only=True)
        except Exception:
            logger.info("Local cache incomplete for %s; attempting download", model_id)
            return cls.from_pretrained(model_id, cache_dir=str(cache_path))

    def _grounding_results_to_detections(self, results: dict, prompt_labels: list[str], width: int, height: int, offset_x: int = 0, offset_y: int = 0) -> list[dict]:
        boxes = results.get("boxes", [])
        scores = results.get("scores", [])
        labels = results.get("labels", [])
        detections: list[dict] = []
        for index, box in enumerate(boxes):
            raw_label = str(labels[index]).lower() if index < len(labels) else "feature"
            label = self._normalize_label(raw_label, prompt_labels)
            score = float(scores[index].detach().cpu().item() if hasattr(scores[index], "detach") else scores[index])
            x1, y1, x2, y2 = [float(value) for value in box.detach().cpu().tolist()]
            x1 = max(0, min(width - 1, x1))
            y1 = max(0, min(height - 1, y1))
            x2 = max(x1 + 1, min(width, x2))
            y2 = max(y1 + 1, min(height, y2))
            w = int(round(x2 - x1))
            h = int(round(y2 - y1))
            detections.append(
                {
                    "id": uuid4().hex,
                    "label": label,
                    "confidence": round(score, 3),
                    "bbox": [int(round(x1 + offset_x)), int(round(y1 + offset_y)), w, h],
                    "area_px": int(w * h),
                }
            )
        return sorted(detections, key=lambda item: item["confidence"], reverse=True)[:120]

    def _nms_detections(self, detections: list[dict], iou_threshold: float) -> list[dict]:
        kept: list[dict] = []
        for label in sorted({item["label"] for item in detections}):
            items = sorted([item for item in detections if item["label"] == label], key=lambda item: item["confidence"], reverse=True)
            while items:
                current = items.pop(0)
                kept.append(current)
                items = [item for item in items if self._bbox_iou(current["bbox"], item["bbox"]) < iou_threshold]
        return sorted(kept, key=lambda item: item["confidence"], reverse=True)[:120]

    def _bbox_iou(self, a: list[int], b: list[int]) -> float:
        ax1, ay1, aw, ah = a
        bx1, by1, bw, bh = b
        ax2, ay2 = ax1 + aw, ay1 + ah
        bx2, by2 = bx1 + bw, by1 + bh
        ix1, iy1 = max(ax1, bx1), max(ay1, by1)
        ix2, iy2 = min(ax2, bx2), min(ay2, by2)
        inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
        union = aw * ah + bw * bh - inter
        return inter / union if union else 0.0

    def _normalize_label(self, raw_label: str, prompt_labels: list[str]) -> str:
        raw = raw_label.lower().replace(".", " ").strip()
        for label in prompt_labels:
            if label in raw:
                return label
        if "tree" in raw or "grass" in raw or "green" in raw:
            return "vegetation"
        if "forest" in raw or "vegetation" in raw:
            return "vegetation"
        if "house" in raw or "roof" in raw:
            return "building"
        if "street" in raw or "highway" in raw:
            return "road"
        if "pavement" in raw or "asphalt" in raw:
            return "parking lot"
        if "field" in raw or "bare ground" in raw:
            return "open land"
        if "river" in raw or "lake" in raw or "pond" in raw:
            return "water"
        return prompt_labels[0] if prompt_labels[0] in raw else "open land"

    def _segment_boxes_with_sam(self, bundle: dict, image: Image.Image, detections: list[dict], width: int, height: int) -> dict[str, np.ndarray]:
        import torch

        labels = ["building", "road", "parking lot", "vegetation", "water", "open land"]
        masks = {label: np.zeros((height, width), dtype=np.uint8) for label in labels}
        boxes_xyxy = []
        for detection in detections:
            x, y, w, h = detection["bbox"]
            boxes_xyxy.append([x, y, x + w, y + h])

        with torch.inference_mode():
            inputs = bundle["sam_processor"](image, input_boxes=[boxes_xyxy], return_tensors="pt").to(bundle["device"])
            outputs = bundle["sam_model"](**inputs)
            processed = bundle["sam_processor"].image_processor.post_process_masks(
                outputs.pred_masks.detach().cpu(),
                inputs["original_sizes"].detach().cpu(),
                inputs["reshaped_input_sizes"].detach().cpu(),
            )[0]

        mask_array = processed.numpy()
        if mask_array.ndim == 4:
            mask_array = mask_array[:, 0]
        for detection, mask in zip(detections, mask_array):
            binary = (mask > 0).astype(np.uint8) * 255
            detection["area_px"] = int(np.count_nonzero(binary))
            masks[detection["label"]] = cv2.bitwise_or(masks[detection["label"]], binary)
        return masks

    def _stats_from_masks(self, masks: dict[str, np.ndarray], detections: list[dict], image_area: int) -> list[dict]:
        stats: list[dict] = []
        for label, mask in masks.items():
            label_detections = [item for item in detections if item["label"] == label]
            area_px = int(np.count_nonzero(mask))
            stats.append(
                {
                    "label": label,
                    "count": len(label_detections),
                    "area_px": area_px,
                    "coverage_pct": round((area_px / image_area) * 100, 2) if image_area else 0,
                    "mean_confidence": round(float(np.mean([item["confidence"] for item in label_detections])) if label_detections else 0.0, 3),
                }
            )
        return stats

    def _analyze_with_opencv(self, image_path: Path, mode: str) -> VisionResult:
        image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Could not read image.")
        height, width = image.shape[:2]
        masks = self._class_masks(image)
        detections: list[dict] = []
        class_stats: list[dict] = []

        min_area_by_label = {
            "building": max(18, int(width * height * 0.00008)),
            "road": max(90, int(width * height * 0.00035)),
            "parking lot": max(120, int(width * height * 0.00045)),
            "vegetation": max(80, int(width * height * 0.0003)),
            "water": max(110, int(width * height * 0.00035)),
            "open land": max(140, int(width * height * 0.0005)),
        }

        for label, mask in masks.items():
            components = self._components(mask, min_area=min_area_by_label[label], label=label)
            area_px = int(np.count_nonzero(mask))
            confidences: list[float] = []
            for bbox, component_area in components[:80]:
                confidence = self._confidence(label, component_area, width * height)
                confidences.append(confidence)
                detections.append(
                    {
                        "id": uuid4().hex,
                        "label": label,
                        "confidence": confidence,
                        "bbox": bbox,
                        "area_px": int(component_area),
                    }
                )
            class_stats.append(
                {
                    "label": label,
                    "count": len(components),
                    "area_px": area_px,
                    "coverage_pct": round((area_px / (width * height)) * 100, 2),
                    "mean_confidence": round(float(np.mean(confidences)) if confidences else 0.0, 3),
                }
            )

        detections.sort(key=lambda item: item["confidence"], reverse=True)
        return VisionResult(mode=mode, detections=detections, class_stats=class_stats, masks=masks)

    def render_artifacts(self, image_path: Path, result: VisionResult, output_dir: Path) -> dict[str, Path]:
        output_dir.mkdir(parents=True, exist_ok=True)
        image = Image.open(image_path).convert("RGBA")
        overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))

        for label, mask in result.masks.items():
            color = CLASS_COLORS[label]
            alpha = 95 if label in {"building", "vegetation", "water"} else 70
            mask_img = Image.fromarray((mask > 0).astype(np.uint8) * alpha, mode="L").resize(image.size)
            class_layer = Image.new("RGBA", image.size, (*color, 0))
            class_layer.putalpha(mask_img)
            overlay = Image.alpha_composite(overlay, class_layer)

        mask_overlay = Image.alpha_composite(image, overlay)
        draw = ImageDraw.Draw(mask_overlay)
        for detection in result.detections[:80]:
            x, y, w, h = detection["bbox"]
            color = CLASS_COLORS.get(detection["label"], (232, 163, 61))
            draw.rectangle((x, y, x + w, y + h), outline=(*color, 255), width=2)
            if w * h > 900:
                draw.text((x + 4, max(0, y - 16)), f"{detection['label']} {detection['confidence']:.2f}", fill=(*color, 255))

        annotated_path = output_dir / "annotated.png"
        mask_path = output_dir / "mask_overlay.png"
        npz_path = output_dir / "masks.npz"
        mask_overlay.convert("RGB").save(annotated_path)
        Image.alpha_composite(image, overlay).convert("RGB").save(mask_path)
        np.savez_compressed(npz_path, **{label.replace(" ", "_"): mask for label, mask in result.masks.items()})
        return {"annotated": annotated_path, "mask_overlay": mask_path, "masks": npz_path}

    def _class_masks(self, image: np.ndarray) -> dict[str, np.ndarray]:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        sat = hsv[:, :, 1]
        val = hsv[:, :, 2]
        hue = hsv[:, :, 0]
        blue, green, red = cv2.split(image)

        vegetation = cv2.bitwise_or(cv2.inRange(hsv, (35, 35, 35), (95, 255, 255)), cv2.inRange(hsv, (30, 20, 80), (85, 120, 245)))
        water = cv2.bitwise_or(cv2.inRange(hsv, (88, 28, 35), (130, 255, 225)), cv2.inRange(hsv, (95, 8, 80), (130, 120, 230)))

        map_building = cv2.bitwise_and(cv2.inRange(hue, 82, 112), cv2.inRange(sat, 8, 80))
        map_building = cv2.bitwise_and(map_building, cv2.inRange(val, 120, 245))
        map_building = cv2.bitwise_and(map_building, ((blue.astype(np.int16) - red.astype(np.int16)) > 6).astype(np.uint8) * 255)

        bright_roof = cv2.bitwise_and(cv2.inRange(sat, 0, 75), cv2.inRange(val, 125, 245))
        bright_roof = cv2.bitwise_and(bright_roof, cv2.bitwise_not(cv2.bitwise_or(vegetation, water)))
        building = cv2.bitwise_or(map_building, self._rectangular_regions(bright_roof, min_fill=0.48, max_area_ratio=0.035))
        water = cv2.bitwise_and(water, cv2.bitwise_not(building))

        yellow_roads = cv2.bitwise_and(cv2.inRange(hue, 12, 35), cv2.inRange(sat, 55, 180))
        yellow_roads = cv2.bitwise_and(yellow_roads, cv2.inRange(val, 115, 255))
        light_roads = cv2.bitwise_and(cv2.inRange(sat, 0, 24), cv2.inRange(val, 180, 255))
        road = cv2.bitwise_or(yellow_roads, self._linear_regions(light_roads))
        road = cv2.bitwise_and(road, cv2.bitwise_not(building))

        gray_paved = cv2.bitwise_and(cv2.inRange(sat, 0, 55), cv2.inRange(val, 85, 210))
        parking = self._rectangular_regions(cv2.bitwise_and(gray_paved, cv2.bitwise_not(cv2.bitwise_or(road, building))), min_fill=0.55, max_area_ratio=0.08)

        known = cv2.bitwise_or(cv2.bitwise_or(vegetation, water), cv2.bitwise_or(road, cv2.bitwise_or(parking, building)))
        open_land = cv2.bitwise_and(cv2.inRange(sat, 18, 135), cv2.inRange(val, 70, 230))
        open_land = cv2.bitwise_and(open_land, cv2.bitwise_not(known))

        masks = {
            "building": building,
            "road": road,
            "parking lot": parking,
            "vegetation": vegetation,
            "water": water,
            "open land": open_land,
        }
        return {
            "building": self._clean(building, kernel_size=3),
            "road": self._clean(road, kernel_size=3),
            "parking lot": self._clean(parking, kernel_size=5),
            "vegetation": self._clean(vegetation, kernel_size=5),
            "water": self._clean(water, kernel_size=5),
            "open land": self._clean(open_land, kernel_size=7),
        }

    def _clean(self, mask: np.ndarray, kernel_size: int = 5) -> np.ndarray:
        kernel = np.ones((kernel_size, kernel_size), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        return (mask > 0).astype(np.uint8) * 255

    def _rectangular_regions(self, mask: np.ndarray, min_fill: float, max_area_ratio: float) -> np.ndarray:
        output = np.zeros_like(mask)
        image_area = mask.shape[0] * mask.shape[1]
        contours, _ = cv2.findContours((mask > 0).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 18 or area > image_area * max_area_ratio:
                continue
            x, y, w, h = cv2.boundingRect(contour)
            if w < 4 or h < 4:
                continue
            fill = area / max(1, w * h)
            aspect = max(w / h, h / w)
            if fill >= min_fill and aspect <= 8:
                cv2.drawContours(output, [contour], -1, 255, thickness=cv2.FILLED)
        return output

    def _linear_regions(self, mask: np.ndarray) -> np.ndarray:
        output = np.zeros_like(mask)
        contours, _ = cv2.findContours((mask > 0).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 40:
                continue
            x, y, w, h = cv2.boundingRect(contour)
            aspect = max(w / max(1, h), h / max(1, w))
            if aspect >= 3:
                cv2.drawContours(output, [contour], -1, 255, thickness=cv2.FILLED)
        return output

    def _components(self, mask: np.ndarray, min_area: int, label: str) -> list[tuple[list[int], int]]:
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        components: list[tuple[list[int], int]] = []
        image_area = mask.shape[0] * mask.shape[1]
        for contour in contours:
            area = int(cv2.contourArea(contour))
            if area < min_area:
                continue
            x, y, w, h = cv2.boundingRect(contour)
            if label == "building":
                fill = area / max(1, w * h)
                aspect = max(w / max(1, h), h / max(1, w))
                if fill < 0.35 or aspect > 10 or area > image_area * 0.04:
                    continue
            if label in {"road", "parking lot"} and area > image_area * 0.35:
                continue
            components.append(([int(x), int(y), int(w), int(h)], area))
        return sorted(components, key=lambda item: item[1], reverse=True)

    def _confidence(self, label: str, area: int, image_area: int) -> float:
        base = {
            "vegetation": 0.72,
            "water": 0.7,
            "road": 0.58,
            "parking lot": 0.54,
            "building": 0.5,
            "open land": 0.48,
        }[label]
        area_bonus = min(0.2, max(0.0, area / image_area * 8))
        return round(min(0.92, base + area_bonus), 3)


vision_pipeline = GroundedSamPipeline()
