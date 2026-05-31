"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import mapboxgl from "mapbox-gl";
import {
  fetchAirQuality, fetchComplaints, fetchIncidents,
  fetchTraffic, fetchUtilities, fetchZoneDetail, fetchZones,
  fetchNamedBuilding, fetchNamedBuildings, saveNamedBuilding, deleteNamedBuilding,
  type NamedBuilding,
} from "@/lib/api";
import { narimanovMonitoringStyle } from "@/lib/mapStyle";
import type { Complaint, DistrictZone, MonitoringData } from "@/lib/types";
import type { MonitoringPoint } from "@/components/NarimanovMap";
import RoleGuard from "@/components/RoleGuard";

// ── Config ─────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
// Use Mapbox-hosted dark style — guaranteed to load fonts + road labels.
// Colors are overridden at runtime by applyTheme() via setPaintProperty.
const MAP_STYLE: string =
  process.env.NEXT_PUBLIC_MAPBOX_STYLE ?? "mapbox://styles/mapbox/dark-v11";

// 2GIS catalog key for search (already used in map component)
const TWOGIS_KEY = "303f450a-46b5-477e-b64a-f7772c635aff";

// ── Glass panel style (reused across all panels) ────────────────────────────
const G: React.CSSProperties = {
  background: "rgba(6, 11, 32, 0.84)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "16px",
  boxShadow: "0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
  color: "#e2e8f0",
  fontFamily: "system-ui,-apple-system,sans-serif",
};

// ── Monitoring helper data ──────────────────────────────────────────────────
const ZONE_CENTERS: Record<string, [number, number]> = {
  "11111111-0000-0000-0000-000000000001": [49.8678, 40.4116],
  "11111111-0000-0000-0000-000000000002": [49.8784, 40.4316],
  "11111111-0000-0000-0000-000000000003": [49.9053, 40.4091],
  "11111111-0000-0000-0000-000000000004": [49.8630, 40.4025],
  "11111111-0000-0000-0000-000000000005": [49.8510, 40.4188],
};
const TYPE_OFFSETS: Record<string, [number, number]> = {
  air_quality: [0, 0.0009], traffic: [0.0009, 0],
  utilities: [0, -0.0009], incident: [-0.0009, 0],
};
const MONITORING_LABELS: Record<string, string> = {
  air_quality: "Hava Keyfiyyəti", traffic: "Trafik",
  utilities: "Kommunal", incident: "Hadisə",
};
function formatStatusText(m: MonitoringData): string {
  const v = m.value as Record<string, unknown>;
  if (m.type === "air_quality") return `AQI: ${v.aqi ?? "--"} — ${v.status ?? ""}`;
  if (m.type === "traffic") return `Tıxac: ${v.congestion_pct ?? "--"}% · ${v.avg_speed_kmh ?? "--"} km/h`;
  if (m.type === "utilities") {
    const parts: string[] = [];
    if (v.power_outages) parts.push(`${v.power_outages} elektrik`);
    if ((v.water_pressure_bar as number) < 2) parts.push("Aşağı su təzyiqi");
    return parts.length ? parts.join(", ") : `${v.status ?? "normal"}`;
  }
  if (m.type === "incident") return `${v.type ?? ""} — ${v.severity ?? ""}`;
  return "";
}
function toMonitoringPoints(items: MonitoringData[]): MonitoringPoint[] {
  return items
    .filter((m) => m.zone_id && ZONE_CENTERS[m.zone_id])
    .map((m) => {
      const [bLng, bLat] = ZONE_CENTERS[m.zone_id!];
      const [dLng, dLat] = TYPE_OFFSETS[m.type] ?? [0, 0];
      return {
        id: m.id, type: m.type as MonitoringPoint["type"],
        label: MONITORING_LABELS[m.type] ?? m.type,
        statusText: formatStatusText(m),
        lat: bLat + dLat, lng: bLng + dLng,
      };
    });
}

// ── AQI helpers ─────────────────────────────────────────────────────────────
function aqiColor(aqi: number) {
  if (aqi <= 50)  return "#22c55e";
  if (aqi <= 100) return "#f59e0b";
  if (aqi <= 150) return "#f97316";
  return "#ef4444";
}
function aqiLabel(aqi: number) {
  if (aqi <= 50)  return "Yaxşı";
  if (aqi <= 100) return "Orta";
  if (aqi <= 150) return "Həssas";
  return "Zərərli";
}

// ── Search result type ──────────────────────────────────────────────────────
interface SearchResult { id: string; name: string; address: string; lon: number; lat: number; }

