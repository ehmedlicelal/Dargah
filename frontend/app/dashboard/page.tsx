"use client";

import { useEffect, useRef, useState } from "react";
import {
  analyzeComplaint, fetchComplaints, fetchServices, fetchZones,
  generateReport, updateComplaint, createComplaint, suggestService,
  deleteComplaint,
  type ReportRequest, type ServiceSuggestion,
} from "@/lib/api";
import type { AiAnalysis } from "@/lib/api";
import type { Complaint, ComplaintCreate, DistrictZone, Service } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";

const SUBMISSION_TYPES = ["Şikayət", "Ərizə", "Təklif"] as const;

const PRIORITY_OPTS = [
  { value: "low" as const,      label: "Aşağı",  deadline: "30 gün",  color: "#22c55e", days: 30 },
  { value: "medium" as const,   label: "Orta",   deadline: "14 gün",  color: "#3b82f6", days: 14 },
  { value: "high" as const,     label: "Yüksək", deadline: "7 gün",   color: "#f97316", days: 7  },
  { value: "critical" as const, label: "Kritik", deadline: "48 saat", color: "#ef4444", days: 2  },
] as const;

function deadlineFromPriority(priority: string): string {
  const opt = PRIORITY_OPTS.find(p => p.value === priority);
  const days = opt?.days ?? 14;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm for datetime-local input
}

function deadlineStatus(deadline: string | null): "overdue" | "near" | "ok" | "none" {
  if (!deadline) return "none";
  const dl = new Date(deadline).getTime();
  const now = Date.now();
  if (dl < now) return "overdue";
  if (dl - now < 48 * 60 * 60 * 1000) return "near";
  return "ok";
}

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
const CATEGORY_TO_SERVICE: Record<string, string[]> = {
  road:        ["Yol", "İnfrastruktur", "road"],
  utilities:   ["Kommunal", "Su", "Qaz", "utilities"],
  environment: ["Ekologiya", "Yaşıllaşdırma", "environment"],
  safety:      ["Təhlükəsizlik", "Polis", "safety"],
  social:      ["Sosial", "social"],
};

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

