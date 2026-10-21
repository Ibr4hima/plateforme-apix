// Jetons de design APIX — l'identité du site, adaptée aux codes du mobile.
// Chaque couleur porte ses deux valeurs : l'app suit l'apparence du système
// et bascule en mode sombre — nuit bleutée institutionnelle, accents
// éclaircis pour rester lisibles. iOS tranche nativement (DynamicColorIOS),
// Android au moment de la lecture (Proxy + creerStyles) ; même rendu.
import { DynamicColorIOS, Platform, PlatformColor } from "react-native";
import { estSombreCourant } from "@/lib/apparence";

// Google Sans — mêmes graisses que la plateforme web (400/500/600/700)
export const POLICE = {
  normal:   "GoogleSans_400Regular",
  moyen:    "GoogleSans_500Medium",
  demi:     "GoogleSans_600SemiBold",
  gras:     "GoogleSans_700Bold",
} as const;

// Les mêmes fichiers sous leur nom PostScript. Les noms ci-dessus sont des
// alias d'expo-font : les textes de l'app et les barres du système les
// résolvent, mais un contrôle UIKit qui cherche sa police par son NOM
// (UIFont fontWithName:) — le contrôle segmenté — ne connaît que ceux-ci.
export const POLICE_POSTSCRIPT = {
  normal:   "GoogleSans-Regular",
  moyen:    "GoogleSans-Medium",
  demi:     "GoogleSans-SemiBold",
  gras:     "GoogleSans-Bold",
} as const;

// Couleur clair/sombre — ACTIF.
//
// Chaque jeton porte ses deux valeurs et iOS choisit lui-même la bonne, en
// direct, sans qu'aucun composant ne re-rende : c'est le mécanisme le plus
// fidèle et le moins coûteux.
//
// Deux consommateurs ne parlent pas au natif et refusent l'objet dynamique :
// Reanimated (qui valide les couleurs du style de tout composant animé) et
// Skia (qui dessine sur son propre canevas). Ils sont servis par
// lib/apparence : la résolution se fait DANS les composants concernés —
// Tapable, Apparition, Permutation, RangeeMouvante, Feuille, CurseurAnnees,
// MiniTendance, GrapheLignes, SilhouetteRegion, SeparateurSection — et non
// aux centaines de points d'appel, où un oubli serait invisible.
// Android n'a pas d'équivalent de DynamicColorIOS : le jeton y garde ses deux
// valeurs, et c'est le Proxy plus bas qui tranche AU MOMENT DE LA LECTURE.
// Les feuilles de style, elles, passent par creerStyles (lib/apparence), qui
// les construit dans les deux schémas. Rendu identique à celui d'iOS.
const SOMBRE_ACTIF = true;
const IOS = Platform.OS === "ios";
const ANDROID = Platform.OS === "android";
const dyn = (clair: any, sombre: any): any =>
  !SOMBRE_ACTIF ? clair
  : IOS ? DynamicColorIOS({ light: clair, dark: sombre })
  : ANDROID ? { __dyn: [clair, sombre] }
  : clair;

// LA POLICE DE CHAQUE SYSTÈME, en un seul jeton. iOS garde Google Sans.
// Android prend celle du téléphone — Roboto sur un Pixel, One UI Sans sur un
// Samsung, celle des Paramètres et des apps du constructeur : la famille est
// laissée au système, seule la graisse est dite. Les styles l'étalent
// (...FONTE.gras) là où ils nommaient une famille.
export const FONTE = ANDROID ? {
  normal: { fontWeight: "400" }, moyen: { fontWeight: "500" },
  demi:   { fontWeight: "600" }, gras:  { fontWeight: "700" },
} as const : {
  normal: { fontFamily: POLICE.normal }, moyen: { fontFamily: POLICE.moyen },
  demi:   { fontFamily: POLICE.demi },   gras:  { fontFamily: POLICE.gras },
} as const;

