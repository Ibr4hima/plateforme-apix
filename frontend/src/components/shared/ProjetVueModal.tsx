"use client";

// Fiche projet d'investissement — page Opportunités et recherche globale.
// Bâtie sur la fiche modale commune (FicheModal), dans le dessin des autres
// fiches :
//   en-tête   — « Projet d'investissement » en surtitre ; le titre ; son pôle ;
//   faits     — investissement, date de début, localisation, dans un aplat ;
//   rubriques — description, thématiques, porteurs, points focaux, documents.

import { useNaema } from "@/lib/referentiels";
import { fmtDateLong, fmtFCFA } from "@/lib/format";
import FicheModal, { arbreNaema, FicheArborescence, FicheAttente, FicheDocuments, FicheFait, FicheFaits, FichePersonnes, FicheRubrique, FicheTexte } from "@/components/shared/FicheModal";

import { API_BASE as API } from "@/lib/api";

const DEVISES: Record<string, string> = { XOF: "FCFA", USD: "$", EUR: "€" };
const symbole = (code?: string, sym?: string) => sym || (code ? DEVISES[code] || code : "");
const exact = (v: number | string) => Number(v).toLocaleString("fr-FR");

// L'investissement : lisible d'un coup d'œil (« 200 M à 600 M FCFA »), le
// montant exact dessous
function investissement(p: any): { valeur: string; exact?: string } | null {
  const sym = symbole(p.devise_code, p.devise_symbole);
  const fcfa = sym === "FCFA";
  const court = (v: number) => (fcfa ? fmtFCFA(v) : `${exact(v)} ${sym}`.trim());
  if (!p.investissement_est_intervalle) {
    if (!p.investissement) return null;
    return { valeur: court(Number(p.investissement)), exact: fcfa ? `${exact(p.investissement)} FCFA` : undefined };
  }
  if (!p.investissement_min) return null;
  const min = Number(p.investissement_min), max = p.investissement_max ? Number(p.investissement_max) : null;
  if (max == null) return { valeur: `À partir de ${court(min)}`, exact: fcfa ? `${exact(min)} FCFA et plus` : undefined };
  return {
    valeur: fcfa ? `${fmtFCFA(min).replace(/\s*FCFA$/, "")} à ${fmtFCFA(max)}` : `${exact(min)} à ${exact(max)} ${sym}`.trim(),
    exact: fcfa ? `${exact(min)} à ${exact(max)} FCFA` : undefined,
  };
}

// `complet` : faux tant que la fiche n'a que les champs de sa carte — ce qui
// manque arrive ensuite, à sa place. Non fourni, il se lit sur la fiche : la
// fiche entière porte ses porteurs, la carte non. Les référentiels NAEMA
// viennent du cache partagé (secteurs, branches, activites ne sont plus lus).
export default function ProjetVueModal({ projet: p, onClose, complet: completDonne }: {
  projet: any; onClose: () => void; complet?: boolean;
  secteurs?: unknown; branches?: unknown; activites?: unknown;
}) {
  const { secteurs, branches, activites } = useNaema();
  const complet = completDonne ?? Array.isArray(p.porteurs);

  const inv = investissement(p);
  // La localisation : l'échelon le plus fin, les autres dessous
  const lieu = p.arrondissement_nom || p.departement_nom || p.region_nom || null;
  const lieuDetail = (p.arrondissement_nom ? [p.departement_nom, p.region_nom] : p.departement_nom ? [p.region_nom] : [])
    .filter(Boolean).join(", ");
  const secIds: number[] = p.secteur_ids || [];
  const arbre = arbreNaema({ secteurs, branches, activites, secIds, braIds: p.branche_ids || [], actIds: p.activite_ids || [] });
  const porteurs = (p.porteurs || []).map((por: any) => ({ cle: por.id, nom: por.nom || "Porteur", tels: por.telephones, mails: por.mails }));
  const points = (p.points_focaux || []).map((pf: any) => ({
    cle: pf.id, nom: [pf.civilite, pf.prenom, pf.nom].filter(Boolean).join(" "), tels: pf.telephones, mails: pf.mails,
  }));

  return (
    <FicheModal titre={p.titre_projet} onClose={onClose} maxWidth={760}
      surtitre={<span className="fiche-surtitre-texte">Projet d&apos;investissement</span>}
      meta={p.pole_nom && <span>{p.pole_nom}</span>}>

      <FicheFaits>
        <FicheFait libelle="Investissement" attente={!complet} vide={!inv} note={inv?.exact}>{inv?.valeur ?? "Non renseigné"}</FicheFait>
        <FicheFait libelle="Date de début" attente={!complet} vide={!p.date_debut}>{p.date_debut ? fmtDateLong(p.date_debut) : "Non renseignée"}</FicheFait>
        <FicheFait libelle="Localisation" vide={!lieu} note={lieuDetail || undefined}>{lieu || "Non renseignée"}</FicheFait>
      </FicheFaits>

      {/* Description : en attente tant que la fiche n'est pas complète */}
      {!complet ? (
        <FicheRubrique titre="Description"><FicheAttente lignes={4} /></FicheRubrique>
      ) : p.description ? (
        <FicheRubrique titre="Description" arrivee><FicheTexte html={p.description} /></FicheRubrique>
      ) : null}

      {/* Thématiques : en attente des référentiels à la première fiche de la session */}
      {secIds.length > 0 && !secteurs.length ? (
        <FicheRubrique titre="Thématiques du projet"><FicheAttente lignes={2} /></FicheRubrique>
      ) : complet && arbre.length > 0 ? (
        <FicheRubrique titre="Thématiques du projet" arrivee><FicheArborescence data={arbre} /></FicheRubrique>
      ) : null}

      {complet && porteurs.length > 0 && (
        <FicheRubrique titre={porteurs.length > 1 ? "Porteurs du projet" : "Porteur du projet"} compte={porteurs.length > 1 ? porteurs.length : undefined} arrivee>
          <FichePersonnes personnes={porteurs} />
        </FicheRubrique>
      )}
      {complet && points.length > 0 && (
        <FicheRubrique titre={points.length > 1 ? "Points focaux" : "Point focal"} compte={points.length > 1 ? points.length : undefined} arrivee>
          <FichePersonnes personnes={points} />
        </FicheRubrique>
      )}

      {complet && (
        <FicheDocuments fichiers={p.fichiers || []} arrivee contexte={p.titre_projet}
          hrefDe={f => `${API}/projets/${p.id}/fichiers/${f.id}/download`} />
      )}
    </FicheModal>
  );
}
