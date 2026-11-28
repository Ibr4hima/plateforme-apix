"use client";

// Investissements projetés — les projets annoncés relevés par fDi Markets
// (Financial Times).
//
// Ce que cette page dit et que « Investissements réalisés » ne dit pas : la
// CNUCED mesure ce qui est ENTRÉ, une fois l'argent versé et compté dans la
// balance des paiements ; fDi relève ce qui a été ANNONCÉ, projet par projet,
// avec son entreprise, son secteur et son pays. Les deux ne se contredisent
// pas — ils regardent deux moments différents de la même décision.
//
// UNE SEULE QUESTION. Un projet a deux pays, celui d'où part l'investissement
// et celui où il arrive ; cette page ne pose que la seconde question : qu'un
// pays REÇOIT-il ? Le pays d'origine se lit alors comme le partenaire, dans
// les classements et sur chaque projet.
//
// UNE SEULE RÈGLE DE CHIFFRE : compteurs, séries et classements sortent tous du
// même filtre que la table du bas. Un chiffre qu'on ne retrouve pas dans la
// liste en dessous est un chiffre qu'on ne peut pas défendre en réunion.

import { useEffect, useMemo, useRef, useState } from "react";
import { useAdresseInitiale } from "@/lib/useEtatUrl";
import { ChevronDown, Search } from "lucide-react";
import { AttenteFiltres, EnteteFiltres, EntetePeriode, resumePeriode } from "@/components/shared/PanneauFiltres";

import DrapeauPays from "@/components/shared/DrapeauPays";
import FicheModal, { FicheFait, FicheFaits, FicheRubrique } from "@/components/shared/FicheModal";
import { creerMagasinFiche, useFicheOuverte, type MagasinFiche } from "@/lib/magasinFiche";
import { CurseurPlageNace } from "@/components/shared/CurseurNace";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { useDebounced } from "@/lib/useDebounced";
import { useDonnees } from "@/lib/donnees";
import { demarrerRedimension } from "@/lib/redimension";
import { fmtMillionsUSDParts } from "@/lib/format";
import { API, BadgePeriode, btnSegment, btnVue, CARTE_CLIQUABLE, type ChoixSous, ETIQ, Facette,
         FacetteSecteurs, Filet, fmtNombre, groupByContinent, LIGNE_FACETTE,
         moisEnClair, moisEnPhrase, montantFdi, Pagination, PaysFdi, Pastille, survolCarte, AttenteCartes } from "./partage";
import VueSignauxPublics, { FiltresSignauxPanneau, FILTRES_SIGNAUX_VIDES,
         type FiltresSignaux } from "./vue-signaux-publics";
import VueEntreprisesPubliques, { FiltresEntreprisesPanneau,
         FILTRES_ENTREPRISES_VIDES, type FiltresEntreprises } from "./vue-entreprises-publiques";

type Compte = { nom: string; nb: number };
type SousCompte = Compte & { secteur: string };
/** Un pays du périmètre, avec son rattachement géographique. Le groupement
    vient de ref_pays et de nulle part ailleurs : c'est le seul du produit, et
    un pays ne doit pas changer de région d'un écran à l'autre. L'un comme
    l'autre peuvent manquer — l'écran range alors le pays sous « Autre ». */
type ComptePays = Compte & { continent: string | null; region_geo: string | null };
type Perimetre = {
  sens: string; annees: [number | null, number | null]; total_projets: number;
  perimetres_complets: string[]; sens_disponibles: string[];
  pays: ComptePays[]; secteurs: Compte[]; sous_secteurs: SousCompte[];
  activites: Compte[]; types: Compte[];
};
type Rang = { nom: string; nb: number; capex_musd: number | null; emplois: number | null };
export type Projet = {
  id: number; periode: string; annee: number; entreprise: string | null;
  entreprise_a_arbitrer: boolean;
  pays: string | null; pays_iso: string | null;
  partenaire: string | null; partenaire_iso: string | null;
  secteur: string | null; sous_secteur: string | null; activite: string | null;
  type_projet: string | null; capex_musd: number | null; capex_estime: boolean | null;
  emplois: number | null; emplois_estime: boolean | null;
  description_fr: string | null; description_en: string | null;
};
type Reponse = {
  sens: string;
  page: number; pages: number;
  kpis: { projets: number; capex_musd: number | null; emplois: number | null;
          capex_moyen: number | null; entreprises: number; partenaires: number;
          part_estimee: number | null; annees: [number | null, number | null] };
  par_annee: { annee: number; nb: number; capex_musd: number | null; emplois: number | null }[];
  tops: Record<"partenaires" | "secteurs" | "activites" | "entreprises" | "types", Rang[]>;
  projets: Projet[];
};

/** LA VUE « ENTREPRISES » EST RETIRÉE POUR LE MOMENT, à la demande — pas
    supprimée. Son code reste en place : la vue (vue-entreprises-publiques.tsx),
    ses filtres, sa fiche, son rapport (ide/rapport-entreprises) et les routes
    du service. La remettre tient à ce drapeau.

    Tant qu'il est faux : la vue n'est plus proposée ; une adresse qui l'ouvrait
    (« volet=entreprises ») ramène aux projets annoncés ; ses filtres ne sont
    plus lus dans l'adresse, et leurs clefs (« e_… ») s'en effacent. */
export const VUE_ENTREPRISES = false;

const VUES = [
  { v: "projets" as const, l: "Projets annoncés", src: "Project database" },
  { v: "signaux" as const, l: "Signaux d'investissement", src: "Investor signals" },
  ...(VUE_ENTREPRISES ? [{ v: "entreprises" as const, l: "Entreprises", src: "Company database" }] : []),
];

/** Trente cartes par page, comme les vues Signaux et Entreprises. Les trois
    paginent la même chose et devaient le faire au même rythme. */
const PAR_PAGE = 30;

const TITRE_SS = { fontSize: 11, fontWeight: 700, color: "var(--gris)",
  textTransform: "uppercase" as const, letterSpacing: "0.1em" };

/** Le pays de référence de la plateforme. Épinglé en tête du filtre et retenu
    par défaut : elle est lue à l'APIX, et la première question qu'on lui pose
    est celle du Sénégal. Il reste présent dans sa région, où l'œil ira le
    chercher s'il y descend. */
const PAYS_REFERENCE = "Sénégal";

/** L'état que l'adresse porte à l'ouverture de l'onglet — vue, pays, période,
    facettes, filtres des signaux et des entreprises.

    IL EST LU AVANT LE PREMIER RENDU, d'un bloc. Un effet le reprenait après
    l'affichage : revenir du rapport montrait d'abord les projets du Sénégal,
    sans filtre, puis basculait sur la vue et les filtres qu'on avait laissés —
    et chaque état intermédiaire lançait ses propres requêtes. */
