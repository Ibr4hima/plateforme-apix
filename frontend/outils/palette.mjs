// La palette de la plateforme, dans ses deux schémas — source unique.
//
// Ce fichier n'est pas expédié au navigateur : c'est de l'outillage. Il produit
// les variables CSS de globals.css (genere-css.mjs) et pilote la conversion des
// littéraux de couleur du code en jetons (codemod.mjs).
//
// ── Pourquoi une table, et pas une inversion ─────────────────────────────────
// Un mode sombre correct n'est pas l'image inversée du mode clair. Les fonds
// descendent vers un bleu de minuit, mais les accents doivent au contraire
// MONTER en luminosité pour rester lisibles dessus : le #004f91 de la maison,
// très bien sur blanc, disparaît purement et simplement sur du #0B1220.
//
// Les valeurs de nuit sont celles de l'application mobile (mobile/src/theme.ts
// et mobile/src/lib/couleurs.ts) : les deux surfaces montrent le même produit,
// elles doivent montrer les mêmes couleurs.
//
// ── Le rôle décide du jeton ──────────────────────────────────────────────────
// Un même hexadécimal ne joue pas toujours le même rôle. #004f91 est tantôt
// une encre (un titre, une icône), tantôt un aplat plein (un bouton, une chip
// active) — et ces deux emplois ne se traduisent pas pareil la nuit : l'encre
// s'éclaircit (#85B9EC), l'aplat s'assombrit (#2E64A6) pour continuer à porter
// du texte blanc. La conversion lit donc la propriété CSS qui précède la
// couleur et choisit le jeton en conséquence.

