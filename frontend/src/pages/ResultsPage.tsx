import { Box, Button, Stack, Typography } from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

import { assetUrl } from "../api/client";
import type { AnalysisResult, CompareResult } from "../types/api";

type ResultsPageProps = {
  analyses: AnalysisResult[];
  comparison: CompareResult | null;
};

export function ResultsPage({ analyses, comparison }: ResultsPageProps) {
  const analysis = analyses[0] ?? null;
  const annotated = analysis?.artifacts.find((item) => item.kind === "annotated");
  const diff = comparison?.artifacts.find((item) => item.kind === "difference_overlay");
  const exports = [...analyses.flatMap((item) => item.artifacts), ...(comparison?.artifacts ?? [])].filter((item) => ["json", "pdf", "annotated", "difference_overlay"].includes(item.kind));

  return (
    <main className="page">
      <Stack spacing={3}>
        <Typography variant="overline" color="primary.main" fontFamily="IBM Plex Mono">EXPORT</Typography>
        <Typography variant="h2">Results and downloadable artifacts</Typography>
        <Box className="toolGrid">
          <Box className="panel imagePanel">
            {diff ? <img src={assetUrl(diff.url)} alt="Difference overlay" /> : annotated ? <img src={assetUrl(annotated.url)} alt="Annotated result" /> : <Typography color="text.secondary">Run an analysis or comparison to populate results.</Typography>}
          </Box>
          <Box className="panel">
            <Stack spacing={2}>
              <Typography variant="h6">AI Summary</Typography>
              <Typography color="text.secondary">{comparison?.summary ?? analysis?.summary ?? "No summary generated yet."}</Typography>
              <Typography variant="h6">Analyzed Images</Typography>
              {analyses.length === 0 ? <Typography color="text.secondary">No analyses yet.</Typography> : null}
              {analyses.map((item) => (
                <Box className="row" key={item.id}>
                  <span>{item.image?.original_name ?? item.image_id}</span>
                  <span className="mono">{item.detections.length} detections</span>
                </Box>
              ))}
              <Typography variant="h6">Artifacts</Typography>
              {exports.length === 0 ? <Typography color="text.secondary">No exports yet.</Typography> : null}
              {exports.map((artifact) => (
                <Button key={`${artifact.kind}-${artifact.url}`} component="a" href={assetUrl(artifact.url)} target="_blank" rel="noreferrer" variant="outlined" startIcon={<FileDownloadIcon />}>
                  Open {artifact.kind.replace("_", " ")}
                </Button>
              ))}
            </Stack>
          </Box>
        </Box>
      </Stack>
    </main>
  );
}
