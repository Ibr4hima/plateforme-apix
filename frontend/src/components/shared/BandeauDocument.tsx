"use client";
/**
 * Bandeau des pages documentaires (Code des investissements, Lexique…) —
 * LA version unique : armoiries, surtitre, titre, sous-titre et rangée
 * d'outils sur le dégradé institutionnel. Les deux pages portaient chacune
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
    <div data-bandeau style={{ background: "linear-gradient(155deg,#002a52 0%,#003a6e 35%,#004f91 70%,#1a6ab0 100%)", color: "#fff", padding: "32px 40px 92px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, minWidth: 0 }}>
            <div style={{ width: 54, height: 66, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}>
              <Image src="/armoiries_senegal.svg" alt="Armoiries du Sénégal" width={54} height={66} style={{ height: 64, width: "auto", objectFit: "contain" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", margin: "2px 0 8px" }}>{surtitre}</p>
              <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.01em" }}>{titre}</h1>
              <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)", margin: "9px 0 0", fontWeight: 500 }}>{sousTitre}</p>
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <NavActions onDark home flouTotal />
          </div>
        </div>
        {outils && <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 20 }}>{outils}</div>}
      </div>
    </div>
  );
}

/** Champ de recherche pilule sur fond sombre, avec bouton d'effacement. */
export function RechercheBandeau({ q, setQ, ariaLabel = "Rechercher" }: {
  q: string;
  setQ: (v: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div style={{ position: "relative", width: "min(300px, 100%)", flexShrink: 0 }}>
      <Search size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.6)" }} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" aria-label={ariaLabel}
        style={{ width: "100%", background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 999, padding: "9px 34px 9px 38px", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.55)"; e.currentTarget.style.background = "rgba(255,255,255,0.20)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; e.currentTarget.style.background = "rgba(255,255,255,0.13)"; }} />
      {q && <button onClick={() => setQ("")} aria-label="Effacer la recherche"
        style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
        <X size={12} style={{ color: "rgba(255,255,255,0.7)" }} />
      </button>}
    </div>
  );
}
