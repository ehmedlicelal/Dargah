"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/* UI placeholder — replace with your design */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      router.push("/");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Daxil Ol</h1>
        <p className="text-sm text-gray-600 mb-6">Nərimanov Digital platformasına xoş gəldiniz</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-poçt</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="siz@misal.az"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Şifrə</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-white rounded-lg py-2 font-medium hover:bg-brand-dark disabled:opacity-50"
          >
            {loading ? "Yüklənir..." : "Daxil Ol"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          Hesabınız yoxdur?{" "}
          <Link href="/auth/signup" className="text-brand font-medium hover:underline">
            Qeydiyyatdan Keç
          </Link>
        </p>

        <div className="mt-6 pt-6 border-t border-gray-200">
          {/* TODO: ASAN eID inteqrasiyası — placeholder */}
          <button
            disabled
            className="w-full border-2 border-gray-300 text-gray-400 rounded-lg py-2 font-medium cursor-not-allowed text-sm"
          >
            ASAN eID ilə Daxil Ol (Tezliklə)
          </button>
          <p className="text-xs text-center text-gray-500 mt-2">ASAN eID inteqrasiyası hazırlanır</p>
        </div>
      </div>
    </div>
  );
}
