"use client";

// Tableau de bord exécutif — condense l'ensemble de la plateforme en sections
// résumées (IDE, Flux bilatéraux, Commerce extérieur, Indicateurs socio-
// économiques, Entreprises installées, Entreprises/prospects). Deux onglets :
// « Visualisation de données » (KPIs + graphes) et « Tableaux analytiques »
// (toutes les tables détaillées). Style aligné sur le rapport commerce.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
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

function Kpi({ label, valeur, tag, delta, rouge, sousLabel }: { label: string; valeur: string; tag?: string; delta?: number | null; rouge?: boolean; sousLabel?: string }) {
  return (
    <div className="ds-carte" style={{ padding: "18px 20px", boxShadow: "var(--ombre-2)", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: BLEU, textTransform: "uppercase", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</p>
        {tag && <span style={{ fontSize: 8.5, fontWeight: 700, color: "#8a93a3", background: "#EEF1F6", padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0 }}>{tag}</span>}
      </div>
      <p className="ds-donnee" style={{ fontSize: "1.65rem", fontWeight: 800, color: rouge ? "#dc2626" : ENCRE, margin: 0, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{valeur}</p>
      <div style={{ marginTop: 8, minHeight: 15, display: "flex", alignItems: "center", gap: 6 }}>
        {delta != null && <Delta v={delta} />}
        {sousLabel && <span style={{ fontSize: 10.5, color: "#9aa5b4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sousLabel}</span>}
      </div>
    </div>
  );
}

// En-tête de section : pastille + titre + lien « voir la page »
function SectionHead({ n, titre, sous, lien, lienLabel }: { n: number; titre: string; sous?: string; lien?: string; lienLabel?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(0,79,145,0.09)", color: BLEU, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{String(n).padStart(2, "0")}</span>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: ENCRE, letterSpacing: "-0.01em" }}>{titre}</h2>
          {sous && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#9aa5b4", fontWeight: 500 }}>{sous}</p>}
        </div>
      </div>
      {lien && (
        <Link href={lien} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: BLEU, textDecoration: "none", background: "rgba(0,79,145,0.06)", padding: "7px 13px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 }}>
          {lienLabel || "Voir la page"} <ArrowRight size={13} />
        </Link>
      )}
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
function TopTable({ rows, couleur = BLEU, fmt = (v: number) => nf(v), colNom = "Libellé", colVal = "Valeur", max = 8 }: { rows: { nom: string; valeur: number }[]; couleur?: string; fmt?: (v: number) => string; colNom?: string; colVal?: string; max?: number }) {
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
            <td style={{ padding: "6px 8px", fontWeight: 650, color: ENCRE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{r.nom}</td>
            <td className="ds-donnee" style={{ padding: "6px 8px", textAlign: "right", fontWeight: 750, color: ENCRE, whiteSpace: "nowrap" }}>{fmt(r.valeur)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Carte({ titre, children, style }: { titre?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="ds-carte" style={{ padding: "22px 24px", minWidth: 0, ...style }}>
      {titre && <p style={TITRE_SEC}>{titre}</p>}
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
  const [ide, setIde] = useState<any>(null);
  const [ideFlux, setIdeFlux] = useState<any[]>([]);
  const [ideStock, setIdeStock] = useState<any[]>([]);
  const [bilat, setBilat] = useState<any>(null);
  const [bilatTops, setBilatTops] = useState<any>(null);
  const [bilatBalance, setBilatBalance] = useState<any[]>([]);
  const [comExt, setComExt] = useState<any>(null);
  const [socio, setSocio] = useState<any[]>([]);
  const [socioPays, setSocioPays] = useState<string>("Sénégal");
  const [entAnnee, setEntAnnee] = useState<{ label: string; valeur: number }[]>([]);
  const [entRegion, setEntRegion] = useState<{ label: string; valeur: number }[]>([]);
  const [entSecteur, setEntSecteur] = useState<{ label: string; valeur: number }[]>([]);
  const [prospSecteur, setProspSecteur] = useState<{ label: string; valeur: number }[]>([]);

  useEffect(() => {
    getJSON(`${API}/dashboard/stats`).then(setStats);
    getJSON(`${API}/ide/cnuced/kpis-calcules`).then(setIde);
    getJSON(`${API}/ide/cnuced?direction=entrant&indicateur=flux`).then((d) => setIdeFlux(Array.isArray(d) ? d : []));
    getJSON(`${API}/ide/cnuced?direction=entrant&indicateur=stock`).then((d) => setIdeStock(Array.isArray(d) ? d : []));
    getJSON(`${API}/bmce/apercu`).then(setComExt);
    getJSON(`${API}/dashboard/viz/entreprises-par-annee`).then((d) => setEntAnnee(Array.isArray(d) ? d : []));
    getJSON(`${API}/dashboard/viz/entreprises-par-region`).then((d) => setEntRegion(Array.isArray(d) ? d : []));
    getJSON(`${API}/dashboard/viz/entreprises-par-secteur`).then((d) => setEntSecteur(Array.isArray(d) ? d : []));
    getJSON(`${API}/dashboard/indicateur?dimension=secteurs&indicateur=ciblees`).then((d) => setProspSecteur(Array.isArray(d) ? d : []));

    // Flux bilatéraux : résoudre l'id du Sénégal puis charger KPIs/tops/balance
    getJSON(`${API}/statistiques/commerce/filtres`).then((f) => {
      const sen = (f?.pays || []).find((p: any) => p.code_iso3 === "SEN");
      const annees: number[] = (f?.annees || []).slice().sort((a: number, b: number) => a - b);
      if (!sen || annees.length === 0) return;
      const amax = annees[annees.length - 1], amin = Math.max(annees[0], amax - 6);
      const base = `pays_id=${sen.id}&direction=exportateur`;
      getJSON(`${API}/statistiques/commerce/kpis?${base}&annee_min=${amin}&annee_max=${amax}`).then(setBilat);
      getJSON(`${API}/statistiques/commerce/tops?${base}&annee_min=${amax}&annee_max=${amax}&limite=8`).then(setBilatTops);
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

  // ── Dérivés socio-économiques ──
  const socioVal = (code: string) => {
    const rows = socio.filter((r) => r.indicateur === code && r.valeur != null);
    if (!rows.length) return null;
    const last = rows.reduce((a, b) => (b.annee > a.annee ? b : a));
    return { valeur: last.valeur as number, annee: last.annee as number };
  };
  const pib = socioVal("pib"), pop = socioVal("population"), pibHab = socioVal("pib_hab"), croiss = socioVal("croissance_pib");
  const seriePib = useMemo(() => socio.filter((r) => r.indicateur === "pib" && r.valeur != null).sort((a, b) => a.annee - b.annee).map((r) => ({ annee: r.annee, valeur: r.valeur })), [socio]);

  const serieIdeFlux = useMemo(() => ideFlux.slice().sort((a, b) => a.annee - b.annee).map((r) => ({ annee: r.annee, valeur: r.valeur })), [ideFlux]);
  const serieIdeStock = useMemo(() => ideStock.slice().sort((a, b) => a.annee - b.annee).map((r) => ({ annee: r.annee, valeur: r.valeur })), [ideStock]);
  const serieBalance = useMemo(() => bilatBalance.slice().sort((a, b) => a.annee - b.annee), [bilatBalance]);

  const ideV = (k: string) => (ide && ide[k] ? ide[k] : null);

  return (
    <main style={{ minHeight: "100vh", background: "var(--ds-fond, #F6F5F3)", fontFamily: "var(--font-google-sans)" }}>
      <style>{`
        .tdb-kpis { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
        .tdb-duo  { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; align-items: stretch; }
        @media (max-width: 980px) { .tdb-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); } .tdb-duo { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .tdb-kpis { grid-template-columns: 1fr; } }
      `}</style>
      <BarreTitre titre="Tableau de bord" compact actions={<NavActions onDark home flouFond />}>
        <BarreTitreSegment options={[{ v: "viz", l: "Visualisation de données" }, { v: "tables", l: "Tableaux analytiques" }]} value={onglet} onChange={setOnglet} />
      </BarreTitre>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 40px 90px" }}>

        {onglet === "viz" ? (
          <>
            {/* ── KPIs globaux (chevauchent le bandeau) ── */}
            <div className="tdb-kpis" style={{ marginTop: -52 }}>
              <Kpi label="Entreprises" valeur={stats ? nf(stats.entreprises_total) : "—"} sousLabel="installées" />
              <Kpi label="Accords en vigueur" valeur={stats ? nf(stats.accords_vigueur) : "—"} sousLabel={stats ? `sur ${nf(stats.accords_total)}` : ""} />
              <Kpi label="Intentions d'investiss." valeur={stats ? fmtUSD(stats.intentions_usd) : "—"} sousLabel={stats ? `${nf(stats.intentions_total)} projets` : ""} />
              <Kpi label="Zones d'investissement" valeur={stats ? nf(stats.zones_total) : "—"} sousLabel={stats ? `${nf(stats.poles_total)} pôles` : ""} />
            </div>

            {/* ── 1. IDE ── */}
            <section style={{ marginTop: 44 }}>
              <SectionHead n={1} titre="Investissements Directs Étrangers" sous="Flux et stocks (CNUCED) — Sénégal" lien="/ide" />
              <div className="tdb-kpis" style={{ marginBottom: 16 }}>
                <Kpi label="Flux entrant" tag="Dernière année" valeur={fmtMUSD(ideV("flux_entrant_dernier")?.valeur)} delta={ideV("flux_entrant_dernier")?.variation ?? null} sousLabel={ideV("flux_entrant_dernier")?.annee ? String(ideV("flux_entrant_dernier").annee) : ""} />
                <Kpi label="Stock entrant" valeur={fmtMUSD(ideV("stock_entrant_dernier")?.valeur)} sousLabel={ideV("stock_entrant_dernier")?.annee ? String(ideV("stock_entrant_dernier").annee) : ""} />
                <Kpi label="Flux sortant" valeur={fmtMUSD(ideV("flux_sortant_dernier")?.valeur)} delta={ideV("flux_sortant_dernier")?.variation ?? null} />
                <Kpi label="Balance IDE" valeur={fmtMUSD(ideV("balance_derniere")?.valeur)} rouge={(ideV("balance_derniere")?.valeur ?? 0) < 0} sousLabel="entrant − sortant" />
              </div>
              <Carte titre="Flux et stock entrants au fil des années">
                {serieIdeFlux.length > 1 ? (
                  <GrapheMultiPays height={240} type="line" fmt={(v) => fmtMUSD(v)} series={[serie("Flux entrant", PALETTE_COMPARAISON[0], serieIdeFlux), serie("Stock entrant", PALETTE_COMPARAISON[2], serieIdeStock)]} />
                ) : <p style={{ color: "#9aa5b4", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Données IDE indisponibles.</p>}
              </Carte>
            </section>

            {/* ── 2. Flux bilatéraux ── */}
            <section style={{ marginTop: 40 }}>
              <SectionHead n={2} titre="Flux bilatéraux" sous="Échanges de biens du Sénégal par partenaire (exportations)" lien="/statistiques" />
              <div className="tdb-kpis" style={{ marginBottom: 16 }}>
                <Kpi label="Total exporté" tag={bilat?.annee_ref ? String(bilat.annee_ref) : undefined} valeur={fmtUSD(bilat?.total)} />
                <Kpi label="Partenaires" valeur={bilat ? nf(bilat.nb_partenaires) : "—"} sousLabel="pays destinataires" />
                <Kpi label="1er partenaire" valeur={bilat?.top_partenaire?.nom || "—"} sousLabel={bilat?.top_partenaire ? fmtUSD(bilat.top_partenaire.valeur) : ""} />
                <Kpi label="Concentration" valeur={bilat?.part_top_partenaire != null ? `${nf(bilat.part_top_partenaire, 1)} %` : "—"} sousLabel="part du 1er partenaire" />
              </div>
              <div className="tdb-duo">
                <Carte titre="Balance commerciale bilatérale">
                  {serieBalance.length > 1 ? (
                    <GrapheMultiPays height={220} type="line" fmt={(v) => fmtUSD(v)} series={[
                      serie("Exportations", PALETTE_COMPARAISON[0], serieBalance.map((r) => ({ annee: r.annee, valeur: r.exportations }))),
                      serie("Importations", PALETTE_COMPARAISON[1], serieBalance.map((r) => ({ annee: r.annee, valeur: r.importations }))),
                    ]} />
                  ) : <p style={{ color: "#9aa5b4", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Données indisponibles.</p>}
                </Carte>
                <Carte titre="Principaux partenaires">
                  <TopTable rows={(bilatTops?.partenaires || []).map((p: any) => ({ nom: p.nom, valeur: p.valeur }))} colNom="Pays" colVal="Valeur" fmt={(v) => fmtUSD(v)} />
                </Carte>
              </div>
            </section>

            {/* ── 3. Commerce extérieur ── */}
            <section style={{ marginTop: 40 }}>
              <SectionHead n={3} titre="Commerce extérieur" sous={comExt?.cumul_annee?.annee ? `Cumul ${comExt.cumul_annee.annee} · biens (ANSD)` : "Échanges de biens (ANSD)"} lien="/statistiques/rapport-commerce" lienLabel="Rapport complet" />
              <div className="tdb-kpis">
                <Kpi label="Exportations" tag="FAB" valeur={fmtMd(comExt?.cumul_annee?.exportations_fab)} delta={comExt?.variation_export ?? null} sousLabel="FCFA" />
                <Kpi label="Importations" tag="CAF" valeur={fmtMd(comExt?.cumul_annee?.importations_caf)} delta={comExt?.variation_import ?? null} sousLabel="FCFA" />
                <Kpi label="Balance commerciale" valeur={fmtMd(comExt?.cumul_annee?.balance)} rouge={(comExt?.cumul_annee?.balance ?? 0) < 0} sousLabel="FCFA" />
                <Kpi label="Taux de couverture" valeur={comExt?.taux_couverture != null ? `${nf(comExt.taux_couverture, 1)} %` : "—"} sousLabel="export / import" />
              </div>
            </section>

            {/* ── 4. Indicateurs socio-économiques ── */}
            <section style={{ marginTop: 40 }}>
              <SectionHead n={4} titre="Indicateurs socio-économiques" sous={`${socioPays} — dernières valeurs disponibles`} lien="/statistiques" />
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
              <SectionHead n={5} titre="Entreprises installées" sous="Répartition territoriale et sectorielle" lien="/entreprises" />
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
              <SectionHead n={6} titre="Entreprises" sous="Pipeline de prospection des investisseurs" lien="/prospects" />
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
