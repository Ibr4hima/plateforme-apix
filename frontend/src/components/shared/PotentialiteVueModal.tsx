"use client";

// Fiche potentialité territoriale — page Opportunités et recherche globale.
// Bâtie sur la fiche modale commune (FicheModal), dans le dessin des autres
// fiches :
//   en-tête   — le niveau territorial en surtitre ; le titre ; le
//               rattachement de la zone (département, région) ;
//   faits     — la zone, ses activités porteuses, dans un aplat ;
//   rubriques — activités porteuses, description, documents.

import { useNaema } from "@/lib/referentiels";
import { useDonnees } from "@/lib/donnees";
import { useOuvertureFiche } from "@/lib/ouvertureFiche";
import FicheModal, { arbreNaema, FicheArborescence, FicheAttente, FicheDocuments, FicheFait, FicheFaits, FicheRubrique, FicheTexte } from "@/components/shared/FicheModal";

import { API_BASE as API } from "@/lib/api";

// Le nom de chaque niveau territorial
const NIVEAU_LIBELLE: Record<string, string> = {
  pole: "Pôle territoire", region: "Région", departement: "Département", arrondissement: "Arrondissement",
};

// `pot` peut n'être que la tuile de la liste (titre, lieux, activités) : la
// fiche complète (description, documents), souvent déjà en cache depuis le
// survol de la tuile, est attendue 0,4 s au plus avant d'ouvrir la fiche
// (lib/ouvertureFiche) ; au-delà, la fiche s'ouvre sur la tuile et ce qui
// manque arrive à sa place.
export default function PotentialiteVueModal({ pot, onClose }: { pot: any; onClose: () => void }) {
  const qFiche = useDonnees<any>(`${API}/opportunites/potentialites/${pot.id}`);
  const complet = !!qFiche.data;
  const prete = useOuvertureFiche(pot.id, complet);
  // Référentiels NAEMA servis par le cache partagé
  const { secteurs, branches, activites } = useNaema();
  if (!prete) return null;

  const p = qFiche.data ?? pot;
  // Le lieu de la fiche, à son propre niveau, puis ce à quoi il se rattache
  const zoneNom = p.niveau && p.niveau !== "global"
    ? p.niveau_nom || p.arrondissement_nom || p.departement_nom || p.region_nom || p.pole_nom || ""
    : p.pole_nom || p.region_nom || p.departement_nom || p.arrondissement_nom || "";
  const rattachement = p.niveau === "arrondissement" ? [p.departement_nom, p.region_nom]
    : p.niveau === "departement" ? [p.region_nom] : [];
  const nbActivites = (p.activite_ids || []).length;
  const secIds: number[] = p.secteur_ids || [];
  const arbre = arbreNaema({ secteurs, branches, activites, secIds, braIds: p.branche_ids || [], actIds: p.activite_ids || [] });

  return (
    <FicheModal titre={p.titre} onClose={onClose} maxWidth={720}
      surtitre={NIVEAU_LIBELLE[p.niveau] && <span className="fiche-surtitre-texte">{NIVEAU_LIBELLE[p.niveau]}</span>}
      meta={rattachement.filter(Boolean).length > 0 && <>{rattachement.filter(Boolean).map(r => <span key={r}>{r}</span>)}</>}>

      <FicheFaits>
        <FicheFait libelle="Zone" vide={!zoneNom}>{zoneNom || "Non renseignée"}</FicheFait>
        <FicheFait libelle={nbActivites === 1 ? "Activité porteuse" : "Activités porteuses"} vide={nbActivites === 0}>{nbActivites || "Aucune"}</FicheFait>
      </FicheFaits>

      {/* Activités porteuses : en attente des référentiels à la première fiche de la session */}
      {secIds.length > 0 && !secteurs.length ? (
        <FicheRubrique titre="Activités porteuses"><FicheAttente lignes={2} /></FicheRubrique>
      ) : arbre.length > 0 ? (
        <FicheRubrique titre="Activités porteuses" arrivee><FicheArborescence data={arbre} /></FicheRubrique>
      ) : null}

      {/* Description : en attente tant que la fiche n'est pas complète */}
      {!complet ? (
        <FicheRubrique titre="Description"><FicheAttente lignes={4} /></FicheRubrique>
      ) : p.description ? (
        <FicheRubrique titre="Description" arrivee><FicheTexte html={p.description} /></FicheRubrique>
      ) : null}

      {complet && (
        <FicheDocuments fichiers={p.fichiers || []} arrivee contexte={p.titre}
          hrefDe={f => `${API}/opportunites/potentialites/${p.id}/fichiers/${f.id}/download`} />
      )}
    </FicheModal>
  );
}
