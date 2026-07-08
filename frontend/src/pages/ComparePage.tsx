import { useState } from "react";
import { Alert, Box, Button, LinearProgress, MenuItem, Stack, TextField, Typography } from "@mui/material";
import CompareIcon from "@mui/icons-material/Compare";

import { assetUrl, compareImages } from "../api/client";
import type { CompareResult, UploadedImage } from "../types/api";

type ComparePageProps = {
  images: UploadedImage[];
  onCompared: (comparison: CompareResult) => void;
};

export function ComparePage({ images, onCompared }: ComparePageProps) {
  const [beforeId, setBeforeId] = useState(images[1]?.id ?? images[0]?.id ?? "");
  const [afterId, setAfterId] = useState(images[0]?.id ?? "");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const before = images.find((image) => image.id === beforeId);
  const after = images.find((image) => image.id === afterId);
  const overlay = result?.artifacts.find((item) => item.kind === "difference_overlay");
  const groupedChanges = result ? groupChanges(result.changes) : [];

  const run = async () => {
    if (!before || !after || before.id === after.id) return;
    setBusy(true);
    setError(null);
    try {
      const comparison = await compareImages(before.id, after.id);
      setResult(comparison);
      onCompared(comparison);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Comparison failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <Stack spacing={3}>
        <Typography variant="overline" color="secondary.main" fontFamily="IBM Plex Mono">CHANGE DETECTION</Typography>
        <Typography variant="h2">Compare two captures of the same area</Typography>
        <Box className="toolGrid">
          <Box className="panel splitImages">
            {before ? <img src={assetUrl(before.url)} alt="Before" /> : null}
            {after ? <img src={assetUrl(after.url)} alt="After" /> : null}
            {overlay ? <img src={assetUrl(overlay.url)} alt="Difference overlay" className="wideImage" /> : null}
          </Box>
          <Box className="panel">
            <Stack spacing={2}>
              <TextField select label="Before" value={before?.id ?? ""} onChange={(event) => setBeforeId(event.target.value)}>
                {images.map((image) => <MenuItem key={image.id} value={image.id}>{image.original_name}</MenuItem>)}
              </TextField>
              <TextField select label="After" value={after?.id ?? ""} onChange={(event) => setAfterId(event.target.value)}>
                {images.map((image) => <MenuItem key={image.id} value={image.id}>{image.original_name}</MenuItem>)}
              </TextField>
              <Button variant="contained" color="secondary" startIcon={<CompareIcon />} onClick={run} disabled={!before || !after || before.id === after.id || busy}>Run Compare</Button>
              {busy ? <LinearProgress color="secondary" /> : null}
              {error ? <Alert severity="error">{error}</Alert> : null}
              {result ? (
                <>
                  <Typography color="text.secondary">{result.summary}</Typography>
                  {groupedChanges.slice(0, 8).map((change) => (
                    <Box className="row" key={`${change.change_type}-${change.label}`}>
                      <span>{change.change_type} {change.label} ({change.regions})</span>
                      <span className="mono">{change.area_pct.toFixed(2)}%</span>
                    </Box>
                  ))}
                </>
              ) : null}
            </Stack>
          </Box>
        </Box>
      </Stack>
    </main>
  );
}

function groupChanges(changes: CompareResult["changes"]) {
  const grouped = new Map<string, { change_type: string; label: string; regions: number; area_pct: number; area_px: number }>();
  for (const change of changes) {
    const key = `${change.change_type}:${change.label}`;
    const current = grouped.get(key) ?? { change_type: change.change_type, label: change.label, regions: 0, area_pct: 0, area_px: 0 };
    current.regions += 1;
    current.area_pct += change.area_pct;
    current.area_px += change.area_px;
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((a, b) => b.area_px - a.area_px);
}
