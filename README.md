# AI-Powered Satellite/Aerial Image Analysis PoC

Local proof of concept for satellite/aerial image upload, analysis, comparison, and export.

## Status

Built:
- FastAPI backend with upload, analysis, compare, health, local static artifacts, SQLite metadata, and local config
- React + TypeScript + Material UI frontend with Landing, Upload, Analyze, Compare, and Results/Export views
- Mission-control dark theme using the requested palette and typography stack
- Rotating `react-globe.gl` landing hero using an embedded local globe texture
- Real local Grounding DINO + Segment Anything model inference with annotated overlays and mask artifacts
- OpenCV fallback is retained only for troubleshooting if model loading fails in local mode
- Mask-diff compare workflow with Shapely area estimates, JSON export, and simple PDF report
- Ollama summary integration with a deterministic local fallback if Ollama is not running

Important implementation note:
- The default backend is now `MODEL_BACKEND=grounded_sam`, using `IDEA-Research/grounding-dino-tiny` for open-vocabulary detection and `facebook/sam-vit-base` for local segmentation masks. This installed Transformers build does not expose `Sam2Model`, so the current real local implementation uses SAM rather than SAM2.
- Model files are cached locally under `models/cache`. First analysis is slow because weights load into memory; CPU inference can take minutes per image.

## Run Backend

```bash
cd backend
source ../.venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the backend at `http://127.0.0.1:8000` unless `VITE_API_BASE_URL` is set.

## API Endpoints

### `GET /health`

Returns backend status and configured storage paths.

Response:

```json
{
  "status": "ok",
  "service": "satellite-analysis-poc",
  "version": "0.1.0",
  "uploads_dir": ".../uploads",
  "results_dir": ".../results"
}
```

### `POST /upload`

Multipart form upload with field name `file`. Accepts PNG/JPG/JPEG.

Response:

```json
{
  "image": {
    "id": "image-id",
    "original_name": "sample.png",
    "width": 1024,
    "height": 768,
    "url": "/uploads/image-id.png"
  }
}
```

### `POST /analyze/{image_id}`

Runs local Grounding DINO detection and SAM segmentation for one uploaded image. CPU-heavy model work runs in worker threads so the FastAPI event loop stays responsive.

Response includes:
- `detections`: label, confidence, bounding box, area
- `class_stats`: count and coverage percentage per class
- `artifacts`: annotated image, mask overlay, JSON report
- `summary`: Ollama-generated text or local fallback text

### `GET /analysis/{image_id}`

Returns the latest analysis result for an uploaded image.

### `POST /compare`

Body:

```json
{
  "before_image_id": "before-id",
  "after_image_id": "after-id"
}
```

Runs analysis for either image if needed, diffs class masks, and returns:
- changed regions with `new` or `removed` labels
- rough area estimates
- difference overlay image
- JSON and PDF report artifacts
- Ollama-generated or fallback summary

## Accuracy And Limitations

The current runnable AI pipeline uses real open-source local models, but it is still zero-shot. Grounding DINO may miss small buildings, confuse map tiles with aerial imagery, or under-detect features if prompts do not match the visual style. SAM produces masks from detected boxes; if detection misses an object, segmentation will not recover it.

To make the AI path production-grade, add GPU inference, SAM2 support in an environment that provides it, calibrated thresholds per imagery source, real geospatial handling, task queues, auth/multi-tenancy, cloud/object storage, and labeled evaluation data.
