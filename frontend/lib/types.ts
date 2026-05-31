export interface User {
  id: string;
  full_name: string | null;
  role: "citizen" | "operator" | "admin";
  phone: string | null;
  fin_code: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface DistrictZone {
  id: string;
  name: string;
  name_az: string;
  code: string | null;
  boundary: GeoJSONPolygon | null;
  population: number | null;
  area_km2: number | null;
}

export interface GeoJSONPolygon {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][];
}

export interface AirQualityValue {
  aqi: number;
  pm25: number;
  pm10: number;
  co2: number;
  no2?: number;
  status?: string;
}

export interface TrafficValue {
  congestion_pct: number;
  avg_speed_kmh: number;
  incident_count: number;
  status?: string;
}

export interface UtilitiesValue {
  water_pressure_bar?: number;
  power_outages?: number;
  gas_pressure_kpa?: number;
  status?: string;
}

export interface IncidentValue {
  type: string;
  severity: string;
  location?: string;
  responders_dispatched?: boolean;
}

export type MonitoringType = "air_quality" | "traffic" | "utilities" | "incident";

export interface MonitoringData {
  id: string;
  zone_id: string | null;
  type: MonitoringType;
  value: AirQualityValue | TrafficValue | UtilitiesValue | IncidentValue | Record<string, unknown>;
  source: string;
  recorded_at: string;
}

export interface Complaint {
  id: string;
  user_id: string | null;
  zone_id: string | null;
  title: string;
  description: string;
  category: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved" | "closed";
  ai_summary: string | null;
  attachments: string[] | null;
  lat: number | null;
  lng: number | null;
  deadline: string | null;
  assigned_service_id: string | null;
  votes: number;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  name_az: string;
  description_az: string | null;
  category: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  working_hours: string | null;
  zone_id: string | null;
  is_active: boolean;
}

export interface OpenDataReport {
  id: string;
  title: string;
  title_az: string | null;
  type: string | null;
  data: Record<string, unknown> | null;
  ai_summary: string | null;
  published_at: string;
  generated_by: string;
}

export interface ComplaintCreate {
  zone_id?:        string;
  title:           string;
  description:     string;
  priority?:       "low" | "medium" | "high" | "critical";
  lat?:            number;
  lng?:            number;
  submission_type?: string;
  citizen_name?:   string;
  citizen_father?: string;
  citizen_phone?:  string;
  attachments?:    string[];
}
