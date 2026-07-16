// Jetons de design APIX — l'identité du site, adaptée aux codes du mobile.

export const T = {
  bleu:        "#004f91",
  bleuNuit:    "#003a6e",
  bleuClair:   "#1a6ab0",
  orange:      "#ca631f",
  vert:        "#188038",
  encre:       "#1a1a2e",
  texte:       "#4a5568",
  gris:        "#9aa5b4",
  grisClair:   "#C5BFBB",
  fond:        "#F6F5F3",
  carte:       "#fff",
  bordure:     "#ECEAE7",
  filet:       "#F2F0EF",
  rayonCarte:  18,
} as const;

export const BADGE = {
  en_vigueur: { label: "En vigueur",            c: "#188038", bg: "rgba(24,128,56,0.08)" },
  signe:      { label: "Signé non en vigueur",  c: "#004f91", bg: "rgba(0,79,145,0.07)" },
  expire:     { label: "Expiré",                c: "#b45309", bg: "rgba(202,99,31,0.10)" },
} as const;

// Modules de la plateforme — pastille de couleur + icône Ionicons
export const MODULES = [
  { cle: "accords",      titre: "Accords & Traités", sous: "Accords internationaux",    icone: "document-text",   couleur: "#004f91", href: "/accords",  actif: true },
  { cle: "entreprises",  titre: "Entreprises",       sous: "Installées au Sénégal",     icone: "business",        couleur: "#ca631f", href: "/",         actif: false },
  { cle: "evenements",   titre: "Événements",        sous: "Agenda économique",         icone: "calendar",        couleur: "#188038", href: "/",         actif: false },
  { cle: "zones",        titre: "Zones",             sous: "Zones d'investissement",    icone: "map",             couleur: "#6A1B9A", href: "/",         actif: false },
  { cle: "ide",          titre: "IDE",               sous: "Investissements étrangers", icone: "trending-up",     couleur: "#0891b2", href: "/",         actif: false },
  { cle: "statistiques", titre: "Statistiques",      sous: "Commerce & macro",          icone: "stats-chart",     couleur: "#b91c1c", href: "/",         actif: false },
] as const;
