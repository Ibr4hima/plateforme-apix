export interface Visualisation {
  id: string;
  titre: string;
  endpoint: string;
  defaultSize: "sm" | "md" | "lg";
}

export const CATALOGUE: Visualisation[] = [
  { id: "entreprises-par-secteur", titre: "Entreprises par secteur",  endpoint: "/dashboard/viz/entreprises-par-secteur",  defaultSize: "md" },
  { id: "entreprises-par-region",  titre: "Entreprises par région",      endpoint: "/dashboard/viz/entreprises-par-region",      defaultSize: "md" },
  { id: "entreprises-par-dept",    titre: "Entreprises par département",  endpoint: "/dashboard/viz/entreprises-dept-par-region", defaultSize: "lg" },
  { id: "creations-par-annee",     titre: "Créations par année",          endpoint: "/dashboard/viz/entreprises-par-annee",       defaultSize: "md" },
];

export const KPIS_DISPONIBLES = [
  { id: "entreprises_total",  label: "Total entreprises",           icon: "Building2",  color: "#ca631f" },
  { id: "zones_total",        label: "Zones d'investissement",      icon: "MapPin",     color: "#004f91" },
  { id: "poles_total",        label: "Pôles territoriaux",          icon: "MapPin",     color: "#0891b2" },
  { id: "accords_total",      label: "Accords & Traités",           icon: "Handshake",  color: "#059669" },
  { id: "accords_vigueur",    label: "Accords en vigueur",          icon: "Handshake",  color: "#15803d" },
  { id: "evenements_total",   label: "Événements répertoriés",      icon: "Calendar",   color: "#7c3aed" },
  { id: "evenements_a_venir", label: "Événements à venir",          icon: "Calendar",   color: "#d97706" },
  { id: "prospects_total",    label: "Prospects suivis",            icon: "TrendingUp", color: "#E35336" },
  { id: "projets_total",      label: "Projets",                     icon: "Layers",     color: "#6366f1" },
  { id: "intentions_total",   label: "Intentions d'investissement", icon: "Target",     color: "#0891b2" },
  { id: "intentions_usd",     label: "Montant intentions (USD)",    icon: "DollarSign", color: "#ca631f" },
  { id: "zone_ent_total",     label: "Entreprises en zone",         icon: "Building2",  color: "#188038" },
];

export const CATEGORIES: { key: string; label: string; color: string }[] = [];

export interface TableAnalytique {
  id: string;
  titre: string;
  description: string;
}

export const TABLES_ANALYTIQUES: TableAnalytique[] = [
  { id:"entreprises-par-region",    titre:"Entreprises par région",                   description:"Répartition avec % du total et classement" },
  { id:"top-departements",          titre:"Top départements",                          description:"Concentration d'entreprises, % et rang" },
  { id:"entreprises-par-pays",      titre:"Entreprises par pays d'origine",            description:"Nationalité du siège avec classement continental" },
  { id:"evolution-creations",       titre:"Évolution des créations par année",         description:"Créations, cumul, variation et évolution %" },
  { id:"entreprises-multi-secteurs",titre:"Entreprises multi-secteurs",                description:"Entreprises déclarées dans plusieurs secteurs" },
  { id:"zones-detail",              titre:"Détail des zones d'investissement",          description:"Type, région, superficie, installées, éligibles" },
  { id:"taux-occupation-zones",     titre:"Taux d'occupation des zones",               description:"Installées vs éligibles, taux et statut" },
  { id:"poles-detail",              titre:"Détail des pôles territoriaux",             description:"Pôles avec zones associées et entreprises" },
  { id:"vue-region",                titre:"Vue régionale consolidée",                  description:"Entreprises + zones + pôles par région" },
  { id:"secteurs-par-region",       titre:"Secteurs dominants par région",             description:"Top 3 secteurs dans chaque région" },
  { id:"local-vs-etranger",         titre:"Entreprises locales vs étrangères",         description:"Siège Sénégal vs étranger par région" },
  { id:"score-attractivite",        titre:"Score d'attractivité par région",           description:"Score composite : entreprises, zones, pôles" },
  { id:"concentration-sectorielle", titre:"Concentration sectorielle (HHI)",           description:"Indice de diversification par région" },
  { id:"avant-apres-pivot",         titre:"Entreprises par période de création",       description:"Avant 2010 / 2010–2019 / depuis 2020 par région" },
  { id:"densite-zones",             titre:"Densité des zones d'investissement",        description:"Entreprises par hectare dans chaque zone" },
  { id:"entreprises-par-arrondissement",     titre:"Entreprises par arrondissement",           description:"Top 20 arrondissements avec % et rang" },
  { id:"anciennete-entreprises",             titre:"Ancienneté des entreprises par région",    description:"Âge moyen, min, max et tranches par région" },
  { id:"entreprises-par-continent",          titre:"Entreprises par continent d'origine",      description:"Répartition continentale des investisseurs" },
  { id:"secteurs-investissement-classement",    titre:"Secteurs où on investit le plus",              description:"Classement des secteurs par nombre d'entreprises" },
  { id:"branches-classement",                   titre:"Branches les plus actives",                    description:"Rang national et rang dans le secteur" },
  { id:"activites-classement-national",         titre:"Activités les plus représentées",              description:"Rang national et rang dans le secteur" },
  { id:"entreprises-etrangeres-localisation",   titre:"Localisation des entreprises étrangères",      description:"Région, département, arrondissement des entreprises étrangères" },
  { id:"activites-entreprises-etrangeres",      titre:"Activités des entreprises étrangères",         description:"Ce que les entreprises étrangères développent le plus" },
  { id:"secteurs-etrangers-par-continent",      titre:"Secteurs des étrangers par continent",         description:"Spécialisation sectorielle selon le continent d'origine" },
  { id:"densite-economique-departements",       titre:"Densité économique par département",           description:"Secteurs, branches, activités et investisseurs étrangers par dept" },
];