// LES TONS DU TÉLÉPHONE (Material You), sur Android 12 et plus : les
// commandes — la sélection d'un segment, d'une puce, de l'onglet, d'une case
// — prennent les couleurs que le téléphone tire de son fond d'écran, comme
// les apps de Google. Le bleu APIX reste au contenu : chiffres, titres,
// liens. Avant Android 12, et sur iOS, les commandes gardent les tons de
// l'app.
const MATERIAL_YOU = ANDROID && Number(Platform.Version) >= 31;
const systeme = (ton: string) => PlatformColor(`@android:color/system_${ton}`);

const JETONS = {
  // Accents (textes, icônes, points) — éclaircis la nuit pour le contraste
  bleu:        dyn("#004f91", "#85B9EC"),
  // La nuit, l'orange s'éclaircit et se réchauffe ; le vert quitte le vert —
  // sur un fond de minuit bleuté, un vert franc jure, là où le teal appartient
  // à la même famille froide que le bleu de la maison
  orange:      dyn("#ca631f", "#FFA45C"),
  vert:        dyn("#188038", "#48C9B0"),
  // Fonds pleins bleus (boutons, chips actives — texte blanc par-dessus)
  bleuAction:  dyn("#004f91", "#2E64A6"),
  // Le champ de recherche d'iOS 26 (et son X rond) : le gris neutre des
  // champs du système, et un liseré à peine visible — qui fait le verre la nuit
  champRecherche:     dyn("rgba(118,118,128,0.12)", "rgba(118,118,128,0.24)"),
  bordChampRecherche: dyn("rgba(0,0,0,0.04)", "rgba(255,255,255,0.10)"),
  // Le rouge des pastilles d'alerte (nombre de filtres actifs) — celui des
  // baisses dans l'app ; la nuit, un ton plus vif
  rouge:       dyn("#DC2626", "#EF4444"),
  // La tuile « Événement à venir » de l'accueil : le bleu des pastilles
  // d'Explorer (pastilleFond) — le bleu de la maison le jour, le bleu ardoise
  // la nuit —, le texte en blanc dans les deux apparences
  tuileEvenement:      dyn("#004f91", "#22406A"),
  surTuileEvenement:   "#FFFFFF",
  surTuileEvenementDoux: dyn("rgba(255,255,255,0.86)", "rgba(255,255,255,0.80)"),
  dateTuileEvenement:  dyn("rgba(255,255,255,0.16)", "rgba(255,255,255,0.12)"),
  bordDateEvenement:   dyn("rgba(255,255,255,0.24)", "rgba(255,255,255,0.18)"),
  // Hero et barres de navigation
  // Le hero : le bleu APIX de jour ; la nuit un bleu de minuit un cran
  // au-dessus des cartes (#151E2E) et du fond (#0B1220) — même famille de
  // teinte, une simple marche d'élévation. Le bandeau se signale alors par
  // sa forme et sa lumière, et la couleur reste au contenu.
  heroFond:    dyn("#004f91", "#16213A"),
  // L'encre des boutons de verre du hero : bleu profond sur le verre laiteux
  // du jour, bleu clair sur le verre sombre de la nuit
  encreHero:   dyn("#004f91", "#85B9EC"),
  // L'aplat de la chip choisie — la nuit, la borne haute du dégradé du hero :
  // la barre d'onglets appartient au même bandeau que lui
  chipActif:   dyn("#004f91", "#22406A"),
  bleuNuit:    "#003a6e",
  bleuClair:   "#1a6ab0",
  // Encres
  encre:       dyn("#1a1a2e", "#EDF1F7"),
  // Le grand titre de l'accueil iOS (« Invest in ») : le bleu de la maison le
  // jour, l'encre claire la nuit
  titreAccueil: dyn("#004f91", "#EDF1F7"),
  texte:       dyn("#4a5568", "#B9C2CF"),
  // Gris de TEXTE — 4,8:1 sur blanc : le seuil AA des petites tailles
  gris:        dyn("#6b7280", "#9AA7B8"),
  // Gris décoratif — chevrons, filets, glyphes : 3,1:1, le seuil des
  // éléments non textuels. Aucun texte ne doit le porter.
  grisClair:   dyn("#8b93a1", "#6B7A8D"),
  // Surfaces
  // Le fond : un gris très clair, sur lequel les surfaces blanches (cartes,
  // tuiles, tableaux) se détachent — de leur liseré et d'une ombre légère
  fond:        dyn("#FAFAFA", "#0B1220"),
  carte:       dyn("#FFFFFF", "#151E2E"),
  // ── Bordures : des gris ALPHA, jamais des couleurs dynamiques ──
  //
  // Une bordure vit sur le CALayer, qui ne réévalue pas sa CGColor quand
  // l'apparence change : un liseré dynamique restait en nuit sur fond clair.
  // Un gris translucide, lui, se COMPOSE avec ce qu'il y a dessous — il
  // s'éclaircit sur blanc, il s'assombrit sur la nuit — et vaut donc pour
  // les deux schémas sans rien résoudre. Contrastes mesurés : 1,3:1 sur
  // blanc, 1,5:1 sur une carte de nuit, soit l'équivalent des valeurs
  // qu'ils remplacent.
  carteBord:   "rgba(122,138,164,0.26)",
  carteDouce:  dyn("#FAFAF9", "#1B2536"),
  champ:       dyn("#F8F7F6", "#101927"),
  bordure:     "rgba(122,138,164,0.16)",
  bordureDouce: "rgba(122,138,164,0.11)",
  filet:       "rgba(122,138,164,0.10)",
  // Graphes
  grille:      dyn("#F0EEEB", "#243044"),
  grilleZero:  dyn("#DDD9D4", "#33415A"),
  // Voiles bleus (blocs d'information, chips)
  bleuVoile:   dyn("rgba(0,79,145,0.07)", "rgba(133,185,236,0.13)"),
  orangeVoile: dyn("rgba(202,99,31,0.09)", "rgba(255,164,92,0.14)"),
  vertVoile:   dyn("rgba(24,128,56,0.09)", "rgba(72,201,176,0.14)"),
  blocFond:    dyn("rgba(0,79,145,0.04)", "rgba(133,185,236,0.07)"),
  // Le pouce du curseur : une commande doit se détacher de sa piste. Blanc
  // le jour, blanc bleuté la nuit — surtout pas la couleur des cartes, qui
  // le faisait disparaître dans le fond.
  pouce:       dyn("#FFFFFF", "#DCE6F3"),
  // Les pastilles d'Explorer : un aplat bleu plein — le bleu APIX le jour,
  // un bleu ardoise la nuit, celui de la tuile « Événement à venir ».
  pastilleFond: dyn("#004f91", "#22406A"),
  // Le glyphe posé dessus : blanc dans les deux schémas (5,8:1 la nuit)
  surBleu:     "#FFFFFF",
  // Voiles neutres (pistes de segments, rails de curseur, pastilles de compte)
  voile:       "rgba(122,138,164,0.13)",
  // La pastille du segment choisi (SegmentsCapsule, iOS) : le gris neutre des
  // contrôles d'iOS, sans la teinte bleutée des voiles de l'app
  pastilleSegment: dyn("rgba(118,118,128,0.14)", "rgba(235,235,245,0.16)"),
  voileFort:   "rgba(130,148,176,0.30)",
  // La surbrillance d'une surface touchée. iOS : le gris des cellules
  // d'UIKit, posé par-dessus la carte le temps de l'appui. Android :
  // l'ondulation de Material, à l'opacité de son état « pressé » (10 %)
  surbrillance: IOS ? dyn("rgba(0,0,0,0.075)", "rgba(255,255,255,0.09)")
    : dyn("rgba(0,0,0,0.10)", "rgba(255,255,255,0.12)"),
  // Android : le ton de sélection de Material 3 (secondary container) — le
  // segment, la puce, l'onglet ou la tuile d'action choisis s'en
  // remplissent —, et ce qui se pose dessus (on secondary container)
  selection:   MATERIAL_YOU ? dyn(systeme("accent2_100"), systeme("accent2_700"))
    : dyn("rgba(0,79,145,0.12)", "rgba(133,185,236,0.22)"),
  surSelection: MATERIAL_YOU ? dyn(systeme("accent2_900"), systeme("accent2_100"))
    : dyn("#004f91", "#85B9EC"),
  // Android : la couleur des commandes (primary) — case cochée, bouton
  // radio, en-tête de liste, bouton texte
  accent:      MATERIAL_YOU ? dyn(systeme("accent1_600"), systeme("accent1_200"))
    : dyn("#004f91", "#85B9EC"),
  // iOS : le bleu du système (systemBlue), jour et nuit — celui des
  // pastilles d'iOS, comme le compte du filtre de Téléphone
  bleuSysteme: dyn("#007AFF", "#0A84FF"),
  // Ce qui se pose sur l'accent (on primary) : le chiffre d'une pastille
  surAccent:   MATERIAL_YOU ? dyn("#FFFFFF", systeme("accent1_800")) : dyn("#FFFFFF", "#0B1220"),
  // Android : la surface de la barre de navigation de Material 3 (surface
  // container) — un cran plus soutenue que la page le jour, plus claire la nuit
  surfaceBarre: dyn("#F1F3F6", "#151E2E"),
  blocBord:    "rgba(90,145,205,0.30)",
  rayonCarte:  18,
} as const;

