"use client";

import { BookOpen, ChevronDown, ChevronRight, Download, Menu, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const modules = [
  { label: "Investissements privés",        href: "/ide",          icon: "payments",               color: "#ca631f" },
  { label: "Intentions d'investissement",   href: "/intentions",   icon: "universal_currency_alt", color: "#366FE3" },
  { label: "Prospects",                     href: "/prospects",    icon: "frame_inspect",          color: "#ca631f" },
  { label: "Entreprises installées",        href: "/entreprises",  icon: "enterprise",             color: "#366FE3" },
  { label: "Zones d'investissement",        href: "/zones",        icon: "real_estate_agent",      color: "#ca631f" },
  { label: "Opportunités d'investissement", href: "/opportunites", icon: "bookmark_stacks",        color: "#366FE3" },
  { label: "Accords & Traités",             href: "/accords",      icon: "signature",              color: "#ca631f" },
  { label: "Événements",                    href: "/evenements",   icon: "event",                  color: "#366FE3" },
];

// ── Numérotation ──────────────────────────────────────────────────────────────
function toRomanNum(n: number): string {
  const vals: [number, string][] = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let r = ""; let num = n;
  for (const [v, s] of vals) { while (num >= v) { r += s; num -= v; } }
  return r;
}
const numArt = (n: number) => String(n);

// ── Modal Code des investissements — refonte institutionnelle ─────────────────
function CodeModal({ onClose }: { onClose: () => void }) {
  const [chapitres,    setChapitres]   = useState<any[]>([]);
  const [pdfInfo,      setPdfInfo]     = useState<any>(null);
  const [activeChapId, setActiveChapId]= useState<string | null>(null);
  const [activeSecId,  setActiveSecId] = useState<string | null>(null);
  const [q,            setQ]           = useState("");
  const [results,      setResults]     = useState<any[] | null>(null);
  const [searching,    setSearching]   = useState(false);
  const [loading,      setLoading]     = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/code-investissement`).then(r => r.json()),
      fetch(`${API}/code-investissement/pdf/info`).then(r => r.json()),
    ]).then(([code, pdf]) => {
      const chapList = Array.isArray(code) ? code : [];
      setChapitres(chapList);
      setPdfInfo(pdf);
      if (chapList.length > 0) setActiveChapId(chapList[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!q.trim() || q.length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${API}/code-investissement/search?q=${encodeURIComponent(q)}`);
        setResults(await res.json());
      } catch {} finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const goChap = (id: string) => { setActiveChapId(id); setActiveSecId(null); setQ(""); if (contentRef.current) contentRef.current.scrollTop = 0; };
  const goSec  = (chapId: string, secId: string | null) => { setActiveChapId(chapId); setActiveSecId(secId); if (contentRef.current) contentRef.current.scrollTop = 0; };

  const activeChap = chapitres.find(c => c.id === activeChapId);
  const articlesActifs = activeChap
    ? [...activeChap.articles, ...activeChap.sections.flatMap((s: any) => s.articles)].sort((a: any, b: any) => a.numero - b.numero)
    : [];
  const articlesFiltres = activeSecId ? articlesActifs.filter((a: any) => a.section_id === activeSecId) : articlesActifs;
  const totalArticles = chapitres.reduce((s, c) => s + (c.articles?.length || 0) + (c.sections?.reduce((s2: number, sec: any) => s2 + (sec.articles?.length || 0), 0) || 0), 0);

  const NAV: any = { width: "100%", textAlign: "left" as const, border: "none", cursor: "pointer", fontFamily: "var(--font-google-sans)", transition: "all 0.15s" };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(6,10,20,0.82)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>

      <div style={{ background:"#F5F3F0", borderRadius:22, width:"100%", maxWidth:1200, height:"94vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 60px 160px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)" }}>

        {/* ── Bandeau accent ── */}
        <div style={{ height:3, background:"linear-gradient(90deg, #ca631f 0%, #e8884a 35%, #004f91 100%)", flexShrink:0 }} />

        {/* ── Header ── */}
        <div style={{ background:"linear-gradient(160deg, #081020 0%, #0f2040 100%)", padding:"18px 28px", display:"flex", alignItems:"center", gap:18, flexShrink:0 }}>
          {/* Identité */}
          <div style={{ width:48, height:48, borderRadius:13, background:"rgba(202,99,31,0.12)", border:"1px solid rgba(202,99,31,0.28)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <BookOpen size={21} style={{ color:"#ca631f" }} />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:9, fontWeight:800, color:"rgba(255,255,255,0.3)", letterSpacing:"0.24em", textTransform:"uppercase" as const, marginBottom:4 }}>
              République du Sénégal · APIX — Direction de l'Intelligence et des Perspectives Économiques
            </div>
            <h2 style={{ fontWeight:900, fontSize:"1.05rem", color:"#fff", margin:0, letterSpacing:"-0.01em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {pdfInfo?.titre || "Code des Investissements du Sénégal"}
            </h2>
          </div>

          {/* Badges stats */}
          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.45)", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:8, padding:"4px 11px", whiteSpace:"nowrap" as const }}>
              {chapitres.length} chapitres
            </span>
            <span style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.45)", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:8, padding:"4px 11px", whiteSpace:"nowrap" as const }}>
              {totalArticles} articles
            </span>
          </div>

          {/* Barre de recherche */}
          <div style={{ position:"relative", width:300, flexShrink:0 }}>
            <Search size={13} style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.3)", flexShrink:0 }} />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Rechercher un article, un mot clé…"
              style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.11)", borderRadius:11, padding:"9px 14px 9px 36px", fontSize:12.5, color:"#fff", outline:"none", boxSizing:"border-box" as const, fontFamily:"var(--font-google-sans)", caretColor:"#ca631f" }} />
          </div>

          {/* PDF */}
          {pdfInfo && (
            <a href={`${API}/code-investissement/pdf/download`} target="_blank" rel="noopener noreferrer"
              style={{ display:"flex", alignItems:"center", gap:7, background:"rgba(202,99,31,0.14)", border:"1px solid rgba(202,99,31,0.32)", borderRadius:10, padding:"9px 17px", fontSize:12, color:"#e8885a", fontWeight:700, textDecoration:"none", flexShrink:0, transition:"background 0.15s", whiteSpace:"nowrap" as const }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="rgba(202,99,31,0.24)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="rgba(202,99,31,0.14)"; }}>
              <Download size={13} /> Télécharger PDF
            </a>
          )}

          {/* Close */}
          <button onClick={onClose}
            style={{ width:38, height:38, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.13)"; }}
            onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.06)"; }}>
            <X size={15} color="rgba(255,255,255,0.65)" />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* ── Sidebar Table des matières ── */}
          <div style={{ width:272, background:"#fff", borderRight:"1px solid #E8E4DF", overflowY:"auto", flexShrink:0, display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"14px 18px 12px", borderBottom:"1px solid #EEE9E3", flexShrink:0 }}>
              <span style={{ fontSize:9, fontWeight:900, color:"#9aa5b4", letterSpacing:"0.24em", textTransform:"uppercase" as const }}>Table des matières</span>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"6px 0 16px" }}>
              {loading ? (
                <div style={{ padding:"24px 18px", color:"#9aa5b4", fontSize:12 }}>Chargement…</div>
              ) : chapitres.length === 0 ? (
                <div style={{ padding:"24px 18px", color:"#9aa5b4", fontSize:12 }}>Aucun contenu disponible.</div>
              ) : chapitres.map(c => {
                const isChapActive = activeChapId === c.id;
                return (
                  <div key={c.id}>
                    <button onClick={() => goChap(c.id)}
                      style={{ ...NAV, display:"flex", alignItems:"flex-start", gap:10, padding:"10px 16px 10px 14px", background: isChapActive && !activeSecId ? "rgba(202,99,31,0.06)" : "transparent", borderLeft:`3px solid ${isChapActive && !activeSecId ? "#ca631f" : "transparent"}` }}
                      onMouseEnter={e => { if (!(isChapActive && !activeSecId)) e.currentTarget.style.background="#F7F4F1"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isChapActive && !activeSecId ? "rgba(202,99,31,0.06)" : "transparent"; }}>
                      <span style={{ fontSize:9.5, fontWeight:900, color: isChapActive ? "#ca631f" : "#9aa5b4", background: isChapActive ? "rgba(202,99,31,0.1)" : "#F2F0EF", padding:"2px 8px", borderRadius:5, flexShrink:0, lineHeight:1.7, marginTop:1, letterSpacing:"0.06em", display:"inline-block" }}>
                        {c.numero === 1 ? "I" : toRomanNum(c.numero)}
                      </span>
                      <span style={{ fontSize:12.5, fontWeight: isChapActive ? 700 : 500, color: isChapActive ? "#ca631f" : "#3d4554", lineHeight:1.45, wordBreak:"break-word" as const, textAlign:"left" as const }}>
                        {c.titre}
                      </span>
                    </button>

                    {/* Sections du chapitre actif */}
                    {isChapActive && c.sections.map((s: any) => {
                      const isSecActive = activeSecId === s.id;
                      return (
                        <button key={s.id} onClick={() => goSec(c.id, isSecActive ? null : s.id)}
                          style={{ ...NAV, display:"flex", alignItems:"flex-start", gap:7, padding:"6px 14px 6px 44px", background: isSecActive ? "rgba(0,79,145,0.05)" : "transparent", borderLeft:`3px solid ${isSecActive ? "#004f91" : "transparent"}` }}
                          onMouseEnter={e => { if (!isSecActive) e.currentTarget.style.background="#F7F4F1"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = isSecActive ? "rgba(0,79,145,0.05)" : "transparent"; }}>
                          <span style={{ fontSize:11, color: isSecActive ? "#004f91" : "#BDB8B2", flexShrink:0, marginTop:2, lineHeight:1 }}>§</span>
                          <span style={{ fontSize:11.5, color: isSecActive ? "#004f91" : "#6b7280", fontWeight: isSecActive ? 600 : 400, lineHeight:1.4, textAlign:"left" as const }}>
                            {s.titre}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Zone de lecture ── */}
          <div ref={contentRef} style={{ flex:1, overflowY:"auto", background:"#F5F3F0" }}>
            {q.length >= 2 ? (
              /* Résultats de recherche */
              <div style={{ padding:"36px 56px 60px" }}>
                <p style={{ fontSize:10.5, fontWeight:800, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.18em", marginBottom:24 }}>
                  {searching ? "Recherche en cours…" : `${results?.length || 0} résultat${(results?.length||0)>1?"s":""} pour « ${q} »`}
                </p>
                {results?.map(r => (
                  <div key={r.id}
                    onClick={() => { const chap = chapitres.find(c => c.id === r.chapitre_id); if (chap) goChap(chap.id); }}
                    style={{ background:"#fff", border:"1px solid #E8E4DF", borderRadius:14, padding:"20px 24px", marginBottom:10, cursor:"pointer", transition:"border-color 0.15s, box-shadow 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor="#ca631f"; e.currentTarget.style.boxShadow="0 6px 24px rgba(202,99,31,0.1)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="#E8E4DF"; e.currentTarget.style.boxShadow="none"; }}>
                    <div style={{ fontSize:12, fontWeight:800, color:"#ca631f", marginBottom:8, letterSpacing:"0.01em" }}>
                      Article {numArt(r.numero)}{r.titre ? ` — ${r.titre}` : ""}
                    </div>
                    <div data-rte style={{ fontSize:13, color:"#4a5568", lineHeight:1.7 }}
                      dangerouslySetInnerHTML={{ __html: r.extrait || "" }} />
                  </div>
                ))}
              </div>
            ) : (
              /* Vue chapitre / articles */
              <div style={{ padding:"44px 60px 72px" }}>
                {activeChap && (
                  <>
                    {/* ── En-tête du chapitre ── */}
                    <div style={{ marginBottom:36 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                        <div style={{ height:1, width:28, background:"#ca631f", flexShrink:0 }} />
                        <span style={{ fontSize:9.5, fontWeight:900, color:"#ca631f", letterSpacing:"0.25em", textTransform:"uppercase" as const, whiteSpace:"nowrap" as const }}>
                          Chapitre {activeChap.numero === 1 ? "Premier" : toRomanNum(activeChap.numero)}
                        </span>
                        <div style={{ height:1, flex:1, background:"linear-gradient(90deg, rgba(202,99,31,0.35), transparent)" }} />
                      </div>
                      <h3 style={{ fontWeight:900, fontSize:"clamp(1.3rem,2.2vw,1.65rem)", color:"#081020", margin:"0 0 6px", lineHeight:1.2, letterSpacing:"-0.025em" }}>
                        {activeChap.titre}
                      </h3>
                      {activeChap.contenu && !activeSecId && (
                        <div data-rte style={{ fontSize:14, color:"#4a5568", lineHeight:1.85, marginTop:16, paddingLeft:18, borderLeft:"3px solid rgba(202,99,31,0.2)" }}
                          dangerouslySetInnerHTML={{ __html: activeChap.contenu }} />
                      )}

                      {/* Section active : bandeau descriptif */}
                      {activeSecId && (() => {
                        const sec = activeChap.sections.find((s: any) => s.id === activeSecId);
                        return sec ? (
                          <div style={{ marginTop:18, padding:"16px 22px", background:"rgba(0,79,145,0.04)", borderRadius:12, borderLeft:"3px solid #004f91" }}>
                            <p style={{ fontSize:9.5, fontWeight:900, color:"rgba(0,79,145,0.5)", margin:"0 0 5px", textTransform:"uppercase" as const, letterSpacing:"0.18em" }}>Section {sec.num_display}</p>
                            <p style={{ fontSize:16, fontWeight:800, color:"#081020", margin:"0 0 8px", lineHeight:1.3 }}>{sec.titre}</p>
                            {sec.contenu && (
                              <div data-rte style={{ fontSize:13.5, color:"#4a5568", lineHeight:1.8 }}
                                dangerouslySetInnerHTML={{ __html: sec.contenu }} />
                            )}
                          </div>
                        ) : null;
                      })()}

                      <div style={{ width:48, height:3, background:"linear-gradient(90deg,#ca631f,#004f91)", borderRadius:2, marginTop:20 }} />
                    </div>

                    {/* ── Articles ── */}
                    {articlesFiltres.length === 0 ? (
                      <p style={{ color:"#9aa5b4", fontSize:14 }}>Aucun article dans cette section.</p>
                    ) : articlesFiltres.map((a: any, ai: number) => {
                      const prevArt = ai > 0 ? articlesFiltres[ai - 1] : null;
                      const showSecHeader = !activeSecId && a.section_id && (!prevArt || prevArt.section_id !== a.section_id);
                      const sec = showSecHeader ? activeChap?.sections.find((s: any) => s.id === a.section_id) : null;

                      return (
                        <div key={a.id}>
                          {/* Sous-titre de section entre les articles */}
                          {sec && (
                            <div style={{ margin:"36px 0 24px", padding:"16px 22px", background:"rgba(0,79,145,0.04)", borderRadius:12, borderLeft:"3px solid rgba(0,79,145,0.35)" }}>
                              <p style={{ fontSize:9.5, fontWeight:900, color:"rgba(0,79,145,0.5)", margin:"0 0 4px", textTransform:"uppercase" as const, letterSpacing:"0.18em" }}>Section {sec.num_display}</p>
                              <p style={{ fontSize:15, fontWeight:800, color:"#004f91", margin:"0 0 6px" }}>{sec.titre}</p>
                              {sec.contenu && (
                                <div data-rte style={{ fontSize:13, color:"#4a5568", lineHeight:1.75 }}
                                  dangerouslySetInnerHTML={{ __html: sec.contenu }} />
                              )}
                            </div>
                          )}

                          {/* Article */}
                          <div style={{ display:"flex", gap:32, paddingBottom:36, borderBottom:"1px solid #E8E4DF", marginBottom:36 }}>
                            {/* Numéro en marge */}
                            <div style={{ flexShrink:0, width:64, paddingTop:3 }}>
                              <div style={{ fontSize:9, fontWeight:900, color:"rgba(202,99,31,0.45)", letterSpacing:"0.2em", textTransform:"uppercase" as const, marginBottom:2 }}>Art.</div>
                              <div style={{ fontSize:30, fontWeight:900, color:"#ca631f", lineHeight:1, letterSpacing:"-0.04em" }}>{a.num_display}</div>
                            </div>
                            {/* Contenu */}
                            <div style={{ flex:1, minWidth:0 }}>
                              {a.titre && (
                                <h4 style={{ fontWeight:800, fontSize:17, color:"#081020", margin:"0 0 14px", lineHeight:1.3, letterSpacing:"-0.015em" }}>{a.titre}</h4>
                              )}
                              {a.contenu ? (
                                <div data-rte style={{ fontSize:14.5, color:"#2d3748", lineHeight:1.9 }}
                                  dangerouslySetInnerHTML={{ __html: a.contenu }} />
                              ) : (
                                <p style={{ color:"#9aa5b4", fontSize:13 }}>Contenu non renseigné.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* ── Navigation chapitre précédent / suivant ── */}
                    {!activeSecId && (() => {
                      const idx  = chapitres.findIndex(c => c.id === activeChapId);
                      const prev = chapitres[idx - 1];
                      const next = chapitres[idx + 1];
                      if (!prev && !next) return null;
                      const chapLabel = (c: any) => `${c.numero === 1 ? "Chapitre Premier" : `Chapitre ${toRomanNum(c.numero)}`} — ${c.titre}`;
                      const btnBase: any = { display:"flex", alignItems:"center", gap:12, background:"#fff", border:"1px solid #E8E4DF", borderRadius:14, padding:"14px 22px", cursor:"pointer", transition:"all 0.15s", fontFamily:"var(--font-google-sans)", flex:1 };
                      return (
                        <div style={{ display:"flex", gap:12, marginTop:8 }}>
                          {prev ? (
                            <button onClick={() => goChap(prev.id)} style={btnBase}
                              onMouseEnter={e => { e.currentTarget.style.borderColor="#004f91"; e.currentTarget.style.boxShadow="0 4px 16px rgba(0,79,145,0.08)"; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor="#E8E4DF"; e.currentTarget.style.boxShadow="none"; }}>
                              <ChevronRight size={15} style={{ color:"#004f91", transform:"rotate(180deg)", flexShrink:0 }} />
                              <div style={{ textAlign:"left" as const, minWidth:0 }}>
                                <div style={{ fontSize:9.5, color:"#9aa5b4", fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.14em", marginBottom:3 }}>Précédent</div>
                                <div style={{ fontSize:13, fontWeight:700, color:"#004f91", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{chapLabel(prev)}</div>
                              </div>
                            </button>
                          ) : <div style={{ flex:1 }} />}
                          {next ? (
                            <button onClick={() => goChap(next.id)} style={{ ...btnBase, justifyContent:"space-between", background:"rgba(0,79,145,0.04)", borderColor:"rgba(0,79,145,0.16)" }}
                              onMouseEnter={e => { e.currentTarget.style.background="rgba(0,79,145,0.09)"; e.currentTarget.style.borderColor="rgba(0,79,145,0.28)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background="rgba(0,79,145,0.04)"; e.currentTarget.style.borderColor="rgba(0,79,145,0.16)"; }}>
                              <div style={{ textAlign:"left" as const, minWidth:0 }}>
                                <div style={{ fontSize:9.5, color:"#9aa5b4", fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.14em", marginBottom:3 }}>Suivant</div>
                                <div style={{ fontSize:13, fontWeight:700, color:"#004f91", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{chapLabel(next)}</div>
                              </div>
                              <ChevronRight size={15} style={{ color:"#004f91", flexShrink:0 }} />
                            </button>
                          ) : <div style={{ flex:1 }} />}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Navbar principale ─────────────────────────────────────────────────────────
export default function Navbar() {
  const [scrolled,    setScrolled]    = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [codeOpen,    setCodeOpen]    = useState(false);
  const [isDark,      setIsDark]      = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    setIsDark(document.querySelector("main")?.style.background?.includes("0e0e1a") || false);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const openModules  = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setModulesOpen(true); };
  const closeModules = () => { timeoutRef.current = setTimeout(() => setModulesOpen(false), 120); };

  const textColor = scrolled ? "#4a5568" : (isDark ? "rgba(255,255,255,0.85)" : "#4a5568");
  const textHover = scrolled ? "#004f91" : (isDark ? "#fff" : "#004f91");
  const bg = scrolled
    ? "rgba(255,255,255,0.96)"
    : isDark ? "rgba(14,14,26,0.7)" : "rgba(242,240,239,0.7)";
  const border = scrolled ? "1px solid #C5BFBB" : isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent";

  return (
    <>
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        height: 64,
        display: "flex", alignItems: "center",
        transition: "background 0.3s, box-shadow 0.3s, border-color 0.3s",
        background: bg,
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: border,
        boxShadow: scrolled ? "0 2px 24px rgba(0,0,0,0.06)" : "none",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 40px", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>

          {/* ── Logo ── */}
          <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }}>
            <Image src="/logo_apix.png" alt="APIX Sénégal" width={120} height={44}
              style={{ height: 38, width: "auto", objectFit: "contain" }} priority />
          </Link>

          {/* ── Nav desktop ── */}
          <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>

            {/* Modules dropdown */}
            <div style={{ position: "relative" }}
              onMouseEnter={openModules}
              onMouseLeave={closeModules}>

              <button
                style={{ display: "flex", alignItems: "center", gap: 5, height: 36, padding: "0 14px", borderRadius: 10, background: modulesOpen ? "rgba(0,79,145,0.07)" : "transparent", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, color: modulesOpen ? textHover : textColor, fontFamily: "var(--font-google-sans)", transition: "all 0.15s", letterSpacing: "-0.01em" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.07)"; e.currentTarget.style.color = textHover; }}
                onMouseLeave={e => { e.currentTarget.style.background = modulesOpen ? "rgba(0,79,145,0.07)" : "transparent"; e.currentTarget.style.color = modulesOpen ? textHover : textColor; }}>
                Modules
                <ChevronDown size={13} style={{ transition: "transform 0.2s", transform: modulesOpen ? "rotate(180deg)" : "rotate(0)", opacity: 0.7 }} />
              </button>

              {modulesOpen && (
                <div
                  onMouseEnter={openModules}
                  onMouseLeave={closeModules}
                  style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", width: 520, background: "#fff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 18, padding: "8px", boxShadow: "0 16px 56px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)" }}>

                  {/* Header */}
                  <div style={{ padding: "8px 12px 10px", borderBottom: "1px solid #F2F0EF", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>Modules de données</span>
                  </div>

                  {/* Grid 2 colonnes */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                    {modules.map(m => (
                      <Link key={m.href} href={m.href} onClick={() => setModulesOpen(false)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, textDecoration: "none", transition: "background 0.12s", background: "transparent" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#F8F7F6"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                        <span style={{ width: 30, height: 30, borderRadius: 8, background: `${m.color}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 17, color: m.color, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20", lineHeight: 1 }}>{m.icon}</span>
                        </span>
                        <span style={{ color: "#1a1a2e", fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{m.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tableau de bord */}
            <Link href="/tableau-de-bord"
              style={{ display: "flex", alignItems: "center", height: 36, padding: "0 14px", borderRadius: 10, color: textColor, textDecoration: "none", fontSize: 14, fontWeight: 500, fontFamily: "var(--font-google-sans)", transition: "all 0.15s", letterSpacing: "-0.01em" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.07)"; e.currentTarget.style.color = textHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = textColor; }}>
              Tableau de bord
            </Link>

            {/* Code des investissements */}
            <button onClick={() => setCodeOpen(true)}
              style={{ display: "flex", alignItems: "center", height: 36, padding: "0 14px", borderRadius: 10, color: textColor, background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, fontFamily: "var(--font-google-sans)", transition: "all 0.15s", letterSpacing: "-0.01em" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.07)"; e.currentTarget.style.color = textHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = textColor; }}>
              Code des investissements
            </button>
          </nav>

          {/* ── CTA Connexion ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Link href="/login"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #ca631f 0%, #a84e18 100%)", padding: "9px 20px", borderRadius: 10, textDecoration: "none", boxShadow: "0 2px 12px rgba(202,99,31,0.35)", transition: "all 0.2s", letterSpacing: "0em", fontFamily: "var(--font-google-sans)" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(202,99,31,0.45)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 12px rgba(202,99,31,0.35)"; }}>
              Connexion
            </Link>
          </div>

          {/* ── Burger mobile ── */}
          <button onClick={() => setMenuOpen(!menuOpen)}
            style={{ display: "none", background: "none", border: "none", cursor: "pointer", color: textColor, padding: 8 }}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* ── Menu mobile ── */}
        {menuOpen && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "rgba(255,255,255,0.98)", borderBottom: "1px solid #E8E5E3", boxShadow: "0 8px 32px rgba(0,0,0,0.08)", padding: "12px 16px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 12 }}>
              {modules.map(m => (
                <Link key={m.href} href={m.href} onClick={() => setMenuOpen(false)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, color: "#1a1a2e", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 7, background: `${m.color}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: m.color, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20", lineHeight: 1 }}>{m.icon}</span>
                  </span>
                  {m.label}
                </Link>
              ))}
            </div>
            <div style={{ borderTop: "1px solid #E8E5E3", paddingTop: 12, display: "flex", flexDirection: "column" as const, gap: 4 }}>
              <Link href="/tableau-de-bord" onClick={() => setMenuOpen(false)}
                style={{ display: "block", padding: "10px 14px", color: "#4a5568", textDecoration: "none", fontSize: 14, fontWeight: 500, borderRadius: 10 }}>
                Tableau de bord
              </Link>
              <button onClick={() => { setMenuOpen(false); setCodeOpen(true); }}
                style={{ display: "block", width: "100%", textAlign: "left" as const, padding: "10px 14px", color: "#4a5568", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, borderRadius: 10 }}>
                Code des investissements
              </button>
              <Link href="/login"
                style={{ display: "block", textAlign: "center" as const, fontSize: 14, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#ca631f,#a84e18)", padding: "12px", borderRadius: 12, textDecoration: "none", marginTop: 4 }}>
                Connexion
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Modal Code des investissements */}
      {codeOpen && <CodeModal onClose={() => setCodeOpen(false)} />}

      <style>{`
        mark { background: rgba(202,99,31,0.2); color: #ca631f; border-radius: 3px; padding: 0 2px; }
        [data-rte] ul{padding-left:20px;list-style-type:disc}
        [data-rte] ul.dash-list{list-style-type:"— ";padding-left:22px}
        [data-rte] ol{padding-left:20px;list-style-type:decimal}
        [data-rte] li{margin-bottom:2px}
        [data-rte] p{margin:3px 0}
      `}</style>
    </>
  );
}
