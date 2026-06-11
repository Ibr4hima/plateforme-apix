// ─── Catalogue des visualisations disponibles ─────────────────────────────────
// Chaque entrée décrit une visualisation. Le système détecte automatiquement
// le type de graphe selon la structure des données retournées.

export type ParamType = "select_api" | "select_static";

export interface Param {
  key: string;
  label: string;
  type: ParamType;
  endpoint?: string;           // API endpoint pour charger les options
  labelField?: string;         // champ à afficher dans le select
  valueField?: string;         // champ à utiliser comme valeur
  dependsOn?: string;          // clé du param parent (cascade)
  options?: {label:string; value:string}[]; // pour select_static
}

export interface Visualisation {
  id: string;
  titre: string;
  description?: string;
  categorie: "entreprises" | "zones" | "croisements" | "accords" | "evenements" | "intentions" | "prospects";
  endpoint: string;            // endpoint de base
  params?: Param[];            // paramètres configurables
  defaultSize: "sm" | "md" | "lg";
}

export const CATALOGUE: Visualisation[] = [

  // ── ENTREPRISES ────────────────────────────────────────────────────────────
  {
    id: "ent_par_secteur",
    titre: "Entreprises par secteur",
    description: "Répartition selon le secteur NAEMA principal",
    categorie: "entreprises",
    endpoint: "/dashboard/viz/entreprises-par-secteur",
    defaultSize: "md",
  },
  {
    id: "ent_par_branche",
    titre: "Entreprises par branche",
    description: "Répartition selon la branche NAEMA",
    categorie: "entreprises",
    endpoint: "/dashboard/viz/entreprises-par-branche",
    defaultSize: "md",
  },
  {
    id: "ent_par_activite",
    titre: "Entreprises par activité",
    description: "Top activités NAEMA les plus représentées",
    categorie: "entreprises",
    endpoint: "/dashboard/viz/entreprises-par-activite",
    defaultSize: "lg",
  },
  {
    id: "ent_par_region",
    titre: "Entreprises par région",
    description: "Distribution géographique par région",
    categorie: "entreprises",
    endpoint: "/dashboard/viz/entreprises-par-region",
    defaultSize: "md",
  },
  {
    id: "ent_par_departement",
    titre: "Entreprises par département",
    description: "Top départements d'implantation",
    categorie: "entreprises",
    endpoint: "/dashboard/viz/entreprises-par-departement",
    defaultSize: "md",
  },
  {
    id: "ent_par_annee",
    titre: "Créations d'entreprises par année",
    description: "Évolution du registre depuis 1990",
    categorie: "entreprises",
    endpoint: "/dashboard/viz/entreprises-par-annee",
    defaultSize: "md",
  },
  {
    id: "ent_par_pays",
    titre: "Entreprises par pays d'origine",
    description: "Nationalité du siège social",
    categorie: "entreprises",
    endpoint: "/dashboard/viz/entreprises-par-pays",
    defaultSize: "md",
  },
  {
    id: "ent_dans_zone",
    titre: "Entreprises dans une zone d'investissement",
    description: "Nombre d'entreprises dans une zone spécifique",
    categorie: "entreprises",
    endpoint: "/dashboard/viz/entreprises-dans-zone",
    defaultSize: "sm",
    params: [
      {
        key: "type_zone",
        label: "Type de zone",
        type: "select_api",
        endpoint: "/dashboard/params/types-zones",
        labelField: "type_zone",
        valueField: "type_zone",
      },
      {
        key: "zone_id",
        label: "Zone spécifique",
        type: "select_api",
        endpoint: "/dashboard/params/zones-par-type",
        labelField: "nom_zone",
        valueField: "id",
        dependsOn: "type_zone",
      },
    ],
  },
  {
    id: "ent_dans_secteur",
    titre: "Entreprises dans un secteur",
    description: "Détail des entreprises d'un secteur donné",
    categorie: "entreprises",
    endpoint: "/dashboard/viz/entreprises-dans-secteur",
    defaultSize: "md",
    params: [
      {
        key: "secteur_id",
        label: "Secteur",
        type: "select_api",
        endpoint: "/dashboard/params/secteurs",
        labelField: "nom",
        valueField: "id",
      },
    ],
  },

  // ── CROISEMENTS ────────────────────────────────────────────────────────────
  {
    id: "crois_ent_par_zone",
    titre: "Entreprises par zone",
    description: "Nombre d'entreprises dans chaque zone",
    categorie: "croisements",
    endpoint: "/dashboard/viz/crois-entreprises-par-zone",
    defaultSize: "md",
  },
  {
    id: "crois_region",
    titre: "Vue régionale consolidée",
    description: "Entreprises + zones + pôles par région",
    categorie: "croisements",
    endpoint: "/dashboard/viz/crois-region",
    defaultSize: "lg",
  },
  {
    id: "crois_secteur_zone",
    titre: "Secteurs dans les zones",
    description: "Présence sectorielle par type de zone",
    categorie: "croisements",
    endpoint: "/dashboard/viz/crois-secteur-zone",
    defaultSize: "lg",
  },
];

