"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const AUTH_ERRORS: Record<string, string> = {
  "Invalid login credentials": "E-poçt və ya şifrə yanlışdır.",
  "Email not confirmed":        "E-poçt ünvanınız təsdiqlənməyib.",
  "Too many requests":          "Çox sayda cəhd. Bir az gözləyin.",
  "User not found":             "Bu e-poçtla hesab tapılmadı.",
};

function friendlyError(msg: string) {
  for (const [k, v] of Object.entries(AUTH_ERRORS)) if (msg.includes(k)) return v;
  return "Giriş uğursuz oldu. Yenidən cəhd edin.";
}

function safeNext(raw: string | null): string {
  if (!raw) return "/";
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    return url.pathname + url.search;
  } catch { return "/"; }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(safeNext(searchParams.get("next")));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(friendlyError(err.message)); return; }
    router.push(safeNext(searchParams.get("next")));
  }

  return (
    <div className="min-h-screen bg-inverse-on-surface flex flex-col antialiased">
      {/* Dot grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #1b2a41 1px, transparent 0)", backgroundSize: "32px 32px" }}
      />

      {/* Centered card */}
      <main className="flex-grow flex items-center justify-center px-margin-mobile py-margin-desktop relative z-10">
        <div
          className="w-full max-w-md bg-surface-container-lowest rounded-xl border border-primary-container/10 p-md md:p-lg"
          style={{ boxShadow: "0 4px 24px -4px rgba(27,42,65,0.06)" }}
        >
          {/* Header */}
          <div className="text-center mb-lg">
            <h1 className="text-headline-lg font-bold text-primary mb-xs">Xoş Gəldiniz</h1>
            <p className="text-body-md text-on-surface-variant">Nərimanov Digital xidmətlərinə daxil olun.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-md">
            {/* Email */}
            <div className="space-y-xs">
              <label htmlFor="email" className="block text-label-sm text-on-surface">E-poçt</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">person</span>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="siz@misal.az"
                  className="w-full pl-10 pr-sm py-sm bg-surface-container-lowest border border-primary-container/20 rounded text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-xs">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-label-sm text-on-surface">Şifrə</label>
                <button type="button" className="text-label-sm text-secondary hover:text-primary transition-colors">
                  Şifrəni unutdunuz?
                </button>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">lock</span>
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-sm bg-surface-container-lowest border border-primary-container/20 rounded text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-sm top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[20px]">{showPwd ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-error text-label-sm bg-error-container px-sm py-xs rounded border border-error/20">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-container hover:bg-primary text-on-primary text-label-md py-sm rounded transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-xs disabled:opacity-60"
            >
              {loading ? "Yüklənir..." : "Daxil Ol"}
              {!loading && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
            </button>
          </form>

          {/* Sign up link */}
          <div className="mt-lg text-center border-t border-primary-container/10 pt-md">
            <p className="text-body-md text-on-surface-variant">
              Nərimanov Digital-da ilk dəfəsiniz?{" "}
              <Link href="/auth/signup" className="text-label-md text-secondary hover:text-primary transition-colors">
                Qeydiyyat
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-surface border-t border-primary/10 opacity-80 hover:opacity-100 transition-opacity">
        <div className="flex flex-col md:flex-row justify-between items-center py-lg px-margin-mobile md:px-margin-desktop max-w-8xl mx-auto gap-sm">
          <div className="text-label-md font-bold text-primary">Nərimanov Digital</div>
          <nav className="flex gap-md text-label-sm">
            <a href="#" className="text-on-surface-variant hover:text-secondary transition-colors">Məxfilik</a>
            <a href="#" className="text-on-surface-variant hover:text-secondary transition-colors">Şərtlər</a>
            <a href="#" className="text-on-surface-variant hover:text-secondary transition-colors">Əlçatımlılıq</a>
          </nav>
          <div className="text-label-sm text-on-surface-variant">© 2025 Nərimanov Rayon İcra Hakimiyyəti</div>
        </div>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
