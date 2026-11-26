"use client";

// La carte KPI du tableau de bord : le libellé en petites capitales bleues, son
// millésime en étiquette, la valeur, puis sa variation ou une légende. Partagée
// avec l'accueil, qui en reprend deux — la même carte, pas une imitation.

//
// `chargement` : la valeur n'est pas encore arrivée. La carte tient alors SA
// TAILLE FINALE — même boîte pour la valeur, même ligne dessous — avec deux
// barres grises à la place des chiffres. Elle affichait un tiret, c'est-à-dire
// « pas de donnée », le temps que la donnée arrive ; et la ligne du bas,
// vide, était plus basse que remplie : la carte grandissait à l'arrivée.

import React from "react";
import Variation from "@/components/shared/Variation";
import { Skeleton } from "@/components/shared/Skeleton";

export default function KpiCarte({ label, valeur, tag, delta, rouge, sousLabel, refAnnee, texte, chargement }: { label: string; valeur: string; tag?: string; delta?: number | null; rouge?: boolean; sousLabel?: string; refAnnee?: number | string | null; texte?: boolean; chargement?: boolean }) {
  // Valeur textuelle longue (nom de ressource, de pays…) : police réduite,
  // retour à la ligne sur 2 lignes plutôt qu'un texte tronqué.
  const styleValeur: React.CSSProperties = texte
    ? { fontSize: "1.15rem", fontWeight: 800, color: rouge ? "var(--danger)" : "var(--encre)", margin: 0, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }
    : { fontSize: "1.65rem", fontWeight: 800, color: rouge ? "var(--danger)" : "var(--encre)", margin: 0, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  return (
    <div className="ds-carte" style={{ padding: "18px 20px", minWidth: 0 }}>
      {/* 17 px : la hauteur de la ligne quand elle porte son millésime, qui
          arrive avec les données — sans elle, la carte prenait deux pixels. */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, minHeight: 17 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "var(--bleu)", textTransform: "uppercase", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</p>
        {tag && <span style={{ fontSize: 8.5, fontWeight: 700, color: "var(--gris)", background: "var(--bleu-voile)", padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0 }}>{tag}</span>}
      </div>
      {chargement
        // La boîte de la valeur, à sa hauteur : une ligne de la police qu'elle aura.
        ? <div aria-hidden style={{ height: texte ? "1.38rem" : "1.815rem", display: "flex", alignItems: "center" }}><Skeleton w="58%" h={18} r={6} /></div>
        : <p className="ds-donnee" style={styleValeur}>{valeur}</p>}
      {/* 18 px : la hauteur de la ligne quand elle porte une variation. */}
      <div style={{ marginTop: 8, minHeight: 18, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {chargement ? <Skeleton w="42%" h={9} r={4} /> : <>
          {sousLabel && <span style={{ fontSize: 10.5, color: "var(--gris)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sousLabel}</span>}
          {delta != null && <Variation valeur={delta} annee={refAnnee != null ? Number(refAnnee) : null} taille={11.5} />}
        </>}
      </div>
    </div>
  );
}