// Sur iOS, T est la table telle quelle : les jetons dynamiques descendent au
// natif. Sur Android, chaque lecture d'un jeton rend la variante du schéma
// courant — d'où le Proxy, qui laisse les 1 000 emplois de `T.x` de l'app
// inchangés au lieu de les convertir un à un.
export const T: typeof JETONS = ANDROID && SOMBRE_ACTIF
  ? new Proxy(JETONS, {
      get: (table, cle) => {
        const v: any = (table as any)[cle];
        return v && v.__dyn ? v.__dyn[estSombreCourant() ? 1 : 0] : v;
      },
    })
  : JETONS;

// ── Échelle typographique unique ─────────────────────────────────────────────
// Cinq crans, interlignes fixés. Toute taille de texte de l'app doit venir
// d'ici (plus de 13.5 / 11.5 dispersés au cas par cas).
export const TYPO = {
  display: { fontSize: 29,   lineHeight: 35, ...FONTE.gras,   letterSpacing: -0.6 },
  titre:   { fontSize: 19,   lineHeight: 25, ...FONTE.gras,   letterSpacing: -0.3 },
  sousTitre: { fontSize: 15, lineHeight: 20, ...FONTE.demi,   letterSpacing: -0.2 },
  corps:   { fontSize: 15,   lineHeight: 21, ...FONTE.normal },
  corpsDemi: { fontSize: 13, lineHeight: 18, ...FONTE.demi },
  legende: { fontSize: 12.5, lineHeight: 18, ...FONTE.normal },
  micro:   { fontSize: 10.5, lineHeight: 14, ...FONTE.gras,   letterSpacing: 1.4 }, // étiquettes uppercase
} as const;