// ── Les jetons ───────────────────────────────────────────────────────────────
// `clair` reprend les valeurs actuelles du site ; `sombre` leur équivalent de
// nuit.
export const JETONS = {
  // ── Surfaces, de la plus haute à la plus creuse ──
  carte:        { clair: "#FFFFFF", sombre: "#151E2E" },
  carteDouce:   { clair: "#FAFAF9", sombre: "#1B2536" },
  champ:        { clair: "#F8F7F6", sombre: "#101927" },
  fond:         { clair: "#F6F5F3", sombre: "#0B1220" },
  fondCreux:    { clair: "#F2F0EF", sombre: "#0E1626" },
  fondCreux2:   { clair: "#E8E5E3", sombre: "#16202F" },

  // ── Bordures ──
  // De jour, les gris beiges actuels. De nuit, des gris ALPHA : ils se
  // composent avec la surface qu'ils bordent et tiennent donc aussi bien sur
  // une carte (#151E2E) que sur le fond de page (#0B1220), là où une valeur
  // pleine aurait dû être différente pour chacune.
  filet:        { clair: "#F2F0EF", sombre: "rgba(122,138,164,0.10)" },
  bordure:      { clair: "#ECEAE7", sombre: "rgba(122,138,164,0.17)" },
  bordureForte: { clair: "#C5BFBB", sombre: "rgba(122,138,164,0.32)" },

  // ── Encres ──
  encre:        { clair: "#1a1a2e", sombre: "#EDF1F7" },
  texte:        { clair: "#4a5568", sombre: "#B9C2CF" },
  grisFort:     { clair: "#6b7280", sombre: "#9AA7B8" },
  gris:         { clair: "#9aa5b4", sombre: "#8D9AAC" },
  // Posé sur un aplat de marque : blanc dans les deux schémas — les aplats de
  // nuit (bleuAction, orangeAction…) sont choisis pour le porter.
  surBleu:      { clair: "#FFFFFF", sombre: "#FFFFFF" },
  // Le pendant du précédent : l'encre de ce qui est posé sur une surface
  // blanche PAR CONSTRUCTION — la pastille active d'un segment de bandeau,
  // par exemple, qui reste blanche la nuit puisque le bandeau reste sombre.
  // Elle ne bascule donc pas non plus : un bleu clair sur ce blanc-là serait
  // illisible.
  bleuFixe:     { clair: "#004f91", sombre: "#004f91" },

  // ── Marque ──
  // Deux jetons par teinte : l'ENCRE monte en luminosité la nuit, l'APLAT
  // descend — un aplat clair ne peut pas porter de texte blanc.
  bleu:         { clair: "#004f91", sombre: "#85B9EC" },
  bleuAction:   { clair: "#004f91", sombre: "#2E64A6" },
  bleuNuit:     { clair: "#003a6e", sombre: "#16213A" },
  bleuClair:    { clair: "#1a6ab0", sombre: "#22406A" },
  bleuProfond:  { clair: "#002a52", sombre: "#101A2C" },
  bleuVoile:    { clair: "#EEF1F6", sombre: "rgba(133,185,236,0.10)" },

  orange:       { clair: "#ca631f", sombre: "#FFA45C" },
  orangeAction: { clair: "#ca631f", sombre: "#B35A18" },
  orangeFonce:  { clair: "#a84e18", sombre: "#8A4212" },
  orangeProfond:{ clair: "#4d2206", sombre: "#2A1A0C" },
  orangeVoile:  { clair: "#FFF6EF", sombre: "rgba(255,164,92,0.11)" },

  // Le vert quitte le vert la nuit : sur un fond de minuit bleuté, un vert
  // franc jure, là où le teal appartient à la même famille froide que le bleu
  // de la maison. Même choix que l'application.
  vert:         { clair: "#188038", sombre: "#48C9B0" },
  vertAction:   { clair: "#188038", sombre: "#1F6F5F" },
  vertFonce:    { clair: "#0d652d", sombre: "#14513F" },
  vertVoile:    { clair: "#EDFBF1", sombre: "rgba(72,201,176,0.11)" },

  violet:       { clair: "#6A1B9A", sombre: "#C79BEB" },
  violetAction: { clair: "#6A1B9A", sombre: "#5B3A86" },
  violetVoile:  { clair: "#F3EDFA", sombre: "rgba(199,155,235,0.11)" },

  danger:       { clair: "#dc2626", sombre: "#F08A8A" },
  dangerAction: { clair: "#dc2626", sombre: "#A83232" },
  dangerFonce:  { clair: "#991b1b", sombre: "#7A2A2A" },
  dangerVoile:  { clair: "#FFF2F2", sombre: "rgba(240,138,138,0.11)" },

  alerte:       { clair: "#b45309", sombre: "#E0A458" },
  alerteAction: { clair: "#b45309", sombre: "#8A5A1A" },
  alerteVoile:  { clair: "#FFF9F0", sombre: "rgba(224,164,88,0.11)" },

  cyan:         { clair: "#0891b2", sombre: "#5FC7DE" },
  cyanFonce:    { clair: "#0e7490", sombre: "#2A6A5E" },
  rose:         { clair: "#be185d", sombre: "#EE8AB0" },
  roseVoile:    { clair: "#FCE7F3", sombre: "rgba(238,138,176,0.11)" },

  // ── Grilles de graphes ──
  grille:       { clair: "#F0EEEB", sombre: "#243044" },
  grilleZero:   { clair: "#DDD9D4", sombre: "#33415A" },

  // ── Divers ──
  // Le pouce d'un curseur doit se détacher de sa piste : blanc le jour, blanc
  // bleuté la nuit — surtout pas la couleur des cartes, qui le ferait
  // disparaître dans le fond.
  pouce:        { clair: "#FFFFFF", sombre: "#DCE6F3" },

  // Le verre des barres et des menus flottants. De jour un voile blanc ; de
  // nuit un voile de CARTE — un blanc translucide posé sur du minuit vire au
  // gris laiteux et mange le flou au lieu de le porter.
  verre:        { clair: "rgba(255,255,255,0.65)", sombre: "rgba(21,30,46,0.72)" },
  verreFort:    { clair: "rgba(242,240,239,0.92)", sombre: "rgba(11,18,32,0.92)" },
  // Les deux états de la barre de navigation : posée sur la page, puis un cran
  // plus opaque une fois qu'on a fait défiler.
  verreBarre:   { clair: "rgba(255,255,255,0.88)", sombre: "rgba(13,21,36,0.86)" },
  verreOpaque:  { clair: "rgba(255,255,255,0.96)", sombre: "rgba(13,21,36,0.96)" },

  // L'opacité des deux niveaux d'ombre. Elle monte la nuit : une ombre portée
  // à 8 % est invisible sur une surface déjà sombre, alors qu'elle suffit
  // largement à détacher une carte blanche d'un fond ivoire.
  ombreA1:      { clair: "0.08", sombre: "0.34" },
  ombreA2:      { clair: "0.16", sombre: "0.52" },
};

