// Vérifie les contrastes de la palette.
//
//   node outils/contrastes.mjs
//
// Calcule les rapports WCAG des paires qui portent réellement du texte et
// signale celles qui passent sous le seuil.
//
// Seuils retenus : 4,5:1 pour du texte courant, 3:1 pour du texte large et
// pour les éléments graphiques (traits, pastilles, bordures porteuses de sens).
import { JETONS } from "./palette.mjs";

const canal = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** Luminance relative d'un #RRGGBB, ou d'un « r g b ». */
function luminance(couleur) {
  let rvb;
  if (couleur.startsWith("#")) {
    const h = couleur.slice(1);
    const p = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    rvb = [0, 2, 4].map((i) => parseInt(p.slice(i, i + 2), 16));
  } else {
    rvb = couleur.trim().split(/[\s,]+/).map(Number);
  }
  const [r, g, b] = rvb.map((v) => canal(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const rapport = (a, b) => {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// [encre, fond, seuil, description]
const PAIRES = [
  // ── Textes sur les surfaces ──
  ["encre", "carte", 4.5, "titre sur carte"],
  ["encre", "fond", 4.5, "titre sur page"],
  ["encre", "carte-douce", 4.5, "titre sur carte secondaire"],
  ["encre", "champ", 4.5, "saisie dans un champ"],
  ["texte", "carte", 4.5, "texte courant sur carte"],
  ["texte", "fond", 4.5, "texte courant sur page"],
  ["gris-fort", "carte", 4.5, "texte secondaire sur carte"],
  ["gris", "carte", 4.5, "légende sur carte"],
  ["gris", "fond", 4.5, "légende sur page"],
  ["gris", "fond-creux", 4.5, "légende sur zone creuse"],

  // ── Accents en encre ──
  ["bleu", "carte", 4.5, "lien bleu sur carte"],
  ["bleu", "fond", 4.5, "lien bleu sur page"],
  ["orange", "carte", 4.5, "accent orange sur carte"],
  ["vert", "carte", 4.5, "succès sur carte"],
  ["violet", "carte", 4.5, "violet sur carte"],
  ["danger", "carte", 4.5, "erreur sur carte"],
  ["alerte", "carte", 4.5, "avertissement sur carte"],
  ["cyan", "carte", 4.5, "cyan sur carte"],
  ["sarcelle", "carte", 4.5, "sarcelle sur carte"],
  ["indigo", "carte", 4.5, "indigo sur carte"],
  ["olive", "carte", 4.5, "olive sur carte"],
  ["ambre", "carte", 4.5, "ambre sur carte"],
  ["rose", "carte", 4.5, "rose sur carte"],

  // ── Textes blancs sur les aplats ──
  ["sur-bleu", "bleu-action", 4.5, "libellé sur bouton bleu"],
  ["sur-bleu", "orange-action", 4.5, "libellé sur bouton orange"],
  ["sur-bleu", "vert-action", 4.5, "libellé sur aplat vert"],
  ["sur-bleu", "danger-action", 4.5, "libellé sur aplat rouge"],
  ["sur-bleu", "violet-action", 4.5, "libellé sur aplat violet"],
  ["bleu-fixe", "sur-bleu", 4.5, "libellé bleu sur pastille blanche"],
  // Les bandeaux bleus de l'accueil portent du texte et des boutons blancs.
  ["sur-bleu", "aplat-hero", 4.5, "texte et boutons des bandeaux de l'accueil"],

  // ── Séries de graphes : éléments graphiques ──
  ["emeraude", "carte", 3, "série émeraude"],
  ["prune", "carte", 3, "série prune"],
  ["azur", "carte", 3, "série azur"],
  ["framboise", "carte", 3, "série framboise"],
  ["or", "carte", 3, "série or"],
  ["bleuroi", "carte", 3, "série bleu roi"],

  // Les régions et les pôles ne figurent PAS ici. Ce sont des aplats de carte,
  // cernés d'un trait : ce qui doit se distinguer, c'est une région de sa
  // voisine — pas du fond de la page. Les mesurer contre la carte reviendrait à
  // exiger d'un pastel qu'il se comporte comme une encre.
];

const parNom = {};
for (const [nom, v] of Object.entries(JETONS)) {
  parNom[nom.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())] = v;
}

// ── Faiblesses HÉRITÉES ──────────────────────────────────────────────────────
// Ce sont les couleurs historiques du site, dont certaines n'ont jamais atteint
// le seuil AA. Les corriger changerait l'aspect de la plateforme, ce qui n'est
// pas l'objet de cet outil — mais les taire serait pire.
const HERITES = new Set([
  "gris/carte", "gris/fond", "gris/fond-creux",
  "orange/carte", "cyan/carte", "sur-bleu/orange-action",
]);

let echecs = 0, testes = 0, herites = 0;
for (const [a, b, seuil, quoi] of PAIRES) {
  const va = parNom[a], vb = parNom[b];
  if (!va || !vb) { console.log(`  ?? jeton inconnu : ${a} / ${b}`); echecs++; continue; }
  testes++;
  const r = rapport(va, vb);
  if (r >= seuil) continue;
  if (HERITES.has(`${a}/${b}`)) {
    console.log(`  · ${r.toFixed(2)}:1 (min ${seuil}) — ${quoi}  [hérité]`);
    herites++;
  } else {
    console.log(`  ✗ ${r.toFixed(2)}:1 (min ${seuil}) — ${quoi}  [${a} sur ${b}]`);
    echecs++;
  }
}

console.log(`\n${testes} paires vérifiées — ${echecs} en échec, ${herites} faiblesses héritées.`);
process.exit(echecs ? 1 : 0);