function ProgressTimeline({ status }: { status: string }) {
  const steps = STATUS_OPTS;
  const current = steps.indexOf(status as typeof steps[number]);
  return (
    <div className="flex items-start gap-0 mt-3 mb-1">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 flex-col items-center">
          <div className="flex w-full items-center">
            {i > 0 && <div className={`flex-1 h-0.5 ${i <= current ? "bg-secondary" : "bg-outline-variant/40"}`} />}
            <div className={`w-3 h-3 rounded-full border-2 shrink-0 transition-colors ${
              i < current  ? "bg-secondary border-secondary" :
              i === current ? "bg-secondary border-secondary ring-2 ring-secondary/30" :
              "bg-surface border-outline-variant"
            }`} />
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${i < current ? "bg-secondary" : "bg-outline-variant/40"}`} />}
          </div>
          <span className={`text-[10px] mt-1 text-center leading-tight ${i === current ? "text-secondary font-semibold" : "text-on-surface-variant"}`}>
            {STATUS_LABELS[s]}
          </span>
        </div>
      ))}
    </div>
  );
}

type Tab = "complaints" | "submit" | "report";

function DashboardContent() {
  const [tab, setTab]             = useState<Tab>("complaints");
  const [zones, setZones]         = useState<DistrictZone[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [services, setServices]   = useState<Service[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [profile, setProfile]     = useState<{ full_name?: string | null; role?: string } | null>(null);

  // Expanded complaint
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingPriority, setEditingPriority] = useState<Record<string, string>>({});
  const [editingCategory, setEditingCategory] = useState<Record<string, string>>({});
  const [directedService, setDirectedService] = useState<Record<string, string>>({});
  const [editingDeadline, setEditingDeadline] = useState<Record<string, string>>({});
  const [savingExtra, setSavingExtra] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [svcSuggestion, setSvcSuggestion] = useState<Record<string, ServiceSuggestion & { loading?: boolean }>>({});

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
  const [rptPriority, setRptPriority] = useState<string>("");
  const [rptZone, setRptZone]         = useState<string>("");
  const [rptImage, setRptImage]       = useState<string | null>(null);
  const [rptImageUrl, setRptImageUrl] = useState<string | null>(null);
  const rptImageRef = useRef<HTMLInputElement>(null);
  const [generating, setGenerating]   = useState(false);
  const [report, setReport]           = useState<string | null>(null);
  const [rptError, setRptError]       = useState<string | null>(null);

  // Complaint report modal
  const [reportModal, setReportModal] = useState<{ open: boolean; report: string; title: string }>({ open: false, report: "", title: "" });
  const [reportLoading, setReportLoading] = useState<string | null>(null);

  // Filter
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
      fetchServices().then(setServices).catch(() => {}),
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
      // Apply AI category if suggestion was accepted
      if (aiSuggestion?.category && created.id) {
        await updateComplaint(created.id.toString(), { category: aiSuggestion.category }).catch(() => {});
        created.category = aiSuggestion.category;
      }
      setComplaints(prev => [created, ...prev]);
      setForm({ title: "", description: "", submission_type: "Şikayət" });
      setCitizenName(""); setCitizenFather(""); setCitizenPhone("");
      setImagePreview(null); setImageDataUrl(null); setAiSuggestion(null);
      setSubmitSuccess(true);
      setTimeout(() => { setSubmitSuccess(false); setTab("complaints"); }, 2000);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Şikayət göndərilmədi. Yenidən cəhd edin.");
    } finally { setSubmitting(false); }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = ev => setImageDataUrl(ev.target?.result as string ?? null);
    reader.readAsDataURL(file);
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      const updated = await updateComplaint(id, { status });
      setComplaints(prev => prev.map(c => c.id === id ? updated : c));
    } catch { alert("Status yenilənmədi."); }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`"${title}" şikayətini silmək istədiyinizdən əminsiniz?`)) return;
    setDeletingId(id);
    try {
      await deleteComplaint(id);
      setComplaints(prev => prev.filter(c => c.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch { alert("Şikayət silinmədi."); }
    finally { setDeletingId(null); }
  }

  async function handleSaveExtras(c: Complaint) {
    setSavingExtra(c.id.toString());
    try {
      const patch: Record<string, string | null> = {};
      if (editingPriority[c.id]) patch.priority = editingPriority[c.id];
      if (editingCategory[c.id]) patch.category = editingCategory[c.id];
      if (editingDeadline[c.id] !== undefined) {
        patch.deadline = editingDeadline[c.id] ? new Date(editingDeadline[c.id]).toISOString() : null;
      }

      const svcId = directedService[c.id];
      if (svcId !== undefined) {
        patch.assigned_service_id = svcId || null;
        const svc = services.find(s => s.id === svcId);
        patch.report_content = JSON.stringify({
          directed_service_id: svcId,
          directed_service_name: svc?.name_az ?? svc?.name ?? "",
        });
      }

      if (Object.keys(patch).length > 0) {
        const updated = await updateComplaint(c.id.toString(), patch);
        setComplaints(prev => prev.map(x => x.id === c.id ? updated : x));
      }
    } catch { alert("Yeniləmə uğursuz oldu."); }
    finally { setSavingExtra(null); }
  }

  async function handleSuggestService(c: Complaint) {
    setSvcSuggestion(prev => ({ ...prev, [c.id]: { suggested_ids: [], reasoning: "", loading: true } }));
    try {
      const result = await suggestService(c.title, c.description, c.category);
      setSvcSuggestion(prev => ({ ...prev, [c.id]: { ...result, loading: false } }));
      // Auto-select the first suggestion if none chosen yet
      if (result.suggested_ids[0] && !directedService[c.id]) {
        setDirectedService(prev => ({ ...prev, [c.id]: result.suggested_ids[0] }));
      }
    } catch {
      setSvcSuggestion(prev => ({ ...prev, [c.id]: { suggested_ids: [], reasoning: "AI xidmət tövsiyəsi alına bilmədi.", loading: false } }));
    }
  }

  async function handleGenerateReport(c: Complaint) {
    setReportLoading(c.id.toString());
    try {
      const result = await generateReport({
        submission_type: (c as any).submission_type ?? "Şikayət",
        citizen_text:    `${c.title}\n\n${c.description}`,
        full_name:       (c as any).citizen_name   ?? "",
        father_name:     (c as any).citizen_father ?? "",
        phone:           (c as any).citizen_phone  ?? "",
        priority:        c.priority,
      });
      setReportModal({ open: true, report: result.report, title: c.title });
    } catch { alert("Hesabat hazırlanarkən xəta baş verdi."); }
    finally { setReportLoading(null); }
  }

  async function handleGenerateStandalone(e: React.FormEvent) {
    e.preventDefault();
    if (!rptText.trim()) { setRptError("Müraciət mətnini daxil edin."); return; }
    setRptError(null); setReport(null); setGenerating(true);
    try {
      const zone = zones.find(z => z.id === rptZone);
      const payload: ReportRequest = {
        submission_type: rptType,
        citizen_text: rptText,
        full_name: rptName,
        father_name: rptFather,
        address: rptAddress,
        phone: rptPhone,
        priority: rptPriority || undefined,
        zone_name: zone?.name_az || undefined,
        image_url: rptImageUrl ?? undefined,
      };
      const result = await generateReport(payload);
      setReport(result.report);
    } catch (err: unknown) {
      setRptError(err instanceof Error ? err.message : "Hesabat hazırlanarkən xəta baş verdi. Backend serverinin işlədiyini yoxlayın.");
    } finally { setGenerating(false); }
  }

  function handleRptImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRptImage(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = ev => setRptImageUrl(ev.target?.result as string ?? null);
    reader.readAsDataURL(file);
  }

  function getMatchingServices(complaint: Complaint): Service[] {
    if (!complaint.category) return services.slice(0, 5);
    const keywords = CATEGORY_TO_SERVICE[complaint.category] ?? [];
    const matched = services.filter(s =>
      keywords.some(kw =>
        (s.name_az ?? s.name ?? "").toLowerCase().includes(kw.toLowerCase()) ||
        (s.category ?? "").toLowerCase().includes(kw.toLowerCase())
      )
    );
    return matched.length > 0 ? matched : services.slice(0, 5);
  }

  function getDirectedServiceName(c: Complaint): string | null {
    if (c.assigned_service_id) {
      const svc = services.find(s => s.id === c.assigned_service_id);
      if (svc) return svc.name_az ?? svc.name;
    }
    try {
      const rc = (c as any).report_content;
      if (rc) {
        const parsed = JSON.parse(rc);
        return parsed.directed_service_name ?? null;
      }
    } catch { /* */ }
    return null;
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "complaints", label: "Şikayətlər",   icon: "assignment" },
    { key: "submit",     label: "Yeni Müraciət", icon: "add_circle" },
    { key: "report",     label: "Hesabat Yarat",  icon: "description" },
  ];

  return (
    <div className="min-h-screen bg-background pb-xl">
      <div className="max-w-8xl mx-auto px-margin-mobile md:px-margin-desktop py-md">

        {/* Header */}
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter mb-md">
          {[
            { label: "Açıq",       count: stats.open,        icon: "inbox",        accent: "text-secondary"         },
            { label: "İcrada",      count: stats.in_progress, icon: "autorenew",    accent: "text-primary-container" },
            { label: "Həll edildi", count: stats.resolved,    icon: "check_circle", accent: "text-secondary"         },
            { label: "Bağlı",       count: stats.closed,      icon: "archive",      accent: "text-on-surface-variant"},
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

        {/* Deadline notification banner */}
        {(() => {
          const overdue = complaints.filter(c => c.status !== "resolved" && c.status !== "closed" && deadlineStatus(c.deadline) === "overdue");
          const near    = complaints.filter(c => c.status !== "resolved" && c.status !== "closed" && deadlineStatus(c.deadline) === "near");
          if (overdue.length === 0 && near.length === 0) return null;
          return (
            <div className="flex flex-col gap-2 mb-md">
              {overdue.length > 0 && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-lg px-md py-sm">
                  <span className="material-symbols-outlined text-[20px] text-red-600 mt-0.5 shrink-0 filled">alarm_off</span>
                  <div>
                    <p className="text-label-md font-semibold text-red-700">Müddəti keçmiş şikayətlər — {overdue.length} ədəd</p>
                    <p className="text-label-sm text-red-600 mt-0.5">{overdue.map(c => c.title).join(" · ")}</p>
                  </div>
                </div>
              )}
              {near.length > 0 && (
                <div className="flex items-start gap-3 bg-orange-50 border border-orange-300 rounded-lg px-md py-sm">
                  <span className="material-symbols-outlined text-[20px] text-orange-600 mt-0.5 shrink-0 filled">alarm</span>
                  <div>
                    <p className="text-label-md font-semibold text-orange-700">Son müddəti yaxınlaşan şikayətlər — {near.length} ədəd</p>
                    <p className="text-label-sm text-orange-600 mt-0.5">{near.map(c => c.title).join(" · ")}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Tabs */}
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

        {/* ── Tab: Complaints ── */}
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
                {filteredComplaints.map(c => {
                  const isExpanded = expandedId === c.id.toString();
                  const matchedServices = getMatchingServices(c);
                  const directedName = getDirectedServiceName(c);
                  const dlStatus = deadlineStatus(c.deadline);

                  const isResolved = c.status === "resolved" || c.status === "closed";
                  const cardClass = dlStatus === "overdue" && !isResolved
                    ? "bg-red-50 border-2 border-red-400 rounded-lg overflow-hidden shadow-sm"
                    : dlStatus === "near" && !isResolved
                    ? "bg-orange-50 border-2 border-orange-300 rounded-lg overflow-hidden hover:shadow-sm transition-shadow"
                    : isResolved
                    ? "bg-green-50 border border-green-300 rounded-lg overflow-hidden hover:shadow-sm transition-shadow"
                    : "bg-surface-container-lowest border border-primary-container/10 rounded-lg overflow-hidden hover:shadow-sm transition-shadow";

                  return (
                    <div key={c.id} className={cardClass}>
                      {/* Card header row */}
                      <div className="p-md">
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
                              {c.category && (
                                <span className="text-label-sm bg-secondary-container/20 text-secondary px-2 py-0.5 rounded-full">{c.category}</span>
                              )}
                              {directedName && (
                                <span className="text-label-sm bg-primary-container/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">send</span>
                                  {directedName}
                                </span>
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
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <p className="text-label-sm text-outline">
                                {new Date(c.created_at).toLocaleDateString("az-AZ", { day: "2-digit", month: "long", year: "numeric" })}
                              </p>
                              {c.deadline && (
                                <p className={`text-label-sm flex items-center gap-1 font-medium ${
                                  dlStatus === "overdue" ? "text-red-600" :
                                  dlStatus === "near"    ? "text-orange-600" :
                                  "text-on-surface-variant"
                                }`}>
                                  <span className="material-symbols-outlined text-[13px]">
                                    {dlStatus === "overdue" ? "alarm_off" : "alarm"}
                                  </span>
                                  Son müddət: {new Date(c.deadline).toLocaleDateString("az-AZ", { day: "2-digit", month: "long", year: "numeric" })}
                                  {dlStatus === "overdue" && " — Keçib!"}
                                  {dlStatus === "near"    && " — Yaxınlaşır!"}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <select
                              value={c.status}
                              onChange={e => handleStatusChange(c.id.toString(), e.target.value)}
                              className="text-label-sm border border-primary-container/20 rounded px-2 py-1 bg-surface-container-lowest text-on-surface focus:outline-none focus:border-secondary"
                            >
                              {STATUS_OPTS.map(s => (
                                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                              ))}
                            </select>

                            <button
                              onClick={() => handleGenerateReport(c)}
                              disabled={reportLoading === c.id.toString()}
                              className="flex items-center gap-1.5 text-label-sm border border-primary-container/20 text-on-surface-variant px-3 py-1 rounded hover:border-secondary hover:text-secondary transition-colors disabled:opacity-50"
                            >
                              {reportLoading === c.id.toString()
                                ? <span className="material-symbols-outlined text-[16px] animate-spin">autorenew</span>
                                : <span className="material-symbols-outlined text-[16px]">description</span>
                              }
                              Hesabat
                            </button>

                            <button
                              onClick={() => {
                                const next = isExpanded ? null : c.id.toString();
                                setExpandedId(next);
                                if (next && !c.deadline && editingDeadline[c.id] === undefined) {
                                  setEditingDeadline(prev => ({ ...prev, [c.id]: deadlineFromPriority(c.priority) }));
                                }
                              }}
                              className="flex items-center gap-1 text-label-sm border border-primary-container/20 text-on-surface-variant px-3 py-1 rounded hover:border-secondary hover:text-secondary transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {isExpanded ? "expand_less" : "expand_more"}
                              </span>
                              {isExpanded ? "Bağla" : "Ətraflı"}
                            </button>

                            <button
                              onClick={() => handleDelete(c.id.toString(), c.title)}
                              disabled={deletingId === c.id.toString()}
                              className="flex items-center gap-1 text-label-sm border border-red-200 text-red-500 px-2 py-1 rounded hover:bg-red-50 hover:border-red-400 transition-colors disabled:opacity-50"
                              title="Şikayəti sil"
                            >
                              {deletingId === c.id.toString()
                                ? <span className="material-symbols-outlined text-[16px] animate-spin">autorenew</span>
                                : <span className="material-symbols-outlined text-[16px]">delete</span>
                              }
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded panel */}
                      {isExpanded && (
                        <div className="border-t border-outline-variant/20 bg-surface-container-low/30 p-md flex flex-col gap-md">

                          {/* Progress timeline */}
                          <div>
                            <p className="text-label-sm text-on-surface-variant mb-1 font-semibold">İcra Prosesi</p>
                            <ProgressTimeline status={c.status} />
                          </div>

                          {/* AI summary */}
                          {c.ai_summary && (
                            <div className="rounded border border-secondary-container bg-secondary-container/10 p-sm">
                              <p className="text-label-sm font-semibold text-secondary mb-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px] filled">auto_awesome</span>
                                AI Xülasə
                              </p>
                              <p className="text-label-sm text-on-surface-variant">{c.ai_summary}</p>
                            </div>
                          )}

                          {/* Edit priority + category */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-label-sm text-on-surface-variant mb-1">Kritiklik Səviyyəsi</label>
                              <select
                                value={editingPriority[c.id] ?? c.priority}
                                onChange={e => {
                                  const p = e.target.value;
                                  const oldPriority = editingPriority[c.id] ?? c.priority;
                                  setEditingPriority(prev => ({ ...prev, [c.id]: p }));
                                  // Update auto-deadline if it still matches the old priority's default (not manually changed)
                                  const oldAuto = deadlineFromPriority(oldPriority);
                                  const current = editingDeadline[c.id] ?? (c.deadline ? new Date(c.deadline).toISOString().slice(0, 16) : "");
                                  if (!current || current === oldAuto) {
                                    setEditingDeadline(prev => ({ ...prev, [c.id]: deadlineFromPriority(p) }));
                                  }
                                }}
                                className="w-full text-label-sm border border-primary-container/20 rounded px-2 py-1.5 bg-surface-container-lowest text-on-surface focus:outline-none focus:border-secondary"
                              >
                                {PRIORITY_OPTS.map(p => (
                                  <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-label-sm text-on-surface-variant mb-1">Kateqoriya</label>
                              <select
                                value={editingCategory[c.id] ?? c.category ?? ""}
                                onChange={e => setEditingCategory(prev => ({ ...prev, [c.id]: e.target.value }))}
                                className="w-full text-label-sm border border-primary-container/20 rounded px-2 py-1.5 bg-surface-container-lowest text-on-surface focus:outline-none focus:border-secondary"
                              >
                                <option value="">Kateqoriya seçin</option>
                                {["road", "utilities", "environment", "safety", "social", "other"].map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Deadline */}
                          <div>
                            <label className="block text-label-sm text-on-surface-variant mb-1 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">alarm</span>
                              Son İcra Tarixi (Deadline)
                            </label>
                            <div className="flex gap-2 items-center">
                              <input
                                type="datetime-local"
                                value={
                                  editingDeadline[c.id] !== undefined
                                    ? editingDeadline[c.id]
                                    : c.deadline ? new Date(c.deadline).toISOString().slice(0, 16) : ""
                                }
                                onChange={e => setEditingDeadline(prev => ({ ...prev, [c.id]: e.target.value }))}
                                className={`flex-1 text-label-sm border rounded px-2 py-1.5 bg-surface-container-lowest text-on-surface focus:outline-none focus:border-secondary ${
                                  dlStatus === "overdue" ? "border-red-400" :
                                  dlStatus === "near"    ? "border-orange-400" :
                                  "border-primary-container/20"
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setEditingDeadline(prev => ({ ...prev, [c.id]: deadlineFromPriority(editingPriority[c.id] ?? c.priority) }))}
                                className="text-label-sm text-secondary border border-secondary/30 rounded px-2 py-1.5 hover:bg-secondary-container/20 transition-colors whitespace-nowrap"
                              >
                                Prioritetdən al
                              </button>
                            </div>
                            {dlStatus === "overdue" && (
                              <p className="text-label-sm text-red-600 mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">alarm_off</span>
                                Bu şikayətin müddəti keçib!
                              </p>
                            )}
                            {dlStatus === "near" && (
                              <p className="text-label-sm text-orange-600 mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">alarm</span>
                                Son müddətə 48 saatdan az qalıb!
                              </p>
                            )}
                          </div>

                          {/* Direct to service */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-label-sm font-semibold text-on-surface flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">send</span>
                                Xidmətə Yönləndir
                              </p>
                              <button
                                type="button"
                                onClick={() => handleSuggestService(c)}
                                disabled={svcSuggestion[c.id]?.loading}
                                className="flex items-center gap-1 text-label-sm text-secondary border border-secondary/30 rounded px-2 py-1 hover:bg-secondary-container/20 transition-colors disabled:opacity-60"
                              >
                                {svcSuggestion[c.id]?.loading
                                  ? <><span className="material-symbols-outlined text-[14px] animate-spin">autorenew</span>AI analiz edir...</>
                                  : <><span className="material-symbols-outlined text-[14px] filled">auto_awesome</span>AI Tövsiyəsi</>
                                }
                              </button>
                            </div>

                            {svcSuggestion[c.id]?.reasoning && !svcSuggestion[c.id]?.loading && (
                              <div className="rounded border border-secondary-container bg-secondary-container/10 p-sm text-label-sm text-on-surface-variant mb-2">
                                <span className="font-semibold text-secondary">AI: </span>{svcSuggestion[c.id].reasoning}
                              </div>
                            )}

                            <div className="flex flex-col gap-2">
                              <select
                                value={directedService[c.id] ?? c.assigned_service_id ?? ""}
                                onChange={e => setDirectedService(prev => ({ ...prev, [c.id]: e.target.value }))}
                                className="w-full text-label-sm border border-primary-container/20 rounded px-2 py-1.5 bg-surface-container-lowest text-on-surface focus:outline-none focus:border-secondary"
                              >
                                <option value="">Xidmət seçin</option>
                                {services.map(s => {
                                  const isSuggested = svcSuggestion[c.id]?.suggested_ids?.includes(s.id);
                                  return (
                                    <option key={s.id} value={s.id}>
                                      {isSuggested ? "★ " : ""}{s.name_az ?? s.name}
                                    </option>
                                  );
                                })}
                              </select>
                              {(directedService[c.id] || c.assigned_service_id) && (() => {
                                const svcId = directedService[c.id] ?? c.assigned_service_id;
                                const svc = services.find(s => s.id === svcId);
                                return svc ? (
                                  <div className="rounded border border-primary-container/20 bg-surface-container-lowest p-sm text-label-sm text-on-surface-variant space-y-0.5">
                                    {svc.contact_phone && <p><span className="material-symbols-outlined text-[13px] align-middle mr-1">call</span>{svc.contact_phone}</p>}
                                    {svc.contact_email && <p><span className="material-symbols-outlined text-[13px] align-middle mr-1">mail</span>{svc.contact_email}</p>}
                                    {svc.working_hours && <p><span className="material-symbols-outlined text-[13px] align-middle mr-1">schedule</span>{svc.working_hours}</p>}
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </div>

                          {/* Save button */}
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleSaveExtras(c)}
                              disabled={savingExtra === c.id.toString()}
                              className="flex items-center gap-2 bg-secondary text-on-secondary text-label-sm px-4 py-1.5 rounded hover:bg-secondary/90 transition-colors disabled:opacity-60"
                            >
                              {savingExtra === c.id.toString()
                                ? <><span className="material-symbols-outlined text-[16px] animate-spin">autorenew</span>Saxlanılır...</>
                                : <><span className="material-symbols-outlined text-[16px]">save</span>Dəyişiklikləri Saxla</>
                              }
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Submit ── */}
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
                        className="w-full border border-primary-container/20 rounded px-sm py-xs text-body-md text-on-surface bg-surface-container focus:outline-none focus:border-secondary transition-colors placeholder:text-on-surface-variant" />
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

        {/* ── Tab: Report Generator ── */}
        {tab === "report" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md items-start">
            {/* Form */}
            <form onSubmit={handleGenerateStandalone} className="flex flex-col gap-md bg-surface-container-lowest border border-primary-container/10 rounded-lg p-md">
              {/* Submission type */}
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

              {/* Citizen info */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Ad Soyad", val: rptName,    set: setRptName,    ph: "Əli Əliyev" },
                  { label: "Ata adı",  val: rptFather,  set: setRptFather,  ph: "Həsən" },
                  { label: "Ünvan",    val: rptAddress, set: setRptAddress, ph: "Koroğlu küç. 12" },
                  { label: "Telefon",  val: rptPhone,   set: setRptPhone,   ph: "+994 50 XXX XX XX" },
                ].map(({ label, val, set, ph }) => (
                  <div key={label}>
                    <label className="block text-label-sm text-on-surface-variant mb-xs">{label}</label>
                    <input type="text" value={val} onChange={e => set(e.target.value)} placeholder={ph}
                      className="w-full border border-primary-container/20 rounded px-sm py-xs text-body-md text-on-surface bg-surface-container focus:outline-none focus:border-secondary placeholder:text-on-surface-variant" />
                  </div>
                ))}
              </div>

              {/* Priority + Zone */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-label-sm text-on-surface-variant mb-xs">Kritiklik Səviyyəsi</label>
                  <select value={rptPriority} onChange={e => setRptPriority(e.target.value)}
                    className="w-full border border-primary-container/20 rounded px-sm py-xs text-body-md text-on-surface bg-surface-container focus:outline-none focus:border-secondary">
                    <option value="">Seçin (ixtiyari)</option>
                    {PRIORITY_OPTS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-label-sm text-on-surface-variant mb-xs">Zona</label>
                  <select value={rptZone} onChange={e => setRptZone(e.target.value)}
                    className="w-full border border-primary-container/20 rounded px-sm py-xs text-body-md text-on-surface bg-surface-container focus:outline-none focus:border-secondary">
                    <option value="">Seçin (ixtiyari)</option>
                    {zones.map(z => <option key={z.id} value={z.id}>{z.name_az}</option>)}
                  </select>
                </div>
              </div>

              {/* Citizen text */}
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

              {rptError && (
                <div className="flex items-start gap-2 text-label-sm text-error bg-error-container/30 border border-error/20 rounded px-sm py-xs">
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
                  {rptError}
                </div>
              )}

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
                  <button type="button" onClick={() => { setReport(null); setRptText(""); setRptName(""); setRptFather(""); setRptAddress(""); setRptPhone(""); setRptPriority(""); setRptZone(""); }}
                    className="px-4 py-sm border border-primary-container/20 text-on-surface-variant rounded text-label-md hover:bg-surface-container-low transition-colors">
                    Yenilə
                  </button>
                )}
              </div>
            </form>

            {/* Preview panel */}
            <div className="flex flex-col min-h-64">
              {!report && !generating && (
                <div className="flex-1 min-h-64 flex flex-col items-center justify-center bg-surface-container-low border border-dashed border-primary-container/20 rounded-lg p-8 text-center">
                  <span className="material-symbols-outlined text-5xl text-outline mb-3 block">description</span>
                  <p className="text-label-md text-on-surface-variant">Hesabat burada görünəcək</p>
                  <p className="text-label-sm text-outline mt-1">Formu doldurun və AI Hesabat Yarat düyməsinə basın</p>
                </div>
              )}
              {generating && (
                <div className="flex-1 min-h-64 flex flex-col items-center justify-center bg-secondary-container/10 border border-secondary/20 rounded-lg p-8 text-center">
                  <span className="material-symbols-outlined text-5xl text-secondary animate-spin mb-3 block">autorenew</span>
                  <p className="text-label-md text-secondary font-semibold">AI hesabat hazırlayır...</p>
                  <p className="text-label-sm text-on-surface-variant mt-1">Bu 15–30 saniyə çəkə bilər</p>
                </div>
              )}
              {report && (
                <div className="bg-surface-container-lowest border border-primary-container/10 rounded-lg overflow-hidden">
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
                  <div className="px-md pt-md pb-sm border-b border-outline-variant/20 text-center">
                    <p className="text-label-sm text-on-surface-variant uppercase tracking-widest">Azərbaycan Respublikası</p>
                    <p className="text-label-md font-bold text-on-surface">Bakı şəhəri Nərimanov Rayon İcra Hakimiyyəti</p>
                    <p className="text-label-sm text-on-surface-variant">Rəsmi Müraciət Hesabatı</p>
                  </div>
                  <div className="px-md py-md max-h-[70vh] overflow-y-auto">
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

      {/* Report Modal */}
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
