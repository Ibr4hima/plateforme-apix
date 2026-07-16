"use client";

// Dossier diplomatique — la relation bilatérale Sénégal × pays racontée en
// plein écran : identité, accords, commerce, IDE, entreprises installées,
// événements, indicateurs comparés. Imprimable tel quel (Ctrl+P) : le dossier
// qu'on prépare avant une visite d'État. Ouvert en un clic depuis ⌘K.

import Navbar from "@/components/layout/Navbar";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards, SkeletonRows } from "@/components/shared/Skeleton";
import { ArrowLeft, ArrowRight, Building2, CalendarDays, FileText, Landmark, Printer, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { fetchTous } from "@/lib/fetchTous";
import { fmtDate, fmtUnite as fmt, fmtUSD } from "@/lib/format";
import { computeStatutAccord, computeStatutEvenement } from "@/lib/statuts";
import { slugPays } from "@/lib/slug";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const BLEU = "#004f91";
const ORANGE = "#ca631f";

// Coloration comparative (mêmes règles que la Fiche Pays modale)
const COULEUR_MAX: Record<string, "vert" | "rouge"> = {
  population: "vert", superficie: "vert",
  exportations_marchandises: "vert", exportations_services: "vert",
  importations_marchandises: "rouge", importations_services: "rouge",
  __ide_entrant: "vert", __ide_sortant: "vert",
};
const couleurMaxPour = (code: string, categorie?: string): "vert" | "rouge" | null =>
  code in COULEUR_MAX ? COULEUR_MAX[code] : categorie === "Économie" ? "vert" : null;

const ST_ACCORD: Record<string, { label: string; c: string; bg: string }> = {
  en_vigueur: { label: "En vigueur", c: "#188038", bg: "rgba(24,128,56,0.08)" },
  signe:      { label: "Signé non en vigueur", c: BLEU, bg: "rgba(0,79,145,0.07)" },
  expire:     { label: "Expiré", c: "#b45309", bg: "rgba(202,99,31,0.10)" },
};
const ST_EVENT: Record<string, { label: string; c: string; bg: string }> = {
  a_venir:  { label: "À venir",  c: BLEU,      bg: "rgba(0,79,145,0.07)"  },
  en_cours: { label: "En cours", c: "#188038", bg: "rgba(24,128,56,0.08)" },
  termine:  { label: "Terminé",  c: "#6b7280", bg: "#F2F0EF"              },
};

// ── Briques du dossier ────────────────────────────────────────────────────────

function EnteteSection({ numero, titre, count, sousTitre, id }: {
  numero: string; titre: string; count?: number | null; sousTitre?: string; id: string;
}) {
  return (
    <div id={id} style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 22, paddingTop: 54, scrollMarginTop: 70 }}>
      <span style={{ fontSize: 44, fontWeight: 800, color: "rgba(0,79,145,0.16)", lineHeight: 1, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{numero}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 21, fontWeight: 800, color: "#1a1a2e", margin: 0, letterSpacing: "-0.01em" }}>{titre}</h2>
          {count != null && <span style={{ fontSize: 11.5, fontWeight: 800, color: BLEU, background: "rgba(0,79,145,0.08)", padding: "3px 11px", borderRadius: 999 }}>{count}</span>}
        </div>
        {sousTitre && <p style={{ fontSize: 12.5, color: "#9aa5b4", marginTop: 4 }}>{sousTitre}</p>}
      </div>
    </div>
  );
}

function Vide({ texte }: { texte: string }) {
  return (
    <div style={{ padding: "26px 24px", background: "#fff", border: "1px dashed #E4E1DE", borderRadius: 14, textAlign: "center" as const }}>
      <p style={{ fontSize: 12.5, color: "#9aa5b4" }}>{texte}</p>
    </div>
  );
}

