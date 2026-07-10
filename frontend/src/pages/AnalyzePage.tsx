import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";

import { analyzeImage, assetUrl } from "../api/client";
import type { AnalysisResult, Detection, UploadedImage } from "../types/api";

type AnalyzePageProps = {
  images: UploadedImage[];
  analyses: AnalysisResult[];
  selectedImageId: string;
  onSelectImage: (imageId: string) => void;
  onAnalyzed: (analysis: AnalysisResult) => void;
  onNext: () => void;
};

export function AnalyzePage({
  images,
  analyses,
  selectedImageId,
  onSelectImage,
  onAnalyzed,
  onNext,
}: AnalyzePageProps) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const selected = images.find((image) => image.id === selectedImageId) ?? images[0];
  const analysis = analyses.find((item) => item.image_id === selected?.id);
  const annotated = analysis?.artifacts.find((item) => item.kind === "annotated");
  const displayedImage = annotated?.url ?? selected?.url;
  const locatedDetections = analysis?.detections ?? [];
  const buildingDetections = locatedDetections.filter(
    (detection) => detection.label === "building"
  );

  useEffect(() => {
    if (selectedImageId && images.some((image) => image.id === selectedImageId)) {
      return;
    }

    if (images[0]?.id) {
      onSelectImage(images[0].id);
    }
  }, [images, onSelectImage, selectedImageId]);

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
      <Stack spacing={3} className="fadeUp">
        <Box>
          <Typography
            variant="overline"
            className="eyebrow"
          >
            ANALYZE
          </Typography>

          <Typography
            variant="h2"
            className="pageTitle"
          >
            Detection and segmentation overlay
          </Typography>

          <Typography className="pageSubtitle">
            Run object detection and segmentation to locate buildings, roads,
            vegetation, water, and other visible features.
          </Typography>
        </Box>

        <Box
          className="toolGridWide"
        >
          <Box
            className={`imagePanel locatorPanel ${busy ? "busyPanel" : ""}`}
          >
            {displayedImage && selected ? (
              <Box
                className="imageLocator"
                sx={{
                  aspectRatio: `${selected.width} / ${selected.height}`,
                  width: `min(100%, calc(72vh * ${selected.width / selected.height}))`,
                  mx: "auto",
                }}
              >
                <img
                  src={assetUrl(displayedImage)}
                  alt={
                    annotated
                      ? "Annotated analysis result"
                      : selected.original_name
                  }
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                  }}
                />

                {analysis ? (
                  <DetectionOverlay
                    detections={locatedDetections}
                    width={selected.width}
                    height={selected.height}
                  />
                ) : null}

                {busy ? (
                  <Box className="scanOverlay" />
                ) : null}

                {analysis ? (
                  <Box
                    className="locatorLegend locatorLegendFloating"
                  >
                    <LegendItem color="#E8A33D" label="Building" />
                    <LegendItem color="#8CA0B8" label="Road" />
                    <LegendItem color="#3FA7A0" label="Other feature" />
                  </Box>
                ) : null}
              </Box>
            ) : (
              <Stack
                alignItems="center"
                justifyContent="center"
                spacing={2}
                className="emptyState"
              >
                <ImageSearchIcon className="inlineIconLarge" />
                <Typography>No image selected.</Typography>
              </Stack>
            )}
          </Box>

          <Box className="controlPanel">
            <Stack spacing={2.2}>
              <TextField
                select
                label="Image"
                value={selected?.id ?? ""}
                onChange={(event) => onSelectImage(event.target.value)}
                className="darkField"
              >
                {images.map((image) => (
                  <MenuItem key={image.id} value={image.id}>
                    {image.original_name}
                  </MenuItem>
                ))}
              </TextField>

              <Button
                variant="contained"
                startIcon={<AnalyticsIcon />}
                onClick={run}
                disabled={!selected || busy}
                className="missionButton missionButtonPrimary"
              >
                Run Selected
              </Button>

              <Button
                variant="outlined"
                startIcon={<AnalyticsIcon />}
                onClick={runAll}
                disabled={images.length === 0 || busy}
                className="missionButton missionButtonOutline"
              >
                Analyze All Uploads
              </Button>

              {busy ? (
                <Box className="progressBox">
                  <LinearProgress
                    className="missionProgress"
                  />

                  <Typography
                    className="mono"
                    sx={{
                      mt: 1.5,
                      color: "#cbd5e1",
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: 13,
                    }}
                  >
                    {progress} / real Grounding DINO + SAM on CPU / {elapsed}s
                    elapsed
                  </Typography>

                  <Typography sx={{ mt: 1, color: "#94a3b8", fontSize: 14 }}>
                    First run loads local model weights and can take several
                    minutes. The backend terminal will now print each inference
                    stage.
                  </Typography>
                </Box>
              ) : null}

              {error ? (
                <Alert severity="error" sx={{ borderRadius: 3 }}>
                  {error}
                </Alert>
              ) : null}

              {analysis ? (
                <>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      label={`MODE ${analysis.mode.toUpperCase()}`}
                      className="statusChip"
                    />
                    <Chip
                      label={`${locatedDetections.length} detections`}
                      className="statusChip statusChipBlue"
                    />
                    <Chip
                      label={`${buildingDetections.length} buildings`}
                      className="statusChip statusChipAmber"
                    />
                  </Stack>

                  {analysis.quality_notes.map((note) => (
                    <Alert severity="warning" key={note} sx={{ borderRadius: 3 }}>
                      {note}
                    </Alert>
                  ))}

                  <Box>
                    <Typography
                      variant="h6"
                      sx={{ color: "#f8fafc", fontWeight: 900, mb: 1 }}
                    >
                      Class Summary
                    </Typography>

                    <Stack spacing={1}>
                      {analysis.class_stats.map((stat) => (
                        <Box
                          className="summaryRow"
                          key={stat.label}
                        >
                          <Typography sx={{ color: "#f8fafc", fontWeight: 800 }}>
                            {stat.label}
                          </Typography>
                          <Typography
                            className="mono"
                            sx={{
                              color: "#2dd4bf",
                              fontFamily: "IBM Plex Mono, monospace",
                              fontSize: 13,
                            }}
                          >
                            {stat.count} / {stat.coverage_pct}%
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>

                  <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 900 }}>
                    Detected Locations
                  </Typography>

                  {buildingDetections.length === 0 ? (
                    <Alert severity="warning" sx={{ borderRadius: 3 }}>
                      No building boxes were returned by Grounding DINO for this
                      image. Try a clearer satellite/aerial image instead of a
                      weather/map tile, or lower model thresholds in `.env`.
                    </Alert>
                  ) : null}

                  <Box
                    className="detectionList"
                  >
                    {locatedDetections.slice(0, 16).map((detection, index) => (
                      <DetectionRow
                        key={detection.id}
                        detection={detection}
                        index={index}
                      />
                    ))}
                  </Box>

                  <Typography sx={{ color: "#94a3b8", lineHeight: 1.7 }}>
                    {analysis.summary}
                  </Typography>
                </>
              ) : (
                <Box className="infoBox">
                  <Typography sx={{ color: "#cbd5e1", fontWeight: 800 }}>
                    Ready to analyze
                  </Typography>
                  <Typography sx={{ mt: 0.8, color: "#94a3b8", fontSize: 14 }}>
                    Select an uploaded image and run detection to generate
                    overlays, class statistics, and detected object locations.
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>
        </Box>

        <Button
          variant="outlined"
          endIcon={<ArrowForwardIcon />}
          onClick={onNext}
          disabled={!analysis}
          className="missionButton missionButtonOutline"
        >
          View Results
        </Button>
      </Stack>
    </main>
  );
}

function DetectionOverlay({
  detections,
  width,
  height,
}: {
  detections: Detection[];
  width: number;
  height: number;
}) {
  return (
    <svg
      className="detectionOverlay"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      {detections.slice(0, 60).map((detection, index) => {
        const [rawX, rawY, rawW, rawH] = detection.bbox;
        const x = Math.max(0, Math.min(width - 1, rawX));
        const y = Math.max(0, Math.min(height - 1, rawY));
        const w = Math.max(1, Math.min(width - x, rawW));
        const h = Math.max(1, Math.min(height - y, rawH));
        const color = detectionColor(detection.label);

        return (
          <g key={detection.id}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill="none"
              stroke={color}
              strokeWidth={Math.max(2, width / 360)}
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={x}
              y={Math.max(0, y - 20)}
              width={Math.max(42, `${detection.label} ${index + 1}`.length * 7)}
              height={18}
              fill={color}
              opacity="0.95"
              rx="3"
            />
            <text
              x={x + 5}
              y={Math.max(13, y - 7)}
              fill="#020617"
              fontSize="12"
              fontWeight="800"
            >
              {detection.label === "building"
                ? `B${buildingIndex(detections, index)}`
                : `${detection.label.slice(0, 1).toUpperCase()}${index + 1}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DetectionRow({
  detection,
  index,
}: {
  detection: Detection;
  index: number;
}) {
  const [x, y, w, h] = detection.bbox;
  const cx = Math.round(x + w / 2);
  const cy = Math.round(y + h / 2);
  const label =
    detection.label === "building"
      ? `Building ${index + 1}`
      : `${detection.label} ${index + 1}`;

  return (
    <Box
      className="detectionRow"
    >
      <Box>
        <Typography sx={{ fontWeight: 900, color: "#f8fafc" }}>
          {label}
        </Typography>
        <Typography
          className="mono"
          sx={{
            mt: 0.4,
            color: "#94a3b8",
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 12,
          }}
        >
          center x:{cx} y:{cy} / box {x},{y},{w},{h}
        </Typography>
      </Box>

      <Box textAlign="right">
        <Typography
          className="mono"
          sx={{
            color: "#2dd4bf",
            fontFamily: "IBM Plex Mono, monospace",
            fontWeight: 900,
          }}
        >
          {Math.round(detection.confidence * 100)}%
        </Typography>
        <Typography
          className="mono"
          sx={{
            color: "#94a3b8",
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 12,
          }}
        >
          {detection.area_px.toLocaleString()} px
        </Typography>
      </Box>
    </Box>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.8,
        color: "#e2e8f0",
        fontSize: 13,
        fontWeight: 800,
        px: 1,
        py: 0.6,
      }}
    >
      <Box
        component="i"
        sx={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          bgcolor: color,
          boxShadow: `0 0 14px ${color}`,
        }}
      />
      {label}
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
  return detections
    .slice(0, index + 1)
    .filter((detection) => detection.label === "building").length;
}
