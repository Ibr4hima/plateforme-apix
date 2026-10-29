"use client";

// Le classement d'un groupement dont fait partie le Sénégal — les dix premiers
// pays en flux d'IDE (rang, drapeau, valeur, part, barre), le Sénégal toujours
// mis en valeur, et la bascule entrants / sortants. Partagé par le tableau de
// bord et l'accueil. À l'étroit (.classement-zone, dans globals.css), la
// pastille du rang puis les barres s'effacent devant les noms des pays.

import { Fragment } from "react";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { nf, fmtMillionsUSD as fmtMUSD } from "@/lib/format";

// ── Groupements du Sénégal (section IDE) ─────────────────────────────────────
// Les 4 zones dont le Sénégal fait partie, résolues par nom/code dans la
// liste renvoyée par /ide/monde/groupements.
export const ZONES_SEN: { cle: string; titre: string; abrege: string; trouve: (g: { code: string; nom_fr: string; categorie: string }) => boolean }[] = [
  { cle: "afrique", titre: "Afrique", abrege: "Afrique", trouve: (g) => g.categorie === "continent" && g.nom_fr === "Afrique" },
  { cle: "afrique_ouest", titre: "Afrique occidentale", abrege: "Afrique occ.", trouve: (g) => g.categorie === "Afrique" && /occident|ouest/i.test(g.nom_fr) },
  { cle: "cedeao", titre: "CEDEAO", abrege: "CEDEAO", trouve: (g) => g.code === "CEDEAO" },
  { cle: "uemoa", titre: "UEMOA", abrege: "UEMOA", trouve: (g) => g.code === "UEMOA" },
];

export type LigneTopZone = { pays: string; code_iso2?: string | null; valeur: number; rang?: number };

// Top 10 des pays d'une zone (rang · drapeau · pays · valeur · part · barre),
// bascule Flux entrants ⇆ sortants ; l'année vient du curseur de la section.
// Le Sénégal est toujours mis en valeur (ajouté après le top s'il en sort).
export default function TableauZoneSenegal({ titre, nomComplet, tag, rows, chargement, dir, onDir }: {
  titre: string; nomComplet?: string; tag?: string; rows: LigneTopZone[];
  chargement: boolean; dir: "entrant" | "sortant"; onDir: (d: "entrant" | "sortant") => void;
}) {
  const enTop = rows.filter((r, i) => (r.rang ?? i + 1) <= 10);
  const total = enTop.reduce((t, r) => t + Math.max(0, r.valeur), 0);
  const max = Math.max(1e-9, ...enTop.map((r) => r.valeur));
  const estSen = (r: LigneTopZone) => r.pays === "Sénégal" || r.pays === "Senegal";
  const fondSen = "rgb(var(--bleu-rgb) / 0.06)";
  return (
    <div className="ds-carte classement-zone" style={{ padding: "20px 22px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Le titre tient sur une ligne : faute de place, c'est la bascule qui
          passe dessous */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <p title={nomComplet} style={{ fontSize: 11, fontWeight: 800, color: "var(--bleu)", letterSpacing: "0.14em", textTransform: "uppercase", margin: 0, flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ whiteSpace: "nowrap" }}>{titre}</span>
          {tag && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--gris)", background: "var(--bleu-voile)", padding: "2px 8px", borderRadius: 5, letterSpacing: "0.04em", textTransform: "none", fontVariantNumeric: "tabular-nums" }}>{tag}</span>}
        </p>
        <div className="ds-segments" style={{ padding: 3, gap: 2, flexShrink: 0 }}>
          {([["entrant", "Flux entrants"], ["sortant", "Flux sortants"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => onDir(v)} aria-pressed={dir === v} className="ds-segment"
              style={{ padding: "5px 14px", fontSize: 12 }}>{l}</button>
          ))}
        </div>
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
            <span style={{ width: 22, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em", color: "var(--gris-fort)", textTransform: "uppercase", flexShrink: 0 }}>#</span>
            <span style={{ flex: 1, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em", color: "var(--gris-fort)", textTransform: "uppercase" }}>Pays</span>
            <span style={{ width: 68, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em", color: "var(--gris-fort)", textTransform: "uppercase", textAlign: "right", flexShrink: 0 }}>Valeur</span>
            <span style={{ width: 40, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em", color: "var(--gris-fort)", textTransform: "uppercase", textAlign: "right", flexShrink: 0 }}>Part</span>
            <span className="classement-zone-barre" style={{ width: "22%", flexShrink: 0 }} />
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
                      <span style={{ flex: 1, height: 1, background: "var(--filet)" }} />
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 8,
                    background: sen ? fondSen : zebre ? "rgb(var(--encre-rgb) / 0.018)" : "transparent",
                    border: sen ? "1px solid rgb(var(--bleu-rgb) / 0.30)" : "1px solid transparent" }}>
                    <span style={{ width: 22, flexShrink: 0 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 3px", borderRadius: 10,
                        background: sen || podium ? "var(--bleu)" : "var(--bleu-voile)", color: sen || podium ? "var(--sur-bleu)" : "var(--texte)", fontSize: 10, fontWeight: 800 }}>{rang}</span>
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <DrapeauPays iso={r.code_iso2} nom={r.pays} taille={14} />
                      <span title={r.pays} style={{ fontSize: 12, fontWeight: sen ? 800 : 650, color: sen ? "var(--bleu)" : "var(--encre)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.pays}</span>
                      {sen && horsTop && <span className="classement-zone-rang" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--bleu)", background: "rgb(var(--bleu-rgb) / 0.10)", padding: "2px 7px", borderRadius: 999, flexShrink: 0, whiteSpace: "nowrap" }}>{rang}ᵉ DU CLASSEMENT</span>}
                    </span>
                    <span className="ds-donnee" style={{ width: 68, fontSize: 11.5, fontWeight: 800, color: "var(--bleu)", textAlign: "right", flexShrink: 0, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmtMUSD(r.valeur)}</span>
                    <span style={{ width: 40, fontSize: 10, fontWeight: 700, color: "var(--texte)", textAlign: "right", flexShrink: 0 }}>
                      {total > 0 ? `${nf(Math.max(0, r.valeur) / total * 100)} %` : "—"}
                    </span>
                    <div className="classement-zone-barre" style={{ width: "22%", height: 7, background: "var(--bleu-voile)", borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
                      {r.valeur > 0 && <div style={{ height: "100%", width: `${Math.min(100, Math.max(2, r.valeur / max * 100))}%`, borderRadius: 99, background: "var(--bleu)", opacity: sen ? 1 : podium ? 0.9 : 0.55 }} />}
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
