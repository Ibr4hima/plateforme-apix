// Investissements projetés — les projets annoncés, les signaux d'investisseur
// et les investisseurs relevés par fDi Markets (Financial Times).
//
// CE QUE CE MODULE PORTE. Les types des réponses, la traduction des filtres en
// adresses, les libellés partagés et les requêtes. Les écrans n'écrivent
// aucune URL eux-mêmes : la règle de la plateforme est que la colonne de
// filtres, la liste et le rapport décrivent EXACTEMENT la même sélection, et
// une adresse construite à trois endroits finirait par diverger d'un
// paramètre.
//
// LES RÈGLES DU SITE, REPRISES TELLES QUELLES (app/ide/onglet-fdi.tsx et ses
// deux voisines) :
//   · un projet se lit depuis son pays de DESTINATION — ce qu'un pays reçoit ;
//   · secteur et sous-secteur forment UNE hiérarchie : les secteurs retenus en
//     entier d'un côté, les sous-secteurs précisés de l'autre ;
//   · les signaux se filtrent à choix unique, les projets et les entreprises à
//     choix multiple ;
//   · toute la période vaut « pas de filtre ».
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getJson } from "@/lib/api";
import { fmtMillionsUSD } from "@/lib/format";

// ── Le périmètre de lecture ──────────────────────────────────────────────────

/** Le pays de référence : l'app est lue à l'APIX, et la première question
    qu'on lui pose est celle du Sénégal. */
export const PAYS_REFERENCE = "Sénégal";

/** Le périmètre interrogé chez fDi pour les signaux et les investisseurs —
    « Dest = Africa ». Il qualifie les écrans, il ne se déduit pas des lignes. */
export const PERIMETRE_AFRIQUE = "Afrique";

/** Trente lignes par page, comme les trois vues du site. */
export const PAR_PAGE = 30;

/** Les rapports n'emportent que le haut de leurs classements : sept mille
    investisseurs ou seize mille projets ne se lisent pas sur un téléphone, et
    ne s'y téléchargent pas non plus (1 à 3,7 Mo). Cent lignes, triées par le
    serveur sur la colonne affichée. */
export const LIMITE_CLASSEMENT = 100;

/** Les trois vues de l'écran — les trois bases de fDi Markets. */
export type Vue = "projets" | "signaux" | "entreprises";

// ── Types des réponses ───────────────────────────────────────────────────────

export type Compte = { nom: string; nb: number };
export type CompteSous = Compte & { secteur: string };
export type ComptePays = Compte & { continent: string | null; region_geo: string | null };
export type ChoixSous = { secteur: string; nom: string };

export type PerimetreProjets = {
  sens: string;
  annees: [number | null, number | null];
  total_projets: number;
  perimetres_complets: string[];
  sens_disponibles: string[];
  pays: ComptePays[];
  secteurs: Compte[];
  sous_secteurs: CompteSous[];
  activites: Compte[];
  types: Compte[];
};

export type ProjetFdi = {
  id: number; periode: string; annee: number;
  entreprise: string | null; entreprise_a_arbitrer: boolean;
  pays: string | null; pays_iso: string | null;
  partenaire: string | null; partenaire_iso: string | null;
  secteur: string | null; sous_secteur: string | null;
  activite: string | null; type_projet: string | null;
  capex_musd: number | null; capex_estime: boolean | null;
  emplois: number | null; emplois_estime: boolean | null;
  description_fr: string | null; description_en: string | null;
};

export type RangProjets = {
  nom: string; nb: number; capex_musd: number | null; emplois: number | null; iso?: string | null;
};

export type Investissement = {
  id: number; periode: string; entreprise: string | null;
  partenaire: string | null; partenaire_iso: string | null; secteur: string | null;
  capex_musd: number | null; capex_estime: boolean | null;
  emplois: number | null; emplois_estime: boolean | null;
};

export type LigneZone = {
  nom: string; iso: string | null; projets: number; capex_musd: number | null; emplois: number | null;
};
export type ZoneOuest = { code: string; nom: string; court: string; lignes: LigneZone[] };

export type KpisProjets = {
  projets: number; capex_musd: number | null; emplois: number | null;
  capex_moyen: number | null; entreprises: number; partenaires: number;
  part_estimee: number | null; annees: [number | null, number | null];
};

