"use client";

// Tableau de bord exécutif — condense l'ensemble de la plateforme en sections
// résumées (IDE, Flux bilatéraux, Commerce extérieur, Indicateurs socio-
// économiques, Entreprises installées, Entreprises/prospects). Deux onglets :
// « Visualisation de données » (KPIs + graphes) et « Tableaux analytiques »
// (toutes les tables détaillées). Style aligné sur le rapport commerce.

import { Fragment, useEffect, useMemo, useState } from "react";
import { BarreTitreSegment } from "@/components/shared/BarreTitre";
import NavActions from "@/components/layout/NavActions";
import GrapheMultiPays, { type SerieGraphe } from "@/components/shared/GrapheMultiPays";
import { AnalyticTable } from "@/components/dashboard/DataTable";
import { PALETTE_COMPARAISON } from "@/lib/couleurs";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const BLEU = "#004f91", ENCRE = "#101a2e";

// ── Formatage ─────────────────────────────────────────────────────────────────
const nf = (v: number | null | undefined, d = 0) => (v != null && isFinite(v) ? v.toLocaleString("fr-FR", { maximumFractionDigits: d }) : "—");
const fmtMd = (fcfa?: number | null) => (fcfa == null ? "—" : `${nf(fcfa / 1e9, 1)} Md FCFA`);
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

