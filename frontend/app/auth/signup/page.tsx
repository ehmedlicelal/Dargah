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

const SLIDES = [
  "https://lh3.googleusercontent.com/aida/ADBb0uguUxnbnVV5q55kMTX2gi1srAnylr7Lx6OlMcYUwMe76x4WrhXaS0UxoEGpUJsIPM1ZiVOs3y8kihyErCBalKzITBwH3L5FalQ0N3JK0HMk-np-IJCVbJSfUXQFvjewb5yVS6n1MDYF7XLMLWVJitxLAS_9vkA0aWae1_BftytpqeI00vmEa4IG7Dh666FoBimipK8y2aJZsqfsFk2B1mdb96bF2MzExWzrMg6FTzmqKbzyz1IfoFXTM3Q",
  "https://lh3.googleusercontent.com/aida/ADBb0uh8bRz8XoUpvcFs2rx2QvP8-8QWect9krbh5HFnvXlotLBiFQtvjWljy8wupH9t098Mt4y-kBNSwtCtcUpeGbLCShloRfXOSLZi5GzNoNOoOO0kMZuFKK4yP0gMrU3HDGtk18Sbk8BJfnh2Gl-Bdz4p6gtiRkOtPy2RB7uWWnBzsm_isEjFjzTTC4ttfUOHfMDRZVUahA4Z8iLj7DrH_Oo04-NJLpdvhlIrAk46b7W5TR2oD09ucURiaL4",
];

export default function SignupPage() {
  const router   = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm]           = useState({ fullName: "", email: "", phone: "", password: "", confirm: "" });
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/");
    });
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => setActiveSlide((v) => (v === 0 ? 1 : 0)), 5000);
    return () => clearInterval(id);
  }, []);

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
      <div className="min-h-screen bg-surface flex items-center justify-center px-margin-mobile">
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
    <div className="h-screen overflow-hidden flex antialiased bg-surface">
      {/* Left: image slideshow (desktop only) */}
      <div className="hidden md:block md:w-1/2 relative bg-primary h-full overflow-hidden">
        {SLIDES.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms]"
            style={{ opacity: activeSlide === i ? 1 : 0, zIndex: activeSlide === i ? 1 : 0 }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent pointer-events-none" />
        <div className="absolute bottom-margin-desktop left-margin-desktop text-on-primary pointer-events-none">
          <h2 className="text-headline-lg font-bold text-on-primary">Nərimanov Digital</h2>
          <p className="text-body-md text-on-primary/80 mt-xs">Rəqəmsal idarəçilik vasitəsilə vətəndaşlara güc vermək.</p>
        </div>
      </div>

      {/* Right: registration form */}
      <div className="w-full md:w-1/2 h-full flex flex-col items-center justify-center bg-surface overflow-y-auto px-margin-mobile md:px-margin-desktop py-lg">
        <div className="w-full max-w-[480px]">
          {/* Mobile logo */}
          <div className="md:hidden mb-lg text-center">
            <h2 className="text-headline-md font-bold text-primary">Nərimanov Digital</h2>
          </div>

          {/* Header */}
          <div className="mb-lg">
            <h1 className="text-headline-lg font-bold text-primary mb-xs">Hesab Yarat</h1>
            <p className="text-body-md text-on-surface-variant">
              Bələdiyyə rəqəmsal xidmətlərinə daxil olmaq üçün qeydiyyatdan keçin.
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-md">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-label-sm text-on-surface mb-xs">Ad Soyad</label>
              <input
                id="fullName" type="text" required autoComplete="name"
                value={form.fullName} onChange={(e) => update("fullName", e.target.value)}
                placeholder="Əli Əliyev"
                className="w-full h-12 px-sm bg-surface-container-lowest border border-primary-container/20 rounded text-body-md text-on-surface placeholder:text-outline-variant outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-label-sm text-on-surface mb-xs">E-poçt ünvanı</label>
              <input
                id="email" type="email" required autoComplete="email"
                value={form.email} onChange={(e) => update("email", e.target.value)}
                placeholder="siz@misal.az"
                className="w-full h-12 px-sm bg-surface-container-lowest border border-primary-container/20 rounded text-body-md text-on-surface placeholder:text-outline-variant outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-label-sm text-on-surface mb-xs">Mobil nömrə</label>
              <div className="flex">
                <span className="inline-flex items-center px-sm bg-surface-container border border-r-0 border-primary-container/20 rounded-l text-body-md text-on-surface-variant select-none">
                  +994
                </span>
                <input
                  id="phone" type="tel" autoComplete="tel"
                  value={form.phone} onChange={(e) => update("phone", e.target.value)}
                  placeholder="50 123 45 67"
                  className="w-full h-12 px-sm bg-surface-container-lowest border border-primary-container/20 rounded-r text-body-md text-on-surface placeholder:text-outline-variant outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-label-sm text-on-surface mb-xs">Şifrə</label>
              <div className="relative">
                <input
                  id="password" type={showPwd ? "text" : "password"} required autoComplete="new-password"
                  value={form.password} onChange={(e) => update("password", e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 px-sm pr-10 bg-surface-container-lowest border border-primary-container/20 rounded text-body-md text-on-surface placeholder:text-outline-variant outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
                />
                <button
                  type="button" tabIndex={-1} onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-sm top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                >
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
            <div>
              <label htmlFor="confirm" className="block text-label-sm text-on-surface mb-xs">Şifrəni Təsdiqlə</label>
              <input
                id="confirm" type={showPwd ? "text" : "password"} required autoComplete="new-password"
                value={form.confirm} onChange={(e) => update("confirm", e.target.value)}
                placeholder="••••••••"
                className={`w-full h-12 px-sm bg-surface-container-lowest border rounded text-body-md text-on-surface placeholder:text-outline-variant outline-none focus:ring-1 transition-colors ${
                  form.confirm && form.confirm !== form.password
                    ? "border-error focus:border-error focus:ring-error bg-error-container/20"
                    : "border-primary-container/20 focus:border-secondary focus:ring-secondary"
                }`}
              />
              {form.confirm && form.confirm !== form.password && (
                <p className="text-label-sm text-error mt-xs">Şifrələr uyğun gəlmir</p>
              )}
            </div>

            {/* Terms */}
            <div className="flex items-start gap-xs">
              <input id="terms" type="checkbox" required
                className="mt-[2px] w-4 h-4 rounded border-primary-container/20 text-secondary focus:ring-secondary bg-surface-container-lowest"
              />
              <label htmlFor="terms" className="text-[14px] text-on-surface-variant leading-tight">
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
              className="w-full h-12 bg-primary text-on-primary text-label-md rounded flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-60 active:scale-[0.98]"
            >
              {loading ? "Yüklənir..." : "Hesab Yarat"}
            </button>
          </form>

          <div className="mt-lg text-center">
            <p className="text-[14px] text-on-surface-variant">
              Artıq hesabınız var?{" "}
              <Link href="/auth/login" className="text-secondary text-label-md hover:underline">Daxil Ol</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
