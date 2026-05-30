import type {
  MonitoringData,
  Complaint,
  ComplaintCreate,
  DistrictZone,
  Service,
  OpenDataReport,
} from "./types";

export interface AiAnalysis {
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  ai_summary: string | null;
  reasoning: string | null;
}

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${msg}`);
  }
  return res.json() as Promise<T>;
}

// TODO: add auth header from Supabase session — pass token as Bearer in Authorization header

export function fetchAirQuality(zoneId?: string, limit = 50): Promise<MonitoringData[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (zoneId) params.set("zone_id", zoneId);
  return apiFetch(`/monitoring/air-quality?${params}`);
}

export function fetchTraffic(zoneId?: string, limit = 50): Promise<MonitoringData[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (zoneId) params.set("zone_id", zoneId);
  return apiFetch(`/monitoring/traffic?${params}`);
}

export function fetchUtilities(zoneId?: string, limit = 50): Promise<MonitoringData[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (zoneId) params.set("zone_id", zoneId);
  return apiFetch(`/monitoring/utilities?${params}`);
}

export function fetchIncidents(zoneId?: string, limit = 50): Promise<MonitoringData[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (zoneId) params.set("zone_id", zoneId);
  return apiFetch(`/monitoring/incidents?${params}`);
}

export function fetchComplaints(complaintStatus?: string, limit = 50): Promise<Complaint[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (complaintStatus) params.set("complaint_status", complaintStatus);
  return apiFetch(`/complaints/?${params}`);
}

export function fetchComplaint(id: string): Promise<Complaint> {
  return apiFetch(`/complaints/${id}`);
}

export function createComplaint(data: ComplaintCreate): Promise<Complaint> {
  return apiFetch("/complaints/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateComplaint(
  id: string,
  data: { status?: string; priority?: string; category?: string },
): Promise<Complaint> {
  return apiFetch(`/complaints/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchZones(): Promise<DistrictZone[]> {
  return apiFetch("/district-map/zones");
}

export function fetchZoneDetail(id: string): Promise<DistrictZone & { latest_air_quality?: MonitoringData; latest_traffic?: MonitoringData }> {
  return apiFetch(`/district-map/zones/${id}`);
}

export function fetchServices(): Promise<Service[]> {
  return apiFetch("/open-data/");
}

export function fetchOpenDataReports(): Promise<OpenDataReport[]> {
  return apiFetch("/open-data/");
}

export function fetchAiSummary(): Promise<{ summary: string; data_points: number }> {
  return apiFetch("/open-data/summary");
}

export function analyzeComplaint(
  title: string,
  description: string,
  image_url?: string,
): Promise<AiAnalysis> {
  return apiFetch("/ai/analyze", {
    method: "POST",
    body: JSON.stringify({ title, description, image_url }),
  });
}

// ── Named buildings ─────────────────────────────────────────────────────────
export interface NamedBuilding {
  id: string;
  feature_id: string;
  name: string;
  lat?: number;
  lng?: number;
  created_at?: string;
}

export function fetchNamedBuildings(): Promise<NamedBuilding[]> {
  return apiFetch("/buildings/named");
}

export function fetchNamedBuilding(featureId: string): Promise<NamedBuilding | null> {
  return apiFetch(`/buildings/named/${encodeURIComponent(featureId)}`);
}

export function saveNamedBuilding(data: {
  feature_id: string; name: string; lat?: number; lng?: number;
}): Promise<NamedBuilding> {
  return apiFetch("/buildings/named", { method: "POST", body: JSON.stringify(data) });
}

export function deleteNamedBuilding(featureId: string): Promise<void> {
  return apiFetch(`/buildings/named/${encodeURIComponent(featureId)}`, { method: "DELETE" });
}
