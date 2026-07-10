import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ImageIcon from "@mui/icons-material/Image";

import { uploadImage } from "../api/client";
import type { UploadedImage } from "../types/api";

type UploadPageProps = {
  images: UploadedImage[];
  onUploaded: (image: UploadedImage) => void;
  onNext: () => void;
};

export function UploadPage({ images, onUploaded, onNext }: UploadPageProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    setBusy(true);
    setError(null);

    try {
      onUploaded(await uploadImage(file));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Upload failed");
    } finally {
      setBusy(false);
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
            INGEST
          </Typography>

          <Typography
            variant="h2"
            className="pageTitle"
          >
            Upload satellite or aerial imagery
          </Typography>

          <Typography className="pageSubtitle">
            Add PNG, JPG, or JPEG imagery to begin visual analysis.
          </Typography>
        </Box>

        <Box
          className={`uploadZone ${busy ? "busyPanel" : ""}`}
        >
          <Box className="uploadIcon">
            <CloudUploadIcon sx={{ fontSize: 42, color: "#2dd4bf" }} />
          </Box>

          <Typography variant="h5" sx={{ zIndex: 1, fontWeight: 900, color: "#f8fafc" }}>
            PNG, JPG, or JPEG
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
            GeoTIFF is intentionally skipped for this PoC until geo-tagged
            samples are available.
          </Typography>

          <Button
            component="label"
            variant="contained"
            disabled={busy}
            startIcon={<CloudUploadIcon />}
            className="missionButton missionButtonPrimary uploadButton"
          >
            {busy ? "Uploading..." : "Select Image"}
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </Button>
        </Box>

        {busy && (
          <LinearProgress
            className="missionProgress"
          />
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
                className="detectionRow"
                key={image.id}
                sx={{
                  alignItems: "center",
                  animationDelay: `${index * 0.05}s`,
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