// ── Dynamic Type : jusqu'où le texte a le droit de grossir ───────────────────
// iOS laisse l'utilisateur agrandir le texte jusqu'à ×3,5 en accessibilité.
// Sans plafond, un nombre de 38 pt en occupe 133 et fait éclater la carte.
// Trois plafonds selon le rôle : le texte courant respire, les chiffres et
// les étiquettes serrées se retiennent (ils vivent dans des gabarits fixes).
export const ECHELLE = {
  /** Texte courant : titres, corps, libellés de liste. */
  texte: 1.5,
  /** Chiffres vedettes et valeurs alignées — gabarit contraint. */
  chiffre: 1.2,
  /** Étiquettes capitales, badges, pastilles — très peu de place. */
  compact: 1.3,
} as const;

// ── Échelle d'espacement ─────────────────────────────────────────────────────
export const ESPACE = { xxs: 4, xs: 8, s: 12, m: 16, l: 24, xl: 32 } as const;

// ── Rayons normalisés ────────────────────────────────────────────────────────
export const RAYON = { petit: 10, moyen: 16, grand: 22, pilule: 999 } as const;

// ── Les coins des surfaces ───────────────────────────────────────────────────
// iOS garde, pour chaque surface, l'arrondi choisi pour elle, sur sa courbe
// continue. Android prend l'échelle de formes de Material 3 : 12 dp pour une
// surface posée dans la page — carte, groupe, bloc, tuile —, 8 dp pour un
// petit élément. Le reste suit déjà Material : les barres d'un bord à
// l'autre droites, les feuilles à 28 dp, les boutons, la recherche, les
// segments et l'indicateur de la barre en pilule, les puces de filtre à 8 dp.
// Un seul endroit règle toute l'app : 12 et 8 se changent ici.
export const coin = (r: number): number => (IOS ? r : r >= 12 ? 12 : 8);

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