function etatDepuisAdresse(p: URLSearchParams) {
  const liste = (cle: string) => (p.get(cle) ?? "").split("|").filter(Boolean);
  const couples = (cle: string): ChoixSous[] => liste(cle).map(v => v.split("::"))
    .filter(([a, b]) => a && b).map(([secteur, nom]) => ({ secteur, nom }));
  const nombre = (cle: string) => (p.get(cle) ? Number(p.get(cle)) : null);
  // « volet » nomme la vue ouverte ; « vue » la portait avant, et les liens
  // déjà partagés la portent encore — on les lit toujours.
  const v = p.get("volet") ?? p.get("vue");
  return {
    vue: (v === "signaux" || (v === "entreprises" && VUE_ENTREPRISES) ? v : "projets") as "projets" | "signaux" | "entreprises",
    sens: (p.get("sens") === "source" ? "source" : "destination") as "destination" | "source",
    pays: p.get("pays"),
    // La région suffit à dire l'échelle : elle n'existe pas dans l'autre.
    region: p.get("region"),
    anneeMin: nombre("a0"), anneeMax: nombre("a1"),
    secteurs: liste("sec"), sousSecteurs: couples("ssec"),
    activites: liste("act"),
    recherche: p.get("q") ?? "",
    signaux: {
      origine: p.get("s_ori") ?? "", destination: p.get("s_dest") ?? "",
      secteur: p.get("s_sec") ?? "", activite: p.get("s_act") ?? "",
      anneeMin: nombre("s_a0"), anneeMax: nombre("s_a1"),
      recherche: p.get("s_q") ?? "",
    } satisfies FiltresSignaux,
    entreprises: (VUE_ENTREPRISES ? {
      origines: liste("e_ori"), destinations: liste("e_dest"), secteurs: liste("e_sec"),
      sousSecteurs: couples("e_ssec"), activites: liste("e_act"),
      recherche: p.get("e_q") ?? "",
    } : FILTRES_ENTREPRISES_VIDES) satisfies FiltresEntreprises,
  };
}

/** L'ordre des continents, qui sert ici à ORDONNER LES RÉGIONS sans les
    coiffer : les régions d'un même continent restent voisines, mais on n'a pas
    à ouvrir « Afrique » pour les atteindre. Le relevé ne couvre aujourd'hui
    qu'un continent, et ce niveau ne coûtait qu'un clic.

    Un continent inconnu passe en queue plutôt que d'être écarté : un pays que
    le référentiel n'a pas classé doit rester atteignable dans le filtre, pas
    disparaître de la liste. */
const ORDRE_CONTINENTS = ["Afrique", "Amérique", "Asie", "Europe", "Océanie"];
const rangContinent = (c: string) => {
  const i = ORDRE_CONTINENTS.indexOf(c);
  return i === -1 ? ORDRE_CONTINENTS.length : i;
};

/** L'en-tête repliable d'une région.

    Mêmes mesures que la colonne de filtres des Investissements réalisés —
    même hauteur de barre, même chevron, même pastille de sélection. Les deux
    onglets se lisent côte à côte, et deux échelles pour la même liste donnent
    l'impression de deux produits. */
