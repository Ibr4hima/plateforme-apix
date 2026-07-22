"use client";

import { ChevronDown, ChevronRight, Download, Menu, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { moduleAutorise } from "@/lib/authGate";
import FichePaysLauncher from "@/components/fiche-pays/FichePaysLauncher";
import NavActions from "@/components/layout/NavActions";
import { modules, PROTECTED_SLUGS } from "@/components/layout/navData";
import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
  const [onglet,       setOnglet]      = useState<"code" | "modalites">("code");
  const base = onglet === "code"
    ? `${API}/code-investissement`
    : `${API}/modalites-application`;

  const [chapitres,    setChapitres]   = useState<any[]>([]);
  const [pdfInfo,      setPdfInfo]     = useState<any>(null);
  const [activeChapId, setActiveChapId]= useState<string | null>(null);
  const [activeSecId,  setActiveSecId] = useState<string | null>(null);
  const [q,            setQ]           = useState("");
  const [results,      setResults]     = useState<any[] | null>(null);
  const [searching,    setSearching]   = useState(false);
  const [loading,      setLoading]     = useState(true);
  const [pendingArtId, setPendingArtId]= useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Accessibilité : fermeture à la touche Échap + verrouillage du scroll du body
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Après un clic sur un résultat de recherche : défiler jusqu'à l'article et le surligner.
  useEffect(() => {
    if (!pendingArtId || q.length >= 2) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`code-art-${pendingArtId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.style.background = "rgba(202,99,31,0.09)";
        setTimeout(() => { el.style.background = "transparent"; }, 1800);
      }
      setPendingArtId(null);
    }, 120);
    return () => clearTimeout(t);
  }, [pendingArtId, activeChapId, q]);

  useEffect(() => {
    setLoading(true);
    setChapitres([]);
    setActiveChapId(null);
    setActiveSecId(null);
    setQ("");
    setResults(null);
    Promise.all([
      fetch(`${base}`).then(r => r.json()),
      fetch(`${base}/pdf/info`).then(r => r.json()),
    ]).then(([code, pdf]) => {
      const chapList = Array.isArray(code) ? code : [];
      setChapitres(chapList);
      setPdfInfo(pdf);
      if (chapList.length > 0) setActiveChapId(chapList[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [base]);

  useEffect(() => {
    if (!q.trim() || q.length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${base}/search?q=${encodeURIComponent(q)}`);
        setResults(await res.json());
      } catch {} finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q, base]);

  const goChap = (id: string) => { setActiveChapId(id); setActiveSecId(null); setQ(""); if (contentRef.current) contentRef.current.scrollTop = 0; };
  const goSec  = (chapId: string, secId: string | null) => { setActiveChapId(chapId); setActiveSecId(secId); if (contentRef.current) contentRef.current.scrollTop = 0; };

  const activeChap = chapitres.find(c => c.id === activeChapId);
  const articlesActifs = activeChap
    ? [...activeChap.articles, ...activeChap.sections.flatMap((s: any) => s.articles)].sort((a: any, b: any) => a.numero - b.numero)
    : [];
  const articlesFiltres = activeSecId ? articlesActifs.filter((a: any) => a.section_id === activeSecId) : articlesActifs;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(20,22,28,0.5)", backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>

      <div role="dialog" aria-modal="true" aria-label={pdfInfo?.titre || (onglet === "code" ? "Code des investissements" : "Modalités d'application")} style={{ background:"#fff", borderRadius:18, width:"100%", maxWidth:1080, height:"90vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 40px 100px rgba(0,0,0,0.3)" }}>

        {/* ── Header ── */}
        <div style={{ padding:"20px 28px", borderBottom:"1px solid #EDEAE6", display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
          <div style={{ width:42, height:42, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Image src="/armoiries_senegal.svg" alt="Armoiries du Sénégal" width={36} height={42}
              style={{ height:42, width:"auto", objectFit:"contain" }} />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <h2 style={{ fontWeight:800, fontSize:"1.05rem", color:"#1a1a2e", margin:0, letterSpacing:"-0.01em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {pdfInfo?.titre || (onglet === "code" ? "Code des investissements" : "Modalités d'application")}
            </h2>
          </div>

          <div style={{ position:"relative", width:280, flexShrink:0 }}>
            <Search size={13} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher dans le code…" aria-label="Rechercher dans le code"
              style={{ width:"100%", background:"#F5F3F0", border:"1px solid transparent", borderRadius:10, padding:"9px 12px 9px 34px", fontSize:12.5, color:"#1a1a2e", outline:"none", boxSizing:"border-box" as const, fontFamily:"var(--font-google-sans)", transition:"border-color 0.15s" }}
              onFocus={e => { e.currentTarget.style.borderColor="#004f91"; e.currentTarget.style.background="#fff"; }}
              onBlur={e => { e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.background="#F5F3F0"; }} />
          </div>

          {pdfInfo && (
            <a href={`${base}/pdf/download`} target="_blank" rel="noopener noreferrer"
              title="Télécharger le PDF"
              style={{ display:"flex", alignItems:"center", gap:7, background:"#F5F3F0", border:"1px solid #EDEAE6", borderRadius:10, padding:"9px 15px", fontSize:12, color:"#4a5568", fontWeight:600, textDecoration:"none", flexShrink:0, transition:"all 0.15s", whiteSpace:"nowrap" as const }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor="#ca631f"; (e.currentTarget as HTMLElement).style.color="#ca631f"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor="#EDEAE6"; (e.currentTarget as HTMLElement).style.color="#4a5568"; }}>
              <Download size={13} /> PDF
            </a>
          )}

          <button onClick={onClose} aria-label="Fermer"
            style={{ width:38, height:38, background:"#F5F3F0", border:"none", borderRadius:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background="#EDEAE6"; }}
            onMouseLeave={e => { e.currentTarget.style.background="#F5F3F0"; }}>
            <X size={16} color="#4a5568" />
          </button>
        </div>

        {/* ── Onglets (lois) ── */}
        <div style={{ display:"flex", gap:0, padding:"0 28px", borderBottom:"1px solid #EDEAE6", flexShrink:0, background:"#fff" }}>
          {([["code","Code des investissements"],["modalites","Modalités d'application"]] as const).map(([key, label]) => {
            const active = onglet === key;
            return (
              <button key={key} onClick={() => setOnglet(key)}
                style={{ padding:"12px 0", marginRight:24, background:"none", border:"none", borderBottom: active ? "2px solid #ca631f" : "2px solid transparent", marginBottom:-1, cursor:"pointer", fontSize:12.5, fontWeight: active ? 700 : 500, color: active ? "#ca631f" : "#9aa5b4", fontFamily:"var(--font-google-sans)", transition:"color 0.15s", whiteSpace:"nowrap" as const }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = "#6b7280"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = "#9aa5b4"; }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Body ── */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* ── Sidebar ── */}
          <div style={{ width:258, borderRight:"1px solid #EDEAE6", overflowY:"auto", flexShrink:0, padding:"16px 0" }}>
            <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.16em", padding:"0 22px", marginBottom:10 }}>Sommaire</p>
            {loading ? (
              <div style={{ padding:"20px 20px", color:"#9aa5b4", fontSize:12.5 }}>Chargement…</div>
            ) : chapitres.length === 0 ? (
              <div style={{ padding:"20px 20px", color:"#9aa5b4", fontSize:12.5 }}>Aucun contenu.</div>
            ) : chapitres.map(c => {
              const isChapActive = activeChapId === c.id;
              return (
                <div key={c.id} style={{ marginBottom:1 }}>
                  <button onClick={() => goChap(c.id)}
                    style={{ width:"calc(100% - 20px)", textAlign:"left" as const, display:"flex", alignItems:"baseline", gap:9, padding:"9px 10px 9px 12px", margin:"0 10px", borderRadius:10, background: isChapActive ? "#FBF8F5" : "transparent", border:"none", borderLeft: isChapActive ? "3px solid #ca631f" : "3px solid transparent", cursor:"pointer", fontFamily:"var(--font-google-sans)", transition:"background 0.12s, color 0.12s" }}
                    onMouseEnter={e => { if (!isChapActive) e.currentTarget.style.background = "#FAFAF9"; }}
                    onMouseLeave={e => { if (!isChapActive) e.currentTarget.style.background = "transparent"; }}>
                    <span style={{ fontSize:10, fontWeight:700, color: isChapActive ? "#ca631f" : "#C5BFBB", flexShrink:0, fontVariantNumeric:"tabular-nums", minWidth:18 }}>
                      {c.numero === 1 ? "I" : toRomanNum(c.numero)}
                    </span>
                    <span style={{ fontSize:12.5, fontWeight: isChapActive ? 700 : 500, color: isChapActive ? "#1a1a2e" : "#6b7280", lineHeight:1.45, wordBreak:"break-word" as const }}>
                      {c.titre}
                    </span>
                  </button>

                  {isChapActive && c.sections.length > 0 && (
                    <div style={{ margin:"2px 10px 6px 32px", borderLeft:"1px solid #EDEAE6", paddingLeft:0 }}>
                      {c.sections.map((s: any) => {
                        const isSecActive = activeSecId === s.id;
                        return (
                          <button key={s.id} onClick={() => goSec(c.id, isSecActive ? null : s.id)}
                            style={{ width:"100%", textAlign:"left" as const, padding:"6px 20px 6px 14px", background:"transparent", border:"none", borderLeft:`2px solid ${isSecActive ? "#004f91" : "transparent"}`, marginLeft:-1, cursor:"pointer", fontFamily:"var(--font-google-sans)", transition:"all 0.12s" }}>
                            <span style={{ fontSize:11.5, color: isSecActive ? "#004f91" : "#9aa5b4", fontWeight: isSecActive ? 600 : 400, lineHeight:1.4, display:"block" }}>
                              {s.titre}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Zone de lecture ── */}
          <div ref={contentRef} style={{ flex:1, overflowY:"auto", background:"#fff" }}>
            {q.length >= 2 ? (
              /* Résultats de recherche */
              <div style={{ maxWidth:720, margin:"0 auto", padding:"36px 48px 60px" }}>
                <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.14em", marginBottom:22 }}>
                  {searching ? "Recherche…" : `${results?.length || 0} résultat${(results?.length||0)>1?"s":""} pour « ${q} »`}
                </p>
                <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
                  {results?.map(r => {
                    const chap = chapitres.find(c => c.id === r.chapitre_id);
                    return (
                      <div key={r.id}
                        onClick={() => { if (chap) { setActiveChapId(chap.id); setActiveSecId(null); setQ(""); setResults(null); setPendingArtId(r.id); if (contentRef.current) contentRef.current.scrollTop = 0; } }}
                        style={{ background:"#FAFAF9", border:"1px solid #F0EEEC", borderRadius:12, padding:"14px 16px", cursor:"pointer", transition:"border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(202,99,31,0.35)"; e.currentTarget.style.background="#fff"; e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow="0 8px 20px rgba(0,30,60,0.07)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor="#F0EEEC"; e.currentTarget.style.background="#FAFAF9"; e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}>
                        {chap && (
                          <p style={{ fontSize:9.5, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", margin:"0 0 5px" }}>
                            Chapitre {chap.numero === 1 ? "Premier" : toRomanNum(chap.numero)} · {chap.titre}
                          </p>
                        )}
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:6 }}>
                          <span style={{ fontSize:12.5, fontWeight:700, color:"#ca631f" }}>
                            Article {numArt(r.numero)}{r.titre ? ` — ${r.titre}` : ""}
                          </span>
                          <ChevronRight size={14} style={{ color:"#C5BFBB", flexShrink:0 }} />
                        </div>
                        <div data-rte style={{ fontSize:13, color:"#6b7280", lineHeight:1.7 }}
                          dangerouslySetInnerHTML={{ __html: r.extrait || "" }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Vue chapitre / articles */
              <div style={{ maxWidth:720, margin:"0 auto", padding:"44px 48px 72px" }}>
                {activeChap && (
                  <>
                    {/* ── En-tête du chapitre ── */}
                    <div style={{ marginBottom:40, textAlign:"center" as const }}>
                      <p style={{ fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.2em", textTransform:"uppercase" as const, margin:"0 0 12px" }}>
                        Chapitre {activeChap.numero === 1 ? "Premier" : toRomanNum(activeChap.numero)}
                      </p>
                      <h3 style={{ fontWeight:800, fontSize:"1.7rem", color:"#1a1a2e", margin:0, lineHeight:1.25, letterSpacing:"-0.02em" }}>
                        {activeChap.titre}
                      </h3>
                      <div style={{ width:40, height:3, background:"#ca631f", borderRadius:2, margin:"18px auto 0" }} />
                      {activeChap.contenu && !activeSecId && (
                        <div data-rte style={{ fontSize:14, color:"#6b7280", lineHeight:1.8, marginTop:20, textAlign:"left" as const }}
                          dangerouslySetInnerHTML={{ __html: activeChap.contenu }} />
                      )}
                      {activeSecId && (() => {
                        const sec = activeChap.sections.find((s: any) => s.id === activeSecId);
                        return sec ? (
                          <div style={{ marginTop:24, textAlign:"left" as const }}>
                            <p style={{ fontSize:10.5, fontWeight:700, color:"#004f91", margin:"0 0 4px", textTransform:"uppercase" as const, letterSpacing:"0.14em" }}>Section {sec.num_display}</p>
                            <p style={{ fontSize:17, fontWeight:700, color:"#1a1a2e", margin:0, lineHeight:1.3 }}>{sec.titre}</p>
                            {sec.contenu && (
                              <div data-rte style={{ fontSize:13.5, color:"#6b7280", lineHeight:1.8, marginTop:8 }}
                                dangerouslySetInnerHTML={{ __html: sec.contenu }} />
                            )}
                          </div>
                        ) : null;
                      })()}
                    </div>

                    {/* ── Articles ── */}
                    {articlesFiltres.length === 0 ? (
                      <p style={{ color:"#9aa5b4", fontSize:14, textAlign:"center" as const }}>Aucun article dans cette section.</p>
                    ) : articlesFiltres.map((a: any, ai: number) => {
                      const prevArt = ai > 0 ? articlesFiltres[ai - 1] : null;
                      const showSecHeader = !activeSecId && a.section_id && (!prevArt || prevArt.section_id !== a.section_id);
                      const sec = showSecHeader ? activeChap?.sections.find((s: any) => s.id === a.section_id) : null;

                      return (
                        <div key={a.id}>
                          {/* Sous-titre de section */}
                          {sec && (
                            <div style={{ margin:"40px 0 28px", paddingBottom:12, borderBottom:"1px solid #EDEAE6" }}>
                              <p style={{ fontSize:10.5, fontWeight:700, color:"#004f91", margin:"0 0 4px", textTransform:"uppercase" as const, letterSpacing:"0.14em" }}>Section {sec.num_display}</p>
                              <p style={{ fontSize:16, fontWeight:700, color:"#1a1a2e", margin:0 }}>{sec.titre}</p>
                              {sec.contenu && (
                                <div data-rte style={{ fontSize:13, color:"#6b7280", lineHeight:1.75, marginTop:8 }}
                                  dangerouslySetInnerHTML={{ __html: sec.contenu }} />
                              )}
                            </div>
                          )}

                          {/* Article */}
                          <div id={`code-art-${a.id}`} style={{ scrollMarginTop:24, borderRadius:10, transition:"background 0.6s ease", padding:"4px 8px", margin:"0 -8px 30px" }}>
                            <p style={{ fontWeight:700, fontSize:15, color:"#1a1a2e", margin:"0 0 10px", lineHeight:1.4 }}>
                              <span style={{ color:"#ca631f" }}>Article {a.num_display}</span>
                              {a.titre && <span style={{ fontWeight:600, color:"#4a5568" }}> — {a.titre}</span>}
                            </p>
                            {a.contenu ? (
                              <div data-rte style={{ fontSize:14.5, color:"#2d3748", lineHeight:1.85 }}
                                dangerouslySetInnerHTML={{ __html: a.contenu }} />
                            ) : (
                              <p style={{ color:"#9aa5b4", fontSize:13 }}>Contenu non renseigné.</p>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* ── Navigation chapitres précédent / suivant ── */}
                    {!activeSecId && (() => {
                      const idx  = chapitres.findIndex(c => c.id === activeChapId);
                      const prev = idx > 0 ? chapitres[idx - 1] : null;
                      const next = chapitres[idx + 1];
                      if (!prev && !next) return null;
                      const NavBtn = ({ chap, dir }: any) => (
                        <button onClick={() => goChap(chap.id)}
                          style={{ display:"flex", alignItems:"center", justifyContent: dir==="prev" ? "flex-start" : "space-between", gap:12, flex:1, minWidth:0, background:"transparent", border:"1px solid #EDEAE6", borderRadius:12, padding:"14px 18px", cursor:"pointer", fontFamily:"var(--font-google-sans)", transition:"all 0.15s", textAlign: dir==="prev" ? "left" as const : "right" as const }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor="#ca631f"; e.currentTarget.style.background="#FBF8F5";
                            // Titre trop long : glisse pour révéler la fin
                            const box = e.currentTarget.querySelector("[data-marquee]") as HTMLElement | null;
                            const span = box?.firstElementChild as HTMLElement | null;
                            if (box && span) { const d = span.scrollWidth - box.clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor="#EDEAE6"; e.currentTarget.style.background="transparent";
                            const span = (e.currentTarget.querySelector("[data-marquee]") as HTMLElement | null)?.firstElementChild as HTMLElement | null;
                            if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                          }}>
                          {dir === "prev" && <ChevronRight size={16} style={{ color:"#ca631f", flexShrink:0, transform:"rotate(180deg)" }} />}
                          <div style={{ minWidth:0, flex:1, textAlign: dir==="prev" ? "left" as const : "left" as const }}>
                            <div style={{ fontSize:10, color:"#9aa5b4", fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.14em", marginBottom:3 }}>{dir === "prev" ? "Chapitre précédent" : "Chapitre suivant"}</div>
                            <div data-marquee style={{ fontSize:13, fontWeight:700, color:"#1a1a2e", overflow:"hidden", whiteSpace:"nowrap" as const }}>
                              <span style={{ display:"inline-block" }}>{chap.numero === 1 ? "Chapitre Premier" : `Chapitre ${toRomanNum(chap.numero)}`} — {chap.titre}</span>
                            </div>
                          </div>
                          {dir === "next" && <ChevronRight size={16} style={{ color:"#ca631f", flexShrink:0 }} />}
                        </button>
                      );
                      return (
                        <div style={{ display:"flex", gap:12, marginTop:28 }}>
                          {prev ? <NavBtn chap={prev} dir="prev"/> : <span style={{ flex:1 }}/>}
                          {next ? <NavBtn chap={next} dir="next"/> : <span style={{ flex:1 }}/>}
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
  const { data: session } = useSession();
  const pathname = usePathname();
  // Sans session, tous les liens restent visibles : cliquer sur un module
  // protégé redirige vers la connexion (middleware). Connecté, on filtre
  // selon les droits du profil.
  const visible = (href: string) => {
    const slug = PROTECTED_SLUGS[href];
    if (!slug) return true;
    if (!session) return true;
    return moduleAutorise(session, slug);
  };
  const [scrolled,    setScrolled]    = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [codeOpen,    setCodeOpen]    = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const openModules  = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setModulesOpen(true); };
  const closeModules = () => { timeoutRef.current = setTimeout(() => setModulesOpen(false), 120); };

  const textColor = "#4a5568";
  const textHover = "#004f91";
  const bg = scrolled ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.88)";
  const border = "1px solid #ECEAE7";

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
          <nav className="apix-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 4 }}>

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
                    {modules.filter(m => visible(m.href)).map(m => (
                      <Link key={m.href} href={m.href} onClick={() => setModulesOpen(false)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, textDecoration: "none", transition: "background 0.12s", background: "transparent" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#F8F7F6"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                        <span style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(0,79,145,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 17, color: "#004f91", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20", lineHeight: 1 }}>{m.icon}</span>
                        </span>
                        <span style={{ color: "#1a1a2e", fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{m.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Échanges commerciaux */}
            {visible("/statistiques") && <Link href="/statistiques"
              style={{ display: "flex", alignItems: "center", height: 36, padding: "0 14px", borderRadius: 10, color: textColor, textDecoration: "none", fontSize: 14, fontWeight: 500, fontFamily: "var(--font-google-sans)", transition: "all 0.15s", letterSpacing: "-0.01em" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.07)"; e.currentTarget.style.color = textHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = textColor; }}>
              Échanges commerciaux
            </Link>}

            {/* Tableau de bord */}
            {visible("/tableau-de-bord") && <Link href="/tableau-de-bord"
              style={{ display: "flex", alignItems: "center", height: 36, padding: "0 14px", borderRadius: 10, color: textColor, textDecoration: "none", fontSize: 14, fontWeight: 500, fontFamily: "var(--font-google-sans)", transition: "all 0.15s", letterSpacing: "-0.01em" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.07)"; e.currentTarget.style.color = textHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = textColor; }}>
              Tableau de bord
            </Link>}


            <FichePaysLauncher textColor={textColor} textHover={textHover} />
          </nav>

          {/* ── Recherche + Menu ── */}
          <div className="apix-nav-cta" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <NavActions flouFond={pathname !== "/"} home={pathname !== "/"} />
          </div>

          {/* ── Burger mobile ── */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="apix-nav-burger" aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            style={{ display: "none", background: "none", border: "none", cursor: "pointer", color: textColor, padding: 8 }}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* ── Menu mobile ── */}
        {menuOpen && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "rgba(255,255,255,0.98)", borderBottom: "1px solid #E8E5E3", boxShadow: "0 8px 32px rgba(0,0,0,0.08)", padding: "12px 16px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 12 }}>
              {modules.filter(m => visible(m.href)).map(m => (
                <Link key={m.href} href={m.href} onClick={() => setMenuOpen(false)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, color: "#1a1a2e", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(0,79,145,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: "#004f91", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20", lineHeight: 1 }}>{m.icon}</span>
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
              <Link href="/code-investissements" onClick={() => setMenuOpen(false)}
                style={{ display: "block", padding: "10px 14px", color: "#4a5568", textDecoration: "none", fontSize: 14, fontWeight: 500, borderRadius: 10 }}>
                Code des investissements
              </Link>
              <Link href="/login" onClick={() => setMenuOpen(false)}
                style={{ display: "block", width: "100%", textAlign: "center" as const, fontSize: 14, fontWeight: 700, color: "#fff", background: "#ca631f", padding: "12px", borderRadius: 12, border: "none", cursor: "pointer", marginTop: 4, textDecoration: "none" }}>
                Connexion
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Modal Code des investissements */}
      {codeOpen && <CodeModal onClose={() => setCodeOpen(false)} />}

      <style>{`
        /* Bascule responsive de la navbar : nav desktop ↔ menu burger */
        @media (max-width: 860px){
          .apix-nav-desktop, .apix-nav-cta { display: none !important; }
          .apix-nav-burger { display: flex !important; }
        }
        .apix-menu-pop { animation: apixMenuPop 0.16s cubic-bezier(0.16,1,0.3,1); }
        @keyframes apixMenuPop { from { opacity: 0; transform: translateY(-6px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .apix-menu-fly { animation: apixMenuFly 0.16s cubic-bezier(0.16,1,0.3,1); }
        @keyframes apixMenuFly { from { opacity: 0; transform: translateX(8px) scale(0.98); } to { opacity: 1; transform: translateX(0) scale(1); } }
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