// Libellés de mois (les périodes BMCE sont datées « AAAA-MM-JJ »)
const MOIS_FR = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MOIS_COURT = ["", "Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const moisLong = (p?: string | null) => { if (!p) return ""; const [y, m] = p.split("-"); return `${MOIS_FR[Number(m)] || ""} ${y}`.trim(); };
const moisCourt = (p?: string | null) => { if (!p) return ""; const [y, m] = p.split("-"); return `${MOIS_COURT[Number(m)] || ""} ${y.slice(2)}`.trim(); };

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

function Kpi({ label, valeur, tag, delta, rouge, sousLabel, refAnnee, texte }: { label: string; valeur: string; tag?: string; delta?: number | null; rouge?: boolean; sousLabel?: string; refAnnee?: number | string | null; texte?: boolean }) {
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

// Curseur d'année pour les KPIs d'une section : défile de la première année
// disponible à la dernière (défaut), les cartes s'adaptent.
function CurseurAnnee({ min, max, value, onChange, fmtMin, fmtVal }: { min: number; max: number; value: number; onChange: (a: number) => void; fmtMin?: (v: number) => string; fmtVal?: (v: number) => string }) {
  if (!(max > min)) return null;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
      <span style={{ fontSize: 10, color: "#9aa5b4", fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtMin ? fmtMin(min) : min}</span>
      <input
        type="range" min={min} max={max} step={1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tdb-curseur" aria-label="Période affichée"
        style={{ width: 170 }}
      />
      <span style={{ fontSize: 12, fontWeight: 800, color: BLEU, background: "rgba(0,79,145,0.08)", padding: "3px 11px", borderRadius: 999, fontVariantNumeric: "tabular-nums", minWidth: 46, textAlign: "center", whiteSpace: "nowrap" }}>{fmtVal ? fmtVal(value) : value}</span>
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

// ── Groupements du Sénégal (section IDE) ─────────────────────────────────────
// Les 4 zones dont le Sénégal fait partie, résolues par nom/code dans la
// liste renvoyée par /ide/monde/groupements.
const ZONES_SEN: { cle: string; titre: string; trouve: (g: { code: string; nom_fr: string; categorie: string }) => boolean }[] = [
  { cle: "afrique", titre: "Afrique", trouve: (g) => g.categorie === "continent" && g.nom_fr === "Afrique" },
  { cle: "afrique_ouest", titre: "Afrique occidentale", trouve: (g) => g.categorie === "Afrique" && /occident|ouest/i.test(g.nom_fr) },
  { cle: "cedeao", titre: "CEDEAO", trouve: (g) => g.code === "CEDEAO" },
  { cle: "uemoa", titre: "UEMOA", trouve: (g) => g.code === "UEMOA" },
];

type LigneTopZone = { pays: string; code_iso2?: string | null; valeur: number; rang?: number };

// Top 10 des pays d'une zone (rang · drapeau · pays · valeur · part · barre),
// bascule Flux entrants ⇆ sortants ; l'année vient du curseur de la section.
// Le Sénégal est toujours mis en valeur (ajouté après le top s'il en sort).
function TableauZoneSenegal({ titre, nomComplet, tag, rows, chargement, dir, onDir }: {
  titre: string; nomComplet?: string; tag?: string; rows: LigneTopZone[];
  chargement: boolean; dir: "entrant" | "sortant"; onDir: (d: "entrant" | "sortant") => void;
}) {
  const enTop = rows.filter((r, i) => (r.rang ?? i + 1) <= 10);
  const total = enTop.reduce((t, r) => t + Math.max(0, r.valeur), 0);
  const max = Math.max(1e-9, ...enTop.map((r) => r.valeur));
  const estSen = (r: LigneTopZone) => r.pays === "Sénégal" || r.pays === "Senegal";
  const fondSen = "linear-gradient(90deg, rgba(0,79,145,0.10), rgba(0,79,145,0.02))";
  return (
    <div className="ds-carte" style={{ padding: "20px 22px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <p title={nomComplet} style={{ ...TITRE_SEC, margin: 0, flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{titre}</span>
          {tag && <span style={{ fontSize: 9, fontWeight: 700, color: "#8a93a3", background: "#EEF1F6", padding: "2px 8px", borderRadius: 5, letterSpacing: "0.04em", textTransform: "none", fontVariantNumeric: "tabular-nums" }}>{tag}</span>}
        </p>
        <Segment value={dir} onChange={onDir} options={[{ v: "entrant", l: "Flux entrants" }, { v: "sortant", l: "Flux sortants" }]} />
      </div>
      {chargement ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} style={{ height: 24, borderRadius: 7, background: i % 2 ? "rgba(15,40,80,0.05)" : "rgba(15,40,80,0.08)" }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p style={{ color: "#9aa5b4", fontSize: 13, textAlign: "center", padding: "30px 0" }}>Aucune donnée{tag ? ` pour ${tag}` : ""}.</p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
            <span style={{ width: 22, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase", flexShrink: 0 }}>#</span>
            <span style={{ flex: 1, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase" }}>Pays</span>
            <span style={{ width: 68, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase", textAlign: "right", flexShrink: 0 }}>Valeur</span>
            <span style={{ width: 40, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase", textAlign: "right", flexShrink: 0 }}>Part</span>
            <span style={{ width: "22%", flexShrink: 0 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {rows.map((r, i) => {
              const rang = r.rang ?? i + 1;
              const zebre = i % 2 === 1;
              const podium = rang <= 3;
              const sen = estSen(r);
              const horsTop = rang > 10;
              return (
                <Fragment key={r.pays}>
                  {horsTop && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "1px 8px" }}>
                      <span style={{ width: 22, textAlign: "center", color: "#C5BFBB", fontSize: 12, fontWeight: 800, lineHeight: 1, flexShrink: 0 }}>⋮</span>
                      <span style={{ flex: 1, height: 1, background: "#F3F5F8" }} />
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 8,
                    background: sen ? fondSen : zebre ? "rgba(15,40,80,0.018)" : "transparent",
                    border: sen ? "1px solid rgba(0,79,145,0.30)" : "1px solid transparent",
                    boxShadow: sen ? "0 1px 6px rgba(0,79,145,0.10)" : "none" }}>
                    <span style={{ width: 22, flexShrink: 0 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 3px", borderRadius: 10,
                        background: sen || podium ? BLEU : "#EEF1F6", color: sen || podium ? "#fff" : "#5c6675", fontSize: 10, fontWeight: 800 }}>{rang}</span>
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{drapeau(r.code_iso2)}</span>
                      <span title={r.pays} style={{ fontSize: 12, fontWeight: sen ? 800 : 650, color: sen ? BLEU : ENCRE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.pays}</span>
                      {sen && horsTop && <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: BLEU, background: "rgba(0,79,145,0.10)", padding: "2px 7px", borderRadius: 999, flexShrink: 0, whiteSpace: "nowrap" }}>{rang}ᵉ DU CLASSEMENT</span>}
                    </span>
                    <span className="ds-donnee" style={{ width: 68, fontSize: 11.5, fontWeight: 800, color: BLEU, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmtMUSD(r.valeur)}</span>
                    <span style={{ width: 40, fontSize: 10, fontWeight: 700, color: "#5c6675", textAlign: "right", flexShrink: 0 }}>
                      {total > 0 ? `${nf(Math.max(0, r.valeur) / total * 100)} %` : "—"}
                    </span>
                    <div style={{ width: "22%", height: 7, background: "#EEF1F6", borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
                      {r.valeur > 0 && <div style={{ height: "100%", width: `${Math.min(100, Math.max(2, r.valeur / max * 100))}%`, borderRadius: 99, background: BLEU, opacity: sen ? 1 : podium ? 0.9 : 0.55 }} />}
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </>
      )}
    </div>
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

function Carte({ titre, tag, sousTitre, children, style }: { titre?: string; tag?: string | null; sousTitre?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="ds-carte" style={{ padding: "22px 24px", minWidth: 0, ...style }}>
      {titre && (
        <p style={{ ...TITRE_SEC, marginBottom: sousTitre ? 3 : undefined, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{titre}</span>
          {tag && <span style={{ fontSize: 9, fontWeight: 700, color: "#8a93a3", background: "#EEF1F6", padding: "2px 8px", borderRadius: 5, letterSpacing: "0.04em", textTransform: "none", fontVariantNumeric: "tabular-nums" }}>{tag}</span>}
        </p>
      )}
      {sousTitre && <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 600, color: "#9aa5b4", fontStyle: "italic" }}>{sousTitre}</p>}
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
  // Année sélectionnée au curseur de la section (null = dernière disponible)
  const [bilatAnneeSel, setBilatAnneeSel] = useState<number | null>(null);
  const bilatAnnee = bilatAnneeSel ?? commCtx?.amax ?? null;
  const [comExt, setComExt] = useState<any>(null);
  const [comMois, setComMois] = useState<any>(null);
  const [comMoisSel, setComMoisSel] = useState<number | null>(null);
  const [comDir, setComDir] = useState<"export" | "import">("export");
  const [socio, setSocio] = useState<any[]>([]);
  const [socioPays, setSocioPays] = useState<string>("Sénégal");

  useEffect(() => {
    getJSON(`${API}/dashboard/stats`).then(setStats);
    getJSON(`${API}/ide/cnuced?direction=entrant&indicateur=flux`).then((d) => setIdeFlux(Array.isArray(d) ? d : []));
    getJSON(`${API}/ide/cnuced?direction=entrant&indicateur=stock`).then((d) => setIdeStock(Array.isArray(d) ? d : []));
    getJSON(`${API}/ide/cnuced?direction=sortant&indicateur=flux`).then((d) => setIdeFluxSort(Array.isArray(d) ? d : []));
    getJSON(`${API}/ide/cnuced?direction=sortant&indicateur=stock`).then((d) => setIdeStockSort(Array.isArray(d) ? d : []));
    getJSON(`${API}/bmce/apercu`).then(setComExt);

    // Flux bilatéraux : résoudre l'id du Sénégal puis charger la balance ;
    // KPIs/tops dépendent de la direction → effet dédié ci-dessous.
    getJSON(`${API}/statistiques/commerce/filtres`).then((f) => {
      const sen = (f?.pays || []).find((p: any) => p.code_iso3 === "SEN");
      const annees: number[] = (f?.annees || []).slice().sort((a: number, b: number) => a - b);
      if (!sen || annees.length === 0) return;
      const amax = annees[annees.length - 1], amin = annees[0];
      setCommCtx({ id: sen.id, amin, amax });
      getJSON(`${API}/statistiques/commerce/balance?pays_id=${sen.id}&annee_min=${amin}&annee_max=${amax}`).then((d) => setBilatBalance(Array.isArray(d) ? d : []));
    });

    // Socio-économique : id Sénégal puis données
    getJSON(`${API}/statistiques/pays`).then((pays) => {
      const sen = (pays || []).find((p: any) => p.code_iso3 === "SEN");
      if (!sen) return;
      setSocioPays(sen.nom || "Sénégal");
      getJSON(`${API}/statistiques/donnees?pays=${sen.id}&annee_min=1960&annee_max=2100`).then((d) => setSocio(Array.isArray(d) ? d : []));
    });
  }, []);

  // Flux bilatéraux : KPIs, tops et répartition rechargés à chaque changement
  // de direction OU d'année au curseur (les variations n vs n-1 restent
  // calculées côté backend, hors bornes de période).
  useEffect(() => {
    if (!commCtx || bilatAnnee == null) return;
    const base = `pays_id=${commCtx.id}&direction=${bilatDir}`;
    const an = `annee_min=${bilatAnnee}&annee_max=${bilatAnnee}`;
    getJSON(`${API}/statistiques/commerce/kpis?${base}&${an}`).then(setBilat);
    getJSON(`${API}/statistiques/commerce/tops?${base}&${an}&limite=8`).then(setBilatTops);
    getJSON(`${API}/statistiques/commerce/repartition?${base}&${an}&limite=6`).then(setBilatRepart);
  }, [commCtx, bilatDir, bilatAnnee]);

  // Commerce extérieur (ANSD) : mois sélectionné au curseur (index dans la
  // liste des périodes disponibles ; défaut = dernier mois).
  const comPeriodes: string[] = useMemo(() => (comExt?.serie || []).map((s: any) => s.periode as string), [comExt]);
  const comIdx = comMoisSel ?? (comPeriodes.length ? comPeriodes.length - 1 : null);
  useEffect(() => {
    if (comIdx == null || !comPeriodes[comIdx]) return;
    getJSON(`${API}/bmce/mois?periode=${comPeriodes[comIdx]}`).then(setComMois);
  }, [comIdx, comPeriodes]);

  // ── Dérivés socio-économiques ──
  // Bornes d'années couvertes par les 4 indicateurs des KPIs + curseur
  const SOCIO_KPIS = ["pib", "population", "pib_hab", "croissance_pib"];
  const socioBornes = useMemo(() => {
    const ans = socio.filter((r) => SOCIO_KPIS.includes(r.indicateur) && r.valeur != null).map((r) => r.annee as number);
    return ans.length ? { min: Math.min(...ans), max: Math.max(...ans) } : null;
  }, [socio]); // eslint-disable-line react-hooks/exhaustive-deps
  const [socioAnneeSel, setSocioAnneeSel] = useState<number | null>(null);
  const socioAnnee = socioAnneeSel ?? socioBornes?.max ?? null;

  // Valeur à l'année du curseur + valeur disponible précédente (variation ▲/▼ %)
  const socioVal = (code: string) => {
    const rows = socio.filter((r) => r.indicateur === code && r.valeur != null).sort((a, b) => a.annee - b.annee);
    if (!rows.length || socioAnnee == null) return null;
    const last = rows.find((r) => r.annee === socioAnnee) || null;
    const avant = rows.filter((r) => r.annee < socioAnnee);
    const prev = avant.length ? avant[avant.length - 1] : null;
    const delta = last && prev && prev.valeur ? ((last.valeur - prev.valeur) / Math.abs(prev.valeur)) * 100 : null;
    return { valeur: (last?.valeur as number) ?? null, annee: socioAnnee, prevAnnee: last ? ((prev?.annee as number) ?? null) : null, delta };
  };
  const pib = socioVal("pib"), pop = socioVal("population"), pibHab = socioVal("pib_hab"), croiss = socioVal("croissance_pib");
  const serieSocio = (code: string) => socio.filter((r) => r.indicateur === code && r.valeur != null).sort((a, b) => a.annee - b.annee).map((r) => ({ annee: r.annee as number, valeur: r.valeur as number }));
  const seriePib = useMemo(() => serieSocio("pib"), [socio]); // eslint-disable-line react-hooks/exhaustive-deps

  const toSerie = (rows: any[]) => rows.slice().sort((a, b) => a.annee - b.annee).map((r) => ({ annee: r.annee as number, valeur: r.valeur as number | null }));
  const serieFluxEnt = useMemo(() => toSerie(ideFlux), [ideFlux]);
  const serieFluxSort = useMemo(() => toSerie(ideFluxSort), [ideFluxSort]);
  const serieStockEnt = useMemo(() => toSerie(ideStock), [ideStock]);
  const serieStockSort = useMemo(() => toSerie(ideStockSort), [ideStockSort]);
  const serieBalance = useMemo(() => bilatBalance.slice().sort((a, b) => a.annee - b.annee), [bilatBalance]);

  // Total (export ou import) à l'année du curseur vs l'année disponible précédente
  const bilatTotalDelta = useMemo(() => {
    const k = bilatDir === "exportateur" ? "exportations" : "importations";
    const rows = serieBalance.filter((r) => r[k] != null && r[k] > 0);
    if (bilatAnnee == null) return { prev: null as any, delta: null as number | null };
    const last = rows.find((r) => r.annee === bilatAnnee) || null;
    const avant = rows.filter((r) => r.annee < bilatAnnee);
    const prev = avant.length ? avant[avant.length - 1] : null;
    const delta = last && prev && prev[k] ? ((last[k] - prev[k]) / Math.abs(prev[k])) * 100 : null;
    return { prev, delta };
  }, [serieBalance, bilatDir, bilatAnnee]);

  // Dernier point valide + précédent (pour la variation « par rapport à YYYY »)
  // Bornes d'années réellement couvertes par les 4 séries IDE
  const ideBornes = useMemo(() => {
    const ans = [...serieFluxEnt, ...serieFluxSort, ...serieStockEnt, ...serieStockSort]
      .filter((r) => r.valeur != null).map((r) => r.annee);
    return ans.length ? { min: Math.min(...ans), max: Math.max(...ans) } : null;
  }, [serieFluxEnt, serieFluxSort, serieStockEnt, serieStockSort]);
  // Année sélectionnée au curseur (null = dernière disponible)
  const [ideAnneeSel, setIdeAnneeSel] = useState<number | null>(null);
  const ideAnnee = ideAnneeSel ?? ideBornes?.max ?? null;

  // Groupements du Sénégal : résolution des codes puis top 10 des pays par
  // zone à l'année du curseur. Réponses estampillées de leur année : tant que
  // l'année affichée n'a pas sa réponse, la carte montre un squelette.
  const [grpMonde, setGrpMonde] = useState<{ code: string; nom_fr: string; categorie: string }[]>([]);
  useEffect(() => { getJSON(`${API}/ide/monde/groupements`).then((d) => setGrpMonde(Array.isArray(d) ? d : [])); }, []);
  const zonesSen = useMemo(
    () => ZONES_SEN.map((z) => { const g = grpMonde.find(z.trouve); return g ? { cle: z.cle, titre: z.titre, code: g.code, nomComplet: g.nom_fr } : null; })
      .filter(Boolean) as { cle: string; titre: string; code: string; nomComplet: string }[],
    [grpMonde]);
  const [zoneTops, setZoneTops] = useState<Record<string, { annee: number; tops: { entrant: LigneTopZone[]; sortant: LigneTopZone[] } }>>({});
  const [zoneDir, setZoneDir] = useState<Record<string, "entrant" | "sortant">>({});
  useEffect(() => {
    if (ideAnnee == null) return;
    zonesSen.forEach((z) => {
      getJSON(`${API}/ide/monde/global?indicateur=flux&code=${encodeURIComponent(z.code)}&annees=${ideAnnee}`)
        .then((d) => { if (d?.tops) setZoneTops((p) => ({ ...p, [z.code]: { annee: ideAnnee, tops: d.tops } })); });
    });
  }, [zonesSen, ideAnnee]);

  // Valeur d'une série à l'année choisie + valeur disponible précédente (Δ %)
  const pointAnnee = (rows: { annee: number; valeur: number | null }[], annee: number | null) => {
    const valid = rows.filter((r) => r.valeur != null);
    if (annee == null || !valid.length) return { last: null as any, prev: null as any, delta: null as number | null };
    const last = valid.find((r) => r.annee === annee) || null;
    const avant = valid.filter((r) => r.annee < annee);
    const prev = avant.length ? avant[avant.length - 1] : null;
    const delta = last && prev && prev.valeur ? ((last.valeur! - prev.valeur!) / Math.abs(prev.valeur!)) * 100 : null;
    return { last, prev, delta };
  };
  const kFluxEnt = useMemo(() => pointAnnee(serieFluxEnt, ideAnnee), [serieFluxEnt, ideAnnee]);
  const kFluxSort = useMemo(() => pointAnnee(serieFluxSort, ideAnnee), [serieFluxSort, ideAnnee]);
  const kStockEnt = useMemo(() => pointAnnee(serieStockEnt, ideAnnee), [serieStockEnt, ideAnnee]);
  const kStockSort = useMemo(() => pointAnnee(serieStockSort, ideAnnee), [serieStockSort, ideAnnee]);

  return (
    <main style={{ minHeight: "100vh", background: "var(--ds-fond, #F6F5F3)", fontFamily: "var(--font-google-sans)" }}>
      <style>{`
        .tdb-kpis { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
        .tdb-duo  { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; align-items: stretch; }
        @media (max-width: 980px) { .tdb-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); } .tdb-duo { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .tdb-kpis { grid-template-columns: 1fr; } }
        .tdb-curseur { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 999px;
          background: rgba(0,79,145,0.18); outline: none; cursor: pointer; }
        .tdb-curseur::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 15px; height: 15px;
          border-radius: 50%; background: #004f91; border: 2.5px solid #fff; box-shadow: var(--ombre-1); cursor: grab; }
        .tdb-curseur::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.12); }
        .tdb-curseur::-moz-range-thumb { width: 15px; height: 15px; border-radius: 50%;
          background: #004f91; border: 2.5px solid #fff; box-shadow: var(--ombre-1); cursor: grab; }
        .tdb-curseur::-moz-range-track { height: 4px; border-radius: 999px; background: rgba(0,79,145,0.18); }
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
            <div style={{ flexShrink: 0 }}><NavActions onDark home flouTotal /></div>
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
              <SectionHead n={1} titre="Investissements Directs Étrangers" extra={
                ideBornes && ideAnnee != null ? <CurseurAnnee min={ideBornes.min} max={ideBornes.max} value={ideAnnee} onChange={setIdeAnneeSel} /> : undefined
              } />
              <div className="tdb-kpis" style={{ marginBottom: 16 }}>
                <Kpi label="Flux entrant" tag={ideAnnee != null ? String(ideAnnee) : undefined} valeur={fmtMUSD(kFluxEnt.last?.valeur)} delta={kFluxEnt.delta} refAnnee={kFluxEnt.last ? kFluxEnt.prev?.annee : null} />
                <Kpi label="Flux sortant" tag={ideAnnee != null ? String(ideAnnee) : undefined} valeur={fmtMUSD(kFluxSort.last?.valeur)} delta={kFluxSort.delta} refAnnee={kFluxSort.last ? kFluxSort.prev?.annee : null} />
                <Kpi label="Stock entrant" tag={ideAnnee != null ? String(ideAnnee) : undefined} valeur={fmtMUSD(kStockEnt.last?.valeur)} delta={kStockEnt.delta} refAnnee={kStockEnt.last ? kStockEnt.prev?.annee : null} />
                <Kpi label="Stock sortant" tag={ideAnnee != null ? String(ideAnnee) : undefined} valeur={fmtMUSD(kStockSort.last?.valeur)} delta={kStockSort.delta} refAnnee={kStockSort.last ? kStockSort.prev?.annee : null} />
              </div>
              {/* Top 10 des pays dans les groupements dont fait partie le
                  Sénégal — l'année suit le curseur de la section */}
              <div className="tdb-duo">
                {(zonesSen.length ? zonesSen : ZONES_SEN.map((z) => ({ cle: z.cle, titre: z.titre, code: "", nomComplet: z.titre }))).map((z) => {
                  const st = z.code ? zoneTops[z.code] : undefined;
                  const dir = zoneDir[z.code] ?? "entrant";
                  return (
                    <TableauZoneSenegal key={z.cle} titre={z.titre} nomComplet={z.nomComplet}
                      tag={ideAnnee != null ? String(ideAnnee) : undefined}
                      rows={st?.tops?.[dir] ?? []} chargement={!st || st.annee !== ideAnnee}
                      dir={dir} onDir={(d) => setZoneDir((p) => ({ ...p, [z.code]: d }))} />
                  );
                })}
              </div>
            </section>

            {/* ── 2. Flux bilatéraux ── */}
            <section style={{ marginTop: 40 }}>
              <SectionHead n={2} titre="Flux bilatéraux" extra={
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                  <Segment value={bilatDir} onChange={setBilatDir} options={[{ v: "exportateur", l: "Exportations" }, { v: "importateur", l: "Importations" }]} />
                  {commCtx && bilatAnnee != null && <CurseurAnnee min={commCtx.amin} max={commCtx.amax} value={bilatAnnee} onChange={setBilatAnneeSel} />}
                </div>
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
              <SectionHead n={3} titre="Commerce extérieur" extra={
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                  <Segment value={comDir} onChange={setComDir} options={[{ v: "export", l: "Exportations" }, { v: "import", l: "Importations" }]} />
                  {comIdx != null && comPeriodes.length > 1 && (
                    <CurseurAnnee min={0} max={comPeriodes.length - 1} value={comIdx} onChange={setComMoisSel}
                      fmtMin={(i) => moisCourt(comPeriodes[i])} fmtVal={(i) => moisCourt(comPeriodes[i])} />
                  )}
                </div>
              } />
              {(() => {
                const exp = comDir === "export";
                const mois = comMois?.disponible ? comMois : null;
                const dir = mois?.[comDir];
                const top = dir?.top || null;
                const moisTag = mois?.periode ? moisLong(mois.periode) : undefined;   // « Mai 2026 »
                const refMois = mois?.periode_prec ? moisLong(mois.periode_prec) : null; // « Avril 2026 »
                return (
                  <div className="tdb-kpis">
                    <Kpi label={exp ? "Exportations" : "Importations"} tag={moisTag ? `${exp ? "FAB" : "CAF"} · ${moisTag}` : undefined} valeur={fmtMd(dir?.total)} delta={dir?.variation ?? null} refAnnee={refMois} />
                    <Kpi texte label={exp ? "1er client" : "1er fournisseur"} tag={moisTag}
                      valeur={top?.libelle || "—"} sousLabel={top ? fmtMd(top.valeur) : ""} delta={top?.variation ?? null} refAnnee={refMois} />
                    <Kpi label={exp ? "Part du 1er client" : "Part du 1er fournisseur"} tag={moisTag}
                      valeur={top?.part_pct != null ? `${nf(top.part_pct, 1)} %` : "—"} delta={top?.part_variation ?? null} refAnnee={refMois} />
                    <Kpi label="Taux de couverture" tag={moisTag} valeur={mois?.taux_couverture != null ? `${nf(mois.taux_couverture, 1)} %` : "—"} delta={mois?.taux_couverture_variation ?? null} refAnnee={refMois} sousLabel="export / import" />
                  </div>
                );
              })()}

              {(() => {
                const exp = comDir === "export";
                // Séries mensuelles (3 dernières années) — évolution et balance
                const serieMois = (comExt?.serie || []).slice(-36);
                const evoData = serieMois.map((s: any, i: number) => ({ annee: i, valeur: (exp ? s.export : s.import)?.valeur ?? null }));
                const balData = serieMois.map((s: any, i: number) => {
                  const e = s.export?.valeur, im = s.import?.valeur;
                  return { annee: i, valeur: e != null && im != null ? e - im : null };
                });
                const fmtMoisX = (i: number) => moisCourt(serieMois[i]?.periode);
                const ans = serieMois.map((s: any) => s.periode?.slice(0, 4)).filter(Boolean);
                const evoTag = ans.length ? (ans[0] === ans[ans.length - 1] ? ans[0] : `${ans[0]}–${ans[ans.length - 1]}`) : undefined;
                const mois = comMois?.disponible ? comMois : null;
                const moisRef = mois?.periode ? moisLong(mois.periode) : undefined;
                const paysList = mois?.[comDir]?.pays || [];
                const groupes = mois?.[comDir]?.groupes || [];
                return (
                  <>
                    <div className="tdb-duo" style={{ marginTop: 20 }}>
                      <Carte titre={exp ? "Évolution des exportations" : "Évolution des importations"} tag={evoTag}>
                        {evoData.length > 1 ? (
                          <GrapheMultiPays height={220} type="line" fmt={(v) => fmtMd(v)} fmtX={fmtMoisX} showDots={false} series={[serie(exp ? "Exportations" : "Importations", PALETTE_COMPARAISON[0], evoData)]} />
                        ) : <p style={{ color: "#9aa5b4", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Données indisponibles.</p>}
                      </Carte>
                      <Carte titre="Balance commerciale" tag={evoTag}>
                        {balData.length > 1 ? (
                          <GrapheMultiPays height={220} type="line" fmt={(v) => fmtMd(v)} fmtX={fmtMoisX} showDots={false} series={[serie("Balance", PALETTE_COMPARAISON[1], balData)]} />
                        ) : <p style={{ color: "#9aa5b4", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Données indisponibles.</p>}
                      </Carte>
                    </div>
                    <div className="tdb-duo" style={{ marginTop: 16 }}>
                      <Carte titre={exp ? "Principaux clients à l'exportation" : "Principaux fournisseurs à l'importation"} tag={moisRef}>
                        <TopTable rows={paysList.map((p: any) => ({ nom: p.libelle, valeur: p.valeur, iso2: p.code_iso2 }))} colNom="Pays" colVal="Valeur" fmt={(v) => fmtMd(v)} max={7} drapeaux />
                      </Carte>
                      <Carte titre={exp ? "Poids des ressources exportées" : "Poids des ressources importées"} sousTitre="Groupe d'utilisation" tag={moisRef}>
                        <MiniBarres data={groupes.map((g: any) => ({ label: g.libelle, valeur: g.valeur }))} couleur={PALETTE_COMPARAISON[0]} fmt={(v) => fmtMd(v)} max={7} />
                      </Carte>
                    </div>
                  </>
                );
              })()}
            </section>

            {/* ── 4. Indicateurs socio-économiques ── */}
            <section style={{ marginTop: 40 }}>
              <SectionHead n={4} titre="Indicateurs socio-économiques" extra={
                socioBornes && socioAnnee != null ? <CurseurAnnee min={socioBornes.min} max={socioBornes.max} value={socioAnnee} onChange={setSocioAnneeSel} /> : undefined
              } />
              <div className="tdb-kpis" style={{ marginBottom: 16 }}>
                <Kpi label="PIB" tag={socioAnnee != null ? String(socioAnnee) : undefined} valeur={fmtUSD(pib?.valeur)} delta={pib?.delta} refAnnee={pib?.prevAnnee} />
                <Kpi label="Population" tag={socioAnnee != null ? String(socioAnnee) : undefined} valeur={pop?.valeur != null ? `${nf(pop.valeur)} hbts` : "—"} delta={pop?.delta} refAnnee={pop?.prevAnnee} />
                <Kpi label="PIB / habitant" tag={socioAnnee != null ? String(socioAnnee) : undefined} valeur={pibHab?.valeur != null ? `${nf(pibHab.valeur)} $` : "—"} delta={pibHab?.delta} refAnnee={pibHab?.prevAnnee} />
                <Kpi label="Croissance du PIB" tag={socioAnnee != null ? String(socioAnnee) : undefined} valeur={croiss?.valeur != null ? `${nf(croiss.valeur, 1)} %` : "—"} delta={croiss?.delta} refAnnee={croiss?.prevAnnee} />
              </div>
              {(() => {
                const seriePop = serieSocio("population");
                const expM = serieSocio("exportations_marchandises"), impM = serieSocio("importations_marchandises"), balM = serieSocio("balance_marchandises");
                const expS = serieSocio("exportations_services"), impS = serieSocio("importations_services"), balS = serieSocio("balance_services");
                const plage = (s: { annee: number }[]) => (s.length ? (s[0].annee === s[s.length - 1].annee ? String(s[0].annee) : `${s[0].annee}–${s[s.length - 1].annee}`) : undefined);
                const vide = <p style={{ color: "#9aa5b4", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Données indisponibles.</p>;
                return (
                  <>
                    <div className="tdb-duo">
                      <Carte titre="Évolution de la population" tag={plage(seriePop)}>
                        {seriePop.length > 1 ? <GrapheMultiPays height={220} type="line" fmt={(v) => `${nf(v)} hbts`} series={[serie("Population", PALETTE_COMPARAISON[2], seriePop)]} /> : vide}
                      </Carte>
                      <Carte titre="Évolution du PIB" tag={plage(seriePib)}>
                        {seriePib.length > 1 ? <GrapheMultiPays height={220} type="line" fmt={(v) => fmtUSD(v)} series={[serie("PIB", PALETTE_COMPARAISON[3], seriePib)]} /> : vide}
                      </Carte>
                    </div>
                    <div className="tdb-duo" style={{ marginTop: 16 }}>
                      <Carte titre="Échanges de marchandises" tag={plage(expM.length ? expM : impM)}>
                        {(expM.length > 1 || impM.length > 1) ? (
                          <GrapheMultiPays height={220} type="line" dualAxis={false} fmt={(v) => fmtUSD(v)} series={[
                            { nom: "Exportations", couleur: PALETTE_COMPARAISON[2], data: expM, dash: "6,4" },
                            { nom: "Importations", couleur: PALETTE_COMPARAISON[0], data: impM, dash: "6,4" },
                            { nom: "Balance", couleur: "#dc2626", data: balM },
                          ]} />
                        ) : vide}
                      </Carte>
                      <Carte titre="Échanges de services" tag={plage(expS.length ? expS : impS)}>
                        {(expS.length > 1 || impS.length > 1) ? (
                          <GrapheMultiPays height={220} type="line" dualAxis={false} fmt={(v) => fmtUSD(v)} series={[
                            { nom: "Exportations", couleur: PALETTE_COMPARAISON[2], data: expS, dash: "6,4" },
                            { nom: "Importations", couleur: PALETTE_COMPARAISON[0], data: impS, dash: "6,4" },
                            { nom: "Balance", couleur: "#dc2626", data: balS },
                          ]} />
                        ) : vide}
                      </Carte>
                    </div>
                  </>
                );
              })()}
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
