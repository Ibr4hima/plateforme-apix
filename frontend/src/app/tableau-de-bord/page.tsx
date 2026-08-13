"use client";

// Tableau de bord exécutif — condense l'ensemble de la plateforme en sections
// résumées (IDE, Flux bilatéraux, Commerce extérieur, Indicateurs socio-
// économiques, Entreprises installées, Entreprises/prospects). Deux onglets :
// « Visualisation de données » (KPIs + graphes) et « Tableaux analytiques »
// (toutes les tables détaillées). Style aligné sur le rapport commerce.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarreTitreSegment } from "@/components/shared/BarreTitre";
import NavActions from "@/components/layout/NavActions";
import GrapheMultiPays, { type SerieGraphe } from "@/components/shared/GrapheMultiPays";
import { AnalyticTable } from "@/components/dashboard/DataTable";
import { PALETTE_COMPARAISON } from "@/lib/couleurs";
import { nf, fmtFCFA, fmtMFCFA, fmtUSD, fmtMillionsUSD as fmtMUSD } from "@/lib/format";
import { CurseurAnneeNace } from "@/components/shared/CurseurNace";
import { useEtatUrl } from "@/lib/useEtatUrl";
import DrapeauPays from "@/components/shared/DrapeauPays";
import Variation from "@/components/shared/Variation";

import { API_BASE as API } from "@/lib/api";
const BLEU = "var(--bleu)", ENCRE = "var(--encre)";
const SOCIO_KPIS = ["pib", "population", "pib_hab", "croissance_pib"];

// Formatage : lib/format est LA source — les copies locales qui vivaient ici
// avaient déjà divergé de /statistiques (« Md$ » contre « Md $ », 0 contre 1
// décimale sur les mêmes flux). fmtMd s'appelle désormais fmtFCFA, son unité
// d'entrée (FCFA bruts) étant dans le nom.
const getJSON = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// ── Petits blocs de présentation ──────────────────────────────────────────────
const TITRE_SEC: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: BLEU, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 14px" };

function Delta({ v, surFonce }: { v: number | null | undefined; surFonce?: boolean }) {
  // Enveloppe du composant commun : ce fichier appelle Delta à une dizaine
  // d'endroits, il n'y a pas de raison de les réécrire tous.
  return <Variation valeur={v} taille={11.5} surFonce={surFonce} />;
}

function Kpi({ label, valeur, tag, delta, rouge, sousLabel, refAnnee, texte }: { label: string; valeur: string; tag?: string; delta?: number | null; rouge?: boolean; sousLabel?: string; refAnnee?: number | string | null; texte?: boolean }) {
  // Valeur textuelle longue (nom de ressource, de pays…) : police réduite,
  // retour à la ligne sur 2 lignes plutôt qu'un texte tronqué.
  const styleValeur: React.CSSProperties = texte
    ? { fontSize: "1.15rem", fontWeight: 800, color: rouge ? "var(--danger)" : ENCRE, margin: 0, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }
    : { fontSize: "1.65rem", fontWeight: 800, color: rouge ? "var(--danger)" : ENCRE, margin: 0, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  return (
    <div className="ds-carte" style={{ padding: "18px 20px", boxShadow: "var(--ombre-2)", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: BLEU, textTransform: "uppercase", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</p>
        {tag && <span style={{ fontSize: 8.5, fontWeight: 700, color: "var(--gris)", background: "var(--bleu-voile)", padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0 }}>{tag}</span>}
      </div>
      <p className="ds-donnee" style={styleValeur}>{valeur}</p>
      <div style={{ marginTop: 8, minHeight: 15, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {sousLabel && <span style={{ fontSize: 10.5, color: "var(--gris)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sousLabel}</span>}
        {delta != null && <Variation valeur={delta} annee={refAnnee != null ? Number(refAnnee) : null} taille={11.5} />}
      </div>
    </div>
  );
}

// En-tête de section : pastille + titre (+ contrôle) puis filet fin sur la même ligne
function SectionHead({ n, titre, extra }: { n: number; titre: string; extra?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgb(var(--bleu-rgb) / 0.09)", color: BLEU, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{String(n).padStart(2, "0")}</span>
      <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: ENCRE, letterSpacing: "-0.01em", whiteSpace: "nowrap", flexShrink: 0 }}>{titre}</h2>
      {extra}
      <div style={{ flex: 1, height: 1, background: "rgb(var(--encre-rgb) / 0.12)" }} />
    </div>
  );
}

// Bascule segmentée compacte (ex. Exportations / Importations)
function Segment<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "inline-flex", background: "var(--bleu-voile)", borderRadius: 999, padding: 3, gap: 2, flexShrink: 0 }}>
      {options.map((o) => {
        const actif = o.v === value;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            border: "none", cursor: "pointer", padding: "5px 14px", borderRadius: 999,
            fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
            background: actif ? "var(--carte)" : "transparent", color: actif ? BLEU : "var(--gris-fort)",
            boxShadow: actif ? "var(--ombre-1)" : "none", transition: "color .15s, background .15s",
          }}>{o.l}</button>
        );
      })}
    </div>
  );
}

// Curseur d'année pour les KPIs d'une section : défile de la première année
// disponible à la dernière (défaut), les cartes s'adaptent.
// Curseur d'année : le composant commun de la plateforme. La page portait sa
// propre copie (.tdb-curseur) — c'était l'original dont les autres pages ont
// été rapprochées, il ne restait plus qu'à le rapprocher de lui-même. Les
// paramètres fmtMin/fmtVal de l'époque des mois BMCE n'étaient plus passés
// par personne.
const CurseurAnnee = (p: { min: number; max: number; value: number; onChange: (a: number) => void }) =>
  <CurseurAnneeNace {...p} largeur={170} />;

