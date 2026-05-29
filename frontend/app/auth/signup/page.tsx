"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/* UI placeholder — replace with your design */
export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirm) {
      setError("Şifrələr uyğun gəlmir.");
      return;
    }
    if (form.password.length < 6) {
      setError("Şifrə ən az 6 simvol olmalıdır.");
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName },
      },
    });
    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else {
      setSuccess(true);
      // Auto-redirect after 3s if email confirmation is disabled in Supabase
      setTimeout(() => router.push("/"), 3000);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-md text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Qeydiyyat tamamlandı!</h2>
          <p className="text-gray-600 text-sm">
            Hesabınız yaradıldı. E-poçtunuzu yoxlayın (təsdiq tələb olunursa) və ya avtomatik olaraq yönləndiriləcəksiniz.
          </p>
          <Link href="/" className="inline-block mt-4 text-brand hover:underline text-sm">
            Əsas səhifəyə keç →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Qeydiyyat</h1>
        <p className="text-sm text-gray-600 mb-6">Nərimanov Digital platformasına qoşulun</p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
            <input
              type="text"
              required
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="Əli Əliyev"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-poçt</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="siz@misal.az"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Şifrə</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="Ən az 6 simvol"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Şifrəni təsdiqlə</label>
            <input
              type="password"
              required
              value={form.confirm}
              onChange={(e) => update("confirm", e.target.value)}
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
            {loading ? "Yüklənir..." : "Qeydiyyatdan Keç"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Artıq hesabınız var?{" "}
          <Link href="/auth/login" className="text-brand font-medium hover:underline">
            Daxil Ol
          </Link>
        </p>
      </div>
    </div>
  );
}