export type ReponseProjets = {
  sens: string; page: number; pages: number;
  kpis: KpisProjets;
  par_annee: { annee: number; nb: number; capex_musd: number | null; emplois: number | null }[];
  tops: Record<"partenaires" | "secteurs" | "activites" | "entreprises" | "types", RangProjets[]>;
  projets: ProjetFdi[];
  investissements: Investissement[];
  zones_ouest: ZoneOuest[];
};

/** Une valeur rattachée à un signal : destination, secteur, activité ou stade. */
export type ValeurSignal = {
  id: number; libelle: string | null;
  /** L'étiquette courte des stades — celle qui nomme la définition dans la fiche. */
  court?: string | null;
  /** La définition publiée par fDi, pour les stades seulement. */
  definition?: string | null;
  nature?: "pays" | "region" | null;
};

export type Signal = {
  id: number; periode: string;
  entreprise: string | null; parent: string | null;
  origine: string | null; origine_iso: string | null;
  capex_musd: number | null; capex_estime: boolean | null;
  funding_musd: number | null; funding_estime: boolean | null;
  description_fr: string | null; description_en: string | null;
  destinations: ValeurSignal[]; secteurs: ValeurSignal[];
  activites: ValeurSignal[]; natures: ValeurSignal[];
};

export type RangSignaux = { nom: string; nb: number; rang?: number; iso?: string | null };

export type SignalRemarquable = {
  id: number; periode: string; entreprise: string | null; origine: string | null;
  montant: number | null; estime: boolean | null;
  nature: string | null; destination: string | null;
};

export type ZoneSignaux = {
  code: string; nom: string; court: string;
  secteurs: RangSignaux[]; destinations: RangSignaux[];
};

export type ReponseSignaux = {
  kpis: {
    signaux: number; funding_musd: number | null; capex_musd: number | null;
    entreprises: number; origines: number;
    annees: [number | null, number | null];
    a_completer: number; plancher: boolean;
  };
  par_annee: { annee: number; nb: number; funding_musd: number | null; capex_musd: number | null }[];
  tops: Record<"origines" | "secteurs" | "natures" | "destinations" | "activites", RangSignaux[]>;
  zones: ZoneSignaux[];
  remarquables: { funding: SignalRemarquable[]; capex: SignalRemarquable[] };
  page: number; pages: number;
  signaux: Signal[];
};

export type PerimetreSignaux = {
  annees: [number | null, number | null];
  total_signaux: number;
  origines: Compte[];
  destinations: (Compte & { nature: "pays" | "region" })[];
  secteurs: Compte[];
  activites: Compte[];
};

export type Investisseur = {
  nom: string; origine: string | null; origine_iso: string | null;
  projets: number; pays: number;
  /** Première et dernière année d'annonce dans le périmètre lu. Absentes
      d'une API plus ancienne, ou d'une page restée dans le cache hors ligne. */
  annees?: [number | null, number | null];
};

export type ReponseEntreprises = {
  entreprises: Investisseur[]; page: number; pages: number; total: number;
};

export type PerimetreEntreprises = {
  secteurs: Compte[]; sous_secteurs: CompteSous[]; activites: Compte[];
  origines: Compte[]; destinations: Compte[];
};

export type FicheInvestisseur = {
  nom: string; origine: string | null; origine_iso: string | null;
  projets: number; pays: number; annees: [number | null, number | null];
  filiales: Compte[]; destinations: Compte[]; secteurs: Compte[];
  sous_secteurs: Compte[]; activites: Compte[];
};

export type InvestisseurClasse = {
  nom: string; origine: string | null; iso: string | null;
  projets: number; capex: number | null; pays: number;
  a0: number | null; a1: number | null; au_senegal?: boolean;
};

export type RapportEntreprises = {
  kpis: {
    investisseurs: number; projets: number; origines: number;
    projets_par_investisseur: number | null;
    annees: [number | null, number | null];
    au_senegal: number; un_seul_projet: number; un_seul_pays: number;
  };
  actifs: InvestisseurClasse[];
  senegal: { nom: string; origine: string | null; iso: string | null; projets: number; capex: number | null }[];
  origines: { nom: string; iso: string | null; investisseurs: number; projets: number; capex: number | null; au_senegal: number }[];
  secteurs: { nom: string; projets: number; investisseurs: number; capex: number | null }[];
  sous_secteurs: { nom: string; parent: string; projets: number; investisseurs: number; capex: number | null }[];
  activites: { nom: string; projets: number; investisseurs: number; capex: number | null }[];
};

