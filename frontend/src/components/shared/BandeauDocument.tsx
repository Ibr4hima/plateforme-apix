"use client";
/**
 * En-tête des pages documentaires (Code des investissements, Lexique…) —
 * LA version unique : armoiries, surtitre, titre, sous-titre et rangée
 * d'outils, écrits à même le fond de la page. Les deux pages portaient chacune
 * ~60 lignes identiques qui avaient commencé à dériver (espacements, aria).
 */
import Image from "next/image";
import { Search, X } from "lucide-react";
import NavActions from "@/components/layout/NavActions";

export default function BandeauDocument({ surtitre, titre, sousTitre, outils }: {
  surtitre: string;
  titre: React.ReactNode;
  sousTitre: React.ReactNode;
  outils?: React.ReactNode; // rangée sous le titre : onglets, recherche, index…
}) {
  return (
    <div data-bandeau style={{ background: "var(--fond)", color: "var(--encre)", padding: "28px 40px 24px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, minWidth: 0 }}>
            <div style={{ width: 54, height: 66, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Image src="/armoiries_senegal.svg" alt="Armoiries du Sénégal" width={54} height={66} style={{ height: 64, width: "auto", objectFit: "contain" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bleu)", margin: "2px 0 8px" }}>{surtitre}</p>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, lineHeight: 1.2, letterSpacing: "-0.02em" }}>{titre}</h1>
              <p style={{ fontSize: 13, color: "var(--gris-fort)", margin: "9px 0 0", fontWeight: 500 }}>{sousTitre}</p>
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <NavActions home flouTotal />
          </div>
        </div>
        {outils && <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 20 }}>{outils}</div>}
      </div>
    </div>
  );
}

/** Champ de recherche de l'en-tête, avec bouton d'effacement. */
export function RechercheBandeau({ q, setQ, ariaLabel = "Rechercher" }: {
  q: string;
  setQ: (v: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div style={{ position: "relative", width: "min(300px, 100%)", flexShrink: 0 }}>
      <Search size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--gris-fort)", pointerEvents: "none" }} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" aria-label={ariaLabel}
        className="ds-champ" style={{ height: 36, padding: "0 34px 0 36px", fontSize: 13 }} />
      {q && <button onClick={() => setQ("")} aria-label="Effacer la recherche"
        style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
        <X size={12} style={{ color: "var(--gris-fort)" }} />
      </button>}
    </div>
  );
}
