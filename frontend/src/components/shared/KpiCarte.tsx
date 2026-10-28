"use client";

// La carte KPI du tableau de bord : le libellé en petites capitales bleues, son
// millésime en étiquette, la valeur, puis sa variation ou une légende. Partagée
// avec l'accueil, qui en reprend deux — la même carte, pas une imitation.

import React from "react";
import Variation from "@/components/shared/Variation";

export default function KpiCarte({ label, valeur, tag, delta, rouge, sousLabel, refAnnee, texte }: { label: string; valeur: string; tag?: string; delta?: number | null; rouge?: boolean; sousLabel?: string; refAnnee?: number | string | null; texte?: boolean }) {
  // Valeur textuelle longue (nom de ressource, de pays…) : police réduite,
  // retour à la ligne sur 2 lignes plutôt qu'un texte tronqué.
  const styleValeur: React.CSSProperties = texte
    ? { fontSize: "1.15rem", fontWeight: 800, color: rouge ? "var(--danger)" : "var(--encre)", margin: 0, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }
    : { fontSize: "1.65rem", fontWeight: 800, color: rouge ? "var(--danger)" : "var(--encre)", margin: 0, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  return (
    <div className="ds-carte" style={{ padding: "18px 20px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "var(--bleu)", textTransform: "uppercase", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</p>
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