// ── Les filtres de chaque vue ────────────────────────────────────────────────

/** Les projets. Le pays OU la région lus ne sont pas des filtres mais le
    SUJET de l'écran : il y en a toujours un, et « réinitialiser » ne doit pas
    laisser l'écran sans destination. */
export type FiltresProjets = {
  sens: "destination" | "source";
  echelle: "pays" | "regions";
  pays: string;
  region: string | null;
  anneeMin: number | null; anneeMax: number | null;
  secteurs: string[]; sousSecteurs: ChoixSous[];
  activites: string[]; types: string[];
  recherche: string;
};

export const filtresProjetsInitiaux = (pays: string = PAYS_REFERENCE): FiltresProjets => ({
  sens: "destination", echelle: "pays", pays, region: null,
  anneeMin: null, anneeMax: null,
  secteurs: [], sousSecteurs: [], activites: [], types: [], recherche: "",
});

/** Les signaux : choix unique partout, comme sur le site. */
export type FiltresSignaux = {
  origine: string; destination: string; secteur: string; activite: string;
  anneeMin: number | null; anneeMax: number | null;
  recherche: string;
};

export const FILTRES_SIGNAUX_VIDES: FiltresSignaux = {
  origine: "", destination: "", secteur: "", activite: "",
  anneeMin: null, anneeMax: null, recherche: "",
};

/** Les investisseurs : choix multiple, secteurs emboîtés. */
export type FiltresEntreprises = {
  origines: string[]; destinations: string[];
  secteurs: string[]; sousSecteurs: ChoixSous[];
  activites: string[]; recherche: string;
};

export const FILTRES_ENTREPRISES_VIDES: FiltresEntreprises = {
  origines: [], destinations: [], secteurs: [], sousSecteurs: [], activites: [], recherche: "",
};

/** Ce que la hiérarchie sectorielle transmet : les secteurs retenus EN ENTIER
    d'un côté, les sous-secteurs précisés de l'autre. Un secteur où l'on est
    descendu sort de la première liste — sinon le OU de la requête le
    ramènerait tout entier, et la précision serait sans effet. */
function poserSecteurs(p: URLSearchParams, secteurs: string[], sous: ChoixSous[]) {
  const precises = new Set(sous.map(s => s.secteur));
  const entiers = secteurs.filter(s => !precises.has(s));
  if (entiers.length) p.set("secteurs", entiers.join("|"));
  if (sous.length) p.set("sous_secteurs", sous.map(s => s.nom).join("|"));
}

/** La cible des projets : un pays OU une région, jamais les deux. */
export function poserCible(p: URLSearchParams, f: FiltresProjets) {
  if (f.echelle === "regions") { if (f.region) p.set("region", f.region); }
  else if (f.pays) p.set("pays", f.pays);
}

/** Les paramètres des projets SANS la cible ni la page : ce que le périmètre
    reçoit pour compter les facettes, et ce que la liste ajoute à la cible. */
function paramsFacettesProjets(f: FiltresProjets): URLSearchParams {
  const p = new URLSearchParams({ sens: f.sens });
  if (f.anneeMin != null) p.set("annee_min", String(f.anneeMin));
  if (f.anneeMax != null) p.set("annee_max", String(f.anneeMax));
  poserSecteurs(p, f.secteurs, f.sousSecteurs);
  if (f.activites.length) p.set("activites", f.activites.join("|"));
  if (f.types.length) p.set("types", f.types.join("|"));
  return p;
}

export function paramsProjets(f: FiltresProjets, avecRecherche = true): URLSearchParams {
  const p = paramsFacettesProjets(f);
  poserCible(p, f);
  if (avecRecherche && f.recherche.trim()) p.set("recherche", f.recherche.trim());
  return p;
}

export function paramsSignaux(f: FiltresSignaux): URLSearchParams {
  const p = new URLSearchParams();
  if (f.anneeMin != null) p.set("annee_min", String(f.anneeMin));
  if (f.anneeMax != null) p.set("annee_max", String(f.anneeMax));
  if (f.origine) p.set("origine", f.origine);
  if (f.destination) p.set("destination", f.destination);
  if (f.secteur) p.set("secteurs", f.secteur);
  if (f.activite) p.set("activites", f.activite);
  if (f.recherche.trim()) p.set("recherche", f.recherche.trim());
  return p;
}

