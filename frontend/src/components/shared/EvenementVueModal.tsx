"use client";

// Fiche événement — partagée entre la page Événements (publique et admin) et
// la recherche globale (⌘K). Bâtie sur la fiche modale commune (FicheModal),
// dans son nouveau dessin :
//   en-tête  — le statut et l'édition en surtitre, le nom, puis la date et le
//              lieu, ce que l'on cherche d'abord ;
//   faits    — le rôle de l'APIX, l'organisateur, la récurrence, dans un aplat ;
//   rubriques — description, thématiques, participants, documents.

import { fmtPlageDatesLongue } from "@/lib/format";
import { computeStatutEvenement } from "@/lib/statuts";
import { badge_ambre, badge_bleu, badge_orange, badge_vert, badge_violet } from "@/lib/couleurs";
import FicheModal, { FicheArborescence, FicheAttente, FicheDocuments, FicheFait, FicheFaits, FichePuces, FicheRubrique, FicheTexte } from "@/components/shared/FicheModal";

import { API_BASE } from "@/lib/api";

export const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const MOIS_LONGS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

// Rôles APIX sur les jetons du design system — alignés sur les cards :
// organisation vert, participant orange, partenaire bleu, invité violet,
// sponsor ambre. (ROLE_PILL conservé pour les imports historiques.)
export const ROLE_BADGE: Record<string, React.CSSProperties> = {
  "Organisateur":    badge_vert,
  "Co-organisateur": badge_vert,
  "Participant":     badge_orange,
  "Partenaire":      badge_bleu,
  "Invité":          badge_violet,
  "Sponsor":         badge_ambre,
};
export const ROLE_PILL: Record<string,{c:string;bg:string}> = {
  "Organisateur":    { c:"var(--vert)", bg:"rgb(var(--vert-rgb) / 0.08)"  },
  "Co-organisateur": { c:"var(--vert)", bg:"rgb(var(--vert-rgb) / 0.08)"  },
  "Participant":     { c:"var(--orange)", bg:"rgb(var(--orange-rgb) / 0.08)"  },
  "Partenaire":      { c:"var(--bleu)", bg:"rgb(var(--bleu-rgb) / 0.07)"   },
  "Sponsor":         { c:"var(--orange)", bg:"rgb(var(--alerte-rgb) / 0.08)"   },
  "Invité":          { c:"var(--violet)", bg:"rgb(var(--violet-rgb) / 0.07)" },
};
export const ROLES_APIX: Record<string,string> = { "Organisateur":"Organisateur","Co-organisateur":"Co-organisateur","Participant":"Participant","Partenaire":"Partenaire","Sponsor":"Sponsor","Invité":"Invité" };

export function ordinal(n: number) { return n === 1 ? "1ère édition" : `${n}ème édition`; }

// Le statut en surtitre (pastille .fiche-statut, sa couleur selon data-ton)
const STATUT_BADGE: Record<string, { label: string }> = {
  a_venir:  { label: "À venir" },
  en_cours: { label: "En cours" },
  termine:  { label: "Terminé" },
};

