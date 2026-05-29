"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { fetchZones, fetchZoneDetail } from "@/lib/api";
import type { DistrictZone } from "@/lib/types";

// 2GIS MapGL uses window — must be client-side only
const NarimanovMap = dynamic(() => import("@/components/NarimanovMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
      <p className="text-gray-500 text-sm">Xəritə yüklənir...</p>
    </div>
  ),
});

export default function MapPage() {
  const [zones, setZones] = useState<DistrictZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [zoneDetail, setZoneDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchZones()
      .then((data) => {
        setZones(data);
        if (data.length > 0) setSelectedZoneId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedZoneId) return;
    fetchZoneDetail(selectedZoneId)
      .then((data) => setZoneDetail(data as Record<string, unknown>))
      .catch(() => setZoneDetail(null));
  }, [selectedZoneId]);

  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Rayon Xəritəsi</h1>
      <p className="text-gray-600 mb-6 text-sm">Nərimanov rayonunun monitorinq zonaları</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
            <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
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

        {/* 2GIS 3D Map — Nərimanov district */}
        <div className="lg:col-span-2">
          <div className="relative w-full h-[600px] rounded-xl overflow-hidden shadow">
            <NarimanovMap />
          </div>
        </div>
      </div>
    </div>
  );
}