export function paramsEntreprises(f: FiltresEntreprises): URLSearchParams {
  const p = new URLSearchParams();
  poserSecteurs(p, f.secteurs, f.sousSecteurs);
  if (f.activites.length) p.set("activites", f.activites.join("|"));
  if (f.origines.length) p.set("origines", f.origines.join("|"));
  if (f.destinations.length) p.set("destinations", f.destinations.join("|"));
  if (f.recherche.trim()) p.set("recherche", f.recherche.trim());
  return p;
}

// ── Le nombre de filtres actifs, vue par vue ─────────────────────────────────
// LA PÉRIODE COMPTE POUR UN, non pour deux : ses deux bornes sont un seul
// geste. La recherche n'est PAS comptée : elle a son propre champ, dans le
// bandeau, et l'afficher aussi sur le bouton des filtres ferait chercher un
// filtre que la feuille ne montre pas.

export function nbFiltresProjets(f: FiltresProjets, bornes: [number | null, number | null]): number {
  const periode = (f.anneeMin != null && f.anneeMin !== bornes[0])
    || (f.anneeMax != null && f.anneeMax !== bornes[1]);
  return f.secteurs.length + f.sousSecteurs.length + f.activites.length + f.types.length
    + (periode ? 1 : 0);
}

export function nbFiltresSignaux(f: FiltresSignaux): number {
  return [f.origine, f.destination, f.secteur, f.activite].filter(Boolean).length
    + (f.anneeMin != null || f.anneeMax != null ? 1 : 0);
}

export function nbFiltresEntreprises(f: FiltresEntreprises): number {
  return f.origines.length + f.destinations.length + f.secteurs.length
    + f.sousSecteurs.length + f.activites.length;
}

// ── Écritures partagées ──────────────────────────────────────────────────────

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
  "août", "septembre", "octobre", "novembre", "décembre"];

/** « 2026-08 » → « Août 2026 ». fDi ne date ses lignes qu'au mois. */
export function moisEnClair(periode: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periode || "");
  if (!m) return periode;
  const nom = MOIS[Number(m[2]) - 1];
  return nom ? `${nom[0].toUpperCase()}${nom.slice(1)} ${m[1]}` : periode;
}

/** « 2003 — 2026 », ou l'année seule quand la période n'en compte qu'une. */
export function periodeEnClair(a: [number | null, number | null] | undefined | null): string | null {
  if (!a || a[0] == null) return null;
  return a[0] === a[1] || a[1] == null ? `${a[0]}` : `${a[0]} — ${a[1]}`;
}

/** Un montant en millions de dollars, l'écriture des rapports du site
    (« 1,4 Md $ », « 612 M $ ») ; un tiret quand la source ne le dit pas. */
export const fmtMontant = (v: number | null | undefined): string =>
  v == null || !isFinite(v) ? "—" : fmtMillionsUSD(v);

/** Le montant d'une carte : le nombre de millions tel quel, comme sur les
    cartes du site (« 1 410 »), l'unité étant posée à côté. */
export const fmtMillions = (v: number): string =>
  v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export const fmtEntier = (v: number | null | undefined): string =>
  v == null || !isFinite(v) ? "—" : Math.round(v).toLocaleString("fr-FR");

