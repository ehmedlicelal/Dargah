"use client";

import { useEffect, useRef, useState } from "react";
import {
  analyzeComplaint, createComplaint, fetchComplaints, fetchZones,
  generateReport, updateComplaint, type ReportRequest,
} from "@/lib/api";
import type { AiAnalysis } from "@/lib/api";
import type { Complaint, ComplaintCreate, DistrictZone } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";

// ── Submission types ──────────────────────────────────────────────────────────
const SUBMISSION_TYPES = ["Şikayət", "Ərizə", "Təklif"] as const;

const PRIORITY_OPTS = [
  { value: "low" as const,      label: "Aşağı",  deadline: "30 gün",  color: "#22c55e" },
  { value: "medium" as const,   label: "Orta",   deadline: "14 gün",  color: "#3b82f6" },
  { value: "high" as const,     label: "Yüksək", deadline: "7 gün",   color: "#f97316" },
  { value: "critical" as const, label: "Kritik", deadline: "48 saat", color: "#ef4444" },
] as const;

const STATUS_OPTS = ["open", "in_progress", "resolved", "closed"] as const;
const STATUS_LABELS: Record<string, string> = {
  open: "Açıq", in_progress: "İcrada", resolved: "Həll edildi", closed: "Bağlı",
};
const STATUS_COLORS: Record<string, string> = {
  open:        "bg-primary-fixed text-on-primary-fixed",
  in_progress: "bg-secondary-container/40 text-on-secondary-container",
  resolved:    "bg-secondary-fixed/40 text-on-secondary-fixed-variant",
  closed:      "bg-surface-container-high text-on-surface-variant",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "#22c55e", medium: "#3b82f6", high: "#f97316", critical: "#ef4444",
};
const PRIORITY_LABELS: Record<string, string> = {
  low: "Aşağı", medium: "Orta", high: "Yüksək", critical: "Kritik",
};

// ── Report markdown renderer ──────────────────────────────────────────────────
function ReportRenderer({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-body-md leading-relaxed text-on-surface">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("# "))  return <h1 key={i} className="text-headline-md font-bold text-on-surface mt-3 mb-1 border-b border-outline-variant pb-1">{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-label-md font-bold text-secondary mt-4 mb-0.5">{line.slice(3)}</h2>;
        if (/^\d+\.\s/.test(line)) return <p key={i} className="ml-4 text-on-surface-variant">{line}</p>;
        if (line.startsWith("* ")) return (
          <p key={i} className="flex gap-2 text-on-surface-variant">
            <span className="text-secondary shrink-0 mt-0.5">•</span>
            <span>{line.slice(2)}</span>
          </p>
        );
        if (line.startsWith("---")) return <hr key={i} className="my-2 border-outline-variant" />;
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i} className="text-on-surface-variant">{line}</p>;
      })}
    </div>
  );
}

// ── Active tab type ───────────────────────────────────────────────────────────
type Tab = "complaints" | "submit" | "report";

