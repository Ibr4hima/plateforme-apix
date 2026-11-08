"use client";

// Fiche avantages & incitations d'une activité — page Opportunités et
// recherche globale. Bâtie sur la fiche modale commune (FicheModal), dans le
// dessin des autres fiches :
//   en-tête   — le secteur en surtitre ; l'activité ;
//   faits     — sa branche, le nombre d'avantages accordés, dans un aplat ;
//   rubriques — les avantages (leur type, leur précision), la description,
//               les documents.

import { useDonnees } from "@/lib/donnees";
import { useOuvertureFiche } from "@/lib/ouvertureFiche";
import FicheModal, { FicheAttente, FicheDocuments, FicheFait, FicheFaits, FicheRubrique, FicheTexte } from "@/components/shared/FicheModal";

import { API_BASE as API } from "@/lib/api";

// `avg` peut n'être que la tuile (activité, secteur, branche) : la fiche
// entière — sélections, texte, documents —, souvent déjà en cache depuis le
// survol de la tuile, est attendue 0,4 s au plus avant d'ouvrir la fiche
// (lib/ouvertureFiche) ; au-delà, la fiche s'ouvre sur la tuile et ce qui
// manque arrive à sa place.
export default function AvantageVueModal({ avg: a, onClose }: { avg: any; onClose: () => void }) {
  const qFiche = useDonnees<any>(`${API}/opportunites/avantages/${a.id}`);
  const complet = !!qFiche.data;
  const prete = useOuvertureFiche(a.id, complet);
  if (!prete) return null;

  const d = qFiche.data ?? a;
  const selections: any[] = d.selections || [];

  return (
    <FicheModal titre={d.activite_nom} onClose={onClose} maxWidth={720}
      surtitre={d.secteur_nom && <span className="fiche-surtitre-texte">{d.secteur_nom}</span>}>

      <FicheFaits>
        <FicheFait libelle="Branche" vide={!d.branche_nom}>{d.branche_nom || "Non renseignée"}</FicheFait>
        <FicheFait libelle={selections.length === 1 ? "Avantage accordé" : "Avantages accordés"} attente={!complet} vide={selections.length === 0}>
          {selections.length || "Aucun"}
        </FicheFait>
      </FicheFaits>

      {/* Les avantages : en attente tant que la fiche n'est pas complète */}
      {!complet ? (
        <FicheRubrique titre="Avantages & incitations"><FicheAttente lignes={4} /></FicheRubrique>
      ) : selections.length > 0 ? (
        <FicheRubrique titre="Avantages & incitations" compte={selections.length > 1 ? selections.length : undefined} arrivee>
          <div className="fiche-lignes">
            {selections.map((s, i) => (
              <div key={s.id ?? i} className="fiche-ligne">
                <span className="fiche-ligne-texte">
                  <span className="fiche-ligne-titre">{s.type_libelle}</span>
                  {s.commentaire && <span className="fiche-ligne-paragraphe" style={{ whiteSpace: "pre-wrap" }}>{s.commentaire}</span>}
                </span>
              </div>
            ))}
          </div>
        </FicheRubrique>
      ) : null}

      {complet && d.avantages && (
        <FicheRubrique titre="Description" arrivee><FicheTexte html={d.avantages} /></FicheRubrique>
      )}

      {complet && (
        <FicheDocuments fichiers={d.fichiers || []} arrivee contexte={d.activite_nom}
          hrefDe={f => `${API}/opportunites/avantages/${d.id}/fichiers/${f.id}/download`} />
      )}
    </FicheModal>
  );
}
