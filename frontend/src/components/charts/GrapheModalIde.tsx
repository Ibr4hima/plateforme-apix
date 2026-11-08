"use client";

// ── Un graphe en grand — la fenêtre des cartes de graphe (IDE, Statistiques) ──
// Dans la coquille commune des fiches (FicheModal) : voile sans flou, panneau
// centré, Échap et focus gérés, aucune balise <style> insérée à l'ouverture.
// En tête, le titre, puis la période, l'unité et la source ; dans le corps, la
// légende (dès deux séries), le graphe et, s'il y en a une, l'analyse ; au
// pied, le téléchargement en PNG.

import { useRef } from "react";
import FicheModal, { FicheRubrique } from "@/components/shared/FicheModal";
import { downloadPNG } from "@/components/charts/outilsExport";
import LegendeGraphe from "@/components/charts/LegendeGraphe";

type SerieModal = { nom: string; couleur: string; data: { annee: number; valeur: number | null }[] };

/** L'intervalle d'années réellement couvert par les séries */
function periode(series: SerieModal[]): string {
  const as = series.flatMap(s => s.data.filter(d => d.valeur !== null).map(d => d.annee));
  if (!as.length) return "";
  const mn = Math.min(...as), mx = Math.max(...as);
  return mn === mx ? String(mn) : `${mn}–${mx}`;
}

export function GrapheModal({ open, onClose, titre, sous_titre, unite, source, children, analyse, series, grapheId }: {
  open: boolean;
  onClose: () => void;
  titre: string;
  sous_titre?: string;
  unite?: string;
  source?: string;
  children: React.ReactNode;
  analyse?: { titre: string; commentaire: string } | null;
  series?: SerieModal[] | null;
  grapheId?: string;
}) {
  const corps = useRef<HTMLDivElement>(null);
  if (!open) return null;
  const visibles = (series || []).filter(s => s.data.some(d => d.valeur !== null));
  const annees = periode(visibles);
  const telecharger = () => {
    const svg = corps.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;
    downloadPNG(svg, grapheId || titre || "graphe", {
      titre: unite ? `${titre} · ${unite}` : titre,
      annees: annees.replace("–", " – "),
      legende: visibles.map(s => ({ nom: s.nom, couleur: s.couleur })),
    });
  };
  const reperes = [annees, unite, source ? `Source : ${source}` : ""].filter(Boolean);

  return (
    <FicheModal titre={titre} onClose={onClose} zIndex={500} maxWidth={1100}
      meta={reperes.length ? <>{reperes.map(r => <span key={r}>{r}</span>)}</> : undefined}
      actions={
        <button onClick={telecharger} className="ds-bouton ds-bouton--primaire" style={{ height: 36, padding: "0 16px", fontSize: 13 }}>
          Télécharger en PNG
        </button>
      }>
      {sous_titre && <p className="graphe-carte-note" style={{ margin: "0 0 12px" }}>{sous_titre}</p>}
      {visibles.length > 1 && <LegendeGraphe series={visibles} style={{ marginBottom: 14 }} />}
      <div ref={corps}>{children}</div>
      {analyse && (
        <FicheRubrique titre={analyse.titre}>
          <p className="fiche-texte" style={{ margin: 0 }}>{analyse.commentaire}</p>
        </FicheRubrique>
      )}
    </FicheModal>
  );
}