const BarreRepli = ({ titre, ouvert, onBasculer }: {
  titre: string; ouvert: boolean; onBasculer: () => void;
}) => (
  <button onClick={onBasculer} aria-expanded={ouvert}
    style={{ width: "100%", display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: 8, padding: "5px 8px", borderRadius: 7,
      background: "rgb(var(--bleu-rgb) / 0.04)", border: "none", cursor: "pointer",
      marginBottom: 3, fontFamily: "inherit" }}>
    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--bleu)",
      letterSpacing: "0.1em", textTransform: "uppercase" as const,
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{titre}</span>
    <ChevronDown size={11} style={{ color: "var(--bleu)", flexShrink: 0,
      transform: ouvert ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
  </button>
);

export default function OngletFdi({ onVue }: {
  /** La page a besoin de savoir quelle vue est ouverte — le bouton « Rapport »
      ne vaut que pour les projets. Elle ne peut pas le lire dans l'URL : la vue
      s'y écrit par « history.replaceState », qui ne déclenche aucun rendu chez
      le parent. On le lui dit donc explicitement. */
  onVue?: (v: "projets" | "signaux" | "entreprises") => void;
} = {}) {
  const adresse = useAdresseInitiale();
  const [depart] = useState(() => etatDepuisAdresse(adresse));
  const [vue, setVue] = useState<"projets" | "signaux" | "entreprises">(depart.vue);
  // Au montage aussi, pas seulement au clic : la vue peut venir de l'URL.
  useEffect(() => { onVue?.(vue); }, [vue, onVue]);
  // Les filtres des signaux vivent ICI, non dans leur vue : la colonne de
  // filtres est celle de la page, partagée par toutes les vues, et elle doit
  // pouvoir les lire comme la liste qui les applique.
  const [filtresSignaux, setFiltresSignaux] = useState<FiltresSignaux>(depart.signaux);
  // Ceux des entreprises, pour la même raison. Ils vivent à part de ceux des
  // signaux : les deux vues ne filtrent pas les mêmes objets, et un secteur
  // retenu sur l'une n'a aucune raison de se reporter sur l'autre.
  const [filtresEntreprises, setFiltresEntreprises] =
    useState<FiltresEntreprises>(depart.entreprises);
  // Le côté par lequel on lit le pays. La bascule ne s'affiche que si un
  // périmètre a été relevé dans les deux sens : un lot « Dest = Sénégal » ne
  // dit rien de ce que le Sénégal implante ailleurs, et proposer « Source »
  // avant d'avoir ce relevé n'ouvrirait qu'une liste vide.
  const [sens, setSens] = useState<"destination" | "source">(depart.sens);
  // LE SÉNÉGAL EST POSÉ D'EMBLÉE, sans attendre le périmètre. Le pays restait
  // vide jusqu'à l'arrivée de la liste des pays : l'écran demandait donc
  // d'abord TOUT le relevé — seize mille projets, les chiffres de l'Afrique
  // entière —, les affichait, puis redemandait ceux du Sénégal. Deux allers et
  // retours, et des chiffres faux à l'écran entre les deux. `paysSuppose` dit
  // que ce pays n'a pas encore été confronté au périmètre (voir plus bas).
  const [pays, setPays] = useState<string | null>(depart.pays ?? (depart.region ? null : PAYS_REFERENCE));
  const [paysSuppose, setPaysSuppose] = useState(!depart.pays && !depart.region);
  // LA DESTINATION SE LIT À DEUX ÉCHELLES. Un pays — « que reçoit le Sénégal » —
  // ou une région entière — « que reçoit l'Afrique de l'Ouest ». C'est la même
  // question posée plus haut, et non un filtre de plus : les deux échelles
  // s'excluent, une seule part dans l'adresse, et l'écran n'affiche jamais les
  // deux listes à la fois.
  //
  // La région retenue vit à côté du pays et non à sa place : revenir à
  // « Pays » doit rendre le pays qu'on lisait, et non renvoyer au Sénégal
  // quelqu'un qui lisait le Nigeria.
  const [echelle, setEchelle] = useState<"pays" | "regions">(depart.region ? "regions" : "pays");
  const [region, setRegion] = useState<string | null>(depart.region);
  const [secteurs, setSecteurs] = useState<string[]>(depart.secteurs);
  const [sousSecteurs, setSousSecteurs] = useState<ChoixSous[]>(depart.sousSecteurs);
  const [activites, setActivites] = useState<string[]>(depart.activites);
  const [recherche, setRecherche] = useState(depart.recherche);
  const [chercherPays, setChercherPays] = useState("");
  // LA PÉRIODE CHOISIE, OU RIEN. `null` veut dire « toute la période » : les
  // bornes affichées viennent alors du périmètre, pendant le rendu. Elles
  // étaient recopiées dans cet état par un effet, ce qui relançait périmètre
  // et projets une troisième fois — pour les mêmes données, bornes explicites.
  const [anneeMin, setAnneeMin] = useState<number | null>(depart.anneeMin);
  const [anneeMax, setAnneeMax] = useState<number | null>(depart.anneeMax);
  // Le projet dont la fiche est ouverte. Il vit dans un petit magasin
  // (lib/magasinFiche) : seul l'hôte de la fiche s'y abonne, et l'ouvrir ou la
  // fermer ne réaffiche plus l'onglet — sa colonne de filtres et ses trente
  // cartes —, ce qui se faisait pendant l'entrée même de la fiche.
  const [ficheProjet] = useState(() => creerMagasinFiche<Projet>());
  // La page de la liste. Les compteurs, eux, portent sur TOUT le filtre : on
  // pagine ce qu'on lit, pas ce qu'on compte.
  const [page, setPage] = useState(1);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);
  const rechercheD = useDebounced(recherche, 300);
  // La période se stabilise avant d'être interrogée : un curseur émet une
  // valeur par pixel parcouru, et le périmètre comme les projets se
  // redemanderaient à chaque pas.
  const anneeMinD = useDebounced(anneeMin, 300);
  const anneeMaxD = useDebounced(anneeMax, 300);

  // Le périmètre dépend du sens : les pays proposés sont ceux qui existent
  // DANS CE SENS. Basculer de destination à source ne doit pas laisser un pays
  // qui n'y a aucun projet.
  // Ce que la hiérarchie sectorielle transmet : les secteurs retenus EN ENTIER
  // d'un côté, les sous-secteurs retenus de l'autre. Un secteur où l'on est
  // descendu sort de la première liste — sinon le OU de la requête le
  // ramènerait tout entier, et la précision serait sans effet.
  const selectionSectorielle = useMemo(() => {
    const precises = new Set(sousSecteurs.map(s => s.secteur));
    return {
      secteurs: secteurs.filter(s => !precises.has(s)).join("|"),
      sous_secteurs: sousSecteurs.map(s => s.nom).join("|"),
    };
  }, [secteurs, sousSecteurs]);

  // CE QUI PART DANS L'ADRESSE : un pays OU une région, jamais les deux. Le
  // service traduit la région en la liste de ses pays ; l'écran n'a donc qu'à
  // dire laquelle, et les deux échelles ne peuvent pas se contredire.
  const poserCible = (p: URLSearchParams) => {
    if (echelle === "regions") { if (region) p.set("region", region); }
    else if (pays) p.set("pays", pays);
  };

  // Les facettes cascadent : le périmètre est redemandé à chaque changement de
  // filtre, et chaque facette y est comptée sous les AUTRES filtres.
  const urlPerimetre = useMemo(() => {
    const p = new URLSearchParams({ sens });
    poserCible(p);
    // La PÉRIODE entre dans la cascade au même titre que les facettes :
    // restreindre 2015-2019 doit retirer des listes les secteurs et les
    // activités qui n'ont rien annoncé pendant ces années-là.
    if (anneeMinD != null) p.set("annee_min", String(anneeMinD));
    if (anneeMaxD != null) p.set("annee_max", String(anneeMaxD));
    for (const [cle, v] of Object.entries(selectionSectorielle)) if (v) p.set(cle, v);
    if (activites.length) p.set("activites", activites.join("|"));
    return `${API}/fdi/public/perimetre?${p}`;
  }, [sens, echelle, pays, region, anneeMinD, anneeMaxD, selectionSectorielle, activites]);
  const qPer = useDonnees<Perimetre>(urlPerimetre, { garder: true });
  const per = qPer.data;

  // LE SÉNÉGAL D'ABORD. C'est le pays de référence de la plateforme : elle est
  // lue à l'APIX, et la première question qu'on lui pose est celle du Sénégal.
  // Ouvrir sur l'Afrique du Sud parce qu'elle compte le plus de projets
  // obligeait à changer de pays avant de commencer à lire.
  //
  // À défaut — un sens de lecture où le Sénégal n'est pas relevé — le mieux
  // fourni reprend la place, plutôt que de laisser l'écran vide.
  //
  // Une seule fois, à la première réponse du périmètre : depuis que les
  // facettes cascadent, un pays peut sortir de la liste parce qu'un autre
  // filtre l'a vidé — basculer alors sur un voisin déplacerait le lecteur sans
  // qu'il l'ait demandé.
  //
  // PENDANT LE RENDU, et non dans un effet : l'ajustement se fait avant
  // l'affichage, l'écran ne montre jamais l'état d'avant. La réponse gardée de
  // la requête précédente (`isPlaceholderData`) ne compte pas : elle décrit
  // l'autre sens de lecture.
  if (per?.pays?.length && !qPer.isPlaceholderData) {
    const mieux = per.pays.some(p => p.nom === PAYS_REFERENCE) ? PAYS_REFERENCE : per.pays[0].nom;
    if (paysSuppose) {
      setPaysSuppose(false);
      if (pays && !per.pays.some(p => p.nom === pays)) setPays(mieux);
    } else if (!pays) setPays(mieux);
    // À L'ÉCHELLE DES RÉGIONS, LA MÊME RÈGLE : celle du Sénégal d'abord. Le cas
    // n'arrive qu'à la reprise d'une adresse qui dit l'échelle sans dire la
    // région — le clic sur « Régions », lui, la choisit lui-même.
    if (echelle === "regions" && !region) {
      const ref = per.pays.find(p => p.nom === PAYS_REFERENCE) ?? per.pays[0];
      const r = ref.continent ?? ref.region_geo ?? null;
      if (r) setRegion(r);
    }
  }

  // Changer de sens change de périmètre : le pays retenu n'y existe pas
  // forcément. On repart du Sénégal, supposé — la réponse du périmètre le
  // confirmera ou donnera le mieux fourni — plutôt que de vider le pays, ce
  // qui redemandait d'abord tout le relevé.
  const changerSens = (v: "destination" | "source") => {
    if (v === sens) return;
    setSens(v); setPays(PAYS_REFERENCE); setPaysSuppose(true); setRegion(null);
  };

  // Le filtre SANS la page : il sert à l'adresse, et à savoir quand revenir au
  // premier écran. Rester en page 40 d'un résultat qui n'en compte plus qu'une
  // n'aurait aucun sens.
  const filtre = useMemo(() => {
    const p = new URLSearchParams({ sens });
    poserCible(p);
    if (anneeMinD != null) p.set("annee_min", String(anneeMinD));
    if (anneeMaxD != null) p.set("annee_max", String(anneeMaxD));
    for (const [cle, v] of Object.entries(selectionSectorielle)) if (v) p.set(cle, v);
    if (activites.length) p.set("activites", activites.join("|"));
    if (rechercheD.trim()) p.set("recherche", rechercheD.trim());
    return p.toString();
  }, [sens, echelle, pays, region, anneeMinD, anneeMaxD, selectionSectorielle, activites, rechercheD]);

  const [vuFiltre, setVuFiltre] = useState(filtre);
  if (filtre !== vuFiltre) { setVuFiltre(filtre); setPage(1); }

  const url = useMemo(
    () => `${API}/fdi/public/projets?${filtre}&page=${page}&par_page=${PAR_PAGE}`,
    [filtre, page]);

  const q = useDonnees<Reponse>(url, { garder: true });
  const d = q.data;


  const bornes = per?.annees ?? [null, null];
  const periodeChoisie = (anneeMin != null && anneeMin !== bornes[0])
    || (anneeMax != null && anneeMax !== bornes[1]);
  const nbFiltresProjets = secteurs.length + sousSecteurs.length + activites.length
    + (rechercheD.trim() ? 1 : 0)
    + (periodeChoisie ? 1 : 0);
  const nbFiltres = nbFiltresProjets;
  // L'état de la page s'écrit dans l'URL — vue, pays, période, facettes,
  // recherche. Trois raisons : le lien devient partageable, F5 ne perd rien,
  // et le rapport peut ramener EXACTEMENT ici, filtres compris.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    p.set("section", "projetes");
    const poser = (cle: string, v: string | null | undefined) => {
      if (v) p.set(cle, v); else p.delete(cle);
    };
    // LA VUE S'ÉCRIT SOUS « volet », PAS SOUS « vue ». Cette clef-là est celle
    // de la page (vue Pays / Secteurs des investissements réalisés) : en la
    // réécrivant ici, on effaçait le choix de la page — passer par « projetés »
    // puis revenir ramenait sur la vue Pays, alors qu'on avait quitté
    // Secteurs. Une ancienne adresse « vue=signaux » est reprise à l'ouverture
    // (etatDepuisAdresse) puis retirée, pour qu'elle ne revienne pas démentir
    // « volet » au rechargement suivant.
    poser("volet", vue === "projets" ? null : vue);
    if (["projets", "signaux", "entreprises"].includes(p.get("vue") ?? "")) p.delete("vue");
    poser("sens", sens === "destination" ? null : sens);
    poser("pays", echelle === "regions" ? null : pays);
    poser("region", echelle === "regions" ? region : null);
    poser("a0", anneeMin != null && anneeMin !== bornes[0] ? String(anneeMin) : null);
    poser("a1", anneeMax != null && anneeMax !== bornes[1] ? String(anneeMax) : null);
    poser("sec", secteurs.join("|"));
    poser("ssec", sousSecteurs.map(s => `${s.secteur}::${s.nom}`).join("|"));
    poser("act", activites.join("|"));
    // PLUS DE FILTRE SUR LE TYPE DE PROJET (nouvelle implantation,
    // extension…), retiré de la colonne à la demande. Une adresse d'avant le
    // porte encore : la clef est effacée, et n'est plus lue — un filtre
    // appliqué sans être affiché fausserait la liste à l'insu du lecteur.
    poser("typ", null);
    poser("q", rechercheD.trim());
    // LES FILTRES DES SIGNAUX Y VONT AUSSI, préfixés pour ne pas se confondre
    // avec ceux des projets — « sec » et « act » sont déjà pris, et deux vues
    // qui écriraient la même clef se marcheraient dessus au rechargement.
    //
    // Deux raisons, et la seconde a décidé : le lien devient partageable et F5
    // ne perd rien ; surtout, le RAPPORT lit cette adresse pour porter la même
    // sélection que l'écran d'où on l'a demandé. Un rapport qui démentirait
    // l'écran ne servirait à rien.
    poser("s_ori", filtresSignaux.origine);
    poser("s_dest", filtresSignaux.destination);
    poser("s_sec", filtresSignaux.secteur);
    poser("s_act", filtresSignaux.activite);
    poser("s_a0", filtresSignaux.anneeMin != null ? String(filtresSignaux.anneeMin) : null);
    poser("s_a1", filtresSignaux.anneeMax != null ? String(filtresSignaux.anneeMax) : null);
    poser("s_q", filtresSignaux.recherche.trim());
    // ET CEUX DES ENTREPRISES, préfixés de la même façon. Ils n'y étaient pas :
    // la vue n'avait pas de rapport quand ces clefs ont été écrites, et son
    // état mourait donc au rechargement. Maintenant qu'elle en a un, l'oubli se
    // voyait — le rapport des investisseurs lisait une adresse où rien n'était
    // écrit, et sortait invariablement sur tout le relevé.
    poser("e_ori", filtresEntreprises.origines.join("|"));
    poser("e_dest", filtresEntreprises.destinations.join("|"));
    poser("e_sec", filtresEntreprises.secteurs.join("|"));
    poser("e_ssec", filtresEntreprises.sousSecteurs.map(s => `${s.secteur}::${s.nom}`).join("|"));
    poser("e_act", filtresEntreprises.activites.join("|"));
    poser("e_q", filtresEntreprises.recherche.trim());
    // Une adresse partagée du temps où la vue avait une période porte encore
    // ces deux clefs. Plus personne ne les lit, mais rien ne les effaçait non
    // plus : elles resteraient indéfiniment dans la barre d'adresse et dans le
    // lien du rapport. On les retire une bonne fois.
    poser("e_a0", null); poser("e_a1", null);
    window.history.replaceState(null, "", `${window.location.pathname}?${p}`);
  }, [vue, sens, echelle, pays, region, anneeMin, anneeMax, secteurs, sousSecteurs,
      activites, rechercheD, bornes, filtresSignaux, filtresEntreprises]);

  const reinitProjets = () => {
    setSecteurs([]); setSousSecteurs([]); setActivites([]); setRecherche("");
    setAnneeMin(null); setAnneeMax(null);
  };
  const reinit = reinitProjets;

  // LE COMPTEUR ET LA REMISE À ZÉRO SUIVENT LA VUE OUVERTE, et c'était un
  // défaut tant qu'il n'y avait qu'un jeu de filtres : l'en-tête annonçait
  // toujours ceux des projets, y compris en lisant les signaux, et la croix
  // rouge remettait à zéro une colonne qu'on n'avait pas sous les yeux.
  //
  // Le pays d'observation des projets n'est PAS compté : il n'est pas un
  // filtre qu'on ajoute mais le sujet de la page — il y en a toujours un, et
  // « réinitialiser » ne doit pas laisser l'écran sans pays.
  const filtresDeLaVue = {
    projets: {
      nb: nbFiltresProjets,
      remettre: reinitProjets,
    },
    signaux: {
      // LA PÉRIODE COMPTE POUR UN, non pour deux : ses deux bornes sont un
      // seul geste, et l'afficher « 2 filtres actifs » après un glissement de
      // curseur ferait chercher le second.
      nb: (["origine", "destination", "secteur", "activite"] as const)
            .filter(c => filtresSignaux[c]).length
          + (filtresSignaux.recherche.trim() ? 1 : 0)
          + (filtresSignaux.anneeMin != null || filtresSignaux.anneeMax != null ? 1 : 0),
      remettre: () => setFiltresSignaux(FILTRES_SIGNAUX_VIDES),
    },
    entreprises: {
      nb: filtresEntreprises.origines.length + filtresEntreprises.destinations.length
        + filtresEntreprises.secteurs.length + filtresEntreprises.sousSecteurs.length
        + filtresEntreprises.activites.length
        + (filtresEntreprises.recherche.trim() ? 1 : 0),
      remettre: () => setFiltresEntreprises(FILTRES_ENTREPRISES_VIDES),
    },
  }[vue];

  // Le pays de référence est épinglé au-dessus ; il n'est pas retiré des
  // groupes pour autant — il garde sa place dans sa région, où l'œil ira le
  // chercher s'il y descend, mais s'y montre inerte pour ne pas laisser croire
  // à deux entrées différentes.
  const paysFiltres = (per?.pays ?? []).filter(p =>
    !chercherPays || p.nom.toLowerCase().includes(chercherPays.toLowerCase()));
  const paysReference = (per?.pays ?? []).find(p => p.nom === PAYS_REFERENCE) ?? null;
  const paysGroupes = groupByContinent(paysFiltres);
  // Une recherche ouvre les continents : chercher « Kenya » pour tomber sur des
  // en-têtes repliés serait une réponse sans réponse. Hors recherche, seul le
  // continent du pays retenu s'ouvre — celui qu'on est en train de lire.
  // Continents et régions se replient de la même façon et partagent donc un
  // seul état. La clef d'une région porte son continent : deux continents
  // pourraient nommer une région pareil sans qu'elles se confondent.
  // LES RÉGIONS DIRECTEMENT, SANS LE CONTINENT AU-DESSUS. Le relevé ne couvre
  // qu'un continent : « Afrique » ne distinguait rien et coûtait un clic avant
  // d'atteindre quoi que ce soit. Les régions restent rangées par continent —
  // celles d'un même continent se suivent — mais se lisent d'emblée.
  //
  // La clef garde le continent : deux continents peuvent nommer une région
  // pareil, et un jour où le relevé en couvrira deux, rien ne se confondra.
  const aplatirZones = (liste: ComptePays[]) => Object.entries(groupByContinent(liste))
    .flatMap(([continent, zones]) => Object.entries(zones).map(([zone, dedans]) => ({
      cle: `${continent} · ${zone}`, continent, zone, dedans: dedans as ComptePays[],
      // Le compte d'une région est la SOMME de ses pays, et il peut l'être :
      // un projet n'a qu'un pays de destination, donc aucun n'est compté deux
      // fois. C'est aussi ce que le service renvoie quand on retient la
      // région — vérifié zone par zone —, et la colonne ne peut donc pas
      // annoncer un total que la liste dépliée démentirait.
      nb: (dedans as ComptePays[]).reduce((t, p) => t + p.nb, 0),
    })))
    .sort((a, b) => rangContinent(a.continent) - rangContinent(b.continent)
                 || a.zone.localeCompare(b.zone, "fr"));
  const regions = aplatirZones(paysFiltres);
  // LES RÉGIONS À CHOISIR NE SUIVENT PAS LA RECHERCHE DE PAYS : le champ ne
  // s'affiche pas à cette échelle, et une recherche laissée derrière soi en
  // passant de « Pays » à « Régions » en ferait disparaître quatre sur cinq.
  const zones = aplatirZones(per?.pays ?? []);
  // LE CONTINENT COIFFE SES RÉGIONS, et se retient comme elles. Son total est
  // la somme des leurs — un projet n'a qu'une destination, donc aucun n'est
  // compté deux fois, et c'est bien ce que le service rend quand on le retient.
  //
  // Il vient du RÉFÉRENTIEL, jamais d'une constante : le jour où le relevé
  // couvrira deux continents, deux blocs s'afficheront sans qu'on y touche.
  // Les pays qu'il n'a pas classés se rangent sous « Autre », comme ailleurs.
  const continents = ORDRE_CONTINENTS
    .concat(["Autre"])
    .map(nom => ({ nom, zones: zones.filter(z => z.continent === nom) }))
    .filter(c => c.zones.length > 0)
    .map(c => ({ ...c, nb: c.zones.reduce((t, z) => t + z.nb, 0) }));

  // À L'ÉCHELLE DES RÉGIONS, LE CONTINENT S'OUVRE : ses cinq régions sont ce
  // qu'on vient y choisir, et les cacher derrière un chevron ferait de
  // l'échelle « Régions » un écran où il n'y a rien à cliquer.
  //
  // À L'ÉCHELLE DES PAYS, TOUT EST REPLIÉ AU DÉPART. Cinq barres tiennent sous les yeux d'un coup ;
  // en ouvrir une d'office rejetterait les autres hors de l'écran et rendrait
  // la liste plus longue à parcourir qu'à parcourir repliée. Le pays retenu par
  // défaut est le Sénégal, épinglé au-dessus : il n'y a rien à aller montrer
  // dans les régions tant que le lecteur n'en ouvre pas une.
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  // Les continents REPLIÉS, et non les ouverts : à cette échelle la liste
  // s'ouvre déployée, et l'ensemble vide est donc le bon état de départ. Deux
  // états plutôt qu'un seul retourné selon l'échelle — une même structure qui
  // voudrait dire « ouvert » ici et « fermé » là se relit très mal.
  const [replies, setReplies] = useState<Set<string>>(new Set());
  const replier = (cle: string) => setReplies(prev => {
    const n = new Set(prev);
    if (n.has(cle)) n.delete(cle); else n.add(cle);
    return n;
  });
  // Une recherche déplie tout : chercher « Kenya » pour tomber sur des en-têtes
  // repliés serait une réponse sans réponse.
  const deplies = chercherPays ? new Set(regions.map(r => r.cle)) : ouverts;
  const basculer = (cle: string) => setOuverts(prev => {
    const n = new Set(prev);
    if (n.has(cle)) n.delete(cle); else n.add(cle);
    return n;
  });

  // Tout ce que le sens de lecture renomme. Le pays observé change de rôle, et
  // avec lui le titre du filtre et la colonne du pied de carte : « Pays
  // d'origine » sous un relevé « reçoit », « Pays de destination » sous un
  // relevé « investit ».
  //
  // « DESTINATION », ET NON PLUS « PAYS DESTINATAIRE » : le filtre se lit
  // maintenant à deux échelles, et le titre ne pouvait plus nommer l'une des
  // deux. Il dit le RÔLE — où va l'investissement —, le sélecteur juste en
  // dessous dit à quelle maille on le regarde.
  const dansCeSens = sens === "destination"
    ? { filtre: "Destination", partenaire: "Pays d'origine" }
    : { filtre: "Origine", partenaire: "Pays de destination" };
  const libellePartenaire = dansCeSens.partenaire;

  const tag = d?.kpis?.annees?.[0] != null
    ? (d.kpis.annees[0] === d.kpis.annees[1] ? `${d.kpis.annees[0]}` : `${d.kpis.annees[0]} — ${d.kpis.annees[1]}`)
    : undefined;

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {/* ── Filtres ─────────────────────────────────────────────────────────── */}
      <aside style={{ width: sidebarWidth, flexShrink: 0, background: "var(--carte)",
        borderRight: "1px solid var(--bordure-forte)", height: "100%", overflowY: "auto" as const,
        overscrollBehavior: "contain" as const, display: "flex", flexDirection: "column" as const }}>
        <div onMouseDown={e => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 200, 520)}
          style={{ position: "absolute" as const, right: 0, top: 0, bottom: 0, width: 4,
            cursor: "col-resize", zIndex: 10, background: "transparent" }} />
        <EnteteFiltres nbFiltres={filtresDeLaVue.nb} aDesFiltres={filtresDeLaVue.nb > 0}
          onReinit={filtresDeLaVue.remettre} />

        <div style={{ padding: 16, overflowY: "auto" as const, flex: 1 }}>
          {/* Vue : les trois bases de fDi Markets */}
          <div style={{ marginBottom: 18 }}>
            <span style={{ ...TITRE_SS, display: "block", marginBottom: 8 }}>Vue</span>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
              {VUES.map(o => {
                const sel = vue === o.v;
                return (
                  <button key={o.v} onClick={() => setVue(o.v)}
                    title={`fDi Markets · ${o.src}`} style={btnVue(sel)}
                    onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "var(--carte-douce)"; }}
                    onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    {o.l}
                  </button>
                );
              })}
            </div>
          </div>

          {vue === "signaux" && (
            <FiltresSignauxPanneau filtres={filtresSignaux} onChange={setFiltresSignaux} />
          )}

          {vue === "entreprises" && (
            <FiltresEntreprisesPanneau filtres={filtresEntreprises}
              onChange={setFiltresEntreprises} />
          )}

          {/* LES FILTRES ATTENDENT LE PÉRIMÈTRE, et arrivent d'un bloc. Ils
              s'affichaient par morceaux : « Aucun pays trouvé » sous un
              sélecteur vide, puis la période qui s'insérait au-dessus et
              poussait tout le reste de quatre-vingts pixels. */}
          {vue === "projets" && qPer.isPending && <><Filet /><AttenteFiltres /></>}
          {vue === "projets" && !qPer.isPending && (
            <>
              <Filet />

              {/* La bascule de sens n'apparaît que si les deux relevés
                  existent. Un lot ne rend exhaustif qu'un couple (pays,
                  sens) : offrir la lecture inverse sans le relevé
                  correspondant ouvrirait une liste vide. */}
              {(per?.sens_disponibles?.length ?? 0) > 1 && (
                <div style={{ marginBottom: 18 }}>
                  <span style={{ ...TITRE_SS, display: "block", marginBottom: 8 }}>Sens de lecture</span>
                  <div className="ds-segments" style={{ display: "flex", padding: 3, gap: 3 }}>
                    {([
                      { v: "destination" as const, l: "Reçoit" },
                      { v: "source" as const, l: "Investit" },
                    ]).map(o => {
                      const actif = sens === o.v;
                      return (
                        <button key={o.v} onClick={() => changerSens(o.v)} aria-pressed={actif}
                          className="ds-segment" style={{ flex: 1, padding: "6px 10px", fontSize: 11.5 }}>
                          {o.l}
                        </button>
                      );
                    })}
                  </div>
                  <Filet />
                </div>
              )}

              {/* LA PÉRIODE OUVRE LA COLONNE, avant le pays : c'est le cadre
                  dans lequel tout le reste se lit. « Ce que le Sénégal
                  reçoit » ne veut rien dire sans dire de quand — un projet
                  annoncé en 2005 et un de 2026 ne se lisent pas de la même
                  façon.

                  Ses bornes viennent de ce que les données couvrent, et le
                  curseur ne s'affiche pas si le relevé tient sur une seule
                  année : il n'y aurait rien à y régler. */}
              {bornes[0] != null && bornes[1] != null && bornes[1] > bornes[0] && (
                <div style={{ marginBottom: 18 }}>
                  <EntetePeriode resume={resumePeriode(anneeMin ?? bornes[0], anneeMax ?? bornes[1])} />
                  <CurseurPlageNace min={bornes[0]} max={bornes[1]}
                    debut={anneeMin ?? bornes[0]} fin={anneeMax ?? bornes[1]}
                    // Revenu sur une borne, le curseur ne « choisit » plus rien :
                    // la requête redevient celle de toute la période.
                    onChange={(a, b) => { setAnneeMin(a === bornes[0] ? null : a); setAnneeMax(b === bornes[1] ? null : b); }} />
                  <div style={{ height: 18 }} />
                  <Filet />
                </div>
              )}

              {/* Les pays dont le périmètre est complet dans ce sens. La base porte les deux
                  bouts de chaque projet, mais un relevé n'en rend exhaustif
                  qu'un seul : les autres pays n'y figurent que pour ce qu'ils
                  ont échangé avec celui-ci, et les proposer laisserait croire
                  à une couverture qu'on n'a pas. */}
              <div style={{ marginBottom: 18 }}>
                <span style={{ ...TITRE_SS, display: "block", marginBottom: 8 }}>{dansCeSens.filtre}</span>
                {/* À QUELLE MAILLE ON REGARDE. « Pays » est la lecture
                    historique, inchangée ; « Régions » pose la même question
                    un cran au-dessus — ce que reçoit toute l'Afrique de
                    l'Ouest, et non ce que reçoit le Sénégal.

                    DEUX BOUTONS PLUTÔT QU'UN NIVEAU DE PLUS DANS LA LISTE.
                    Rendre les en-têtes de région cliquables aurait mêlé deux
                    gestes sur un même objet — déplier, et retenir — et l'on
                    n'aurait plus su ce qu'un clic allait faire.

                    Changer d'échelle EMPORTE LA SÉLECTION D'EN FACE : les
                    deux ne peuvent pas valoir ensemble, et l'écran ne montre
                    jamais les deux listes. Mais elle n'est pas oubliée —
                    revenir à « Pays » rend le pays qu'on lisait. */}
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {([{ v: "pays", l: "Pays" }, { v: "regions", l: "Régions" }] as const).map(o => (
                    <button key={o.v} style={btnSegment(echelle === o.v)}
                      onClick={() => {
                        setEchelle(o.v);
                        // La région d'arrivée est celle du pays qu'on lisait :
                        // on monte d'un cran sans changer de sujet.
                        // LE CONTINENT D'ABORD, ET NON LA RÉGION DU PAYS
                        // QU'ON LISAIT. Monter d'un cran depuis le Sénégal
                        // donnait l'Afrique de l'Ouest ; c'était déjà
                        // restreindre. « Régions » ouvre donc sur le plus
                        // large — tout le relevé — et l'on descend ensuite.
                        if (o.v === "regions" && !region) {
                          const p = (per?.pays ?? []).find(x => x.nom === (pays ?? PAYS_REFERENCE));
                          setRegion(p?.continent ?? continents[0]?.nom ?? null);
                        }
                      }}>{o.l}</button>
                  ))}
                </div>
                {echelle === "regions" ? (
                  /* ── LE CONTINENT, PUIS SES RÉGIONS ───────────────────
                     ON RAISONNE EN BLOC AVANT DE DESCENDRE. « Que reçoit
                     l'Afrique » est la première question ; « que reçoit
                     l'Afrique de l'Ouest » la seconde. La liste ne portait
                     que la seconde, et l'on ne pouvait donc pas lire le
                     relevé entier à cette échelle — il fallait repasser en
                     « Pays » et n'en choisir aucun, ce que rien n'indiquait.

                     LE CONTINENT EST RETENU PAR DÉFAUT : c'est le plus large,
                     et l'on restreint depuis le large. Il n'est pas un
                     en-tête décoratif mais une ligne cliquable comme les
                     autres, avec son propre total — la somme de ses régions.

                     LA PASTILLE NE CHANGE PAS DE COULEUR D'UN NIVEAU À
                     L'AUTRE. C'est le retrait et le rail qui disent la
                     hiérarchie ; teinter les niveaux ferait lire deux
                     natures de filtre là où il n'y en a qu'une. */
                  <div>
                    {continents.map(c => {
                      const ouvert = !replies.has(c.nom);
                      const selC = region === c.nom;
                      return (
                        <div key={c.nom}>
                          <button onClick={() => setRegion(c.nom)} style={LIGNE_FACETTE}
                            onMouseEnter={e => { if (!selC) (e.currentTarget as HTMLElement).style.background = "var(--carte-douce)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                            {/* LE CHEVRON REPLIE, IL NE RETIENT PAS. Deux
                                gestes sur une même ligne se confondraient ;
                                il porte donc son propre bouton, et son clic
                                ne remonte pas à la ligne. */}
                            <span role="button" tabIndex={0} aria-label={ouvert ? "Replier" : "Déplier"}
                              onClick={e => { e.stopPropagation(); replier(c.nom); }}
                              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); replier(c.nom); } }}
                              style={{ display: "inline-flex", cursor: "pointer", flexShrink: 0, marginLeft: -2 }}>
                              <ChevronDown size={12} style={{ color: "var(--gris)",
                                transform: ouvert ? "rotate(0deg)" : "rotate(-90deg)",
                                transition: "transform 0.15s" }} />
                            </span>
                            <Pastille coche={selC} />
                            <span style={{ fontSize: 12, color: "var(--texte)", fontWeight: selC ? 700 : 400,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{c.nom}</span>
                            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--gris)",
                              fontVariantNumeric: "tabular-nums" as const }}>{fmtNombre(c.nb)}</span>
                          </button>
                          {/* LE RAIL TIENT LIEU D'INDENTATION : il dit à quoi
                              les lignes se rattachent, ce qu'un simple retrait
                              laisse deviner. */}
                          {ouvert && (
                            <div style={{ marginLeft: 13, paddingLeft: 9,
                              borderLeft: "1px solid var(--bordure)" }}>
                              {c.zones.map(z => {
                                const sel = region === z.zone;
                                return (
                                  <button key={z.cle} onClick={() => setRegion(z.zone)}
                                    style={LIGNE_FACETTE}
                                    onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "var(--carte-douce)"; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                                    <Pastille coche={sel} />
                                    <span style={{ fontSize: 12, color: "var(--texte)", fontWeight: sel ? 700 : 400,
                                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{z.zone}</span>
                                    {/* LE SEUL NOMBRE EST CELUI DES PROJETS,
                                        comme sur toutes les autres lignes de
                                        la colonne. */}
                                    <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--gris)",
                                      fontVariantNumeric: "tabular-nums" as const }}>{fmtNombre(z.nb)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {continents.length === 0 && (
                      <p style={{ fontSize: 12, color: "var(--gris)", textAlign: "center" as const, padding: "8px 0" }}>
                        Aucune région relevée
                      </p>
                    )}
                  </div>
                ) : (
                <>
                {(per?.pays?.length ?? 0) > 6 && (
                  <div style={{ position: "relative" as const, marginBottom: 8 }}>
                    <Search size={13} style={{ position: "absolute" as const, left: 9, top: "50%",
                      transform: "translateY(-50%)", color: "var(--gris)" }} />
                    <input value={chercherPays} onChange={e => setChercherPays(e.target.value)}
                      placeholder="Rechercher un pays…" className="ds-champ"
                      style={{ height: 36, padding: "0 8px 0 30px", fontSize: 12 }} />
                  </div>
                )}
                {/* Le pays de référence, épinglé. Il échappe à la recherche
                    et au repli des continents : c'est le point de départ de
                    la lecture, il doit rester à portée sans manœuvre. */}
                {paysReference && (
                  <>
                    <button onClick={() => setPays(paysReference.nom)}
                      style={LIGNE_FACETTE}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--carte-douce)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                      <Pastille coche={pays === paysReference.nom} />
                      <span style={{ fontSize: 12, color: "var(--texte)",
                        fontWeight: pays === paysReference.nom ? 700 : 400 }}>{paysReference.nom}</span>
                      <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: "var(--gris)",
                          fontVariantNumeric: "tabular-nums" }}>{fmtNombre(paysReference.nb)}</span>
                        <span style={{ fontSize: 9, fontWeight: 600, color: "var(--gris)",
                          background: "var(--carte-douce)", padding: "1px 5px", borderRadius: 4 }}>Réf.</span>
                      </span>
                    </button>
                    <div style={{ height: 1, background: "var(--filet)", margin: "8px 0" }} />
                  </>
                )}
                <div style={{ maxHeight: 260, overflowY: "auto" as const }}>
                  {regions.map(r => {
                    const ouvert = deplies.has(r.cle);
                    return (
                      <div key={r.cle} style={{ marginBottom: 4 }}>
                        <BarreRepli titre={r.zone} ouvert={ouvert}
                          onBasculer={() => basculer(r.cle)} />
                        {ouvert && r.dedans.map(p => {
                          const sel = pays === p.nom;
                          // Le pays de référence est déjà épinglé plus haut :
                          // ici il se montre, mais ne se clique pas.
                          const epingle = p.nom === PAYS_REFERENCE;
                          return (
                            <button key={p.nom} onClick={() => setPays(p.nom)} disabled={epingle}
                              title={epingle ? "Déjà épinglé en haut de la liste" : undefined}
                              style={{ ...LIGNE_FACETTE, marginLeft: 6, width: "calc(100% - 6px)",
                                cursor: epingle ? "default" : "pointer",
                                opacity: epingle ? 0.45 : 1 }}
                              onMouseEnter={e => { if (!sel && !epingle) (e.currentTarget as HTMLElement).style.background = "var(--carte-douce)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                              <Pastille coche={sel} />
                              <span style={{ fontSize: 12, color: "var(--texte)", fontWeight: sel ? 700 : 400,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{p.nom}</span>
                              <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--gris)",
                                fontVariantNumeric: "tabular-nums" }}>{epingle ? "Réf." : fmtNombre(p.nb)}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                  {paysFiltres.length === 0 && (
                    <p style={{ fontSize: 12, color: "var(--gris)", textAlign: "center" as const, padding: "8px 0" }}>
                      Aucun pays trouvé
                    </p>
                  )}
                </div>
                </>
                )}
              </div>

              <Filet />

              <FacetteSecteurs titre="Secteurs économiques"
                secteurs={per?.secteurs ?? []} sousSecteurs={per?.sous_secteurs ?? []}
                choixSec={secteurs} choixSous={sousSecteurs}
                onChange={(sec, sous) => { setSecteurs(sec); setSousSecteurs(sous); }} />
              <Facette titre="Activités économiques" options={per?.activites ?? []} choix={activites} setChoix={setActivites} />
            </>
          )}
        </div>
      </aside>

      {/* ── Contenu ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" as const,
        overscrollBehavior: "contain" as const, padding: "22px 30px 60px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          {vue === "signaux"
           ? <VueSignauxPublics filtres={filtresSignaux} onChange={setFiltresSignaux} />
           : vue === "entreprises"
           ? <VueEntreprisesPubliques filtres={filtresEntreprises}
               onChange={setFiltresEntreprises} /> : (
            <>
              {/* En-tête : le pays et la période couverte — et la recherche
                  sur la même ligne, alignée à droite. Sans étiquette de
                  qualification (« Projets reçus ») : la vue le dit déjà, et le
                  titre n'a pas à le répéter. */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const, marginBottom: 20 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--bleu-action)", flexShrink: 0 }} />
                <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--encre)", lineHeight: 1.1 }}>
                  {(echelle === "regions" ? region : pays) ?? "—"}
                </h2>
                {tag && <BadgePeriode>{tag}</BadgePeriode>}
                <div style={{ marginLeft: "auto", position: "relative" as const, minWidth: 200, flex: "0 1 300px" }}>
                  <Search size={13} style={{ position: "absolute" as const, left: 12, top: "50%",
                    transform: "translateY(-50%)", color: "var(--gris)" }} />
                  <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher"
                    className="ds-champ" style={{ height: 36, padding: "0 10px 0 34px", fontSize: 12.5 }} />
                </div>
              </div>

              {q.isError ? <ErreurChargement onRetry={() => q.refetch()} /> : !d ? (
                <AttenteCartes hauteur={146} />
              ) : d.kpis.projets === 0 ? (
                <div style={{ textAlign: "center" as const, padding: "80px 24px", color: "var(--gris)" }}>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "var(--texte)" }}>Aucun projet sur ce périmètre</p>
                  <p style={{ fontSize: 13.5, marginTop: 8 }}>
                    Les filtres actifs ne laissent aucun projet. {nbFiltres > 0 && (
                      <button onClick={reinit} style={{ background: "none", border: "none", cursor: "pointer",
                        color: "var(--bleu)", fontWeight: 700, fontSize: 13.5, fontFamily: "var(--font-google-sans)", padding: 0 }}>
                        Tout réinitialiser
                      </button>
                    )}
                  </p>
                </div>
              ) : (
                <div>
                  {/* Ni compteur ni cadre : les cartes reposent directement sur
                      la page, comme partout ailleurs sur le site, et le nombre
                      de projets se lit deja dans le filtre « Pays ». */}
                  <div style={{ display: "grid", gap: 14,
                    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
                    {d.projets.map(p => (
                      <CarteProjet key={p.id} p={p} onOuvrir={() => ficheProjet.ouvrir(p)}
                        libellePartenaire={libellePartenaire} />
                    ))}
                  </div>
                  <Pagination courante={d.page} pages={d.pages} onPage={setPage}
                    nom="projet" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* La fiche du projet ouvert. Elle est montée ici, hors de la grille :
          une modale enfant d'une carte hériterait de son curseur et de ses
          gestionnaires de clic. */}
      <HoteFicheProjet magasin={ficheProjet} sens={sens} />
    </div>
  );
}

/** Un montant, écrit comme un chiffre de tableau de bord : la valeur grande,
    son unité petite à côté. Une valeur estimée par fDi ne se distingue plus
    d'une valeur déclarée (ni « ≈ », ni infobulle), à la demande.
    Les millions de dollars suivent la règle commune (lib/format) : 0,64 M$
    s'écrit « 640 k $ », 2 940 M$ « 2,94 Md $ » — à une décimale, le premier
    devenait « 0,6 M$ ». Un effectif (« postes ») garde son écriture. */
function Montant({ v, unite, taille = 16 }: {
  v: number | null; unite: string; taille?: number;
}) {
  if (v == null) return <span style={{ fontSize: taille, fontWeight: 700, color: "var(--gris)" }}>—</span>;
  const { nombre, unite: suffixe } = unite === "M$"
    ? fmtMillionsUSDParts(v)
    : { nombre: v.toLocaleString("fr-FR", { maximumFractionDigits: 1 }), unite };
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" as const }}>
      <span style={{ fontSize: taille, fontWeight: 800, color: "var(--encre)",
        fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
        {nombre}
      </span>
      <span style={{ fontSize: taille * 0.62, fontWeight: 700, color: "var(--gris)" }}>{suffixe}</span>
    </span>
  );
}

/** Un projet, en tuile.

    Elle répond à quatre questions et s'arrête là : QUI investit, D'OÙ il
    vient, DANS QUOI, COMBIEN. Le reste — sous-secteur, type et nature de
    l'implantation, description — appartient à la fiche : une tuile qui dit
    tout ne se parcourt plus, elle se lit, et il y en a deux cent trente-cinq.
    Le type (« Nouvelle implantation », « Extension »…) a quitté la tuile pour
    la même raison : une pastille sur chacune, et la grille devenait une
    mosaïque d'étiquettes. Le survol prend donc le bleu des autres cartes. */
function CarteProjet({ p, onOuvrir, libellePartenaire }: {
  p: Projet; onOuvrir: () => void; libellePartenaire: string;
}) {
  return (
    <article onClick={onOuvrir} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOuvrir(); } }}
      style={CARTE_CLIQUABLE} {...survolCarte("bleu")}>

      {/* La période : le contexte, avant le nom. */}
      <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gris)",
        letterSpacing: "0.02em", marginBottom: 10 }}>
        {moisEnClair(p.periode)}
      </span>

      <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "var(--encre)", lineHeight: 1.25,
        letterSpacing: "-0.01em" }}>{p.entreprise ?? "—"}</h3>

      {/* Le pied, en deux colonnes séparées par un filet vertical — la forme
          des cartes d'entreprise de la plateforme. D'OÙ vient l'investissement
          d'abord, COMBIEN ensuite : le pays situe, le montant qualifie. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14,
        paddingTop: 13, borderTop: "1px solid var(--bordure)" }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ ...ETIQ, display: "block", marginBottom: 4 }}>{libellePartenaire}</span>
          {/* Le drapeau, comme sur les cartes de signaux : dans une grille de
              trente pays, il se repère avant le nom. Un pays non rattaché n'en
              a pas — la place n'est pas réservée pour autant, sans quoi les
              noms ne s'aligneraient plus. */}
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5,
            fontWeight: 700, color: "var(--encre)", overflow: "hidden" }}>
            <DrapeauPays iso={p.partenaire_iso} nom={p.partenaire ?? ""} taille={14} sansIso="rien" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const }}>{p.partenaire ?? "—"}</span>
          </span>
        </div>
        <div style={{ minWidth: 0, paddingLeft: 14, borderLeft: "1px solid var(--bordure)" }}>
          <span style={{ ...ETIQ, display: "block", marginBottom: 4 }}>Investissement</span>
          <Montant v={p.capex_musd} unite="M$" taille={13.5} />
        </div>
      </div>
    </article>
  );
}

