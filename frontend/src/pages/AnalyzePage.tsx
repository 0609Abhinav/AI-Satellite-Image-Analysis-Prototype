import { useEffect, useState } from "react";
import { Alert, Box, Button, LinearProgress, MenuItem, Stack, TextField, Typography } from "@mui/material";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import { analyzeImage, assetUrl } from "../api/client";
import type { AnalysisResult, Detection, UploadedImage } from "../types/api";

type AnalyzePageProps = {
  images: UploadedImage[];
  analyses: AnalysisResult[];
  onAnalyzed: (analysis: AnalysisResult) => void;
  onNext: () => void;
};

export function AnalyzePage({ images, analyses, onAnalyzed, onNext }: AnalyzePageProps) {
  const [imageId, setImageId] = useState(images[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const selected = images.find((image) => image.id === imageId) ?? images[0];
  const analysis = analyses.find((item) => item.image_id === selected?.id);
  const annotated = analysis?.artifacts.find((item) => item.kind === "annotated");
  const displayedImage = annotated?.url ?? selected?.url;
  const locatedDetections = analysis?.detections ?? [];
  const buildingDetections = locatedDetections.filter((detection) => detection.label === "building");

  useEffect(() => {
    if (!imageId && images[0]?.id) {
      setImageId(images[0].id);
    }
  }, [imageId, images]);

  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  const run = async () => {
    if (!selected) return;
    setBusy(true);
    setProgress(`Analyzing ${selected.original_name}`);
    setError(null);
    try {
      onAnalyzed(await analyzeImage(selected.id));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Analysis failed");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const runAll = async () => {
    if (images.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const image of images) {
        setProgress(`Analyzing ${image.original_name}`);
        onAnalyzed(await analyzeImage(image.id));
      }
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Analysis failed");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <main className="page">
      <Stack spacing={3}>
        <Typography variant="overline" color="primary.main" fontFamily="IBM Plex Mono">ANALYZE</Typography>
        <Typography variant="h2">Detection and segmentation overlay</Typography>
        <Box className="toolGrid">
          <Box className="panel imagePanel locatorPanel">
            {displayedImage && selected ? (
              <Box className="imageLocator">
                <img src={assetUrl(displayedImage)} alt={annotated ? "Annotated analysis result" : selected.original_name} />
                {analysis ? <DetectionOverlay detections={locatedDetections} width={selected.width} height={selected.height} /> : null}
              </Box>
            ) : (
              <Typography>No image selected.</Typography>
            )}
            {analysis ? (
              <Box className="locatorLegend">
                <span><i className="legendSwatch buildingSwatch" /> Building</span>
                <span><i className="legendSwatch roadSwatch" /> Road</span>
                <span><i className="legendSwatch landSwatch" /> Other detected feature</span>
              </Box>
            ) : null}
          </Box>
          <Box className="panel">
            <Stack spacing={2}>
              <TextField select label="Image" value={selected?.id ?? ""} onChange={(event) => setImageId(event.target.value)}>
                {images.map((image) => <MenuItem key={image.id} value={image.id}>{image.original_name}</MenuItem>)}
              </TextField>
              <Button variant="contained" startIcon={<AnalyticsIcon />} onClick={run} disabled={!selected || busy}>Run Selected</Button>
              <Button variant="outlined" startIcon={<AnalyticsIcon />} onClick={runAll} disabled={images.length === 0 || busy}>Analyze All Uploads</Button>
              {busy ? (
                <>
                  <LinearProgress />
                  <Typography className="mono" color="text.secondary">
                    {progress} / real Grounding DINO + SAM on CPU / {elapsed}s elapsed
                  </Typography>
                  <Typography color="text.secondary">
                    First run loads local model weights and can take several minutes. The backend terminal will now print each inference stage.
                  </Typography>
                </>
              ) : null}
              {error ? <Alert severity="error">{error}</Alert> : null}
              {analysis ? (
                <>
                  <Typography className="mono" color="primary.main">MODE {analysis.mode.toUpperCase()}</Typography>
                  {analysis.quality_notes.map((note) => (
                    <Alert severity="warning" key={note}>{note}</Alert>
                  ))}
                  {analysis.class_stats.map((stat) => (
                    <Box className="row" key={stat.label}>
                      <span>{stat.label}</span>
                      <span className="mono">{stat.count} / {stat.coverage_pct}%</span>
                    </Box>
                  ))}
                  <Typography variant="h6">Detected Locations</Typography>
                  {buildingDetections.length === 0 ? (
                    <Alert severity="warning">
                      No building boxes were returned by Grounding DINO for this image. Try a clearer satellite/aerial image instead of a weather/map tile, or lower model thresholds in `.env`.
                    </Alert>
                  ) : null}
                  <Box className="detectionList">
                    {locatedDetections.slice(0, 16).map((detection, index) => (
                      <DetectionRow key={detection.id} detection={detection} index={index} />
                    ))}
                  </Box>
                  <Typography color="text.secondary">{analysis.summary}</Typography>
                </>
              ) : null}
            </Stack>
          </Box>
        </Box>
        <Button variant="outlined" endIcon={<ArrowForwardIcon />} onClick={onNext} disabled={!analysis}>
          View Results
        </Button>
      </Stack>
    </main>
  );
}

function DetectionOverlay({ detections, width, height }: { detections: Detection[]; width: number; height: number }) {
  return (
    <svg className="detectionOverlay" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {detections.slice(0, 60).map((detection, index) => {
        const [x, y, w, h] = detection.bbox;
        const color = detectionColor(detection.label);
        return (
          <g key={detection.id}>
            <rect x={x} y={y} width={w} height={h} fill="none" stroke={color} strokeWidth={Math.max(2, width / 360)} vectorEffect="non-scaling-stroke" />
            <rect x={x} y={Math.max(0, y - 20)} width={Math.max(42, `${detection.label} ${index + 1}`.length * 7)} height={18} fill={color} opacity="0.95" rx="3" />
            <text x={x + 5} y={Math.max(13, y - 7)} fill="#0B1220" fontSize="12" fontWeight="700">
              {detection.label === "building" ? `B${buildingIndex(detections, index)}` : `${detection.label.slice(0, 1).toUpperCase()}${index + 1}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DetectionRow({ detection, index }: { detection: Detection; index: number }) {
  const [x, y, w, h] = detection.bbox;
  const cx = Math.round(x + w / 2);
  const cy = Math.round(y + h / 2);
  const label = detection.label === "building" ? `Building ${index + 1}` : `${detection.label} ${index + 1}`;

  return (
    <Box className="detectionRow">
      <Box>
        <Typography fontWeight={700}>{label}</Typography>
        <Typography className="mono" color="text.secondary">
          center x:{cx} y:{cy} / box {x},{y},{w},{h}
        </Typography>
      </Box>
      <Box textAlign="right">
        <Typography className="mono" color="primary.main">{Math.round(detection.confidence * 100)}%</Typography>
        <Typography className="mono" color="text.secondary">{detection.area_px.toLocaleString()} px</Typography>
      </Box>
    </Box>
  );
}

function detectionColor(label: string) {
  if (label === "building") return "#E8A33D";
  if (label === "road") return "#8CA0B8";
  if (label === "vegetation") return "#3FA770";
  if (label === "water") return "#3F80A7";
  return "#3FA7A0";
}

function buildingIndex(detections: Detection[], index: number) {
  return detections.slice(0, index + 1).filter((detection) => detection.label === "building").length;
}
