"use client";

// Tableau de bord exécutif — condense l'ensemble de la plateforme en sections
// résumées (IDE, Flux bilatéraux, Commerce extérieur, Indicateurs socio-
// économiques, Entreprises installées, Entreprises/prospects). Deux onglets :
// « Visualisation de données » (KPIs + graphes) et « Tableaux analytiques »
// (toutes les tables détaillées). Style aligné sur le rapport commerce.

import { useEffect, useMemo, useState } from "react";
import { BarreTitreSegment } from "@/components/shared/BarreTitre";
import NavActions from "@/components/layout/NavActions";
import GrapheMultiPays, { type SerieGraphe } from "@/components/shared/GrapheMultiPays";
import { AnalyticTable } from "@/components/dashboard/DataTable";
import { PALETTE_COMPARAISON } from "@/lib/couleurs";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const BLEU = "#004f91", ORANGE = "#ca631f", ENCRE = "#101a2e";

// ── Formatage ─────────────────────────────────────────────────────────────────
const nf = (v: number | null | undefined, d = 0) => (v != null && isFinite(v) ? v.toLocaleString("fr-FR", { maximumFractionDigits: d }) : "—");
const fmtMd = (fcfa?: number | null) => (fcfa == null ? "—" : `${nf(fcfa / 1e9, 1)} Md`);
function fmtUSD(v?: number | null) {
  if (v == null || !isFinite(v)) return "—";
  if (Math.abs(v) >= 1e9) return `${nf(v / 1e9, 1)} Md$`;
  if (Math.abs(v) >= 1e6) return `${nf(v / 1e6, 0)} M$`;
  if (Math.abs(v) >= 1e3) return `${nf(v / 1e3, 0)} k$`;
  return `${nf(v)} $`;
}
// Montants IDE (CNUCED) déjà exprimés en millions USD
function fmtMUSD(v?: number | null) {
  if (v == null || !isFinite(v)) return "—";
  if (Math.abs(v) >= 1000) return `${nf(v / 1000, 1)} Md$`;
  return `${nf(v, 0)} M$`;
}
const getJSON = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// Drapeau emoji depuis un code ISO2 ; 🌐 si absent / invalide (ex. « Bunkers »)
const drapeau = (iso2?: string | null) => {
  if (!iso2 || !/^[A-Za-z]{2}$/.test(iso2)) return "🌐";
  const cc = iso2.toUpperCase();
  return String.fromCodePoint(0x1f1e6 + cc.charCodeAt(0) - 65, 0x1f1e6 + cc.charCodeAt(1) - 65);
};

// ── Petits blocs de présentation ──────────────────────────────────────────────
const TITRE_SEC: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: BLEU, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 14px" };

