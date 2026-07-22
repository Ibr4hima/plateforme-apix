"use client";

// Code des investissements & Modalités d'application — lecteur pleine page,
// dans le style du rapport exécutif (bandeau dégradé profond, épure). Alimenté
// par l'API /code-investissement et /modalites-application.

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import NavActions from "@/components/layout/NavActions";
import { Skeleton } from "@/components/shared/Skeleton";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const BLEU = "#004f91", ORANGE = "#ca631f", ENCRE = "#101a2e";

function toRoman(n: number): string {
  const vals: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let r = "", num = n;
  for (const [v, s] of vals) while (num >= v) { r += s; num -= v; }
  return r;
}
const chapLabel = (n: number) => (n === 1 ? "Chapitre Premier" : `Chapitre ${toRoman(n)}`);

type Loi = "code" | "modalites";

export default function CodeInvestissementsPage() {
  const [loi, setLoi] = useState<Loi>("code");
  const base = loi === "code" ? `${API}/code-investissement` : `${API}/modalites-application`;

  const [chapitres, setChapitres] = useState<any[]>([]);
  const [pdfInfo, setPdfInfo] = useState<any>(null);
  const [activeChapId, setActiveChapId] = useState<string | null>(null);
  const [activeSecId, setActiveSecId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingArtId, setPendingArtId] = useState<string | null>(null);

  // Chargement du contenu à chaque changement de loi
  useEffect(() => {
    setLoading(true); setChapitres([]); setActiveChapId(null); setActiveSecId(null); setQ(""); setResults(null);
    Promise.all([
      fetch(`${base}`).then((r) => r.json()),
      fetch(`${base}/pdf/info`).then((r) => r.json()).catch(() => null),
    ]).then(([code, pdf]) => {
      const list = Array.isArray(code) ? code : [];
      setChapitres(list);
      setPdfInfo(pdf);
      if (list.length > 0) setActiveChapId(list[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [base]);

  // Recherche full-text
  useEffect(() => {
    if (!q.trim() || q.length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { setResults(await (await fetch(`${base}/search?q=${encodeURIComponent(q)}`)).json()); }
      catch { /* ignore */ } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q, base]);

  // Après clic sur un résultat : défilement vers l'article + surlignage
  useEffect(() => {
    if (!pendingArtId || q.length >= 2) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`art-${pendingArtId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.background = "rgba(202,99,31,0.09)";
        setTimeout(() => { el.style.background = "transparent"; }, 1800);
      }
      setPendingArtId(null);
    }, 120);
    return () => clearTimeout(t);
  }, [pendingArtId, activeChapId, q]);

  const goChap = (id: string) => { setActiveChapId(id); setActiveSecId(null); setQ(""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const goSec = (chapId: string, secId: string | null) => { setActiveChapId(chapId); setActiveSecId(secId); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const activeChap = chapitres.find((c) => c.id === activeChapId);
  const articlesActifs = useMemo(() => activeChap
    ? [...activeChap.articles, ...activeChap.sections.flatMap((s: any) => s.articles)].sort((a: any, b: any) => a.numero - b.numero)
    : [], [activeChap]);
  const articlesFiltres = activeSecId ? articlesActifs.filter((a: any) => a.section_id === activeSecId) : articlesActifs;

  const titre = pdfInfo?.titre || (loi === "code" ? "Code des investissements" : "Modalités d'application");
  const nbArticles = chapitres.reduce((s, c) => s + c.articles.length + c.sections.reduce((n: number, x: any) => n + x.articles.length, 0), 0);

  return (
    <div style={{ fontFamily: "var(--font-google-sans)", background: "var(--ds-fond, #F7F6F5)", minHeight: "100vh" }}>
      <style>{`
        .code-grille { display: grid; grid-template-columns: 288px minmax(0, 1fr); gap: 20px; align-items: start; }
        @media (max-width: 880px) { .code-grille { grid-template-columns: 1fr; } .code-somm { position: static !important; max-height: none !important; } }
        [data-rte]{overflow-wrap:break-word;word-break:break-word}
        [data-rte] ul{padding-left:22px;list-style-type:disc;margin:8px 0}
        [data-rte] ul.dash-list{list-style-type:"— ";padding-left:24px}
        [data-rte] ol{padding-left:22px;list-style-type:decimal;margin:8px 0}
        [data-rte] li{margin-bottom:5px}
        [data-rte] p{margin:10px 0}
        [data-rte] b,[data-rte] strong{font-weight:700}
        [data-rte] i,[data-rte] em{font-style:italic}
        [data-rte] table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse}
        [data-rte] img{max-width:100%;height:auto}
        [data-rte] pre{white-space:pre-wrap;overflow-x:auto}
      `}</style>

      {/* ── Bandeau ── */}
      <div data-bandeau style={{ background: "linear-gradient(155deg,#002a52 0%,#003a6e 35%,#004f91 70%,#1a6ab0 100%)", color: "#fff", padding: "32px 40px 92px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, minWidth: 0 }}>
              <div style={{ width: 54, height: 66, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}>
                <Image src="/armoiries_senegal.svg" alt="Armoiries du Sénégal" width={54} height={66} style={{ height: 64, width: "auto", objectFit: "contain" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", margin: "2px 0 8px" }}>
                  République du Sénégal · Lois &amp; Règlementations
                </p>
                <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.01em" }}>{titre}</h1>
                <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)", margin: "9px 0 0", fontWeight: 500 }}>
                  {loading ? "Chargement…" : `${chapitres.length} chapitre${chapitres.length > 1 ? "s" : ""} · ${nbArticles} article${nbArticles > 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <NavActions onDark home flouTotal />
            </div>
          </div>

          {/* Onglets + recherche + PDF */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
            <div role="tablist" aria-label="Texte" style={{ display: "inline-flex", gap: 3, padding: 3, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 999 }}>
              {([["code", "Code des investissements"], ["modalites", "Modalités d'application"]] as const).map(([key, label]) => {
                const actif = loi === key;
                return (
                  <button key={key} role="tab" aria-selected={actif} onClick={() => setLoi(key)}
                    style={{ padding: "6px 16px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 800,
                      background: actif ? "#fff" : "transparent", color: actif ? BLEU : "rgba(255,255,255,0.75)", transition: "background 0.16s, color 0.16s", fontFamily: "var(--font-google-sans)", whiteSpace: "nowrap" }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ position: "relative", width: "min(300px, 100%)" }}>
              <Search size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.6)" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" aria-label="Rechercher"
                style={{ width: "100%", background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 999, padding: "9px 14px 9px 38px", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.55)"; e.currentTarget.style.background = "rgba(255,255,255,0.20)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; e.currentTarget.style.background = "rgba(255,255,255,0.13)"; }} />
            </div>
            {pdfInfo && (
              <a href={`${base}/pdf/download`} target="_blank" rel="noopener noreferrer" title="Télécharger le PDF officiel" aria-label="Télécharger le PDF officiel"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: "50%", color: "#fff", textDecoration: "none", flexShrink: 0, transition: "background 0.15s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.22)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.13)"; }}>
                <span className="material-symbols-outlined" style={{ fontSize: 19, fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24", lineHeight: 1 }}>picture_as_pdf</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Corps ── */}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 40px 80px" }}>
        <div className="code-grille" style={{ marginTop: -52 }}>

          {/* Sommaire */}
          <aside className="ds-carte code-somm" style={{ position: "sticky", top: 20, maxHeight: "calc(100vh - 40px)", overflowY: "auto", padding: "16px 0", alignSelf: "start" }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.16em", padding: "0 20px", margin: "0 0 10px" }}>Sommaire</p>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 13, padding: "8px 20px" }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Skeleton w={16} h={11} r={4} />
                    <Skeleton w={`${56 + ((i * 17) % 34)}%`} h={11} r={6} />
                  </div>
                ))}
              </div>
            ) : chapitres.length === 0 ? (
              <div style={{ padding: "16px 20px", color: "#9aa5b4", fontSize: 12.5 }}>Aucun contenu.</div>
            ) : chapitres.map((c) => {
              const actif = activeChapId === c.id;
              return (
                <div key={c.id}>
                  <button onClick={() => goChap(c.id)}
                    style={{ width: "calc(100% - 16px)", margin: "0 8px", textAlign: "left", display: "flex", alignItems: "baseline", gap: 9, padding: "9px 10px", borderRadius: 10, background: actif ? "#FBF8F5" : "transparent", border: "none", borderLeft: actif ? "3px solid #ca631f" : "3px solid transparent", cursor: "pointer", fontFamily: "var(--font-google-sans)", transition: "background 0.12s" }}
                    onMouseEnter={(e) => { if (!actif) e.currentTarget.style.background = "#FAFAF9"; }}
                    onMouseLeave={(e) => { if (!actif) e.currentTarget.style.background = "transparent"; }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: actif ? ORANGE : "#C5BFBB", flexShrink: 0, minWidth: 18, fontVariantNumeric: "tabular-nums" }}>{toRoman(c.numero)}</span>
                    <span style={{ fontSize: 12.5, fontWeight: actif ? 700 : 500, color: actif ? ENCRE : "#6b7280", lineHeight: 1.45 }}>{c.titre}</span>
                  </button>
                  {actif && c.sections.length > 0 && (
                    <div style={{ margin: "2px 8px 6px 34px" }}>
                      {c.sections.map((s: any) => {
                        const secActif = activeSecId === s.id;
                        return (
                          <button key={s.id} onClick={() => goSec(c.id, secActif ? null : s.id)}
                            style={{ width: "100%", textAlign: "left", padding: "6px 12px", background: "transparent", border: "none", borderLeft: `2px solid ${secActif ? BLEU : "#EDEAE6"}`, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>
                            <span style={{ fontSize: 11.5, color: secActif ? BLEU : "#9aa5b4", fontWeight: secActif ? 600 : 400, lineHeight: 1.4, display: "block" }}>{s.titre}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </aside>

          {/* Zone de lecture */}
          <section className="ds-carte" style={{ padding: "44px 52px 56px", minHeight: 420 }}>
            {loading ? (
              <div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 44 }}>
                  <Skeleton w={120} h={11} r={5} />
                  <Skeleton w={360} h={26} r={8} />
                  <Skeleton w={40} h={3} r={2} />
                </div>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ marginBottom: 30 }}>
                    <Skeleton w={210} h={15} r={6} style={{ marginBottom: 14 }} />
                    <Skeleton w="100%" h={10} r={5} style={{ marginBottom: 9 }} />
                    <Skeleton w="97%" h={10} r={5} style={{ marginBottom: 9 }} />
                    <Skeleton w="90%" h={10} r={5} style={{ marginBottom: 9 }} />
                    <Skeleton w="64%" h={10} r={5} />
                  </div>
                ))}
              </div>
            ) : q.length >= 2 ? (
              /* Résultats de recherche */
              <div>
                <p style={{ fontSize: 11, fontWeight: 800, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 22 }}>
                  {searching ? "Recherche…" : `${results?.length || 0} résultat${(results?.length || 0) > 1 ? "s" : ""} pour « ${q} »`}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {results?.map((r) => {
                    const chap = chapitres.find((c) => c.id === r.chapitre_id);
                    return (
                      <div key={r.id} onClick={() => { if (chap) { setActiveChapId(chap.id); setActiveSecId(null); setQ(""); setResults(null); setPendingArtId(r.id); } }}
                        style={{ background: "#FAFAF9", border: "1px solid #F0EEEC", borderRadius: 12, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(202,99,31,0.35)"; e.currentTarget.style.background = "#fff"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,30,60,0.07)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#F0EEEC"; e.currentTarget.style.background = "#FAFAF9"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                        {chap && (
                          <p style={{ fontSize: 9.5, fontWeight: 800, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 5px" }}>{chapLabel(chap.numero)} · {chap.titre}</p>
                        )}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: ORANGE }}>Article {r.numero}{r.titre ? ` — ${r.titre}` : ""}</span>
                          <ChevronRight size={14} style={{ color: "#C5BFBB", flexShrink: 0 }} />
                        </div>
                        <div data-rte style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: r.extrait || "" }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : activeChap ? (
              /* Vue chapitre */
              <>
                <div style={{ marginBottom: 40, textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: ORANGE, letterSpacing: "0.2em", textTransform: "uppercase", margin: "0 0 12px" }}>{chapLabel(activeChap.numero)}</p>
                  <h2 style={{ fontWeight: 800, fontSize: "1.7rem", color: ENCRE, margin: 0, lineHeight: 1.25, letterSpacing: "-0.02em" }}>{activeChap.titre}</h2>
                  <div style={{ width: 40, height: 3, background: ORANGE, borderRadius: 2, margin: "18px auto 0" }} />
                  {activeChap.contenu && !activeSecId && (
                    <div data-rte style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.8, marginTop: 20, textAlign: "left" }} dangerouslySetInnerHTML={{ __html: activeChap.contenu }} />
                  )}
                  {activeSecId && (() => {
                    const sec = activeChap.sections.find((s: any) => s.id === activeSecId);
                    return sec ? (
                      <div style={{ marginTop: 24, textAlign: "left" }}>
                        <p style={{ fontSize: 10.5, fontWeight: 800, color: BLEU, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.14em" }}>Section {sec.num_display}</p>
                        <p style={{ fontSize: 17, fontWeight: 700, color: ENCRE, margin: 0, lineHeight: 1.3 }}>{sec.titre}</p>
                        {sec.contenu && <div data-rte style={{ fontSize: 13.5, color: "#6b7280", lineHeight: 1.8, marginTop: 8 }} dangerouslySetInnerHTML={{ __html: sec.contenu }} />}
                      </div>
                    ) : null;
                  })()}
                </div>

                {articlesFiltres.length === 0 ? (
                  <p style={{ color: "#9aa5b4", fontSize: 14, textAlign: "center" }}>Aucun article dans cette section.</p>
                ) : articlesFiltres.map((a: any, ai: number) => {
                  const prev = ai > 0 ? articlesFiltres[ai - 1] : null;
                  const showSec = !activeSecId && a.section_id && (!prev || prev.section_id !== a.section_id);
                  const sec = showSec ? activeChap.sections.find((s: any) => s.id === a.section_id) : null;
                  return (
                    <div key={a.id}>
                      {sec && (
                        <div style={{ margin: "40px 0 28px", paddingBottom: 12, borderBottom: "1px solid #EDEAE6" }}>
                          <p style={{ fontSize: 10.5, fontWeight: 800, color: BLEU, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.14em" }}>Section {sec.num_display}</p>
                          <p style={{ fontSize: 16, fontWeight: 700, color: ENCRE, margin: 0 }}>{sec.titre}</p>
                          {sec.contenu && <div data-rte style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.75, marginTop: 8 }} dangerouslySetInnerHTML={{ __html: sec.contenu }} />}
                        </div>
                      )}
                      <div id={`art-${a.id}`} style={{ scrollMarginTop: 24, borderRadius: 10, transition: "background 0.6s ease", padding: "4px 8px", margin: "0 -8px 30px" }}>
                        <p style={{ fontWeight: 700, fontSize: 15, color: ENCRE, margin: "0 0 10px", lineHeight: 1.4 }}>
                          <span style={{ color: ORANGE }}>Article {a.num_display}</span>
                          {a.titre && <span style={{ fontWeight: 600, color: "#4a5568" }}> — {a.titre}</span>}
                        </p>
                        {a.contenu ? (
                          <div data-rte style={{ fontSize: 14.5, color: "#2d3748", lineHeight: 1.85 }} dangerouslySetInnerHTML={{ __html: a.contenu }} />
                        ) : (
                          <p style={{ color: "#9aa5b4", fontSize: 13 }}>Contenu non renseigné.</p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Navigation chapitres */}
                {!activeSecId && (() => {
                  const idx = chapitres.findIndex((c) => c.id === activeChapId);
                  const prev = idx > 0 ? chapitres[idx - 1] : null;
                  const next = chapitres[idx + 1];
                  if (!prev && !next) return null;
                  const NavBtn = ({ chap, dir }: { chap: any; dir: "prev" | "next" }) => (
                    <button onClick={() => goChap(chap.id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, background: "transparent", border: "1px solid #EDEAE6", borderRadius: 12, padding: "14px 18px", cursor: "pointer", fontFamily: "var(--font-google-sans)", transition: "border-color 0.15s, background 0.15s", textAlign: dir === "prev" ? "left" : "right" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = ORANGE; e.currentTarget.style.background = "#FBF8F5";
                        const box = e.currentTarget.querySelector("[data-marquee]") as HTMLElement | null;
                        const span = box?.firstElementChild as HTMLElement | null;
                        if (box && span) { const d = span.scrollWidth - box.clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#EDEAE6"; e.currentTarget.style.background = "transparent";
                        const span = (e.currentTarget.querySelector("[data-marquee]") as HTMLElement | null)?.firstElementChild as HTMLElement | null;
                        if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                      }}>
                      {dir === "prev" && <ChevronLeft size={16} style={{ color: ORANGE, flexShrink: 0 }} />}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 10, color: "#9aa5b4", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 3 }}>{dir === "prev" ? "Chapitre précédent" : "Chapitre suivant"}</div>
                        <div data-marquee style={{ fontSize: 13, fontWeight: 700, color: ENCRE, overflow: "hidden", whiteSpace: "nowrap", textAlign: "left" }}>
                          <span style={{ display: "inline-block" }}>{chapLabel(chap.numero)} — {chap.titre}</span>
                        </div>
                      </div>
                      {dir === "next" && <ChevronRight size={16} style={{ color: ORANGE, flexShrink: 0 }} />}
                    </button>
                  );
                  return (
                    <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
                      {prev ? <NavBtn chap={prev} dir="prev" /> : <span style={{ flex: 1 }} />}
                      {next ? <NavBtn chap={next} dir="next" /> : <span style={{ flex: 1 }} />}
                    </div>
                  );
                })()}
              </>
            ) : (
              <p style={{ color: "#9aa5b4", fontSize: 14, textAlign: "center", marginTop: 60 }}>Aucun contenu disponible.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