const ouvrirFiche = (type: string, item: any, onglet?: string) =>
  window.dispatchEvent(new CustomEvent("apix:fiche-item", { detail: { type, item, onglet } }));

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DossierPaysPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [tousPays, setTousPays] = useState<any[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [comparaison, setComparaison] = useState<any>(null);
  const [ideFlux, setIdeFlux] = useState<any>(null);
  const [bilat, setBilat] = useState<any>(null);
  const [entSiege, setEntSiege] = useState<any>(null);
  const [evenements, setEvenements] = useState<any[] | null>(null);

  useEffect(() => {
    fetch(`${API}/statistiques/pays`).then(r => r.json()).then(setTousPays).catch(() => setErreur(true));
  }, []);

  const pays  = useMemo(() => (tousPays || []).find((p: any) => slugPays(p.nom) === slug) || null, [tousPays, slug]);
  const sen   = useMemo(() => (tousPays || []).find((p: any) => p.code_iso3 === "SEN") || null, [tousPays]);
  const estSenegal = pays && sen && pays.id === sen.id;

  useEffect(() => {
    if (!pays || !sen || estSenegal) return;
    const ids = `${sen.id},${pays.id}`;
    fetch(`${API}/statistiques/comparaison?pays=${ids}`).then(r => r.json()).then(setComparaison).catch(() => {});
    fetch(`${API}/statistiques/ide_flux?pays=${ids}`).then(r => r.json()).then(setIdeFlux).catch(() => setIdeFlux({}));
    fetch(`${API}/statistiques/commerce/bilateral?pays_a=${sen.id}&pays_b=${pays.id}`).then(r => r.json()).then(setBilat).catch(() => setBilat({}));
    fetch(`${API}/statistiques/entreprises-siege?pays_id=${pays.id}`).then(r => r.json()).then(setEntSiege).catch(() => setEntSiege({ total: 0, entreprises: [] }));
    fetchTous(`${API}/evenements`).then(evs => setEvenements(evs.filter((e: any) => e.pays_hote_nom === pays.nom))).catch(() => setEvenements([]));
  }, [pays?.id, sen?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ouvrirEntreprise = (id: number) => {
    fetch(`${API}/entreprises/${id}`).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(e => ouvrirFiche("entreprise", e)).catch(() => {});
  };

  // ── États de chargement / introuvable ───────────────────────────────────────
  if (erreur) return <main style={{ minHeight: "100vh", background: "#F6F5F3" }}><Navbar/><div style={{ paddingTop: 140 }}><ErreurChargement onRetry={() => window.location.reload()}/></div></main>;
  if (!tousPays) return <main style={{ minHeight: "100vh", background: "#F6F5F3" }}><Navbar/><div style={{ maxWidth: 1080, margin: "0 auto", padding: "140px 40px" }}><SkeletonRows n={8} h={40}/></div></main>;
  if (!pays || estSenegal) return (
    <main style={{ minHeight: "100vh", background: "#F6F5F3", fontFamily: "var(--font-google-sans)" }}>
      <Navbar/>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "160px 40px", textAlign: "center" as const }}>
        <p style={{ fontSize: 15, color: "#4a5568", lineHeight: 1.7 }}>
          {estSenegal ? "Le dossier bilatéral décrit la relation du Sénégal avec un autre pays." : `Aucun pays ne correspond à « ${slug} ».`}
        </p>
        <button onClick={() => router.push("/")} style={{ marginTop: 18, padding: "9px 20px", borderRadius: 10, border: "none", background: BLEU, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>Retour à l'accueil</button>
      </div>
    </main>
  );

  const accords = bilat?.accords || [];
  const grps    = bilat?.groupements_communs || [];
  const ents    = entSiege?.entreprises || [];
  const cols    = comparaison?.pays || [];
  const inds    = [
    ...(comparaison?.indicateurs || []),
    { code: "__ide_entrant", libelle: "Flux d'IDE entrants", unite: "USD", categorie: "Investissements directs étrangers" },
    { code: "__ide_sortant", libelle: "Flux d'IDE sortants", unite: "USD", categorie: "Investissements directs étrangers" },
  ];
  const getCell = (cid: number, code: string): { valeur: number | null; annee?: number } | null => {
    if (code === "__ide_entrant") return ideFlux?.[String(cid)]?.entrant || null;
    if (code === "__ide_sortant") return ideFlux?.[String(cid)]?.sortant || null;
    return comparaison?.valeurs?.[String(cid)]?.[code] || null;
  };
  const cats: string[] = []; const parCat: Record<string, any[]> = {};
  inds.forEach((ind: any) => { const c = ind.categorie || "Autres"; if (!parCat[c]) { parCat[c] = []; cats.push(c); } parCat[c].push(ind); });

  const fluxPays = ideFlux?.[String(pays.id)] || {};
  const fluxSen  = sen ? (ideFlux?.[String(sen.id)] || {}) : {};
  const ab = bilat?.a_vers_b || 0, ba = bilat?.b_vers_a || 0;
  const periode = bilat?.annee_min ? `${bilat.annee_min}–${bilat.annee_max}` : "";

  const ANCRES = [
    { id: "accords",     label: "Accords" },
    { id: "commerce",    label: "Commerce" },
    { id: "ide",         label: "IDE" },
    { id: "entreprises", label: "Entreprises" },
    { id: "evenements",  label: "Événements" },
    { id: "indicateurs", label: "Indicateurs" },
  ];

  const CarteFlux = ({ titre, sousTitre, cell, Icone }: { titre: string; sousTitre: string; cell: any; Icone: any }) => (
    <div style={{ background: "#fff", border: "1px solid #ECEAE7", borderRadius: 16, padding: "18px 20px", display: "flex", alignItems: "center", gap: 15, minWidth: 0 }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(0,79,145,0.07)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icone size={19} style={{ color: BLEU }}/>
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 9.5, fontWeight: 800, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>{titre}</p>
        <p style={{ fontSize: 20, fontWeight: 800, color: cell?.valeur != null ? "#1a1a2e" : "#C5BFBB", lineHeight: 1.2, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
          {cell?.valeur != null ? fmtUSD(cell.valeur) : "—"}
        </p>
        <p style={{ fontSize: 10.5, color: "#9aa5b4", marginTop: 2 }}>{sousTitre}{cell?.annee ? ` · ${cell.annee}` : ""}</p>
      </div>
    </div>
  );

  const BlocCommerce = ({ de, vers, val, res, dep, couleur }: any) => {
    const maxR = res && res.length ? res[0].valeur : 1;
    return (
      <div style={{ background: "#fff", border: "1px solid #ECEAE7", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "16px 20px", borderBottom: res?.length ? "1px solid #F4F2F0" : "none" }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 700, color: "#1a1a2e" }}>
              <span style={{ fontWeight: 800, color: couleur }}>{de}</span>
              <ArrowRight size={14} style={{ color: "#c5bfbb", flexShrink: 0 }}/>
              <span>{vers}</span>
            </span>
            {dep != null && dep > 0 && <span style={{ fontSize: 11.5, color: "#9aa5b4", marginTop: 4, display: "block" }}>soit <strong style={{ color: "#6b7684" }}>{(dep * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</strong> des importations de {vers}</span>}
          </div>
          <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: couleur, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{fmtUSD(val)}</div>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: "#c5bfbb", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginTop: 3 }}>Total exporté</div>
          </div>
        </div>
        {res?.length > 0 && (
          <div style={{ padding: "15px 20px", display: "grid", gap: 12 }}>
            {res.slice(0, 5).map((r: any) => {
              const pct = val > 0 ? r.valeur / val * 100 : 0;
              return (
                <div key={r.ressource}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "#4a5568", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, minWidth: 0 }} title={r.ressource}>{r.ressource}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#2d3540", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const, flexShrink: 0 }}>{fmtUSD(r.valeur)} <span style={{ color: "#b0aaa4", fontWeight: 600 }}>· {pct.toFixed(0)} %</span></span>
                  </div>
                  <div style={{ height: 6, background: "#F0EEEC", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(4, Math.sqrt(r.valeur / maxR) * 100)}%`, background: couleur, borderRadius: 99 }}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <main style={{ minHeight: "100vh", background: "#F6F5F3", fontFamily: "var(--font-google-sans)" }}>
      <style>{`@media print {
        .no-print { display: none !important; }
        main { background: #fff !important; }
        section.dossier-hero { padding: 40px 40px 24px !important; }
      }`}</style>
      <div className="no-print"><Navbar/></div>

      {/* ── Bandeau d'identité ── */}
      <section className="dossier-hero" style={{ padding: "108px 40px 0", background: BLEU, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5 }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(ellipse at 75% 0%,rgba(0,0,0,0.9) 0%,transparent 72%)", WebkitMaskImage: "radial-gradient(ellipse at 75% 0%,rgba(0,0,0,0.9) 0%,transparent 72%)" }}/>
          <div style={{ position: "absolute", top: -260, right: -60, width: 620, height: 620, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,0.07) 0%,transparent 60%)" }}/>
        </div>
        <div style={{ maxWidth: 1080, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className="no-print" style={{ paddingTop: 6 }}>
            <button onClick={() => router.back()}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.22)", color: "#fff", fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>
              <ArrowLeft size={13}/> Retour
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" as const, padding: "30px 0 26px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22, minWidth: 0 }}>
              {pays.code_iso2 && (
                <img src={`https://flagcdn.com/w160/${String(pays.code_iso2).toLowerCase()}.png`} alt=""
                  style={{ width: 84, height: 60, objectFit: "cover", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.25)", flexShrink: 0 }}
                  onError={e => { e.currentTarget.style.display = "none"; }}/>
              )}
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 10.5, fontWeight: 800, color: "rgba(255,255,255,0.65)", letterSpacing: "0.16em", textTransform: "uppercase" as const, marginBottom: 6 }}>
                  Dossier bilatéral · Sénégal — {pays.nom}
                </p>
                <h1 style={{ fontSize: "2.5rem", fontWeight: 800, color: "#fff", lineHeight: 1.05, margin: 0, letterSpacing: "-0.02em" }}>{pays.nom}</h1>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 8 }}>
                  {[pays.continent, pays.region_geo, pays.code_iso3].filter(Boolean).join("  ·  ")}
                </p>
              </div>
            </div>
            <div className="no-print" style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              <button onClick={() => window.print()}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", border: "none", color: BLEU, fontSize: 12.5, fontWeight: 700, padding: "10px 20px", borderRadius: 999, cursor: "pointer", fontFamily: "var(--font-google-sans)", boxShadow: "0 4px 16px rgba(0,0,0,0.18)" }}>
                <Printer size={14}/> Imprimer le dossier
              </button>
            </div>
          </div>
          {/* Ancres */}
          <div className="no-print" style={{ display: "flex", gap: 4, paddingBottom: 14, flexWrap: "wrap" as const }}>
            {ANCRES.map(a => (
              <a key={a.id} href={`#${a.id}`}
                style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.75)", textDecoration: "none", padding: "5px 13px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}>
                {a.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 40px 90px" }}>

        {/* ── 01 · Accords & cadre juridique ── */}
        <EnteteSection id="accords" numero="01" titre="Accords & cadre juridique" count={bilat ? accords.length : null}
          sousTitre={`Accords signés entre le Sénégal et ${pays.nom}, appartenances communes`}/>
        {!bilat ? <SkeletonRows n={3} h={52}/> : (
          <>
            {grps.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, marginBottom: 14, padding: "13px 18px", background: "#fff", border: "1px solid #ECEAE7", borderRadius: 14 }}>
                <Landmark size={13} style={{ color: BLEU, flexShrink: 0 }}/>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: BLEU, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginRight: 4 }}>Appartenances communes</span>
                {grps.map((g: any) => (
                  <span key={g.code} title={g.nom} style={{ fontSize: 11, fontWeight: 600, color: "#4a5568", background: "#F5F4F3", border: "1px solid #E8E5E2", padding: "3px 11px", borderRadius: 999 }}>{g.code || g.nom}</span>
                ))}
              </div>
            )}
            {accords.length === 0 ? <Vide texte={`Aucun accord recensé entre le Sénégal et ${pays.nom}.`}/> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
                {accords.map((a: any) => {
                  const st = ST_ACCORD[computeStatutAccord(a) || ""] || null;
                  return (
                    <div key={a.id} onClick={() => ouvrirFiche("accord", a)}
                      style={{ background: "#fff", border: "1px solid #ECEAE7", borderRadius: 16, padding: "16px 18px", cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", minWidth: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 14px 32px rgba(0,30,60,0.10)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = st ? `${st.c}55` : "rgba(0,79,145,0.33)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "#ECEAE7"; }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.35, minWidth: 0 }}>{a.titre}</p>
                        {st && <span style={{ fontSize: 10, fontWeight: 700, color: st.c, background: st.bg, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{st.label}</span>}
                      </div>
                      <p style={{ fontSize: 11.5, color: "#9aa5b4", marginTop: 7 }}>
                        {[a.date_signature ? `Signé le ${fmtDate(a.date_signature)}` : null,
                          a.date_entree_vigueur ? `en vigueur depuis le ${fmtDate(a.date_entree_vigueur)}` : null]
                          .filter(Boolean).join(" · ") || "Dates non renseignées"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── 02 · Commerce bilatéral ── */}
        <EnteteSection id="commerce" numero="02" titre="Commerce bilatéral" sousTitre={periode ? `Cumul des échanges observés · ${periode}` : "Cumul des échanges observés"}/>
        {!bilat ? <SkeletonRows n={3} h={60}/> : (ab <= 0 && ba <= 0) ? <Vide texte={`Aucun échange commercial recensé entre le Sénégal et ${pays.nom}.`}/> : (
          <div style={{ display: "grid", gap: 12 }}>
            <BlocCommerce de="Sénégal" vers={pays.nom} val={ab} res={bilat.a_vers_b_ressources} dep={bilat.a_vers_b_dependance} couleur={BLEU}/>
            <BlocCommerce de={pays.nom} vers="Sénégal" val={ba} res={bilat.b_vers_a_ressources} dep={bilat.b_vers_a_dependance} couleur={ORANGE}/>
            <div style={{ padding: "16px 20px", borderRadius: 14, background: "linear-gradient(180deg,rgba(0,79,145,0.08),rgba(0,79,145,0.035))", border: "1px solid rgba(0,79,145,0.20)", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(0,79,145,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Scale size={19} color={BLEU}/>
              </span>
              <p style={{ fontSize: 13, color: "#2d3540", lineHeight: 1.6 }}>
                Balance commerciale {ab === ba ? "à l'équilibre" : <>en faveur {ab > ba ? "du Sénégal" : `de ${pays.nom}`} : <strong style={{ fontVariantNumeric: "tabular-nums" }}>{fmtUSD(Math.abs(ab - ba))}</strong> d'écart sur la période</>}.
              </p>
            </div>
          </div>
        )}

        {/* ── 03 · Investissements directs étrangers ── */}
        <EnteteSection id="ide" numero="03" titre="Investissements directs étrangers" sousTitre="Flux annuels — source CNUCED"/>
        {ideFlux === null ? <SkeletonCards n={4} cols={2} height={90}/> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
            <CarteFlux titre={`IDE entrants · ${pays.nom}`}  sousTitre="Investissements reçus"  cell={fluxPays.entrant} Icone={TrendingUp}/>
            <CarteFlux titre={`IDE sortants · ${pays.nom}`}  sousTitre="Investissements émis"   cell={fluxPays.sortant} Icone={TrendingDown}/>
            <CarteFlux titre="IDE entrants · Sénégal"        sousTitre="Investissements reçus"  cell={fluxSen.entrant}  Icone={TrendingUp}/>
            <CarteFlux titre="IDE sortants · Sénégal"        sousTitre="Investissements émis"   cell={fluxSen.sortant}  Icone={TrendingDown}/>
          </div>
        )}

        {/* ── 04 · Entreprises installées au Sénégal ── */}
        <EnteteSection id="entreprises" numero="04" titre="Entreprises installées au Sénégal" count={entSiege ? (entSiege.total ?? ents.length) : null}
          sousTitre={`Entreprises dont le siège est situé ${pays.nom ? `en ${pays.nom}` : "dans ce pays"}, formalisées au Sénégal`}/>
        {!entSiege ? <SkeletonCards n={6} cols={3} height={80}/> : ents.length === 0 ? <Vide texte={`Aucune entreprise à capitaux ${pays.nom} recensée au Sénégal.`}/> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {ents.map((e: any) => (
              <div key={e.id} onClick={() => ouvrirEntreprise(e.id)}
                style={{ background: "#fff", border: "1px solid #ECEAE7", borderRadius: 16, padding: "15px 17px", cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", minWidth: 0 }}
                onMouseEnter={ev => { ev.currentTarget.style.boxShadow = "0 14px 32px rgba(0,30,60,0.10)"; ev.currentTarget.style.transform = "translateY(-2px)"; ev.currentTarget.style.borderColor = "rgba(0,79,145,0.33)"; }}
                onMouseLeave={ev => { ev.currentTarget.style.boxShadow = "none"; ev.currentTarget.style.transform = "none"; ev.currentTarget.style.borderColor = "#ECEAE7"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(0,79,145,0.07)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Building2 size={14} style={{ color: BLEU }}/>
                  </span>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, minWidth: 0 }} title={e.nom}>{e.nom}</p>
                </div>
                <p style={{ fontSize: 11, color: "#9aa5b4", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                  {[e.region ? `Région de ${e.region}` : null, e.secteurs?.[0]].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ── 05 · Événements ── */}
        <EnteteSection id="evenements" numero="05" titre={`Événements accueillis par ${pays.nom}`} count={evenements ? evenements.length : null}
          sousTitre="Événements économiques suivis par l'APIX dont ce pays est l'hôte"/>
        {!evenements ? <SkeletonRows n={3} h={52}/> : evenements.length === 0 ? <Vide texte={`Aucun événement recensé en ${pays.nom}.`}/> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
            {evenements.map((e: any) => {
              const st = ST_EVENT[computeStatutEvenement(e) ?? ((e.prochain_annee || e.prochain_mois) ? "a_venir" : "")] || null;
              return (
                <div key={e.id} onClick={() => ouvrirFiche("evenement", e)}
                  style={{ background: "#fff", border: "1px solid #ECEAE7", borderRadius: 16, padding: "15px 18px", cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", minWidth: 0 }}
                  onMouseEnter={ev => { ev.currentTarget.style.boxShadow = "0 14px 32px rgba(0,30,60,0.10)"; ev.currentTarget.style.transform = "translateY(-2px)"; ev.currentTarget.style.borderColor = st ? `${st.c}55` : "rgba(0,79,145,0.33)"; }}
                  onMouseLeave={ev => { ev.currentTarget.style.boxShadow = "none"; ev.currentTarget.style.transform = "none"; ev.currentTarget.style.borderColor = "#ECEAE7"; }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                      <CalendarDays size={14} style={{ color: BLEU, flexShrink: 0 }}/>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.35, minWidth: 0 }}>{e.nom_event}</p>
                    </div>
                    {st && <span style={{ fontSize: 10, fontWeight: 700, color: st.c, background: st.bg, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{st.label}</span>}
                  </div>
                  <p style={{ fontSize: 11.5, color: "#9aa5b4", marginTop: 7 }}>
                    {[e.date_debut ? fmtDate(e.date_debut) : null, e.ville, e.role_apix ? `Rôle APIX : ${e.role_apix}` : null].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 06 · Indicateurs comparés ── */}
        <EnteteSection id="indicateurs" numero="06" titre="Indicateurs comparés" sousTitre={`Sénégal et ${pays.nom} face à face — la meilleure valeur est colorée`}/>
        {!comparaison ? <SkeletonRows n={10} h={36}/> : (
          <div style={{ background: "#fff", border: "1px solid #ECEAE7", borderRadius: 16, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FAFAF9", borderBottom: "1px solid #F0EEEC" }}>
                  <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Indicateur</th>
                  {cols.map((c: any, i: number) => (
                    <th key={c.id} style={{ padding: "12px 20px", textAlign: "right", fontSize: 12.5, fontWeight: 800, color: i === 0 ? BLEU : ORANGE }}>{c.nom}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cats.map(cat => (
                  <Fragment key={cat}>
                    <tr><td colSpan={cols.length + 1} style={{ padding: "16px 20px 5px", fontSize: 10.5, fontWeight: 800, color: BLEU, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>{cat}</td></tr>
                    {parCat[cat].map((ind: any) => {
                      const teinte = couleurMaxPour(ind.code, ind.categorie);
                      let maxVal: number | null = null;
                      if (teinte && cols.length >= 2) {
                        const vals = cols.map((c: any) => getCell(c.id, ind.code)?.valeur).filter((x: any) => x !== null && x !== undefined) as number[];
                        if (vals.length >= 2 && Math.max(...vals) !== Math.min(...vals)) maxVal = Math.max(...vals);
                      }
                      return (
                        <tr key={ind.code} style={{ borderBottom: "1px solid #F6F4F3", transition: "background 0.12s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#FAFAF9")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <td style={{ padding: "10px 20px" }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1a1a2e" }}>{ind.libelle}</div>
                            <div style={{ fontSize: 10.5, color: "#9aa5b4" }}>{ind.unite}</div>
                          </td>
                          {cols.map((c: any) => {
                            const cell = getCell(c.id, ind.code);
                            const v = cell?.valeur;
                            const estMax = maxVal !== null && v === maxVal;
                            const couleur = v == null ? "#C5BFBB" : estMax ? (teinte === "rouge" ? "#dc2626" : "#188038") : "#1a1a2e";
                            return (
                              <td key={c.id} style={{ padding: "10px 20px", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const }}>
                                <span style={{ fontSize: 13, fontWeight: estMax ? 700 : 600, color: couleur }}>{fmt(v, ind.unite)}</span>
                                {cell?.annee && <span style={{ display: "block", fontSize: 9.5, color: "#C5BFBB" }}>{cell.annee}</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pied de dossier */}
        <div style={{ marginTop: 56, paddingTop: 18, borderTop: "1px solid #E8E5E2", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const }}>
          <p style={{ fontSize: 11, color: "#9aa5b4" }}>
            Dossier bilatéral Sénégal — {pays.nom} · généré le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} · Plateforme APIX
          </p>
          <p style={{ fontSize: 11, color: "#C5BFBB" }}>Sources : APIX, CNUCED, données de commerce international</p>
        </div>
      </div>
    </main>
  );
}
