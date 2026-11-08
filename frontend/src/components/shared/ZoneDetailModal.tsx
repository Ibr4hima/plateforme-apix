"use client";

// Fiche zone d'investissement — partagée entre la page Zones et la recherche
// globale. Bâtie sur la fiche modale commune (FicheModal), dans le dessin des
// autres fiches :
//   en-tête   — le type en surtitre (son code sur l'aplat de sa couleur, son
//               nom en clair) ; le nom ; sa localisation et son pôle ;
//   faits     — superficie, création (et décret), entreprises, dans un aplat ;
//   rubriques — description, activités autorisées, entreprises installées et
//               éligibles (chacune ouvre sa fiche), documents.

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import { useAuthGate } from "@/lib/authGate";
import { useNaema } from "@/lib/referentiels";
import { fmtDateLong } from "@/lib/format";
import { requeteDonnees } from "@/lib/donnees";
import FicheModal, { arbreNaema, FicheArborescence, FicheAttente, FicheDocuments, FicheFait, FicheFaits, FicheRubrique, FicheTexte } from "@/components/shared/FicheModal";

import { API_BASE } from "@/lib/api";

// Le type de zone : son nom au singulier, et le ton de son étiquette
// (.fiche-statut) — la couleur des zones de ce type sur toute la plateforme
const NATURE: Record<string, string> = {
  ZES: "Zone économique spéciale",
  ZAI: "Zone aménagée pour l'investissement",
  ZFI: "Zone franche industrielle",
};
const TON: Record<string, string> = { ZES: "bleu", ZAI: "orange", ZFI: "vert" };

type LienZone = { id: string; statut: string; entreprise?: { id: number; nom: string; forme_juridique?: string | null } };

const pluriel = (n: number, mot: string) => `${mot}${n > 1 ? "s" : ""}`;
const urlEntreprise = (id: number) => `${API_BASE}/entreprises/${id}`;
// Au-delà, la liste se replie : la fiche ne s'allonge que si on le demande
const APERCU = 8;

// Les entreprises d'une zone : une ligne chacune, qui ouvre sa fiche
function ListeEntreprises({ items, onOuvrir, onSurvol }: {
  items: LienZone[]; onOuvrir: (id: number) => void; onSurvol: (id: number) => void;
}) {
  const [toutes, setToutes] = useState(false);
  const visibles = toutes ? items : items.slice(0, APERCU);
  return (
    <>
      <div className="fiche-lignes">
        {visibles.map(ze => ze.entreprise && (
          <button key={ze.id} type="button" className="fiche-ligne est-cliquable"
            onClick={() => onOuvrir(ze.entreprise!.id)} onMouseEnter={() => onSurvol(ze.entreprise!.id)}>
            <span className="fiche-ligne-texte">
              <span className="fiche-ligne-nom">{ze.entreprise.nom}</span>
              {ze.entreprise.forme_juridique && <span className="fiche-ligne-detail">{ze.entreprise.forme_juridique}</span>}
            </span>
            <span className="fiche-ligne-action">Ouvrir</span>
          </button>
        ))}
      </div>
      {items.length > APERCU && (
        <button type="button" className="fiche-plus" onClick={() => setToutes(t => !t)}>
          {toutes ? "Afficher moins" : `Afficher ${items.length - APERCU === 1 ? "l'autre" : `les ${items.length - APERCU} autres`}`}
        </button>
      )}
    </>
  );
}

