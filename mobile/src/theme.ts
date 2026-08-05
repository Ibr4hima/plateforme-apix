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

// Couleur clair/sombre.
//
// ⏸ MODE SOMBRE EN PAUSE — techniquement bloqué, pas oublié : Reanimated
// refuse les valeurs DynamicColorIOS dans le style d'un composant animé
// (« Invalid color value: [object Object] »), et Tapable — le retour tactile
// de toute l'app, 177 emplois — en est un. Basculer ce drapeau fait donc
// planter l'accueil au premier rendu.
//
// La sortie n'est pas un drapeau mais une résolution des couleurs en chaînes
// simples : palette claire / sombre choisie à l'exécution et diffusée par un
// contexte, les StyleSheet.create statiques cédant la place à des styles
// dérivés du thème. C'est un chantier à part entière, à mener écran par
// écran ; en attendant, l'app reste claire et les jetons ci-dessous portent
// déjà leurs deux valeurs, prêtes pour ce jour-là.
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
  // Contour des cartes — le filet fin de la plateforme (rgba encre à 12 %) :
  // c'est lui qui détache la carte du fond, pas une ombre
  carteBord:   dyn("rgba(16,26,46,0.12)", "#263248"),
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
  orangeVoile: dyn("rgba(202,99,31,0.09)", "rgba(232,147,90,0.14)"),
  vertVoile:   dyn("rgba(24,128,56,0.09)", "rgba(87,184,125,0.14)"),
  blocFond:    dyn("rgba(0,79,145,0.04)", "rgba(133,185,236,0.07)"),
  // Voiles neutres (pistes de segments, rails de curseur, pastilles de compte)
  voile:       dyn("rgba(16,26,46,0.055)", "rgba(255,255,255,0.07)"),
  voileFort:   dyn("rgba(16,26,46,0.10)", "rgba(255,255,255,0.13)"),
  blocBord:    dyn("rgba(0,79,145,0.10)", "rgba(133,185,236,0.16)"),
  rayonCarte:  18,
} as const;

// ── Échelle typographique unique ─────────────────────────────────────────────
// Cinq crans, interlignes fixés. Toute taille de texte de l'app doit venir
// d'ici (plus de 13.5 / 11.5 dispersés au cas par cas).
export const TYPO = {
  display: { fontSize: 29,   lineHeight: 35, fontFamily: POLICE.gras,   letterSpacing: -0.6 },
  titre:   { fontSize: 19,   lineHeight: 25, fontFamily: POLICE.gras,   letterSpacing: -0.3 },
  sousTitre: { fontSize: 15, lineHeight: 20, fontFamily: POLICE.demi,   letterSpacing: -0.2 },
  corps:   { fontSize: 15,   lineHeight: 21, fontFamily: POLICE.normal },
  corpsDemi: { fontSize: 13, lineHeight: 18, fontFamily: POLICE.demi },
  legende: { fontSize: 12.5, lineHeight: 18, fontFamily: POLICE.normal },
  micro:   { fontSize: 10.5, lineHeight: 14, fontFamily: POLICE.gras,   letterSpacing: 1.4 }, // étiquettes uppercase
} as const;

// ── Échelle d'espacement ─────────────────────────────────────────────────────
export const ESPACE = { xxs: 4, xs: 8, s: 12, m: 16, l: 24, xl: 32 } as const;

// ── Rayons normalisés ────────────────────────────────────────────────────────
export const RAYON = { petit: 10, moyen: 16, grand: 22, pilule: 999 } as const;

// ── Ombres : trois niveaux d'élévation ───────────────────────────────────────
export const OMBRE = {
  // Posé : cards de liste
  n1: {
    shadowColor: "#001e3c", shadowOpacity: 0.04, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  // Flottant : KPIs, surfaces groupées
  n2: {
    shadowColor: "#001e3c", shadowOpacity: 0.06, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  // Détaché : sheets, éléments au-dessus du contenu
  n3: {
    shadowColor: "#001e3c", shadowOpacity: 0.14, shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
} as const;

export const BADGE = {
  en_vigueur: { label: "En vigueur",            c: "#188038", bg: "rgba(24,128,56,0.08)" },
  signe:      { label: "Signé non en vigueur",  c: "#004f91", bg: "rgba(0,79,145,0.07)" },
  expire:     { label: "Expiré",                c: "#b45309", bg: "rgba(202,99,31,0.10)" },
} as const;

// Les 8 modules de la plateforme. `titre` est la forme courte des tuiles de
// l'accueil (une ligne) ; `sous` la précision. Chaque module porte ses deux
// icônes : `sf` (SF Symbols, iOS) et `icone` (ligature Material, ailleurs) —
// voir components/Icone.tsx.
// `accent` reprend l'alternance orange/bleu du menu Modules du site
// (navData.ts) : les deux surfaces signent avec les mêmes couleurs.
export const MODULES = [
  { cle: "ide",          titre: "Investissements privés", sous: "Flux & stocks d'IDE",      icone: "finance_mode",      sf: "chart.line.uptrend.xyaxis", accent: "orange", href: "/investissements" },
  { cle: "statistiques", titre: "Échanges commerciaux", sous: "Indicateurs & flux",         icone: "currency_exchange", sf: "arrow.left.arrow.right",    accent: "bleu",   href: "/flux" },
  { cle: "prospects",    titre: "Prospects",       sous: "Investisseurs suivis",     icone: "frame_inspect",     sf: "binoculars",                accent: "orange", href: "/prospects" },
  { cle: "entreprises",  titre: "Entreprises",     sous: "Registre des installées",  icone: "enterprise",        sf: "building.2",                accent: "bleu",   href: "/entreprises" },
  { cle: "zones",        titre: "Zones d'investissement", sous: "ZES, ZAI & pôles",         icone: "real_estate_agent", sf: "mappin.and.ellipse",        accent: "orange", href: "/zones" },
  { cle: "opportunites", titre: "Opportunités d'investissement", sous: "Projets & potentialités", icone: "bookmark_stacks",   sf: "lightbulb",                 accent: "bleu",   href: "/opportunites" },
  { cle: "accords",      titre: "Accords & Traités", sous: "TBI & traités internationaux",            icone: "signature",         sf: "signature",                 accent: "orange", href: "/accords" },
  { cle: "evenements",   titre: "Événements",      sous: "Agenda investisseurs",     icone: "event",             sf: "calendar",                  accent: "bleu",   href: "/evenements" },
] as const;

// Section « Plus » — les entrées transverses de la plateforme
export const PLUS = [
  { cle: "fiche-pays", titre: "Fiche Pays",             sous: "Relations bilatérales",           icone: "public", sf: "globe.europe.africa", accent: "bleu",   href: "/fiche-pays" },
  { cle: "code",       titre: "Lois & Règlementations", sous: "Code et modalités d'application", icone: "gavel",  sf: "text.book.closed",    accent: "orange", href: "/code" },
] as const;
