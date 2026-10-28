// Écrit le bloc de variables de globals.css à partir de outils/palette.mjs.
//
//   node outils/genere-css.mjs
//
// Le bloc est délimité par deux marqueurs ; tout ce qui est en dehors est
// laissé intact. Relancer l'outil après toute retouche de la palette.
import { readFileSync, writeFileSync } from "node:fs";
import { JETONS, TRIPLETS, GRIS_ALPHA, nomCss } from "./palette.mjs";

const DEBUT = "/* @@ PALETTE — généré par outils/genere-css.mjs, ne pas éditer à la main @@ */";
const FIN = "/* @@ FIN PALETTE @@ */";

const ligne = (nom, valeur) => `  ${nom}: ${valeur};`;

const l = [];
for (const [jeton, v] of Object.entries(JETONS)) l.push(ligne(nomCss(jeton), v));
l.push("");
// nomCss et non le nom brut : sans quoi bleuFixe donnerait --bleuFixe-rgb,
// que personne n'écrirait à la main.
for (const [nom, v] of Object.entries(TRIPLETS)) l.push(ligne(`${nomCss(nom)}-rgb`, v));
l.push(ligne("--gris-rgb", GRIS_ALPHA));

const contenu = `${DEBUT}
/* La palette de la plateforme, en clair uniquement — même sur un appareil
   réglé en sombre. Source : outils/palette.mjs */
:root {
  color-scheme: light;
${l.join("\n")}
}
${FIN}`;

const chemin = new URL("../src/app/globals.css", import.meta.url);
const source = readFileSync(chemin, "utf8");

let sortie;
if (source.includes(DEBUT)) {
  const avant = source.slice(0, source.indexOf(DEBUT));
  const apres = source.slice(source.indexOf(FIN) + FIN.length);
  sortie = avant + contenu + apres;
} else {
  // Première pose : juste après l'import Tailwind, avant tout le reste.
  const ancre = '@import "tailwindcss";';
  sortie = source.replace(ancre, `${ancre}\n\n${contenu}\n`);
}
writeFileSync(chemin, sortie);
console.log(`globals.css : ${Object.keys(JETONS).length} jetons, ${Object.keys(TRIPLETS).length + 1} triplets`);
