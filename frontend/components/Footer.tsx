import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full bg-surface-container-low border-t border-outline-variant/20 mt-auto">
      <div className="max-w-8xl mx-auto px-margin-mobile md:px-margin-desktop py-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-label-md font-bold text-primary">
          © 2025 Nərimanov Digital. Bütün hüquqlar qorunur.
        </div>

        <nav className="flex flex-wrap justify-center gap-6">
          {[
            { href: "#", label: "Məxfilik Siyasəti" },
            { href: "#", label: "İstifadə Şərtləri" },
            { href: "#", label: "Əlaqə" },
          ].map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              className="text-label-sm text-on-surface-variant hover:text-secondary transition-colors opacity-80 hover:opacity-100"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="text-label-sm text-on-surface-variant opacity-80">
          Nərimanov Rayon İcra Hakimiyyəti
        </div>
      </div>
    </footer>
  );
}