function Delta({ v, surFonce = false }: { v: number | null; surFonce?: boolean }) {
  if (v == null || !isFinite(v)) return null;
  const pos = v > 0, neg = v < 0;
  const col = surFonce ? (pos ? "#7be3a2" : neg ? "#ffb3ab" : "rgba(255,255,255,0.7)") : (pos ? "#188038" : neg ? "#dc2626" : "#9aa5b4");
  return (
    <span style={{ fontSize: 11.5, fontWeight: 800, color: col, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {pos ? "▲" : neg ? "▼" : "="}&nbsp;{nf(Math.abs(v), 1)} %
    </span>
  );
}

function Kpi({ label, valeur, tag, delta, rouge, sousLabel, refAnnee, texte }: { label: string; valeur: string; tag?: string; delta?: number | null; rouge?: boolean; sousLabel?: string; refAnnee?: number | null; texte?: boolean }) {
  // Valeur textuelle longue (nom de ressource, de pays…) : police réduite,
  // retour à la ligne sur 2 lignes plutôt qu'un texte tronqué.
  const styleValeur: React.CSSProperties = texte
    ? { fontSize: "1.15rem", fontWeight: 800, color: rouge ? "#dc2626" : ENCRE, margin: 0, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }
    : { fontSize: "1.65rem", fontWeight: 800, color: rouge ? "#dc2626" : ENCRE, margin: 0, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  return (
    <div className="ds-carte" style={{ padding: "18px 20px", boxShadow: "var(--ombre-2)", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: BLEU, textTransform: "uppercase", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</p>
        {tag && <span style={{ fontSize: 8.5, fontWeight: 700, color: "#8a93a3", background: "#EEF1F6", padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0 }}>{tag}</span>}
      </div>
      <p className="ds-donnee" style={styleValeur}>{valeur}</p>
      <div style={{ marginTop: 8, minHeight: 15, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {sousLabel && <span style={{ fontSize: 10.5, color: "#9aa5b4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sousLabel}</span>}
        {delta != null && <Delta v={delta} />}
        {refAnnee != null && <span style={{ fontSize: 10.5, color: "#9aa5b4", whiteSpace: "nowrap" }}>par rapport à {refAnnee}</span>}
      </div>
    </div>
  );
}

// En-tête de section : pastille + titre (+ contrôle) puis filet fin sur la même ligne
function SectionHead({ n, titre, extra }: { n: number; titre: string; extra?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(0,79,145,0.09)", color: BLEU, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{String(n).padStart(2, "0")}</span>
      <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: ENCRE, letterSpacing: "-0.01em", whiteSpace: "nowrap", flexShrink: 0 }}>{titre}</h2>
      {extra}
      <div style={{ flex: 1, height: 1, background: "rgba(16,26,46,0.12)" }} />
    </div>
  );
}

// Bascule segmentée compacte (ex. Exportations / Importations)
function Segment<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "inline-flex", background: "#EEF1F6", borderRadius: 999, padding: 3, gap: 2, flexShrink: 0 }}>
      {options.map((o) => {
        const actif = o.v === value;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            border: "none", cursor: "pointer", padding: "5px 14px", borderRadius: 999,
            fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
            background: actif ? "#fff" : "transparent", color: actif ? BLEU : "#6b7684",
            boxShadow: actif ? "var(--ombre-1)" : "none", transition: "color .15s, background .15s",
          }}>{o.l}</button>
        );
      })}
    </div>
  );
}

// Barres horizontales top-N pour [{label, valeur}]
function MiniBarres({ data, couleur = BLEU, fmt = (v: number) => nf(v), max = 6 }: { data: { label: string; valeur: number }[]; couleur?: string; fmt?: (v: number) => string; max?: number }) {
  const rows = (data || []).slice(0, max);
  const mx = Math.max(1, ...rows.map((r) => r.valeur || 0));
  if (rows.length === 0) return <p style={{ color: "#9aa5b4", fontSize: 13, textAlign: "center", padding: "30px 0" }}>Aucune donnée.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 12.5, color: "#2c3646", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            <span className="ds-donnee" style={{ fontSize: 12.5, fontWeight: 700, color: ENCRE, flexShrink: 0 }}>{fmt(r.valeur)}</span>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: "#EEF1F6", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.max(3, (r.valeur / mx) * 100)}%`, borderRadius: 999, background: couleur }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Tableau compact top-N avec rang
function TopTable({ rows, couleur = BLEU, fmt = (v: number) => nf(v), colNom = "Libellé", colVal = "Valeur", max = 8, drapeaux = false }: { rows: { nom: string; valeur: number; iso2?: string | null }[]; couleur?: string; fmt?: (v: number) => string; colNom?: string; colVal?: string; max?: number; drapeaux?: boolean }) {
  const data = (rows || []).slice(0, max);
  if (data.length === 0) return <p style={{ color: "#9aa5b4", fontSize: 13, textAlign: "center", padding: "30px 0" }}>Aucune donnée.</p>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
      <thead><tr>
        <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 9.5, fontWeight: 800, color: "#6b7684", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "2px solid #E6E9EF", width: 30 }}>#</th>
        <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 9.5, fontWeight: 800, color: "#6b7684", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "2px solid #E6E9EF" }}>{colNom}</th>
        <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 9.5, fontWeight: 800, color: "#6b7684", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "2px solid #E6E9EF" }}>{colVal}</th>
      </tr></thead>
      <tbody>
        {data.map((r, i) => (
          <tr key={r.nom + i} style={{ borderBottom: "1px solid #F3F5F8", background: i % 2 ? "rgba(15,40,80,0.018)" : "transparent" }}>
            <td style={{ padding: "6px 8px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 999, background: i < 3 ? couleur : "#EEF1F6", color: i < 3 ? "#fff" : "#5c6675", fontSize: 10, fontWeight: 800 }}>{i + 1}</span>
            </td>
            <td style={{ padding: "6px 8px", fontWeight: 650, color: ENCRE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
              {drapeaux && <span style={{ marginRight: 7, fontSize: 14 }}>{drapeau(r.iso2)}</span>}{r.nom}
            </td>
            <td className="ds-donnee" style={{ padding: "6px 8px", textAlign: "right", fontWeight: 750, color: ENCRE, whiteSpace: "nowrap" }}>{fmt(r.valeur)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Matrice de valeurs partenaire × ressource (intensité = valeur)
function MatriceRessources({ ressources, partenaires, fmt = (v: number) => nf(v), colPartenaire = "Partenaire" }: { ressources: string[]; partenaires: { nom: string; valeurs: number[] }[]; fmt?: (v: number) => string; colPartenaire?: string }) {
  if (!partenaires.length || !ressources.length) return <p style={{ color: "#9aa5b4", fontSize: 13, textAlign: "center", padding: "30px 0" }}>Aucune donnée.</p>;
  const max = Math.max(1, ...partenaires.flatMap((p) => p.valeurs));
  const thRes: React.CSSProperties = { padding: "6px 8px", textAlign: "center", fontSize: 9.5, fontWeight: 800, color: "#6b7684", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #E6E9EF", verticalAlign: "bottom", minWidth: 74, maxWidth: 110, lineHeight: 1.15 };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
        <thead><tr>
          <th style={{ padding: "6px 10px 6px 4px", textAlign: "left", fontSize: 9.5, fontWeight: 800, color: "#6b7684", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid #E6E9EF", position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>{colPartenaire}</th>
          {ressources.map((r) => <th key={r} style={thRes}>{r}</th>)}
        </tr></thead>
        <tbody>
          {partenaires.map((p) => (
            <tr key={p.nom}>
              <td style={{ padding: "7px 10px 7px 4px", fontWeight: 700, color: ENCRE, whiteSpace: "nowrap", position: "sticky", left: 0, background: "#fff", borderBottom: "1px solid #F3F5F8" }}>{p.nom}</td>
              {p.valeurs.map((v, i) => {
                const t = v > 0 ? v / max : 0;
                return (
                  <td key={i} title={v > 0 ? `${p.nom} · ${ressources[i]} : ${fmt(v)}` : undefined}
                    style={{ textAlign: "center", padding: "7px 8px", fontSize: 11, fontWeight: 650, whiteSpace: "nowrap", borderBottom: "1px solid #F3F5F8", background: v > 0 ? `rgba(0,79,145,${(0.06 + t * 0.52).toFixed(3)})` : "transparent", color: t > 0.5 ? "#fff" : "#5c6675" }}>
                    {v > 0 ? fmt(v) : "·"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Carte({ titre, tag, children, style }: { titre?: string; tag?: string | null; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="ds-carte" style={{ padding: "22px 24px", minWidth: 0, ...style }}>
      {titre && (
        <p style={{ ...TITRE_SEC, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{titre}</span>
          {tag && <span style={{ fontSize: 9, fontWeight: 700, color: "#8a93a3", background: "#EEF1F6", padding: "2px 8px", borderRadius: 5, letterSpacing: "0.04em", textTransform: "none", fontVariantNumeric: "tabular-nums" }}>{tag}</span>}
        </p>
      )}
      {children}
    </div>
  );
}

const serie = (nom: string, couleur: string, rows: { annee: number; valeur: number | null }[]): SerieGraphe => ({ nom, couleur, data: rows });

// ── Tables analytiques regroupées (onglet Tableaux) ───────────────────────────
const GROUPES_TABLES: { titre: string; tables: { id: string; titre: string; description: string }[] }[] = [
  {
    titre: "Entreprises installées — territoire & secteurs",
    tables: [
      { id: "entreprises-par-region", titre: "Entreprises par région", description: "Répartition avec % du total et classement" },
      { id: "top-departements", titre: "Top départements", description: "Concentration d'entreprises, % et rang" },
      { id: "entreprises-par-arrondissement", titre: "Entreprises par arrondissement", description: "Top 20 arrondissements avec % et rang" },
      { id: "evolution-creations", titre: "Évolution des créations par année", description: "Créations, cumul, variation et évolution %" },
      { id: "anciennete-entreprises", titre: "Ancienneté des entreprises par région", description: "Âge moyen, min, max et tranches par région" },
      { id: "avant-apres-pivot", titre: "Entreprises par période de création", description: "Avant 2010 / 2010–2019 / depuis 2020 par région" },
      { id: "entreprises-multi-secteurs", titre: "Entreprises multi-secteurs", description: "Entreprises déclarées dans plusieurs secteurs" },
      { id: "secteurs-par-region", titre: "Secteurs dominants par région", description: "Top 3 secteurs dans chaque région" },
      { id: "concentration-sectorielle", titre: "Concentration sectorielle (HHI)", description: "Indice de diversification par région" },
      { id: "secteurs-investissement-classement", titre: "Secteurs où on investit le plus", description: "Classement des secteurs par nombre d'entreprises" },
      { id: "branches-classement", titre: "Branches les plus actives", description: "Rang national et rang dans le secteur" },
      { id: "activites-classement-national", titre: "Activités les plus représentées", description: "Rang national et rang dans le secteur" },
      { id: "densite-economique-departements", titre: "Densité économique par département", description: "Secteurs, branches, activités et investisseurs étrangers par dept" },
      { id: "vue-region", titre: "Vue régionale consolidée", description: "Entreprises + zones + pôles par région" },
      { id: "score-attractivite", titre: "Score d'attractivité par région", description: "Score composite : entreprises, zones, pôles" },
    ],
  },
  {
    titre: "Zones & pôles d'investissement",
    tables: [
      { id: "zones-detail", titre: "Détail des zones d'investissement", description: "Type, région, superficie, installées, éligibles" },
      { id: "taux-occupation-zones", titre: "Taux d'occupation des zones", description: "Installées vs éligibles, taux et statut" },
      { id: "densite-zones", titre: "Densité des zones d'investissement", description: "Entreprises par hectare dans chaque zone" },
      { id: "poles-detail", titre: "Détail des pôles territoriaux", description: "Pôles avec zones associées et entreprises" },
    ],
  },
  {
    titre: "Investisseurs étrangers",
    tables: [
      { id: "entreprises-par-pays", titre: "Entreprises par pays d'origine", description: "Nationalité du siège avec classement continental" },
      { id: "entreprises-par-continent", titre: "Entreprises par continent d'origine", description: "Répartition continentale des investisseurs" },
      { id: "local-vs-etranger", titre: "Entreprises locales vs étrangères", description: "Siège Sénégal vs étranger par région" },
      { id: "entreprises-etrangeres-localisation", titre: "Localisation des entreprises étrangères", description: "Région, département, arrondissement des entreprises étrangères" },
      { id: "activites-entreprises-etrangeres", titre: "Activités des entreprises étrangères", description: "Ce que les entreprises étrangères développent le plus" },
      { id: "secteurs-etrangers-par-continent", titre: "Secteurs des étrangers par continent", description: "Spécialisation sectorielle selon le continent d'origine" },
    ],
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TableauDeBordPage() {
  const [onglet, setOnglet] = useState<"viz" | "tables">("viz");

  // Données
  const [stats, setStats] = useState<any>(null);
  const [ideFlux, setIdeFlux] = useState<any[]>([]);
  const [ideStock, setIdeStock] = useState<any[]>([]);
  const [ideFluxSort, setIdeFluxSort] = useState<any[]>([]);
  const [ideStockSort, setIdeStockSort] = useState<any[]>([]);
  const [bilat, setBilat] = useState<any>(null);
  const [bilatTops, setBilatTops] = useState<any>(null);
  const [bilatBalance, setBilatBalance] = useState<any[]>([]);
  const [bilatRepart, setBilatRepart] = useState<any>(null);
  const [bilatDir, setBilatDir] = useState<"exportateur" | "importateur">("exportateur");
  const [commCtx, setCommCtx] = useState<{ id: number; amin: number; amax: number } | null>(null);
  const [comExt, setComExt] = useState<any>(null);
  const [socio, setSocio] = useState<any[]>([]);
  const [socioPays, setSocioPays] = useState<string>("Sénégal");
  const [entAnnee, setEntAnnee] = useState<{ label: string; valeur: number }[]>([]);
  const [entRegion, setEntRegion] = useState<{ label: string; valeur: number }[]>([]);
  const [entSecteur, setEntSecteur] = useState<{ label: string; valeur: number }[]>([]);
  const [prospSecteur, setProspSecteur] = useState<{ label: string; valeur: number }[]>([]);

  useEffect(() => {
    getJSON(`${API}/dashboard/stats`).then(setStats);
    getJSON(`${API}/ide/cnuced?direction=entrant&indicateur=flux`).then((d) => setIdeFlux(Array.isArray(d) ? d : []));
    getJSON(`${API}/ide/cnuced?direction=entrant&indicateur=stock`).then((d) => setIdeStock(Array.isArray(d) ? d : []));
    getJSON(`${API}/ide/cnuced?direction=sortant&indicateur=flux`).then((d) => setIdeFluxSort(Array.isArray(d) ? d : []));
    getJSON(`${API}/ide/cnuced?direction=sortant&indicateur=stock`).then((d) => setIdeStockSort(Array.isArray(d) ? d : []));
    getJSON(`${API}/bmce/apercu`).then(setComExt);
    getJSON(`${API}/dashboard/viz/entreprises-par-annee`).then((d) => setEntAnnee(Array.isArray(d) ? d : []));
    getJSON(`${API}/dashboard/viz/entreprises-par-region`).then((d) => setEntRegion(Array.isArray(d) ? d : []));
    getJSON(`${API}/dashboard/viz/entreprises-par-secteur`).then((d) => setEntSecteur(Array.isArray(d) ? d : []));
    getJSON(`${API}/dashboard/indicateur?dimension=secteurs&indicateur=ciblees`).then((d) => setProspSecteur(Array.isArray(d) ? d : []));

    // Flux bilatéraux : résoudre l'id du Sénégal puis charger la balance ;
    // KPIs/tops dépendent de la direction → effet dédié ci-dessous.
    getJSON(`${API}/statistiques/commerce/filtres`).then((f) => {
      const sen = (f?.pays || []).find((p: any) => p.code_iso3 === "SEN");
      const annees: number[] = (f?.annees || []).slice().sort((a: number, b: number) => a - b);
      if (!sen || annees.length === 0) return;
      const amax = annees[annees.length - 1], amin = Math.max(annees[0], amax - 6);
      setCommCtx({ id: sen.id, amin, amax });
      getJSON(`${API}/statistiques/commerce/balance?pays_id=${sen.id}&annee_min=${amin}&annee_max=${amax}`).then((d) => setBilatBalance(Array.isArray(d) ? d : []));
    });

    // Socio-économique : id Sénégal puis données
    getJSON(`${API}/statistiques/pays`).then((pays) => {
      const sen = (pays || []).find((p: any) => p.code_iso3 === "SEN");
      if (!sen) return;
      setSocioPays(sen.nom || "Sénégal");
      getJSON(`${API}/statistiques/donnees?pays=${sen.id}&annee_min=2005&annee_max=2030`).then((d) => setSocio(Array.isArray(d) ? d : []));
    });
  }, []);

  // Flux bilatéraux : KPIs & tops rechargés à chaque changement de direction
  useEffect(() => {
    if (!commCtx) return;
    const { id, amin, amax } = commCtx;
    const base = `pays_id=${id}&direction=${bilatDir}`;
    getJSON(`${API}/statistiques/commerce/kpis?${base}&annee_min=${amin}&annee_max=${amax}`).then(setBilat);
    getJSON(`${API}/statistiques/commerce/tops?${base}&annee_min=${amax}&annee_max=${amax}&limite=8`).then(setBilatTops);
    getJSON(`${API}/statistiques/commerce/repartition?${base}&annee_min=${amax}&annee_max=${amax}&limite=6`).then(setBilatRepart);
  }, [commCtx, bilatDir]);

  // ── Dérivés socio-économiques ──
  const socioVal = (code: string) => {
    const rows = socio.filter((r) => r.indicateur === code && r.valeur != null);
    if (!rows.length) return null;
    const last = rows.reduce((a, b) => (b.annee > a.annee ? b : a));
    return { valeur: last.valeur as number, annee: last.annee as number };
  };
  const pib = socioVal("pib"), pop = socioVal("population"), pibHab = socioVal("pib_hab"), croiss = socioVal("croissance_pib");
  const seriePib = useMemo(() => socio.filter((r) => r.indicateur === "pib" && r.valeur != null).sort((a, b) => a.annee - b.annee).map((r) => ({ annee: r.annee, valeur: r.valeur })), [socio]);

  const toSerie = (rows: any[]) => rows.slice().sort((a, b) => a.annee - b.annee).map((r) => ({ annee: r.annee as number, valeur: r.valeur as number | null }));
  const serieFluxEnt = useMemo(() => toSerie(ideFlux), [ideFlux]);
  const serieFluxSort = useMemo(() => toSerie(ideFluxSort), [ideFluxSort]);
  const serieStockEnt = useMemo(() => toSerie(ideStock), [ideStock]);
  const serieStockSort = useMemo(() => toSerie(ideStockSort), [ideStockSort]);
  const serieBalance = useMemo(() => bilatBalance.slice().sort((a, b) => a.annee - b.annee), [bilatBalance]);

  // Total (export ou import) sur la dernière année vs l'année précédente
  const bilatTotalDelta = useMemo(() => {
    const k = bilatDir === "exportateur" ? "exportations" : "importations";
    const rows = serieBalance.filter((r) => r[k] != null && r[k] > 0);
    const last = rows[rows.length - 1], prev = rows[rows.length - 2];
    const delta = last && prev && prev[k] ? ((last[k] - prev[k]) / Math.abs(prev[k])) * 100 : null;
    return { prev: prev || null, delta };
  }, [serieBalance, bilatDir]);

  // Balance = entrant − sortant, uniquement sur les années où les deux existent
  const balanceSerie = (ent: { annee: number; valeur: number | null }[], sort: { annee: number; valeur: number | null }[]) => {
    const m = new Map<number, { e?: number; s?: number }>();
    ent.forEach((r) => { if (r.valeur != null) m.set(r.annee, { ...(m.get(r.annee) || {}), e: r.valeur }); });
    sort.forEach((r) => { if (r.valeur != null) m.set(r.annee, { ...(m.get(r.annee) || {}), s: r.valeur }); });
    return [...m.entries()]
      .filter(([, o]) => o.e != null && o.s != null)
      .map(([annee, o]) => ({ annee, valeur: (o.e as number) - (o.s as number) }))
      .sort((a, b) => a.annee - b.annee);
  };
  const balanceFlux = useMemo(() => balanceSerie(serieFluxEnt, serieFluxSort), [serieFluxEnt, serieFluxSort]);
  const balanceStock = useMemo(() => balanceSerie(serieStockEnt, serieStockSort), [serieStockEnt, serieStockSort]);

  // Dernier point valide + précédent (pour la variation « par rapport à YYYY »)
  const dernierPoint = (rows: { annee: number; valeur: number | null }[]) => {
    const valid = rows.filter((r) => r.valeur != null);
    const last = valid[valid.length - 1] || null;
    const prev = valid[valid.length - 2] || null;
    const delta = last && prev && prev.valeur ? ((last.valeur! - prev.valeur!) / Math.abs(prev.valeur!)) * 100 : null;
    return { last, prev, delta };
  };
  const kFluxEnt = useMemo(() => dernierPoint(serieFluxEnt), [serieFluxEnt]);
  const kFluxSort = useMemo(() => dernierPoint(serieFluxSort), [serieFluxSort]);
  const kStockEnt = useMemo(() => dernierPoint(serieStockEnt), [serieStockEnt]);
  const kStockSort = useMemo(() => dernierPoint(serieStockSort), [serieStockSort]);

  return (
    <main style={{ minHeight: "100vh", background: "var(--ds-fond, #F6F5F3)", fontFamily: "var(--font-google-sans)" }}>
      <style>{`
        .tdb-kpis { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
        .tdb-duo  { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; align-items: stretch; }
        @media (max-width: 980px) { .tdb-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); } .tdb-duo { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .tdb-kpis { grid-template-columns: 1fr; } }
      `}</style>
      {/* ── Bandeau exécutif ── */}
      <div data-bandeau style={{ background: "linear-gradient(155deg,#002a52 0%,#003a6e 35%,#004f91 70%,#1a6ab0 100%)", color: "#fff", padding: "30px 40px 78px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 13 }}>
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", margin: 0 }}>APIX S.A — DIPE</p>
                <BarreTitreSegment options={[{ v: "viz", l: "Visualisation de données" }, { v: "tables", l: "Tableaux analytiques" }]} value={onglet} onChange={setOnglet} />
              </div>
              <h1 style={{ fontSize: "1.9rem", fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.01em" }}>Tableau de bord</h1>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: "9px 0 0", fontWeight: 500 }}>Résumé exécutif des données d&apos;investissement</p>
            </div>
            <div style={{ flexShrink: 0 }}><NavActions onDark home flouFond /></div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 40px 90px" }}>

        {onglet === "viz" ? (
          <>
            {/* ── KPIs globaux (chevauchent le bandeau) ── */}
            <div className="tdb-kpis" style={{ marginTop: -48, position: "relative", zIndex: 2 }}>
              <Kpi label="Entreprises" valeur={stats ? nf(stats.entreprises_total) : "—"} sousLabel="installées" />
              <Kpi label="Accords en vigueur" valeur={stats ? nf(stats.accords_vigueur) : "—"} sousLabel={stats ? `sur ${nf(stats.accords_total)}` : ""} />
              <Kpi label="Intentions d'investiss." valeur={stats ? fmtUSD(stats.intentions_usd) : "—"} sousLabel={stats ? `${nf(stats.intentions_total)} projets` : ""} />
              <Kpi label="Zones d'investissement" valeur={stats ? nf(stats.zones_total) : "—"} sousLabel={stats ? `${nf(stats.poles_total)} pôles` : ""} />
            </div>

            {/* ── 1. IDE ── */}
            <section style={{ marginTop: 44 }}>
              <SectionHead n={1} titre="Investissements Directs Étrangers" />
              <div className="tdb-kpis" style={{ marginBottom: 16 }}>
                <Kpi label="Flux entrant" tag={kFluxEnt.last ? String(kFluxEnt.last.annee) : undefined} valeur={fmtMUSD(kFluxEnt.last?.valeur)} delta={kFluxEnt.delta} refAnnee={kFluxEnt.prev?.annee} />
                <Kpi label="Flux sortant" tag={kFluxSort.last ? String(kFluxSort.last.annee) : undefined} valeur={fmtMUSD(kFluxSort.last?.valeur)} delta={kFluxSort.delta} refAnnee={kFluxSort.prev?.annee} />
                <Kpi label="Stock entrant" tag={kStockEnt.last ? String(kStockEnt.last.annee) : undefined} valeur={fmtMUSD(kStockEnt.last?.valeur)} delta={kStockEnt.delta} refAnnee={kStockEnt.prev?.annee} />
                <Kpi label="Stock sortant" tag={kStockSort.last ? String(kStockSort.last.annee) : undefined} valeur={fmtMUSD(kStockSort.last?.valeur)} delta={kStockSort.delta} refAnnee={kStockSort.prev?.annee} />
              </div>
              <div className="tdb-duo">
                <Carte titre="Balance des flux d'IDE">
                  {balanceFlux.length > 1 ? (
                    <GrapheMultiPays height={230} type="line" dualAxis={false} fmt={(v) => fmtMUSD(v)} series={[
                      { nom: "Flux entrant", couleur: PALETTE_COMPARAISON[0], data: serieFluxEnt, dash: "6,4" },
                      { nom: "Flux sortant", couleur: PALETTE_COMPARAISON[1], data: serieFluxSort, dash: "2,4" },
                      { nom: "Balance", couleur: PALETTE_COMPARAISON[2], data: balanceFlux },
                    ]} />
                  ) : <p style={{ color: "#9aa5b4", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Données IDE indisponibles.</p>}
                </Carte>
                <Carte titre="Balance des stocks d'IDE">
                  {balanceStock.length > 1 ? (
                    <GrapheMultiPays height={230} type="line" dualAxis={false} fmt={(v) => fmtMUSD(v)} series={[
                      { nom: "Stock entrant", couleur: PALETTE_COMPARAISON[0], data: serieStockEnt, dash: "6,4" },
                      { nom: "Stock sortant", couleur: PALETTE_COMPARAISON[1], data: serieStockSort, dash: "2,4" },
                      { nom: "Balance", couleur: PALETTE_COMPARAISON[2], data: balanceStock },
                    ]} />
                  ) : <p style={{ color: "#9aa5b4", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Données IDE indisponibles.</p>}
                </Carte>
              </div>
            </section>

            {/* ── 2. Flux bilatéraux ── */}
            <section style={{ marginTop: 40 }}>
              <SectionHead n={2} titre="Flux bilatéraux" extra={
                <Segment value={bilatDir} onChange={setBilatDir} options={[{ v: "exportateur", l: "Exportations" }, { v: "importateur", l: "Importations" }]} />
              } />
              <div className="tdb-kpis" style={{ marginBottom: 16 }}>
                <Kpi
                  label={bilatDir === "exportateur" ? "Total exporté" : "Total importé"}
                  tag={bilat?.annee_ref ? String(bilat.annee_ref) : undefined}
                  valeur={fmtUSD(bilat?.total)}
                  delta={bilatTotalDelta.delta}
                  refAnnee={bilatTotalDelta.prev?.annee}
                />
                <Kpi
                  texte
                  label={bilatDir === "exportateur" ? "1re ressource exportée" : "1re ressource importée"}
                  tag={bilat?.annee_ref ? String(bilat.annee_ref) : undefined}
                  valeur={bilat?.top_ressource?.ressource || "—"}
                  sousLabel={bilat?.top_ressource ? fmtUSD(bilat.top_ressource.valeur) : ""}
                />
                <Kpi
                  texte
                  label={bilatDir === "exportateur" ? "1er client" : "1er fournisseur"}
                  tag={bilat?.annee_ref ? String(bilat.annee_ref) : undefined}
                  valeur={bilat?.top_partenaire?.nom || "—"}
                  sousLabel={bilat?.top_partenaire ? fmtUSD(bilat.top_partenaire.valeur) : ""}
                  delta={bilat?.top_partenaire?.variation ?? null}
                  refAnnee={bilat?.top_partenaire?.annee_prec}
                />
                <Kpi
                  label={bilatDir === "exportateur" ? "Part du 1er client" : "Part du 1er fournisseur"}
                  tag={bilat?.annee_ref ? String(bilat.annee_ref) : undefined}
                  valeur={bilat?.part_top_partenaire != null ? `${nf(bilat.part_top_partenaire, 1)} %` : "—"}
                  delta={bilat?.part_top_partenaire_variation ?? null}
                  refAnnee={bilat?.annee_prec}
                />
              </div>
              {(() => {
                const exp = bilatDir === "exportateur";
                const evoKey = exp ? "exportations" : "importations";
                const serieEvo = serieBalance.map((r: any) => ({ annee: r.annee, valeur: r[evoKey] }));
                const resLabels = (bilatRepart?.ressources || []).slice(0, 7);
                const parts = (bilatRepart?.partenaires || []).map((p: any) => ({ nom: p.nom, valeurs: (p.valeurs || []).slice(0, 7) }));
                const anneeRef = bilat?.annee_ref ? String(bilat.annee_ref) : undefined;
                const evoAns = serieEvo.filter((r: any) => r.valeur != null).map((r: any) => r.annee);
                const evoTag = evoAns.length ? `${Math.min(...evoAns)}–${Math.max(...evoAns)}` : undefined;
                return (
                  <>
                    <div className="tdb-duo">
                      <Carte titre={exp ? "Évolution des exportations" : "Évolution des importations"} tag={evoTag}>
                        {serieEvo.length > 1 ? (
                          <GrapheMultiPays height={220} type="line" fmt={(v) => fmtUSD(v)} series={[serie(exp ? "Exportations" : "Importations", PALETTE_COMPARAISON[0], serieEvo)]} />
                        ) : <p style={{ color: "#9aa5b4", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Données indisponibles.</p>}
                      </Carte>
                      <Carte titre={exp ? "Poids des ressources exportées" : "Poids des ressources importées"} tag={anneeRef}>
                        <MiniBarres data={(bilatTops?.ressources || []).map((r: any) => ({ label: r.ressource, valeur: r.valeur }))} couleur={PALETTE_COMPARAISON[0]} fmt={(v) => fmtUSD(v)} max={7} />
                      </Carte>
                    </div>
                    <Carte titre={exp ? "Valeurs des exportations par destination et ressource" : "Valeurs des importations par origine et ressource"} tag={anneeRef} style={{ marginTop: 16 }}>
                      <MatriceRessources ressources={resLabels} partenaires={parts} fmt={(v) => fmtUSD(v)} colPartenaire={exp ? "Destination" : "Origine"} />
                    </Carte>
                    <div className="tdb-duo" style={{ marginTop: 16 }}>
                      <Carte titre={exp ? "Principaux clients à l'exportation" : "Principaux fournisseurs à l'importation"} tag={anneeRef}>
                        <TopTable rows={(bilatTops?.partenaires || []).map((p: any) => ({ nom: p.nom, valeur: p.valeur, iso2: p.code_iso2 }))} colNom="Pays" colVal="Valeur" fmt={(v) => fmtUSD(v)} max={7} drapeaux />
                      </Carte>
                      <Carte titre={exp ? "Valeurs des ressources exportées" : "Valeurs des ressources importées"} tag={anneeRef}>
                        <TopTable rows={(bilatTops?.ressources || []).map((r: any) => ({ nom: r.ressource, valeur: r.valeur }))} colNom="Ressource" colVal="Valeur" fmt={(v) => fmtUSD(v)} max={8} />
                      </Carte>
                    </div>
                  </>
                );
              })()}
            </section>

            {/* ── 3. Commerce extérieur ── */}
            <section style={{ marginTop: 40 }}>
              <SectionHead n={3} titre="Commerce extérieur" />
              <div className="tdb-kpis">
                <Kpi label="Exportations" tag="FAB" valeur={fmtMd(comExt?.cumul_annee?.exportations_fab)} delta={comExt?.variation_export ?? null} sousLabel="FCFA" />
                <Kpi label="Importations" tag="CAF" valeur={fmtMd(comExt?.cumul_annee?.importations_caf)} delta={comExt?.variation_import ?? null} sousLabel="FCFA" />
                <Kpi label="Balance commerciale" valeur={fmtMd(comExt?.cumul_annee?.balance)} rouge={(comExt?.cumul_annee?.balance ?? 0) < 0} sousLabel="FCFA" />
                <Kpi label="Taux de couverture" valeur={comExt?.taux_couverture != null ? `${nf(comExt.taux_couverture, 1)} %` : "—"} sousLabel="export / import" />
              </div>
            </section>

            {/* ── 4. Indicateurs socio-économiques ── */}
            <section style={{ marginTop: 40 }}>
              <SectionHead n={4} titre="Indicateurs socio-économiques" />
              <div className="tdb-kpis" style={{ marginBottom: 16 }}>
                <Kpi label="PIB" valeur={fmtUSD(pib?.valeur)} sousLabel={pib?.annee ? String(pib.annee) : ""} />
                <Kpi label="Population" valeur={pop ? nf(pop.valeur) : "—"} sousLabel="habitants" />
                <Kpi label="PIB / habitant" valeur={fmtUSD(pibHab?.valeur)} sousLabel={pibHab?.annee ? String(pibHab.annee) : ""} />
                <Kpi label="Croissance du PIB" valeur={croiss ? `${nf(croiss.valeur, 1)} %` : "—"} sousLabel={croiss?.annee ? String(croiss.annee) : ""} />
              </div>
              <Carte titre="Évolution du PIB">
                {seriePib.length > 1 ? (
                  <GrapheMultiPays height={220} type="line" fmt={(v) => fmtUSD(v)} series={[serie("PIB", PALETTE_COMPARAISON[3], seriePib)]} />
                ) : <p style={{ color: "#9aa5b4", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Données indisponibles.</p>}
              </Carte>
            </section>

            {/* ── 5. Entreprises installées ── */}
            <section style={{ marginTop: 40 }}>
              <SectionHead n={5} titre="Entreprises installées" />
              <div className="tdb-kpis" style={{ marginBottom: 16 }}>
                <Kpi label="Total installées" valeur={stats ? nf(stats.global_installees) : "—"} />
                <Kpi label="Régions couvertes" valeur={entRegion.length ? nf(entRegion.length) : "—"} sousLabel="sur 14" />
                <Kpi label="En zones économiques" valeur={stats ? nf(stats.zone_ent_total) : "—"} sousLabel="ZES · ZAI · ZFI" />
                <Kpi label="Secteurs représentés" valeur={entSecteur.length ? nf(entSecteur.length) : "—"} />
              </div>
              <div className="tdb-duo">
                <Carte titre="Créations d'entreprises par année">
                  {entAnnee.length > 1 ? (
                    <GrapheMultiPays height={220} type="line" fmt={(v) => nf(v)} series={[serie("Créations", PALETTE_COMPARAISON[0], entAnnee.map((r) => ({ annee: Number(r.label), valeur: r.valeur })))]} />
                  ) : <p style={{ color: "#9aa5b4", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Données indisponibles.</p>}
                </Carte>
                <Carte titre="Top régions"><MiniBarres data={entRegion} couleur={PALETTE_COMPARAISON[0]} /></Carte>
              </div>
            </section>

            {/* ── 6. Entreprises / prospects ── */}
            <section style={{ marginTop: 40 }}>
              <SectionHead n={6} titre="Entreprises" />
              <div className="tdb-kpis" style={{ marginBottom: 16 }}>
                <Kpi label="Prospects suivis" valeur={stats ? nf(stats.prospects_total) : "—"} />
                <Kpi label="Entreprises ciblées" valeur={stats ? nf(stats.global_ciblees) : "—"} sousLabel="sans échange" />
                <Kpi label="En contact" valeur={stats ? nf(stats.global_contactees) : "—"} sousLabel="échange engagé" />
                <Kpi label="Durée moy. transformation" valeur={stats?.global_duree ? `${nf(stats.global_duree)} j` : "—"} sousLabel="contact → installation" />
              </div>
              <Carte titre="Prospects ciblés par secteur"><MiniBarres data={prospSecteur} couleur={ORANGE} max={8} /></Carte>
            </section>
          </>
        ) : (
          /* ── Onglet Tableaux analytiques ── */
          <div style={{ marginTop: 28 }}>
            {GROUPES_TABLES.map((g) => (
              <section key={g.titre} style={{ marginBottom: 34 }}>
                <p style={{ ...TITRE_SEC, fontSize: 12, marginBottom: 16 }}>{g.titre}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {g.tables.map((t) => (
                    <AnalyticTable key={t.id} tableId={t.id} titre={t.titre} description={t.description} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
