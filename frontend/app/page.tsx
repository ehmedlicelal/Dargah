import Link from "next/link";
import { fetchAirQuality, fetchIncidents, fetchTraffic, fetchZones } from "@/lib/api";

// TODO: connect real API here — currently using fallback values on error
async function getDashboardStats() {
  try {
    const [airData, trafficData, incidents, zones] = await Promise.allSettled([
      fetchAirQuality(undefined, 1),
      fetchTraffic(undefined, 1),
      fetchIncidents(undefined, 5),
      fetchZones(),
    ]);

    return {
      latestAqi: airData.status === "fulfilled" && airData.value[0]
        ? (airData.value[0].value as { aqi?: number }).aqi ?? "--"
        : "--",
      trafficCongestion: trafficData.status === "fulfilled" && trafficData.value[0]
        ? (trafficData.value[0].value as { congestion_pct?: number }).congestion_pct ?? "--"
        : "--",
      activeIncidents: incidents.status === "fulfilled" ? incidents.value.length : 0,
      zoneCount: zones.status === "fulfilled" ? zones.value.length : 0,
    };
  } catch {
    return { latestAqi: "--", trafficCongestion: "--", activeIncidents: 0, zoneCount: 0 };
  }
}

export default async function HomePage() {
  const stats = await getDashboardStats();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">

      {/* UI placeholder — replace with your design */}
      {/* ====== HERO ====== */}
      <section className="bg-brand text-white rounded-xl p-10 text-center">
        <h1 className="text-3xl font-bold mb-2">Nərimanov Rəqəmsal</h1>
        <p className="text-blue-100 mb-6 max-w-xl mx-auto">
          Nərimanov rayonunun rəsmi rəqəmsal monitorinq, xidmət və vətəndaş məlumatlandırma platforması.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/complaints"
            className="bg-white text-brand font-semibold px-6 py-2 rounded-lg hover:bg-blue-50"
          >
            Şikayət Bildir
          </Link>
          <Link
            href="/monitoring"
            className="border border-white text-white font-semibold px-6 py-2 rounded-lg hover:bg-brand-dark"
          >
            Monitorinqa Bax
          </Link>
        </div>
      </section>

      {/* ====== STATS ====== */}
      {/* UI placeholder — replace with your design */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Canlı Göstəricilər</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Hava Keyfiyyəti (AQI)" value={stats.latestAqi} unit="" color="bg-green-50 border-green-300" />
          <StatCard label="Yol Yükü" value={stats.trafficCongestion} unit="%" color="bg-yellow-50 border-yellow-300" />
          <StatCard label="Aktiv Hadisələr" value={stats.activeIncidents} unit="" color="bg-red-50 border-red-300" />
          <StatCard label="Monitorinq Zonaları" value={stats.zoneCount} unit="" color="bg-blue-50 border-blue-300" />
        </div>
      </section>

      {/* ====== SERVICES PREVIEW ====== */}
      {/* UI placeholder — replace with your design */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Xidmətlər</h2>
          <Link href="/services" className="text-brand text-sm hover:underline">Hamısına bax →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ServiceCard title="Su Kəməri Xidməti" desc="Su kəməri, kanalizasiya sistemi" icon="💧" />
          <ServiceCard title="Yol Xidməti" desc="Yolların təmiri və asfaltlanması" icon="🛣️" />
          <ServiceCard title="Sosial Xidmətlər" desc="Sosial yardım və sənəd rəsmiləşdirmə" icon="🏛️" />
        </div>
      </section>

      {/* ====== MAP PLACEHOLDER ====== */}
      {/* UI placeholder — replace with your design — TODO: integrate Leaflet */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Rayon Xəritəsi</h2>
          <Link href="/map" className="text-brand text-sm hover:underline">Tam xəritəyə bax →</Link>
        </div>
        <div className="w-full h-64 bg-gray-200 border border-gray-300 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-4xl mb-2">🗺️</p>
            <p className="font-medium">Xəritə — TODO: Leaflet inteqrasiyası</p>
            <p className="text-sm">npm install react-leaflet leaflet</p>
          </div>
        </div>
      </section>

    </div>
  );
}

function StatCard({ label, value, unit, color }: { label: string; value: string | number; unit: string; color: string }) {
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <p className="text-xs text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}<span className="text-sm ml-1">{unit}</span></p>
    </div>
  );
}

function ServiceCard({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{desc}</p>
    </div>
  );
}
