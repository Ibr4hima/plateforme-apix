"use client";

import Navbar from "@/components/layout/Navbar";
import { Building2, ChevronDown, ChevronUp, Globe, Loader2, Mail, Phone, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, j] = d.split("-").map(Number);
  return new Date(y, m - 1, j).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function badgeProspect(p: any) {
  if (p?.issue === "installe") return { label: "Installation à venir", color: "#0D652D", bg: "rgba(13,101,45,0.10)" };
  if (p?.issue === "decline")  return { label: "Décliné",  color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
  if (!p?.date_dernier_echange) return null;
  const jours = Math.floor((Date.now() - new Date(p.date_dernier_echange).getTime()) / 86400000);
  if (jours <= 30) return { label: "En cours",   color: "#059669", bg: "rgba(5,150,105,0.10)" };
  if (jours <= 60) return { label: "En attente", color: "#ca631f", bg: "rgba(202,99,31,0.10)" };
  return                  { label: "Inactif",    color: "#dc2626", bg: "rgba(220,38,38,0.10)" };
}

// ── Filtre latéral générique ──────────────────────────────────────────────────

function SideFilter({ label, items, selected, onToggle, color }: {
  label: string; items: string[]; selected: string[]; onToggle: (v: string) => void; color: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 18 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: open ? 8 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {selected.length > 0 && <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />}
          <span style={{ fontSize: 11, fontWeight: 700, color: selected.length > 0 ? color : "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>{label}</span>
          {selected.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color, background: color + "18", padding: "1px 6px", borderRadius: 999 }}>{selected.length}</span>}
        </div>
        {open ? <ChevronUp size={12} style={{ color: "#9aa5b4" }} /> : <ChevronDown size={12} style={{ color: "#9aa5b4" }} />}
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 2, maxHeight: 180, overflowY: "auto" as const }}>
          {items.map(item => {
            const sel = selected.includes(item);
            return (
              <button key={item} onClick={() => onToggle(item)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: sel ? color + "12" : "transparent", textAlign: "left" as const }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "#F8F7F6"; }}
                onMouseLeave={e => { e.currentTarget.style.background = sel ? color + "12" : "transparent"; }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${sel ? color : "#C5BFBB"}`, background: sel ? color : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {sel && <svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <span style={{ fontSize: 12, color: sel ? "#1a1a2e" : "#4a5568", fontWeight: sel ? 600 : 400 }}>{item}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Carte prospect ────────────────────────────────────────────────────────────

function CarteProspect({ p }: { p: any }) {
  const badge = badgeProspect(p);
  const siege = p.siege_nom || "";
  const secteurs = (p.secteur_noms || []).join(", ");
  const tel = p.telephones?.[0] || p.points_focaux?.[0]?.telephones?.[0] || "";
  const mail = p.mails?.[0] || p.points_focaux?.[0]?.mails?.[0] || "";

  return (
    <div style={{ background: "#fff", border: "1px solid #E8E5E3", borderLeft: "3px solid #004f91", borderRadius: 12, padding: "14px 16px", cursor: "default", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "all 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,79,145,0.12)"; e.currentTarget.style.borderColor = "#004f91"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "#E8E5E3"; e.currentTarget.style.borderLeftColor = "#004f91"; }}>
      {/* Nom + badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{p.nom}</div>
        {badge && <span style={{ fontSize: 10, fontWeight: 700, color: badge.color, background: badge.bg, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 }}>{badge.label}</span>}
      </div>

      {/* Pays siège */}
      {siege && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#9aa5b4", marginBottom: 8 }}>
          <Globe size={11} />
          <span>{siege}</span>
        </div>
      )}

      {/* Secteurs */}
      {secteurs && (
        <div style={{ fontSize: 11, color: "#4a5568", background: "#F8F7F6", borderRadius: 6, padding: "3px 8px", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {secteurs}
        </div>
      )}

      {/* Contacts */}
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 3, marginBottom: 10 }}>
        {tel && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}><Phone size={10} />{tel}</div>}
        {mail && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}><Mail size={10} />{mail}</div>}
        {p.date_dernier_echange && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#9aa5b4" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#9aa5b4", flexShrink: 0, display: "inline-block" }} />
            Dernier contact : {fmtDate(p.date_dernier_echange)}
          </div>
        )}
      </div>

      {/* Nb échanges */}
      {p.echanges?.length > 0 && (
        <div style={{ borderTop: "1px solid #F2F0EF", paddingTop: 8, fontSize: 11, color: "#9aa5b4" }}>
          {p.echanges.length} échange{p.echanges.length > 1 ? "s" : ""} enregistré{p.echanges.length > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function ProspectsPage() {
  const [onglet, setOnglet] = useState<"cibles" | "historique">("cibles");

  // Données
  const [cibles,     setCibles]     = useState<any[]>([]);
  const [historique, setHistorique] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Filtres
  const [recherche,   setRecherche]   = useState("");
  const [paysOpts,    setPaysOpts]    = useState<string[]>([]);
  const [paysSel,     setPaysSel]     = useState<string[]>([]);
  const [secteurOpts, setSecteurOpts] = useState<string[]>([]);
  const [secteursSel, setSecteursSel] = useState<string[]>([]);

  // Sidebar
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => {
    isResizing.current = true;
    const startX = e.clientX, startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => { if (!isResizing.current) return; setSidebarWidth(Math.max(200, Math.min(480, startW + ev.clientX - startX))); };
    const onUp = () => { isResizing.current = false; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [rCibles, rHisto] = await Promise.all([
        fetch(`${API_BASE}/prospects?conclu=false&per_page=100`).then(r => r.json()),
        fetch(`${API_BASE}/prospects?conclu=true&per_page=100`).then(r => r.json()),
      ]);
      const c = rCibles.data || [];
      const h = rHisto.data  || [];
      setCibles(c);
      setHistorique(h);

      // Construire les options de filtre à partir des données
      const pays = [...new Set([...c, ...h].map((p: any) => p.siege_nom).filter(Boolean))] as string[];
      const secs = [...new Set([...c, ...h].flatMap((p: any) => p.secteur_noms || []).filter(Boolean))] as string[];
      setPaysOpts(pays.sort());
      setSecteurOpts(secs.sort());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Filtrage
  const filtrer = (liste: any[]) => liste.filter(p => {
    if (recherche) {
      const q = recherche.toLowerCase();
      if (!p.nom?.toLowerCase().includes(q)) return false;
    }
    if (paysSel.length > 0 && !paysSel.includes(p.siege_nom || "")) return false;
    if (secteursSel.length > 0 && !secteursSel.some((s: string) => (p.secteur_noms || []).includes(s))) return false;
    return true;
  });

  const togglePays    = (v: string) => setPaysSel(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleSecteur = (v: string) => setSecteursSel(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const hasFilter = !!recherche || paysSel.length > 0 || secteursSel.length > 0;
  const reinit = () => { setRecherche(""); setPaysSel([]); setSecteursSel([]); };
  const nbFiltres = (recherche ? 1 : 0) + paysSel.length + secteursSel.length;

  const listeCourante = filtrer(onglet === "cibles" ? cibles : historique);
  const total = cibles.length + historique.length;

  return (
    <main style={{ minHeight: "100vh", background: "#F2F0EF", fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Navbar />

      {/* ── Hero ── */}
      <section style={{ padding: "100px 40px 40px", background: "linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", position: "relative" as const, overflow: "hidden" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" as const, zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(202,99,31,0.1)", border: "1px solid rgba(202,99,31,0.25)", borderRadius: 999, padding: "6px 14px", marginBottom: 17 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#D96D3B", letterSpacing: "0.15em", textTransform: "uppercase" }}>Plateforme de Promotion des Investissements et des Investisseurs</span>
          </div>
          <h1 style={{ fontWeight: 800, fontSize: "clamp(2.2rem,4vw,3.2rem)", color: "#fff", lineHeight: 1.1, marginBottom: 16 }}>Prospects</h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, maxWidth: 540, lineHeight: 1.7, marginBottom: 24 }}>Portefeuille d'entreprises internationales ciblées dans le cadre des missions de prospection.</p>
          {total > 0 && <span style={{ display: "inline-flex", alignItems: "center", fontSize: 13, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", padding: "6px 14px", borderRadius: 999 }}>
            {total} prospect{total > 1 ? "s" : ""}
          </span>}
        </div>
      </section>

      {/* ── Onglets sticky ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E8E5E3", position: "sticky" as const, top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 40px", display: "flex", gap: 0 }}>
          {([
            { key: "cibles",     label: "Investisseurs ciblés",    color: "#004f91" },
            { key: "historique", label: "Historique des contacts",  color: "#004f91" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setOnglet(t.key)}
              style={{ padding: "16px 22px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-google-sans)", fontSize: 13, fontWeight: 600, color: onglet === t.key ? t.color : "#9aa5b4", borderBottom: `2px solid ${onglet === t.key ? t.color : "transparent"}`, transition: "all 0.15s" }}>
              {t.label}
              {t.key === "cibles" && cibles.length > 0 && (
                <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, color: onglet === t.key ? t.color : "#9aa5b4", background: onglet === t.key ? "rgba(0,79,145,0.1)" : "#F2F0EF", padding: "1px 7px", borderRadius: 999 }}>{cibles.length}</span>
              )}
              {t.key === "historique" && historique.length > 0 && (
                <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, color: onglet === t.key ? t.color : "#9aa5b4", background: onglet === t.key ? "rgba(0,79,145,0.1)" : "#F2F0EF", padding: "1px 7px", borderRadius: 999 }}>{historique.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Corps : sidebar + grille ── */}
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {/* Sidebar */}
        <aside style={{ width: sidebarOpen ? sidebarWidth : 52, flexShrink: 0, transition: isResizing.current ? "none" : "width 0.25s", background: "#fff", borderRight: "1px solid #E8E5E3", height: "calc(100vh - 72px)", overflowY: "auto" as const, position: "sticky" as const, top: 72, display: "flex", flexDirection: "column" as const }}>
          {sidebarOpen && <div onMouseDown={startResize} style={{ position: "absolute" as const, right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 10, background: "transparent", transition: "background 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.3)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }} />}
          <div style={{ padding: sidebarOpen ? "14px 16px 10px" : "12px 8px", borderBottom: "1px solid #F2F0EF", display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "space-between" : "center", flexShrink: 0 }}>
            {sidebarOpen && <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Filtres</span>}
            <button onClick={() => setSidebarOpen(o => !o)} style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px", display: "flex", alignItems: "center", gap: 5 }}>
              <SlidersHorizontal size={14} style={{ color: "#004f91" }} />
              {sidebarOpen && nbFiltres > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.15)", borderRadius: 999, padding: "1px 5px" }}>{nbFiltres}</span>}
            </button>
          </div>
          {sidebarOpen && (
            <div style={{ padding: "16px", overflowY: "auto" as const, flex: 1 }}>
              {hasFilter && <button onClick={reinit} style={{ display: "flex", alignItems: "center", gap: 5, width: "100%", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>
                <X size={12} /> Effacer tous les filtres
              </button>}
              {/* Recherche */}
              <div style={{ position: "relative" as const, marginBottom: 18 }}>
                <Search size={13} style={{ position: "absolute" as const, left: 9, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
                <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher…"
                  style={{ width: "100%", paddingLeft: 30, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 12, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const }} />
                {recherche && <button onClick={() => setRecherche("")} style={{ position: "absolute" as const, right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "#9aa5b4" }} /></button>}
              </div>
              <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
              {paysOpts.length > 0 && <SideFilter label="Pays / Siège" color="#004f91" items={paysOpts} selected={paysSel} onToggle={togglePays} />}
              {secteurOpts.length > 0 && <><div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} /><SideFilter label="Secteur" color="#E35336" items={secteurOpts} selected={secteursSel} onToggle={toggleSecteur} /></>}
            </div>
          )}
        </aside>

        {/* Grille */}
        <div style={{ flex: 1, minWidth: 0, padding: "36px 40px 80px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, gap: 12, color: "#9aa5b4" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /><span style={{ fontSize: 14 }}>Chargement…</span>
            </div>
          ) : listeCourante.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
              <Building2 size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Aucun prospect trouvé</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>Modifiez vos filtres pour affiner la recherche.</p>
              {hasFilter && <button onClick={reinit} style={{ marginTop: 16, padding: "8px 18px", borderRadius: 10, border: "none", background: "#004f91", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Effacer les filtres</button>}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {listeCourante.map(p => <CarteProspect key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
