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
// Le fond de page est un gris neutre très clair (#FAFAFA) ; les cartes et les
// tableaux restent blancs et s'en détachent par un filet, pas par une ombre.
// Les gris qui les accompagnent — filets, bordures, zones creuses, grilles de
// graphe — sont NEUTRES, de la même famille que le fond : les gris beiges
// d'avant viraient au jaune à côté d'un fond neutre et ternissaient le blanc
// des cartes.

// ── Les jetons ───────────────────────────────────────────────────────────────
export const JETONS = {
  // ── Surfaces, de la plus haute à la plus creuse ──
  carte:        "#FFFFFF",
  // La surface secondaire : ce qui est posé DANS une surface blanche — l'en-tête
  // d'un tableau, un bloc de fiche, une pastille, la piste d'une barre, le rond
  // d'un bouton de fermeture. Elle se lit « creusée » dans le blanc.
  //
  // UN CRAN SOUS LE FOND DE PAGE, et non plus du même gris. Elle partageait sa
  // valeur avec le fond quand celui-ci était #F5F7F9 ; le fond passé à #FAFAFA,
  // elle garde la sienne : au gris du fond, ces repères ne se seraient plus
  // détachés du blanc qui les porte (moitié moins de contraste).
  carteDouce:   "#F5F7F9",
  // Le fond de PAGE, sous les deux noms que le code lui donne : les pages le
  // posent sur leur conteneur (--champ pour les modules, --fond pour l'accueil,
  // l'administration et le corps du document). Les champs du design system
  // (.ds-champ), eux, sont blancs : c'est leur filet qui les dessine, comme une
  // carte. Un élément posé dans une carte ne prend jamais ces deux jetons, qui
  // le rendraient invisible : il prend --carte-douce.
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
  // Séries des graphes — palette catégorielle, dans un ordre FIXE
  // (lib/couleurs, PALETTE_COMPARAISON) : la couleur suit l'entité, jamais
  // son rang. Validée sur la carte blanche (skill dataviz,
  // validate_palette.js) : clarté OKLCH 0,43–0,77, chroma ≥ 0,10, paires
  // voisines à ΔE ≥ 10,2 en daltonisme simulé et ≥ 22,8 en vision normale.
  // Le jaune or remplace le violet en 4e couleur ; comme tout jaune lisible,
  // il reste sous 3:1 sur le blanc — la valeur écrite au bout de la courbe,
  // l'infobulle et le tableau de données prennent le relais. Le bleu de tête
  // est celui de la marque, éclairci d'un cheveu pour entrer dans la bande.
  //
  // ILS VIVENT ICI, et non plus seulement dans globals.css : ils avaient été
  // ajoutés à la main dans le bloc généré, et la génération suivante les
  // effaçait — toutes les courbes comparées perdaient leur couleur. Les clés
  // portent déjà leur tiret (« serie-1 ») : nomCss les écrit telles quelles.
  "serie-1":    "#05549a",
  "serie-2":    "#ca631f",
  "serie-3":    "#1b9e77",
  "serie-4":    "#dda90a",
  "serie-5":    "#3b4cc0",
  "serie-6":    "#d6336c",
  "serie-7":    "#2a8fb0",
  "serie-8":    "#7b3294",
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
