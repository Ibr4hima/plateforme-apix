"use client";

import { BookOpen, ChevronDown, ChevronRight, Download, Menu, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const modules = [
  { label: "Investissements privés",        href: "/ide"          },
  { label: "Intentions d'investissement",   href: "/intentions"   },
  { label: "Prospects",                     href: "/prospects"    },
  { label: "Entreprises installées",        href: "/entreprises"  },
  { label: "Zones d'investissement",        href: "/zones"        },
  { label: "Opportunités d'investissement", href: "/opportunites" },
  { label: "Accords & Traités",             href: "/accords"      },
  { label: "Événements",                    href: "/evenements"   },
];

// ── Numérotation ──────────────────────────────────────────────────────────────
function toRomanNum(n: number): string {
  const vals: [number, string][] = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let r = ""; let num = n;
  for (const [v, s] of vals) { while (num >= v) { r += s; num -= v; } }
  return r;
}
const numArt = (n: number) => String(n);

// ── Rendu texte article (bullets •) ──────────────────────────────────────────
function ArticleContenu({ contenu }: { contenu: string }) {
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i}>{part.slice(2,-2)}</strong>;
      if (part.startsWith("_") && part.endsWith("_"))
        return <em key={i}>{part.slice(1,-1)}</em>;
      return part;
    });
  };

  return (
    <div style={{ fontSize: 14, color: "#2d3748", lineHeight: 1.8 }}>
      {contenu.split("\n").map((line, i) => {
        if (line.trim() === "") return <br key={i} />;
        if (line.startsWith("• ") || line.startsWith("•"))
          return <div key={i} style={{ display:"flex", gap:8, marginBottom:4 }}>
            <span style={{ color:"#1a1a2e", flexShrink:0 }}>•</span>
            <span>{renderInline(line.replace(/^•\s*/,""))}</span>
          </div>;
        if (line.startsWith("→ ") || line.startsWith("→"))
          return <div key={i} style={{ display:"flex", gap:8, marginBottom:4 }}>
            <span style={{ color:"#1a1a2e", flexShrink:0 }}>→</span>
            <span>{renderInline(line.replace(/^→\s*/,""))}</span>
          </div>;
        if (line.startsWith("► ") || line.startsWith("►"))
          return <div key={i} style={{ display:"flex", gap:8, marginBottom:4 }}>
            <span style={{ color:"#1a1a2e", flexShrink:0 }}>►</span>
            <span>{renderInline(line.replace(/^►\s*/,""))}</span>
          </div>;
        if (line.startsWith("– ") || line.startsWith("–"))
          return <div key={i} style={{ display:"flex", gap:8, marginBottom:4 }}>
            <span style={{ color:"#9aa5b4", flexShrink:0 }}>–</span>
            <span>{renderInline(line.replace(/^–\s*/,""))}</span>
          </div>;
        return <p key={i} style={{ margin:"4px 0" }}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

// ── Modal Code des investissements ────────────────────────────────────────────
function CodeModal({ onClose }: { onClose: () => void }) {
  const [chapitres,     setChapitres]    = useState<any[]>([]);
  const [pdfInfo,       setPdfInfo]      = useState<any>(null);
  const [activeChapId,  setActiveChapId] = useState<string | null>(null);
  const [activeSecId,   setActiveSecId]  = useState<string | null>(null);
  const [q,             setQ]            = useState("");
  const [results,       setResults]      = useState<any[] | null>(null);
  const [searching,     setSearching]    = useState(false);
  const [loading,       setLoading]      = useState(true);

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

  const activeChap = chapitres.find(c => c.id === activeChapId);

  const articlesActifs = activeChap ? [
    ...activeChap.articles,
    ...activeChap.sections.flatMap((s: any) => s.articles),
  ].sort((a: any, b: any) => a.numero - b.numero) : [];

  const articlesFiltres = activeSecId
    ? articlesActifs.filter((a: any) => a.section_id === activeSecId)
    : articlesActifs;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#FAFAF9", borderRadius: 20, width: "100%", maxWidth: 1100, height: "90vh", display: "flex", flexDirection: "column", border: "1px solid #E8E5E3", boxShadow: "0 32px 80px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ height: 4, background: "linear-gradient(90deg,#ca631f,#004f91)", flexShrink: 0 }} />
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #E8E5E3", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, background: "#fff" }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(0,79,145,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <BookOpen size={17} style={{ color: "#004f91" }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontWeight: 800, fontSize: "1rem", color: "#1a1a2e", margin: 0 }}>{pdfInfo?.titre || "Code des investissements"}</h2>
            <p style={{ fontSize: 11, color: "#9aa5b4", margin: 0 }}>République du Sénégal</p>
          </div>
          <div style={{ position: "relative", width: 280 }}>
            <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher dans le code…"
              style={{ width: "100%", background: "#F2F0EF", border: "1px solid #E8E5E3", borderRadius: 9, padding: "8px 12px 8px 32px", fontSize: 12, outline: "none", boxSizing: "border-box" as const, fontFamily: "var(--font-google-sans)" }} />
          </div>
          {pdfInfo && (
            <a href={`${API}/code-investissement/pdf/download`} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,79,145,0.08)", border: "1px solid rgba(0,79,145,0.2)", borderRadius: 9, padding: "8px 14px", fontSize: 12, color: "#004f91", fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
              <Download size={13} /> PDF
            </a>
          )}
          <button onClick={onClose} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 9, padding: 8, flexShrink: 0 }}>
            <X size={15} color="#4a5568" />
          </button>
        </div>
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ width: 272, borderRight: "1px solid #E8E5E3", overflowY: "auto", flexShrink: 0, padding: "10px 0", background: "#FAFAF9" }}>
            {loading ? (
              <div style={{ padding: 20, color: "#9aa5b4", fontSize: 13 }}>Chargement…</div>
            ) : chapitres.length === 0 ? (
              <div style={{ padding: 20, color: "#9aa5b4", fontSize: 13 }}>Aucun contenu</div>
            ) : chapitres.map(c => (
              <div key={c.id}>
                <button onClick={() => { setActiveChapId(c.id); setActiveSecId(null); setQ(""); }}
                  style={{ width: "100%", textAlign: "left" as const, display: "flex", alignItems: "center", gap: 9, padding: "9px 14px 9px 12px", background: activeChapId === c.id && !activeSecId ? "rgba(0,79,145,0.07)" : "transparent", border: "none", cursor: "pointer", borderLeft: `3px solid ${activeChapId === c.id && !activeSecId ? "#004f91" : "transparent"}`, transition: "all 0.15s" }}
                  onMouseEnter={e => { if (!(activeChapId === c.id && !activeSecId)) e.currentTarget.style.background = "#F2F0EF"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = activeChapId === c.id && !activeSecId ? "rgba(0,79,145,0.07)" : "transparent"; }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: activeChapId === c.id && !activeSecId ? "#004f91" : "#ca631f", background: activeChapId === c.id && !activeSecId ? "rgba(0,79,145,0.1)" : "rgba(202,99,31,0.1)", padding: "2px 7px", borderRadius: 5, flexShrink: 0, lineHeight: 1.6, display: "inline-block" }}>
                    {c.numero === 1 ? "PREM." : toRomanNum(c.numero)}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: activeChapId === c.id && !activeSecId ? 700 : 500, color: activeChapId === c.id && !activeSecId ? "#004f91" : "#4a5568", lineHeight: 1.4, wordBreak: "break-word" as const }}>{c.titre}</span>
                </button>
                {c.sections.map((s: any) => (
                  <button key={s.id} onClick={() => { setActiveChapId(c.id); setActiveSecId(s.id); setQ(""); }}
                    style={{ width: "100%", textAlign: "left" as const, padding: "6px 14px 6px 34px", background: activeSecId === s.id ? "rgba(202,99,31,0.07)" : "transparent", border: "none", cursor: "pointer", borderLeft: `3px solid ${activeSecId === s.id ? "#ca631f" : "transparent"}`, transition: "all 0.15s" }}
                    onMouseEnter={e => { if (activeSecId !== s.id) e.currentTarget.style.background = "#F2F0EF"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = activeSecId === s.id ? "rgba(202,99,31,0.07)" : "transparent"; }}>
                    <span style={{ fontSize: 11, color: activeSecId === s.id ? "#ca631f" : "#9aa5b4", fontWeight: activeSecId === s.id ? 600 : 400, lineHeight: 1.4, display: "block", wordBreak: "break-word" as const }}>
                      {s.num_display} — {s.titre}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px" }}>
            {q.length >= 2 ? (
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 16 }}>
                  {searching ? "Recherche…" : `${results?.length || 0} résultat${(results?.length||0)>1?"s":""} pour « ${q} »`}
                </p>
                {results?.map(r => (
                  <div key={r.id} onClick={() => {
                    const chap = chapitres.find(c => c.id === r.chapitre_id);
                    if (chap) { setActiveChapId(chap.id); setActiveSecId(null); setQ(""); }
                  }}
                  style={{ background: "#fff", border: "1px solid #E8E5E3", borderRadius: 10, padding: "14px 18px", marginBottom: 8, cursor: "pointer", transition: "border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="#ca631f"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="#E8E5E3"}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#004f91", marginBottom: 4 }}>
                      Article {numArt(r.numero)}{r.titre ? ` — ${r.titre}` : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "#4a5568", lineHeight: 1.6 }}
                      dangerouslySetInnerHTML={{ __html: r.extrait || "" }} />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {activeChap && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#ca631f", background: "rgba(202,99,31,0.08)", border: "1px solid rgba(202,99,31,0.2)", padding: "3px 10px", borderRadius: 6, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                        Chapitre {activeChap.numero === 1 ? "Premier" : activeChap.num_display}
                      </span>
                    </div>
                    <h3 style={{ fontWeight: 800, fontSize: "1.2rem", color: "#1a1a2e", margin: 0, lineHeight: 1.3 }}>{activeChap.titre}</h3>
                    {activeChap.contenu && !activeSecId && (
                      <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.7, marginTop: 10 }}>{activeChap.contenu}</p>
                    )}
                    {activeSecId && (() => {
                      const sec = activeChap.sections.find((s:any)=>s.id===activeSecId);
                      return sec ? (
                        <>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#004f91", marginTop: 8 }}>
                            Section {sec.num_display} — {sec.titre}
                          </p>
                          {sec.contenu && (
                            <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.7, marginTop: 6, paddingLeft: 12, borderLeft: "3px solid rgba(0,79,145,0.2)" }}>{sec.contenu}</p>
                          )}
                        </>
                      ) : null;
                    })()}
                    <div style={{ width: 40, height: 3, background: "linear-gradient(90deg,#ca631f,#004f91)", borderRadius: 2, marginTop: 12 }} />
                  </div>
                )}
                {articlesFiltres.length === 0 ? (
                  <p style={{ color: "#9aa5b4", fontSize: 14 }}>Aucun article dans cette section.</p>
                ) : articlesFiltres.map((a: any) => (
                  <div key={a.id} style={{ marginBottom: 28 }}>
                    {!activeSecId && a.section_id && (() => {
                      const sec = activeChap?.sections.find((s:any)=>s.id===a.section_id);
                      const prevArt = articlesFiltres[articlesFiltres.indexOf(a)-1];
                      const isFirstOfSec = !prevArt || prevArt.section_id !== a.section_id;
                      return isFirstOfSec && sec ? (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#004f91", paddingBottom: 8, borderBottom: "1px solid #E8E5E3" }}>
                            Section {sec.num_display} — {sec.titre}
                          </div>
                          {sec.contenu && (
                            <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.7, marginTop: 8, paddingLeft: 12, borderLeft: "3px solid rgba(0,79,145,0.2)" }}>{sec.contenu}</p>
                          )}
                        </div>
                      ) : null;
                    })()}
                    <div>
                      <p style={{ fontWeight: 800, fontSize: 15, color: "#1a1a2e", marginBottom: 8 }}>
                        Article {a.num_display}
                        {a.titre && <span style={{ fontWeight: 600, color: "#4a5568" }}> — {a.titre}</span>}
                      </p>
                      {a.contenu && <ArticleContenu contenu={a.contenu} />}
                    </div>
                    <div style={{ borderBottom: "1px solid #F2F0EF", marginTop: 20 }} />
                  </div>
                ))}
                {activeChap && !activeSecId && (() => {
                  const idx = chapitres.findIndex(c=>c.id===activeChapId);
                  const next = chapitres[idx+1];
                  return next ? (
                    <button onClick={()=>{setActiveChapId(next.id);setActiveSecId(null);}}
                      style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, background:"rgba(0,79,145,0.05)", border:"1px solid rgba(0,79,145,0.15)", borderRadius:10, padding:"12px 18px", cursor:"pointer", width:"100%", transition:"all 0.15s" }}
                      onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,79,145,0.1)";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="rgba(0,79,145,0.05)";}}>
                      <div style={{flex:1,textAlign:"left" as const}}>
                        <div style={{fontSize:11,color:"#9aa5b4",marginBottom:2}}>Chapitre suivant</div>
                        <div style={{fontSize:13,fontWeight:700,color:"#004f91"}}>
                          {next.numero === 1 ? "Chapitre Premier" : `Chapitre ${next.num_display}`} — {next.titre}
                        </div>
                      </div>
                      <ChevronRight size={16} style={{color:"#004f91",flexShrink:0}} />
                    </button>
                  ) : null;
                })()}
              </>
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
                        style={{ display: "flex", alignItems: "center", padding: "11px 14px", borderRadius: 10, textDecoration: "none", transition: "background 0.12s", background: "transparent" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#F8F7F6"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
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
                  style={{ display: "flex", alignItems: "center", padding: "10px 12px", borderRadius: 10, color: "#1a1a2e", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
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

      <style>{`mark { background: rgba(202,99,31,0.2); color: #ca631f; border-radius: 3px; padding: 0 2px; }`}</style>
    </>
  );
}
