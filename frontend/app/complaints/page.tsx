"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { analyzeComplaint, createComplaint, fetchComplaints, fetchZones, generateReport } from "@/lib/api";
import type { AiAnalysis } from "@/lib/api";
import type { Complaint, ComplaintCreate, DistrictZone } from "@/lib/types";
import ComplaintCard from "@/components/ComplaintCard";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

const NarimanovMap = dynamic(() => import("@/components/NarimanovMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
      <p className="text-gray-500 text-sm">Xəritə yüklənir...</p>
    </div>
  ),
});

// ── Submission types ─────────────────────────────────────────────────────────
const SUBMISSION_TYPES = ["Şikayət", "Ərizə", "Təklif"] as const;

// ── Report markdown renderer ──────────────────────────────────────────────────
function ReportRenderer({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-sm leading-relaxed text-gray-800">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("# "))
          return <h1 key={i} className="text-lg font-bold text-gray-900 mt-3 mb-1 border-b pb-1">{line.slice(2)}</h1>;
        if (line.startsWith("## "))
          return <h2 key={i} className="text-sm font-bold text-brand mt-4 mb-0.5">{line.slice(3)}</h2>;
        if (/^\d+\.\s/.test(line))
          return <p key={i} className="ml-4 text-gray-700">{line}</p>;
        if (line.startsWith("* "))
          return <p key={i} className="flex gap-2 text-gray-700"><span className="text-brand flex-shrink-0 mt-0.5">•</span><span>{line.slice(2)}</span></p>;
        if (line.startsWith("---"))
          return <hr key={i} className="my-2 border-gray-200" />;
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i} className="text-gray-700">{line}</p>;
      })}
    </div>
  );
}

const PRIORITY_OPTIONS = [
  { value: "low" as const,      label: "Aşağı",   deadline: "30 gün",   activeBg: "bg-green-50",  activeBorder: "border-green-500",  activeText: "text-green-700",  dot: "#22c55e" },
  { value: "medium" as const,   label: "Orta",    deadline: "14 gün",   activeBg: "bg-blue-50",   activeBorder: "border-blue-500",   activeText: "text-blue-700",   dot: "#3b82f6" },
  { value: "high" as const,     label: "Yüksək",  deadline: "7 gün",    activeBg: "bg-orange-50", activeBorder: "border-orange-500", activeText: "text-orange-700", dot: "#f97316" },
  { value: "critical" as const, label: "Kritik",  deadline: "48 saat",  activeBg: "bg-red-50",    activeBorder: "border-red-500",    activeText: "text-red-700",    dot: "#ef4444" },
] as const;

const PRIORITY_COLORS: Record<string, string> = {
  low: "#22c55e", medium: "#3b82f6", high: "#f97316", critical: "#ef4444",
};
const PRIORITY_LABELS: Record<string, string> = {
  low: "Aşağı", medium: "Orta", high: "Yüksək", critical: "Kritik",
};

