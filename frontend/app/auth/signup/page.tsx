"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const AUTH_ERRORS: Record<string, string> = {
  "User already registered": "Bu e-poçtla artıq hesab mövcuddur.",
  "Password should be":      "Şifrə tələblərə uyğun deyil.",
  "Too many requests":       "Çox sayda cəhd. Bir az gözləyin.",
};

function friendlyError(msg: string) {
  for (const [k, v] of Object.entries(AUTH_ERRORS)) if (msg.includes(k)) return v;
  return "Qeydiyyat uğursuz oldu. Yenidən cəhd edin.";
}

type Req = { label: string; test: (v: string) => boolean };
const PASSWORD_REQS: Req[] = [
  { label: "Ən az 8 simvol",          test: (v) => v.length >= 8 },
  { label: "Bir böyük hərf",           test: (v) => /[A-Z]/.test(v) },
  { label: "Bir xüsusi simvol (!@#$)", test: (v) => /[!@#$%^&*]/.test(v) },
];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm]       = useState({ fullName: "", email: "", phone: "", password: "", confirm: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/");
    });
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirm) { setError("Şifrələr uyğun gəlmir."); return; }
    const failedReq = PASSWORD_REQS.find((r) => !r.test(form.password));
    if (failedReq) { setError(`Şifrə tələbi: ${failedReq.label}`); return; }

    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName, phone: form.phone } },
    });
    setLoading(false);

    if (err) { setError(friendlyError(err.message)); return; }
    setSuccess(true);
    timerRef.current = setTimeout(() => router.push("/"), 3000);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-inverse-on-surface flex items-center justify-center px-margin-mobile">
        <div className="bg-surface-container-lowest border border-primary-container/10 rounded-xl p-lg max-w-md w-full text-center">
          <div className="w-14 h-14 bg-secondary-fixed/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-secondary text-3xl filled">check_circle</span>
          </div>
          <h2 className="text-headline-md font-bold text-on-surface mb-2">Qeydiyyat Tamamlandı!</h2>
          <p className="text-body-md text-on-surface-variant mb-4">
            Hesabınız yaradıldı. Əsas səhifəyə yönləndiriləcəksiniz.
          </p>
          <Link href="/" className="text-label-md text-secondary hover:underline">İndi keç →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-inverse-on-surface flex flex-col antialiased">

      {/* Slim header */}
      <header className="bg-surface border-b border-primary/10 sticky top-0 z-50">
        <div className="flex justify-between items-center h-16 px-margin-mobile md:px-margin-desktop max-w-8xl mx-auto">
          <div className="text-headline-md font-bold text-primary flex items-center gap-xs">
            <span className="material-symbols-outlined text-secondary filled">account_balance</span>
            Nərimanov Digital
          </div>
          <Link href="/auth/login" className="text-label-md text-primary border border-primary/20 rounded px-sm py-xs hover:bg-primary/5 transition-colors">
            Daxil Ol
          </Link>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-margin-mobile py-xl">
        <div className="bg-surface-container-lowest border border-primary-container/10 rounded-xl w-full max-w-[480px] p-md md:p-lg relative overflow-hidden">
          {/* Accent top bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary opacity-50" />

          <div className="mb-lg text-center">
            <h1 className="text-headline-lg font-bold text-primary mb-xs">Hesab Yarat</h1>
            <p className="text-body-md text-on-surface-variant">Bələdiyyə rəqəmsal xidmətlərinə daxil olmaq üçün qeydiyyatdan keçin.</p>
          </div>

          <form onSubmit={handleSignup} className="flex flex-col gap-md">

            {/* Full Name */}
            <div className="flex flex-col gap-xs">
              <label htmlFor="fullName" className="text-label-sm text-primary">Ad Soyad</label>
              <input
                id="fullName" type="text" required autoComplete="name"
                value={form.fullName} onChange={(e) => update("fullName", e.target.value)}
                placeholder="Əli Əliyev"
                className="w-full border border-primary-container/20 rounded px-sm py-sm text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all placeholder:text-on-surface-variant"
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-xs">
              <label htmlFor="email" className="text-label-sm text-primary">E-poçt ünvanı</label>
              <input
                id="email" type="email" required autoComplete="email"
                value={form.email} onChange={(e) => update("email", e.target.value)}
                placeholder="siz@misal.az"
                className="w-full border border-primary-container/20 rounded px-sm py-sm text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all placeholder:text-on-surface-variant"
              />
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-xs">
              <label htmlFor="phone" className="text-label-sm text-primary">Mobil nömrə</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-sm text-on-surface-variant text-body-md pointer-events-none">+994</span>
                <input
                  id="phone" type="tel" autoComplete="tel"
                  value={form.phone} onChange={(e) => update("phone", e.target.value)}
                  placeholder="(50) XXX-XX-XX"
                  className="w-full border border-primary-container/20 rounded pl-[60px] pr-sm py-sm text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all placeholder:text-on-surface-variant"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-xs">
              <label htmlFor="password" className="text-label-sm text-primary">Şifrə</label>
              <div className="relative">
                <input
                  id="password" type={showPwd ? "text" : "password"} required autoComplete="new-password"
                  value={form.password} onChange={(e) => update("password", e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-primary-container/20 rounded px-sm py-sm pr-10 text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all placeholder:text-on-surface-variant"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-sm top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined text-[20px]">{showPwd ? "visibility_off" : "visibility"}</span>
                </button>
              </div>

              {/* Password checklist */}
              {form.password && (
                <div className="bg-surface-container-low rounded p-sm border border-primary-container/5 mt-xs">
                  <p className="text-label-sm text-on-surface-variant mb-xs">Şifrə tələbləri:</p>
                  <ul className="flex flex-col gap-xs">
                    {PASSWORD_REQS.map(({ label, test }) => {
                      const ok = test(form.password);
                      return (
                        <li key={label} className="flex items-center gap-[6px] text-label-sm text-on-surface-variant">
                          <span className={`material-symbols-outlined text-[16px] filled ${ok ? "text-secondary" : "text-outline"}`}>
                            {ok ? "check_circle" : "circle"}
                          </span>
                          <span className={ok ? "text-on-surface" : ""}>{label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-xs">
              <label htmlFor="confirm" className="text-label-sm text-primary">Şifrəni Təsdiqlə</label>
              <input
                id="confirm" type={showPwd ? "text" : "password"} required autoComplete="new-password"
                value={form.confirm} onChange={(e) => update("confirm", e.target.value)}
                placeholder="••••••••"
                className={`w-full border rounded px-sm py-sm text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:ring-1 transition-all placeholder:text-on-surface-variant ${
                  form.confirm && form.confirm !== form.password
                    ? "border-error focus:border-error focus:ring-error bg-error-container/20"
                    : "border-primary-container/20 focus:border-secondary focus:ring-secondary"
                }`}
              />
              {form.confirm && form.confirm !== form.password && (
                <p className="text-label-sm text-error">Şifrələr uyğun gəlmir</p>
              )}
            </div>

            {/* Terms */}
            <div className="flex items-start gap-xs mt-xs">
              <input id="terms" type="checkbox" required
                className="mt-[2px] w-4 h-4 text-secondary border-primary-container/20 rounded focus:ring-secondary bg-surface-container-lowest"
              />
              <label htmlFor="terms" className="text-body-md text-on-surface-variant text-[14px] leading-tight">
                Nərimanov Rayon İcra Hakimiyyətinin{" "}
                <a href="#" className="text-secondary hover:underline">İstifadə Şərtləri</a> və{" "}
                <a href="#" className="text-secondary hover:underline">Məxfilik Siyasəti</a> ilə razıyam.
              </label>
            </div>

            {error && (
              <p className="text-error text-label-sm bg-error-container px-sm py-xs rounded border border-error/20">
                {error}
              </p>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-primary text-on-primary text-label-md rounded py-sm mt-xs hover:bg-primary/90 transition-colors flex items-center justify-center gap-xs disabled:opacity-60 active:scale-[0.98]"
            >
              {loading ? "Yüklənir..." : "Hesab Yarat"}
              {!loading && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
            </button>
          </form>

          <div className="mt-lg text-center border-t border-primary-container/10 pt-md">
            <p className="text-body-md text-on-surface-variant">
              Artıq hesabınız var?{" "}
              <Link href="/auth/login" className="text-label-md text-secondary hover:underline">Daxil Ol</Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-surface border-t border-primary/10 mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center py-lg px-margin-mobile md:px-margin-desktop max-w-8xl mx-auto gap-sm">
          <div className="text-label-md font-bold text-primary flex items-center gap-xs">
            <span className="material-symbols-outlined text-[20px] filled">account_balance</span>
            Nərimanov Digital
          </div>
          <nav className="flex flex-wrap justify-center gap-md text-label-sm">
            <a href="#" className="text-on-surface-variant hover:text-secondary transition-colors opacity-80 hover:opacity-100">Məxfilik</a>
            <a href="#" className="text-on-surface-variant hover:text-secondary transition-colors opacity-80 hover:opacity-100">Şərtlər</a>
            <a href="#" className="text-on-surface-variant hover:text-secondary transition-colors opacity-80 hover:opacity-100">Əlçatımlılıq</a>
          </nav>
          <div className="text-label-sm text-on-surface-variant opacity-80">© 2025 Nərimanov Rayon İcra Hakimiyyəti</div>
        </div>
      </footer>
    </div>
  );
}