/** L'hôte de la fiche : le seul composant abonné au magasin. L'onglet, ses
    filtres et ses cartes ne bougent pas quand la fiche s'ouvre ou se ferme. */
function HoteFicheProjet({ magasin, sens }: { magasin: MagasinFiche<Projet>; sens: "destination" | "source" }) {
  const p = useFicheOuverte(magasin);
  return p ? <FicheProjet p={p} sens={sens} onClose={magasin.fermer} /> : null;
}

/** La fiche d'un projet annoncé — le dessin commun des fiches (FicheModal).

    En tête, ce qu'est la fiche ; le nom de l'entreprise ; le mois de l'annonce
    et la source. Puis les faits : l'investissement et les emplois annoncés —
    tels quels, déclarés ou estimés par fDi —, le pays d'origine et
    celui de destination. Le détail en liste — secteur, sous-secteur, activité
    prévue —, la description pour finir. Le type du projet (« Nouvelle
    implantation », « Extension »…) n'y figure plus, et la liste ne le filtre
    plus.

    Rien n'est retéléchargé : la liste porte déjà tous ces champs, la fiche
    s'ouvre donc complète.

    LE TRAJET SUIT LE SENS DE LECTURE. La liste nomme « pays » le pays observé
    et « partenaire » l'autre : sous « investit », le pays observé est
    l'ORIGINE. L'ancienne fiche écrivait toujours « partenaire → pays » et
    retournait le trajet des investissements émis. */
