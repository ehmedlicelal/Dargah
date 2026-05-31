"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { fetchComplaints, voteComplaint } from "@/lib/api";
import type { Complaint } from "@/lib/types";

const PRIORITY_COLORS: Record<string, string> = {
  low: "#22c55e", medium: "#3b82f6", high: "#f97316", critical: "#ef4444",
};
const PRIORITY_LABELS: Record<string, string> = {
  low: "Aşağı", medium: "Orta", high: "Yüksək", critical: "Kritik",
};
const STATUS_LABELS: Record<string, string> = {
  open: "Açıq", in_progress: "İcrada", resolved: "Həll edilib", closed: "Bağlı",
};
const CATEGORY_LABELS: Record<string, string> = {
  road: "Yol", utilities: "Kommunal", environment: "Ekologiya",
  safety: "Təhlükəsizlik", social: "Sosial", other: "Digər",
};

// Same map style as admin panel
const MAP_STYLE = process.env.NEXT_PUBLIC_MAPBOX_STYLE ?? "mapbox://styles/mapbox/dark-v11";

// Same glass panel style as admin panel
const G: React.CSSProperties = {
  background: "rgba(6, 11, 32, 0.84)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "16px",
  boxShadow: "0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
  color: "#e2e8f0",
  fontFamily: "system-ui,-apple-system,sans-serif",
};

const VOTE_STORAGE_KEY = "cityfix_votes";

function getVotedMap(): Record<string, 1 | -1> {
  try { return JSON.parse(localStorage.getItem(VOTE_STORAGE_KEY) ?? "{}"); }
  catch { return {}; }
}
function saveVote(id: string, delta: 1 | -1) {
  const m = getVotedMap(); m[id] = delta;
  localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(m));
}
function clearVote(id: string) {
  const m = getVotedMap(); delete m[id];
  localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(m));
}

