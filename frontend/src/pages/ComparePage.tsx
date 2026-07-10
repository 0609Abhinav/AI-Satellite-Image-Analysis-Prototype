import { useState } from "react";
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
import CompareIcon from "@mui/icons-material/Compare";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

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
  const [swipe, setSwipe] = useState(50);

  const before = images.find((image) => image.id === beforeId);
  const after = images.find((image) => image.id === afterId);
  const overlay = result?.artifacts.find(
    (item) => item.kind === "difference_overlay"
  );
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

  const swapImages = () => {
    setBeforeId(afterId);
    setAfterId(beforeId);
    setResult(null);
  };

  return (
    <main className="page">
      <Stack spacing={3} className="fadeUp">
        <Box>
          <Typography
            variant="overline"
            className="eyebrow eyebrowPurple"
          >
            CHANGE DETECTION
          </Typography>

          <Typography
            variant="h2"
            className="pageTitle pageTitlePurple"
          >
            Compare two captures of the same area
          </Typography>

          <Typography className="pageSubtitle">
            Select a before and after capture to detect visual changes,
            difference regions, and changed surface coverage.
          </Typography>
        </Box>

        <Box
          className="toolGridWide"
        >
          <Box
            className={`imagePanel ${busy ? "busyPanel" : ""}`}
            sx={{
              p: 2,
              minHeight: 520,
            }}
          >
            <SwipeCompare before={before} after={after} value={swipe} onChange={setSwipe} />
            {overlay ? (
              <Button
                component="a"
                href={assetUrl(overlay.url)}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                className="missionButton missionButtonOutlinePurple"
                sx={{ mt: 2 }}
              >
                Open Difference Overlay
              </Button>
            ) : null}
          </Box>

          <Box className="controlPanel">
            <Stack spacing={2.2}>
              <TextField
                select
                label="Before"
                value={before?.id ?? ""}
                onChange={(event) => {
                  setBeforeId(event.target.value);
                  setResult(null);
                }}
                className="darkField darkFieldPurple"
              >
                {images.map((image) => (
                  <MenuItem key={image.id} value={image.id}>
                    {image.original_name}
                  </MenuItem>
                ))}
              </TextField>

              <Button
                variant="outlined"
                startIcon={<SwapHorizIcon />}
                onClick={swapImages}
                disabled={!before || !after || busy}
                className="missionButton missionButtonOutlinePurple"
              >
                Swap Before / After
              </Button>

              <TextField
                select
                label="After"
                value={after?.id ?? ""}
                onChange={(event) => {
                  setAfterId(event.target.value);
                  setResult(null);
                }}
                className="darkField darkFieldPurple"
              >
                {images.map((image) => (
                  <MenuItem key={image.id} value={image.id}>
                    {image.original_name}
                  </MenuItem>
                ))}
              </TextField>

              <Button
                variant="contained"
                startIcon={<CompareIcon />}
                onClick={run}
                disabled={!before || !after || before.id === after.id || busy}
                className="missionButton missionButtonPurple"
              >
                {busy ? "Comparing..." : "Run Compare"}
              </Button>

              {before?.id === after?.id ? (
                <Alert severity="warning" sx={{ borderRadius: 3 }}>
                  Select two different images for comparison.
                </Alert>
              ) : null}

              {busy ? (
                <Box className="progressBox progressBoxPurple">
                  <LinearProgress
                    className="missionProgress missionProgressPurple"
                  />
                  <Typography
                    sx={{
                      mt: 1.5,
                      color: "#cbd5e1",
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: 13,
                    }}
                  >
                    Comparing selected captures and generating difference map...
                  </Typography>
                </Box>
              ) : null}

              {error ? (
                <Alert severity="error" sx={{ borderRadius: 3 }}>
                  {error}
                </Alert>
              ) : null}

              {result ? (
                <>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      label={`${result.changes.length} raw changes`}
                      className="statusChip statusChipPurple"
                    />
                    <Chip
                      label={`${groupedChanges.length} grouped`}
                      className="statusChip statusChipPink"
                    />
                  </Stack>

                  <Box className="infoBox">
                    <Typography sx={{ color: "#f8fafc", fontWeight: 900 }}>
                      Summary
                    </Typography>
                    <Typography sx={{ mt: 0.8, color: "#94a3b8", lineHeight: 1.7 }}>
                      {result.summary}
                    </Typography>
                  </Box>

                  <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 900 }}>
                    Change Groups
                  </Typography>

                  <Stack spacing={1.2}>
                    {groupedChanges.slice(0, 8).map((change, index) => (
                      <Box
                        className="detectionRow purpleHover"
                        key={`${change.change_type}-${change.label}`}
                        sx={{
                          alignItems: "center",
                          animationDelay: `${index * 0.05}s`,
                        }}
                      >
                        <Box>
                          <Typography sx={{ color: "#f8fafc", fontWeight: 900 }}>
                            {change.change_type} {change.label}
                          </Typography>
                          <Typography
                            sx={{
                              mt: 0.3,
                              color: "#94a3b8",
                              fontFamily: "IBM Plex Mono, monospace",
                              fontSize: 12,
                            }}
                          >
                            {change.regions} regions /{" "}
                            {change.area_px.toLocaleString()} px
                          </Typography>
                        </Box>

                        <Typography
                          className="mono"
                          sx={{
                            color: "#c084fc",
                            fontFamily: "IBM Plex Mono, monospace",
                            fontWeight: 900,
                          }}
                        >
                          {change.area_pct.toFixed(2)}%
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </>
              ) : (
                <Box className="infoBox">
                  <Typography sx={{ color: "#f8fafc", fontWeight: 900 }}>
                    Ready to compare
                  </Typography>
                  <Typography sx={{ mt: 0.8, color: "#94a3b8", fontSize: 14 }}>
                    Select two uploaded images from the same area, then run
                    comparison to generate a difference overlay.
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>
        </Box>
      </Stack>
    </main>
  );
}

function SwipeCompare({
  before,
  after,
  value,
  onChange,
}: {
  before?: UploadedImage;
  after?: UploadedImage;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Box className="swipeCompare">
      {before && after ? (
        <>
          <img src={assetUrl(after.url)} alt="After capture" className="swipeImage" />
          <Box className="swipeBefore" sx={{ width: `${value}%` }}>
            <img
              src={assetUrl(before.url)}
              alt="Before capture"
              className="swipeImage"
              style={{ width: `${10000 / value}%`, maxWidth: "none" }}
            />
          </Box>
          <Chip label="Before" className="swipeChip swipeChipBefore" />
          <Chip label="After" className="swipeChip swipeChipAfter" />
          <Box className="swipeHandle" sx={{ left: `${value}%` }} />
          <input
            className="swipeRange"
            type="range"
            min={5}
            max={95}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            aria-label="Before after comparison slider"
          />
        </>
      ) : (
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{ height: "100%", minHeight: 500, color: "#94a3b8" }}
        >
          <Typography>No image selected.</Typography>
        </Stack>
      )}
    </Box>
  );
}

function groupChanges(changes: CompareResult["changes"]) {
  const grouped = new Map<
    string,
    {
      change_type: string;
      label: string;
      regions: number;
      area_pct: number;
      area_px: number;
    }
  >();

  for (const change of changes) {
    const key = `${change.change_type}:${change.label}`;
    const current =
      grouped.get(key) ?? {
        change_type: change.change_type,
        label: change.label,
        regions: 0,
        area_pct: 0,
        area_px: 0,
      };

    current.regions += 1;
    current.area_pct += change.area_pct;
    current.area_px += change.area_px;
    grouped.set(key, current);
  }

  return [...grouped.values()].sort((a, b) => b.area_px - a.area_px);
}
