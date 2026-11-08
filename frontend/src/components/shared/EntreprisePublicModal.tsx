"use client";

// Fiche entreprise — partagée entre la page Entreprises, les fiches de zone
// (publique et admin) et l'administration. Bâtie sur la fiche modale commune
// (FicheModal), dans le dessin des fiches Événements et Accords :
//   en-tête   — la forme juridique en surtitre ; le nom ; depuis quand elle
//               existe, et son pôle territoire ;
//   faits     — création, localisation, pays du siège, dans un aplat ;
//   rubriques — secteurs d'activité, coordonnées, points focaux.

import { useNaema } from "@/lib/referentiels";
import { dureeDepuis, estPassee, fmtDateLong } from "@/lib/format";
import { fmtPhone } from "@/lib/telephone";
import FicheModal, { arbreNaema, FicheArborescence, FicheAttente, FicheFait, FicheFaits, FicheRubrique } from "@/components/shared/FicheModal";

type PointFocal = {
  id?: number; civilite?: string | null; prenom?: string | null; nom: string; poste?: string | null;
  telephone?: string | null; mail?: string | null; est_principal?: boolean;
};

// Une liste saisie « a, b, c » : chaque valeur une fois, dans l'ordre saisi
const liste = (texte?: string | null) => [...new Set((texte || "").split(",").map(x => x.trim()).filter(Boolean))];
// Les civilités en abrégé, comme on les écrit devant un nom
const CIVILITE: Record<string, string> = { Monsieur: "M.", Madame: "Mme", Mademoiselle: "Mlle" };
// Un site : le lien complet, affiché sans protocole ni barre finale
const lienSite = (s: string) => /^https?:\/\//i.test(s) ? s : `https://${s}`;
const texteSite = (s: string) => s.replace(/^https?:\/\//i, "").replace(/\/+$/, "");

// `actions` : boutons du pied (ex. « Modifier » en admin).
// `complet` : faux tant que la fiche n'a que les champs de sa carte — ce qui
// manque arrive ensuite, à sa place. Non fourni, il se lit sur la fiche : la
// fiche entière porte ses points focaux, la carte non.
interface Props {
  entreprise: any | null; onClose: () => void; zIndex?: number; actions?: React.ReactNode; complet?: boolean;
}

export default function EntreprisePublicModal({ entreprise: e, onClose, zIndex = 500, actions, complet: completDonne }: Props) {
  // Référentiels NAEMA servis par le cache partagé (une seule requête par session)
  const { secteurs, branches, activites } = useNaema();

  if (!e) return null;
  const complet = completDonne ?? Array.isArray(e.points_focaux);

  // Son âge — pas pour une date de création à venir (saisie erronée)
  const anciennete = e.date_creation && estPassee(e.date_creation) ? dureeDepuis(e.date_creation) : null;
  // L'API retourne `pays` comme libellé lisible, `siege_pays_nom` est souvent null
  const pays: string | null = e.siege_pays_nom || e.pays || null;
  const lieuDetail = [e.arrondissement_nom, e.departement_nom].filter(Boolean).join(", ");
  const tels = liste(e.telephone), mails = liste(e.mail);
  const aDesCoordonnees = !!e.adresse || tels.length > 0 || mails.length > 0 || !!e.siteweb;

  // Secteurs d'activité : en attente tant que les référentiels n'ont pas
  // répondu (la première fiche de la session), pour ne pas surgir ensuite
  const secIds: number[] = e.secteur_ids || [];
  const naemaPret = secteurs.length > 0;
  const arbre = arbreNaema({ secteurs, branches, activites, secIds, braIds: e.branche_ids || [], actIds: e.activite_ids || [] });

  // Le contact principal en tête
  const points: PointFocal[] = [...(e.points_focaux || [])]
    .sort((x: PointFocal, y: PointFocal) => Number(!!y.est_principal) - Number(!!x.est_principal));

  return (
    <FicheModal titre={e.nom} onClose={onClose} zIndex={zIndex} actions={actions} maxWidth={760}
      surtitre={e.forme_juridique && <span className="fiche-surtitre-texte">{e.forme_juridique}</span>}
      meta={(anciennete || e.pole_territoire_nom) && (
        <>
          {anciennete && <span>Créée il y a {anciennete}</span>}
          {e.pole_territoire_nom && <span>{e.pole_territoire_nom}</span>}
        </>
      )}>

      <FicheFaits>
        <FicheFait libelle="Création" vide={!e.date_creation}>
          {e.date_creation ? fmtDateLong(e.date_creation) : "Non renseignée"}
        </FicheFait>
        <FicheFait libelle="Localisation" vide={!e.region_nom} note={lieuDetail || undefined}>
          {e.region_nom || "Non renseignée"}
        </FicheFait>
        <FicheFait libelle="Pays du siège" attente={!complet} vide={!pays}>
          {pays || "Non renseigné"}
        </FicheFait>
      </FicheFaits>

      {secIds.length > 0 && !naemaPret ? (
        <FicheRubrique titre="Secteurs d'activité"><FicheAttente lignes={2} /></FicheRubrique>
      ) : complet && arbre.length > 0 ? (
        <FicheRubrique titre="Secteurs d'activité" arrivee>
          <FicheArborescence data={arbre} />
        </FicheRubrique>
      ) : null}

      {/* Coordonnées : en attente tant que la fiche n'est pas complète */}
      {!complet ? (
        <FicheRubrique titre="Coordonnées"><FicheAttente lignes={3} /></FicheRubrique>
      ) : aDesCoordonnees ? (
        <FicheRubrique titre="Coordonnées" arrivee>
          <dl className="fiche-liste">
            {e.adresse && <><dt>Adresse</dt><dd>{e.adresse}</dd></>}
            {tels.length > 0 && (
              <><dt>{tels.length > 1 ? "Téléphones" : "Téléphone"}</dt>
                <dd>{tels.map(t => <span key={t}>{fmtPhone(t)}</span>)}</dd></>
            )}
            {mails.length > 0 && (
              <><dt>{mails.length > 1 ? "Emails" : "Email"}</dt>
                <dd>{mails.map(m => <span key={m}><a className="fiche-lien" href={`mailto:${m}`}>{m}</a></span>)}</dd></>
            )}
            {e.siteweb && (
              <><dt>Site web</dt>
                <dd><a className="fiche-lien" href={lienSite(e.siteweb)} target="_blank" rel="noopener noreferrer">{texteSite(e.siteweb)}</a></dd></>
            )}
          </dl>
        </FicheRubrique>
      ) : null}

      {complet && points.length > 0 && (
        <FicheRubrique titre={points.length > 1 ? "Points focaux" : "Point focal"} compte={points.length > 1 ? points.length : undefined} arrivee>
          <div className="fiche-personnes">
            {points.map((pf, i) => {
              const nom = [pf.civilite ? CIVILITE[pf.civilite] ?? pf.civilite : null, pf.prenom, pf.nom].filter(Boolean).join(" ");
              const role = [pf.poste, pf.est_principal ? "Contact principal" : null].filter(Boolean).join(" · ");
              const t = liste(pf.telephone), m = liste(pf.mail);
              return (
                <div key={pf.id ?? i} className="fiche-personne">
                  <div style={{ minWidth: 0 }}>
                    <p className="fiche-personne-nom">{nom}</p>
                    {role && <p className="fiche-personne-role">{role}</p>}
                  </div>
                  {(t.length > 0 || m.length > 0) && (
                    <div className="fiche-personne-contacts">
                      {t.map(x => <span key={x}>{fmtPhone(x)}</span>)}
                      {m.map(x => <a key={x} className="fiche-lien" href={`mailto:${x}`}>{x}</a>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </FicheRubrique>
      )}
    </FicheModal>
  );
}