const NarimanovMap = dynamic(() => import("@/components/NarimanovMap"), {
  ssr: false,
  loading: () => (
    <div style={{ width: "100%", height: "100%", background: "#06090f",
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "rgba(226,232,240,0.5)", fontFamily: "system-ui,sans-serif" }}>
        <div style={{ width: 40, height: 40, border: "3px solid rgba(0,212,255,0.3)",
          borderTop: "3px solid #00d4ff", borderRadius: "50%",
          animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        Xəritə yüklənir...
      </div>
    </div>
  ),
});

function CitizenMapContent() {
  const [complaints, setComplaints]       = useState<Complaint[]>([]);
  const [loading, setLoading]             = useState(true);
  const [selected, setSelected]           = useState<Complaint | null>(null);
  const [votedMap, setVotedMap]           = useState<Record<string, 1 | -1>>({});
  const [votingId, setVotingId]           = useState<string | null>(null);
  const [navCollapsed, setNavCollapsed]   = useState(false);

  useEffect(() => {
    setVotedMap(getVotedMap());
    fetchComplaints(undefined, 200)
      .then(setComplaints).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Restore navbar when unmounting
  useEffect(() => () => {
    const nav = document.querySelector("nav") as HTMLElement | null;
    if (nav) nav.style.display = "";
  }, []);

  const handleNavToggle = useCallback(() => {
    const nav = document.querySelector("nav") as HTMLElement | null;
    setNavCollapsed(prev => {
      const next = !prev;
      setTimeout(() => { if (nav) nav.style.display = next ? "none" : ""; }, 0);
      return next;
    });
  }, []);

  const handleComplaintClick = useCallback((id: string) => {
    setSelected(complaints.find(c => c.id === id) ?? null);
  }, [complaints]);

  async function handleVote(delta: 1 | -1) {
    if (!selected || votingId) return;
    const id = selected.id;
    const already = votedMap[id];
    setVotingId(id);
    try {
      if (already === delta) {
        const updated = await voteComplaint(id, delta === 1 ? -1 : 1);
        setComplaints(p => p.map(c => c.id === id ? updated : c));
        setSelected(updated);
        clearVote(id);
        setVotedMap(p => { const n = { ...p }; delete n[id]; return n; });
      } else if (already) {
        await voteComplaint(id, already === 1 ? -1 : 1);
        const updated = await voteComplaint(id, delta);
        setComplaints(p => p.map(c => c.id === id ? updated : c));
        setSelected(updated);
        saveVote(id, delta);
        setVotedMap(p => ({ ...p, [id]: delta }));
      } else {
        const updated = await voteComplaint(id, delta);
        setComplaints(p => p.map(c => c.id === id ? updated : c));
        setSelected(updated);
        saveVote(id, delta);
        setVotedMap(p => ({ ...p, [id]: delta }));
      }
    } catch { /* silent */ }
    finally { setVotingId(null); }
  }

  const openCount    = complaints.filter(c => c.status === "open").length;
  const critCount    = complaints.filter(c => c.priority === "critical" && c.status === "open").length;
  const myVote       = selected ? votedMap[selected.id] : undefined;
  const priColor     = selected ? (PRIORITY_COLORS[selected.priority] ?? "#6b7280") : "#6b7280";
  const votes        = selected?.votes ?? 0;

  return (
    <div style={{
      position: "fixed",
      top: navCollapsed ? 0 : 64,
      left: 0, right: 0, bottom: 0,
      overflow: "hidden",
      background: "#06090f",
    }}>
      {/* Full-screen map */}
      <div style={{ position: "absolute", inset: 0 }}>
        <NarimanovMap
          complaints={complaints}
          mapStyle={MAP_STYLE}
          hideBuiltinUI={false}
          onComplaintClick={handleComplaintClick}
        />
      </div>

      {/* Navbar collapse tab */}
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", zIndex: 30 }}>
        <button onClick={handleNavToggle}
          title={navCollapsed ? "Menunu göstər" : "Menunu gizlət"}
          style={{ ...G, borderTop: "none", borderRadius: "0 0 10px 10px",
            padding: "4px 20px 6px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            color: "rgba(226,232,240,0.45)", fontSize: 11 }}>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {navCollapsed ? <polyline points="1 1 6 7 11 1" /> : <polyline points="1 7 6 1 11 7" />}
          </svg>
        </button>
      </div>

      {/* Top-left: stats panel */}
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 20 }}>
        <div style={{ ...G, padding: "14px 16px", minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00d4ff",
              boxShadow: "0 0 8px #00d4ff" }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
              color: "rgba(226,232,240,0.5)", textTransform: "uppercase" }}>
              Nərimanov rayonu
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              { label: "Açıq", count: openCount, color: "#60a5fa" },
              { label: "Kritik", count: critCount, color: "#ef4444" },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10,
                padding: "8px", textAlign: "center", border: `1px solid ${color}22` }}>
                <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1,
                  textShadow: `0 0 10px ${color}55` }}>{loading ? "–" : count}</div>
                <div style={{ fontSize: 10, color: "rgba(226,232,240,0.45)", marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "rgba(226,232,240,0.4)", lineHeight: 1.4 }}>
            Şikayətə klikləyin → səs verin
          </div>
        </div>
      </div>

      {/* Top-right: action button */}
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 20 }}>
        <Link href="/complaints" style={{
          ...G, padding: "10px 16px", borderRadius: 12, textDecoration: "none",
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 13, fontWeight: 600, color: "#00d4ff",
          border: "1px solid rgba(0,212,255,0.3)",
          boxShadow: "0 0 20px rgba(0,212,255,0.12)",
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
          </svg>
          Şikayət Bildir
        </Link>
      </div>

      {/* Right: complaint detail panel */}
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: selected ? 310 : 0,
        overflow: "hidden",
        transition: "width 0.3s ease",
        zIndex: 25,
      }}>
        {selected && (
          <div style={{
            width: 310, height: "100%",
            background: "rgba(6,11,32,0.92)", backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderLeft: "1px solid rgba(255,255,255,0.07)",
            display: "flex", flexDirection: "column",
            overflowY: "auto",
            fontFamily: "system-ui,-apple-system,sans-serif",
          }}>
            {/* Header */}
            <div style={{ padding: "16px 16px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{
                    background: `${priColor}22`, color: priColor,
                    border: `1px solid ${priColor}44`,
                    padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                  }}>
                    {PRIORITY_LABELS[selected.priority] ?? selected.priority}
                  </span>
                  <span style={{
                    background: "rgba(255,255,255,0.06)", color: "rgba(226,232,240,0.6)",
                    padding: "2px 8px", borderRadius: 12, fontSize: 11,
                  }}>
                    {STATUS_LABELS[selected.status] ?? selected.status}
                  </span>
                  {selected.category && (
                    <span style={{
                      background: "rgba(0,212,255,0.1)", color: "#00d4ff",
                      border: "1px solid rgba(0,212,255,0.2)",
                      padding: "2px 8px", borderRadius: 12, fontSize: 11,
                    }}>
                      {CATEGORY_LABELS[selected.category] ?? selected.category}
                    </span>
                  )}
                </div>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e2e8f0",
                  lineHeight: 1.4 }}>
                  {selected.title}
                </h2>
              </div>
              <button onClick={() => setSelected(null)}
                style={{ background: "none", border: "none", cursor: "pointer",
                  color: "rgba(226,232,240,0.35)", fontSize: 20, lineHeight: 1,
                  padding: 4, flexShrink: 0 }}>×</button>
            </div>

            {/* Description */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(226,232,240,0.6)", lineHeight: 1.55 }}>
                {selected.description}
              </p>
              {selected.ai_summary && (
                <div style={{
                  marginTop: 10, background: "rgba(0,212,255,0.07)",
                  border: "1px solid rgba(0,212,255,0.2)", borderRadius: 8, padding: "8px 10px",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#00d4ff",
                    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                    AI Xülasə
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "rgba(0,212,255,0.8)", lineHeight: 1.4 }}>
                    {selected.ai_summary}
                  </p>
                </div>
              )}
            </div>

            {/* Vote section */}
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                color: "rgba(226,232,240,0.4)", textTransform: "uppercase", marginBottom: 14 }}>
                İcma Səsvermə
              </div>

              {/* Vote count */}
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{
                  fontSize: 44, fontWeight: 800, lineHeight: 1,
                  color: votes > 0 ? "#22c55e" : votes < 0 ? "#ef4444" : "rgba(226,232,240,0.25)",
                  textShadow: votes > 0 ? "0 0 20px #22c55e55"
                    : votes < 0 ? "0 0 20px #ef444455" : "none",
                }}>
                  {votes > 0 ? "+" : ""}{votes}
                </div>
                <div style={{ fontSize: 11, color: "rgba(226,232,240,0.35)", marginTop: 4 }}>
                  icma səsi
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                {([
                  { delta: 1 as const,  label: "Bəyən",     voted: "Bəyəndim",    bg: "#22c55e", dim: "rgba(34,197,94,0.12)"  },
                  { delta: -1 as const, label: "Bəyənmə",   voted: "Bəyənmədim",  bg: "#ef4444", dim: "rgba(239,68,68,0.12)"   },
                ] as const).map(({ delta, label, voted, bg, dim }) => {
                  const active = myVote === delta;
                  return (
                    <button key={delta} onClick={() => handleVote(delta)}
                      disabled={!!votingId}
                      style={{
                        flex: 1, padding: "10px 0", borderRadius: 10,
                        border: `1px solid ${active ? bg : "rgba(255,255,255,0.08)"}`,
                        cursor: votingId ? "not-allowed" : "pointer",
                        background: active ? `${bg}33` : dim,
                        color: active ? bg : "rgba(226,232,240,0.55)",
                        fontWeight: 700, fontSize: 13,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        transition: "all 0.15s",
                        opacity: votingId ? 0.5 : 1,
                        boxShadow: active ? `0 0 14px ${bg}33` : "none",
                      }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                        {delta === 1
                          ? <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z"/>
                          : <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v1.91l.01.01L1 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
                        }
                      </svg>
                      {active ? voted : label}
                    </button>
                  );
                })}
              </div>

              {myVote && (
                <p style={{ margin: "8px 0 0", fontSize: 11,
                  color: "rgba(226,232,240,0.3)", textAlign: "center" }}>
                  Eyni düyməyə basaraq səsinizi geri ala bilərsiniz
                </p>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "0 16px 16px", marginTop: "auto",
              borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 12 }}>
              <div style={{ fontSize: 11, color: "rgba(226,232,240,0.3)", marginBottom: 8 }}>
                {new Date(selected.created_at).toLocaleDateString("az-AZ", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              </div>
              <Link href={`/complaints/${selected.id}`}
                style={{ display: "flex", alignItems: "center", gap: 6,
                  fontSize: 12, color: "#00d4ff", fontWeight: 600, textDecoration: "none" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Ətraflı bax
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Legend — bottom-left */}
      <div style={{ position: "absolute", bottom: 16, left: 16, zIndex: 20 }}>
        <div style={{ ...G, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            color: "rgba(226,232,240,0.4)", textTransform: "uppercase", marginBottom: 8 }}>
            Prioritet
          </div>
          {[
            { label: "Kritik", color: "#ef4444" },
            { label: "Yüksək", color: "#f97316" },
            { label: "Orta",   color: "#3b82f6" },
            { label: "Aşağı",  color: "#22c55e" },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8,
              marginBottom: 5, fontSize: 12, color: "rgba(226,232,240,0.65)" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                background: color, boxShadow: `0 0 6px ${color}88` }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        body { overflow: hidden !important; }
        footer { display: none !important; }
        main { overflow: hidden !important; padding: 0 !important; margin: 0 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function CitizenMapPage() {
  return <CitizenMapContent />;
}
