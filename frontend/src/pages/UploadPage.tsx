import { useState } from "react";
import { Alert, Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

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
      <Stack spacing={3}>
        <Typography variant="overline" color="primary.main" fontFamily="IBM Plex Mono">INGEST</Typography>
        <Typography variant="h2">Upload satellite or aerial imagery</Typography>
        <Box className="uploadZone">
          <CloudUploadIcon color="primary" sx={{ fontSize: 48 }} />
          <Typography variant="h6">PNG, JPG, or JPEG</Typography>
          <Typography color="text.secondary">GeoTIFF is intentionally skipped for this PoC until geo-tagged samples are available.</Typography>
          <Button component="label" variant="contained" startIcon={<CloudUploadIcon />}>
            Select Image
            <input hidden type="file" accept="image/png,image/jpeg" onChange={(event) => handleFile(event.target.files?.[0])} />
          </Button>
        </Box>
        {busy ? <LinearProgress /> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Box className="panel">
          <Typography variant="h6">Uploaded Images</Typography>
          <Stack spacing={1.5} mt={2}>
            {images.length === 0 ? <Typography color="text.secondary">No images uploaded yet.</Typography> : null}
            {images.map((image) => (
              <Box className="row" key={image.id}>
                <span>{image.original_name}</span>
                <span className="mono">{image.width}x{image.height}</span>
              </Box>
            ))}
          </Stack>
        </Box>
        <Button variant="outlined" endIcon={<ArrowForwardIcon />} onClick={onNext} disabled={images.length === 0}>
          Analyze Latest Upload
        </Button>
      </Stack>
    </main>
  );
}
