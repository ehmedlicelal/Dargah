"use client";

import { useEffect, useState } from "react";
import { fetchComplaints, updateComplaint } from "@/lib/api";
import type { Complaint } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

/* UI placeholder — replace with your design */
// TODO: add role-based access check via Supabase session (role must be operator or admin)
export default function AdminPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { setIsAuthorized(false); return; }
      // TODO: check role from users table — for now allow any logged-in user
      setIsAuthorized(true);
      fetchComplaints(undefined, 100)
        .then(setComplaints)
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, []);

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      const updated = await updateComplaint(id, { status: newStatus });
      setComplaints((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch {
      alert("Status yenilənmədi");
    }
  }

  const statusCounts = {
    open: complaints.filter((c) => c.status === "open").length,
    in_progress: complaints.filter((c) => c.status === "in_progress").length,
    resolved: complaints.filter((c) => c.status === "resolved").length,
    closed: complaints.filter((c) => c.status === "closed").length,
  };

  if (isAuthorized === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-gray-600 mb-2">Bu səhifəyə giriş üçün operator/admin hesabı tələb olunur.</p>
        <Link href="/auth/login" className="text-brand hover:underline">Daxil Ol →</Link>
      </div>
    );
  }

  if (isAuthorized === null) {
    return <div className="flex items-center justify-center min-h-64"><p className="text-gray-500">Yüklənir...</p></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Paneli</h1>
      <p className="text-gray-600 mb-6 text-sm">Şikayətlərin idarəetməsi</p>

      {/* Stats header */}
      {/* UI placeholder — replace with your design */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Açıq" value={statusCounts.open} color="bg-blue-50 text-blue-700" />
        <StatCard label="İcrada" value={statusCounts.in_progress} color="bg-yellow-50 text-yellow-700" />
        <StatCard label="Həll edilib" value={statusCounts.resolved} color="bg-green-50 text-green-700" />
        <StatCard label="Bağlı" value={statusCounts.closed} color="bg-gray-50 text-gray-700" />
      </div>

      {/* Complaints table */}
      {loading ? (
        <p className="text-gray-500">Yüklənir...</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="font-semibold text-gray-800">Şikayətlər ({complaints.length})</p>
            {/* TODO: implement CSV export */}
            <button className="text-sm text-gray-500 border border-gray-300 rounded px-3 py-1 hover:bg-gray-50" disabled>
              CSV İxrac (TODO)
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Mövzu</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Kateqoriya</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Prioritet</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Tarix</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 max-w-xs">
                      <Link href={`/complaints/${c.id}`} className="text-gray-900 hover:text-brand line-clamp-1">
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{c.category ?? "—"}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={c.priority} variant="priority" />
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={c.status} variant="complaint" />
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {new Date(c.created_at).toLocaleDateString("az-AZ")}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={c.status}
                        onChange={(e) => handleStatusChange(c.id, e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand"
                      >
                        <option value="open">Açıq</option>
                        <option value="in_progress">İcrada</option>
                        <option value="resolved">Həll edilib</option>
                        <option value="closed">Bağlı</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg border p-4 ${color} border-current border-opacity-20`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm mt-1 opacity-80">{label}</p>
    </div>
  );
}
