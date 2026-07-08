import { useState } from "react";

import { AppShell } from "./components/AppShell";
import { AnalyzePage } from "./pages/AnalyzePage";
import { ComparePage } from "./pages/ComparePage";
import { LandingPage } from "./pages/LandingPage";
import { ResultsPage } from "./pages/ResultsPage";
import { UploadPage } from "./pages/UploadPage";
import type { AnalysisResult, CompareResult, UploadedImage } from "./types/api";

export type PageKey = "landing" | "upload" | "analyze" | "compare" | "results";

export default function App() {
  const [page, setPage] = useState<PageKey>("landing");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [comparison, setComparison] = useState<CompareResult | null>(null);

  const addImage = (image: UploadedImage) => {
    setImages((current) => [image, ...current]);
  };

  const addAnalysis = (analysis: AnalysisResult) => {
    setAnalyses((current) => [analysis, ...current.filter((item) => item.image_id !== analysis.image_id)]);
  };

  const content = {
    landing: <LandingPage onLaunch={() => setPage("upload")} />,
    upload: <UploadPage images={images} onUploaded={addImage} onNext={() => setPage("analyze")} />,
    analyze: <AnalyzePage images={images} analyses={analyses} onAnalyzed={addAnalysis} onNext={() => setPage("results")} />,
    compare: <ComparePage images={images} onCompared={setComparison} />,
    results: <ResultsPage analyses={analyses} comparison={comparison} />
  }[page];

  return (
    <AppShell page={page} onNavigate={setPage}>
      {content}
    </AppShell>
  );
}