export function FicheProjet({ p, onClose, sens = "destination" }: {
  p: Projet; onClose: () => void; sens?: "destination" | "source";
}) {
  const inv = montantFdi(p.capex_musd, "M$");
  const emplois = montantFdi(p.emplois, "postes");
  const [origine, origineIso, destination, destinationIso] = sens === "source"
    ? [p.pays, p.pays_iso, p.partenaire, p.partenaire_iso]
    : [p.partenaire, p.partenaire_iso, p.pays, p.pays_iso];
  return (
    <FicheModal titre={p.entreprise ?? "Projet"} onClose={onClose} maxWidth={680}
      surtitre={<span className="fiche-surtitre-texte">Projet d&apos;investissement annoncé</span>}
      meta={<><span>Annoncé en {moisEnPhrase(p.periode)}</span><span>Source : fDi Markets</span></>}>

      <FicheFaits>
        <FicheFait libelle="Investissement annoncé" vide={!inv}>{inv ?? "Non communiqué"}</FicheFait>
        <FicheFait libelle="Emplois annoncés" vide={!emplois}>{emplois ?? "Non communiqués"}</FicheFait>
        <FicheFait libelle="Pays d'origine" vide={!origine}><PaysFdi nom={origine} iso={origineIso} /></FicheFait>
        <FicheFait libelle="Pays de destination" vide={!destination}><PaysFdi nom={destination} iso={destinationIso} /></FicheFait>
      </FicheFaits>

      <FicheRubrique titre="Détails du projet">
        <dl className="fiche-liste">
          <dt>Secteur</dt><dd>{p.secteur ?? "Non renseigné"}</dd>
          <dt>Sous-secteur</dt><dd>{p.sous_secteur ?? "Non renseigné"}</dd>
          <dt>Activité prévue</dt><dd>{p.activite ?? "Non renseignée"}</dd>
        </dl>
      </FicheRubrique>

      {/* La page publique est en français : seule la description française est
          affichée. L'anglais de la source reste en base et sert la recherche.
          Sans version française, la rubrique ne s'affiche pas. */}
      {p.description_fr && (
        <FicheRubrique titre="Description">
          <p className="fiche-texte" style={{ margin: 0 }}>{p.description_fr}</p>
        </FicheRubrique>
      )}
    </FicheModal>
  );
}
