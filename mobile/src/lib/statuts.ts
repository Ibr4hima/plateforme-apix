// Statuts calculés à partir des dates — source unique partagée entre les
// pages publiques et l'admin (mêmes règles affichées des deux côtés).

// Accord : expiration passée → expiré ; entrée en vigueur atteinte →
// en vigueur ; signature seule → « signé non en vigueur ».
export function computeStatutAccord(a: any): "en_vigueur" | "expire" | "signe" | null {
  const today = new Date().toISOString().split("T")[0];
  if (a.date_expiration && a.date_expiration < today) return "expire";
  if (a.date_entree_vigueur && a.date_entree_vigueur <= today) return "en_vigueur";
  if (a.date_signature && a.date_signature <= today) return "signe";
  return null;
}

export function computeStatutEvenement(e: any): "a_venir" | "en_cours" | "termine" | null {
  if (!e.date_debut) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const debut = new Date(e.date_debut + "T00:00:00");
  const fin   = e.date_fin ? new Date(e.date_fin + "T00:00:00") : debut;
  if (debut > today) return "a_venir";
  if (fin   < today) return "termine";
  return "en_cours";
}
