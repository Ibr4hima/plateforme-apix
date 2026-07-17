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

// Les 8 modules de la plateforme — mêmes intitulés et mêmes icônes
// Material Symbols que le menu Modules du site.
export const MODULES = [
  { cle: "ide",          titre: "Investissements privés",        sous: "Flux & stocks d'IDE",            icone: "finance_mode",      href: "" },
  { cle: "statistiques", titre: "Échanges commerciaux",          sous: "Flux bilatéraux",                icone: "currency_exchange", href: "" },
  { cle: "prospects",    titre: "Prospects",                     sous: "Investisseurs suivis",           icone: "frame_inspect",     href: "" },
  { cle: "entreprises",  titre: "Entreprises installées",        sous: "Registre des entreprises",       icone: "enterprise",        href: "/entreprises" },
  { cle: "zones",        titre: "Zones d'investissement",        sous: "ZES, ZAI & pôles",               icone: "real_estate_agent", href: "/zones" },
  { cle: "opportunites", titre: "Opportunités",                  sous: "Projets & potentialités",        icone: "bookmark_stacks",   href: "/opportunites" },
  { cle: "accords",      titre: "Accords & Traités",             sous: "TBI & traités internationaux",   icone: "signature",         href: "/accords" },
  { cle: "evenements",   titre: "Événements",                    sous: "Agenda des investisseurs",       icone: "event",             href: "/evenements" },
] as const;

// Section « Plus » — les entrées transverses de la plateforme
export const PLUS = [
  { cle: "fiche-pays", titre: "Fiche Pays",               sous: "Relations bilatérales",           icone: "public", href: "/fiche-pays" },
  { cle: "code",       titre: "Code des investissements", sous: "Code et modalités d'application", icone: "gavel",  href: "/code" },
] as const;
