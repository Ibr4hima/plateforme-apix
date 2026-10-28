// La palette de la plateforme — source unique.
//
// Ce fichier n'est pas expédié au navigateur : c'est de l'outillage. Il produit
// les variables CSS de globals.css (genere-css.mjs), dont contrastes.mjs
// vérifie la lisibilité.
//
// ── Un seul schéma ───────────────────────────────────────────────────────────
// La plateforme ne s'affiche qu'en clair, quel que soit le réglage de
// l'appareil : un écran de travail institutionnel, le même pour tous.
//
// ── Le fond et les neutres ───────────────────────────────────────────────────
// Le fond de page est un blanc à peine grisé (#FAFAFA) ; les cartes et les
// tableaux restent blancs et s'en détachent par un filet, pas par une ombre.
// Les gris qui les accompagnent — filets, bordures, zones creuses, grilles de
// graphe — sont NEUTRES, de la même famille que le fond : les gris beiges
// d'avant viraient au jaune à côté d'un fond neutre et ternissaient le blanc
// des cartes.

// ── Les jetons ───────────────────────────────────────────────────────────────
export const JETONS = {
  // ── Surfaces, de la plus haute à la plus creuse ──
  carte:        "#FFFFFF",
  // La surface secondaire : l'en-tête d'un tableau, un bloc posé dans une
  // carte. Elle prend le gris du fond, et se lit donc « creusée » dans le blanc.
  carteDouce:   "#FAFAFA",
  // Le gris du fond, sous les zones de saisie et dans les fonds de section
  // historiques. Les champs du design system (.ds-champ), eux, sont blancs :
  // c'est leur filet qui les dessine, comme une carte.
  champ:        "#FAFAFA",
  fond:         "#FAFAFA",
  fondCreux:    "#F4F4F5",
  fondCreux2:   "#E9E9EC",

  // ── Bordures ──
  filet:        "#F0F0F2",
  bordure:      "#E6E6E9",
  bordureForte: "#D4D4D8",

  // ── Encres ──
  encre:        "#1a1a2e",
  texte:        "#4a5568",
  grisFort:     "#6b7280",
  // Les légendes : un ton sous le texte secondaire, mais lisible — le gris
  // d'avant (#9aa5b4) ne donnait que 2,5:1 sur blanc.
  gris:         "#808a9b",
  // Posé sur un aplat de marque (bouton plein, bandeau) : blanc.
  surBleu:      "#FFFFFF",
  // L'encre de ce qui est posé sur une surface blanche par construction — la
  // pastille active d'un segment de bandeau, par exemple.
  bleuFixe:     "#004f91",

  // ── Marque ──
  // L'encre (un titre, une icône) et l'aplat (un bouton, une chip active)
  // portent la même couleur ; les deux jetons restent distincts parce qu'ils
  // ne disent pas la même chose.
  bleu:         "#004f91",
  bleuAction:   "#004f91",
  bleuNuit:     "#003a6e",
  bleuClair:    "#1a6ab0",
  bleuProfond:  "#002a52",
  bleuVoile:    "#EEF1F6",

  orange:       "#ca631f",
  orangeAction: "#ca631f",
  orangeFonce:  "#a84e18",
  orangeProfond:"#4d2206",
  orangeVoile:  "#FFF6EF",

  vert:         "#188038",
  vertAction:   "#188038",
  vertFonce:    "#0d652d",
  vertVoile:    "#EDFBF1",

  violet:       "#6A1B9A",
  violetAction: "#6A1B9A",
  violetVoile:  "#F3EDFA",

  danger:       "#dc2626",
  dangerAction: "#dc2626",
  dangerFonce:  "#991b1b",
  dangerVoile:  "#FFF2F2",

  alerte:       "#b45309",
  alerteVoile:  "#FFF9F0",

  // ── Les teintes catégorielles ──
  // Elles ne décrivent pas une surface mais une IDENTITÉ : un pôle, un secteur,
  // une série de graphe.
  cyan:         "#0891b2",
  sarcelle:     "#0e7490",
  indigo:       "#4338ca",
  olive:        "#4d7c0f",
  ambre:        "#a16207",
  emeraude:     "#1b9e77",
  prune:        "#7b3294",
  azur:         "#2a8fb0",
  framboise:    "#d6336c",
  or:           "#b8860b",
  bleuroi:      "#3b4cc0",
  cyanFonce:    "#0e7490",
  rose:         "#be185d",
  roseVoile:    "#FCE7F3",
  // Trois teintes propres aux badges de statut (composant Badge)
  terracotta:   "#E35336",
  rouille:      "#B7410E",
  jaune:        "#FBBC04",

  // ── Les quatorze régions du Sénégal ──
  regDakar:       "#9DC3E6",
  regThies:       "#B4DE9D",
  regDiourbel:    "#E6C79D",
  regLouga:       "#9DDEC2",
  regSaintLouis:  "#C9B8E6",
  regMatam:       "#E6DE9D",
  regTambacounda: "#9DD3DE",
  regKedougou:    "#E6AC9D",
  regFatick:      "#D2DE9D",
  regKaolack:     "#9DB0E6",
  regKaffrine:    "#E6B8D2",
  regKolda:       "#BEE6C2",
  regSedhiou:     "#E6D4B0",
  regZiguinchor:  "#A8DEDE",

  // ── Les huit pôles territoriaux ──
  // Pastels repris de la carte.
  poleDakar:        "#9DC3E6",
  poleThies:        "#9DD3DE",
  poleDiourbelLouga:"#9DDEC2",
  poleCentre:       "#B4DE9D",
  poleNord:         "#D2DE9D",
  poleNordEst:      "#E6DE9D",
  poleSud:          "#E6C79D",
  poleSudEst:       "#E6AC9D",

  // ── Grilles de graphes ──
  grille:       "#EFEFF1",

  // ── L'aplat des bandeaux de l'accueil ──
  // Une couleur unique, sans dégradé : le bleu APIX.
  aplatHero:       "#004f91",

  // ── Divers ──
  // Les deux états de la barre de navigation : posée sur la page, puis un cran
  // plus opaque une fois qu'on a fait défiler.
  verreBarre:   "rgba(255,255,255,0.88)",
  verreOpaque:  "rgba(255,255,255,0.96)",
};

// ── Triplets RGB ─────────────────────────────────────────────────────────────
// Le code compose partout des opacités variables d'une même teinte :
// `rgb(var(--bleu-rgb) / 0.08)`. Un triplet par teinte plutôt que trente jetons.
export const TRIPLETS = {
  bleu:     "0 79 145",
  bleuFixe: "0 79 145",
  orange:   "202 99 31",
  vert:     "24 128 56",
  violet:   "106 27 154",
  danger:   "220 38 38",
  alerte:   "180 83 9",
  cyan:     "8 145 178",
  // La surface haute en triplet : panneaux translucides (barre de recherche,
  // menus déroulants).
  carte:    "255 255 255",
  sarcelle: "14 116 144",
  indigo:   "67 56 202",
  olive:    "77 124 15",
  ambre:    "161 98 7",
  rose:     "190 24 93",
  or:       "184 134 11",
  // L'encre translucide : filets, pastilles neutres, voiles gris.
  encre:    "26 26 46",
  // Les ombres : un bleu d'encre très sombre, jamais un noir pur.
  ombre:    "20 23 42",
};

// Le gris translucide : le gris ardoise des pastilles neutres.
export const GRIS_ALPHA = "122 138 164";

/** Le nom CSS d'un jeton : carteDouce → --carte-douce */
export const nomCss = (jeton) => "--" + jeton.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
