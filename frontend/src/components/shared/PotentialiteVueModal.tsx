"use client";

// Fiche potentialité territoriale — page Opportunités et recherche globale (⌘K).
// Bâtie sur la fiche modale commune (FicheModal).

import { useNaema } from "@/lib/referentiels";
import { useDonnees } from "@/lib/donnees";
import FicheModal, { FicheArbreNaema, FicheBloc, FicheDocs, FicheGrille, FicheSection, FicheTexteRiche, FicheValeur } from "@/components/shared/FicheModal";

import { API_BASE as API } from "@/lib/api";

// Le nom de chaque niveau territorial, en tête du bloc « Zone »
const NIVEAU_LIBELLE: Record<string, string> = {
  pole: "Pôle territoire", region: "Région", departement: "Département", arrondissement: "Arrondissement",
};

// `pot` peut n'être que la tuile de la liste (titre, lieux, thématiques) : la
// fiche s'ouvre aussitôt dessus, et la fiche complète (description,
// documents), demandée ici — souvent déjà en cache depuis le survol de la
// tuile —, la complète à son arrivée.
export default function PotentialiteVueModal({ pot, onClose }: { pot:any; onClose:()=>void }) {
  const qFiche = useDonnees<any>(`${API}/opportunites/potentialites/${pot.id}`);
  const p = qFiche.data ?? pot;
  // Le lieu de la fiche, à son propre niveau : un arrondissement affichait le
  // nom de sa région
  const zoneNom = p.niveau && p.niveau !== "global"
    ? p.niveau_nom || ""
    : p.pole_nom || p.region_nom || p.departement_nom || p.arrondissement_nom || "";
  // Référentiels NAEMA servis par le cache partagé
  const { secteurs, branches, activites } = useNaema();

  return (
    <FicheModal titre={p.titre} onClose={onClose} maxWidth={660}
>

      {/* Zone — ancienne pastille du titre, désormais nommée */}
      {zoneNom && (
        <FicheSection titre="Zone">
          <FicheGrille>
            <FicheBloc label={NIVEAU_LIBELLE[p.niveau] ?? "Zone"} full>
              <FicheValeur>{zoneNom}</FicheValeur>
            </FicheBloc>
          </FicheGrille>
        </FicheSection>
      )}

      {/* Activités porteuses — cascade NAEMA */}
      {(p.secteur_ids?.length > 0 || p.branche_ids?.length > 0) && (
        <FicheSection titre="Activités porteuses">
          <FicheArbreNaema secteurs={secteurs} branches={branches} activites={activites}
            secIds={p.secteur_ids || []} braIds={p.branche_ids || []} actIds={p.activite_ids || []} />
        </FicheSection>
      )}

      {/* Description */}
      {p.description && (
        <FicheSection titre="Description">
          <FicheTexteRiche html={p.description} />
        </FicheSection>
      )}

      {/* Documents */}
      <FicheDocs fichiers={p.fichiers || []} hrefDe={f => `${API}/opportunites/potentialites/${p.id}/fichiers/${f.id}/download`} />
    </FicheModal>
  );
}
