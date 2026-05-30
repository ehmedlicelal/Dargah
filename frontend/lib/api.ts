import type {
  MonitoringData,
  Complaint,
  ComplaintCreate,
  DistrictZone,
  Service,
  OpenDataReport,
} from "./types";
import { supabase } from "./supabase";

export interface AiAnalysis {
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  ai_summary: string | null;
  reasoning: string | null;
}

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const isWrite = options?.method && options.method !== "GET" && options.method !== "HEAD";
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      ...(isWrite ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
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

export async function createComplaint(data: ComplaintCreate): Promise<Complaint> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: result, error } = await supabase
    .from("complaints")
    .insert({
      title: data.title,
      description: data.description,
      priority: data.priority ?? "medium",
      zone_id: data.zone_id ?? null,
      submission_type: data.submission_type ?? "Şikayət",
      citizen_name: data.citizen_name ?? null,
      citizen_father: data.citizen_father ?? null,
      citizen_phone: data.citizen_phone ?? null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      attachments: data.attachments ?? null,
      user_id: user?.id ?? null,
      status: "open",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return result as Complaint;
}

export function updateComplaint(
  id: string,
  data: { status?: string; priority?: string; category?: string; report_content?: string },
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
  return apiFetch("/services/");
}

export interface UserRow {
  id: string;
  full_name: string | null;
  role: "citizen" | "operator" | "admin";
  phone: string | null;
  email: string | null;
  created_at: string;
}

export function fetchUsers(): Promise<UserRow[]> {
  return apiFetch("/auth/users");
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

// ── Official report generation ──────────────────────────────────────────────
export interface ReportRequest {
  submission_type: string;
  citizen_text: string;
  full_name?: string;
  father_name?: string;
  address?: string;
  phone?: string;
  priority?: string;
  zone_name?: string;
  image_url?: string;
}

export function generateReport(data: ReportRequest): Promise<{ report: string }> {
  return apiFetch("/reports/generate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
