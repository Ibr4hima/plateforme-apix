"use client";

// Fiche potentialité territoriale — page Opportunités et recherche globale (⌘K).
// Bâtie sur la fiche modale commune (FicheModal).

import { useEffect, useState } from "react";
import { useNaema } from "@/lib/referentiels";
import { COMP_PALETTE, badgeDe, badge_bleu, badge_orange, badge_vert, badge_violet } from "@/lib/couleurs";
import FicheModal, { FicheArbreNaema, FicheCarteNeutre, FicheDocs, FicheSection, FicheTexteRiche } from "@/components/shared/FicheModal";

import { API_BASE as API } from "@/lib/api";

// Pastille du niveau territorial — mêmes teintes que les cards de la page
const NIVEAU_BADGE: Record<string, React.CSSProperties> = {
  pole: badge_bleu, region: badge_orange, departement: badge_vert, arrondissement: badge_violet,
};

export default function PotentialiteVueModal({ pot: p, refAvantages, onClose }: { pot:any; refAvantages:any[]; onClose:()=>void }) {
  const zoneNom = p.pole_nom || p.region_nom || p.departement_nom || p.arrondissement_nom || "";
  const [fichiers, setFichiers] = useState<any[]>(p.fichiers || []);
  // Référentiels NAEMA servis par le cache partagé
  const { secteurs, branches, activites } = useNaema();

  useEffect(() => {
    fetch(`${API}/opportunites/potentialites/${p.id}`)
      .then(r => r.json())
      .then(d => setFichiers(d.fichiers || []))
      .catch(() => {});
  }, [p.id]);

  // Atouts groupés par catégorie ; chaque catégorie cycle sur la palette
  const avantagesSelected = refAvantages.filter(a => (p.avantage_ids || []).includes(a.id));
  const catMap: Record<string, string[]> = {};
  avantagesSelected.forEach((a: any) => {
    const cat = a.categorie_libelle || "Autres";
    (catMap[cat] ||= []).push(a.libelle);
  });

  return (
    <FicheModal titre={p.titre} onClose={onClose} maxWidth={660}
      badges={zoneNom ? <span style={NIVEAU_BADGE[p.niveau] || badge_bleu}>{zoneNom}</span> : undefined}>

      {/* Activités porteuses — cascade NAEMA */}
      {(p.secteur_ids?.length > 0 || p.branche_ids?.length > 0) && (
        <FicheSection titre="Activités porteuses">
          <FicheArbreNaema secteurs={secteurs} branches={branches} activites={activites}
            secIds={p.secteur_ids || []} braIds={p.branche_ids || []} actIds={p.activite_ids || []} />
        </FicheSection>
      )}

      {/* Atouts et potentialités par catégorie */}
      {Object.keys(catMap).length > 0 && (
        <FicheSection titre="Atouts et potentialités">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(catMap).map(([cat, items], ci) => {
              const color = COMP_PALETTE[ci % COMP_PALETTE.length];
              return (
                <FicheCarteNeutre key={cat}>
                  <div style={{ fontSize: "var(--t-105)", fontWeight: 700, color, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>{cat}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {items.map((item, i) => <span key={i} style={badgeDe(color)}>{item}</span>)}
                  </div>
                </FicheCarteNeutre>
              );
            })}
          </div>
        </FicheSection>
      )}

      {/* Description */}
      {p.description && (
        <FicheSection titre="Description">
          <FicheTexteRiche html={p.description} />
        </FicheSection>
      )}

      {/* Documents */}
      <FicheDocs fichiers={fichiers} hrefDe={f => `${API}/opportunites/potentialites/${p.id}/fichiers/${f.id}/download`} />
    </FicheModal>
  );
}
