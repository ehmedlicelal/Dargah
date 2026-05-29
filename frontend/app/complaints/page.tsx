"use client";

import { useEffect, useState } from "react";
import { createComplaint, fetchComplaints, fetchZones } from "@/lib/api";
import type { Complaint, ComplaintCreate, DistrictZone } from "@/lib/types";
import ComplaintCard from "@/components/ComplaintCard";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

/* UI placeholder — replace with your design */
export default function ComplaintsPage() {
  const [zones, setZones] = useState<DistrictZone[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<ComplaintCreate>({ title: "", description: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
    fetchZones().then(setZones).catch(() => {});
    fetchComplaints(undefined, 20).then(setComplaints).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    // TODO: connect real API here — attach user JWT from Supabase session
    try {
      const created = await createComplaint(form);
      setComplaints((prev) => [created, ...prev]);
      setForm({ title: "", description: "" });
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

        {/* Submit form */}
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
            <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ətraflı açıqlama *</label>
                <textarea
                  required
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                  placeholder="Problem haqqında ətraflı məlumat yazın..."
                />
              </div>
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

              {submitSuccess && (
                <p className="text-green-700 text-sm bg-green-50 border border-green-200 rounded px-3 py-2">
                  Şikayətiniz qəbul edildi. AI təsnifatı aparılır...
                </p>
              )}
              {submitError && (
                <p className="text-red-600 text-sm">{submitError}</p>
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
  );
}
