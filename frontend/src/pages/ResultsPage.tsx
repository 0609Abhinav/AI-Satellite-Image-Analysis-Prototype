import {
  Box,
  Button,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ImageIcon from "@mui/icons-material/Image";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

import { assetUrl } from "../api/client";
import type { AnalysisResult, CompareResult } from "../types/api";

type ResultsPageProps = {
  analyses: AnalysisResult[];
  comparison: CompareResult | null;
};

export function ResultsPage({
  analyses,
  comparison,
}: ResultsPageProps) {
  const analysis = analyses[0] ?? null;

  const annotated = analysis?.artifacts.find(
    (item) => item.kind === "annotated"
  );

  const diff = comparison?.artifacts.find(
    (item) => item.kind === "difference_overlay"
  );

  const exports = [
    ...analyses.flatMap((item) => item.artifacts),
    ...(comparison?.artifacts ?? []),
  ].filter((item) =>
    ["json", "pdf", "annotated", "difference_overlay"].includes(item.kind)
  );

  const totalDetections = analyses.reduce(
    (total, item) => total + item.detections.length,
    0
  );

  const summary =
    comparison?.summary ??
    analysis?.summary ??
    "No summary generated yet.";

  const preview = diff ?? annotated;

  return (
    <main className="page">
      <Stack
        spacing={3}
        className="fadeUp"
      >
        <Box>
          <Typography
            variant="overline"
            className="eyebrow"
          >
            EXPORT
          </Typography>

          <Typography
            variant="h2"
            className="pageTitle"
          >
            Results and downloadable artifacts
          </Typography>

          <Typography
            className="pageSubtitle"
          >
            Review generated imagery, AI findings, analyzed files, and export
            artifacts from the latest processing session.
          </Typography>
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          flexWrap="wrap"
          useFlexGap
        >
          <MetricChip
            icon={<AssessmentIcon fontSize="small" />}
            label={`${analyses.length} analyzed`}
          />

          <MetricChip
            icon={<AutoAwesomeIcon fontSize="small" />}
            label={`${totalDetections} detections`}
          />

          <MetricChip
            icon={<InsertDriveFileIcon fontSize="small" />}
            label={`${exports.length} artifacts`}
          />

          {comparison ? (
            <MetricChip
              icon={<ImageIcon fontSize="small" />}
              label="Comparison available"
            />
          ) : null}
        </Stack>

        <Box
          className="toolGridResults"
        >
          <Box
            className={`imagePanel ${preview ? "softPulsePanel" : ""}`}
            sx={{ minHeight: 540 }}
          >
            {preview ? (
              <>
                <Chip
                  label={
                    diff
                      ? "Difference Overlay"
                      : "Annotated Analysis Result"
                  }
                  sx={{
                    position: "absolute",
                    zIndex: 2,
                    top: 18,
                    left: 18,
                    color: "#022c22",
                    bgcolor: "#2dd4bf",
                    fontWeight: 900,
                    boxShadow:
                      "0 10px 28px rgba(45,212,191,0.24)",
                  }}
                />

                <Box
                  sx={{
                    width: "100%",
                    minHeight: 540,
                    display: "grid",
                    placeItems: "center",
                    background:
                      "radial-gradient(circle at center, rgba(45,212,191,0.06), transparent 55%)",
                  }}
                >
                  <img
                    src={assetUrl(preview.url)}
                    alt={
                      diff
                        ? "Difference overlay"
                        : "Annotated result"
                    }
                    style={{
                      width: "100%",
                      height: "100%",
                      minHeight: 540,
                      maxHeight: 720,
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                </Box>
              </>
            ) : (
              <Stack
                alignItems="center"
                justifyContent="center"
                spacing={2}
                sx={{
                  minHeight: 540,
                  px: 3,
                  textAlign: "center",
                }}
              >
                <Box
                  sx={{
                    width: 82,
                    height: 82,
                    borderRadius: "24px",
                    display: "grid",
                    placeItems: "center",
                    color: "#2dd4bf",
                    bgcolor: "rgba(45,212,191,0.1)",
                    border:
                      "1px solid rgba(45,212,191,0.24)",
                  }}
                >
                  <ImageIcon sx={{ fontSize: 42 }} />
                </Box>

                <Typography
                  variant="h6"
                  sx={{
                    color: "#f8fafc",
                    fontWeight: 900,
                  }}
                >
                  No result preview yet
                </Typography>

                <Typography
                  sx={{
                    maxWidth: 440,
                    color: "#94a3b8",
                    lineHeight: 1.7,
                  }}
                >
                  Run an analysis or image comparison to generate an
                  annotated image or difference overlay.
                </Typography>
              </Stack>
            )}
          </Box>

          <Box className="controlPanel">
            <Stack spacing={2.5}>
              <Box>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                >
                  <AutoAwesomeIcon
                    sx={{
                      color: "#2dd4bf",
                      fontSize: 22,
                    }}
                  />

                  <Typography
                    variant="h6"
                    sx={{
                      color: "#f8fafc",
                      fontWeight: 900,
                    }}
                  >
                    AI Summary
                  </Typography>
                </Stack>

                <Box
                  className="infoBox"
                >
                  <Typography
                    sx={{
                      color:
                        summary === "No summary generated yet."
                          ? "#94a3b8"
                          : "#cbd5e1",
                      lineHeight: 1.75,
                    }}
                  >
                    {summary}
                  </Typography>
                </Box>
              </Box>

              <Divider
                sx={{
                  borderColor: "rgba(148,163,184,0.15)",
                }}
              />

              <Box>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  mb={1.5}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      color: "#f8fafc",
                      fontWeight: 900,
                    }}
                  >
                    Analyzed Images
                  </Typography>

                    <Chip
                      label={analyses.length}
                      size="small"
                      className="countChip"
                    />
                </Stack>

                {analyses.length === 0 ? (
                  <EmptyState text="No analyses yet." />
                ) : (
                  <Stack spacing={1.2}>
                    {analyses.map((item, index) => (
                      <Box
                        className="detectionRow"
                        key={item.id}
                        sx={{
                          alignItems: "center",
                          animationDelay: `${index * 0.05}s`,
                        }}
                      >
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={1.3}
                          minWidth={0}
                        >
                          <Box
                            sx={{
                              width: 38,
                              height: 38,
                              flexShrink: 0,
                              borderRadius: "13px",
                              display: "grid",
                              placeItems: "center",
                              color: "#2dd4bf",
                              bgcolor:
                                "rgba(45,212,191,0.12)",
                            }}
                          >
                            <ImageIcon fontSize="small" />
                          </Box>

                          <Typography
                            noWrap
                            sx={{
                              color: "#f8fafc",
                              fontWeight: 800,
                            }}
                          >
                            {item.image?.original_name ??
                              item.image_id}
                          </Typography>
                        </Stack>

                        <Typography
                          className="mono"
                          sx={{
                            flexShrink: 0,
                            color: "#2dd4bf",
                            fontFamily:
                              "IBM Plex Mono, monospace",
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {item.detections.length} detections
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>

              <Divider
                sx={{
                  borderColor: "rgba(148,163,184,0.15)",
                }}
              />

              <Box>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  mb={1.5}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      color: "#f8fafc",
                      fontWeight: 900,
                    }}
                  >
                    Artifacts
                  </Typography>

                    <Chip
                      label={exports.length}
                      size="small"
                      className="countChip countChipBlue"
                    />
                </Stack>

                {exports.length === 0 ? (
                  <EmptyState text="No exports yet." />
                ) : (
                  <Stack spacing={1.2}>
                    {exports.map((artifact, index) => (
                      <Button
                        key={`${artifact.kind}-${artifact.url}`}
                        component="a"
                        href={assetUrl(artifact.url)}
                        target="_blank"
                        rel="noreferrer"
                        variant="outlined"
                        startIcon={<FileDownloadIcon />}
                        className="artifactButton fadeUp"
                        sx={{
                          animationDelay: `${index * 0.04}s`,
                        }}
                      >
                        Open {formatArtifactKind(artifact.kind)}
                      </Button>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          </Box>
        </Box>
      </Stack>
    </main>
  );
}

function MetricChip({
  icon,
  label,
}: {
  icon: React.ReactElement;
  label: string;
}) {
  return (
    <Chip
      icon={icon}
      label={label}
      className="metricChip"
    />
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Box className="emptyBox">
      <Typography
        sx={{
          color: "#94a3b8",
          fontSize: 14,
        }}
      >
        {text}
      </Typography>
    </Box>
  );
}

function formatArtifactKind(kind: string) {
  return kind
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter: string) => letter.toUpperCase());
}
