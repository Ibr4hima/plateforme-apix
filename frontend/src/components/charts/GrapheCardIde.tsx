"use client";

// ── Les cartes de graphe (IDE, Statistiques, Investissements nationaux) ──────
// Deux présentations, un même habillage (classes .graphe-carte* de
// globals.css) :
//  - la carte STATIQUE, pleine largeur : le graphe vit sur place (le survol y
//    donne l'année et la valeur), l'export en PNG est un bouton discret de
//    l'en-tête ;
//  - la VIGNETTE, dans une grille : un clic l'ouvre en grand (GrapheModal).
// En tête, le titre en petites capitales et la période à sa suite, en gris ;
// dessous, l'unité ; la légende dès deux séries (une seule série : le titre
// la nomme).

import { useRef, useState } from "react";
import { GrapheModal } from "@/components/charts/GrapheModalIde";
import { downloadPNG } from "@/components/charts/outilsExport";
import LegendeGraphe from "@/components/charts/LegendeGraphe";

type SerieCarte = { nom: string; couleur: string; data: { annee: number; valeur: number | null }[] };
const avecDonnees = (series?: SerieCarte[] | null) => (series || []).filter(s => s.data.some(d => d.valeur !== null));

function IconeExport() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// ── Carte statique ────────────────────────────────────────────────────────────
function CarteStatique({ titre, tag, unite, series, grapheId, hideLegend, sansExport, children }: {
  titre: string; tag?: string; unite?: string; series?: SerieCarte[] | null; grapheId?: string;
  hideLegend?: boolean; sansExport?: boolean; children: React.ReactNode;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const visibles = avecDonnees(series);
  const telecharger = () => {
    const svg = boite.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;
    // Le PNG porte son propre en-tête : sorti de la page, il doit encore dire
    // ce qu'il montre, sur quelle période et avec quelles séries.
    downloadPNG(svg, grapheId || titre || "graphe", {
      titre: unite ? `${titre} · ${unite}` : titre,
      annees: tag ? tag.replace("–", " – ") : "",
      legende: visibles.map(s => ({ nom: s.nom, couleur: s.couleur })),
    });
  };
  return (
    <div className="graphe-carte">
      <div className="graphe-carte-tete">
        <div style={{ minWidth: 0 }}>
          <h3 className="graphe-carte-titre">
            {titre}{tag && <span className="graphe-carte-periode">{" · "}{tag}</span>}
          </h3>
          {unite && <p className="graphe-carte-note">{unite}</p>}
        </div>
        {/* Pas de bouton quand le contenu n'est pas un SVG (un tableau) : il
            n'y aurait rien à exporter, et un bouton inerte est pire que rien */}
        {!sansExport && (
          <button onClick={telecharger} className="graphe-export" title="Télécharger le graphe en PNG" aria-label={`Télécharger « ${titre} » en PNG`}>
            <IconeExport />
          </button>
        )}
      </div>
      {!hideLegend && visibles.length > 1 && <LegendeGraphe series={visibles} style={{ marginBottom: 10 }} />}
      <div ref={boite}>{children}</div>
    </div>
  );
}

// ── Vignette (grille) ou carte statique (pleine largeur) ─────────────────────
export function GrapheCard({ titre, sous_titre, unite, source, children, fullChildren, analyse, series, grapheId, hideLegend, hideSousTitre, statique, tag, sansExport }: {
  titre: string;
  sous_titre?: string;
  unite?: string;
  source?: string;
  children: React.ReactNode;
  fullChildren?: React.ReactNode;
  analyse?: { titre: string; commentaire: string } | null;
  series?: SerieCarte[] | null;
  grapheId?: string;
  hideLegend?: boolean;
  hideSousTitre?: boolean;
  /** Pleine largeur : le graphe vit sur place, sans fenêtre */
  statique?: boolean;
  /** La période, écrite à la suite du titre */
  tag?: string;
  sansExport?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (statique) return <CarteStatique titre={titre} tag={tag} unite={unite} series={series} grapheId={grapheId} hideLegend={hideLegend} sansExport={sansExport}>{children}</CarteStatique>;

  // La vignette n'a ni pied ni place pour trois lignes : unité, source et
  // note s'y recomposent en une seule ligne discrète.
  const note = [unite, source, sous_titre].filter(Boolean).join(" · ");
  const visibles = avecDonnees(series);
  return (
    <>
      {/* Le soulèvement au survol passe par `top`, pas par `transform` : une
          transition de transform compose la carte à part, et le navigateur
          redécoupe en calques tout ce qui est peint après elle (mesuré sur les
          cartes KPI : ≈ 75 ms par image) */}
      <div className="graphe-carte" role="button" tabIndex={0} aria-label={`Agrandir le graphe « ${titre} »`}
        onClick={() => setOpen(true)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); } }}
        style={{ position: "relative", top: 0, cursor: "pointer", transition: "box-shadow 0.18s, top 0.18s, border-color 0.18s" }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--ombre-survol)"; e.currentTarget.style.top = "-2px"; e.currentTarget.style.borderColor = "rgb(var(--bleu-rgb) / 0.35)"; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.top = "0"; e.currentTarget.style.borderColor = "rgb(var(--encre-rgb) / 0.12)"; }}>
        <div className="graphe-carte-tete" style={{ marginBottom: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 className="graphe-carte-titre" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={titre}>{titre}</h3>
            {!hideSousTitre && note && <p className="graphe-carte-note">{note}</p>}
          </div>
          {analyse && <span className="fiche-statut" data-ton="bleu" style={{ flexShrink: 0 }}>Analyse</span>}
        </div>
        {!hideLegend && visibles.length > 1 && <LegendeGraphe series={visibles} style={{ marginBottom: 8 }} />}
        <div style={{ pointerEvents: "none" }}>{children}</div>
      </div>

      <GrapheModal open={open} onClose={() => setOpen(false)} titre={titre} sous_titre={sous_titre} unite={unite} source={source} analyse={analyse} series={series} grapheId={grapheId}>
        {fullChildren || children}
      </GrapheModal>
    </>
  );
}
