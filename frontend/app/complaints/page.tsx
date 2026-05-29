"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createComplaint, fetchComplaints, fetchZones } from "@/lib/api";
import type { Complaint, ComplaintCreate, DistrictZone } from "@/lib/types";
import ComplaintCard from "@/components/ComplaintCard";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

const NarimanovMap = dynamic(() => import("@/components/NarimanovMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
      <p className="text-gray-500 text-sm">Xəritə yüklənir...</p>
    </div>
  ),
});

const PRIORITY_OPTIONS = [
  {
    value: "low" as const,
    label: "Aşağı",
    deadline: "30 gün",
    activeBg: "bg-green-50",
    activeBorder: "border-green-500",
    activeText: "text-green-700",
    dot: "#22c55e",
  },
  {
    value: "medium" as const,
    label: "Orta",
    deadline: "14 gün",
    activeBg: "bg-blue-50",
    activeBorder: "border-blue-500",
    activeText: "text-blue-700",
    dot: "#3b82f6",
  },
  {
    value: "high" as const,
    label: "Yüksək",
    deadline: "7 gün",
    activeBg: "bg-orange-50",
    activeBorder: "border-orange-500",
    activeText: "text-orange-700",
    dot: "#f97316",
  },
  {
    value: "critical" as const,
    label: "Kritik",
    deadline: "48 saat",
    activeBg: "bg-red-50",
    activeBorder: "border-red-500",
    activeText: "text-red-700",
    dot: "#ef4444",
  },
] as const;

export default function ComplaintsPage() {
  const [zones, setZones] = useState<DistrictZone[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<ComplaintCreate>({ title: "", description: "" });
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
    fetchZones().then(setZones).catch(() => {});
    fetchComplaints(undefined, 20).then(setComplaints).catch(() => {});
  }, []);

  function handleLocationSelect(lat: number, lng: number) {
    setSelectedLocation({ lat, lng });
    setForm((prev) => ({ ...prev, lat, lng }));
  }

  function clearLocation() {
    setSelectedLocation(null);
    setForm((prev) => ({ ...prev, lat: undefined, lng: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!form.priority) {
      setSubmitError("Zəhmət olmasa kritiklik səviyyəsini seçin.");
      return;
    }
    if (!selectedLocation) {
      setSubmitError("Zəhmət olmasa xəritədə problemi olan yeri seçin.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createComplaint(form);
      setComplaints((prev) => [created, ...prev]);
      setForm({ title: "", description: "" });
      setSelectedLocation(null);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch {
      setSubmitError("Şikayət göndərilmədi. Yenidən cəhd edin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Şikayətlər</h1>
      <p className="text-gray-600 mb-8 text-sm">Rayon problemlərini bildir, icrasını izlə</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── Submit form ── */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Yeni Şikayət</h2>

          {!isLoggedIn ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
              <p className="text-yellow-800">Şikayət bildirmək üçün sistemə daxil olmalısınız.</p>
              <Link href="/auth/login" className="text-brand font-medium hover:underline mt-1 inline-block">
                Daxil Ol →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 bg-white border border-gray-200 rounded-lg p-5 shadow-sm">

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mövzu *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Şikayətin qısa başlığı"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ətraflı açıqlama *</label>
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                  placeholder="Problem haqqında ətraflı məlumat yazın..."
                />
              </div>

              {/* Priority selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kritiklik Səviyyəsi *
                  <span className="text-gray-400 font-normal ml-1">(həll müddəti müəyyən edir)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITY_OPTIONS.map((opt) => {
                    const selected = form.priority === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm({ ...form, priority: opt.value })}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          selected
                            ? `${opt.activeBg} ${opt.activeBorder}`
                            : "bg-white border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: opt.dot }}
                          />
                          <span className={`font-medium text-sm ${selected ? opt.activeText : "text-gray-700"}`}>
                            {opt.label}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 pl-4">Son müddət: {opt.deadline}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Zone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
                <select
                  value={form.zone_id ?? ""}
                  onChange={(e) => setForm({ ...form, zone_id: e.target.value || undefined })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="">Zona seçin (ixtiyari)</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name_az}</option>
                  ))}
                </select>
              </div>

              {/* Selected location indicator */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lokasiya *</label>
                {selectedLocation ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-green-800 font-medium">Seçildi</span>
                    <span className="text-green-600 text-xs">
                      {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
                    </span>
                    <button
                      type="button"
                      onClick={clearLocation}
                      className="ml-auto text-green-500 hover:text-green-700 text-base leading-none"
                      aria-label="Lokasiyanu sil"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    Sağdakı xəritədə nöqtəyə klikləyin
                  </p>
                )}
              </div>

              {submitSuccess && (
                <p className="text-green-700 text-sm bg-green-50 border border-green-200 rounded px-3 py-2">
                  Şikayətiniz qəbul edildi. AI təsnifatı aparılır...
                </p>
              )}
              {submitError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand text-white rounded-lg py-2 font-medium hover:bg-brand-dark disabled:opacity-50"
              >
                {submitting ? "Göndərilir..." : "Şikayət Göndər"}
              </button>
            </form>
          )}
        </div>

        {/* ── Right column: map picker + complaints list ── */}
        <div className="flex flex-col gap-6">

          {/* Location picker map */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Lokasiya Seçin</h2>
            <p className="text-xs text-gray-500 mb-3">
              Xəritədə problemi olan yerə klikləyin — yalnız Nərimanov rayonu daxili seçilə bilər
            </p>
            <div className="relative w-full h-72 rounded-xl overflow-hidden shadow border border-gray-200">
              {isLoggedIn ? (
                <NarimanovMap
                  onLocationSelect={handleLocationSelect}
                  selectedLocation={selectedLocation}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <p className="text-gray-400 text-sm">Daxil olduqdan sonra lokasiya seçə bilərsiniz</p>
                </div>
              )}
            </div>
          </div>

          {/* Complaints list */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Son Şikayətlər</h2>
            {complaints.length === 0 ? (
              <p className="text-gray-500 text-sm">Hələ ki şikayət yoxdur</p>
            ) : (
              <div className="space-y-3">
                {complaints.map((c) => (
                  <ComplaintCard key={c.id} complaint={c} />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