// `complet` : faux tant que la fiche n'a que les champs de sa carte — ce qui
// manque arrive ensuite, à sa place. Non fourni, il se lit sur la fiche : la
// fiche entière porte la liste de ses entreprises, la carte leurs seuls
// compteurs.
export default function ZoneDetailModal({ zone, onClose, complet: completDonne }: { zone: any; onClose: () => void; complet?: boolean }) {
  const gate = useAuthGate();
  const [ficheEnt, setFicheEnt] = useState<any>(null);
  // Référentiels NAEMA servis par le cache partagé
  const { secteurs, branches, activites } = useNaema();
  const complet = completDonne ?? Array.isArray(zone.entreprises);

  // La fiche d'une entreprise, par le cache partagé : demandée dès le survol
  // de sa ligne, elle s'ouvre complète. Seule la dernière demande compte.
  const queryClient = useQueryClient();
  const demande = useRef(0);
  const prechargerEnt = (id: number) => { queryClient.prefetchQuery(requeteDonnees(urlEntreprise(id))); };
  const ouvrirEnt = (id: number) => gate(async () => {
    const n = ++demande.current;
    try {
      const fiche = await queryClient.fetchQuery(requeteDonnees(urlEntreprise(id)));
      if (n === demande.current) setFicheEnt(fiche);
    } catch (e) { console.error(e); }
  });

  const liens: LienZone[] = zone.entreprises || [];
  const installes = liens.filter(ze => ze.statut === "installee");
  const eligibles = liens.filter(ze => ze.statut === "eligible");
  // Les compteurs : ceux de la carte tant que la liste n'est pas là
  const nbInst = complet ? installes.length : (zone.nb_installees ?? 0);
  const nbElig = complet ? eligibles.length : (zone.nb_eligibles ?? 0);
  const superficie = zone.superficie ? `${Number(zone.superficie).toLocaleString("fr-FR")} ha` : null;
  const lieu = [zone.departement_nom, zone.region_nom].filter(Boolean).join(", ");

  const secIds: number[] = zone.secteur_ids || [];
  const naemaPret = secteurs.length > 0;
  const arbre = arbreNaema({ secteurs, branches, activites, secIds, braIds: zone.branche_ids || [], actIds: zone.activite_ids || [] });

  return (
    <>
      <FicheModal titre={zone.nom_zone} onClose={onClose} zIndex={500} maxWidth={760}
        surtitre={zone.type_zone && (
          <>
            <span className="fiche-statut" data-ton={TON[zone.type_zone] || "gris"}>{zone.type_zone}</span>
            {NATURE[zone.type_zone] && <span className="fiche-surtitre-texte">{NATURE[zone.type_zone]}</span>}
          </>
        )}
        meta={(lieu || zone.pole_nom) && (
          <>
            {lieu && <span>{lieu}</span>}
            {zone.pole_nom && <span>{zone.pole_nom}</span>}
          </>
        )}>

        <FicheFaits>
          <FicheFait libelle="Superficie" vide={!superficie}>{superficie ?? "Non renseignée"}</FicheFait>
          <FicheFait libelle="Création" vide={!zone.date_creation} note={zone.decret_creation || undefined}>
            {zone.date_creation ? fmtDateLong(zone.date_creation) : "Non renseignée"}
          </FicheFait>
          <FicheFait libelle={`${pluriel(nbInst, "Entreprise")} ${pluriel(nbInst, "installée")}`} vide={nbInst === 0}
            note={nbElig > 0 ? `${nbElig} ${pluriel(nbElig, "éligible")}` : undefined}>
            {nbInst}
          </FicheFait>
        </FicheFaits>

        {/* Description : en attente tant que la fiche n'est pas complète */}
        {!complet ? (
          <FicheRubrique titre="Description"><FicheAttente lignes={5} /></FicheRubrique>
        ) : zone.description ? (
          <FicheRubrique titre="Description" arrivee>
            <FicheTexte html={zone.description} />
          </FicheRubrique>
        ) : null}

        {/* Activités autorisées : en attente des référentiels à la première
            fiche de la session, pour ne pas surgir ensuite */}
        {secIds.length > 0 && !naemaPret ? (
          <FicheRubrique titre="Activités autorisées"><FicheAttente lignes={2} /></FicheRubrique>
        ) : complet && arbre.length > 0 ? (
          <FicheRubrique titre="Activités autorisées" arrivee>
            <FicheArborescence data={arbre} />
          </FicheRubrique>
        ) : null}

        {complet && installes.length > 0 && (
          <FicheRubrique titre="Entreprises installées" compte={installes.length} arrivee>
            <ListeEntreprises items={installes} onOuvrir={ouvrirEnt} onSurvol={prechargerEnt} />
          </FicheRubrique>
        )}
        {complet && eligibles.length > 0 && (
          <FicheRubrique titre="Entreprises éligibles" compte={eligibles.length} arrivee>
            <ListeEntreprises items={eligibles} onOuvrir={ouvrirEnt} onSurvol={prechargerEnt} />
          </FicheRubrique>
        )}

        {complet && (
          <FicheDocuments fichiers={zone.fichiers || []} arrivee contexte={zone.nom_zone}
            hrefDe={f => `${API_BASE}/zones-types/${zone.id}/fichiers/${f.id}/download`} />
        )}
      </FicheModal>
      <EntreprisePublicModal entreprise={ficheEnt} onClose={() => setFicheEnt(null)} zIndex={520} />
    </>
  );
}