// Le bloc « À venir » de l'accueil — le seul aplat de couleur de la page.
// De jour il assume le bleu APIX ; de nuit il descend vers le bleu de minuit
// du fond, sans quoi il vibrait comme une pièce rapportée.
// Le bandeau de hero — le même dégradé que le bloc « À venir » de l'accueil :
// les deux grandes surfaces bleues de l'app partagent leur matière. De jour
// il reste l'aplat plein du bleu APIX (deux bornes identiques), la nuit il
// monte du bleu de minuit du hero vers le bleu de la maison.
export const DEGRADE_HERO = {
  clair: ["#004f91", "#004f91"] as const,
  sombre: ["#16213A", "#22406A"] as const,
};

export const DEGRADE_EVENEMENT = {
  clair: ["#063C6E", "#004f91", "#1465AC"] as const,
  sombre: ["#16213A", "#22406A"] as const,
};

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
  { cle: "statistiques", titre: "Échanges commerciaux", sous: "Flux bilatéraux et indicateurs éco.",         icone: "currency_exchange", sf: "arrow.left.arrow.right",    accent: "bleu",   href: "/flux" },
  { cle: "prospects",    titre: "Prospects",       sous: "Investisseurs suivis",     icone: "frame_inspect",     sf: "binoculars",                accent: "orange", href: "/prospects" },
  { cle: "entreprises",  titre: "Entreprises",     sous: "Registre des entreprises",  icone: "enterprise",        sf: "building.2",                accent: "bleu",   href: "/entreprises" },
  { cle: "zones",        titre: "Zones d'investissement", sous: "ZES, ZAI et pôles territoires",         icone: "real_estate_agent", sf: "mappin.and.ellipse",        accent: "orange", href: "/zones" },
  { cle: "opportunites", titre: "Opportunités d'investissement", sous: "Projets & potentialités", icone: "bookmark_stacks",   sf: "lightbulb",                 accent: "bleu",   href: "/opportunites" },
  { cle: "accords",      titre: "Accords & Traités", sous: "Traités Bilatéraux d'Investissement",            icone: "signature",         sf: "signature",                 accent: "orange", href: "/accords" },
  { cle: "evenements",   titre: "Événements",      sous: "Agenda des investisseurs",     icone: "event",             sf: "calendar",                  accent: "bleu",   href: "/evenements" },
] as const;

// Section « Plus » — les entrées transverses de la plateforme
export const PLUS = [
  { cle: "fiche-pays", titre: "Fiche Pays",             sous: "Relations bilatérales",           icone: "public", sf: "globe.europe.africa", accent: "bleu",   href: "/fiche-pays" },
  { cle: "code",       titre: "Lois & Règlementations", sous: "Code et modalités d'application", icone: "gavel",  sf: "text.book.closed",    accent: "orange", href: "/code" },
] as const;
