"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchComplaints } from "@/lib/api";
import type { Complaint } from "@/lib/types";
import RoleGuard from "@/components/RoleGuard";
import ComplaintCard from "@/components/ComplaintCard";
import { useUser } from "@/hooks/useUser";

const STATUS_COLORS: Record<string, string> = {
  open:        "bg-red-100 text-red-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  resolved:    "bg-green-100 text-green-700",
  closed:      "bg-gray-100 text-gray-600",
};
const STATUS_LABELS: Record<string, string> = {
  open: "Açıq", in_progress: "İcrada", resolved: "Həll edilib", closed: "Bağlı",
};

function Dashboard() {
  const { profile } = useUser();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    fetchComplaints(undefined, 50)
      .then(setComplaints)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const open     = complaints.filter((c) => c.status === "open").length;
  const progress = complaints.filter((c) => c.status === "in_progress").length;
  const resolved = complaints.filter((c) => c.status === "resolved").length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Xoş gəldiniz{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Şikayətlərinizin vəziyyəti</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Açıq",      count: open,     color: "border-red-200 bg-red-50",    text: "text-red-700" },
          { label: "İcrada",    count: progress, color: "border-yellow-200 bg-yellow-50", text: "text-yellow-700" },
          { label: "Həll edilib", count: resolved, color: "border-green-200 bg-green-50", text: "text-green-700" },
        ].map(({ label, count, color, text }) => (
          <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
            <p className={`text-3xl font-bold ${text}`}>{count}</p>
            <p className={`text-sm mt-1 ${text}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link href="/complaints"
          className="flex items-center gap-3 p-4 bg-brand text-white rounded-xl hover:bg-brand-dark transition-colors col-span-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <div>
            <p className="font-semibold">Yeni Şikayət</p>
            <p className="text-xs text-white/70">Problem bildirin</p>
          </div>
        </Link>
      </div>

      {/* Complaints list */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Son Müraciətlərim</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-3 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : complaints.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-gray-400 text-sm">Hələ heç bir müraciət yoxdur</p>
            <Link href="/complaints" className="text-brand text-sm font-medium hover:underline mt-2 inline-block">
              İlk şikayəti göndər →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {complaints.slice(0, 10).map((c) => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-3 hover:border-brand/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{c.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{c.description}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CitizenPage() {
  return (
    <RoleGuard roles={["citizen", "operator", "admin"]}>
      <Dashboard />
    </RoleGuard>
  );
}
