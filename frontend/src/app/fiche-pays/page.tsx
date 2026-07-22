"use client";

// Fiche Pays — page complète au format du rapport d'analyse : bandeau
// exécutif avec les deux sélecteurs de pays intégrés (on change les pays
// sans quitter la page), indicateurs comparés, contexte relationnel et
// échanges bilatéraux. Remplace l'ancienne fiche en modal.

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2, ChevronLeft, FileText, Landmark, Scale } from "lucide-react";
import { SkeletonKPIs, SkeletonRows } from "@/components/shared/Skeleton";
import AccordVueModal from "@/components/shared/AccordVueModal";
import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import { fmtUnite as fmt, fmtUSD } from "@/lib/format";
import { drapeauEmoji } from "@/lib/drapeaux";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const BLEU = "#004f91", ORANGE = "#ca631f", ENCRE = "#101a2e";
const COULEURS = [BLEU, ORANGE];
const TITRE_SEC: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: BLEU, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 14px" };

type Pays = { id: number; nom: string; code_iso3: string; continent: string; region_geo: string | null };
type Indicateur = { code: string; libelle: string; unite: string; categorie: string };

// La PLUS GRANDE valeur est colorée : vert (favorable) ou rouge (importations)
const COULEUR_MAX: Record<string, "vert" | "rouge"> = {
  population: "vert", superficie: "vert",
  exportations_marchandises: "vert", exportations_services: "vert",
  importations_marchandises: "rouge", importations_services: "rouge",
  __ide_entrant: "vert", __ide_sortant: "vert",
};
function couleurMaxPour(code: string, categorie?: string): "vert" | "rouge" | null {
  if (code in COULEUR_MAX) return COULEUR_MAX[code];
  if (categorie === "Économie") return "vert";
  return null;
}

const CONT_ORDER = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];

