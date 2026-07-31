"use client";
/**
 * Coquille du panneau latéral de filtres — LA version unique.
 *
 * Accords, Événements et Entreprises portaient chacune ~70 lignes identiques :
 * bande repliable, poignée de redimensionnement, en-tête « FILTRES » avec
 * compteur, bouton de réinitialisation, champ de recherche. Trois copies qui
 * avaient déjà commencé à dériver (libellés d'aria, tailles). Les pages ne
 * fournissent plus que leurs sections de filtres en enfants.
 */
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRef, useState } from "react";
import { demarrerRedimension } from "@/lib/redimension";

export default function PanneauFiltres({ nbFiltres, aDesFiltres, onReinit,
  recherche, setRecherche, children }: {
  nbFiltres: number;
  aDesFiltres: boolean;
  onReinit: () => void;
  recherche: string;
  setRecherche: (v: string) => void;
  children: React.ReactNode;
}) {
  const [ouvert, setOuvert] = useState(true);
  const [largeur, setLargeur] = useState(280);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, largeur, setLargeur, isResizing, 200, 520);

  return (
    <aside style={{ width: ouvert ? largeur : 52, flexShrink: 0, transition: isResizing.current ? "none" : "width 0.25s",
      background: "#fff", borderRight: "1px solid #E8E5E3", height: "100vh", overflowY: "auto",
      position: "sticky", top: 0, display: "flex", flexDirection: "column" }}>
      <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
      {ouvert && <div onMouseDown={startResize}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 10,
          background: "transparent", transition: "background 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.5)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }} />}
      <div style={{ padding: ouvert ? "14px 16px 10px" : "12px 8px", borderBottom: "1px solid #F2F0EF",
        display: "flex", alignItems: "center", justifyContent: ouvert ? "space-between" : "center", flexShrink: 0 }}>
        {ouvert && <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", letterSpacing: "0.08em", textTransform: "uppercase" }}>Filtres</span>}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => setOuvert(o => !o)} aria-label={ouvert ? "Réduire les filtres" : "Afficher les filtres"}
            style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px",
              display: "flex", alignItems: "center", gap: 5 }}>
            <SlidersHorizontal size={14} style={{ color: "#004f91" }} />
            {ouvert && nbFiltres > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91",
              background: "rgba(0,79,145,0.15)", borderRadius: 999, padding: "1px 5px" }}>{nbFiltres}</span>}
          </button>
          {ouvert && aDesFiltres && <button onClick={onReinit} title="Tout réinitialiser" aria-label="Tout réinitialiser"
            style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.20)", cursor: "pointer",
              borderRadius: 999, padding: 5, display: "flex", alignItems: "center", transition: "background 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.15)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(220,38,38,0.08)"; }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: "#dc2626",
              fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight: 1 }}>close</span>
          </button>}
        </div>
      </div>
      {ouvert && <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
        <div style={{ position: "relative", marginBottom: 18 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
          <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher…"
            style={{ width: "100%", paddingLeft: 30, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8,
              border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 12, color: "#1a1a2e", outline: "none",
              fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }} />
          {recherche && <button onClick={() => setRecherche("")} aria-label="Effacer la recherche"
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none",
              border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "#9aa5b4" }} /></button>}
        </div>
        {children}
      </div>}
    </aside>
  );
}

/**
 * Compteur de résultats sous filtre — les trois pages n'en affichaient aucun :
 * après un filtrage, impossible de savoir combien la liste comptait d'entrées.
 */
export function CompteurResultats({ n, singulier, pluriel }: { n: number; singulier: string; pluriel?: string }) {
  return (
    <p style={{ fontSize: 12, fontWeight: 600, color: "#9aa5b4", margin: "0 0 12px" }}>
      {n.toLocaleString("fr-FR")} {n > 1 ? (pluriel ?? singulier + "s") : singulier}
    </p>
  );
}

/** Props clavier d'une carte cliquable : Entrée et Espace équivalent au clic. */
export function carteCliquable(ouvrir: () => void) {
  return {
    onClick: ouvrir,
    role: "button" as const,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(); }
    },
  };
}
