import type { AnalysisResult, CompareResult, FetchSatellitePayload, UploadedImage } from "../types/api";

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(typeof payload.detail === "string" ? payload.detail : "Request failed");
  }
  return response.json() as Promise<T>;
}

export function assetUrl(url: string): string {
  return url.startsWith("http") ? url : `${apiBaseUrl}${url}`;
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  const data = new FormData();
  data.append("file", file);
  const response = await request<{ image: UploadedImage }>("/upload", {
    method: "POST",
    body: data
  });
  return response.image;
}

export async function fetchSatelliteImage(payload: FetchSatellitePayload): Promise<UploadedImage> {
  const response = await request<{ image: UploadedImage }>("/fetch-satellite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.image;
}

export async function analyzeImage(imageId: string): Promise<AnalysisResult> {
  const response = await request<{ analysis: AnalysisResult }>(`/analyze/${imageId}`, { method: "POST" });
  return response.analysis;
}

export async function compareImages(beforeImageId: string, afterImageId: string): Promise<CompareResult> {
  const response = await request<{ comparison: CompareResult }>("/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ before_image_id: beforeImageId, after_image_id: afterImageId })
  });
  return response.comparison;
}