/** Une part, écrite comme on la lit à voix haute. */
export const fmtPart = (n: number, total: number): string =>
  total > 0 ? `${(n / total * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—";

/** Le pluriel d'un mot compté — « pays » est invariable, la Présidence lit. */
export const accorder = (n: number, mot: string): string =>
  `${mot}${n > 1 && !/[sx]$/.test(mot) ? "s" : ""}`;

/** Sans accent ni casse : la recherche dans les listes de choix. */
export const plier = (x: string) =>
  (x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ── Requêtes ─────────────────────────────────────────────────────────────────
// LES LISTES NE GARDENT EN CACHE QUE CE QU'ELLES AFFICHENT. Chaque page de la
// liste des projets ou des signaux rapporte aussi les compteurs, les séries et
// les classements du filtre ; ils sont utiles une fois, pas trente. Les pages
// suivantes n'en gardent que leurs lignes : le cache persisté sur l'appareil
// ne gonfle pas de 25 Ko à chaque page tournée.
//
// LES RAPPORTS NE SONT PAS PERSISTÉS (meta.persister = false). Ils pèsent
// jusqu'à 80 Ko et se demandent à la volée ; les écrire sur l'appareil ferait
// enfler le cache de l'app entière pour des pages qu'on ouvre rarement.

const MINUTE = 60 * 1000;
export const SANS_PERSISTANCE = { persister: false } as const;

export function usePerimetreProjets(f: FiltresProjets) {
  // Le périmètre est compté SOUS LA CIBLE et sous les facettes, comme sur le
  // site — mais pas sous la recherche : il remplit la feuille de filtres.
  const p = paramsProjets(f, false);
  return useQuery({
    queryKey: ["fdi", "perimetre", p.toString()],
    queryFn: () => getJson<PerimetreProjets>(`/fdi/public/perimetre?${p}`),
    staleTime: 10 * MINUTE, placeholderData: prev => prev,
  });
}

export function useProjetsInfinis(f: FiltresProjets, actif = true) {
  const p = paramsProjets(f);
  return useInfiniteQuery({
    queryKey: ["fdi", "projets", p.toString()],
    queryFn: async ({ pageParam }) => {
      const r = await getJson<ReponseProjets>(`/fdi/public/projets?${p}&page=${pageParam}&par_page=${PAR_PAGE}`);
      return pageParam === 1 ? r : { ...r, tops: {} as ReponseProjets["tops"], par_annee: [], zones_ouest: [] };
    },
    initialPageParam: 1,
    getNextPageParam: last => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: actif, staleTime: 10 * MINUTE, placeholderData: keepPreviousData,
  });
}

// Les périmètres des signaux et des investisseurs se comptent SOUS la
// recherche, ceux des projets non : c'est la règle des trois vues du site.
export function usePerimetreSignaux(f: FiltresSignaux) {
  const p = paramsSignaux(f);
  return useQuery({
    queryKey: ["fdi", "signaux-perimetre", p.toString()],
    queryFn: () => getJson<PerimetreSignaux>(`/fdi/public/signaux/perimetre?${p}`),
    staleTime: 10 * MINUTE, placeholderData: prev => prev,
  });
}

export function useSignauxInfinis(f: FiltresSignaux, actif = true) {
  const p = paramsSignaux(f);
  return useInfiniteQuery({
    queryKey: ["fdi", "signaux", p.toString()],
    queryFn: async ({ pageParam }) => {
      const r = await getJson<ReponseSignaux>(`/fdi/public/signaux?${p}&page=${pageParam}&par_page=${PAR_PAGE}`);
      return pageParam === 1 ? r : { ...r, tops: {} as ReponseSignaux["tops"], par_annee: [], zones: [] };
    },
    initialPageParam: 1,
    getNextPageParam: last => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: actif, staleTime: 10 * MINUTE, placeholderData: keepPreviousData,
  });
}

export function usePerimetreEntreprises(f: FiltresEntreprises) {
  const p = paramsEntreprises(f);
  return useQuery({
    queryKey: ["fdi", "entreprises-perimetre", p.toString()],
    queryFn: () => getJson<PerimetreEntreprises>(`/fdi/public/entreprises/perimetre?${p}`),
    staleTime: 10 * MINUTE, placeholderData: prev => prev,
  });
}

export function useEntreprisesInfinies(f: FiltresEntreprises, actif = true) {
  const p = paramsEntreprises(f);
  return useInfiniteQuery({
    queryKey: ["fdi", "entreprises", p.toString()],
    queryFn: ({ pageParam }) =>
      getJson<ReponseEntreprises>(`/fdi/public/entreprises?${p}&page=${pageParam}&par_page=${PAR_PAGE}`),
    initialPageParam: 1,
    getNextPageParam: last => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: actif, staleTime: 10 * MINUTE, placeholderData: keepPreviousData,
  });
}

/** La fiche d'un investisseur : elle se DEMANDE, la carte n'en porte que deux
    nombres. Elle n'est pas filtrée — elle dit l'investisseur entier. */
export function useFicheInvestisseur(nom: string, origine: string | null) {
  const p = new URLSearchParams({ nom });
  if (origine) p.set("origine", origine);
  return useQuery({
    queryKey: ["fdi", "fiche-investisseur", p.toString()],
    queryFn: () => getJson<FicheInvestisseur>(`/fdi/public/entreprises/fiche?${p}`),
    staleTime: 30 * MINUTE,
  });
}

// ── Rapports ─────────────────────────────────────────────────────────────────

export type TriInvestissements = "capex" | "emplois" | "periode";
export type TriInvestisseurs = "capex" | "projets" | "pays";

/** Le rapport des projets : sur la CIBLE seule, comme celui du site — le pays
    ou la région lus —, sans les facettes de la liste. Le classement des
    investissements n'en rend que le haut, trié par le serveur. */
export function useRapportProjets(f: Pick<FiltresProjets, "echelle" | "pays" | "region" | "sens">,
                                  tri: TriInvestissements) {
  const p = new URLSearchParams({ sens: f.sens });
  poserCible(p, f as FiltresProjets);
  p.set("rapport", "1");
  p.set("par_page", "1");
  p.set("classement_limite", String(LIMITE_CLASSEMENT));
  p.set("classement_tri", tri);
  return useQuery({
    queryKey: ["fdi", "rapport-projets", p.toString()],
    queryFn: () => getJson<ReponseProjets>(`/fdi/public/projets?${p}`),
    staleTime: 10 * MINUTE, gcTime: 30 * MINUTE, meta: SANS_PERSISTANCE,
    placeholderData: prev => prev,
  });
}

/** Le rapport des signaux : il porte les filtres de la vue, comme sur le site
    — un document tiré d'une sélection doit porter cette sélection. */
export function useRapportSignaux(f: FiltresSignaux) {
  const p = paramsSignaux(f);
  p.set("par_page", "1");
  p.set("rapport", "1");
  return useQuery({
    queryKey: ["fdi", "rapport-signaux", p.toString()],
    queryFn: () => getJson<ReponseSignaux>(`/fdi/public/signaux?${p}`),
    staleTime: 10 * MINUTE, gcTime: 30 * MINUTE, meta: SANS_PERSISTANCE,
  });
}

export function useRapportEntreprises(f: FiltresEntreprises, tri: TriInvestisseurs) {
  const p = paramsEntreprises(f);
  p.set("classement_limite", String(LIMITE_CLASSEMENT));
  p.set("classement_tri", tri);
  return useQuery({
    queryKey: ["fdi", "rapport-entreprises", p.toString()],
    queryFn: () => getJson<RapportEntreprises>(`/fdi/public/entreprises/rapport?${p}`),
    staleTime: 10 * MINUTE, gcTime: 30 * MINUTE, meta: SANS_PERSISTANCE,
    placeholderData: prev => prev,
  });
}

// ── Le tableau de bord de l'onglet Investissements ───────────────────────────
// QUATRE REQUÊTES LÉGÈRES, une par question, plutôt qu'un rapport entier :
// ce que le pays reçoit (11 Ko), les signaux qui le visent (3 Ko), ceux de
// toute l'Afrique pour situer son rang (40 Ko), et les investisseurs qui y ont
// annoncé un projet (moins d'1 Ko). Le préchargement les met en cache au
// lancement : l'onglet s'ouvre aussi hors ligne.

export const cleTableauProjets = (pays: string) => ["fdi", "tdb", "projets", pays] as const;
export const cleTableauSignaux = (pays: string) => ["fdi", "tdb", "signaux", pays] as const;
export const CLE_SIGNAUX_AFRIQUE = ["fdi", "tdb", "signaux-afrique"] as const;
export const cleTableauInvestisseurs = (pays: string) => ["fdi", "tdb", "investisseurs", pays] as const;
export const CLE_INVESTISSEURS_AFRIQUE = ["fdi", "tdb", "investisseurs-afrique"] as const;

const enc = encodeURIComponent;

export const chargerTableauProjets = (pays: string) =>
  getJson<ReponseProjets>(`/fdi/public/projets?pays=${enc(pays)}&par_page=1`);
export const chargerTableauSignaux = (pays: string) =>
  getJson<ReponseSignaux>(`/fdi/public/signaux?destination=${enc(pays)}&par_page=1`);
export const chargerSignauxAfrique = () =>
  getJson<ReponseSignaux>(`/fdi/public/signaux?par_page=1`);
export const chargerTableauInvestisseurs = (pays: string) =>
  getJson<ReponseEntreprises>(`/fdi/public/entreprises?destinations=${enc(pays)}&par_page=5`);
export const chargerInvestisseursAfrique = () =>
  getJson<ReponseEntreprises>(`/fdi/public/entreprises?par_page=1`);

/** Les pays proposés comme destination : ceux dont le relevé est complet. */
export const CLE_DESTINATIONS = ["fdi", "destinations"] as const;
export const chargerDestinations = () =>
  getJson<PerimetreProjets>(`/fdi/public/perimetre?sens=destination`);
