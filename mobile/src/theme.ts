// Jetons de design APIX — l'identité du site, adaptée aux codes du mobile.

// Google Sans — mêmes graisses que la plateforme web (400/500/600/700)
export const POLICE = {
  normal:   "GoogleSans_400Regular",
  moyen:    "GoogleSans_500Medium",
  demi:     "GoogleSans_600SemiBold",
  gras:     "GoogleSans_700Bold",
} as const;

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

// Les 8 modules de la plateforme — mêmes intitulés que le site, pastilles
// monochromes bleues (équivalents Ionicons des Material Symbols du site)
export const MODULES = [
  { cle: "ide",          titre: "Investissements privés",        icone: "trending-up",     href: "/",         actif: false },
  { cle: "statistiques", titre: "Échanges commerciaux",          icone: "swap-horizontal", href: "/",         actif: false },
  { cle: "prospects",    titre: "Prospects",                     icone: "scan",            href: "/",         actif: false },
  { cle: "entreprises",  titre: "Entreprises installées",        icone: "business",        href: "/",         actif: false },
  { cle: "zones",        titre: "Zones d'investissement",        icone: "map",             href: "/",         actif: false },
  { cle: "opportunites", titre: "Opportunités d'investissement", icone: "layers",          href: "/",         actif: false },
  { cle: "accords",      titre: "Accords & Traités",             icone: "document-text",   href: "/accords",  actif: true },
  { cle: "evenements",   titre: "Événements",                    icone: "calendar",        href: "/",         actif: false },
] as const;