export const KPIS_DISPONIBLES = [
  { id: "entreprises_total",  label: "Total entreprises",       icon: "Building2",  color: "#ca631f" },
  { id: "zones_total",        label: "Zones d'investissement",  icon: "MapPin",     color: "#004f91" },
  { id: "poles_total",        label: "Pôles territoriaux",      icon: "MapPin",     color: "#0891b2" },
  { id: "accords_total",      label: "Accords & Traités",       icon: "Handshake",  color: "#059669" },
  { id: "accords_vigueur",    label: "Accords en vigueur",      icon: "Handshake",  color: "#15803d" },
  { id: "evenements_total",   label: "Événements répertoriés",  icon: "Calendar",   color: "#7c3aed" },
  { id: "evenements_a_venir", label: "Événements à venir",      icon: "Calendar",   color: "#d97706" },
  { id: "prospects_total",    label: "Prospects suivis",        icon: "TrendingUp", color: "#E35336" },
  { id: "projets_total",      label: "Projets",                 icon: "Layers",     color: "#6366f1" },
  { id: "intentions_total",   label: "Intentions d'investissement", icon: "Target", color: "#0891b2" },
  { id: "intentions_usd",     label: "Montant intentions (USD)", icon: "DollarSign", color: "#ca631f" },
  { id: "zone_ent_total",     label: "Entreprises en zone",     icon: "Building2",  color: "#188038" },
];

export const CATEGORIES = [
  { key: "entreprises",  label: "Entreprises",  color: "#ca631f" },
  { key: "zones",        label: "Zones & Pôles", color: "#004f91" },
  { key: "croisements",  label: "Croisements",  color: "#7c3aed" },
  { key: "accords",      label: "Accords",      color: "#059669" },
  { key: "evenements",   label: "Événements",   color: "#d97706" },
  { key: "intentions",   label: "Intentions",   color: "#0891b2" },
  { key: "prospects",    label: "Prospects",    color: "#E35336" },
];

// ─── Tableaux analytiques ─────────────────────────────────────────────────────
export interface TableAnalytique {
  id: string;
  titre: string;
  description: string;
}