// ── Triplets RGB ─────────────────────────────────────────────────────────────
// Le code compose partout des `rgba(0,79,145,0.08)` : une même teinte à trente
// opacités différentes. Plutôt que trente jetons, un triplet par teinte, que la
// conversion réinjecte en `rgb(var(--bleu-rgb) / 0.08)`. L'opacité d'origine
// est préservée telle quelle, et la teinte suit le schéma.
export const TRIPLETS = {
  bleu:   { clair: "0 79 145",   sombre: "133 185 236" },
  bleuFixe: { clair: "0 79 145", sombre: "0 79 145" },
  orange: { clair: "202 99 31",  sombre: "255 164 92" },
  vert:   { clair: "24 128 56",  sombre: "72 201 176" },
  violet: { clair: "106 27 154", sombre: "199 155 235" },
  danger: { clair: "220 38 38",  sombre: "240 138 138" },
  alerte: { clair: "180 83 9",   sombre: "224 164 88" },
  cyan:   { clair: "8 145 178",  sombre: "95 199 222" },
  // La surface haute en triplet : sert aux panneaux translucides (barre de
  // recherche, menus déroulants), qui étaient écrits en blanc translucide et
  // seraient donc restés blancs la nuit.
  carte:  { clair: "255 255 255", sombre: "21 30 46" },
  // L'encre translucide : filets, pastilles neutres, voiles gris.
  encre:  { clair: "26 26 46",   sombre: "237 241 247" },
  // Les ombres. De jour un bleu d'encre très sombre ; de nuit le noir pur —
  // sur une surface déjà sombre, une ombre teintée se voit moins bien qu'une
  // ombre franche.
  ombre:  { clair: "0 30 60",    sombre: "0 0 0" },
};

// Les bases rgba() rencontrées dans le code, rattachées à leur triplet.
export const BASES_RGBA = {
  "0,79,145": "bleu", "0,60,112": "bleu", "15,82,186": "bleu", "26,106,176": "bleu",
  "202,99,31": "orange", "227,83,54": "orange", "183,65,14": "orange", "226,143,70": "orange",
  "74,40,12": "orange", "251,188,4": "alerte", "161,98,7": "alerte", "180,83,9": "alerte",
  "24,128,56": "vert", "21,128,61": "vert", "13,101,45": "vert", "5,150,105": "vert",
  "106,27,154": "violet", "124,58,237": "violet", "107,79,161": "violet",
  "220,38,38": "danger", "185,28,28": "danger",
  "16,26,46": "encre", "26,26,46": "encre", "15,40,80": "encre", "2,20,38": "encre",
  "0,20,45": "encre", "0,30,60": "encre", "20,22,28": "encre", "43,32,24": "encre",
  "0,0,0": "ombre",
  "154,165,180": "gris", "156,163,175": "gris", "100,116,139": "gris", "107,114,128": "gris",
};
// Le gris translucide n'a pas de triplet propre : il vaut pour les deux
// schémas (il se compose avec la surface). On le fige sur le gris ardoise de
// l'application.
export const GRIS_ALPHA = "122 138 164";

// ── Dégradés ─────────────────────────────────────────────────────────────────
// Le bandeau de hero est répété mot pour mot sur sept écrans ; il devient un
// jeton unique. De nuit il prend exactement le dégradé de l'app mobile
// (#16213A → #22406A) : une marche d'élévation au-dessus des cartes, la
// couleur restant au contenu.
export const DEGRADES = {
  degradeHero: {
    clair: "linear-gradient(155deg,#002a52 0%,#003a6e 35%,#004f91 70%,#1a6ab0 100%)",
    sombre: "linear-gradient(155deg,#16213A 0%,#1A2A46 35%,#1E3459 70%,#22406A 100%)",
  },
  degradeHeroOrange: {
    clair: "linear-gradient(155deg,#4d2206 0%,#8a400f 35%,#ca631f 70%,#e28f46 100%)",
    sombre: "linear-gradient(155deg,#2A1A0C 0%,#43260F 35%,#6B3D18 70%,#8A5426 100%)",
  },
  degradeFilet: {
    clair: "linear-gradient(90deg,#002a52 0%,#004f91 55%,#1a6ab0 100%)",
    sombre: "linear-gradient(90deg,#16213A 0%,#1E3459 55%,#22406A 100%)",
  },
  degradeBleu: {
    clair: "linear-gradient(135deg, #004f91 0%, #003a6e 100%)",
    sombre: "linear-gradient(135deg, #22406A 0%, #16213A 100%)",
  },
  degradeOrange: {
    clair: "linear-gradient(135deg, #ca631f 0%, #a84e18 100%)",
    sombre: "linear-gradient(135deg, #B35A18 0%, #8A4212 100%)",
  },
  degradePastille: {
    clair: "linear-gradient(135deg,#004f91,#1a6ab0)",
    sombre: "linear-gradient(135deg,#22406A,#2E64A6)",
  },
  degradeChat: {
    clair: "linear-gradient(155deg,#8a4212 0%,#a85117 38%,#ca631f 72%,#e0803c 100%)",
    sombre: "linear-gradient(155deg,#2A1A0C 0%,#43260F 38%,#6B3D18 72%,#8A5426 100%)",
  },
};

