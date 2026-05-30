"use client";

import { useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import { fetchUsers, type UserRow } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const ROLE_LABELS: Record<string, string> = {
  citizen:  "Vətəndaş",
  operator: "Operator",
  admin:    "Admin",
};
const ROLE_COLORS: Record<string, string> = {
  citizen:  "bg-gray-100 text-gray-700",
  operator: "bg-blue-100 text-blue-700",
  admin:    "bg-purple-100 text-purple-700",
};

function UserManagement() {
  const [users,   setUsers]   = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<string | null>(null);
  const [search,  setSearch]  = useState("");
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .catch(() => setError("İstifadəçilər yüklənmədi. Backend serverinin işlədiyini yoxlayın."))
      .finally(() => setLoading(false));
  }, []);

  async function changeRole(userId: string, newRole: "citizen" | "operator" | "admin") {
    setSaving(userId);
    const { error } = await supabase
      .from("users")
      .update({ role: newRole })
      .eq("id", userId);

    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
    setSaving(null);
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (
      (u.full_name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.id.includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">İstifadəçi İdarəetməsi</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cəmi {users.length} istifadəçi — rolları idarə edin
          </p>
        </div>
        <div className="flex gap-2 text-xs flex-wrap justify-end">
          {(["citizen", "operator", "admin"] as const).map(r => (
            <span key={r} className={`px-2.5 py-1 rounded-full font-semibold ${ROLE_COLORS[r]}`}>
              {ROLE_LABELS[r]}: {users.filter(u => u.role === r).length}
            </span>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Ad, e-poçt və ya ID ilə axtar..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Ad Soyad", "E-poçt", "Telefon", "Qeydiyyat tarixi", "Cari rol", "Rolı dəyiş"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                    İstifadəçi tapılmadı
                  </td>
                </tr>
              ) : (
                filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{u.full_name ?? "—"}</div>
                      <div className="text-xs text-gray-400 font-mono">{u.id.slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{u.email ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{u.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(u.created_at).toLocaleDateString("az-AZ")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {(["citizen", "operator", "admin"] as const)
                          .filter(r => r !== u.role)
                          .map(r => (
                            <button
                              key={r}
                              disabled={saving === u.id}
                              onClick={() => changeRole(u.id, r)}
                              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors disabled:opacity-50 ${
                                r === "admin"
                                  ? "border-purple-200 text-purple-700 hover:bg-purple-50"
                                  : r === "operator"
                                    ? "border-blue-200 text-blue-700 hover:bg-blue-50"
                                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              {saving === u.id ? "..." : `→ ${ROLE_LABELS[r]}`}
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <RoleGuard roles={["admin"]}>
      <UserManagement />
    </RoleGuard>
  );
}
