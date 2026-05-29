"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { fetchZones, fetchZoneDetail, fetchComplaints } from "@/lib/api";
import type { Complaint, DistrictZone } from "@/lib/types";

// 2GIS MapGL uses window — must be client-side only
const NarimanovMap = dynamic(() => import("@/components/NarimanovMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
      <p className="text-gray-500 text-sm">Xəritə yüklənir...</p>
    </div>
  ),
});

const PRIORITY_LEGEND = [
  { label: "Aşağı (30 gün)",   color: "#22c55e" },
  { label: "Orta (14 gün)",    color: "#3b82f6" },
  { label: "Yüksək (7 gün)",   color: "#f97316" },
  { label: "Kritik (48 saat)", color: "#ef4444" },
] as const;

export default function MapPage() {
  const [zones, setZones] = useState<DistrictZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [zoneDetail, setZoneDetail] = useState<Record<string, unknown> | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchZones()
      .then((data) => {
        setZones(data);
        if (data.length > 0) setSelectedZoneId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetchComplaints(undefined, 200).then(setComplaints).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedZoneId) return;
    fetchZoneDetail(selectedZoneId)
      .then((data) => setZoneDetail(data as Record<string, unknown>))
      .catch(() => setZoneDetail(null));
  }, [selectedZoneId]);

  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  const criticalCount = complaints.filter((c) => c.priority === "critical" && c.status === "open").length;
  const highCount = complaints.filter((c) => c.priority === "high" && c.status === "open").length;
  const openCount = complaints.filter((c) => c.status === "open").length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Rayon Xəritəsi</h1>
      <p className="text-gray-600 mb-6 text-sm">Nərimanov rayonunun monitorinq zonaları və şikayət xəritəsi</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Zone selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Zona seçin</label>
            {loading ? (
              <p className="text-gray-500 text-sm">Yüklənir...</p>
            ) : (
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>{zone.name_az}</option>
                ))}
              </select>
            )}

            {selectedZone && (
              <div className="mt-3 bg-white border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
                <h3 className="font-semibold text-gray-900">{selectedZone.name_az}</h3>
                {selectedZone.population && (
                  <p className="text-gray-600">Əhali: <span className="font-medium">{selectedZone.population.toLocaleString()}</span></p>
                )}
                {selectedZone.area_km2 && (
                  <p className="text-gray-600">Sahə: <span className="font-medium">{selectedZone.area_km2} km²</span></p>
                )}
                {zoneDetail?.latest_air_quality && (
                  <p className="text-gray-600">
                    Son AQI: <span className="font-medium">
                      {((zoneDetail.latest_air_quality as Record<string, unknown>).value as Record<string, number>)?.aqi ?? "--"}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Complaint summary */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Şikayət Statistikası</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Açıq şikayətlər</span>
                <span className="font-semibold text-gray-900">{openCount}</span>
              </div>
              {highCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-orange-600">Yüksək prioritetli</span>
                  <span className="font-semibold text-orange-700">{highCount}</span>
                </div>
              )}
              {criticalCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-red-600">Kritik (48 saat)</span>
                  <span className="font-semibold text-red-700">{criticalCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Priority legend */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Prioritet Rəngi</h3>
            <div className="space-y-2">
              {PRIORITY_LEGEND.map((item) => (
                <div key={item.label} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Map */}
        <div className="lg:col-span-2">
          <div className="relative w-full h-[600px] rounded-xl overflow-hidden shadow">
            <NarimanovMap complaints={complaints} />
          </div>
        </div>

      </div>
    </div>
  );
}