// ── Classement d'un hexadécimal ──────────────────────────────────────────────
// Le code contient 202 hexadécimaux distincts, dont une longue traîne de gris
// beiges quasi identiques (#F7F6F5, #F8F7F6, #F6F5F4…, à ΔE < 1 les uns des
// autres) : de la dérive accumulée, pas des intentions. Plutôt que 202 jetons,
// on les ramène à l'échelle ci-dessus, par teinte et par clarté. Le rendu de
// jour ne bouge pas à l'œil, et le design system redevient tenable.

const versRvb = (hex) => {
  const h = hex.replace("#", "");
  const p = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(p.slice(i, i + 2), 16));
};

/**
 * Clarté (0 → 1), teinte (0 → 360) et CHROMA (0 → 255) d'une couleur.
 *
 * Le chroma — l'écart brut entre la composante la plus forte et la plus
 * faible — et non la saturation HSL : celle-ci explose près du blanc, où elle
 * n'a plus de sens perceptif. Elle donne 0,25 à #FCFBFA, un blanc cassé que
 * l'œil lit comme parfaitement neutre, et le rangeait parmi les oranges.
 */
export function traits(hex) {
  const rvb = versRvb(hex);
  const [r, g, b] = rvb.map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let t = 0;
  if (d !== 0) {
    if (max === r) t = ((g - b) / d) % 6;
    else if (max === g) t = (b - r) / d + 2;
    else t = (r - g) / d + 4;
  }
  return {
    teinte: (t * 60 + 360) % 360,
    chroma: Math.max(...rvb) - Math.min(...rvb),
    clarte: (max + min) / 2,
  };
}

/**
 * La couleur est-elle un neutre de l'échelle de gris ?
 *
 * Le seuil dépend de la clarté : près du blanc, trois points d'écart suffisent
 * à teinter, alors qu'un gris moyen en supporte quarante sans cesser d'être
 * gris. Et la palette CLAIRE de la plateforme est faite de beiges chauds —
 * #F8F7F6, #EDEAE6, #E8E5E3 : à ces clartés, une légère dérive vers l'ambre
 * est la neutralité de la maison, pas une intention d'orange.
 */
function estNeutre({ teinte, chroma, clarte }) {
  const seuil = clarte >= 0.9 ? 6 : clarte >= 0.75 ? 18 : 45;
  if (chroma < seuil) return true;
  const beigeMaison = clarte >= 0.86 && teinte >= 15 && teinte <= 70 && chroma < 14;
  return beigeMaison;
}

// Les familles de teinte, par plage d'angle.
const FAMILLES = [
  { max: 16,  nom: "danger" },
  { max: 45,  nom: "orange" },
  { max: 68,  nom: "alerte" },
  { max: 100, nom: "vertOlive" },
  { max: 165, nom: "vert" },
  { max: 190, nom: "cyan" },
  { max: 255, nom: "bleu" },
  { max: 290, nom: "violet" },
  { max: 335, nom: "rose" },
  { max: 361, nom: "danger" },
];
const famille = (t) => FAMILLES.find((f) => t < f.max).nom;

// Quelques valeurs canoniques échappent au classement automatique : elles
// portent une intention précise et doivent tomber sur un jeton nommé.
const EXPLICITES = {
  "#004f91": { encre: "bleu", fond: "bleuAction", bordure: "bleu" },
  "#003a6e": { encre: "bleuNuit", fond: "bleuNuit", bordure: "bleuNuit" },
  "#002a52": { encre: "bleuProfond", fond: "bleuProfond", bordure: "bleuProfond" },
  "#1a6ab0": { encre: "bleuClair", fond: "bleuClair", bordure: "bleuClair" },
  "#ca631f": { encre: "orange", fond: "orangeAction", bordure: "orange" },
  "#a84e18": { encre: "orangeFonce", fond: "orangeFonce", bordure: "orangeFonce" },
  "#188038": { encre: "vert", fond: "vertAction", bordure: "vert" },
  "#6a1b9a": { encre: "violet", fond: "violetAction", bordure: "violet" },
  "#dc2626": { encre: "danger", fond: "dangerAction", bordure: "danger" },
  "#b45309": { encre: "alerte", fond: "alerteAction", bordure: "alerte" },
  "#0891b2": { encre: "cyan", fond: "cyan", bordure: "cyan" },
  "#be185d": { encre: "rose", fond: "rose", bordure: "rose" },
  "#ffffff": { encre: "surBleu", fond: "carte", bordure: "carte" },
  "#fff":    { encre: "surBleu", fond: "carte", bordure: "carte" },
  "#1a1a2e": { encre: "encre", fond: "encre", bordure: "encre" },
  "#4a5568": { encre: "texte", fond: "texte", bordure: "texte" },
  "#9aa5b4": { encre: "gris", fond: "gris", bordure: "bordureForte" },
  "#6b7280": { encre: "grisFort", fond: "grisFort", bordure: "bordureForte" },
  "#c5bfbb": { encre: "gris", fond: "fondCreux2", bordure: "bordureForte" },
  "#ebebeb": { encre: "gris", fond: "fondCreux", bordure: "grille" },
};