// ── Dynamic map import ──────────────────────────────────────────────────────
const NarimanovMap = dynamic(() => import("@/components/NarimanovMap"), {
  ssr: false,
  loading: () => (
    <div style={{ width: "100%", height: "100%", background: "#06090f",
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "rgba(226,232,240,0.5)", fontFamily: "system-ui,sans-serif" }}>
        <div style={{ width: 40, height: 40, border: "3px solid rgba(0,212,255,0.3)",
          borderTop: "3px solid #00d4ff", borderRadius: "50%",
          animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        Xəritə yüklənir...
      </div>
    </div>
  ),
});

// ── Priority / legend data ──────────────────────────────────────────────────
const PRIORITY_LEGEND = [
  { label: "Aşağı (30 gün)",   color: "#22c55e" },
  { label: "Orta (14 gün)",    color: "#3b82f6" },
  { label: "Yüksək (7 gün)",   color: "#f97316" },
  { label: "Kritik (48 saat)", color: "#ef4444" },
] as const;
const MONITORING_LEGEND = [
  { label: "Hava Keyfiyyəti", color: "#10b981" },
  { label: "Trafik",          color: "#f59e0b" },
  { label: "Kommunal",        color: "#8b5cf6" },
  { label: "Hadisə",          color: "#ef4444" },
] as const;

// ── Filter option data ───────────────────────────────────────────────────────
const PRIORITY_FILTER_OPTS = [
  { value: "low",      label: "Aşağı",  color: "#22c55e" },
  { value: "medium",   label: "Orta",   color: "#3b82f6" },
  { value: "high",     label: "Yüksək", color: "#f97316" },
  { value: "critical", label: "Kritik", color: "#ef4444" },
];
const STATUS_FILTER_OPTS = [
  { value: "open",        label: "Açıq",       color: "#60a5fa" },
  { value: "in_progress", label: "İcrada",      color: "#f59e0b" },
  { value: "resolved",    label: "Həll edildi", color: "#22c55e" },
  { value: "closed",      label: "Bağlı",       color: "#6b7280" },
];
const CATEGORY_FILTER_OPTS = [
  { value: "road",        label: "Yol",          color: "#f97316" },
  { value: "utilities",   label: "Kommunal",     color: "#8b5cf6" },
  { value: "environment", label: "Ekologiya",    color: "#10b981" },
  { value: "safety",      label: "Təhlükəsizlik",color: "#ef4444" },
  { value: "social",      label: "Sosial",       color: "#3b82f6" },
  { value: "other",       label: "Digər",        color: "#6b7280" },
];

function FilterChip({ label, color, selected, onClick }: {
  label: string; color: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px", borderRadius: 20, cursor: "pointer",
        border: `1px solid ${selected ? color : "rgba(255,255,255,0.12)"}`,
        background: selected ? `${color}33` : "rgba(255,255,255,0.05)",
        color: selected ? color : "rgba(226,232,240,0.55)",
        fontSize: 11, fontWeight: selected ? 700 : 400,
        transition: "all 0.15s", whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
function MapPageContent() {
  // Map instance (received via onMapReady callback)
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const searchMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const searchPopupRef  = useRef<mapboxgl.Popup  | null>(null);

  // Data
  const [zones,            setZones]            = useState<DistrictZone[]>([]);
  const [selectedZoneId,   setSelectedZoneId]   = useState<string>("");
  const [zoneDetail,       setZoneDetail]       = useState<Record<string, unknown> | null>(null);
  const [complaints,       setComplaints]       = useState<Complaint[]>([]);
  const [monitoringPoints, setMonitoringPoints] = useState<MonitoringPoint[]>([]);
  const [loading,          setLoading]          = useState(true);

  // UI state
  const [districtOnly, setDistrictOnly] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Per-panel collapse: true = slid away, false = visible
  const [p1Collapsed, setP1Collapsed] = useState(false); // zone/stats top-left
  const [p2Collapsed, setP2Collapsed] = useState(false); // complaints bottom-left
  const [p3Collapsed, setP3Collapsed] = useState(false); // search top-center
  const [p5Collapsed, setP5Collapsed] = useState(false); // AQI bottom-right
  const [p6Collapsed, setP6Collapsed] = useState(true);  // filter panel right
  const [navCollapsed, setNavCollapsed] = useState(false); // topbar (map page only)

  // ── Filter state ───────────────────────────────────────────────────────────
  const [filterPriorities,  setFilterPriorities]  = useState<Set<string>>(new Set());
  const [filterStatuses,    setFilterStatuses]    = useState<Set<string>>(new Set());
  const [filterCategories,  setFilterCategories]  = useState<Set<string>>(new Set());

  const toggleFilter = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) =>
    setter(prev => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });

  const clearAllFilters = () => {
    setFilterPriorities(new Set());
    setFilterStatuses(new Set());
    setFilterCategories(new Set());
  };

  const activeFilterCount = filterPriorities.size + filterStatuses.size + filterCategories.size;
  const [isDark,    setIsDark]    = useState(true);   // map color theme
  const [mapReady,  setMapReady]  = useState(false);  // true once onMapReady fires

  // Building name panel
  const [buildingPanel, setBuildingPanel] = useState<{
    featureId: string; lat: number; lng: number;
    saved: NamedBuilding | null;
  } | null>(null);
  const [buildingNameInput, setBuildingNameInput] = useState("");
  const [buildingSaving, setBuildingSaving] = useState(false);
  const [buildingSaveError, setBuildingSaveError] = useState<string | null>(null);

  // Named buildings (for search integration)
  const [namedBuildings, setNamedBuildings] = useState<NamedBuilding[]>([]);

  // Search state
  const [query,        setQuery]        = useState("");
  const [searchRes,    setSearchRes]    = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [noResults,    setNoResults]    = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchZones()
      .then((data) => { setZones(data); if (data.length > 0) setSelectedZoneId(data[0].id); })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetchComplaints(undefined, 200).then(setComplaints).catch(() => {});
    fetchNamedBuildings().then(setNamedBuildings).catch(() => {});

    Promise.allSettled([
      fetchAirQuality(undefined, 50), fetchTraffic(undefined, 50),
      fetchUtilities(undefined, 50),  fetchIncidents(undefined, 50),
    ]).then(([aq, tr, ut, inc]) => {
      const all: MonitoringData[] = [
        ...(aq.status === "fulfilled" ? aq.value : []),
        ...(tr.status === "fulfilled" ? tr.value : []),
        ...(ut.status === "fulfilled" ? ut.value : []),
        ...(inc.status === "fulfilled" ? inc.value : []),
      ];
      setMonitoringPoints(toMonitoringPoints(all));
    });
  }, []);

  useEffect(() => {
    if (!selectedZoneId) return;
    fetchZoneDetail(selectedZoneId)
      .then((data) => setZoneDetail(data as unknown as Record<string, unknown>))
      .catch(() => setZoneDetail(null));
  }, [selectedZoneId]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const selectedZone  = zones.find((z) => z.id === selectedZoneId);
  const openCount     = complaints.filter((c) => c.status === "open").length;

  const filteredComplaints = complaints.filter(c => {
    if (filterPriorities.size > 0 && !filterPriorities.has(c.priority)) return false;
    if (filterStatuses.size > 0 && !filterStatuses.has(c.status)) return false;
    if (filterCategories.size > 0 && !filterCategories.has(c.category ?? "")) return false;
    return true;
  });
  const highCount     = complaints.filter((c) => c.priority === "high"     && c.status === "open").length;
  const criticalCount = complaints.filter((c) => c.priority === "critical" && c.status === "open").length;
  const latestAqi     = (zoneDetail?.latest_air_quality as Record<string, unknown> | undefined)
    ?.value as Record<string, number> | undefined;
  const aqiVal = latestAqi?.aqi ?? 0;

  // ── Map ready callback ─────────────────────────────────────────────────────
  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    mapInstanceRef.current = map;
    setMapReady(true); // triggers the theme effect below
  }, []);

  // ── Map color theme ───────────────────────────────────────────────────────
  // Uses setPaintProperty so no layers are lost — custom GeoJSON overlays stay.
  const applyTheme = useCallback((dark: boolean) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const set = (id: string, prop: string, val: unknown) => {
      try { if (map.getLayer(id)) map.setPaintProperty(id, prop as never, val as never); } catch {}
    };

    // Layer IDs from mapbox://styles/mapbox/dark-v11
    if (dark) {
      set("land",                          "background-color",     "#0d1b2e");
      set("landcover",                     "fill-color",           "#0a1820");
      set("water-shadow",                  "fill-color",           "#040e1e");
      set("water",                         "fill-color",           "#071428");
      set("waterway-shadow",               "line-color",           "#040e1e");
      set("waterway",                      "line-color",           "#0a1832");
      set("national-park",                 "fill-color",           "#0a1c10");
      set("landuse",                       "fill-color",           "#0a1c10");
      set("building",                      "fill-color",           "#101c2d");
      set("building-extrusion",            "fill-extrusion-color",
        ["interpolate",["linear"],["get","height"],0,"#3a6090",50,"#4a7ab8",200,"#5a90d0"]);
      set("road-label",                    "text-color",           "#dce8ff");
      set("road-label",                    "text-halo-color",      "#060b14");
      set("settlement-label",              "text-color",           "#dce8ff");
      set("settlement-label",              "text-halo-color",      "#060b14");
      set("settlement-subdivision-label",  "text-color",           "#b8d0ff");
      set("settlement-subdivision-label",  "text-halo-color",      "#060b14");
      set("state-label",                   "text-color",           "#b8d0ff");
      set("country-label",                 "text-color",           "#dce8ff");
      set("admin-0-boundary",              "line-color",           "#1a2d45");
      set("admin-1-boundary",              "line-color",           "#1a2d45");
      set("admin-0-boundary-bg",           "line-color",           "#0d1b2e");
    } else {
      set("land",                          "background-color",     "#f0ede6");
      set("landcover",                     "fill-color",           "#e8e4da");
      set("water-shadow",                  "fill-color",           "#8abbd8");
      set("water",                         "fill-color",           "#a8cce8");
      set("waterway-shadow",               "line-color",           "#8abbd8");
      set("waterway",                      "line-color",           "#c0daf0");
      set("national-park",                 "fill-color",           "#cce8c4");
      set("landuse",                       "fill-color",           "#cce8c4");
      set("building",                      "fill-color",           "#e0dcd4");
      set("building-extrusion",            "fill-extrusion-color",
        ["interpolate",["linear"],["get","height"],0,"#d0ccc4",50,"#c4c0b8",200,"#b8b4ac"]);
      set("road-label",                    "text-color",           "#303038");
      set("road-label",                    "text-halo-color",      "#ffffff");
      set("settlement-label",              "text-color",           "#282830");
      set("settlement-label",              "text-halo-color",      "#ffffff");
      set("settlement-subdivision-label",  "text-color",           "#404048");
      set("settlement-subdivision-label",  "text-halo-color",      "#ffffff");
      set("state-label",                   "text-color",           "#505058");
      set("country-label",                 "text-color",           "#282830");
      set("admin-0-boundary",              "line-color",           "#a8a4a0");
      set("admin-1-boundary",              "line-color",           "#b8b4b0");
      set("admin-0-boundary-bg",           "line-color",           "#f0ede6");
      // Road lines — muted orthodox light-map palette
      set("road-motorway-trunk",           "line-color",           "#e8a050");
      set("road-motorway",                 "line-color",           "#e8a050");
      set("road-trunk",                    "line-color",           "#e8a050");
      set("road-primary",                  "line-color",           "#f0cc70");
      set("road-secondary-tertiary",       "line-color",           "#dedad2");
      set("road-street-low",               "line-color",           "#e8e4dc");
      set("road-street",                   "line-color",           "#e8e4dc");
      set("road-minor",                    "line-color",           "#ece8e0");
      set("road-path",                     "line-color",           "#dcd8ce");
      set("road-pedestrian",               "line-color",           "#e0dcd4");
      set("road-motorway-trunk-case",      "line-color",           "#c88030");
      set("road-primary-case",             "line-color",           "#d4a840");
      set("road-secondary-tertiary-case",  "line-color",           "#ccc8c0");
      set("road-street-case",              "line-color",           "#d4d0c8");
      set("road-minor-case",               "line-color",           "#d8d4cc");
    }
  }, []);

  // Apply theme when map first loads OR when the user toggles dark/light
  useEffect(() => {
    if (!mapReady) return;
    applyTheme(isDark);
  }, [isDark, mapReady, applyTheme]);

  // ── Building click → load saved name and show panel ──────────────────────
  const handleBuildingClick = useCallback(async (featureId: string, lat: number, lng: number) => {
    // If same building is clicked again (deselect), close the panel
    if (buildingPanel?.featureId === featureId) {
      setBuildingPanel(null);
      setBuildingNameInput("");
      setBuildingSaveError(null);
      return;
    }
    // Open panel — fetch any existing name from backend
    let saved: NamedBuilding | null = null;
    try { saved = await fetchNamedBuilding(featureId); } catch {}
    setBuildingPanel({ featureId, lat, lng, saved });
    setBuildingNameInput(saved?.name ?? "");
    setBuildingSaveError(null);
  }, [buildingPanel]);

  const handleBuildingSave = useCallback(async () => {
    if (!buildingPanel || !buildingNameInput.trim()) return;
    setBuildingSaving(true);
    setBuildingSaveError(null);
    try {
      const result = await saveNamedBuilding({
        feature_id: buildingPanel.featureId,
        name: buildingNameInput.trim(),
        lat: buildingPanel.lat,
        lng: buildingPanel.lng,
      });
      setBuildingPanel((prev) => prev ? { ...prev, saved: result } : prev);
      // Refresh named buildings list so search picks up the new name
      fetchNamedBuildings().then(setNamedBuildings).catch(() => {});
    } catch {
      setBuildingSaveError("Saxlama uğursuz oldu. Backend işləyirmi?");
    } finally {
      setBuildingSaving(false);
    }
  }, [buildingPanel, buildingNameInput]);

  const handleBuildingDelete = useCallback(async () => {
    if (!buildingPanel?.saved) return;
    try {
      await deleteNamedBuilding(buildingPanel.featureId);
      setBuildingPanel((prev) => prev ? { ...prev, saved: null } : prev);
      setBuildingNameInput("");
    } catch {}
  }, [buildingPanel]);

  // ── District toggle ────────────────────────────────────────────────────────
  // Side effects (setPaintProperty) must NOT go inside setState updaters —
  // React StrictMode runs updaters twice, which would toggle the shade twice.
  const handleDistrictToggle = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setDistrictOnly((prev) => {
      const next = !prev;
      // Schedule the map paint change outside the render cycle
      setTimeout(() => {
        try {
          map.setPaintProperty(
            "district-shade",
            "fill-color",
            next ? "rgba(0,0,0,1)" : "rgba(0,0,0,0.45)",
          );
        } catch {}
      }, 0);
      return next;
    });
  }, []);

  // ── Search (named buildings first, then Nominatim) ───────────────────────
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) {
      setSearchRes([]); setShowDropdown(false); setNoResults(false); return;
    }
    searchTimerRef.current = setTimeout(async () => {
      const q = value.toLowerCase().trim();

      // 1. Match saved named buildings (instant, local)
      const namedMatches: SearchResult[] = namedBuildings
        .filter((nb) => nb.name.toLowerCase().includes(q) && nb.lat != null && nb.lng != null)
        .map((nb) => ({
          id: `named_${nb.id}`,
          name: nb.name,
          address: "Saxlanılmış bina",
          lon: nb.lng!,
          lat: nb.lat!,
        }));

      // 2. Nominatim results for the district bounding box
      let nominatimResults: SearchResult[] = [];
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", value);
        url.searchParams.set("format", "json");
        url.searchParams.set("limit", "20");
        url.searchParams.set("viewbox", "49.82,40.45,49.92,40.38");
        url.searchParams.set("bounded", "1");
        url.searchParams.set("accept-language", "az,en");
        const res = await fetch(url.toString(), {
          headers: { "User-Agent": "CityFix/1.0 (narimanov.az)" },
        });
        if (res.ok) {
          const items: any[] = await res.json();
          nominatimResults = items
            .filter((i) => i.lon && i.lat)
            .slice(0, 8)
            .map((i) => {
              const parts = String(i.display_name).split(",");
              return {
                id: String(i.place_id),
                name: parts[0].trim(),
                address: parts.slice(1, 3).join(",").trim(),
                lon: parseFloat(i.lon),
                lat: parseFloat(i.lat),
              };
            });
        }
      } catch (err) {
        console.warn("[Search]", err);
      }

      // Named buildings first, then Nominatim, deduplicate by id, cap at 8
      const merged = [
        ...namedMatches,
        ...nominatimResults.filter((r) => !namedMatches.find((n) => n.id === r.id)),
      ].slice(0, 8);

      setSearchRes(merged);
      setNoResults(merged.length === 0);
      setShowDropdown(true);
    }, 400);
  }, [namedBuildings]);

  const handleSearchSelect = useCallback((result: SearchResult) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    searchMarkerRef.current?.remove();
    searchPopupRef.current?.remove();
    map.flyTo({ center: [result.lon, result.lat], zoom: 17, pitch: 45 });
    searchMarkerRef.current = new mapboxgl.Marker({ color: "#00d4ff" })
      .setLngLat([result.lon, result.lat]).addTo(map);
    searchPopupRef.current = new mapboxgl.Popup({ offset: 28, closeButton: false })
      .setLngLat([result.lon, result.lat])
      .setHTML(`<div style="font-family:system-ui,sans-serif;padding:2px 0;font-size:13px">
        <strong style="color:#111">${result.name}</strong>
        ${result.address ? `<br/><span style="color:#666;font-size:11px">${result.address}</span>` : ""}
      </div>`)
      .addTo(map);
    setQuery(result.name); setShowDropdown(false); setSearchRes([]);
  }, []);

  const handleSearchClear = useCallback(() => {
    setQuery(""); setSearchRes([]); setShowDropdown(false); setNoResults(false);
    searchMarkerRef.current?.remove(); searchMarkerRef.current = null;
    searchPopupRef.current?.remove(); searchPopupRef.current = null;
  }, []);

  // ── GPS ────────────────────────────────────────────────────────────────────
  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapInstanceRef.current?.flyTo({
          center: [coords.longitude, coords.latitude], zoom: 17, pitch: 45,
        });
      },
      () => alert("GPS icazəsi verilmədi."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // ── Fullscreen toggle — also hides the navbar ─────────────────────────────
  const handleFullscreen = useCallback(() => {
    const navbar = document.querySelector("nav") as HTMLElement | null;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      if (navbar) navbar.style.display = "none";
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      if (navbar) navbar.style.display = "";
      setIsFullscreen(false);
    }
  }, []);

  // Restore navbar if user presses Escape to exit fullscreen
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        const navbar = document.querySelector("nav") as HTMLElement | null;
        if (navbar) navbar.style.display = "";
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ── Navbar collapse (map page only) ───────────────────────────────────────
  const handleNavToggle = useCallback(() => {
    const nav = document.querySelector("nav") as HTMLElement | null;
    setNavCollapsed((prev) => {
      const next = !prev;
      setTimeout(() => {
        if (nav) nav.style.display = next ? "none" : "";
      }, 0);
      return next;
    });
  }, []);

  // Always restore navbar when leaving this page
  useEffect(() => {
    return () => {
      const nav = document.querySelector("nav") as HTMLElement | null;
      if (nav) nav.style.display = "";
    };
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      position: "fixed",
      top: (isFullscreen || navCollapsed) ? 0 : 64,
      left: 0, right: 0, bottom: 0,
      overflow: "hidden",
      background: "#06090f",
      zIndex: 40,
    }}>

      {/* ── FULL-SCREEN MAP ────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0 }}>
        <NarimanovMap
          complaints={filteredComplaints}
          monitoringPoints={monitoringPoints}
          hideBuiltinUI
          mapStyle={MAP_STYLE}
          initialBearing={-25}
          onMapReady={handleMapReady}
          onBuildingClick={handleBuildingClick}
        />
      </div>

      {/* ── Navbar collapse tab — centered at top edge of map ─────────────── */}
      {!isFullscreen && (
        <div style={{ position: "absolute", top: 0, left: "50%",
          transform: "translateX(-50%)", zIndex: 30, pointerEvents: "auto" }}>
          <button
            onClick={handleNavToggle}
            title={navCollapsed ? "Menunu göstər" : "Menunu gizlət"}
            style={{
              background: "rgba(6,11,32,0.84)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderTop: "none",
              borderRadius: "0 0 10px 10px",
              padding: "4px 20px 6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "rgba(226,232,240,0.45)",
              fontSize: 11,
            }}>
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {navCollapsed
                ? <polyline points="1 1 6 7 11 1" />   /* ∨ show navbar */
                : <polyline points="1 7 6 1 11 7" />   /* ∧ hide navbar */
              }
            </svg>
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PANEL 1 — Top-left: Zone selector + Stats                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 20,
        display: "flex", alignItems: "flex-start", pointerEvents: "auto" }}>
        {/* Sliding content */}
        <div style={{ overflow: "hidden", width: p1Collapsed ? 0 : 270,
          transition: "width 0.35s ease", flexShrink: 0 }}>
          <div style={{ ...G, padding: "16px", width: 270 }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00d4ff",
              boxShadow: "0 0 8px #00d4ff" }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
              color: "rgba(226,232,240,0.5)", textTransform: "uppercase" }}>Zona Seçin</span>
          </div>

          {/* Zone dropdown */}
          {loading ? (
            <div style={{ height: 36, background: "rgba(255,255,255,0.05)", borderRadius: 8,
              animation: "pulse 1.5s ease-in-out infinite" }} />
          ) : (
            <select
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13,
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#e2e8f0", outline: "none", cursor: "pointer", appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2300d4ff' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
              }}
            >
              {zones.map((z) => <option key={z.id} value={z.id} style={{ background: "#0a0f20" }}>{z.name_az}</option>)}
            </select>
          )}

          {/* Stats */}
          {selectedZone && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 10 }}>
                {selectedZone.name_az}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  { label: "Əhali",   value: selectedZone.population ? selectedZone.population.toLocaleString() : "--", icon: "👥" },
                  { label: "Sahə",    value: selectedZone.area_km2 ? `${selectedZone.area_km2} km²` : "--",            icon: "📐" },
                  { label: "Son AQI", value: latestAqi?.aqi ? String(latestAqi.aqi) : "--",                            icon: "🌫️",
                    valueColor: latestAqi?.aqi ? aqiColor(latestAqi.aqi) : undefined },
                ].map(({ label, value, icon, valueColor }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "rgba(226,232,240,0.5)" }}>{icon} {label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: valueColor ?? "#e2e8f0",
                      textShadow: valueColor ? `0 0 8px ${valueColor}66` : undefined }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>{/* end sliding content */}
        {/* Arrow tab */}
        <button onClick={() => setP1Collapsed(!p1Collapsed)}
          title={p1Collapsed ? "Paneli aç" : "Paneli bağla"}
          style={{ background: "rgba(6,11,32,0.84)", backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.07)",
            borderLeft: "none", borderRadius: "0 8px 8px 0", padding: "14px 5px",
            cursor: "pointer", display: "flex", alignItems: "center",
            alignSelf: "stretch", minHeight: 44, color: "rgba(226,232,240,0.5)" }}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {p1Collapsed ? <polyline points="2 2 8 8 2 14" /> : <polyline points="8 2 2 8 8 14" />}
          </svg>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PANEL 2 — Bottom-left: Complaints stats + legend                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ position: "absolute", bottom: 16, left: 16, zIndex: 20,
        display: "flex", alignItems: "flex-start", pointerEvents: "auto" }}>
        <div style={{ overflow: "hidden", width: p2Collapsed ? 0 : 260,
          transition: "width 0.35s ease", flexShrink: 0 }}>
          <div style={{ ...G, padding: "16px", width: 260 }}>

          {/* Complaint stats */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            color: "rgba(226,232,240,0.5)", textTransform: "uppercase", marginBottom: 12 }}>
            Şikayət Statistikası
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Açıq",     count: openCount,     color: "#60a5fa" },
              { label: "Yüksək",   count: highCount,     color: "#f97316" },
              { label: "Kritik",   count: criticalCount, color: "#ef4444" },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10,
                padding: "10px 8px", textAlign: "center", border: `1px solid ${color}22` }}>
                <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1,
                  textShadow: `0 0 12px ${color}66` }}>{count}</div>
                <div style={{ fontSize: 10, color: "rgba(226,232,240,0.45)", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Priority legend */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              color: "rgba(226,232,240,0.4)", textTransform: "uppercase", marginBottom: 8 }}>
              Şikayət Prioriteti
            </div>
            {PRIORITY_LEGEND.map(({ label, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8,
                marginBottom: 6, fontSize: 12, color: "rgba(226,232,240,0.7)" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                  background: color, boxShadow: `0 0 6px ${color}88` }} />
                {label}
              </div>
            ))}
          </div>

          {/* Monitoring legend */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              color: "rgba(226,232,240,0.4)", textTransform: "uppercase", marginBottom: 8 }}>
              Monitorinq Növü
            </div>
            {MONITORING_LEGEND.map(({ label, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8,
                marginBottom: 6, fontSize: 12, color: "rgba(226,232,240,0.7)" }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
                  background: `${color}55`, border: `2px solid ${color}`,
                  boxShadow: `0 0 6px ${color}66` }} />
                {label}
              </div>
            ))}
          </div>
          </div>
        </div>{/* end sliding content */}
        {/* Arrow tab */}
        <button onClick={() => setP2Collapsed(!p2Collapsed)}
          title={p2Collapsed ? "Paneli aç" : "Paneli bağla"}
          style={{ background: "rgba(6,11,32,0.84)", backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.07)",
            borderLeft: "none", borderRadius: "0 8px 8px 0", padding: "14px 5px",
            cursor: "pointer", display: "flex", alignItems: "center",
            alignSelf: "stretch", minHeight: 44, color: "rgba(226,232,240,0.5)" }}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {p2Collapsed ? <polyline points="2 2 8 8 2 14" /> : <polyline points="8 2 2 8 8 14" />}
          </svg>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PANEL 3 — Top-center: Search bar                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 30, display: "flex", alignItems: "flex-start", pointerEvents: "auto",
        maxWidth: "min(460px, calc(100% - 560px))", width: "100%" }}>
        {/* Sliding search content */}
        <div style={{ overflow: "hidden", width: p3Collapsed ? 0 : "100%",
          minWidth: p3Collapsed ? 0 : "min(420px, calc(100vw - 560px))",
          transition: "min-width 0.35s ease, width 0.35s ease", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          {/* Search input */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <svg style={{ position: "absolute", left: 14, flexShrink: 0 }}
              width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="rgba(0,212,255,0.7)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchRes.length > 0 && setShowDropdown(true)}
              placeholder="Nərimanov rayonunda axtarış..."
              style={{
                width: "100%", padding: "11px 38px 11px 38px",
                ...G,
                borderRadius: 12, fontSize: 13, outline: "none",
                color: "#e2e8f0", boxSizing: "border-box",
                "::placeholder": { color: "rgba(226,232,240,0.35)" } as any,
              } as React.CSSProperties}
            />
            {query && (
              <button onClick={handleSearchClear}
                style={{ position: "absolute", right: 12, background: "none", border: "none",
                  cursor: "pointer", color: "rgba(226,232,240,0.4)", fontSize: 18, padding: 0,
                  lineHeight: 1, display: "flex" }}>×</button>
            )}
            <button onClick={handleGPS}
              title="GPS"
              style={{ position: "absolute", right: query ? 36 : 12,
                background: "none", border: "none", cursor: "pointer", padding: 0,
                display: "flex", alignItems: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="rgba(0,212,255,0.6)" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
            </button>
          </div>

          {/* Dropdown */}
          {showDropdown && (searchRes.length > 0 || noResults) && (
            <div style={{ ...G, marginTop: 6, overflow: "hidden", borderRadius: 12 }}>
              {noResults ? (
                <div style={{ padding: "14px 16px", color: "rgba(226,232,240,0.5)", fontSize: 13 }}>
                  Bu axtarış Nərimanov rayonu üçün nəticə vermədi
                </div>
              ) : searchRes.map((r, i) => (
                <button key={r.id} onClick={() => handleSearchSelect(r)}
                  style={{
                    display: "block", width: "100%", padding: "11px 16px", textAlign: "left",
                    background: "none", border: "none",
                    borderBottom: i < searchRes.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    cursor: "pointer", transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,212,255,0.07)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0" }}>{r.name}</span>
                    {r.id.startsWith("named_") && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#00d4ff",
                        background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)",
                        padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>
                        Saxlanılmış
                      </span>
                    )}
                  </div>
                  {r.address && r.address !== "Saxlanılmış bina" && (
                    <div style={{ fontSize: 11, color: "rgba(226,232,240,0.4)", marginTop: 2 }}>{r.address}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        </div>{/* end sliding search content */}
        {/* Arrow tab for search */}
        <button onClick={() => setP3Collapsed(!p3Collapsed)}
          title={p3Collapsed ? "Axtarışı aç" : "Axtarışı bağla"}
          style={{ background: "rgba(6,11,32,0.84)", backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.07)",
            borderLeft: "none", borderRadius: "0 8px 8px 0", padding: "10px 5px",
            cursor: "pointer", display: "flex", alignItems: "center", alignSelf: "stretch",
            color: "rgba(226,232,240,0.5)", flexShrink: 0 }}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {p3Collapsed ? <polyline points="2 2 8 8 2 14" /> : <polyline points="8 2 2 8 8 14" />}
          </svg>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PANEL 4 — Top-right: Title badge + fullscreen (always visible)    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 30,
        display: "flex", alignItems: "center", gap: 8 }}>

        {/* Dark / Light mode toggle */}
        <button
          onClick={() => setIsDark((d) => !d)}
          title={isDark ? "Açıq rejimə keç" : "Qaranlıq rejimə keç"}
          style={{ ...G, padding: "8px 10px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.07)",
            cursor: "pointer", background: "rgba(6,11,32,0.84)" as any,
            display: "flex", alignItems: "center", transition: "all 0.2s" }}>
          {isDark ? (
            /* Sun — click to go light */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,220,80,0.85)" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          ) : (
            /* Moon — click to go dark */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="rgba(180,200,255,0.85)" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        {/* Narimanov live badge */}
        <div style={{ ...G, padding: "8px 14px", borderRadius: 12,
          display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00d4ff",
            boxShadow: "0 0 10px #00d4ff", animation: "ping 2s ease-in-out infinite" }} />
          <style>{`@keyframes ping{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>Nərimanov rayonu</span>
          <span style={{ fontSize: 10, color: "rgba(226,232,240,0.4)", background: "rgba(0,212,255,0.1)",
            padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(0,212,255,0.2)" }}>CANLI</span>
        </div>

        {/* Fullscreen button */}
        <button onClick={handleFullscreen}
          title={isFullscreen ? "Tam ekrandan çıx" : "Tam ekran"}
          style={{ ...G, padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)",
            cursor: "pointer", background: "rgba(6,11,32,0.84)" as any, display: "flex" }}>
          {isFullscreen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="rgba(226,232,240,0.6)" strokeWidth="2" strokeLinecap="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="rgba(226,232,240,0.6)" strokeWidth="2" strokeLinecap="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* BUILDING NAME PANEL — slides in from right when building selected  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
        zIndex: 25, width: buildingPanel ? 280 : 0,
        overflow: "hidden", transition: "width 0.35s ease", pointerEvents: "auto",
      }}>
        {buildingPanel && (
          <div style={{ ...G, padding: 18, width: 280 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>Bina Məlumatı</span>
              </div>
              <button onClick={() => { setBuildingPanel(null); setBuildingNameInput(""); }}
                style={{ background: "none", border: "none", cursor: "pointer",
                  color: "rgba(226,232,240,0.4)", fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
            </div>

            {/* Coordinates */}
            <div style={{ fontSize: 11, color: "rgba(226,232,240,0.4)", marginBottom: 14,
              fontFamily: "monospace" }}>
              {buildingPanel.lat.toFixed(5)}, {buildingPanel.lng.toFixed(5)}
            </div>

            {/* Saved name display */}
            {buildingPanel.saved && (
              <div style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)",
                borderRadius: 10, padding: "10px 12px", marginBottom: 12,
                display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#00d4ff" }}>
                  {buildingPanel.saved.name}
                </span>
                <button onClick={handleBuildingDelete}
                  title="Adı sil"
                  style={{ background: "none", border: "none", cursor: "pointer",
                    color: "#ef4444", fontSize: 13, padding: 0 }}>✕</button>
              </div>
            )}

            {/* Name input */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "rgba(226,232,240,0.5)",
                display: "block", marginBottom: 6 }}>
                {buildingPanel.saved ? "Adı redaktə et" : "Binaya ad ver"}
              </label>
              <input
                type="text"
                value={buildingNameInput}
                onChange={(e) => setBuildingNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBuildingSave()}
                placeholder="məs. Gənclik Plaza"
                autoFocus
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13,
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "#e2e8f0", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Error */}
            {buildingSaveError && (
              <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 8 }}>{buildingSaveError}</p>
            )}

            {/* Save button */}
            <button
              onClick={handleBuildingSave}
              disabled={buildingSaving || !buildingNameInput.trim()}
              style={{
                width: "100%", padding: "9px 0", borderRadius: 8, border: "none",
                cursor: buildingNameInput.trim() ? "pointer" : "not-allowed",
                fontSize: 13, fontWeight: 600,
                background: buildingNameInput.trim()
                  ? "linear-gradient(135deg, #0078FF, #00d4ff)" : "rgba(255,255,255,0.07)",
                color: buildingNameInput.trim() ? "#fff" : "rgba(226,232,240,0.3)",
                transition: "all 0.2s",
              }}
            >
              {buildingSaving ? "Saxlanılır..." : buildingPanel.saved ? "Yenilə" : "Saxla"}
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PANEL 5 — Bottom-right: AQI card + District toggle                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 20,
        display: "flex", alignItems: "flex-start", pointerEvents: "auto" }}>
        {/* Arrow tab on the LEFT for right-side panel */}
        <button onClick={() => setP5Collapsed(!p5Collapsed)}
          title={p5Collapsed ? "Paneli aç" : "Paneli bağla"}
          style={{ background: "rgba(6,11,32,0.84)", backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.07)",
            borderRight: "none", borderRadius: "8px 0 0 8px", padding: "14px 5px",
            cursor: "pointer", display: "flex", alignItems: "center",
            alignSelf: "stretch", minHeight: 44, color: "rgba(226,232,240,0.5)", flexShrink: 0 }}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {p5Collapsed ? <polyline points="8 2 2 8 8 14" /> : <polyline points="2 2 8 8 2 14" />}
          </svg>
        </button>
        {/* Sliding content */}
        <div style={{ overflow: "hidden", width: p5Collapsed ? 0 : 240,
          transition: "width 0.35s ease", flexShrink: 0 }}>
        <div style={{ ...G, padding: "16px", width: 240 }}>

          {/* AQI Section */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            color: "rgba(226,232,240,0.5)", textTransform: "uppercase", marginBottom: 12 }}>
            Hava Keyfiyyəti
          </div>
          {aqiVal > 0 ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: aqiColor(aqiVal),
                  textShadow: `0 0 20px ${aqiColor(aqiVal)}66`, lineHeight: 1 }}>{aqiVal}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: aqiColor(aqiVal) }}>{aqiLabel(aqiVal)}</div>
                  <div style={{ fontSize: 10, color: "rgba(226,232,240,0.4)" }}>AQI İndeksi</div>
                </div>
              </div>
              {/* AQI bar */}
              <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (aqiVal / 200) * 100)}%`,
                  background: `linear-gradient(90deg, #22c55e, ${aqiColor(aqiVal)})`,
                  borderRadius: 4, transition: "width 0.8s ease" }} />
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 14, color: "rgba(226,232,240,0.35)", fontSize: 12 }}>
              Məlumat yoxdur
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 14 }} />

          {/* District toggle */}
          <button
            onClick={handleDistrictToggle}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              border: `1px solid ${districtOnly ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.08)"}`,
              cursor: "pointer", fontSize: 12, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: districtOnly ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.05)",
              color: districtOnly ? "#00d4ff" : "rgba(226,232,240,0.7)",
              transition: "all 0.2s",
              boxShadow: districtOnly ? "0 0 16px rgba(0,212,255,0.15)" : "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            {districtOnly ? "Tam Xəritə" : "Rayon Rejimi"}
          </button>
        </div>
        </div>{/* end sliding content */}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PANEL 6 — Right-middle: Complaint filters                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        position: "absolute", top: 96, right: 16, zIndex: 20,
        display: "flex", alignItems: "flex-start", pointerEvents: "auto",
      }}>
        {/* Arrow tab on the LEFT (right-side panel) */}
        <button
          onClick={() => setP6Collapsed(!p6Collapsed)}
          title={p6Collapsed ? "Filtri aç" : "Filtri bağla"}
          style={{
            background: "rgba(6,11,32,0.84)", backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.07)",
            borderRight: "none", borderRadius: "8px 0 0 8px", padding: "10px 6px",
            cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center",
            gap: 4, alignSelf: "stretch", minHeight: 44,
            color: activeFilterCount > 0 ? "#00d4ff" : "rgba(226,232,240,0.5)",
            flexShrink: 0, position: "relative",
          }}
        >
          {/* Filter funnel icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          {activeFilterCount > 0 && (
            <span style={{
              width: 16, height: 16, borderRadius: "50%",
              background: "#00d4ff", color: "#06090f",
              fontSize: 9, fontWeight: 800, lineHeight: "16px", textAlign: "center",
            }}>{activeFilterCount}</span>
          )}
        </button>

        {/* Sliding panel content */}
        <div style={{
          overflow: "hidden", width: p6Collapsed ? 0 : 252,
          transition: "width 0.35s ease", flexShrink: 0,
        }}>
          <div style={{ ...G, padding: 16, width: 252 }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00d4ff", boxShadow: "0 0 8px #00d4ff" }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(226,232,240,0.5)", textTransform: "uppercase" }}>Filtr</span>
              </div>
              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters} style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 11, color: "#00d4ff", fontFamily: "system-ui,sans-serif",
                }}>Sıfırla</button>
              )}
            </div>

            {/* Priority */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(226,232,240,0.4)", textTransform: "uppercase", marginBottom: 8 }}>Kritiklik</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {PRIORITY_FILTER_OPTS.map(o => (
                  <FilterChip key={o.value} label={o.label} color={o.color}
                    selected={filterPriorities.has(o.value)}
                    onClick={() => toggleFilter(setFilterPriorities, o.value)} />
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 14 }} />

            {/* Status */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(226,232,240,0.4)", textTransform: "uppercase", marginBottom: 8 }}>Status</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {STATUS_FILTER_OPTS.map(o => (
                  <FilterChip key={o.value} label={o.label} color={o.color}
                    selected={filterStatuses.has(o.value)}
                    onClick={() => toggleFilter(setFilterStatuses, o.value)} />
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 14 }} />

            {/* Category */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(226,232,240,0.4)", textTransform: "uppercase", marginBottom: 8 }}>Kateqoriya</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {CATEGORY_FILTER_OPTS.map(o => (
                  <FilterChip key={o.value} label={o.label} color={o.color}
                    selected={filterCategories.has(o.value)}
                    onClick={() => toggleFilter(setFilterCategories, o.value)} />
                ))}
              </div>
            </div>

            {/* Result count */}
            <div style={{
              marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)",
              fontSize: 12, color: "rgba(226,232,240,0.55)", textAlign: "center",
            }}>
              {activeFilterCount > 0
                ? `${filteredComplaints.length} / ${complaints.length} şikayət`
                : `${complaints.length} şikayət`}
            </div>

          </div>
        </div>
      </div>

      {/* Global styles scoped to this page */}
      <style>{`
        input::placeholder { color: rgba(226,232,240,0.3) !important; }
        select option { background: #0a0f20; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

        /* Hide footer, prevent scroll, hide mobile nav strip on map page */
        body { overflow: hidden !important; }
        footer { display: none !important; }
        main { overflow: hidden !important; padding: 0 !important; margin: 0 !important; }
        header > div:last-child { display: none !important; }
      `}</style>
    </div>
  );
}

export default function MapPage() {
  return (
    <RoleGuard roles={["admin", "operator"]}>
      <MapPageContent />
    </RoleGuard>
  );
}