// Barres horizontales top-N pour [{label, valeur}]
function MiniBarres({ data, couleur = BLEU, fmt = (v: number) => nf(v), max = 6 }: { data: { label: string; valeur: number }[]; couleur?: string; fmt?: (v: number) => string; max?: number }) {
  const rows = (data || []).slice(0, max);
  const mx = Math.max(1, ...rows.map((r) => r.valeur || 0));
  if (rows.length === 0) return <p style={{ color: "var(--gris)", fontSize: 13, textAlign: "center", padding: "30px 0" }}>Aucune donnée.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 12.5, color: "var(--encre)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            <span className="ds-donnee" style={{ fontSize: 12.5, fontWeight: 700, color: ENCRE, flexShrink: 0 }}>{fmt(r.valeur)}</span>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: "var(--bleu-voile)", overflow: "hidden" }}>
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
  if (data.length === 0) return <p style={{ color: "var(--gris)", fontSize: 13, textAlign: "center", padding: "30px 0" }}>Aucune donnée.</p>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
      <thead><tr>
        <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 9.5, fontWeight: 800, color: "var(--gris-fort)", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "2px solid var(--bleu-voile)", width: 30 }}>#</th>
        <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 9.5, fontWeight: 800, color: "var(--gris-fort)", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "2px solid var(--bleu-voile)" }}>{colNom}</th>
        <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 9.5, fontWeight: 800, color: "var(--gris-fort)", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "2px solid var(--bleu-voile)" }}>{colVal}</th>
      </tr></thead>
      <tbody>
        {data.map((r, i) => (
          <tr key={r.nom + i} style={{ borderBottom: "1px solid var(--filet)", background: i % 2 ? "rgb(var(--encre-rgb) / 0.018)" : "transparent" }}>
            <td style={{ padding: "6px 8px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 999, background: i < 3 ? couleur : "var(--bleu-voile)", color: i < 3 ? "var(--sur-bleu)" : "var(--texte)", fontSize: 10, fontWeight: 800 }}>{i + 1}</span>
            </td>
            <td style={{ padding: "6px 8px", fontWeight: 650, color: ENCRE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
              {drapeaux && <span style={{ marginRight: 7, display: "inline-flex", verticalAlign: "middle" }}><DrapeauPays iso={r.iso2} nom={r.nom} taille={14} /></span>}{r.nom}
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
const ZONES_SEN: { cle: string; titre: string; abrege: string; trouve: (g: { code: string; nom_fr: string; categorie: string }) => boolean }[] = [
  { cle: "afrique", titre: "Afrique", abrege: "Afrique", trouve: (g) => g.categorie === "continent" && g.nom_fr === "Afrique" },
  { cle: "afrique_ouest", titre: "Afrique occidentale", abrege: "Afrique occ.", trouve: (g) => g.categorie === "Afrique" && /occident|ouest/i.test(g.nom_fr) },
  { cle: "cedeao", titre: "CEDEAO", abrege: "CEDEAO", trouve: (g) => g.code === "CEDEAO" },
  { cle: "uemoa", titre: "UEMOA", abrege: "UEMOA", trouve: (g) => g.code === "UEMOA" },
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
  const fondSen = "linear-gradient(90deg, rgb(var(--bleu-rgb) / 0.10), rgb(var(--bleu-rgb) / 0.02))";
  return (
    <div className="ds-carte" style={{ padding: "20px 22px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <p title={nomComplet} style={{ ...TITRE_SEC, margin: 0, flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{titre}</span>
          {tag && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--gris)", background: "var(--bleu-voile)", padding: "2px 8px", borderRadius: 5, letterSpacing: "0.04em", textTransform: "none", fontVariantNumeric: "tabular-nums" }}>{tag}</span>}
        </p>
        <Segment value={dir} onChange={onDir} options={[{ v: "entrant", l: "Flux entrants" }, { v: "sortant", l: "Flux sortants" }]} />
      </div>
      {chargement ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} style={{ height: 24, borderRadius: 7, background: i % 2 ? "rgb(var(--encre-rgb) / 0.05)" : "rgb(var(--encre-rgb) / 0.08)" }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--gris)", fontSize: 13, textAlign: "center", padding: "30px 0" }}>Aucune donnée{tag ? ` pour ${tag}` : ""}.</p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
            <span style={{ width: 22, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase", flexShrink: 0 }}>#</span>
            <span style={{ flex: 1, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" }}>Pays</span>
            <span style={{ width: 68, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase", textAlign: "right", flexShrink: 0 }}>Valeur</span>
            <span style={{ width: 40, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase", textAlign: "right", flexShrink: 0 }}>Part</span>
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
                      <span style={{ width: 22, textAlign: "center", color: "var(--gris)", fontSize: 12, fontWeight: 800, lineHeight: 1, flexShrink: 0 }}>⋮</span>
                      <span style={{ flex: 1, height: 1, background: "var(--champ)" }} />
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 8,
                    background: sen ? fondSen : zebre ? "rgb(var(--encre-rgb) / 0.018)" : "transparent",
                    border: sen ? "1px solid rgb(var(--bleu-rgb) / 0.30)" : "1px solid transparent",
                    boxShadow: sen ? "0 1px 6px rgb(var(--ombre-rgb) / 0.10)" : "none" }}>
                    <span style={{ width: 22, flexShrink: 0 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 3px", borderRadius: 10,
                        background: sen || podium ? BLEU : "var(--bleu-voile)", color: sen || podium ? "var(--sur-bleu)" : "var(--texte)", fontSize: 10, fontWeight: 800 }}>{rang}</span>
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <DrapeauPays iso={r.code_iso2} nom={r.pays} taille={14} />
                      <span title={r.pays} style={{ fontSize: 12, fontWeight: sen ? 800 : 650, color: sen ? BLEU : ENCRE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.pays}</span>
                      {sen && horsTop && <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: BLEU, background: "rgb(var(--bleu-rgb) / 0.10)", padding: "2px 7px", borderRadius: 999, flexShrink: 0, whiteSpace: "nowrap" }}>{rang}ᵉ DU CLASSEMENT</span>}
                    </span>
                    <span className="ds-donnee" style={{ width: 68, fontSize: 11.5, fontWeight: 800, color: BLEU, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmtMUSD(r.valeur)}</span>
                    <span style={{ width: 40, fontSize: 10, fontWeight: 700, color: "var(--texte)", textAlign: "right", flexShrink: 0 }}>
                      {total > 0 ? `${nf(Math.max(0, r.valeur) / total * 100)} %` : "—"}
                    </span>
                    <div style={{ width: "22%", height: 7, background: "var(--bleu-voile)", borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
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

// Petite navigation par flèches, pour parcourir une liste sans la déplier :
// une année de plus, une portée de classement de plus. Les extrémités
// désactivent la flèche correspondante plutôt que de boucler, pour qu'on sache
// où l'on est dans la liste.
function NavFleches({ libelle, onPrec, onSuiv, titre, fort }: {
  libelle: React.ReactNode; onPrec?: () => void; onSuiv?: () => void; titre?: string; fort?: boolean;
}) {
  const fleche = (fn: (() => void) | undefined, d: "‹" | "›", aria: string) => (
    <button onClick={fn} disabled={!fn} aria-label={aria}
      style={{ border: "none", background: "transparent", cursor: fn ? "pointer" : "default", padding: "0 4px",
        fontSize: 13, lineHeight: 1, fontWeight: 800, fontFamily: "var(--font-google-sans)", flexShrink: 0,
        color: fort ? (fn ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)") : (fn ? "var(--gris)" : "var(--sur-bleu)") }}>{d}</button>
  );
  return (
    <span title={titre} style={{ display: "inline-flex", alignItems: "center", flexShrink: 0,
      ...(fort ? { background: BLEU, borderRadius: 999, padding: "3px 5px" } : {}) }}>
      {fleche(onPrec, "‹", "Précédent")}
      <span style={{ fontSize: fort ? 11 : 10.5, fontWeight: fort ? 800 : 700, color: fort ? "var(--sur-bleu)" : "var(--gris)",
        whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{libelle}</span>
      {fleche(onSuiv, "›", "Suivant")}
    </span>
  );
}

// KPI du bandeau. Deux dispositions, selon qu'il y a un rang à montrer :
//
//   flux d'IDE  — la valeur et sa variation partagent la première ligne, le
//                 rang du Sénégal occupe la seconde avec sa navigation de
//                 portée. La variation porte sur la VALEUR, pas sur le rang :
//                 c'est la grandeur affichée juste à côté.
//   commerce    — même dessin que les KPIs de la section 3, dont ces deux
//                 cartes sont le résumé : libellé, millésime, valeur, écart.
//
// La comparaison se dit « vs » quand elle voisine la valeur, faute de place, et
// « par rapport à » quand elle a sa ligne.
function KpiBandeau({ label, annee, onAnnee, anneeMin, anneeMax, prefixeAnnee, valeur, chargement,
  delta, rang, portee, onPortee, portees }: {
  label: string; annee: number | null; onAnnee: (a: number) => void; anneeMin?: number; anneeMax?: number;
  prefixeAnnee?: string; valeur: string; chargement?: boolean; delta?: number | null;
  rang?: number | null; portee?: { abrege: string; nomComplet: string }; onPortee?: (pas: -1 | 1) => void;
  portees?: { avant: boolean; apres: boolean };
}) {
  const avecRang = !!(portee && onPortee);
  // Le composant partagé, présenté sur une ligne. `court` n'a plus d'objet
  // depuis que la référence s'écrit « vs 2024 » dans les deux cas — il reste
  // pour ne pas toucher aux points d'appel.
  const VariationLigne = (_: { court?: boolean }) =>
    delta == null ? null : <Variation valeur={delta} annee={annee != null ? annee - 1 : null} taille={11.5} />;
  return (
    <div className="ds-carte" style={{ padding: "16px 18px", boxShadow: "var(--ombre-2)", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <p style={{ flex: 1, minWidth: 0, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em", color: BLEU,
          textTransform: "uppercase", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</p>
        {annee != null && (
          <NavFleches libelle={prefixeAnnee ? `${prefixeAnnee} · ${annee}` : annee} titre="Changer d'année"
            onPrec={anneeMin != null && annee > anneeMin ? () => onAnnee(annee - 1) : undefined}
            onSuiv={anneeMax != null && annee < anneeMax ? () => onAnnee(annee + 1) : undefined} />
        )}
      </div>
      {chargement ? (
        <>
          <div style={{ height: 26, width: "60%", borderRadius: 7, background: "rgb(var(--encre-rgb) / 0.08)", marginBottom: 10 }} />
          <div style={{ height: 13, width: "80%", borderRadius: 6, background: "rgb(var(--encre-rgb) / 0.05)" }} />
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
            <p className="ds-donnee" style={{ fontSize: "1.6rem", fontWeight: 800, color: ENCRE, margin: 0, lineHeight: 1.1,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{valeur}</p>
            {avecRang && <VariationLigne />}
          </div>
          <div style={{ marginTop: 9, minHeight: 20, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            {avecRang ? (
              <NavFleches fort titre={`Rang du Sénégal — ${portee!.nomComplet}. Flèches : changer de classement.`}
                libelle={<>{rang != null ? `${rang}ᵉ · ` : ""}{portee!.abrege}</>}
                onPrec={portees?.avant ? () => onPortee!(-1) : undefined}
                onSuiv={portees?.apres ? () => onPortee!(1) : undefined} />
            ) : <VariationLigne />}
          </div>
        </>
      )}
    </div>
  );
}

// Matrice de valeurs partenaire × ressource (intensité = valeur)
function MatriceRessources({ ressources, partenaires, fmt = (v: number) => nf(v), colPartenaire = "Partenaire" }: { ressources: string[]; partenaires: { nom: string; valeurs: number[] }[]; fmt?: (v: number) => string; colPartenaire?: string }) {
  if (!partenaires.length || !ressources.length) return <p style={{ color: "var(--gris)", fontSize: 13, textAlign: "center", padding: "30px 0" }}>Aucune donnée.</p>;
  const max = Math.max(1, ...partenaires.flatMap((p) => p.valeurs));
  const thRes: React.CSSProperties = { padding: "6px 8px", textAlign: "center", fontSize: 9.5, fontWeight: 800, color: "var(--gris-fort)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--bleu-voile)", verticalAlign: "bottom", minWidth: 74, maxWidth: 110, lineHeight: 1.15 };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
        <thead><tr>
          <th style={{ padding: "6px 10px 6px 4px", textAlign: "left", fontSize: 9.5, fontWeight: 800, color: "var(--gris-fort)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid var(--bleu-voile)", position: "sticky", left: 0, background: "var(--carte)", zIndex: 1 }}>{colPartenaire}</th>
          {ressources.map((r) => <th key={r} style={thRes}>{r}</th>)}
        </tr></thead>
        <tbody>
          {partenaires.map((p) => (
            <tr key={p.nom}>
              <td style={{ padding: "7px 10px 7px 4px", fontWeight: 700, color: ENCRE, whiteSpace: "nowrap", position: "sticky", left: 0, background: "var(--carte)", borderBottom: "1px solid var(--filet)" }}>{p.nom}</td>
              {p.valeurs.map((v, i) => {
                const t = v > 0 ? v / max : 0;
                return (
                  <td key={i} title={v > 0 ? `${p.nom} · ${ressources[i]} : ${fmt(v)}` : undefined}
                    style={{ textAlign: "center", padding: "7px 8px", fontSize: 11, fontWeight: 650, whiteSpace: "nowrap", borderBottom: "1px solid var(--filet)", background: v > 0 ? `rgba(0,79,145,${(0.06 + t * 0.52).toFixed(3)})` : "transparent", color: t > 0.5 ? "var(--sur-bleu)" : "var(--texte)" }}>
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
          {tag && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--gris)", background: "var(--bleu-voile)", padding: "2px 8px", borderRadius: 5, letterSpacing: "0.04em", textTransform: "none", fontVariantNumeric: "tabular-nums" }}>{tag}</span>}
        </p>
      )}
      {sousTitre && <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 600, color: "var(--gris)", fontStyle: "italic" }}>{sousTitre}</p>}
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
  // Dans l'URL comme partout ailleurs : F5 et lien partagé conservent l'onglet.
  const [onglet, setOnglet] = useEtatUrl<"viz" | "tables">("onglet", "viz", ["viz", "tables"]);

  // Données
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
  // Commerce extérieur : Notes d'analyse du commerce extérieur (NACE, ANSD),
  // la même source que l'onglet dédié — annuelle, et non plus mensuelle.
  const [naceProd, setNaceProd] = useState<any>(null);   // totaux et séries
  const [nacePays, setNacePays] = useState<any>(null);   // partenaires
  const [naceGU, setNaceGU] = useState<any>(null);       // groupes d'utilisation
  const [comAnneeSel, setComAnneeSel] = useState<number | null>(null);
  const [comDir, setComDir] = useState<"export" | "import">("export");
  const [socio, setSocio] = useState<any[]>([]);
  const [socioPays, setSocioPays] = useState<string>("Sénégal");

  useEffect(() => {
    getJSON(`${API}/ide/cnuced?direction=entrant&indicateur=flux`).then((d) => setIdeFlux(Array.isArray(d) ? d : []));
    getJSON(`${API}/ide/cnuced?direction=entrant&indicateur=stock`).then((d) => setIdeStock(Array.isArray(d) ? d : []));
    getJSON(`${API}/ide/cnuced?direction=sortant&indicateur=flux`).then((d) => setIdeFluxSort(Array.isArray(d) ? d : []));
    getJSON(`${API}/ide/cnuced?direction=sortant&indicateur=stock`).then((d) => setIdeStockSort(Array.isArray(d) ? d : []));
    getJSON(`${API}/nace/principaux-produits`).then(setNaceProd);
    getJSON(`${API}/nace/groupes-utilisation`).then(setNaceGU);
    getJSON(`${API}/nace/pays`).then(setNacePays);

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

  // Flux bilatéraux : KPIs, tops et répartition dépendent de la direction et
  // de l'année. Chaque triplet n'est demandé qu'UNE fois par session — glisser
  // le curseur sur dix ans tirait trois requêtes par cran, et revenir sur une
  // année déjà vue re-payait tout. Le cache est un ref : le remplir ne doit
  // pas re-rendre, seule l'arrivée des données affichées le fait.
  const bilatCache = useRef<Map<string, { kpis: any; tops: any; repart: any }>>(new Map());
  useEffect(() => {
    if (!commCtx || bilatAnnee == null) return;
    const cle = `${bilatDir}|${bilatAnnee}`;
    const poser = (d: { kpis: any; tops: any; repart: any }) => {
      setBilat(d.kpis); setBilatTops(d.tops); setBilatRepart(d.repart);
    };
    const connu = bilatCache.current.get(cle);
    if (connu) { poser(connu); return; }
    const base = `pays_id=${commCtx.id}&direction=${bilatDir}`;
    const an = `annee_min=${bilatAnnee}&annee_max=${bilatAnnee}`;
    let annule = false;
    Promise.all([
      getJSON(`${API}/statistiques/commerce/kpis?${base}&${an}`),
      getJSON(`${API}/statistiques/commerce/tops?${base}&${an}&limite=8`),
      getJSON(`${API}/statistiques/commerce/repartition?${base}&${an}&limite=6`),
    ]).then(([kpis, tops, repart]) => {
      const d = { kpis, tops, repart };
      bilatCache.current.set(cle, d);
      // Réponse d'une sélection dépassée : mise en cache, mais pas affichée.
      if (!annule) poser(d);
    });
    return () => { annule = true; };
  }, [commCtx, bilatDir, bilatAnnee]);

  // Commerce extérieur (NACE) : année choisie au curseur, dernière par défaut.
  // Tout se calcule côté client à partir des trois familles déjà chargées —
  // l'API les livre entières, il n'y a pas de requête par année à faire.
  const comAnnees: number[] = useMemo(() => (naceProd?.annees || []) as number[], [naceProd]);
  const comAnnee = comAnneeSel ?? (comAnnees.length ? comAnnees[comAnnees.length - 1] : null);

  // Total d'un sens sur une année : la somme des principaux produits égale le
  // TOTAL imprimé par l'ANSD, aux arrondis près.
  const comTotal = useCallback((sens: "export" | "import", an: number | null): number | null => {
    if (an == null || !naceProd?.disponible) return null;
    const l = (naceProd.donnees?.[sens] || []).filter((r: any) => r.annee === an);
    return l.length ? l.reduce((t: number, r: any) => t + (r.valeur ?? 0), 0) : null;
  }, [naceProd]);

  // Partenaires d'un sens sur une année, « Autres pays » écarté : ce n'est pas
  // un pays et il capterait la première place de plusieurs régions.
  const comPartenaires = useCallback((sens: "export" | "import", an: number | null) => {
    if (an == null || !nacePays?.disponible) return [] as { nom: string; valeur: number; iso2: string | null }[];
    const m = new Map<string, { nom: string; valeur: number; iso2: string | null }>();
    for (const r of nacePays.donnees?.[sens] || []) {
      if (r.annee !== an || r.pays === "Autres pays") continue;
      const e = m.get(r.pays) ?? { nom: r.pays, valeur: 0, iso2: r.code_iso2 ?? null };
      e.valeur += r.valeur ?? 0;
      m.set(r.pays, e);
    }
    return [...m.values()].filter(x => x.valeur > 0).sort((a, b) => b.valeur - a.valeur);
  }, [nacePays]);

  // Section 3 : partenaires de l'année et suivi du premier sur l'année d'avant,
  // calculés UNE fois par (sens, année). Ces balayages du fichier pays NACE
  // (plusieurs milliers de lignes) se refaisaient à chaque rendu — chaque cran
  // de curseur, chaque survol re-payait deux parcours complets. Le premier
  // partenaire est suivi PAR SON NOM sur l'année précédente : la variation
  // compare le même pays, pas le premier de chaque millésime.
  const comTops = useMemo(() => {
    const an = comAnnee, prec = an != null ? an - 1 : null;
    const tops = comPartenaires(comDir, an);
    const top = tops[0] ?? null;
    const topPrec = top ? comPartenaires(comDir, prec).find(x => x.nom === top.nom) ?? null : null;
    return { tops, topPrec };
  }, [comDir, comAnnee, comPartenaires]);

  // ── Dérivés socio-économiques ──
  // Le tableau plat de l'API est indexé UNE fois par indicateur (série triée) :
  // valeurs des KPIs et séries des graphes se servent ensuite en O(1) — les
  // sept filtre+tri qui se rejouaient à chaque rendu disparaissent.
  const socioParIndicateur = useMemo(() => {
    const m = new Map<string, { annee: number; valeur: number }[]>();
    for (const r of socio) {
      if (r.valeur == null) continue;
      let l = m.get(r.indicateur);
      if (!l) { l = []; m.set(r.indicateur, l); }
      l.push({ annee: r.annee as number, valeur: r.valeur as number });
    }
    for (const l of m.values()) l.sort((a, b) => a.annee - b.annee);
    return m;
  }, [socio]);
  const serieSocio = useCallback((code: string) => socioParIndicateur.get(code) ?? [], [socioParIndicateur]);

  const socioBornes = useMemo(() => {
    const ans = SOCIO_KPIS.flatMap((c) => serieSocio(c)).map((r) => r.annee);
    return ans.length ? { min: Math.min(...ans), max: Math.max(...ans) } : null;
  }, [serieSocio]);
  const [socioAnneeSel, setSocioAnneeSel] = useState<number | null>(null);
  const socioAnnee = socioAnneeSel ?? socioBornes?.max ?? null;

  // Valeur à l'année du curseur + valeur disponible précédente (variation ▲/▼ %).
  // `prev.valeur != null` et non un test de vérité : une valeur nulle (0) est
  // un vrai point de comparaison, pas une absence.
  const socioVal = useCallback((code: string) => {
    const rows = serieSocio(code);
    if (!rows.length || socioAnnee == null) return null;
    const last = rows.find((r) => r.annee === socioAnnee) || null;
    const avant = rows.filter((r) => r.annee < socioAnnee);
    const prev = avant.length ? avant[avant.length - 1] : null;
    const delta = last && prev && prev.valeur ? ((last.valeur - prev.valeur) / Math.abs(prev.valeur)) * 100 : null;
    return { valeur: (last?.valeur as number) ?? null, annee: socioAnnee, prevAnnee: last ? ((prev?.annee as number) ?? null) : null, delta };
  }, [serieSocio, socioAnnee]);
  const { pib, pop, pibHab, croiss } = useMemo(() => ({
    pib: socioVal("pib"), pop: socioVal("population"),
    pibHab: socioVal("pib_hab"), croiss: socioVal("croissance_pib"),
  }), [socioVal]);
  const seriePib = serieSocio("pib");

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
    () => ZONES_SEN.map((z) => { const g = grpMonde.find(z.trouve); return g ? { cle: z.cle, titre: z.titre, abrege: z.abrege, code: g.code, nomComplet: g.nom_fr } : null; })
      .filter(Boolean) as { cle: string; titre: string; abrege: string; code: string; nomComplet: string }[],
    [grpMonde]);
  const [zoneDir, setZoneDir] = useState<Record<string, "entrant" | "sortant">>({});

  // Classements mémorisés par (groupement, année) : les KPIs du haut et les
  // tableaux de la section 1 puisent au même endroit, et chaque couple n'est
  // demandé qu'une fois — naviguer d'une année à l'autre puis revenir ne
  // relance rien. Un code vide vaut le monde entier : l'API classe alors tous
  // les pays, sans restriction de groupement.
  const [classements, setClassements] = useState<Record<string, { entrant: LigneTopZone[]; sortant: LigneTopZone[] }>>({});
  const enVol = useRef<Set<string>>(new Set());
  const cleClass = (code: string, annee: number) => `${code || "MONDE"}|${annee}`;
  const [besoins, setBesoins] = useState<{ code: string; annee: number }[]>([]);
  useEffect(() => {
    besoins.forEach(({ code, annee }) => {
      const k = cleClass(code, annee);
      if (classements[k] || enVol.current.has(k)) return;
      enVol.current.add(k);
      const q = code ? `&code=${encodeURIComponent(code)}` : "";
      getJSON(`${API}/ide/monde/global?indicateur=flux${q}&annees=${annee}`)
        .then((d) => setClassements((p) => ({ ...p, [k]: d?.tops ?? { entrant: [], sortant: [] } })))
        .finally(() => enVol.current.delete(k));
    });
  }, [besoins, classements]);
  // Enregistre un couple à charger. Le tableau de besoins ne grandit que sur
  // du nouveau, sinon l'effet ci-dessus se rappellerait sans fin.
  const exigerClassement = useCallback((code: string, annee: number | null) => {
    if (annee == null) return;
    setBesoins((p) => p.some((b) => b.code === code && b.annee === annee) ? p : [...p, { code, annee }]);
  }, []);
  const senDans = (tops?: LigneTopZone[]) => tops?.find((r) => r.pays === "Sénégal" || r.pays === "Senegal") ?? null;

  // Portées de classement offertes aux KPIs, du plus large au plus étroit.
  // Le monde n'est pas un groupement du référentiel : c'est l'appel sans code,
  // que l'API interprète comme « tous les pays ». Les quatre autres viennent du
  // référentiel et disparaissent d'elles-mêmes si elles n'y sont pas.
  const zonesRang = useMemo(() => [
    { cle: "monde", code: "", abrege: "Monde", nomComplet: "Classement mondial" },
    ...zonesSen.map((z) => ({ cle: z.cle, code: z.code, abrege: z.abrege, nomComplet: z.nomComplet })),
  ], [zonesSen]);
  const IDX_AFRIQUE = 1;   // portée par défaut, juste après le monde

  // Une année et une portée par carte de flux : les deux sens se comparent mal
  // s'ils ne peuvent pas être réglés séparément.
  const [kpiFluxAnnee, setKpiFluxAnnee] = useState<Record<string, number>>({});
  const [kpiFluxZone, setKpiFluxZone] = useState<Record<string, number>>({ entrant: IDX_AFRIQUE, sortant: IDX_AFRIQUE });
  const [kpiComAnnee, setKpiComAnnee] = useState<Record<string, number>>({});

  // Les KPIs déclarent ce dont ils ont besoin — année affichée et précédente,
  // pour la variation de rang — et le cache s'en charge.
  useEffect(() => {
    (["entrant", "sortant"] as const).forEach((sens) => {
      const an = kpiFluxAnnee[sens] ?? ideBornes?.max ?? null;
      const z = zonesRang[Math.min(kpiFluxZone[sens] ?? IDX_AFRIQUE, zonesRang.length - 1)];
      if (!z || an == null) return;
      exigerClassement(z.code, an);
      exigerClassement(z.code, an - 1);
    });
  }, [kpiFluxAnnee, kpiFluxZone, zonesRang, ideBornes, exigerClassement]);

  // Les tableaux de la section 1 suivent le curseur de leur section.
  useEffect(() => { zonesSen.forEach((z) => exigerClassement(z.code, ideAnnee)); },
    [zonesSen, ideAnnee, exigerClassement]);

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
    <main style={{ minHeight: "100vh", background: "var(--ds-fond, var(--champ))", fontFamily: "var(--font-google-sans)" }}>
      <style>{`
        .tdb-kpis { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
        .tdb-duo  { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; align-items: stretch; }
        @media (max-width: 980px) { .tdb-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); } .tdb-duo { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .tdb-kpis { grid-template-columns: 1fr; } }
      `}</style>
      {/* ── Bandeau exécutif ── */}
      <div style={{ background: "var(--degrade-hero)", color: "var(--sur-bleu)", padding: "30px 40px 78px" }}>
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
            {/* ── Bandeau de KPIs (chevauche le hero) : les deux sens des flux
                 d'IDE, avec le rang du Sénégal dans un classement dont on
                 change la portée aux flèches, puis les deux sens du commerce
                 extérieur. Chaque carte porte sa propre année. ── */}
            <div className="tdb-kpis" style={{ marginTop: -48, position: "relative", zIndex: 2 }}>
              {(["entrant", "sortant"] as const).map((sens) => {
                const an = kpiFluxAnnee[sens] ?? ideBornes?.max ?? null;
                const iz = kpiFluxZone[sens] ?? 0;
                const z = zonesRang[Math.min(iz, zonesRang.length - 1)];
                const cur = an != null ? classements[cleClass(z.code, an)] : undefined;
                const prec = an != null ? classements[cleClass(z.code, an - 1)] : undefined;
                const sen = senDans(cur?.[sens]);
                const senP = senDans(prec?.[sens]);
                return (
                  <KpiBandeau key={sens} label={sens === "entrant" ? "Flux entrants" : "Flux sortants"}
                    annee={an} onAnnee={(a) => setKpiFluxAnnee((p) => ({ ...p, [sens]: a }))}
                    anneeMin={ideBornes?.min} anneeMax={ideBornes?.max}
                    valeur={fmtMUSD(sen?.valeur ?? null)} chargement={!cur}
                    // La variation porte sur le montant des flux, la grandeur
                    // affichée à côté ; le rang, lui, se lit sur la ligne du bas.
                    delta={sen?.valeur != null && senP?.valeur ? ((sen.valeur - senP.valeur) / Math.abs(senP.valeur)) * 100 : null}
                    rang={sen?.rang ?? null}
                    portee={{ abrege: z.abrege, nomComplet: z.nomComplet }}
                    portees={{ avant: iz > 0, apres: iz < zonesRang.length - 1 }}
                    onPortee={(pas) => setKpiFluxZone((p) => ({
                      ...p, [sens]: Math.max(0, Math.min(zonesRang.length - 1, iz + pas)) }))} />
                );
              })}
              {(["export", "import"] as const).map((sens) => {
                const an = kpiComAnnee[sens] ?? (comAnnees.length ? comAnnees[comAnnees.length - 1] : null);
                const v = comTotal(sens, an), p = comTotal(sens, an != null ? an - 1 : null);
                return (
                  <KpiBandeau key={sens} label={sens === "export" ? "Exportations" : "Importations"}
                    annee={an} onAnnee={(a) => setKpiComAnnee((q) => ({ ...q, [sens]: a }))}
                    anneeMin={comAnnees[0]} anneeMax={comAnnees[comAnnees.length - 1]}
                    // FAB à l'export, CAF à l'import : la mention accompagne le
                    // millésime comme dans la section 3, dont ces cartes sont
                    // le résumé.
                    prefixeAnnee={sens === "export" ? "FAB" : "CAF"}
                    valeur={fmtMFCFA(v)} chargement={!naceProd}
                    delta={v != null && p != null && p !== 0 ? ((v - p) / Math.abs(p)) * 100 : null} />
                );
              })}
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
                  // Repli sans code (groupements pas encore résolus) : squelette
                  // obligatoire. Lire cleClass("", année) servirait la clé MONDE —
                  // un classement mondial s'afficherait sous le titre « Afrique »
                  // ou « CEDEAO » le temps de la résolution.
                  const st = z.code && ideAnnee != null ? classements[cleClass(z.code, ideAnnee)] : undefined;
                  const dir = zoneDir[z.code] ?? "entrant";
                  return (
                    <TableauZoneSenegal key={z.cle} titre={z.titre} nomComplet={z.nomComplet}
                      tag={ideAnnee != null ? String(ideAnnee) : undefined}
                      rows={st?.[dir] ?? []} chargement={!st}
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
                        ) : <p style={{ color: "var(--gris)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Données indisponibles.</p>}
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

            {/* ── 3. Commerce extérieur (NACE) ── */}
            <section style={{ marginTop: 40 }}>
              <SectionHead n={3} titre="Commerce extérieur" extra={
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                  <Segment value={comDir} onChange={setComDir} options={[{ v: "export", l: "Exportations" }, { v: "import", l: "Importations" }]} />
                  {comAnnee != null && comAnnees.length > 1 && (
                    <CurseurAnnee min={comAnnees[0]} max={comAnnees[comAnnees.length - 1]} value={comAnnee} onChange={setComAnneeSel} />
                  )}
                </div>
              } />
              {(() => {
                const exp = comDir === "export";
                const an = comAnnee;
                const tag = an != null ? String(an) : undefined;
                const prec = an != null ? an - 1 : null;
                const tot = comTotal(comDir, an), totPrec = comTotal(comDir, prec);
                const { tops, topPrec } = comTops;
                const varDe = (v: number | null, p: number | null) =>
                  v != null && p != null && p !== 0 ? ((v - p) / Math.abs(p)) * 100 : null;
                const top = tops[0] ?? null;
                const part = top && tot ? (top.valeur / tot) * 100 : null;
                const totP = comTotal(comDir, prec);
                const partPrec = topPrec && totP ? (topPrec.valeur / totP) * 100 : null;
                const expTot = comTotal("export", an), impTot = comTotal("import", an);
                const taux = expTot != null && impTot ? (expTot / impTot) * 100 : null;
                const expP = comTotal("export", prec), impP = comTotal("import", prec);
                const tauxPrec = expP != null && impP ? (expP / impP) * 100 : null;
                return (
                  <div className="tdb-kpis">
                    <Kpi label={exp ? "Exportations" : "Importations"} tag={tag ? `${exp ? "FAB" : "CAF"} · ${tag}` : undefined}
                      valeur={fmtMFCFA(tot)} delta={varDe(tot, totPrec)} refAnnee={prec} />
                    <Kpi texte label={exp ? "1er client" : "1er fournisseur"} tag={tag}
                      valeur={top?.nom || "—"} sousLabel={top ? fmtMFCFA(top.valeur) : ""}
                      delta={varDe(top?.valeur ?? null, topPrec?.valeur ?? null)} refAnnee={prec} />
                    <Kpi label={exp ? "Part du 1er client" : "Part du 1er fournisseur"} tag={tag}
                      valeur={part != null ? `${nf(part, 1)} %` : "—"} delta={varDe(part, partPrec)} refAnnee={prec} />
                    <Kpi label="Taux de couverture" tag={tag} valeur={taux != null ? `${nf(taux, 1)} %` : "—"}
                      delta={varDe(taux, tauxPrec)} refAnnee={prec} sousLabel="export / import" />
                  </div>
                );
              })()}

              {(() => {
                const exp = comDir === "export";
                const an = comAnnee;
                const tag = an != null ? String(an) : undefined;
                // Les deux graphes reçoivent des FCFA bruts, pas des millions :
                // l'échelle du composant met en forme ses graduations elle-même,
                // sans surcharge possible, et lirait « 4M » là où il s'agit de
                // 3 909 Md. La conversion est locale aux séries ; partout
                // ailleurs la section reste dans l'unité de la NACE.
                const enFcfa = (v: number | null) => (v == null ? null : v * 1e6);
                const evoData = comAnnees.map(a => ({ annee: a, valeur: enFcfa(comTotal(comDir, a)) }));
                const balData = comAnnees.map(a => {
                  const e = comTotal("export", a), i = comTotal("import", a);
                  return { annee: a, valeur: e != null && i != null ? enFcfa(e - i) : null };
                });
                const plage = comAnnees.length ? `${comAnnees[0]}–${comAnnees[comAnnees.length - 1]}` : undefined;
                const partenaires = comTops.tops;
                // Groupes d'utilisation : la nomenclature exhaustive du rapport,
                // celle qui répond à « à quoi servent ces marchandises ».
                const groupes = an == null || !naceGU?.disponible ? []
                  : (naceGU.donnees?.[comDir] || [])
                      .filter((r: any) => r.annee === an && (r.valeur ?? 0) > 0)
                      .map((r: any) => ({ label: r.groupe, valeur: r.valeur as number }))
                      .sort((a: any, b: any) => b.valeur - a.valeur);
                const vide = <p style={{ color: "var(--gris)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Données indisponibles.</p>;
                return (
                  <>
                    <div className="tdb-duo" style={{ marginTop: 20 }}>
                      <Carte titre={exp ? "Évolution des exportations" : "Évolution des importations"} tag={plage}>
                        {evoData.length > 1 ? (
                          <GrapheMultiPays height={220} type="line" fmt={(v) => fmtFCFA(v)} series={[serie(exp ? "Exportations" : "Importations", PALETTE_COMPARAISON[0], evoData)]} />
                        ) : vide}
                      </Carte>
                      <Carte titre="Balance commerciale" tag={plage}>
                        {balData.length > 1 ? (
                          <GrapheMultiPays height={220} type="line" fmt={(v) => fmtFCFA(v)} series={[serie("Balance", PALETTE_COMPARAISON[1], balData)]} />
                        ) : vide}
                      </Carte>
                    </div>
                    <div className="tdb-duo" style={{ marginTop: 16 }}>
                      <Carte titre={exp ? "Principaux clients à l'exportation" : "Principaux fournisseurs à l'importation"} tag={tag}>
                        <TopTable rows={partenaires.slice(0, 7).map(p => ({ nom: p.nom, valeur: p.valeur, iso2: p.iso2 }))}
                          colNom="Pays" colVal="Valeur" fmt={(v) => fmtMFCFA(v)} max={7} drapeaux />
                      </Carte>
                      <Carte titre={exp ? "Poids des ressources exportées" : "Poids des ressources importées"} sousTitre="Groupe d'utilisation" tag={tag}>
                        <MiniBarres data={groupes} couleur={PALETTE_COMPARAISON[0]} fmt={(v) => fmtMFCFA(v)} max={7} />
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
                const vide = <p style={{ color: "var(--gris)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Données indisponibles.</p>;
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
                            { nom: "Balance", couleur: "var(--danger)", data: balM },
                          ]} />
                        ) : vide}
                      </Carte>
                      <Carte titre="Échanges de services" tag={plage(expS.length ? expS : impS)}>
                        {(expS.length > 1 || impS.length > 1) ? (
                          <GrapheMultiPays height={220} type="line" dualAxis={false} fmt={(v) => fmtUSD(v)} series={[
                            { nom: "Exportations", couleur: PALETTE_COMPARAISON[2], data: expS, dash: "6,4" },
                            { nom: "Importations", couleur: PALETTE_COMPARAISON[0], data: impS, dash: "6,4" },
                            { nom: "Balance", couleur: "var(--danger)", data: balS },
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
