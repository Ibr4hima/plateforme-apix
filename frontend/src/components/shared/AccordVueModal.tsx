"use client";

// Fiche accord — partagée entre la page Accords (publique et admin) et la
// Fiche Pays. Bâtie sur la fiche modale commune (FicheModal), dans son
// nouveau dessin, celui de la fiche Événements :
//   en-tête   — le statut en surtitre, avec la nature du traité ; le titre ;
//               depuis quand il est en vigueur (ou signé), et sa référence ;
//   faits     — signature, entrée en vigueur, expiration, dans un aplat ;
//   rubriques — résumé, parties signataires (traités internationaux),
//               thématiques, documents.

import { useNaema, useRefPays } from "@/lib/referentiels";
import { dureeDepuis, fmtDateLong } from "@/lib/format";
import { computeStatutAccord as computeStatut } from "@/lib/statuts";
import { useDonnees } from "@/lib/donnees";
import FicheModal, { arbreNaema, FicheArborescence, FicheAttente, FicheDocuments, FicheFait, FicheFaits, type FicheFichier, FichePuces, FicheRubrique, FicheTexte } from "@/components/shared/FicheModal";

import { API_BASE } from "@/lib/api";

// fmtDate : centralisé dans lib/format (ré-exporté pour les imports existants)
export { fmtDate } from "@/lib/format";
export { computeStatutAccord as computeStatut } from "@/lib/statuts";

// Le statut en surtitre : un mot sur l'aplat de sa couleur (.fiche-statut)
const STATUT: Record<string, { label: string; ton: string }> = {
  en_vigueur: { label: "En vigueur",           ton: "vert" },
  signe:      { label: "Signé non en vigueur", ton: "bleu" },
  expire:     { label: "Expiré",               ton: "gris" },
};
const NATURE: Record<string, string> = {
  tbi:   "Traité bilatéral d'investissement",
  inter: "Traité international",
};

// ── Fiche accord ──────────────────────────────────────────────────────────────
// `actions` : boutons du pied (ex. « Modifier » en admin).
// `complet` : faux tant que la fiche n'a que les champs de sa carte — le
// résumé et les documents arrivent ensuite, à leur place.
export default function AccordVueModal({ accord: a, onClose, zIndex = 400, actions, complet = true }: {
  accord: any; onClose: () => void; zIndex?: number; actions?: React.ReactNode; complet?: boolean;
}) {
  // Référentiels servis par le cache partagé
  const { secteurs, branches, activites } = useNaema();
  const { data: paysData } = useRefPays();
  const allPays: { id: number; nom_fr: string }[] = Array.isArray(paysData) ? paysData : [];
  // Les documents arrivent avec la fiche (GET /accords/{id}) ; à défaut — une
  // carte seule, ouverte d'ailleurs —, ils se demandent à part
  const qFichiers = useDonnees<FicheFichier[]>(complet && a.fichiers === undefined ? `${API_BASE}/accords/${a.id}/fichiers` : null);
  const fichiers: FicheFichier[] = a.fichiers ?? qFichiers.data ?? [];

  const statut = computeStatut(a);
  const st = statut ? STATUT[statut] : null;
  const nature = NATURE[a.type_accord || "tbi"];
  const depuis = statut === "en_vigueur" && a.date_entree_vigueur ? `En vigueur depuis ${dureeDepuis(a.date_entree_vigueur)}`
    : statut === "signe" && a.date_signature ? `Signé il y a ${dureeDepuis(a.date_signature)}`
    : statut === "expire" && a.date_expiration ? `Expiré depuis ${dureeDepuis(a.date_expiration)}`
    : null;

  // Les parties : inutiles pour un traité bilatéral, déjà dans son titre
  const parties: string[] = a.type_accord && a.type_accord !== "tbi" ? [...new Set([
    ...(a.parties_pays_ids || []).map((id: number) => allPays.find(p => p.id === id)?.nom_fr).filter(Boolean),
    ...String(a.parties_signataires || "").split(",").map((p: string) => p.trim()).filter(Boolean),
  ])] as string[] : [];
  const arbre = arbreNaema({ secteurs, branches, activites,
    secIds: a.secteur_ids || [], braIds: a.branche_ids || [], actIds: a.activite_ids || [] });

  return (
    <FicheModal titre={a.titre} onClose={onClose} zIndex={zIndex} actions={actions} maxWidth={760}
      surtitre={(st || nature) && (
        <>
          {st && <span className="fiche-statut" data-ton={st.ton}>{st.label}</span>}
          {nature && <span className="fiche-surtitre-texte">{nature}</span>}
        </>
      )}
      meta={(depuis || a.reference) && (
        <>
          {depuis && <span>{depuis}</span>}
          {a.reference && <span>Réf. {a.reference}</span>}
        </>
      )}>

      <FicheFaits>
        <FicheFait libelle="Signature" vide={!a.date_signature}>
          {a.date_signature ? fmtDateLong(a.date_signature) : "Non renseignée"}
        </FicheFait>
        <FicheFait libelle="Entrée en vigueur" vide={!a.date_entree_vigueur}>
          {a.date_entree_vigueur ? fmtDateLong(a.date_entree_vigueur) : "Non définie"}
        </FicheFait>
        <FicheFait libelle="Expiration" vide={!a.date_expiration}>
          {a.date_expiration ? fmtDateLong(a.date_expiration) : "Non définie"}
        </FicheFait>
      </FicheFaits>

      {/* Résumé : en attente tant que la fiche n'est pas complète */}
      {!complet ? (
        <FicheRubrique titre="Résumé"><FicheAttente lignes={4} /></FicheRubrique>
      ) : a.commentaires ? (
        <FicheRubrique titre="Résumé" arrivee>
          <FicheTexte html={a.commentaires} />
        </FicheRubrique>
      ) : null}

      {parties.length > 0 && (
        <FicheRubrique titre="Parties signataires" compte={parties.length}>
          <FichePuces items={parties} />
        </FicheRubrique>
      )}

      {arbre.length > 0 && (
        <FicheRubrique titre="Thématiques">
          <FicheArborescence data={arbre} />
        </FicheRubrique>
      )}

      {complet && (
        <FicheDocuments fichiers={fichiers} arrivee contexte={a.titre}
          hrefDe={f => `${API_BASE}/accords/${a.id}/fichiers/${f.id}/download`} />
      )}
    </FicheModal>
  );
}