function Drapeau({ iso, nom, taille = 17 }: { iso?: string | null; nom: string; taille?: number }) {
  if (!iso) return null;
  const emoji = drapeauEmoji(iso);
  if (emoji) return <span title={nom} style={{ fontSize: taille, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`} alt="" title={nom}
    style={{ width: taille * 1.25, height: taille * 0.9, objectFit: "cover", borderRadius: 2.5, boxShadow: "0 0 0 1px rgba(15,40,80,0.14)", flexShrink: 0 }} />;
}

// Sélecteur de pays du bandeau (verre dépoli sur fond sombre)
function SelectPays({ valeur, pays, exclure, onChange }: {
  valeur: number | null; pays: Pays[]; exclure: number | null; onChange: (id: number) => void;
}) {
  const parContinent = useMemo(() => {
    const g: Record<string, Pays[]> = {};
    pays.forEach(p => { (g[p.continent || "Autre"] ||= []).push(p); });
    Object.values(g).forEach(l => l.sort((a, b) => a.nom.localeCompare(b.nom, "fr")));
    return g;
  }, [pays]);
  return (
    <select value={valeur ?? ""} onChange={e => onChange(Number(e.target.value))}
      style={{ appearance: "none", padding: "8px 34px 8px 16px", borderRadius: 999, cursor: "pointer",
        background: `rgba(255,255,255,0.12) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23ffffff' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 14px center`,
        border: "1px solid rgba(255,255,255,0.28)", color: "#fff", fontSize: 13, fontWeight: 700,
        fontFamily: "var(--font-google-sans)", outline: "none", maxWidth: 240, textOverflow: "ellipsis" }}>
      {[...Object.keys(parContinent)].sort((a, b) => {
        const ia = CONT_ORDER.indexOf(a), ib = CONT_ORDER.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b, "fr");
        if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib;
      }).map(cont => (
        <optgroup key={cont} label={cont} style={{ color: "#1a1a2e" }}>
          {parContinent[cont].map(p => (
            <option key={p.id} value={p.id} disabled={p.id === exclure} style={{ color: "#1a1a2e" }}>{p.nom}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function ContenuFichePays() {
  const params = useSearchParams();
  const [pays, setPays] = useState<Pays[]>([]);
  const [ids, setIds] = useState<[number, number] | null>(null);
  const [data, setData] = useState<any>(null);
  const [ideFlux, setIdeFlux] = useState<any>(null);
  const [bilat, setBilat] = useState<any>(null);
  const [entSiege, setEntSiege] = useState<any>(null);
  const [accordOuvert, setAccordOuvert] = useState<any>(null);
  const [entOuverte, setEntOuverte] = useState<any>(null);

  const senId = useMemo(() => pays.find(p => p.code_iso3 === "SEN")?.id ?? null, [pays]);

  // Liste des pays puis sélection initiale : URL ?pays=a,b sinon Sénégal × 1er pays
  useEffect(() => {
    fetch(`${API}/statistiques/pays`).then(r => r.json()).then(setPays).catch(() => {});
  }, []);
  useEffect(() => {
    if (!pays.length || ids) return;
    const brut = (params.get("pays") || "").split(",").map(Number).filter(n => pays.some(p => p.id === n));
    if (brut.length >= 2 && brut[0] !== brut[1]) { setIds([brut[0], brut[1]]); return; }
    const sen = pays.find(p => p.code_iso3 === "SEN")?.id ?? pays[0].id;
    const autre = brut.length === 1 && brut[0] !== sen ? brut[0] : (pays.find(p => p.id !== sen)?.id ?? sen);
    setIds([sen, autre]);
  }, [pays, ids, params]);

  // Données de la fiche — rechargées à chaque changement de sélection
  useEffect(() => {
    if (!ids) return;
    window.history.replaceState(null, "", `/fiche-pays?pays=${ids.join(",")}`);
    setData(null); setBilat(null); setEntSiege(null); setIdeFlux(null);
    fetch(`${API}/statistiques/comparaison?pays=${ids.join(",")}`).then(r => r.json()).then(setData).catch(() => {});
    fetch(`${API}/statistiques/ide_flux?pays=${ids.join(",")}`).then(r => r.json()).then(setIdeFlux).catch(() => setIdeFlux({}));
    fetch(`${API}/statistiques/commerce/bilateral?pays_a=${ids[0]}&pays_b=${ids[1]}`).then(r => r.json()).then(setBilat).catch(() => setBilat(null));
    const autre = senId !== null && ids.includes(senId) ? ids.find(i => i !== senId) : null;
    if (autre != null) {
      fetch(`${API}/statistiques/entreprises-siege?pays_id=${autre}`).then(r => r.json()).then(setEntSiege).catch(() => setEntSiege(null));
    }
  }, [ids, senId]);

  const ouvrirEntreprise = (id: number) => {
    fetch(`${API}/entreprises/${id}`).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setEntOuverte).catch(() => {});
  };

  const cols = data?.pays || [];
  const inds: Indicateur[] = [
    ...(data?.indicateurs || []),
    { code: "__ide_entrant", libelle: "Flux d'IDE entrants", unite: "USD", categorie: "Investissements directs étrangers" },
    { code: "__ide_sortant", libelle: "Flux d'IDE sortants", unite: "USD", categorie: "Investissements directs étrangers" },
  ];
  const cats: string[] = [];
  const parCat: Record<string, Indicateur[]> = {};
  inds.forEach(ind => { const c = ind.categorie || "Autres"; if (!parCat[c]) { parCat[c] = []; cats.push(c); } parCat[c].push(ind); });
  const getCell = (cid: number, code: string): { valeur: number | null; annee?: number } | null => {
    if (code === "__ide_entrant") return ideFlux?.[String(cid)]?.entrant || null;
    if (code === "__ide_sortant") return ideFlux?.[String(cid)]?.sortant || null;
    return data?.valeurs?.[String(cid)]?.[code] || null;
  };

  const nomDe = (id: number | null) => pays.find(p => p.id === id)?.nom ?? "";
  const autreId = senId !== null && ids?.includes(senId) ? ids.find(i => i !== senId) ?? null : null;
  const grps = bilat?.groupements_communs || [];
  const accs = bilat?.accords || [];
  const ents = (autreId !== null && entSiege?.entreprises) || [];
  const totalBilat = (bilat?.a_vers_b || 0) + (bilat?.b_vers_a || 0);
  const periodeBilat = bilat?.annee_min ? `${bilat.annee_min}–${bilat.annee_max}` : "";

  const kpis = [
    { l: "Appartenances communes", txt: bilat ? String(grps.length) : "—", note: "organisations et groupements" },
    { l: "Accords signés", txt: bilat ? String(accs.length) : "—", note: "entre les deux pays" },
    { l: "Entreprises installées", txt: entSiege ? String(entSiege.total ?? ents.length) : autreId === null ? "—" : "…",
      note: autreId !== null ? `siège ${nomDe(autreId)} · au Sénégal` : "réservé aux fiches incluant le Sénégal" },
    { l: "Échanges bilatéraux", txt: bilat && totalBilat > 0 ? fmtUSD(totalBilat) : "—", note: periodeBilat ? `cumul ${periodeBilat}` : "cumul des flux connus" },
  ];

  const Chip = ({ label, suffixe, title, onClick }: { label: string; suffixe?: string | null; title?: string; onClick?: () => void }) => (
    <span title={title || label} onClick={onClick} role={onClick ? "button" : undefined}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#4a5568", background: "#EEF1F6", border: "1px solid #E2E6EC", padding: "4px 11px", borderRadius: 999, cursor: onClick ? "pointer" : "default", transition: "background 0.15s, border-color 0.15s, color 0.15s" }}
      onMouseEnter={ev => { if (onClick) { ev.currentTarget.style.background = "rgba(0,79,145,0.07)"; ev.currentTarget.style.borderColor = "rgba(0,79,145,0.25)"; ev.currentTarget.style.color = BLEU; } }}
      onMouseLeave={ev => { if (onClick) { ev.currentTarget.style.background = "#EEF1F6"; ev.currentTarget.style.borderColor = "#E2E6EC"; ev.currentTarget.style.color = "#4a5568"; } }}>
      {label}{suffixe ? <span style={{ color: "#9aa5b4", fontWeight: 500 }}>· {suffixe}</span> : null}
    </span>
  );
  const BlocContexte = ({ Icone, titre, count, children }: { Icone: any; titre: string; count: number; children: React.ReactNode }) => (
    <div className="ds-carte" style={{ padding: "18px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icone size={13} style={{ color: BLEU, flexShrink: 0 }} />
        <span style={{ ...TITRE_SEC, margin: 0 }}>{titre}</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: BLEU, background: "rgba(0,79,145,0.10)", padding: "1px 8px", borderRadius: 999 }}>{count}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{children}</div>
    </div>
  );

  const a = cols[0], b = cols[1];

  return (
    <div style={{ fontFamily: "var(--font-google-sans)", background: "var(--ds-fond, #F7F6F5)", minHeight: "100vh" }}>
      {/* ── Bandeau exécutif : titre + sélecteurs de pays ── */}
      <div style={{ background: "linear-gradient(155deg,#002a52 0%,#003a6e 35%,#004f91 70%,#1a6ab0 100%)", color: "#fff", padding: "34px 40px 88px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", margin: "0 0 10px" }}>
                Rapport d&apos;analyse · Fiche Pays
              </p>
              <h1 style={{ fontSize: "1.9rem", fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {a && b ? (
                  <>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><Drapeau iso={a.code_iso2} nom={a.nom} taille={24} />{a.nom}</span>
                    <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>×</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><Drapeau iso={b.code_iso2} nom={b.nom} taille={24} />{b.nom}</span>
                  </>
                ) : (ids ? `${nomDe(ids[0])} × ${nomDe(ids[1])}` : "Fiche Pays")}
              </h1>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: "10px 0 0", fontWeight: 500 }}>
                Analyse comparative · Indicateurs macroéconomiques · Échanges bilatéraux
              </p>
              {/* Sélecteurs : changer les deux pays sans quitter la page */}
              {ids && pays.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                  {[0, 1].map(pos => (
                    <span key={pos} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: pos === 0 ? "#7db4e8" : "#f0a36b", flexShrink: 0 }} />
                      <SelectPays valeur={ids[pos]} pays={pays} exclure={ids[1 - pos]}
                        onChange={id => setIds(prev => {
                          if (!prev) return prev;
                          const n: [number, number] = [...prev] as [number, number];
                          n[pos] = id; return n;
                        })} />
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Link href="/" className="no-print"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "9px 18px 9px 12px", borderRadius: 999, background: "#fff", color: BLEU, fontSize: 12.5, fontWeight: 800, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={16} /> Accueil
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 40px 70px" }}>
        {/* ── KPIs relationnels chevauchant le bandeau ── */}
        {!ids ? (
          <div style={{ marginTop: -52 }}><SkeletonKPIs n={4} /></div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginTop: -52 }}>
            {kpis.map(k => (
              <div key={k.l} className="ds-carte" style={{ padding: "18px 20px", boxShadow: "0 10px 30px rgba(0,30,70,0.13)" }}>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: BLEU, textTransform: "uppercase", margin: "0 0 10px" }}>{k.l}</p>
                <p className="ds-donnee" style={{ fontSize: "1.65rem", fontWeight: 800, color: ENCRE, margin: 0, lineHeight: 1.1, whiteSpace: "nowrap" }}>{k.txt}</p>
                <div style={{ marginTop: 8, minHeight: 15 }}>
                  <span style={{ fontSize: 10, color: "#9aa5b4" }}>{k.note}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Contexte relationnel ── */}
        {(grps.length > 0 || accs.length > 0 || ents.length > 0) && (
          <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
            {grps.length > 0 && (
              <BlocContexte Icone={Landmark} titre="Appartenances communes" count={grps.length}>
                {grps.map((g: any) => <Chip key={g.code} label={g.code || g.nom} title={g.nom} />)}
              </BlocContexte>
            )}
            {accs.length > 0 && (
              <BlocContexte Icone={FileText} titre={accs.length > 1 ? "Accords signés" : "Accord signé"} count={accs.length}>
                {accs.map((ac: any, i: number) => (
                  <Chip key={i} label={ac.titre} suffixe={ac.date_signature ? ac.date_signature.slice(0, 4) : null} title={ac.reference || ac.titre}
                    onClick={ac.id ? () => setAccordOuvert(ac) : undefined} />
                ))}
              </BlocContexte>
            )}
            {ents.length > 0 && (
              <BlocContexte Icone={Building2} titre={`Entreprises installées au Sénégal · siège ${nomDe(autreId)}`} count={entSiege.total}>
                {ents.map((e: any) => (
                  <Chip key={e.id} label={e.nom} suffixe={e.region}
                    title={[e.nom, e.forme_juridique, e.region ? `Région : ${e.region}` : null, e.secteurs?.length ? e.secteurs.join(", ") : null].filter(Boolean).join(" · ")}
                    onClick={() => ouvrirEntreprise(e.id)} />
                ))}
              </BlocContexte>
            )}
          </div>
        )}

        {/* ── Indicateurs comparés ── */}
        <div className="ds-carte" style={{ marginTop: 18, padding: "20px 24px" }}>
          <p style={TITRE_SEC}>Indicateurs comparés</p>
          {!data ? (
            <SkeletonRows n={10} h={34} />
          ) : (
            <table className="charge-in" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "0 12px 10px", textAlign: "left", fontSize: 9.5, fontWeight: 800, color: "#6b7684", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "2px solid #E6E9EF" }}>Indicateur</th>
                  {cols.map((c: any, i: number) => (
                    <th key={c.id} style={{ padding: "0 12px 10px", textAlign: "right", borderBottom: "2px solid #E6E9EF" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 800, color: COULEURS[i % 2] }}>
                        <Drapeau iso={c.code_iso2} nom={c.nom} taille={15} />{c.nom}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cats.map(cat => (
                  <Fragment key={cat}>
                    <tr>
                      <td colSpan={cols.length + 1} style={{ padding: "20px 12px 8px", ...TITRE_SEC, display: "table-cell", margin: 0 } as any}>{cat}</td>
                    </tr>
                    {parCat[cat].map((ind, ri) => {
                      const teinte = couleurMaxPour(ind.code, ind.categorie);
                      let maxVal: number | null = null;
                      if (teinte && cols.length >= 2) {
                        const vals = cols.map((c: any) => getCell(c.id, ind.code)?.valeur).filter((x: any) => x !== null && x !== undefined) as number[];
                        if (vals.length >= 2 && Math.max(...vals) !== Math.min(...vals)) maxVal = Math.max(...vals);
                      }
                      return (
                        <tr key={ind.code} style={{ borderBottom: "1px solid #F3F5F8", background: ri % 2 ? "rgba(15,40,80,0.018)" : "transparent" }}>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ fontSize: 12.5, fontWeight: 650, color: ENCRE }}>{ind.libelle}</div>
                            <div style={{ fontSize: 10.5, color: "#9aa5b4" }}>{ind.unite}</div>
                          </td>
                          {cols.map((c: any) => {
                            const cell = getCell(c.id, ind.code);
                            const v = cell?.valeur;
                            const estMax = maxVal !== null && v === maxVal;
                            const couleur = v === null || v === undefined ? "#C5BFBB"
                              : estMax ? (teinte === "rouge" ? "#dc2626" : "#188038")
                              : ENCRE;
                            return (
                              <td key={c.id} className="ds-donnee" style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                <span style={{ fontSize: 13, fontWeight: estMax ? 800 : 650, color: couleur }}>{fmt(v, ind.unite)}</span>
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
          )}
        </div>

        {/* ── Échanges bilatéraux ── */}
        {cols.length === 2 && bilat && (bilat.a_vers_b > 0 || bilat.b_vers_a > 0) && (() => {
          const ab = bilat.a_vers_b || 0, ba = bilat.b_vers_a || 0;
          const diff = ab - ba;
          const gagnant = diff >= 0 ? a : b, perdant = diff >= 0 ? b : a;
          const BlocDir = ({ de, vers, col, val, res, dep }: any) => {
            const maxR = res && res.length ? res[0].valeur : 1;
            const hasRes = res && res.length > 0;
            return (
              <div className="ds-carte" style={{ overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "15px 20px", borderBottom: hasRes ? "1px solid #F3F5F8" : "none" }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: ENCRE }}>
                      <span style={{ fontWeight: 800, color: col }}>{de}</span>
                      <ArrowRight size={13} style={{ color: "#c5bfbb", flexShrink: 0 }} />
                      <span>{vers}</span>
                    </span>
                    {dep != null && dep > 0 && <span style={{ fontSize: 11, color: "#9aa5b4", marginTop: 3, display: "block" }}>soit <strong style={{ color: "#6b7684" }}>{(dep * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</strong> des importations de {vers}</span>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="ds-donnee" style={{ fontSize: 15, fontWeight: 800, color: col, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{fmtUSD(val)}</div>
                    <div style={{ fontSize: 8.5, fontWeight: 700, color: "#c5bfbb", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>Total exporté</div>
                  </div>
                </div>
                {hasRes && (
                  <div style={{ padding: "14px 20px", display: "grid", gap: 12 }}>
                    {res.map((r: any) => {
                      const pct = val > 0 ? r.valeur / val * 100 : 0;
                      return (
                        <div key={r.ressource}>
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 5 }}>
                            <span style={{ fontSize: 11.5, color: "#4a5568", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} title={r.ressource}>{r.ressource}</span>
                            <span className="ds-donnee" style={{ fontSize: 11.5, fontWeight: 700, color: "#2d3540", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flexShrink: 0 }}>{fmtUSD(r.valeur)} <span style={{ color: "#b0aaa4", fontWeight: 600 }}>· {pct.toFixed(0)} %</span></span>
                          </div>
                          <div style={{ height: 7, background: "#EEF1F6", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.max(4, Math.sqrt(r.valeur / maxR) * 100)}%`, background: col, borderRadius: 99 }} />
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
            <div style={{ marginTop: 18 }}>
              <p style={TITRE_SEC}>Échanges bilatéraux{periodeBilat ? <span style={{ color: "#9aa5b4", letterSpacing: "0.06em" }}> · {periodeBilat}</span> : ""}</p>
              <div style={{ display: "grid", gap: 12 }}>
                <BlocDir de={a.nom} vers={b.nom} col={BLEU} val={ab} res={bilat.a_vers_b_ressources} dep={bilat.a_vers_b_dependance} />
                <BlocDir de={b.nom} vers={a.nom} col={ORANGE} val={ba} res={bilat.b_vers_a_ressources} dep={bilat.b_vers_a_dependance} />
              </div>
              <div className="ds-carte" style={{ marginTop: 12, padding: "16px 20px", background: "linear-gradient(180deg,rgba(0,79,145,0.06),rgba(0,79,145,0.02))", border: "1px solid rgba(0,79,145,0.16)", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(0,79,145,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Scale size={19} color={BLEU} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ ...TITRE_SEC, margin: "0 0 3px", fontSize: 9.5 }}>Balance commerciale</div>
                  <div style={{ fontSize: 12.5, color: "#4a5568", lineHeight: 1.45 }}>
                    {diff === 0
                      ? <>Échanges <strong style={{ color: ENCRE }}>équilibrés</strong> entre {a.nom} et {b.nom}.</>
                      : <>Excédentaire en faveur de <strong style={{ color: diff >= 0 ? BLEU : ORANGE }}>{gagnant.nom}</strong>, déficitaire pour {perdant.nom}.</>}
                  </div>
                </div>
                {diff !== 0 && (
                  <span className="ds-donnee" style={{ fontSize: 17, fontWeight: 800, color: diff >= 0 ? BLEU : ORANGE, fontVariantNumeric: "tabular-nums", flexShrink: 0, whiteSpace: "nowrap" }}>
                    +{fmtUSD(Math.abs(diff))}
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Pied méthodologique ── */}
        <div style={{ marginTop: 22, padding: "14px 4px 0", borderTop: "1px solid #E2E6EC", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <p style={{ fontSize: 10.5, color: "#8a93a3", margin: 0, lineHeight: 1.6, maxWidth: 760 }}>
            Dernière année disponible par indicateur · la valeur la plus élevée est en <span style={{ color: "#188038", fontWeight: 700 }}>vert</span> (ou en <span style={{ color: "#dc2626", fontWeight: 700 }}>rouge</span> pour les importations).
          </p>
          <p style={{ fontSize: 10.5, color: "#8a93a3", margin: 0, whiteSpace: "nowrap" }}>
            Mise à jour le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Détails ouverts depuis les chips */}
      {accordOuvert && <AccordVueModal accord={accordOuvert} onClose={() => setAccordOuvert(null)} zIndex={800} />}
      {entOuverte && <EntreprisePublicModal entreprise={entOuverte} onClose={() => setEntOuverte(null)} zIndex={800} />}
    </div>
  );
}

export default function FichePaysPage() {
  return (
    <Suspense fallback={null}>
      <ContenuFichePays />
    </Suspense>
  );
}
