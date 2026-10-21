// Les noms de pays dans une phrase — « du Sénégal », « de la France »,
// « de l'Inde », « des États-Unis », « de Madagascar ».
//
// LA FICHE PAYS COMPOSE DES PHRASES avec les noms qu'elle compare : « soit
// 8 % des importations du Sénégal », « en faveur de la France ». Sans
// l'article, elle écrivait « des importations de Sénégal ». Le genre se lit
// sur le PREMIER MOT du nom — « Corée du Sud » est féminin comme « Corée »,
// « Burkina Faso » masculin comme « Burkina » —, un mot en « e » étant
// féminin, à la courte liste des exceptions de l'usage près. Les pluriels et
// les pays sans article (des îles, des cités-États) sont nommés.

/** Les pays qui se disent sans article : « de Madagascar », « à Cuba ». */
const SANS_ARTICLE = new Set([
  "Madagascar", "Cuba", "Haïti", "Singapour", "Malte", "Chypre", "Maurice", "Monaco", "Bahreïn",
  "Israël", "Oman", "Djibouti", "Nauru", "Tuvalu", "Kiribati", "Vanuatu", "Samoa", "Tonga",
  "Sao Tomé-et-Principe", "Sainte-Lucie", "Saint-Marin", "Saint-Kitts-et-Nevis",
  "Saint-Vincent-et-les-Grenadines", "Trinité-et-Tobago", "Antigua-et-Barbuda",
  "Taïwan", "Hong Kong", "Macao", "Porto Rico",
]);

/** Les pluriels : « des États-Unis », « aux Émirats arabes unis ». */
const PLURIEL = new Set([
  "États-Unis", "Émirats arabes unis", "Pays-Bas", "Philippines", "Comores", "Seychelles",
  "Maldives", "Bahamas", "Fidji", "Palaos", "Îles Marshall", "Îles Salomon",
]);

/** Les premiers mots en « e » qui sont masculins — et l'inverse. */
const MASCULIN_EN_E = new Set(["Mexique", "Cambodge", "Mozambique", "Zimbabwe", "Belize", "Suriname", "Royaume"]);
const FEMININ = new Set(["Sierra"]);

type Forme = "sans" | "pluriel" | "voyelle" | "feminin" | "masculin";

function forme(nom: string): Forme {
  if (SANS_ARTICLE.has(nom)) return "sans";
  if (PLURIEL.has(nom)) return "pluriel";
  // Le h de Hongrie ou du Honduras est aspiré : pas d'élision
  if (/^[aeiouyàâéèêëîïôöûü]/i.test(nom)) return "voyelle";
  const premier = nom.split(/[\s-]/)[0];
  if (FEMININ.has(premier)) return "feminin";
  if (MASCULIN_EN_E.has(premier)) return "masculin";
  return /e$/i.test(premier) ? "feminin" : "masculin";
}

/** « le Sénégal », « la France », « l'Inde », « les États-Unis », « Madagascar ». */
export function lePays(nom: string): string {
  switch (forme(nom)) {
    case "sans": return nom;
    case "pluriel": return `les ${nom}`;
    case "voyelle": return `l'${nom}`;
    case "feminin": return `la ${nom}`;
    default: return `le ${nom}`;
  }
}

/** « du Sénégal », « de la France », « de l'Inde », « des États-Unis », « d'Haïti ». */
export function dePays(nom: string): string {
  switch (forme(nom)) {
    // Haïti s'élide, son h est muet
    case "sans": return /^[aeiouyàâéèêëîïôöûü]/i.test(nom) || nom === "Haïti" ? `d'${nom}` : `de ${nom}`;
    case "pluriel": return `des ${nom}`;
    case "voyelle": return `de l'${nom}`;
    case "feminin": return `de la ${nom}`;
    default: return `du ${nom}`;
  }
}

/** « au Sénégal », « en France », « en Iran », « aux États-Unis », « à Madagascar ». */
export function auPays(nom: string): string {
  switch (forme(nom)) {
    case "sans": return `à ${nom}`;
    case "pluriel": return `aux ${nom}`;
    case "voyelle":
    case "feminin": return `en ${nom}`;
    default: return `au ${nom}`;
  }
}
