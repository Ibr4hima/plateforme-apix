"use client";

// La variation d'un KPI — une flèche de tendance, un pourcentage, l'année de
// référence.
//
// Un seul composant pour tous les KPI de la plateforme : le motif était
// recopié à cinq endroits, avec à chaque fois ses propres tailles et ses
// propres couleurs.
//
// ── Les glyphes ──────────────────────────────────────────────────────────────
// trending_up / trending_down de Material Symbols, servis par la police
// AUTO-HÉBERGÉE de public/polices — pas par fonts.googleapis.com. Le
// sous-ensemble a été régénéré pour les inclure ; la marche à suivre est notée
// dans globals.css.
//
// Ils remplacent les triangles ▲ ▼, qui étaient des caractères Unicode : leur
// dessin dépendait de la police du système, leur taille ne suivait pas celle du
// texte, et aucun lecteur d'écran ne les annonçait utilement.

import React from "react";

/** Le sens d'une variation, en toutes lettres — pour les lecteurs d'écran. */
const sens = (v: number) => (v > 0 ? "en hausse de" : v < 0 ? "en baisse de" : "stable, variation de");

export default function Variation({ valeur, annee, taille = 10.5, surFonce }: {
  /** La variation en pourcentage. `null` n'affiche rien. */
  valeur: number | null | undefined;
  /** L'année de comparaison — affichée « vs 2024 ». */
  annee?: number | null;
  taille?: number;
  /** Posé sur un aplat sombre : le rouge y serait illisible. */
  surFonce?: boolean;
}) {
  if (valeur == null || !isFinite(valeur)) return null;
  const hausse = valeur > 0, baisse = valeur < 0;
  const couleur = hausse ? "var(--vert)"
    : baisse ? (surFonce ? "var(--danger-voile)" : "var(--danger)")
    : (surFonce ? "rgba(255,255,255,0.7)" : "var(--gris)");

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: taille, fontWeight: 800, color: couleur,
        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
      }}>
        {/* Le cas nul garde le signe « = » : il n'y a pas de tendance à
            dessiner, et cela évite d'embarquer un troisième glyphe. */}
        {hausse || baisse ? (
          <span className="material-symbols-outlined" aria-hidden style={{
            // L'icône suit la taille du texte, à un cheveu près : à l'identique
            // elle paraît plus grosse que les chiffres qu'elle accompagne.
            fontSize: taille + 4, lineHeight: 1,
            fontVariationSettings: "'FILL' 0, 'wght' 600, 'GRAD' 0, 'opsz' 20",
          }}>
            {hausse ? "trending_up" : "trending_down"}
          </span>
        ) : <span aria-hidden>=</span>}
        <span className="sr-only">{sens(valeur)} </span>
        {Math.abs(valeur).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
      </span>
      {annee != null && (
        <span style={{ fontSize: taille - 0.5, color: "var(--gris)", whiteSpace: "nowrap" }}>vs {annee}</span>
      )}
    </span>
  );
}
