"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Əsas Səhifə" },
  { href: "/monitoring", label: "Monitorinq" },
  { href: "/services", label: "Xidmətlər" },
  { href: "/map", label: "Xəritə" },
  { href: "/complaints", label: "Şikayətlər" },
  { href: "/admin", label: "Admin" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    /* UI placeholder — replace with your design */
    <nav className="bg-brand text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">
          Nərimanov Digital
        </Link>
        <ul className="flex gap-1 flex-wrap">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-white text-brand"
                    : "hover:bg-brand-dark"
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
