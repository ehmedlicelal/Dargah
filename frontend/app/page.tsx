import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="w-full px-margin-mobile md:px-margin-desktop pt-lg pb-xl max-w-8xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        {/* Left: text */}
        <div className="flex flex-col gap-6 justify-center">
          <div>
            <span className="inline-block text-label-sm text-secondary bg-secondary-container/20 border border-secondary/20 px-3 py-1 rounded-full mb-4">
              Nərimanov Rayonu · Rəsmi Platforma
            </span>
            <h1 className="text-headline-xl font-bold text-on-surface leading-tight tracking-tight">
              Nərimanov üçün Rəqəmsal Dövlət Xidmətləri
            </h1>
          </div>
          <p className="text-body-lg text-on-surface-variant max-w-lg">
            Xidmətlərə çatın, məlumatlı olun və rayonunuzla vahid platformadan əlaqə saxlayın.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/complaints"
              className="text-label-md bg-primary text-on-primary px-6 py-3 rounded hover:bg-primary-container transition-colors"
            >
              Şikayət Bildir
            </Link>
            <Link
              href="/services"
              className="text-label-md border border-outline px-6 py-3 rounded text-on-surface hover:bg-surface-container-low transition-colors"
            >
              Xidmətlərə Bax
            </Link>
          </div>
        </div>

        {/* Right: visual card */}
        <div className="w-full aspect-[4/3] lg:aspect-auto lg:min-h-[380px] rounded-lg overflow-hidden border border-primary-container/10 bg-primary relative">
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <span className="material-symbols-outlined filled text-7xl text-secondary-fixed mb-4 block">location_city</span>
            <p className="text-headline-md font-bold text-on-primary">Nərimanov Rayonu</p>
            <p className="text-body-md text-on-primary-container mt-1">Bakı, Azərbaycan</p>
            <div className="flex gap-6 mt-6 text-on-primary-container text-label-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-on-primary">5</p>
                <p>Zona</p>
              </div>
              <div className="w-px bg-on-primary-container/30" />
              <div className="text-center">
                <p className="text-2xl font-bold text-on-primary">195K+</p>
                <p>Əhali</p>
              </div>
              <div className="w-px bg-on-primary-container/30" />
              <div className="text-center">
                <p className="text-2xl font-bold text-on-primary">15km²</p>
                <p>Sahə</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── KEY RESOURCES (BENTO GRID) ───────────────────────────────────── */}
      <section className="w-full px-margin-mobile md:px-margin-desktop py-xl bg-surface-container-low/40">
        <div className="max-w-8xl mx-auto">
          <h2 className="text-headline-lg font-bold text-on-surface mb-md">Əsas Resurslar</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {/* Digital Services — spans 2 cols */}
            <div className="md:col-span-2 bg-surface-container-lowest border border-primary-container/10 rounded-lg p-md flex flex-col justify-between hover:shadow-sm transition-shadow">
              <div>
                <div className="w-12 h-12 bg-primary-fixed text-on-primary-fixed rounded-lg flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined filled">apps</span>
                </div>
                <h3 className="text-headline-md text-on-surface mb-2">Rəqəmsal Xidmətlər</h3>
                <p className="text-body-md text-on-surface-variant max-w-md">
                  Bələdiyyə xidmətlərinə onlayn daxil olun. İcazə ərizələrindən sənəd sorğularına qədər
                  vətəndaş işlərini ofisə getmədən həll edin.
                </p>
              </div>
              <div className="mt-8">
                <Link href="/services" className="text-label-md text-secondary flex items-center gap-2 hover:underline">
                  Kataloqua Bax
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Civic Engagement */}
            <div className="bg-surface-container-lowest border border-primary-container/10 rounded-lg p-md flex flex-col justify-between hover:shadow-sm transition-shadow">
              <div>
                <div className="w-12 h-12 bg-secondary-fixed text-on-secondary-fixed rounded-lg flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined filled">forum</span>
                </div>
                <h3 className="text-headline-md text-on-surface mb-2">Vətəndaş İştirakı</h3>
                <p className="text-body-md text-on-surface-variant">
                  Yerli problemlər haqqında məlumat verin, şikayətlərinizi izləyin.
                </p>
              </div>
              <div className="mt-8">
                <Link href="/complaints" className="text-label-md text-secondary flex items-center gap-2 hover:underline">
                  Şikayət Bildir
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Map full-width */}
            <div className="md:col-span-3 bg-surface-container-lowest border border-primary-container/10 rounded-lg p-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-6">
                <div className="w-12 h-12 bg-tertiary-fixed text-on-tertiary-fixed rounded-lg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined filled">map</span>
                </div>
                <div>
                  <h3 className="text-headline-md text-on-surface mb-2">İnteraktiv Rayon Xəritəsi</h3>
                  <p className="text-body-md text-on-surface-variant">
                    Nərimanov rayonunun monitorinq məlumatları, şikayət nöqtələri və infrastruktur xəritəsi.
                  </p>
                </div>
              </div>
              <Link
                href="/admin/map"
                className="text-label-md border-2 border-primary text-primary px-6 py-2 rounded hover:bg-primary hover:text-on-primary transition-colors whitespace-nowrap shrink-0"
              >
                Xəritəyə Bax
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────────────── */}
      <section className="w-full px-margin-mobile md:px-margin-desktop py-xl max-w-8xl mx-auto">
        <div className="flex items-center justify-between mb-md">
          <h2 className="text-headline-lg font-bold text-on-surface">Xidmətlər</h2>
          <Link href="/services" className="text-label-md text-secondary hover:underline flex items-center gap-1">
            Hamısına bax <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {[
            { title: "Su Kəməri Xidməti",  desc: "Su kəməri, kanalizasiya sistemi",         icon: "water_drop" },
            { title: "Yol Xidməti",         desc: "Yolların təmiri və asfaltlanması",         icon: "road"       },
            { title: "Sosial Xidmətlər",    desc: "Sosial yardım və sənəd rəsmiləşdirmə",    icon: "people"     },
          ].map(({ title, desc, icon }) => (
            <div key={title} className="bg-surface-container-lowest border border-primary-container/10 rounded-lg p-md flex items-start gap-4 hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 bg-surface-container rounded-lg flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-secondary">{icon}</span>
              </div>
              <div>
                <h3 className="text-label-md text-on-surface">{title}</h3>
                <p className="text-body-md text-on-surface-variant mt-1">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