// Échelles des neutres, du plus clair au plus sombre. Le premier seuil dont la
// clarté est supérieure ou égale à celle de la couleur l'emporte.
const NEUTRES_FOND    = [[0.985, "carte"], [0.968, "carteDouce"], [0.952, "champ"],
                         [0.940, "fond"], [0.920, "fondCreux"], [0.860, "fondCreux2"],
                         [0.62, "bordureForte"], [0.40, "gris"], [0.26, "texte"], [0, "encre"]];
const NEUTRES_BORDURE = [[0.955, "filet"], [0.900, "bordure"], [0.70, "bordureForte"],
                         [0.45, "gris"], [0.26, "texte"], [0, "encre"]];
// Une encre presque blanche est posée sur un aplat de marque — un bandeau de
// hero, un bouton plein — et ces aplats sont sombres dans LES DEUX schémas.
// Elle doit donc rester blanche : la faire basculer la retournerait en encre
// foncée sur fond foncé.
const NEUTRES_ENCRE   = [[0.85, "surBleu"], [0.72, "bordureForte"], [0.56, "gris"],
                         [0.42, "grisFort"], [0.28, "texte"], [0, "encre"]];
const parEchelle = (echelle, clarte) => (echelle.find(([seuil]) => clarte >= seuil) || echelle.at(-1))[1];

/**
 * Le jeton qui remplace un hexadécimal, pour un rôle donné.
 * @param {string} hex  la couleur telle qu'écrite dans le code
 * @param {"fond"|"encre"|"bordure"} role  déduit de la propriété CSS
 * @returns {string} le nom du jeton (clé de JETONS)
 */
export function jetonPour(hex, role) {
  const cle = hex.toLowerCase();
  if (EXPLICITES[cle]) return EXPLICITES[cle][role];

  const t = traits(cle);
  const { teinte, clarte } = t;

  // Neutre : l'échelle de gris, choisie selon le rôle.
  if (estNeutre(t)) {
    if (role === "fond") return parEchelle(NEUTRES_FOND, clarte);
    if (role === "bordure") return parEchelle(NEUTRES_BORDURE, clarte);
    return parEchelle(NEUTRES_ENCRE, clarte);
  }

  const f = famille(teinte);
  // Les olives et les jaunes verts rejoignent l'ambre : la nuit, un olive pur
  // vire au kaki et se confond avec le fond.
  const base = f === "vertOlive" ? "alerte" : f;

  // Très clair : c'est un voile, pas un accent — le fond pâle d'un bloc
  // d'information ou d'un badge. La nuit, il devient la même teinte en
  // translucide, posée sur la surface qui le porte.
  if (clarte >= 0.79) return `${base}Voile`;
  // Très sombre : une borne basse de dégradé ou une encre de marque.
  if (clarte <= 0.30) {
    const profond = { bleu: "bleuProfond", orange: "orangeProfond", vert: "vertFonce",
                      danger: "dangerFonce", violet: "violetAction", alerte: "alerteAction",
                      cyan: "cyanFonce", rose: "rose" }[base];
    return profond || "encre";
  }
  // Cas courant : l'accent. Encre ou aplat selon le rôle.
  if (role === "fond") {
    const aplat = { bleu: "bleuAction", orange: "orangeAction", vert: "vertAction",
                    danger: "dangerAction", violet: "violetAction", alerte: "alerteAction",
                    cyan: "cyan", rose: "rose" }[base];
    return aplat || base;
  }
  return base;
}

/** Le nom CSS d'un jeton : carteDouce → --carte-douce */
export const nomCss = (jeton) => "--" + jeton.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
