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
      background: "var(--carte)", borderRight: "1px solid var(--bordure-forte)",
      // La rangée qui le porte a la hauteur de la fenêtre : le panneau la
      // remplit et défile pour son propre compte. overscroll-behavior empêche
      // le défilement de se propager à la page quand on arrive en bout de
      // liste — c'est ce qui rend les deux zones vraiment indépendantes.
      height: "100%", overflowY: "auto", overscrollBehavior: "contain",
      display: "flex", flexDirection: "column" }}>
      <style>{`::-webkit-scrollbar-thumb{background:var(--fond-creux2)}::-webkit-scrollbar-thumb:hover{background:var(--fond-creux2)}`}</style>
      {ouvert && <div onMouseDown={startResize}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 10,
          background: "transparent", transition: "background 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.5)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }} />}
      <div style={{ padding: ouvert ? "14px 16px 10px" : "12px 8px", borderBottom: "1px solid var(--bordure)",
        display: "flex", alignItems: "center", justifyContent: ouvert ? "space-between" : "center", flexShrink: 0 }}>
        {ouvert && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--encre)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Filtres</span>}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => setOuvert(o => !o)} aria-label={ouvert ? "Réduire les filtres" : "Afficher les filtres"}
            style={{ background: "rgb(var(--bleu-rgb) / 0.08)", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px",
              display: "flex", alignItems: "center", gap: 5 }}>
            <SlidersHorizontal size={14} style={{ color: "var(--bleu)" }} />
            {ouvert && nbFiltres > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--bleu)",
              background: "rgb(var(--bleu-rgb) / 0.15)", borderRadius: 999, padding: "1px 5px" }}>{nbFiltres}</span>}
          </button>
          {ouvert && aDesFiltres && <button onClick={onReinit} title="Tout réinitialiser" aria-label="Tout réinitialiser"
            style={{ background: "rgb(var(--danger-rgb) / 0.08)", border: "1px solid rgb(var(--danger-rgb) / 0.20)", cursor: "pointer",
              borderRadius: 999, padding: 5, display: "flex", alignItems: "center", transition: "background 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgb(var(--danger-rgb) / 0.15)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgb(var(--danger-rgb) / 0.08)"; }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: "var(--danger)",
              fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight: 1 }}>close</span>
          </button>}
        </div>
      </div>
      {ouvert && <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
        <div style={{ position: "relative", marginBottom: 18 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--gris)" }} />
          <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher…"
            style={{ width: "100%", paddingLeft: 30, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8,
              border: "1px solid var(--bordure-forte)", background: "var(--carte-douce)", fontSize: 12, color: "var(--encre)", outline: "none",
              fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }} />
          {recherche && <button onClick={() => setRecherche("")} aria-label="Effacer la recherche"
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none",
              border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "var(--gris)" }} /></button>}
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
/**
 * Props clavier d'une carte cliquable : Entrée et Espace équivalent au clic.
 *
 * `label` est vivement recommandé dès que la carte contient du texte : sans
 * lui, le nom accessible du role="button" est TOUT le contenu de la carte —
 * une carte d'événement s'annonce « Web Summit 7ème édition Date 30 juil.
 * Lieu Madrid Modifier Retirer ». Avec, elle s'annonce d'une phrase.
 */
export function carteCliquable(ouvrir: () => void, label?: string) {
  return {
    onClick: ouvrir,
    role: "button" as const,
    tabIndex: 0,
    ...(label ? { "aria-label": label } : {}),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(); }
    },
  };
}
