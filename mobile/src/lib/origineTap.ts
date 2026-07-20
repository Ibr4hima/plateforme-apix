// Origine du dernier toucher — capturée au niveau racine (sans jamais
// revendiquer le geste) pour que les feuilles de détail puissent « pousser »
// depuis la card touchée plutôt que glisser génériquement depuis le bas.
const origine = { y: null as number | null, quand: 0 };

export function marquerOrigine(y: number) {
  origine.y = y;
  origine.quand = Date.now();
}

// L'origine n'est pertinente que si la feuille s'ouvre dans la foulée du tap
export function origineRecente(): number | null {
  return Date.now() - origine.quand < 700 ? origine.y : null;
}
