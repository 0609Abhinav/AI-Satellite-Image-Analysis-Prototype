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
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ImageIcon from "@mui/icons-material/Image";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import MyLocationIcon from "@mui/icons-material/MyLocation";

import { assetUrl, fetchSatelliteImage, uploadImage } from "../api/client";
import type { UploadedImage } from "../types/api";

type UploadPageProps = {
  images: UploadedImage[];
  selectedImageId: string;
  onSelectImage: (imageId: string) => void;
  onUploaded: (image: UploadedImage) => void;
  onNext: () => void;
};

export function UploadPage({
  images,
  selectedImageId,
  onSelectImage,
  onUploaded,
  onNext,
}: UploadPageProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Working...");
  const [error, setError] = useState<string | null>(null);
  const [lat, setLat] = useState("26.8467° N");
  const [lng, setLng] = useState("80.9462° E");
  const [zoom, setZoom] = useState(18);
  const [size, setSize] = useState(1024);
  const [dateMode, setDateMode] = useState<"today" | "historical">("today");
  const [captureDate, setCaptureDate] = useState(today);
  const [previewImage, setPreviewImage] = useState<UploadedImage | null>(images[0] ?? null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    setBusy(true);
    setBusyLabel("Uploading image...");
    setError(null);

    try {
      const uploaded = await uploadImage(file);
      onUploaded(uploaded);
      onSelectImage(uploaded.id);
      setPreviewImage(uploaded);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const handleFetchSatellite = async () => {
    const signedLat = parseCoordinate(lat, "lat");
    const signedLng = parseCoordinate(lng, "lng");
    if (signedLat === null || signedLng === null) {
      setError("Enter coordinates like 26.8466° N and 80.9462° E.");
      return;
    }

    setBusy(true);
    setBusyLabel("Fetching clean satellite imagery...");
    setError(null);

    try {
      const fetched = await fetchSatelliteImage({
        lat: signedLat,
        lng: signedLng,
        zoom,
        size,
        provider: "esri",
        capture_date: dateMode === "today" ? today : captureDate,
      });
      setPreviewImage(fetched);
      onSelectImage(fetched.id);
      onUploaded(fetched);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Satellite imagery fetch failed");
    } finally {
      setBusy(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Current location is not supported by this browser.");
      return;
    }
    setBusy(true);
    setBusyLabel("Reading current location...");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLat(formatCoordinate(latitude, "lat"));
        setLng(formatCoordinate(longitude, "lng"));
        setBusy(false);
      },
      (geoError) => {
        setError(geoError.message || "Could not read current location.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const handlePreviewSelect = (image: UploadedImage) => {
    setPreviewImage(image);
    onSelectImage(image.id);
  };

  useEffect(() => {
    const selected = images.find((image) => image.id === selectedImageId);
    if (selected && selected.id !== previewImage?.id) {
      setPreviewImage(selected);
      return;
    }

    if (!selectedImageId && !previewImage && images[0]) {
      setPreviewImage(images[0]);
    }
  }, [images, previewImage, selectedImageId]);

  const selectedPreviewImage =
    images.find((image) => image.id === previewImage?.id) ?? previewImage;

  const activeImageId = selectedImageId || selectedPreviewImage?.id || "";

  return (
    <main className="page">
      <Stack spacing={3} className="fadeUp">
        <Box>
          <Typography
            variant="overline"
            className="eyebrow"
          >
            INGEST
          </Typography>

          <Typography
            variant="h2"
            className="pageTitle"
          >
            Upload satellite or aerial imagery
          </Typography>

          <Typography className="pageSubtitle">
            Fetch clean satellite imagery by coordinates, or add PNG/JPG imagery manually as a fallback.
          </Typography>
        </Box>

        <Box className="controlPanel">
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, color: "#f8fafc" }}>
                  Clean Satellite Fetch
                </Typography>
                <Typography sx={{ mt: 0.5, color: "#94a3b8", fontSize: 14 }}>
                  Esri World Imagery, no browser UI, labels, pins, or watermarks.
                </Typography>
              </Box>
              <Chip label="Recommended" className="statusChip" />
            </Stack>

            <Box className="fetchGrid">
              <TextField
                label="Latitude"
                value={lat}
                onChange={(event) => setLat(event.target.value)}
                helperText="Example: 26.8466° N"
                className="darkField"
              />
              <TextField
                label="Longitude"
                value={lng}
                onChange={(event) => setLng(event.target.value)}
                helperText="Example: 80.9462° E"
                className="darkField"
              />
              <TextField
                select
                label="Zoom"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="darkField"
              >
                {[15, 16, 17, 18, 19].map((value) => (
                  <MenuItem key={value} value={value}>
                    {value}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Size"
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
                className="darkField"
              >
                {[512, 768, 1024, 1280].map((value) => (
                  <MenuItem key={value} value={value}>
                    {value}px
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Date"
                value={dateMode}
                onChange={(event) => {
                  const mode = event.target.value as "today" | "historical";
                  setDateMode(mode);
                  if (mode === "today") {
                    setCaptureDate(today);
                  }
                }}
                className="darkField"
              >
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="historical">Old Date</MenuItem>
              </TextField>
              <TextField
                label="Capture Date"
                type="date"
                value={captureDate}
                onChange={(event) => setCaptureDate(event.target.value)}
                disabled={dateMode === "today"}
                className="darkField"
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            <Button
              variant="contained"
              disabled={busy}
              startIcon={<TravelExploreIcon />}
              className="missionButton missionButtonPrimary"
              onClick={handleFetchSatellite}
            >
              Fetch Satellite Tile
            </Button>

            <Button
              variant="outlined"
              disabled={busy}
              startIcon={<MyLocationIcon />}
              className="missionButton missionButtonOutline"
              onClick={useCurrentLocation}
            >
              Use Current Location
            </Button>
          </Stack>
        </Box>

        {selectedPreviewImage ? (
          <Box className="controlPanel">
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: "#f8fafc" }}>
                    Satellite Preview
                  </Typography>
                  <Typography sx={{ mt: 0.4, color: "#94a3b8", fontSize: 14 }}>
                    {selectedPreviewImage.source_note || selectedPreviewImage.original_name}
                  </Typography>
                </Box>
                <Chip
                  label={selectedPreviewImage.capture_date || "undated"}
                  className="statusChip statusChipBlue"
                />
              </Stack>
              <Box className="satellitePreview">
                <img src={assetUrl(selectedPreviewImage.url)} alt={selectedPreviewImage.original_name} />
              </Box>
            </Stack>
          </Box>
        ) : null}

        <Box
          className={`uploadZone ${busy ? "busyPanel" : ""}`}
        >
          <Box className="uploadIcon">
            <CloudUploadIcon sx={{ fontSize: 42, color: "#2dd4bf" }} />
          </Box>

          <Typography variant="h5" sx={{ zIndex: 1, fontWeight: 900, color: "#f8fafc" }}>
            Manual Upload 
          </Typography>

          <Typography
            sx={{
              zIndex: 1,
              mt: 1,
              mb: 3,
              maxWidth: 560,
              color: "#b6c5d3",
            }}
          >
            Avoid browser map screenshots here; use real aerial/satellite imagery when possible.
          </Typography>

          <Button
            component="label"
            variant="contained"
            disabled={busy}
            startIcon={<CloudUploadIcon />}
            className="missionButton missionButtonPrimary uploadButton"
          >
            {busy ? busyLabel : "Select Image"}
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </Button>
        </Box>

        {busy && (
          <Box className="progressBox">
            <LinearProgress className="missionProgress" />
            <Typography className="mono" sx={{ mt: 1, color: "#cbd5e1", fontSize: 13 }}>
              {busyLabel}
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ borderRadius: 3 }}>
            {error}
          </Alert>
        )}

        <Box
          className="controlPanel"
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ fontWeight: 900, color: "#f8fafc" }}>
              Uploaded Images
            </Typography>

            <Chip
              label={`${images.length} uploaded`}
              size="small"
              sx={{
                color: images.length ? "#022c22" : "#94a3b8",
                bgcolor: images.length ? "#2dd4bf" : "rgba(148,163,184,0.12)",
                fontWeight: 800,
              }}
            />
          </Stack>

          <Stack spacing={1.5} mt={2}>
            {images.length === 0 && (
              <Typography sx={{ color: "#94a3b8" }}>
                No images uploaded yet.
              </Typography>
            )}

            {images.map((image, index) => (
              <Box
                className={`detectionRow uploadRow ${activeImageId === image.id ? "uploadRowActive" : ""}`}
                key={image.id}
                sx={{
                  alignItems: "center",
                  animationDelay: `${index * 0.05}s`,
                }}
                role="button"
                tabIndex={0}
                onClick={() => handlePreviewSelect(image)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handlePreviewSelect(image);
                  }
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: "14px",
                      display: "grid",
                      placeItems: "center",
                      bgcolor: "rgba(45, 212, 191, 0.14)",
                      color: "#2dd4bf",
                    }}
                  >
                    <ImageIcon fontSize="small" />
                  </Box>

                  <Typography sx={{ fontWeight: 800, color: "#f8fafc" }}>
                    {image.original_name}
                  </Typography>
                  <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>
                    {[image.capture_date, image.source_provider].filter(Boolean).join(" / ") || "manual upload"}
                  </Typography>
                </Stack>

                <Typography
                  className="mono"
                  sx={{
                    fontFamily: "IBM Plex Mono, monospace",
                    fontSize: 13,
                    px: 1.5,
                    py: 0.6,
                    borderRadius: 999,
                    bgcolor: "rgba(255,255,255,0.08)",
                    color: "#cbd5e1",
                  }}
                >
                  {image.width}x{image.height}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Button
          variant="outlined"
          endIcon={<ArrowForwardIcon />}
          onClick={onNext}
          disabled={images.length === 0}
          className="missionButton missionButtonOutline"
        >
          Analyze Latest Upload
        </Button>
      </Stack>
    </main>
  );
}

function parseCoordinate(value: string, axis: "lat" | "lng") {
  const cleaned = value.trim().toUpperCase().replace(/,/g, ".").replace(/°/g, " ");
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  if (!Number.isFinite(numeric)) return null;
  const direction = cleaned.match(/[NSEW]/)?.[0];
  const signed = direction === "S" || direction === "W" ? -Math.abs(numeric) : Math.abs(numeric);
  const limit = axis === "lat" ? 85 : 180;
  return Math.abs(signed) <= limit ? signed : null;
}

function formatCoordinate(value: number, axis: "lat" | "lng") {
  const direction = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(6)}° ${direction}`;
}