// ── Fiche événement ───────────────────────────────────────────────────────────
// `actions` : boutons du pied (ex. « Modifier » en admin).
// `complet` : faux tant que la fiche n'a que les champs de sa carte — la
// description, les thématiques et les participants arrivent ensuite, à leur
// place (lignes en attente, puis fondu).
export default function EvenementVueModal({ ev: e, onClose, actions, complet = true }: {
  ev: any; onClose: () => void; actions?: React.ReactNode; complet?: boolean;
}) {
  if (!e) return null;

  // Date : la plage écrite au plus court, mois en toutes lettres ; pour un
  // événement récurrent sans date fixée, sa prochaine occurrence
  const date = e.date_debut
    ? fmtPlageDatesLongue(e.date_debut, e.date_fin)
    : e.prochain_mois
      ? `${e.prochain_jour ? `${e.prochain_jour} ` : ""}${MOIS_LONGS[(e.prochain_mois || 1) - 1]} ${e.prochain_annee || ""}`.trim()
      : e.prochain_annee ? String(e.prochain_annee) : null;
  const duree = e.duree_jours && e.duree_jours > 1 ? `${e.duree_jours} jours` : null;
  const lieu = [e.ville, e.pays_hote_nom].filter(Boolean).join(", ");
  const statut = computeStatutEvenement(e) ?? ((e.prochain_annee || e.prochain_mois) ? "a_venir" : null);
  const st = statut ? STATUT_BADGE[statut] : null;
  const recurrence = !e.est_recurrent ? null
    : !e.frequence_valeur ? "Événement récurrent"
    : e.frequence_valeur === 1 ? (e.frequence_type === "mois" ? "Chaque mois" : "Chaque année")
    : `Tous les ${e.frequence_valeur} ${e.frequence_type === "mois" ? "mois" : "ans"}`;

  // Thématiques : l'API livre l'arborescence déjà résolue
  const arbre = e.thematiques_tree
    ? Object.entries(e.thematiques_tree).map(([sec, branches]: any) => ({
        cle: sec, nom: sec,
        enfants: Object.entries(branches || {}).map(([bra, acts]: any) => ({
          cle: bra, nom: bra,
          enfants: ((acts as string[]) || []).map((act: string) => ({ cle: act, nom: act })),
        })),
      }))
    : [];
  // Chaque nom une fois, dans l'ordre saisi
  const liste = (texte?: string) => [...new Set((texte || "").split(",").map(x => x.trim()).filter(Boolean))];
  const paysInvites = liste(e.pays_invites_noms);
  const entInvitees = liste(e.entreprises_invitees);
  // Le surtitre : le statut en pastille, l'édition et la récurrence en clair
  const details = [e.edition != null ? ordinal(e.edition) : null, e.est_recurrent ? "Récurrent" : null].filter(Boolean);
  const faits = [
    e.role_apix && <FicheFait key="role" libelle="Rôle de l'APIX">{ROLES_APIX[e.role_apix] || e.role_apix}</FicheFait>,
    e.organisateur && <FicheFait key="org" libelle="Organisateur">{e.organisateur}</FicheFait>,
    recurrence && <FicheFait key="rec" libelle="Récurrence">{recurrence}</FicheFait>,
  ].filter(Boolean);
  return (
    <FicheModal titre={e.nom_event} onClose={onClose} actions={actions} maxWidth={760}
      surtitre={(st || details.length > 0) && (
        <>
          {st && <span className="fiche-statut" data-ton={statut}>{st.label}</span>}
          {details.length > 0 && (
            <span className="fiche-surtitre-texte">{details.join(" · ")}</span>
          )}
        </>
      )}
      meta={(date || lieu) && (
        <>
          {date && <span>{date}{duree && <span style={{ color: "var(--gris)" }}>· {duree}</span>}</span>}
          {lieu && <span>{lieu}</span>}
        </>
      )}>

      {faits.length > 0 && <FicheFaits>{faits}</FicheFaits>}

      {/* Description : en attente tant que la fiche n'est pas complète */}
      {!complet ? (
        <FicheRubrique titre="Description"><FicheAttente lignes={5} /></FicheRubrique>
      ) : e.description ? (
        <FicheRubrique titre="Description" arrivee>
          <FicheTexte html={e.description} />
        </FicheRubrique>
      ) : null}

      {complet && arbre.length > 0 && (
        <FicheRubrique titre="Thématiques" arrivee>
          <FicheArborescence data={arbre} />
        </FicheRubrique>
      )}

      {complet && (paysInvites.length > 0 || entInvitees.length > 0) && (
        <FicheRubrique titre="Participants" arrivee>
          <FichePuces titre={paysInvites.length > 1 ? `Pays invités · ${paysInvites.length}` : "Pays invité"} items={paysInvites} />
          <FichePuces titre={entInvitees.length > 1 ? `Entreprises invitées · ${entInvitees.length}` : "Entreprise invitée"} items={entInvitees} />
        </FicheRubrique>
      )}

      {complet && (
        <FicheDocuments fichiers={e.fichiers || []} arrivee
          hrefDe={f => `${API_BASE}/evenements/${e.id}/fichiers/${f.id}/download`} />
      )}
    </FicheModal>
  );
}