// ── Main dashboard component ──────────────────────────────────────────────────
function DashboardContent() {
  const [tab, setTab]             = useState<Tab>("complaints");
  const [zones, setZones]         = useState<DistrictZone[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [profile, setProfile]     = useState<{ full_name?: string | null; role?: string } | null>(null);

  // Submit form state
  const [form, setForm]           = useState<ComplaintCreate>({ title: "", description: "", submission_type: "Şikayət" });
  const [citizenName, setCitizenName]     = useState("");
  const [citizenFather, setCitizenFather] = useState("");
  const [citizenPhone, setCitizenPhone]   = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion]  = useState<AiAnalysis | null>(null);
  const [analyzing, setAnalyzing]         = useState(false);
  const [imagePreview, setImagePreview]   = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl]   = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Report generator state
  const [rptType, setRptType]         = useState("Şikayət");
  const [rptText, setRptText]         = useState("");
  const [rptName, setRptName]         = useState("");
  const [rptFather, setRptFather]     = useState("");
  const [rptAddress, setRptAddress]   = useState("");
  const [rptPhone, setRptPhone]       = useState("");
  const [rptImage, setRptImage]       = useState<string | null>(null);
  const [rptImageUrl, setRptImageUrl] = useState<string | null>(null);
  const rptImageRef = useRef<HTMLInputElement>(null);
  const [generating, setGenerating]   = useState(false);
  const [report, setReport]           = useState<string | null>(null);
  const [rptError, setRptError]       = useState<string | null>(null);

  // Complaint report modal
  const [reportModal, setReportModal] = useState<{ open: boolean; report: string; title: string }>({ open: false, report: "", title: "" });
  const [reportLoading, setReportLoading] = useState<string | null>(null);

  // Complaints filter
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("users").select("full_name, role").eq("id", user.id).single()
          .then(({ data }) => setProfile(data));
      }
    });
    Promise.all([
      fetchZones().then(setZones).catch(() => {}),
      fetchComplaints(undefined, 100).then(setComplaints).catch(() => {}),
    ]).finally(() => setLoadingData(false));
  }, []);

  // AI auto-analyze
  useEffect(() => {
    if (!form.title || (form.description?.length ?? 0) < 10) { setAiSuggestion(null); return; }
    setAnalyzing(true);
    const t = setTimeout(async () => {
      try { setAiSuggestion(await analyzeComplaint(form.title, form.description, imageDataUrl ?? undefined)); }
      catch { /* silent */ }
      finally { setAnalyzing(false); }
    }, 1500);
    return () => { clearTimeout(t); setAnalyzing(false); };
  }, [form.title, form.description, imageDataUrl]);

  // Stats
  const stats = {
    open:        complaints.filter(c => c.status === "open").length,
    in_progress: complaints.filter(c => c.status === "in_progress").length,
    resolved:    complaints.filter(c => c.status === "resolved").length,
    closed:      complaints.filter(c => c.status === "closed").length,
  };
  const total = complaints.length;

  const filteredComplaints = statusFilter === "all"
    ? complaints
    : complaints.filter(c => c.status === statusFilter);

  // Submit complaint
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!form.priority) { setSubmitError("Kritiklik səviyyəsini seçin."); return; }
    setSubmitting(true);
    try {
      const created = await createComplaint({
        ...form,
        citizen_name:   citizenName   || undefined,
        citizen_father: citizenFather || undefined,
        citizen_phone:  citizenPhone  || undefined,
      });
      setComplaints(prev => [created, ...prev]);
      setForm({ title: "", description: "", submission_type: "Şikayət" });
      setCitizenName(""); setCitizenFather(""); setCitizenPhone("");
      setImagePreview(null); setImageDataUrl(null); setAiSuggestion(null);
      setSubmitSuccess(true);
      setTimeout(() => { setSubmitSuccess(false); setTab("complaints"); }, 2000);
    } catch { setSubmitError("Şikayət göndərilmədi. Yenidən cəhd edin."); }
    finally { setSubmitting(false); }
  }

  // Image select (submit form)
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = ev => setImageDataUrl(ev.target?.result as string ?? null);
    reader.readAsDataURL(file);
  }

  // Status update
  async function handleStatusChange(id: string, status: string) {
    try {
      const updated = await updateComplaint(id, { status });
      setComplaints(prev => prev.map(c => c.id === id ? updated : c));
    } catch { alert("Status yenilənmədi."); }
  }

  // Generate report from complaint
  async function handleGenerateReport(c: Complaint) {
    setReportLoading(c.id.toString());
    try {
      const result = await generateReport({
        submission_type: (c as any).submission_type ?? "Şikayət",
        citizen_text:    `${c.title}\n\n${c.description}`,
        full_name:       (c as any).citizen_name   ?? "",
        father_name:     (c as any).citizen_father ?? "",
        phone:           (c as any).citizen_phone  ?? "",
      });
      setReportModal({ open: true, report: result.report, title: c.title });
    } catch { alert("Hesabat hazırlanarkən xəta baş verdi."); }
    finally { setReportLoading(null); }
  }

  // Generate AI report (standalone)
  async function handleGenerateStandalone(e: React.FormEvent) {
    e.preventDefault();
    if (!rptText.trim()) { setRptError("Müraciət mətnini daxil edin."); return; }
    setRptError(null); setReport(null); setGenerating(true);
    try {
      const payload: ReportRequest = {
        submission_type: rptType, citizen_text: rptText,
        full_name: rptName, father_name: rptFather,
        address: rptAddress, phone: rptPhone,
        image_url: rptImageUrl ?? undefined,
      };
      const result = await generateReport(payload);
      setReport(result.report);
    } catch { setRptError("Hesabat hazırlanarkən xəta baş verdi."); }
    finally { setGenerating(false); }
  }

  function handleRptImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRptImage(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = ev => setRptImageUrl(ev.target?.result as string ?? null);
    reader.readAsDataURL(file);
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "complaints", label: "Şikayətlər",  icon: "assignment" },
    { key: "submit",     label: "Yeni Müraciət",icon: "add_circle" },
    { key: "report",     label: "Hesabat Yarat", icon: "description"},
  ];

  return (
    <div className="min-h-screen bg-background pb-xl">
      <div className="max-w-8xl mx-auto px-margin-mobile md:px-margin-desktop py-md">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-headline-lg font-bold text-on-surface">
              Salam, {profile?.full_name ?? "Admin"}
            </h1>
            <p className="text-body-md text-on-surface-variant mt-1">
              Nərimanov Rayon İcra Hakimiyyəti · İdarəetmə Paneli
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/map" prefetch={false}
              className="flex items-center gap-2 text-label-md border border-primary-container/20 text-primary px-4 py-2 rounded hover:bg-surface-container-low transition-colors">
              <span className="material-symbols-outlined text-[18px]">map</span>
              Xəritə
            </Link>
            <Link href="/admin/users" prefetch={false}
              className="flex items-center gap-2 text-label-md bg-primary text-on-primary px-4 py-2 rounded hover:bg-primary-container transition-colors">
              <span className="material-symbols-outlined text-[18px]">group</span>
              İstifadəçilər
            </Link>
          </div>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter mb-md">
          {[
            { label: "Açıq",        count: stats.open,        icon: "inbox",        accent: "text-secondary"        },
            { label: "İcrada",       count: stats.in_progress, icon: "autorenew",   accent: "text-primary-container" },
            { label: "Həll edildi",  count: stats.resolved,    icon: "check_circle", accent: "text-secondary"        },
            { label: "Bağlı",        count: stats.closed,      icon: "archive",      accent: "text-on-surface-variant"},
          ].map(({ label, count, icon, accent }) => (
            <div key={label} className="bg-surface-container-lowest border border-primary-container/10 rounded-lg p-md flex items-center gap-4">
              <span className={`material-symbols-outlined text-3xl filled ${accent}`}>{icon}</span>
              <div>
                <p className="text-headline-md font-bold text-on-surface">{count}</p>
                <p className="text-label-sm text-on-surface-variant">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="flex gap-1 border-b border-outline-variant/30 mb-md">
          {TABS.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-label-md transition-colors border-b-2 -mb-px ${
                tab === key
                  ? "border-secondary text-secondary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] ${tab === key ? "filled" : ""}`}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab: Complaints ────────────────────────────────────────────── */}
        {tab === "complaints" && (
          <div className="flex flex-col gap-4">
            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              {["all", ...STATUS_OPTS].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-label-sm transition-colors ${
                    statusFilter === s
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {s === "all" ? `Hamısı (${total})` : `${STATUS_LABELS[s]} (${stats[s as keyof typeof stats]})`}
                </button>
              ))}
            </div>

            {/* Complaints table */}
            {loadingData ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div className="text-center py-16 text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl text-outline mb-3 block">inbox</span>
                <p className="text-body-lg">Şikayət yoxdur</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredComplaints.map((c) => (
                  <div key={c.id} className="bg-surface-container-lowest border border-primary-container/10 rounded-lg p-md hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`inline-flex items-center gap-1 text-label-sm px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                            {STATUS_LABELS[c.status]}
                          </span>
                          {c.priority && (
                            <span className="text-label-sm px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: PRIORITY_COLORS[c.priority] }} />
                              {PRIORITY_LABELS[c.priority]}
                            </span>
                          )}
                          {(c as any).submission_type && (
                            <span className="text-label-sm text-on-surface-variant">{(c as any).submission_type}</span>
                          )}
                        </div>
                        <h3 className="text-label-md text-on-surface font-semibold truncate">{c.title}</h3>
                        <p className="text-body-md text-on-surface-variant mt-1 line-clamp-2">{c.description}</p>
                        {(c as any).citizen_name && (
                          <p className="text-label-sm text-on-surface-variant mt-1">
                            <span className="material-symbols-outlined text-[14px] align-middle mr-1">person</span>
                            {(c as any).citizen_name}
                            {(c as any).citizen_phone && ` · ${(c as any).citizen_phone}`}
                          </p>
                        )}
                        <p className="text-label-sm text-outline mt-2">
                          {new Date(c.created_at).toLocaleDateString("az-AZ", { day: "2-digit", month: "long", year: "numeric" })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* Status select */}
                        <select
                          value={c.status}
                          onChange={e => handleStatusChange(c.id.toString(), e.target.value)}
                          className="text-label-sm border border-primary-container/20 rounded px-2 py-1 bg-surface-container-lowest text-on-surface focus:outline-none focus:border-secondary"
                        >
                          {STATUS_OPTS.map(s => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>

                        {/* Report button */}
                        <button
                          onClick={() => handleGenerateReport(c)}
                          disabled={reportLoading === c.id.toString()}
                          className="flex items-center gap-1.5 text-label-sm border border-primary-container/20 text-on-surface-variant px-3 py-1 rounded hover:border-secondary hover:text-secondary transition-colors disabled:opacity-50"
                        >
                          {reportLoading === c.id.toString() ? (
                            <span className="material-symbols-outlined text-[16px] animate-spin">autorenew</span>
                          ) : (
                            <span className="material-symbols-outlined text-[16px]">description</span>
                          )}
                          Hesabat
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Submit ────────────────────────────────────────────────── */}
        {tab === "submit" && (
          <div className="max-w-2xl">
            <form onSubmit={handleSubmit} className="flex flex-col gap-md bg-surface-container-lowest border border-primary-container/10 rounded-lg p-md">

              {/* Submission type */}
              <div className="flex flex-col gap-xs">
                <label className="text-label-sm text-on-surface">Müraciət Növü</label>
                <div className="flex gap-2">
                  {SUBMISSION_TYPES.map(t => (
                    <button key={t} type="button"
                      onClick={() => setForm({ ...form, submission_type: t })}
                      className={`flex-1 py-2 px-3 rounded border-2 text-label-md transition-all ${
                        (form.submission_type ?? "Şikayət") === t
                          ? "bg-primary text-on-primary border-primary"
                          : "bg-surface-container-lowest text-on-surface-variant border-primary-container/20 hover:border-secondary"
                      }`}
                    >{t}</button>
                  ))}
                </div>
              </div>

              {/* Citizen info */}
              <div className="flex flex-col gap-xs">
                <label className="text-label-sm text-on-surface">Vətəndaş Məlumatları <span className="text-on-surface-variant font-normal">(ixtiyari)</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Ad Soyad", val: citizenName,   set: setCitizenName,   ph: "Əli Əliyev",        span: false },
                    { label: "Ata adı",  val: citizenFather, set: setCitizenFather, ph: "Həsən",             span: false },
                    { label: "Telefon",  val: citizenPhone,  set: setCitizenPhone,  ph: "+994 50 XXX XX XX", span: true  },
                  ].map(({ label, val, set, ph, span }) => (
                    <div key={label} className={span ? "col-span-2" : ""}>
                      <label className="block text-label-sm text-on-surface-variant mb-xs">{label}</label>
                      <input type="text" value={val} onChange={e => set(e.target.value)} placeholder={ph}
                        className="w-full border border-primary-container/20 rounded px-sm py-xs text-body-md text-on-surface bg-surface-container focus:outline-none focus:border-secondary transition-colors placeholder:text-on-surface-variant"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="flex flex-col gap-xs">
                <label className="text-label-sm text-on-surface">Mövzu *</label>
                <input type="text" required value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Şikayətin qısa başlığı"
                  className="w-full border border-primary-container/20 rounded px-sm py-sm text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-secondary transition-colors placeholder:text-on-surface-variant"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-xs">
                <label className="text-label-sm text-on-surface">Ətraflı açıqlama *</label>
                <textarea required rows={5} value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Problem haqqında ətraflı məlumat..."
                  className="w-full border border-primary-container/20 rounded px-sm py-sm text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-secondary transition-colors resize-none placeholder:text-on-surface-variant"
                />
              </div>

              {/* Image upload */}
              <div className="flex flex-col gap-xs">
                <label className="text-label-sm text-on-surface">Şəkil <span className="text-on-surface-variant font-normal">(ixtiyari)</span></label>
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="preview" className="h-28 w-auto rounded border border-primary-container/10 object-cover" />
                    <button type="button" onClick={() => { setImagePreview(null); setImageDataUrl(null); if (imageInputRef.current) imageInputRef.current.value = ""; }}
                      className="absolute -top-2 -right-2 bg-surface-container-lowest border border-primary-container/20 rounded-full w-5 h-5 flex items-center justify-center text-on-surface-variant hover:text-error text-xs shadow">×</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => imageInputRef.current?.click()}
                    className="flex items-center gap-2 px-sm py-xs border border-dashed border-primary-container/30 rounded text-label-md text-on-surface-variant hover:border-secondary hover:text-secondary transition-colors w-fit">
                    <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                    Şəkil əlavə et
                  </button>
                )}
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              </div>

              {/* AI suggestion */}
              {(analyzing || aiSuggestion) && (
                <div className="rounded border border-secondary-container bg-secondary-container/10 p-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-[16px] text-secondary filled">auto_awesome</span>
                    <span className="text-label-sm font-bold text-secondary">AI Analiz</span>
                    {analyzing && <span className="ml-auto text-label-sm text-secondary animate-pulse">Analiz edilir...</span>}
                  </div>
                  {aiSuggestion && !analyzing && (
                    <>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-label-sm text-on-surface-variant">Tövsiyə olunan kritiklik:</span>
                        <span className="text-label-sm font-bold text-on-primary px-2 py-0.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[aiSuggestion.priority] }}>
                          {PRIORITY_LABELS[aiSuggestion.priority]}
                        </span>
                        {aiSuggestion.category && <span className="text-label-sm bg-secondary-container/30 text-secondary px-2 py-0.5 rounded-full">{aiSuggestion.category}</span>}
                      </div>
                      {aiSuggestion.reasoning && <p className="text-label-sm text-on-surface-variant leading-relaxed">{aiSuggestion.reasoning}</p>}
                      {form.priority !== aiSuggestion.priority && (
                        <button type="button" onClick={() => setForm(p => ({ ...p, priority: aiSuggestion.priority }))}
                          className="mt-2 text-label-sm text-on-secondary bg-secondary hover:bg-secondary/90 px-3 py-1 rounded-full font-semibold transition-colors">
                          Tövsiyəni qəbul et
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Priority */}
              <div className="flex flex-col gap-xs">
                <label className="text-label-sm text-on-surface">Kritiklik Səviyyəsi *</label>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITY_OPTS.map(opt => {
                    const selected = form.priority === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => setForm({ ...form, priority: opt.value })}
                        className={`p-sm rounded border-2 text-left transition-all ${selected ? "border-current" : "border-primary-container/20 hover:border-primary-container/40"}`}
                        style={selected ? { borderColor: opt.color, backgroundColor: `${opt.color}15` } : {}}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                          <span className="text-label-md text-on-surface">{opt.label}</span>
                        </div>
                        <span className="text-label-sm text-on-surface-variant pl-4">Son müddət: {opt.deadline}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Zone */}
              <div className="flex flex-col gap-xs">
                <label className="text-label-sm text-on-surface">Zona <span className="text-on-surface-variant font-normal">(ixtiyari)</span></label>
                <select value={form.zone_id ?? ""} onChange={e => setForm({ ...form, zone_id: e.target.value || undefined })}
                  className="w-full border border-primary-container/20 rounded px-sm py-sm text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-secondary">
                  <option value="">Zona seçin</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name_az}</option>)}
                </select>
              </div>

              {submitSuccess && (
                <div className="flex items-center gap-2 text-label-sm text-secondary bg-secondary-container/20 border border-secondary/20 rounded px-sm py-xs">
                  <span className="material-symbols-outlined text-[18px] filled">check_circle</span>
                  Şikayətiniz qəbul edildi. Şikayətlər bölməsinə keçirilirsiniz...
                </div>
              )}
              {submitError && (
                <p className="text-label-sm text-error bg-error-container/30 border border-error/20 rounded px-sm py-xs">{submitError}</p>
              )}

              <button type="submit" disabled={submitting}
                className="w-full bg-primary text-on-primary text-label-md rounded py-sm hover:bg-primary-container transition-colors flex items-center justify-center gap-xs disabled:opacity-60 active:scale-[0.98]">
                {submitting ? "Göndərilir..." : "Şikayət Göndər"}
                {!submitting && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
              </button>
            </form>
          </div>
        )}

        {/* ── Tab: Report Generator ──────────────────────────────────────── */}
        {tab === "report" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
            {/* Form */}
            <form onSubmit={handleGenerateStandalone} className="flex flex-col gap-md bg-surface-container-lowest border border-primary-container/10 rounded-lg p-md">
              <div className="flex flex-col gap-xs">
                <label className="text-label-sm text-on-surface">Müraciət Növü</label>
                <div className="flex gap-2">
                  {SUBMISSION_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => setRptType(t)}
                      className={`flex-1 py-2 px-3 rounded border-2 text-label-md transition-all ${
                        rptType === t ? "bg-primary text-on-primary border-primary" : "border-primary-container/20 text-on-surface-variant hover:border-secondary"
                      }`}>{t}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Ad Soyad", val: rptName,   set: setRptName,   ph: "Əli Əliyev" },
                  { label: "Ata adı",  val: rptFather, set: setRptFather, ph: "Həsən" },
                  { label: "Ünvan",    val: rptAddress, set: setRptAddress, ph: "Koroğlu küç. 12" },
                  { label: "Telefon",  val: rptPhone,  set: setRptPhone,  ph: "+994 50 XXX XX XX" },
                ].map(({ label, val, set, ph }) => (
                  <div key={label}>
                    <label className="block text-label-sm text-on-surface-variant mb-xs">{label}</label>
                    <input type="text" value={val} onChange={e => set(e.target.value)} placeholder={ph}
                      className="w-full border border-primary-container/20 rounded px-sm py-xs text-body-md text-on-surface bg-surface-container focus:outline-none focus:border-secondary placeholder:text-on-surface-variant" />
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-xs">
                <label className="text-label-sm text-on-surface">Müraciətin Məzmunu *</label>
                <textarea required rows={7} value={rptText} onChange={e => setRptText(e.target.value)}
                  placeholder="Vətəndaşın müraciəti, şikayəti və ya təklifi tam mətnini buraya daxil edin..."
                  className="w-full border border-primary-container/20 rounded px-sm py-sm text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-secondary resize-none placeholder:text-on-surface-variant" />
                <p className="text-label-sm text-on-surface-variant">{rptText.length} simvol</p>
              </div>

              {/* Image */}
              <div className="flex flex-col gap-xs">
                <label className="text-label-sm text-on-surface">Şəkil <span className="text-on-surface-variant font-normal">(ixtiyari)</span></label>
                {rptImage ? (
                  <div className="relative inline-block">
                    <img src={rptImage} alt="preview" className="h-24 w-auto rounded border border-primary-container/10 object-cover" />
                    <button type="button" onClick={() => { setRptImage(null); setRptImageUrl(null); if (rptImageRef.current) rptImageRef.current.value = ""; }}
                      className="absolute -top-2 -right-2 bg-surface-container-lowest border border-primary-container/20 rounded-full w-5 h-5 flex items-center justify-center text-on-surface-variant hover:text-error text-xs shadow">×</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => rptImageRef.current?.click()}
                    className="flex items-center gap-2 px-sm py-xs border border-dashed border-primary-container/30 rounded text-label-md text-on-surface-variant hover:border-secondary hover:text-secondary transition-colors w-fit">
                    <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                    Şəkil əlavə et
                  </button>
                )}
                <input ref={rptImageRef} type="file" accept="image/*" className="hidden" onChange={handleRptImageSelect} />
              </div>

              {rptError && <p className="text-label-sm text-error bg-error-container/30 rounded px-sm py-xs">{rptError}</p>}

              <div className="flex gap-3">
                <button type="submit" disabled={generating || !rptText.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-secondary text-on-secondary text-label-md rounded py-sm hover:bg-secondary/90 transition-colors disabled:opacity-60 active:scale-[0.98]">
                  {generating ? (
                    <><span className="material-symbols-outlined text-[18px] animate-spin">autorenew</span>Hazırlanır...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[18px] filled">auto_awesome</span>AI Hesabat Yarat</>
                  )}
                </button>
                {report && (
                  <button type="button" onClick={() => { setReport(null); setRptText(""); setRptName(""); setRptFather(""); setRptAddress(""); setRptPhone(""); }}
                    className="px-4 py-sm border border-primary-container/20 text-on-surface-variant rounded text-label-md hover:bg-surface-container-low transition-colors">
                    Yenilə
                  </button>
                )}
              </div>
            </form>

            {/* Report output */}
            <div>
              {!report && !generating && (
                <div className="h-full min-h-64 flex flex-col items-center justify-center bg-surface-container-low border border-dashed border-primary-container/20 rounded-lg p-8 text-center">
                  <span className="material-symbols-outlined text-5xl text-outline mb-3 block">description</span>
                  <p className="text-label-md text-on-surface-variant">Hesabat burada görünəcək</p>
                  <p className="text-label-sm text-outline mt-1">Formu doldurun və AI Hesabat Yarat düyməsinə basın</p>
                </div>
              )}
              {generating && (
                <div className="h-full min-h-64 flex flex-col items-center justify-center bg-secondary-container/10 border border-secondary/20 rounded-lg p-8 text-center">
                  <span className="material-symbols-outlined text-5xl text-secondary animate-spin mb-3 block">autorenew</span>
                  <p className="text-label-md text-secondary font-semibold">AI hesabat hazırlayır...</p>
                  <p className="text-label-sm text-on-surface-variant mt-1">Bu 15–30 saniyə çəkə bilər</p>
                </div>
              )}
              {report && (
                <div className="bg-surface-container-lowest border border-primary-container/10 rounded-lg overflow-hidden">
                  {/* Toolbar */}
                  <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant/20 bg-surface-container-low">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-secondary" />
                      <span className="text-label-md text-on-surface">Hesabat hazırdır</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => navigator.clipboard.writeText(report).catch(() => {})}
                        className="flex items-center gap-1.5 text-label-sm border border-primary-container/20 text-on-surface-variant px-3 py-1 rounded hover:bg-surface-container transition-colors">
                        <span className="material-symbols-outlined text-[16px]">content_copy</span>
                        Kopyala
                      </button>
                      <button onClick={() => window.print()}
                        className="flex items-center gap-1.5 text-label-sm bg-primary text-on-primary px-3 py-1 rounded hover:bg-primary-container transition-colors">
                        <span className="material-symbols-outlined text-[16px]">print</span>
                        Çap Et
                      </button>
                    </div>
                  </div>
                  {/* Letterhead */}
                  <div className="px-md pt-md pb-sm border-b border-outline-variant/20 text-center">
                    <p className="text-label-sm text-on-surface-variant uppercase tracking-widest">Azərbaycan Respublikası</p>
                    <p className="text-label-md font-bold text-on-surface">Bakı şəhəri Nərimanov Rayon İcra Hakimiyyəti</p>
                    <p className="text-label-sm text-on-surface-variant">Rəsmi Müraciət Hesabatı</p>
                  </div>
                  {/* Body */}
                  <div className="px-md py-md">
                    <ReportRenderer text={report} />
                  </div>
                  <div className="px-md pb-md border-t border-outline-variant/20 pt-sm">
                    <p className="text-label-sm text-on-surface-variant text-center">
                      Bu sənəd AI Hesabat Sistemi tərəfindən avtomatik yaradılmışdır. Rəsmi qüvvəyə minməsi üçün səlahiyyətli şəxsin imzası tələb olunur.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Report Modal (from complaint) ─────────────────────────────────── */}
      {reportModal.open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-primary/50 p-4 overflow-y-auto backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-xl border border-primary-container/10 shadow-2xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant/20">
              <div>
                <h2 className="text-label-md font-bold text-on-surface">Rəsmi Müraciət Hesabatı</h2>
                <p className="text-label-sm text-on-surface-variant mt-0.5 truncate max-w-sm">{reportModal.title}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigator.clipboard.writeText(reportModal.report).catch(() => {})}
                  className="flex items-center gap-1.5 text-label-sm border border-primary-container/20 text-on-surface-variant px-3 py-1 rounded hover:bg-surface-container transition-colors">
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  Kopyala
                </button>
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-label-sm bg-primary text-on-primary px-3 py-1 rounded hover:bg-primary-container transition-colors">
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  Çap Et
                </button>
                <button onClick={() => setReportModal({ open: false, report: "", title: "" })}
                  className="p-1.5 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-container transition-colors">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>
            <div className="px-md pt-md pb-sm border-b border-outline-variant/20 text-center">
              <p className="text-label-sm text-on-surface-variant uppercase tracking-widest">Azərbaycan Respublikası</p>
              <p className="text-label-md font-bold text-on-surface">Bakı şəhəri Nərimanov Rayon İcra Hakimiyyəti</p>
              <p className="text-label-sm text-on-surface-variant">Rəsmi Müraciət Hesabatı</p>
            </div>
            <div className="px-md py-md max-h-[60vh] overflow-y-auto">
              <ReportRenderer text={reportModal.report} />
            </div>
            <div className="px-md py-sm border-t border-outline-variant/20 bg-surface-container-low rounded-b-xl">
              <p className="text-label-sm text-on-surface-variant text-center">
                Bu sənəd AI Hesabat Sistemi tərəfindən avtomatik yaradılmışdır. Rəsmi qüvvəyə minməsi üçün səlahiyyətli şəxsin imzası tələb olunur.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RoleGuard roles={["admin", "operator"]}>
      <DashboardContent />
    </RoleGuard>
  );
}
