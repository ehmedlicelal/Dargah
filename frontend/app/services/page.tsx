"use client";

import { useEffect, useState } from "react";
import type { Service } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

const categoryLabels: Record<string, string> = {
  utilities: "Kommunal",
  roads: "Yollar",
  environment: "Ekologiya",
  safety: "Təhlükəsizlik",
  social: "Sosial",
};

/* UI placeholder — replace with your design */
export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: connect real API here — fetching from Supabase directly for services
    fetch(`${BACKEND_URL}/open-data/`)
      .then((r) => r.json())
      .then(() => {
        // Fallback: fetch services from Supabase open-data endpoint
        // TODO: add a dedicated /services endpoint on FastAPI
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Direct Supabase fetch for services table (public read via RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      fetch(`${supabaseUrl}/rest/v1/services?select=*&is_active=eq.true`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      })
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setServices(data); })
        .catch(() => {});
    }
  }, []);

  const filtered = services.filter(
    (s) =>
      s.name_az.toLowerCase().includes(search.toLowerCase()) ||
      (s.description_az ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Rayon Xidmətləri</h1>
      <p className="text-gray-600 mb-6 text-sm">Nərimanov rayonunun kommunal və sosial xidmətləri</p>

      <input
        type="text"
        placeholder="Xidmət axtar..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-brand"
      />

      {loading ? (
        <p className="text-gray-500">Yüklənir...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">Xidmət tapılmadı</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const category = service.category ? (categoryLabels[service.category] ?? service.category) : null;
  return (
    /* UI placeholder — replace with your design */
    <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-gray-900">{service.name_az}</h3>
        {category && (
          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">{category}</span>
        )}
      </div>
      {service.description_az && (
        <p className="text-sm text-gray-600 mt-2">{service.description_az}</p>
      )}
      <div className="mt-3 space-y-1 text-sm text-gray-500">
        {service.contact_phone && <p>📞 {service.contact_phone}</p>}
        {service.contact_email && <p>✉️ {service.contact_email}</p>}
        {service.working_hours && <p>🕐 {service.working_hours}</p>}
      </div>
    </div>
  );
}
