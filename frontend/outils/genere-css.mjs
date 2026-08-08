// Écrit le bloc de variables de globals.css à partir de outils/palette.mjs.
//
//   node outils/genere-css.mjs
//
// Le bloc est délimité par deux marqueurs ; tout ce qui est en dehors est
// laissé intact. Relancer l'outil après toute retouche de la palette.
import { readFileSync, writeFileSync } from "node:fs";
import { JETONS, TRIPLETS, DEGRADES, GRIS_ALPHA, nomCss } from "./palette.mjs";

const DEBUT = "/* @@ PALETTE — généré par outils/genere-css.mjs, ne pas éditer à la main @@ */";
const FIN = "/* @@ FIN PALETTE @@ */";

const ligne = (nom, valeur) => `  ${nom}: ${valeur};`;

function bloc(schema) {
  const l = [];
  for (const [jeton, v] of Object.entries(JETONS)) l.push(ligne(nomCss(jeton), v[schema]));
  l.push("");
  // nomCss et non le nom brut : sans quoi bleuFixe donnerait --bleuFixe-rgb,
  // que personne n'écrirait à la main.
  for (const [nom, v] of Object.entries(TRIPLETS)) l.push(ligne(`${nomCss(nom)}-rgb`, v[schema]));
  l.push(ligne("--gris-rgb", GRIS_ALPHA));
  l.push("");
  for (const [nom, v] of Object.entries(DEGRADES)) l.push(ligne(nomCss(nom), v[schema]));
  return l.join("\n");
}

const contenu = `${DEBUT}
/* Les deux schémas de la plateforme. Le mode clair reprend les valeurs
   historiques du site ; le mode sombre celles de l'application mobile, pour
   que les deux surfaces montrent les mêmes couleurs.
   Source : outils/palette.mjs */
:root {
  color-scheme: light;
${bloc("clair")}
}

/* Sans choix explicite de l'utilisateur, on suit le système. Le sélecteur
   exclut [data-theme="light"] pour qu'un utilisateur ayant explicitement
   demandé le mode clair sur une machine réglée en sombre l'obtienne bien. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
${bloc("sombre").split("\n").map((l) => (l ? "  " + l : l)).join("\n")}
  }
}

/* Choix explicite — l'emporte sur la préférence système dans les deux sens. */
:root[data-theme="dark"] {
  color-scheme: dark;
${bloc("sombre")}
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
console.log(`globals.css : ${Object.keys(JETONS).length} jetons, ${Object.keys(TRIPLETS).length + 1} triplets, ${Object.keys(DEGRADES).length} dégradés`);
