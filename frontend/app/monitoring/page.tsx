"use client";

import { useEffect, useState } from "react";
import { fetchAirQuality, fetchTraffic, fetchUtilities, fetchIncidents } from "@/lib/api";
import type { MonitoringData, AirQualityValue, TrafficValue } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import MonitoringCard from "@/components/MonitoringCard";

type Tab = "air" | "traffic" | "utilities" | "incidents";

/* UI placeholder — replace with your design */
export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<Tab>("air");
  const [airData, setAirData] = useState<MonitoringData[]>([]);
  const [trafficData, setTrafficData] = useState<MonitoringData[]>([]);
  const [utilitiesData, setUtilitiesData] = useState<MonitoringData[]>([]);
  const [incidentsData, setIncidentsData] = useState<MonitoringData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      const [air, traffic, util, inc] = await Promise.allSettled([
        fetchAirQuality(),
        fetchTraffic(),
        fetchUtilities(),
        fetchIncidents(),
      ]);
      if (air.status === "fulfilled") setAirData(air.value);
      if (traffic.status === "fulfilled") setTrafficData(traffic.value);
      if (util.status === "fulfilled") setUtilitiesData(util.value);
      if (inc.status === "fulfilled") setIncidentsData(inc.value);
      setLoading(false);
    }
    loadAll();
  }, []);

  useEffect(() => {
    // Realtime subscription for live monitoring updates
    const channel = supabase
      .channel("monitoring-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "monitoring_data" },
        (payload) => {
          const row = payload.new as MonitoringData;
          if (row.type === "air_quality") setAirData((prev) => [row, ...prev].slice(0, 50));
          if (row.type === "traffic") setTrafficData((prev) => [row, ...prev].slice(0, 50));
          if (row.type === "utilities") setUtilitiesData((prev) => [row, ...prev].slice(0, 50));
          if (row.type === "incident") setIncidentsData((prev) => [row, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: "air", label: "Hava" },
    { id: "traffic", label: "Trafik" },
    { id: "utilities", label: "Kommunal" },
    { id: "incidents", label: "Hadisələr" },
  ];

  const latestAir = airData[0]?.value as AirQualityValue | undefined;
  const latestTraffic = trafficData[0]?.value as TrafficValue | undefined;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Canlı Monitorinq</h1>
      <p className="text-gray-600 mb-6 text-sm">Məlumatlar real vaxt rejimində yenilənir</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MonitoringCard
          title="Hava Keyfiyyəti (AQI)"
          value={latestAir?.aqi ?? "--"}
          unit=""
          status={latestAir ? (latestAir.aqi < 50 ? "good" : latestAir.aqi < 100 ? "warning" : "critical") : "unknown"}
          subtitle={latestAir?.status}
        />
        <MonitoringCard
          title="PM2.5"
          value={latestAir?.pm25 ?? "--"}
          unit="µg/m³"
          status={latestAir ? (latestAir.pm25 < 12 ? "good" : latestAir.pm25 < 35 ? "warning" : "critical") : "unknown"}
        />
        <MonitoringCard
          title="Yol Yükü"
          value={latestTraffic?.congestion_pct ?? "--"}
          unit="%"
          status={latestTraffic ? (latestTraffic.congestion_pct < 50 ? "good" : latestTraffic.congestion_pct < 80 ? "warning" : "critical") : "unknown"}
          subtitle={latestTraffic?.status}
        />
        <MonitoringCard
          title="Aktiv Hadisələr"
          value={incidentsData.length}
          unit=""
          status={incidentsData.length === 0 ? "good" : incidentsData.length < 3 ? "warning" : "critical"}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-brand text-brand"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TODO: add charts using recharts or chart.js */}

      {loading ? (
        <p className="text-gray-500 py-8 text-center">Yüklənir...</p>
      ) : (
        <DataTable rows={
          activeTab === "air" ? airData :
          activeTab === "traffic" ? trafficData :
          activeTab === "utilities" ? utilitiesData :
          incidentsData
        } />
      )}
    </div>
  );
}

function DataTable({ rows }: { rows: MonitoringData[] }) {
  if (rows.length === 0) return <p className="text-gray-500 py-8 text-center">Məlumat yoxdur</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="px-3 py-2 font-medium text-gray-700">Tarix</th>
            <th className="px-3 py-2 font-medium text-gray-700">Mənbə</th>
            <th className="px-3 py-2 font-medium text-gray-700">Məlumat</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-gray-200 hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-600">
                {new Date(row.recorded_at).toLocaleString("az-AZ")}
              </td>
              <td className="px-3 py-2 text-gray-600">{row.source}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-800">
                {JSON.stringify(row.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
