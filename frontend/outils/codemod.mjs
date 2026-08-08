// Convertit les couleurs littérales de src/ en jetons de la palette.
//
//   node outils/codemod.mjs --essai    (n'écrit rien, montre le bilan)
//   node outils/codemod.mjs            (écrit)
//
// ── Le problème ──────────────────────────────────────────────────────────────
// Un même hexadécimal ne veut pas dire la même chose selon la propriété qui le
// porte : `color: "#004f91"` est une encre, `background: "#004f91"` un aplat.
// La nuit, la première s'éclaircit et le second s'assombrit. Une substitution
// texte à texte, aveugle à ce contexte, produirait des boutons bleu clair
// portant du texte blanc.
//
// L'outil relève donc d'abord TOUTES les propriétés CSS du fichier avec leur
// position, puis, pour chaque couleur, retient la plus proche qui la précède.
// Les propriétés sont filtrées par liste blanche : sans quoi les deux-points
// d'un ternaire, d'une annotation de type ou d'une URL passeraient pour des
// déclarations.
//
// ── Ce qui n'est pas touché ──────────────────────────────────────────────────
// Les tableaux de couleurs (`["#004f91", "#ca631f", …]`) sont des palettes de
// séries, lues par d3 et par le canevas d'export. `var(--bleu)` n'y a aucun
// sens : une fonction JavaScript ne résout pas une variable CSS. Elles sont
// protégées ici et traitées ailleurs, par la table de traduction de nuit
// (lib/couleurs.ts), exactement comme dans l'application mobile.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { BASES_RGBA, DEGRADES, jetonPour, nomCss, traits } from "./palette.mjs";

const ESSAI = process.argv.includes("--essai");
const RACINE = new URL("../", import.meta.url).pathname;

// ── Les propriétés qui portent une couleur, et le rôle qu'elles lui donnent ──
const ROLES = {
  fond: ["background", "backgroundColor", "background-color", "backgroundImage", "background-image",
         "bg", "fond", "piste", "voile", "remplissage"],
  encre: ["color", "fill", "caretColor", "caret-color", "accentColor", "accent-color",
          "textDecorationColor", "text-decoration-color", "WebkitTextFillColor", "-webkit-text-fill-color",
          "c", "couleur", "teinte", "trait", "encre",
          // Clés des petites tables de couleurs du code (FORM_COLORS, COLORS,
          // ACCENT_*…) : elles nomment toutes des accents, jamais des aplats.
          "accent", "primary", "primaire", "success", "succes", "extra", "ton",
          "sec", "bra", "act", "ok", "erreur", "actif", "inactif"],
  bordure: ["border", "borderColor", "border-color", "borderTop", "border-top", "borderBottom",
            "border-bottom", "borderLeft", "border-left", "borderRight", "border-right",
            "borderTopColor", "borderBottomColor", "borderLeftColor", "borderRightColor",
            "border-top-color", "border-bottom-color", "border-left-color", "border-right-color",
            "borderBlock", "borderInline", "outline", "outlineColor", "outline-color",
            // Un trait SVG est une bordure, pas une encre : c'est l'échelle
            // des filets qui lui convient, non celle des textes.
            "stroke", "stop-color",
            "borderStyle", "bord", "bordure", "scrollbarColor", "scrollbar-color"],
  // Une ombre n'est ni une encre ni un fond : elle prend le triplet d'ombre,
  // qui vire au noir la nuit.
  ombre: ["boxShadow", "box-shadow", "textShadow", "text-shadow", "filter", "dropShadow"],
};
const PROP_ROLE = {};
for (const [role, props] of Object.entries(ROLES)) for (const p of props) PROP_ROLE[p] = role;

