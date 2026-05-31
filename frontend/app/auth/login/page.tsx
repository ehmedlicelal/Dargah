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

const SLIDES = [
  "https://lh3.googleusercontent.com/aida/ADBb0uh8bRz8XoUpvcFs2rx2QvP8-8QWect9krbh5HFnvXlotLBiFQtvjWljy8wupH9t098Mt4y-kBNSwtCtcUpeGbLCShloRfXOSLZi5GzNoNOoOO0kMZuFKK4yP0gMrU3HDGtk18Sbk8BJfnh2Gl-Bdz4p6gtiRkOtPy2RB7uWWnBzsm_isEjFjzTTC4ttfUOHfMDRZVUahA4Z8iLj7DrH_Oo04-NJLpdvhlIrAk46b7W5TR2oD09ucURiaL4",
  "https://lh3.googleusercontent.com/aida/ADBb0uguUxnbnVV5q55kMTX2gi1srAnylr7Lx6OlMcYUwMe76x4WrhXaS0UxoEGpUJsIPM1ZiVOs3y8kihyErCBalKzITBwH3L5FalQ0N3JK0HMk-np-IJCVbJSfUXQFvjewb5yVS6n1MDYF7XLMLWVJitxLAS_9vkA0aWae1_BftytpqeI00vmEa4IG7Dh666FoBimipK8y2aJZsqfsFk2B1mdb96bF2MzExWzrMg6FTzmqKbzyz1IfoFXTM3Q",
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(safeNext(searchParams.get("next")));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => setActiveSlide((v) => (v === 0 ? 1 : 0)), 5000);
    return () => clearInterval(id);
  }, []);

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
    <div className="h-screen overflow-hidden flex antialiased">
      {/* Left: image slideshow (desktop only) */}
      <div className="hidden md:block md:w-1/2 relative bg-primary-container h-full overflow-hidden">
        {SLIDES.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms]"
            style={{ opacity: activeSlide === i ? 1 : 0, zIndex: activeSlide === i ? 1 : 0 }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-margin-desktop left-margin-desktop z-20 pointer-events-none">
          <h2 className="text-headline-lg font-bold text-on-primary mb-sm drop-shadow-md">Nərimanov Rayonu</h2>
          <p className="text-body-lg text-on-primary/90 max-w-md drop-shadow">Müasir infrastruktur zəngin irslə görüşür.</p>
        </div>
      </div>

      {/* Right: login form */}
      <div className="w-full md:w-1/2 h-full flex flex-col justify-center items-center px-margin-mobile md:px-margin-desktop bg-surface overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="mb-lg">
            <h1 className="text-headline-md font-bold text-primary mb-xs">Nərimanov Digital</h1>
          </div>

          {/* Heading */}
          <div className="mb-md">
            <h2 className="text-headline-xl font-bold text-on-surface mb-sm">Xoş Gəldiniz</h2>
            <p className="text-body-md text-on-surface-variant">Nərimanov Digital xidmətlərinə daxil olun.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-md">
            {/* Email */}
            <div className="space-y-sm">
              <label htmlFor="email" className="block text-label-md text-on-surface">
                E-poçt ünvanı
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="siz@misal.az"
                className="w-full h-12 px-sm bg-surface-container-lowest border border-primary-container/20 rounded text-body-md text-on-surface placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
              />
            </div>

            {/* Password */}
            <div className="space-y-sm">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-label-md text-on-surface">Şifrə</label>
                <button type="button" className="text-label-md text-secondary hover:text-secondary-fixed-dim transition-colors">
                  Şifrəni unutdunuz?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 px-sm pr-10 bg-surface-container-lowest border border-primary-container/20 rounded text-body-md text-on-surface placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-sm top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPwd ? "visibility_off" : "visibility"}
                  </span>
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
            <div className="pt-sm">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-primary-container text-on-primary text-label-md rounded flex items-center justify-center hover:bg-primary transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-60 active:scale-[0.98]"
              >
                {loading ? "Yüklənir..." : "Daxil Ol"}
              </button>
            </div>
          </form>

          {/* Sign up link */}
          <div className="mt-lg text-center">
            <p className="text-body-md text-on-surface-variant">
              Hesabınız yoxdur?{" "}
              <Link href="/auth/signup" className="text-label-md text-secondary hover:text-secondary-fixed-dim transition-colors ml-xs">
                Qeydiyyat
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
