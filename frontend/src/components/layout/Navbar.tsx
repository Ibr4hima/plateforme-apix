"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronDown, Search, BookOpen, Download, ChevronRight } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const modules = [
  { label: "IDE",          href: "/ide",          desc: "Investissements Directs Étrangers" },
  { label: "Intentions",   href: "/intentions",   desc: "Intentions d'investissement" },
  { label: "Prospects",    href: "/prospects",    desc: "Prospects internationaux" },
  { label: "Entreprises",  href: "/entreprises",  desc: "Entreprises installées" },
  { label: "Zones",        href: "/zones",        desc: "Zones d'investissement" },
  { label: "Opportunités", href: "/opportunites", desc: "Opportunités sectorielles" },
  { label: "Accords",      href: "/accords",      desc: "Accords et traités" },
  { label: "Événements",   href: "/evenements",   desc: "Événements de promotion" },
];

// ── Numérotation ──────────────────────────────────────────────────────────────
const ROMANS = ["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX"];
const numArt = (n: number) => n === 1 ? "premier" : String(n);

// ── Rendu texte article (bullets •) ──────────────────────────────────────────
function ArticleContenu({ contenu }: { contenu: string }) {
  return (
    <div style={{ fontSize: 14, color: "#2d3748", lineHeight: 1.8 }}>
      {contenu.split("\n").map((line, i) =>
        line.trim() === "" ? <br key={i} /> :
        line.startsWith("•") ? (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <span style={{ color: "#ca631f", flexShrink: 0, fontWeight: 700 }}>•</span>
            <span>{line.slice(1).trim()}</span>
          </div>
        ) : (
          <p key={i} style={{ margin: "4px 0" }}>{line}</p>
        )
      )}
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

  // Recherche avec debounce
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

  // Tous les articles du chapitre actif, dans l'ordre
  const articlesActifs = activeChap ? [
    ...activeChap.articles,
    ...activeChap.sections.flatMap((s: any) => s.articles),
  ].sort((a: any, b: any) => a.numero - b.numero) : [];

  // Articles filtrés par section active
  const articlesFiltres = activeSecId
    ? articlesActifs.filter((a: any) => a.section_id === activeSecId)
    : articlesActifs;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#FAFAF9", borderRadius: 24, width: "100%", maxWidth: 1100, height: "90vh", display: "flex", flexDirection: "column", border: "1px solid #C5BFBB", boxShadow: "0 32px 80px rgba(0,0,0,0.22)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ height: 4, background: "linear-gradient(90deg,#ca631f,#e07a3a)", flexShrink: 0 }} />
        <div style={{ padding: "18px 28px", borderBottom: "1px solid #E8E5E3", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(202,99,31,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <BookOpen size={18} style={{ color: "#ca631f" }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "#1a1a2e", margin: 0 }}>Code des investissements</h2>
            <p style={{ fontSize: 12, color: "#9aa5b4", margin: 0 }}>République du Sénégal</p>
          </div>
          {/* Barre de recherche */}
          <div style={{ position: "relative", width: 280 }}>
            <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher dans le code…"
              style={{ width: "100%", background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 10, padding: "8px 12px 8px 32px", fontSize: 12, outline: "none", boxSizing: "border-box" as const, fontFamily: "var(--font-google-sans)" }} />
          </div>
          {pdfInfo && (
            <a href={`${API}/code-investissement/pdf/download`} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,79,145,0.08)", border: "1px solid rgba(0,79,145,0.2)", borderRadius: 9, padding: "8px 14px", fontSize: 12, color: "#004f91", fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
              <Download size={13} /> PDF
            </a>
          )}
          <button onClick={onClose} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 9, padding: 8, flexShrink: 0 }}>
            <X size={16} color="#4a5568" />
          </button>
        </div>

        {/* Corps */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Sidebar navigation */}
          <div style={{ width: 280, borderRight: "1px solid #E8E5E3", overflowY: "auto", flexShrink: 0, padding: "12px 0" }}>
            {loading ? (
              <div style={{ padding: 20, color: "#9aa5b4", fontSize: 13 }}>Chargement…</div>
            ) : chapitres.length === 0 ? (
              <div style={{ padding: 20, color: "#9aa5b4", fontSize: 13 }}>Aucun contenu</div>
            ) : chapitres.map(c => (
              <div key={c.id}>
                {/* Chapitre */}
                <button onClick={() => { setActiveChapId(c.id); setActiveSecId(null); setQ(""); }}
                  style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 16px", background: activeChapId === c.id && !activeSecId ? "rgba(202,99,31,0.08)" : "transparent", border: "none", cursor: "pointer", borderLeft: `3px solid ${activeChapId === c.id && !activeSecId ? "#ca631f" : "transparent"}`, transition: "all 0.15s" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#ca631f", background: "rgba(202,99,31,0.1)", padding: "2px 6px", borderRadius: 5, flexShrink: 0, marginTop: 1 }}>
                    {c.num_display.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1a2e", lineHeight: 1.4, wordBreak: "break-word" as const }}>{c.titre}</span>
                </button>
                {/* Sections */}
                {c.sections.map((s: any) => (
                  <button key={s.id} onClick={() => { setActiveChapId(c.id); setActiveSecId(s.id); setQ(""); }}
                    style={{ width: "100%", textAlign: "left", padding: "7px 16px 7px 36px", background: activeSecId === s.id ? "rgba(0,79,145,0.06)" : "transparent", border: "none", cursor: "pointer", borderLeft: `3px solid ${activeSecId === s.id ? "#004f91" : "transparent"}`, transition: "all 0.15s" }}>
                    <span style={{ fontSize: 11, color: activeSecId === s.id ? "#004f91" : "#6b7280", lineHeight: 1.4, display: "block", wordBreak: "break-word" as const }}>
                      Section {s.num_display} — {s.titre}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Contenu principal */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>

            {/* Résultats de recherche */}
            {q.length >= 2 ? (
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 16 }}>
                  {searching ? "Recherche…" : `${results?.length || 0} résultat${(results?.length||0)>1?"s":""} pour "${q}"`}
                </p>
                {results?.map(r => (
                  <div key={r.id} onClick={() => {
                    // Naviguer vers l'article trouvé
                    const chap = chapitres.find(c => c.id === r.chapitre_id);
                    if (chap) { setActiveChapId(chap.id); setActiveSecId(null); setQ(""); }
                  }}
                  style={{ background: "#fff", border: "1px solid #E8E5E3", borderRadius: 10, padding: "14px 18px", marginBottom: 8, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="#ca631f"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="#E8E5E3"}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#ca631f", marginBottom: 4 }}>
                      Article {numArt(r.numero)}{r.titre ? ` — ${r.titre}` : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "#4a5568", lineHeight: 1.6 }}
                      dangerouslySetInnerHTML={{ __html: r.extrait || "" }} />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* En-tête chapitre */}
                {activeChap && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#ca631f", background: "rgba(202,99,31,0.1)", padding: "3px 10px", borderRadius: 6, letterSpacing: "0.08em" }}>
                        CHAPITRE {activeChap.num_display.toUpperCase()}
                      </span>
                    </div>
                    <h3 style={{ fontWeight: 800, fontSize: "1.25rem", color: "#1a1a2e", margin: 0, lineHeight: 1.3 }}>{activeChap.titre}</h3>
                    {activeSecId && (() => {
                      const sec = activeChap.sections.find((s:any)=>s.id===activeSecId);
                      return sec ? (
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#004f91", marginTop: 8 }}>
                          Section {sec.num_display} — {sec.titre}
                        </p>
                      ) : null;
                    })()}
                    <div style={{ width: 48, height: 3, background: "#ca631f", borderRadius: 2, marginTop: 12 }} />
                  </div>
                )}

                {/* Articles */}
                {articlesFiltres.length === 0 ? (
                  <p style={{ color: "#9aa5b4", fontSize: 14 }}>Aucun article dans cette section.</p>
                ) : articlesFiltres.map((a: any) => (
                  <div key={a.id} style={{ marginBottom: 28 }}>
                    {/* Titre section si article appartient à une section (mode "tous les articles") */}
                    {!activeSecId && a.section_id && (() => {
                      const sec = activeChap?.sections.find((s:any)=>s.id===a.section_id);
                      const prevArt = articlesFiltres[articlesFiltres.indexOf(a)-1];
                      const isFirstOfSec = !prevArt || prevArt.section_id !== a.section_id;
                      return isFirstOfSec && sec ? (
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#004f91", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #E8E5E3" }}>
                          Section {sec.num_display} — {sec.titre}
                        </div>
                      ) : null;
                    })()}
                    {/* Article */}
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

                {/* Navigation chapitre suivant */}
                {activeChap && !activeSecId && (() => {
                  const idx = chapitres.findIndex(c=>c.id===activeChapId);
                  const next = chapitres[idx+1];
                  return next ? (
                    <button onClick={()=>{setActiveChapId(next.id);setActiveSecId(null);}}
                      style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, background:"rgba(202,99,31,0.06)", border:"1px solid rgba(202,99,31,0.15)", borderRadius:10, padding:"12px 18px", cursor:"pointer", width:"100%" }}>
                      <div style={{flex:1,textAlign:"left"}}>
                        <div style={{fontSize:11,color:"#9aa5b4",marginBottom:2}}>Chapitre suivant</div>
                        <div style={{fontSize:13,fontWeight:700,color:"#ca631f"}}>Chapitre {next.num_display} — {next.titre}</div>
                      </div>
                      <ChevronRight size={16} style={{color:"#ca631f",flexShrink:0}} />
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

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <>
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        transition: "all 0.4s ease",
        padding: scrolled ? "10px 0" : "18px 0",
        background: scrolled ? "rgba(242,240,239,0.94)" : "rgba(242,240,239,0.7)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: scrolled ? "1px solid #C5BFBB" : "1px solid transparent",
        boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.06)" : "none",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>

          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <Image src="/logo_apix.png" alt="APIX Sénégal" width={120} height={44}
              style={{ height: 44, width: "auto", objectFit: "contain" }} priority />
          </Link>

          {/* Nav desktop */}
          <nav style={{ display: "flex", alignItems: "center", gap: 32 }}>

            {/* Dropdown Modules */}
            <div style={{ position: "relative" }}
              onMouseEnter={() => setModulesOpen(true)}
              onMouseLeave={() => setModulesOpen(false)}>
              <button style={{ display: "flex", alignItems: "center", gap: 6, color: "#4a5568", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, fontFamily: "var(--font-body)", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#1a1a2e")}
                onMouseLeave={e => (e.currentTarget.style.color = "#4a5568")}>
                Modules
                <ChevronDown size={14} style={{ transition: "transform 0.2s", transform: modulesOpen ? "rotate(180deg)" : "rotate(0)" }} />
              </button>
              {modulesOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 14px)", left: "50%", transform: "translateX(-50%)", width: 480, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)", border: "1px solid #C5BFBB", borderRadius: 16, padding: 16, boxShadow: "0 16px 48px rgba(0,0,0,0.1)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {modules.map(m => (
                    <Link key={m.href} href={m.href} style={{ display: "flex", flexDirection: "column", padding: "10px 14px", borderRadius: 10, textDecoration: "none", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#DEDAD7")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <span style={{ color: "#1a1a2e", fontSize: 13, fontWeight: 600 }}>{m.label}</span>
                      <span style={{ color: "#9aa5b4", fontSize: 11, marginTop: 2 }}>{m.desc}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Code des investissements — ouvre le modal */}
            <button onClick={() => setCodeOpen(true)}
              style={{ color: "#4a5568", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, fontFamily: "var(--font-body)", transition: "color 0.2s", padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ca631f")}
              onMouseLeave={e => (e.currentTarget.style.color = "#4a5568")}>
              Code des investissements
            </button>

            {[
              { label: "Opportunités", href: "/opportunites" },
              { label: "À propos",     href: "/about"        },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ color: "#4a5568", textDecoration: "none", fontSize: 14, fontWeight: 500, transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#1a1a2e")}
                onMouseLeave={e => (e.currentTarget.style.color = "#4a5568")}>
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/login" style={{ fontSize: 14, color: "#4a5568", textDecoration: "none", padding: "8px 16px", borderRadius: 10, transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#1a1a2e")}
              onMouseLeave={e => (e.currentTarget.style.color = "#4a5568")}>
              Connexion
            </Link>
            <Link href="/register" style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg, #ca631f, #a84e18)", padding: "10px 20px", borderRadius: 12, textDecoration: "none", boxShadow: "0 4px 14px rgba(202,99,31,0.28)", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.transform="scale(1.04)"; e.currentTarget.style.boxShadow="0 6px 20px rgba(202,99,31,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform="scale(1)";    e.currentTarget.style.boxShadow="0 4px 14px rgba(202,99,31,0.28)"; }}>
              Espace Investisseur
            </Link>
          </div>

          {/* Burger mobile */}
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ display: "none", background: "none", border: "none", cursor: "pointer", color: "#1a1a2e", padding: 8 }}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Menu mobile */}
        {menuOpen && (
          <div style={{ margin: "8px 16px 0", background: "rgba(255,255,255,0.97)", border: "1px solid #C5BFBB", borderRadius: 16, padding: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.08)" }}>
            {modules.map(m => (
              <Link key={m.href} href={m.href} onClick={() => setMenuOpen(false)}
                style={{ display: "block", padding: "10px 14px", color: "#4a5568", textDecoration: "none", fontSize: 14, borderRadius: 10 }}>
                {m.label}
              </Link>
            ))}
            <button onClick={() => { setMenuOpen(false); setCodeOpen(true); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", color: "#ca631f", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
              Code des investissements
            </button>
            <div style={{ borderTop: "1px solid #C5BFBB", marginTop: 12, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/login" style={{ textAlign: "center", color: "#4a5568", textDecoration: "none", fontSize: 14, padding: "8px 0" }}>Connexion</Link>
              <Link href="/register" style={{ textAlign: "center", fontSize: 14, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg, #ca631f, #a84e18)", padding: "12px", borderRadius: 12, textDecoration: "none" }}>
                Espace Investisseur
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