// Trois écritures nomment le rôle de la couleur qui suit, et il faut les
// reconnaître toutes : `fond: "#fff"` dans un objet de style, `couleur="#fff"`
// en attribut JSX, et `cible.style.background = "#fff"` dans un gestionnaire
// de survol — cette dernière étant de loin la plus fréquente ici (une centaine
// de points), d'où le point dans la classe de caractères qui précède.
const RE_PROP = /(^|[\s,;{("'`?:&|.])([A-Za-z][A-Za-z0-9-]*)\s*[:=]/g;

// d3 pose ses couleurs en attributs de présentation SVG — et ceux-ci
// n'acceptent PAS var() : aucun navigateur ne résout une variable CSS dans un
// `fill="…"`. Les mêmes valeurs posées en style inline, elles, la résolvent.
// La bascule y devient alors gratuite : le graphe se recolore sans être
// redessiné, puisque c'est le moteur CSS qui tranche.
const RE_ATTR_SVG = /\.attr\((\s*"(?:fill|stroke|stop-color)"\s*,\s*)("#[0-9a-fA-F]{3,8}"|"rgba?\([^)]*\)")\)/g;

// Une fois passées en `.style("fill", …)`, ces couleurs ne sont plus précédées
// d'une DÉCLARATION mais d'un ARGUMENT : le nom de la propriété est une chaîne.
// Sans cette seconde forme, la pré-passe déplaçait les couleurs sans que la
// conversion sache ensuite les lire.
const RE_PROP_ARG = /["']([A-Za-z][A-Za-z0-9-]*)["']\s*,/g;
const RE_COULEUR = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/g;
// Une suite d'au moins deux couleurs entre crochets : une palette de séries.
const RE_PALETTE = /\[\s*"#[0-9a-fA-F]{3,8}"(?:\s*,\s*"#[0-9a-fA-F]{3,8}")+\s*,?\s*\]/g;

/** Les intervalles [début, fin) à ne pas toucher. */
function zonesProtegees(texte) {
  const zones = [];
  for (const m of texte.matchAll(RE_PALETTE)) zones.push([m.index, m.index + m[0].length]);
  return zones;
}
const dansZone = (zones, i) => zones.some(([a, b]) => i >= a && i < b);

/** Les propriétés CSS du fichier, position → rôle. */
function proprietes(texte) {
  const liste = [];
  for (const m of texte.matchAll(RE_PROP)) {
    const role = PROP_ROLE[m[2]];
    if (role) liste.push({ fin: m.index + m[0].length, role });
  }
  for (const m of texte.matchAll(RE_PROP_ARG)) {
    const role = PROP_ROLE[m[1]];
    if (role) liste.push({ fin: m.index + m[0].length, role });
  }
  return liste.sort((a, b) => a.fin - b.fin);
}

/** Le rôle qui gouverne la couleur trouvée en `i`, ou null si indécidable. */
function roleEn(props, i) {
  let candidat = null;
  for (const p of props) {
    if (p.fin > i) break;
    candidat = p;
  }
  // Au-delà de 300 caractères, le lien avec la propriété n'est plus crédible :
  // on préfère ne rien faire que se tromper.
  if (!candidat || i - candidat.fin > 300) return null;
  return candidat.role;
}

const alphaDe = (octet) => Math.round((parseInt(octet, 16) / 255) * 100) / 100;

/** Le remplacement d'une couleur, ou null pour la laisser telle quelle. */
function remplacer(couleur, role) {
  // ── rgb / rgba : la teinte devient un triplet, l'opacité est conservée ──
  const rgb = couleur.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (rgb) {
    const [, r, g, b, a] = rgb;
    // Le blanc translucide est laissé intact : il habille les boutons de verre
    // du bandeau de hero, qui est sombre dans les DEUX schémas. Le basculer
    // les rendrait invisibles.
    if (r === "255" && g === "255" && b === "255") return null;
    const base = BASES_RGBA[`${r},${g},${b}`];
    if (!base) return null;
    const nom = role === "ombre" ? "ombre" : base;
    return a === undefined ? `rgb(var(--${nom}-rgb))` : `rgb(var(--${nom}-rgb) / ${a})`;
  }

  // Une ombre écrite en hexadécimal : elle doit suivre le triplet d'ombre et
  // non l'échelle des encres, qui la retournerait en halo blanc. Réservé aux
  // couleurs sombres — une valeur claire sous `filter` ou `boxShadow` est
  // autre chose (un halo coloré, une bordure de contour) et se classe
  // normalement.
  if (role === "ombre" && traits(couleur).clarte < 0.5) return "rgb(var(--ombre-rgb) / 1)";

  // ── hexadécimal à huit chiffres : la couleur porte son alpha ──
  const h8 = couleur.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/);
  if (h8) {
    const jeton = jetonPour(`#${h8[1]}`, role);
    const base = { bleu: "bleu", bleuAction: "bleu", orange: "orange", orangeAction: "orange",
                   vert: "vert", vertAction: "vert", violet: "violet", violetAction: "violet",
                   danger: "danger", dangerAction: "danger", alerte: "alerte", cyan: "cyan" }[jeton];
    return base ? `rgb(var(--${base}-rgb) / ${alphaDe(h8[2])})` : null;
  }

  const jeton = jetonPour(couleur, role);
  return jeton ? `var(${nomCss(jeton)})` : null;
}

// ── Passe ──────────────────────────────────────────────────────────────────
const fichiers = execSync(
  "grep -rlE '#[0-9a-fA-F]{3,8}\\b|rgba?\\(' src/ --include='*.tsx' --include='*.ts' | sort",
  { cwd: RACINE, shell: "/bin/bash" },
).toString().trim().split("\n");

// Traités à la main : ce sont des identités lues par JavaScript, pas des
// habillages de surface.
const EXCLUS = new Set(["src/lib/couleurs.ts", "src/components/ui/jetons.ts"]);

let convertis = 0, ignores = 0, degrades = 0, attributs = 0;
const nonResolus = new Map();

for (const rel of fichiers) {
  if (EXCLUS.has(rel)) continue;
  const chemin = RACINE + rel;
  let texte = readFileSync(chemin, "utf8");
  const avant = texte;

  // 1. Les attributs de présentation SVG posés par d3 deviennent des styles
  //    inline, seuls capables de résoudre une variable CSS.
  texte = texte.replace(RE_ATTR_SVG, (_, tete, valeur) => { attributs++; return `.style(${tete}${valeur})`; });

  // 2. Les dégradés connus, remplacés en entier — ils sont répétés mot pour
  //    mot sur plusieurs écrans et deviennent un jeton unique.
  for (const [nom, v] of Object.entries(DEGRADES)) {
    const cible = `var(${nomCss(nom)})`;
    while (texte.includes(v.clair)) { texte = texte.replace(v.clair, cible); degrades++; }
  }

  // 3. Les couleurs, une à une, selon la propriété qui les gouverne.
  const zones = zonesProtegees(texte);
  const props = proprietes(texte);
  let sortie = "", curseur = 0;
  for (const m of texte.matchAll(RE_COULEUR)) {
    const i = m.index;
    sortie += texte.slice(curseur, i);
    curseur = i + m[0].length;
    if (dansZone(zones, i)) { sortie += m[0]; ignores++; continue; }
    const role = roleEn(props, i);
    const nouveau = role ? remplacer(m[0], role) : null;
    if (nouveau) { sortie += nouveau; convertis++; }
    else {
      sortie += m[0];
      ignores++;
      const cle = `${role || "(sans propriété)"}  ${m[0]}`;
      nonResolus.set(cle, (nonResolus.get(cle) || 0) + 1);
    }
  }
  sortie += texte.slice(curseur);

  if (sortie !== avant && !ESSAI) writeFileSync(chemin, sortie);
}

console.log(`${attributs} attributs SVG passés en style, ${degrades} dégradés, ${convertis} couleurs converties, ${ignores} laissées`);
if (nonResolus.size) {
  console.log("\nLaissées en place (à revoir) :");
  [...nonResolus.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)
    .forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));
}
if (ESSAI) console.log("\n(essai — rien n'a été écrit)");
