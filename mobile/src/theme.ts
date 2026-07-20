// Jetons de design APIX — l'identité du site, adaptée aux codes du mobile.
// Chaque couleur est dynamique (DynamicColorIOS) : l'app suit l'apparence
// du système et bascule nativement en mode sombre — nuit bleutée
// institutionnelle, accents éclaircis pour rester lisibles.
import { DynamicColorIOS, Platform } from "react-native";

// Google Sans — mêmes graisses que la plateforme web (400/500/600/700)
export const POLICE = {
  normal:   "GoogleSans_400Regular",
  moyen:    "GoogleSans_500Medium",
  demi:     "GoogleSans_600SemiBold",
  gras:     "GoogleSans_700Bold",
} as const;

// Couleur dynamique clair/sombre (repli clair hors iOS).
// ⏸ MODE SOMBRE EN PAUSE : l'app reste en clair quel que soit le système.
// Pour le réactiver : décommenter la ligne dynamique et remettre
// "userInterfaceStyle": "automatic" dans app.json.
const SOMBRE_ACTIF = false;
const dyn = (clair: string, sombre: string): any =>
  SOMBRE_ACTIF && Platform.OS === "ios" ? DynamicColorIOS({ light: clair, dark: sombre }) : clair;

export const T = {
  // Accents (textes, icônes, points) — éclaircis la nuit pour le contraste
  bleu:        dyn("#004f91", "#85B9EC"),
  orange:      dyn("#ca631f", "#E8935A"),
  vert:        dyn("#188038", "#57B87D"),
  // Fonds pleins bleus (boutons, chips actives — texte blanc par-dessus)
  bleuAction:  dyn("#004f91", "#2E64A6"),
  // Hero et barres de navigation
  heroFond:    dyn("#004f91", "#0E3355"),
  bleuNuit:    "#003a6e",
  bleuClair:   "#1a6ab0",
  // Encres
  encre:       dyn("#1a1a2e", "#EDF1F7"),
  texte:       dyn("#4a5568", "#B9C2CF"),
  gris:        dyn("#9aa5b4", "#8291A3"),
  grisClair:   dyn("#C5BFBB", "#5B6B7E"),
  // Surfaces
  fond:        dyn("#F6F5F3", "#0B1220"),
  carte:       dyn("#FFFFFF", "#151E2E"),
  carteDouce:  dyn("#FAFAF9", "#1B2536"),
  champ:       dyn("#F8F7F6", "#101927"),
  bordure:     dyn("#ECEAE7", "#263248"),
  bordureDouce: dyn("#F0EEEC", "#222D40"),
  filet:       dyn("#F2F0EF", "#1E293B"),
  // Graphes
  grille:      dyn("#F0EEEB", "#243044"),
  grilleZero:  dyn("#DDD9D4", "#33415A"),
  // Voiles bleus (blocs d'information, chips)
  bleuVoile:   dyn("rgba(0,79,145,0.07)", "rgba(133,185,236,0.13)"),
  blocFond:    dyn("rgba(0,79,145,0.04)", "rgba(133,185,236,0.07)"),
  blocBord:    dyn("rgba(0,79,145,0.10)", "rgba(133,185,236,0.16)"),
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
  { cle: "ide",          titre: "Investissements privés",        sous: "Flux & stocks d'IDE",            icone: "finance_mode",      href: "/ide" },
  { cle: "statistiques", titre: "Échanges commerciaux",          sous: "Flux bilatéraux",                icone: "currency_exchange", href: "/statistiques" },
  { cle: "prospects",    titre: "Prospects",                     sous: "Investisseurs suivis",           icone: "frame_inspect",     href: "/prospects" },
  { cle: "entreprises",  titre: "Entreprises installées",        sous: "Registre des entreprises",       icone: "enterprise",        href: "/entreprises" },
  { cle: "zones",        titre: "Zones d'investissement",        sous: "ZES, ZAI & pôles",               icone: "real_estate_agent", href: "/zones" },
  { cle: "opportunites", titre: "Opportunités d'investissement", sous: "Projets & potentialités",        icone: "bookmark_stacks",   href: "/opportunites" },
  { cle: "accords",      titre: "Accords & Traités",             sous: "TBI & traités internationaux",   icone: "signature",         href: "/accords" },
  { cle: "evenements",   titre: "Événements",                    sous: "Agenda des investisseurs",       icone: "event",             href: "/evenements" },
] as const;

// Section « Plus » — les entrées transverses de la plateforme
export const PLUS = [
  { cle: "fiche-pays", titre: "Fiche Pays",               sous: "Relations bilatérales",           icone: "public", href: "/fiche-pays" },
  { cle: "code",       titre: "Code des investissements", sous: "Code et modalités d'application", icone: "gavel",  href: "/code" },
] as const;
