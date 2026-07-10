export type UploadedImage = {
  id: string;
  original_name: string;
  filename: string;
  content_type: string;
  width: number;
  height: number;
  size_bytes: number;
  url: string;
  capture_date?: string | null;
  source_provider?: string | null;
  source_note?: string | null;
  created_at: string;
};

export type FetchSatellitePayload = {
  lat: number;
  lng: number;
  zoom: number;
  size: number;
  provider?: "esri";
  capture_date?: string;
};

export type Detection = {
  id: string;
  label: string;
  confidence: number;
  bbox: number[];
  area_px: number;
};

export type ClassStat = {
  label: string;
  count: number;
  area_px: number;
  coverage_pct: number;
  mean_confidence: number;
};

export type Artifact = {
  kind: string;
  url: string;
  path: string;
};

export type AnalysisResult = {
  id: string;
  image_id: string;
  status: "processing" | "completed" | "failed";
  mode: string;
  image?: UploadedImage | null;
  detections: Detection[];
  class_stats: ClassStat[];
  artifacts: Artifact[];
  quality_notes: string[];
  summary?: string | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
};

export type ChangeItem = {
  label: string;
  change_type: string;
  area_px: number;
  area_pct: number;
  bbox: number[];
  confidence: number;
};

export type CompareResult = {
  id: string;
  before_image_id: string;
  after_image_id: string;
  status: "processing" | "completed" | "failed";
  changes: ChangeItem[];
  artifacts: Artifact[];
  summary?: string | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
};
