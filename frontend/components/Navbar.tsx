"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { supabase } from "@/lib/supabase";

const PUBLIC_NAV = [
  { href: "/",          label: "Əsas Səhifə" },
  { href: "/services",  label: "Xidmətlər"   },
];

const CITIZEN_NAV = [
  { href: "/complaints", label: "Şikayətlər" },
  { href: "/map",        label: "Xəritə"     },
  { href: "/citizen",    label: "Profilim"   },
];

const ADMIN_NAV = [
  { href: "/dashboard",  label: "Panel"        },
  { href: "/admin/map",  label: "Xəritə"       },
  { href: "/admin/users",label: "İstifadəçilər" },
];

const ROLE_LABEL: Record<string, string> = {
  admin:    "Admin",
  operator: "Operator",
  citizen:  "Vətəndaş",
};

export default function Navbar() {
  const pathname = usePathname();
  const { profile, loading, isStaff } = useUser();

  const extraLinks = !profile ? [] : isStaff ? ADMIN_NAV : CITIZEN_NAV;
  const allLinks   = isStaff ? ADMIN_NAV : [...PUBLIC_NAV, ...extraLinks];

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 w-full bg-background border-b border-primary-container/10">
      <div className="flex items-center justify-between h-16 px-margin-mobile md:px-margin-desktop max-w-8xl mx-auto">

        {/* Brand + desktop nav */}
        <div className="flex items-center gap-8">
          <Link href={isStaff ? "/dashboard" : "/"} className="text-headline-md font-bold text-on-background tracking-tight shrink-0">
            Nərimanov Digital
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {allLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className={`px-3 py-1.5 rounded text-label-md transition-colors ${
                  isActive(href)
                    ? "text-secondary border-b-2 border-secondary"
                    : "text-on-surface-variant hover:text-secondary"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Auth area */}
        <div className="flex items-center gap-3">
          {loading ? null : profile ? (
            <>
              <span className="hidden sm:block text-label-sm text-on-surface-variant">
                {profile.full_name ?? profile.email}
                <span className="ml-2 bg-primary-container text-on-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {ROLE_LABEL[profile.role] ?? profile.role}
                </span>
              </span>
              <button
                onClick={handleLogout}
                className="text-label-md text-secondary hover:bg-surface-container-low px-4 py-2 rounded transition-colors"
              >
                Çıxış
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="hidden md:block text-label-md text-secondary hover:bg-surface-container-low px-4 py-2 rounded transition-colors"
              >
                Daxil Ol
              </Link>
              <Link
                href="/auth/signup"
                className="text-label-md bg-primary text-on-primary px-4 py-2 rounded hover:bg-primary-container transition-colors"
              >
                Qeydiyyat
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile nav strip */}
      <div className="md:hidden flex overflow-x-auto border-t border-primary-container/10 px-margin-mobile gap-1 py-1">
        {allLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            prefetch={false}
            className={`shrink-0 px-3 py-1.5 rounded text-label-sm whitespace-nowrap transition-colors ${
              isActive(href)
                ? "text-secondary bg-secondary-container/20 font-bold"
                : "text-on-surface-variant hover:text-secondary"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </header>
  );
}