export default function ComplaintsPage() {
  const [zones, setZones] = useState<DistrictZone[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<ComplaintCreate>({ title: "", description: "", submission_type: "Şikayət" });
  // Citizen personal info (for official report)
  const [citizenName,   setCitizenName]   = useState("");
  const [citizenFather, setCitizenFather] = useState("");
  const [citizenPhone,  setCitizenPhone]  = useState("");
  // Report modal
  const [reportModal,     setReportModal]     = useState<{ open: boolean; report: string; complaintTitle: string }>({ open: false, report: "", complaintTitle: "" });
  const [reportLoading,   setReportLoading]   = useState<string | null>(null); // complaint id being processed
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);

  // AI analysis state
  const [aiSuggestion, setAiSuggestion] = useState<AiAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Voice recorder state
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Photo upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsLoggedIn(!!data.session));
    fetchZones().then(setZones).catch(() => {});
    fetchComplaints(undefined, 20).then(setComplaints).catch(() => {});
    setSpeechSupported(
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
  }, []);

  // Auto-analyze with 1.5 s debounce whenever title, description, or image changes
  useEffect(() => {
    if (!form.title || (form.description?.length ?? 0) < 10) {
      setAiSuggestion(null);
      return;
    }
    setAnalyzing(true);
    const timer = setTimeout(async () => {
      try {
        const result = await analyzeComplaint(
          form.title,
          form.description,
          imageDataUrl ?? undefined,
        );
        setAiSuggestion(result);
      } catch (err) {
        console.warn("[AI analyze]", err);
      } finally {
        setAnalyzing(false);
      }
    }, 1500);
    return () => {
      clearTimeout(timer);
      setAnalyzing(false);
    };
  }, [form.title, form.description, imageDataUrl]);

  // ── Voice recorder ────────────────────────────────────────────
  function toggleRecording() {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    setRecordingError(null);
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = "az-AZ";
    rec.continuous = true;
    rec.interimResults = true;

    let accumulated = form.description ? form.description.trimEnd() + " " : "";

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          accumulated += e.results[i][0].transcript + " ";
        } else {
          interim = e.results[i][0].transcript;
        }
      }
      setForm((prev) => ({ ...prev, description: (accumulated + interim).trim() }));
    };

    rec.onerror = (e: any) => {
      setIsRecording(false);
      if (e.error === "not-allowed" || e.error === "permission-denied") {
        setRecordingError("Mikrofon icazəsi verilmədi. Brauzer ayarlarından icazə verin.");
      } else if (e.error === "language-not-supported") {
        // Fallback: retry without az-AZ
        setRecordingError("az-AZ dili dəstəklənmir, mətn yazın.");
      } else if (e.error === "network") {
        setRecordingError("Şəbəkə xətası. İnternet bağlantısını yoxlayın.");
      } else if (e.error === "no-speech") {
        setRecordingError("Səs aşkarlanmadı. Yenidən cəhd edin.");
      } else {
        setRecordingError(`Səs xətası: ${e.error}`);
      }
    };
    rec.onend = () => {
      setIsRecording(false);
      setForm((prev) => ({ ...prev, description: accumulated.trim() }));
    };

    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  }

  // ── Photo upload ───────────────────────────────────────────────
  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);

    // Convert to base64 for AI analysis (no storage required)
    const reader = new FileReader();
    reader.onload = (ev) => setImageDataUrl(ev.target?.result as string ?? null);
    reader.readAsDataURL(file);

    // Best-effort upload to Supabase Storage for complaint attachment
    setUploadingImage(true);
    try {
      const path = `complaints/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const { error } = await supabase.storage.from("complaint-photos").upload(path, file);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from("complaint-photos").getPublicUrl(path);
        setForm((prev) => ({ ...prev, attachments: [publicUrl] }));
      }
    } catch {
      // Storage not configured — still proceed
    } finally {
      setUploadingImage(false);
    }
  }

  function removeImage() {
    setImagePreview(null);
    setImageDataUrl(null);
    setForm((prev) => ({ ...prev, attachments: undefined }));
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  // ── Location helpers ───────────────────────────────────────────
  // District validation lives here so a bad unproject call in NarimanovMap
  // never permanently blocks the picker.
  function handleLocationSelect(lat: number, lng: number) {
    // Rough Nərimanov bbox check (fast, no turf import needed)
    if (lng < 49.82 || lng > 49.92 || lat < 40.38 || lat > 40.45) {
      setSubmitError("Seçdiyiniz yer Nərimanov rayonu xaricindədir.");
      return;
    }
    setSubmitError(null);
    setSelectedLocation({ lat, lng });
    setForm((prev) => ({ ...prev, lat, lng }));
  }
  function clearLocation() {
    setSelectedLocation(null);
    setForm((prev) => ({ ...prev, lat: undefined, lng: undefined }));
  }

  // ── Form submit ────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!form.priority) { setSubmitError("Zəhmət olmasa kritiklik səviyyəsini seçin."); return; }
    if (!selectedLocation) { setSubmitError("Zəhmət olmasa xəritədə problemi olan yeri seçin."); return; }

    setSubmitting(true);
    try {
      const created = await createComplaint({
        ...form,
        citizen_name:   citizenName   || undefined,
        citizen_father: citizenFather || undefined,
        citizen_phone:  citizenPhone  || undefined,
      });
      setComplaints((prev) => [created, ...prev]);
      setForm({ title: "", description: "", submission_type: "Şikayət" });
      setCitizenName(""); setCitizenFather(""); setCitizenPhone("");
      setSelectedLocation(null);
      setImagePreview(null);
      setImageDataUrl(null);
      setAiSuggestion(null);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch {
      setSubmitError("Şikayət göndərilmədi. Yenidən cəhd edin.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Generate official report from a complaint ──────────────────
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
      setReportModal({ open: true, report: result.report, complaintTitle: c.title });
    } catch {
      alert("Hesabat hazırlanarkən xəta baş verdi.");
    } finally {
      setReportLoading(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Şikayətlər</h1>
      <p className="text-gray-600 mb-8 text-sm">Rayon problemlərini bildir, icrasını izlə</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── Submit form ────────────────────────────────────── */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Yeni Şikayət</h2>

          {!isLoggedIn ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
              <p className="text-yellow-800">Şikayət bildirmək üçün sistemə daxil olmalısınız.</p>
              <Link href="/auth/login" className="text-brand font-medium hover:underline mt-1 inline-block">
                Daxil Ol →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 bg-white border border-gray-200 rounded-lg p-5 shadow-sm">

              {/* Submission type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Müraciət Növü *</label>
                <div className="flex gap-2">
                  {SUBMISSION_TYPES.map((t) => (
                    <button key={t} type="button"
                      onClick={() => setForm({ ...form, submission_type: t })}
                      className={`flex-1 py-1.5 px-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        (form.submission_type ?? "Şikayət") === t
                          ? "bg-brand text-white border-brand"
                          : "bg-white text-gray-600 border-gray-200 hover:border-brand"
                      }`}
                    >{t}</button>
                  ))}
                </div>
              </div>

              {/* Citizen personal info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vətəndaş Məlumatları
                  <span className="text-gray-400 font-normal ml-1">(ixtiyari — rəsmi hesabat üçün)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Ad Soyad",   val: citizenName,   set: setCitizenName,   ph: "Əli Əliyev" },
                    { label: "Ata adı",    val: citizenFather, set: setCitizenFather, ph: "Həsən" },
                    { label: "Telefon",    val: citizenPhone,  set: setCitizenPhone,  ph: "+994 50 XXX XX XX" },
                  ].map(({ label, val, set, ph }) => (
                    <div key={label} className={label === "Telefon" ? "col-span-2" : ""}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input type="text" value={val} onChange={(e) => set(e.target.value)}
                        placeholder={ph}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand bg-gray-50"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mövzu *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Şikayətin qısa başlığı"
                />
              </div>

              {/* Description + Voice recorder */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Ətraflı açıqlama *</label>
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={toggleRecording}
                      title={isRecording ? "Səs yazmağı dayandır" : "Səslə daxil et (az-AZ)"}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        isRecording
                          ? "bg-red-100 text-red-700 border border-red-300 animate-pulse"
                          : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                      }`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v7a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-1 16.93V22h2v-2.07A8 8 0 0 0 20 12h-2a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93z"/>
                      </svg>
                      {isRecording ? "Dinlənilir..." : "Səslə"}
                    </button>
                  )}
                </div>
                <textarea
                  required
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none transition-colors ${
                    isRecording ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  placeholder="Problem haqqında ətraflı məlumat yazın, ya da mikrofon düyməsinə basın..."
                />
                {!speechSupported && (
                  <p className="text-xs text-gray-400 mt-1">Səs girişi yalnız Chrome/Edge brauzerlərdə işləyir</p>
                )}
                {recordingError && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <span>⚠</span>{recordingError}
                  </p>
                )}
              </div>

              {/* Photo upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Şəkil
                  <span className="text-gray-400 font-normal ml-1">(ixtiyari — AI analiz üçün)</span>
                </label>

                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Yüklənmiş şəkil"
                      className="h-32 w-auto rounded-lg border border-gray-200 object-cover"
                    />
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-white/70 rounded-lg flex items-center justify-center">
                        <span className="text-xs text-gray-600">Yüklənir...</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full w-5 h-5 flex items-center justify-center text-gray-500 hover:text-red-500 text-xs shadow"
                      aria-label="Şəkli sil"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-brand hover:text-brand transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Şəkil əlavə et
                  </button>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </div>

              {/* AI suggestion card */}
              {(analyzing || aiSuggestion) && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 8v4l3 3"/>
                    </svg>
                    <span className="text-xs font-semibold text-blue-700">AI Analiz</span>
                    {analyzing && (
                      <span className="ml-auto text-xs text-blue-500 animate-pulse">Analiz edilir...</span>
                    )}
                  </div>

                  {aiSuggestion && !analyzing && (
                    <>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-xs text-blue-700">Tövsiyə olunan kritiklik:</span>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: PRIORITY_COLORS[aiSuggestion.priority] }}
                        >
                          {PRIORITY_LABELS[aiSuggestion.priority]}
                        </span>
                        {aiSuggestion.category && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {aiSuggestion.category}
                          </span>
                        )}
                      </div>

                      {aiSuggestion.reasoning && (
                        <p className="text-xs text-blue-800 mb-2 leading-relaxed">{aiSuggestion.reasoning}</p>
                      )}

                      {aiSuggestion.ai_summary && (
                        <p className="text-xs text-blue-700 italic border-t border-blue-200 pt-2">
                          {aiSuggestion.ai_summary}
                        </p>
                      )}

                      {form.priority !== aiSuggestion.priority && (
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, priority: aiSuggestion.priority }))}
                          className="mt-2 text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-full font-medium"
                        >
                          AI tövsiyəsini qəbul et
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Priority selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kritiklik Səviyyəsi *
                  <span className="text-gray-400 font-normal ml-1">(həll müddəti müəyyən edir)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITY_OPTIONS.map((opt) => {
                    const selected = form.priority === opt.value;
                    const isAiSuggested = aiSuggestion?.priority === opt.value && !selected;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm({ ...form, priority: opt.value })}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          selected
                            ? `${opt.activeBg} ${opt.activeBorder}`
                            : isAiSuggested
                              ? "bg-blue-50 border-blue-300"
                              : "bg-white border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: opt.dot }} />
                          <span className={`font-medium text-sm ${selected ? opt.activeText : "text-gray-700"}`}>
                            {opt.label}
                          </span>
                          {isAiSuggested && (
                            <span className="ml-auto text-[10px] text-blue-600 font-semibold">AI</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 pl-4">Son müddət: {opt.deadline}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Zone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
                <select
                  value={form.zone_id ?? ""}
                  onChange={(e) => setForm({ ...form, zone_id: e.target.value || undefined })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="">Zona seçin (ixtiyari)</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name_az}</option>
                  ))}
                </select>
              </div>

              {/* Location indicator */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lokasiya *</label>
                {selectedLocation ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-green-800 font-medium">Seçildi</span>
                    <span className="text-green-600 text-xs">
                      {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
                    </span>
                    <button type="button" onClick={clearLocation} className="ml-auto text-green-500 hover:text-green-700 text-base leading-none">×</button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    Sağdakı xəritədə nöqtəyə klikləyin
                  </p>
                )}
              </div>

              {submitSuccess && (
                <p className="text-green-700 text-sm bg-green-50 border border-green-200 rounded px-3 py-2">
                  Şikayətiniz qəbul edildi. AI təsnifatı aparılır...
                </p>
              )}
              {submitError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand text-white rounded-lg py-2 font-medium hover:bg-brand-dark disabled:opacity-50"
              >
                {submitting ? "Göndərilir..." : "Şikayət Göndər"}
              </button>
            </form>
          )}
        </div>

        {/* ── Right column: map + complaints list ────────────── */}
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Lokasiya Seçin</h2>
            <p className="text-xs text-gray-500 mb-3">
              Xəritədə problemi olan yerə klikləyin — yalnız Nərimanov rayonu daxili seçilə bilər
            </p>
            <div className="relative w-full h-72 rounded-xl overflow-hidden shadow border border-gray-200">
              {isLoggedIn ? (
                <NarimanovMap onLocationSelect={handleLocationSelect} selectedLocation={selectedLocation} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <p className="text-gray-400 text-sm">Daxil olduqdan sonra lokasiya seçə bilərsiniz</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Son Şikayətlər</h2>
            {complaints.length === 0 ? (
              <p className="text-gray-500 text-sm">Hələ ki şikayət yoxdur</p>
            ) : (
              <div className="space-y-3">
                {complaints.map((c) => (
                  <div key={c.id} className="group relative">
                    <ComplaintCard complaint={c} />
                    {/* Report button overlay */}
                    <button
                      onClick={() => handleGenerateReport(c)}
                      disabled={reportLoading === c.id.toString()}
                      className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-brand hover:text-brand shadow-sm opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                    >
                      {reportLoading === c.id.toString() ? (
                        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      )}
                      Rəsmi Hesabat
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Report Modal ────────────────────────────────────────── */}
      {reportModal.open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-8">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">Rəsmi Müraciət Hesabatı</h2>
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-sm">{reportModal.complaintTitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(reportModal.report).catch(() => {})}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Kopyala
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-brand rounded-lg hover:bg-brand-dark"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                  Çap Et
                </button>
                <button
                  onClick={() => setReportModal({ open: false, report: "", complaintTitle: "" })}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Official letterhead */}
            <div className="px-6 pt-4 pb-2 border-b border-gray-100 text-center">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Azərbaycan Respublikası</p>
              <p className="text-sm font-bold text-gray-800">Bakı şəhəri Nərimanov Rayon İcra Hakimiyyəti</p>
              <p className="text-xs text-gray-400">Rəsmi Müraciət Hesabatı</p>
            </div>

            {/* Report body */}
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              <ReportRenderer text={reportModal.report} />
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <p className="text-xs text-gray-400 text-center">
                Bu sənəd AI Hesabat Sistemi tərəfindən avtomatik yaradılmışdır.
                Rəsmi qüvvəyə minməsi üçün səlahiyyətli şəxsin imzası tələb olunur.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