export const TABLES_ANALYTIQUES: TableAnalytique[] = [
  { id:"entreprises-par-region",    titre:"Entreprises par région",                   description:"Répartition avec % du total et classement" },
  { id:"top-departements",          titre:"Top départements",                          description:"Concentration d'entreprises, % et rang" },
  { id:"hierarchie-sectorielle",    titre:"Hiérarchie secteur → branche → activité",  description:"Vue complète de la classification NAEMA" },
  { id:"entreprises-par-pays",      titre:"Entreprises par pays d'origine",            description:"Nationalité du siège avec classement continental" },
  { id:"evolution-creations",       titre:"Évolution des créations par année",         description:"Créations, cumul, variation et évolution %" },
  { id:"entreprises-multi-secteurs",titre:"Entreprises multi-secteurs",                description:"Entreprises déclarées dans plusieurs secteurs" },
  { id:"zones-detail",              titre:"Détail des zones d'investissement",          description:"Type, région, superficie, installées, éligibles" },
  { id:"taux-occupation-zones",     titre:"Taux d'occupation des zones",               description:"Installées vs éligibles, taux et statut" },
  { id:"poles-detail",              titre:"Détail des pôles territoriaux",             description:"Pôles avec zones associées et entreprises" },
  { id:"zones-vides",               titre:"Zones sans entreprises",                    description:"Zones d'investissement non occupées" },
  { id:"vue-region",                titre:"Vue régionale consolidée",                  description:"Entreprises + zones + pôles par région" },
  { id:"secteurs-par-region",       titre:"Secteurs dominants par région",             description:"Top 3 secteurs dans chaque région" },
  { id:"local-vs-etranger",         titre:"Entreprises locales vs étrangères",         description:"Siège Sénégal vs étranger par région" },
  { id:"score-attractivite",        titre:"Score d'attractivité par région",           description:"Score composite : entreprises, zones, pôles" },
  { id:"concentration-sectorielle", titre:"Concentration sectorielle (HHI)",           description:"Indice de diversification par région" },
  { id:"avant-apres-pivot",         titre:"Entreprises par période de création",       description:"Avant 2010 / 2010–2019 / depuis 2020 par région" },
  { id:"densite-zones",             titre:"Densité des zones d'investissement",        description:"Entreprises par hectare dans chaque zone" },
  { id:"poles-sans-zones",          titre:"Pôles sans zones associées",               description:"Pôles territoriaux non encore structurés" },

  { id:"entreprises-par-arrondissement",     titre:"Entreprises par arrondissement",           description:"Top 20 arrondissements avec % et rang" },
  { id:"anciennete-entreprises",             titre:"Ancienneté des entreprises par région",    description:"Âge moyen, min, max et tranches par région" },
  { id:"projets-detail",                     titre:"Détail des projets",                        description:"Projets avec région, secteur, investissement et statut" },
  { id:"pays-par-region",                    titre:"Pays dominant par région",                 description:"Top 3 pays investisseurs dans chaque région" },
  { id:"diversite-investisseurs-zones",      titre:"Diversité des investisseurs par zone",     description:"Pays, continents et secteurs dans chaque zone" },
  { id:"matrice-region-zone",                titre:"Matrice région × type de zone",            description:"ZES, ZAI, ZFI, superficie et entreprises par région" },
  { id:"entreprises-par-continent",          titre:"Entreprises par continent d'origine",      description:"Répartition continentale des investisseurs" },
  { id:"secteur-x-pays-origine",             titre:"Secteur × pays d'origine",                description:"Corrélation secteur et nationalité de l'investisseur" },

  { id:"entreprises-par-zone-detail",          titre:"Entreprises dans chaque zone (détail)",         description:"Liste complète : zone, statut, entreprise, secteur, pays" },
  { id:"classement-zones-entreprises",          titre:"Classement des zones par entreprises",          description:"Rang général et rang par type de zone" },
  { id:"classement-regions-complet",            titre:"Classement complet des régions",               description:"Entreprises, zones, pôles, depts, arrondissements et rangs" },
  { id:"classement-departements-complet",       titre:"Classement complet des départements",          description:"Rang national, régional et % dans la région" },
  { id:"classement-arrondissements-complet",    titre:"Classement complet des arrondissements",       description:"Rang national, dép. et région" },
  { id:"secteurs-investissement-classement",    titre:"Secteurs où on investit le plus",              description:"Classement des secteurs par nombre d'entreprises" },
  { id:"branches-classement",                   titre:"Branches les plus actives",                    description:"Rang national et rang dans le secteur" },
  { id:"activites-classement-national",         titre:"Activités les plus représentées",              description:"Rang national et rang dans le secteur" },
  { id:"activites-par-region",                  titre:"Top 5 activités par région",                   description:"Les 5 activités dominantes dans chaque région" },
  { id:"activites-par-departement",             titre:"Top 5 activités par département",              description:"Les 5 activités dominantes dans chaque département" },
  { id:"activites-par-arrondissement",          titre:"Top 5 activités par arrondissement",           description:"Les 5 activités dominantes par arrondissement" },
  { id:"activites-par-pole",                    titre:"Top 5 activités par pôle territorial",         description:"Les 5 activités que les entreprises développent dans chaque pôle" },
  { id:"entreprises-etrangeres-localisation",   titre:"Localisation des entreprises étrangères",      description:"Région, département, arrondissement des entreprises étrangères" },
  { id:"activites-entreprises-etrangeres",      titre:"Activités des entreprises étrangères",         description:"Ce que les entreprises étrangères développent le plus" },
  { id:"secteurs-etrangers-par-continent",      titre:"Secteurs des étrangers par continent",         description:"Spécialisation sectorielle selon le continent d'origine" },
  { id:"tendances-recentes",                    titre:"Nouvelles tendances (5 dernières années)",     description:"Activités en développement chez les entreprises récentes" },
  { id:"evolution-par-secteur",                 titre:"Évolution annuelle par secteur",               description:"Nouvelles entreprises par secteur depuis 2010" },
  { id:"activites-emergentes",                  titre:"Activités émergentes",                         description:"Croissance comparée sur 3 ans vs 3 ans précédents" },
  { id:"etrangeres-par-pays-region",            titre:"Entreprises étrangères : pays × région",       description:"Région d'implantation préférée par pays d'origine" },
  { id:"activites-par-zone",                    titre:"Activités par zone d'investissement",          description:"Détail secteur → branche → activité dans chaque zone" },
  { id:"creations-par-decennie",                titre:"Créations d'entreprises par décennie",         description:"Répartition par période (avant 1990, 90s, 2000s, 2010s, 2020+)" },
  { id:"densite-economique-departements",       titre:"Densité économique par département",           description:"Secteurs, branches, activités et investisseurs étrangers par dept" },
  { id:"vue-pole-zone-activite",                titre:"Vue pôle → zone → activité",                  description:"Vue consolidée pôle, zone, secteurs et investisseurs étrangers" },
  { id:"branches-par-region",                   titre:"Top 5 branches par région",                   description:"Les 5 branches dominantes dans chaque région" },
  { id:"etrangeres-recentes-par-pays",          titre:"Dynamisme récent des investisseurs étrangers", description:"Nouvelles entreprises étrangères ces 2 et 5 dernières années" },
  { id:"diversification-zones",                 titre:"Indice de diversification des zones",          description:"HHI : zones spécialisées vs zones diversifiées" },
];
