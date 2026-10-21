// Fiche de détail générique — feuille montante affichant l'essentiel d'un
// résultat de recherche (accord, événement, entreprise, zone, pays).
import { Text, View } from "react-native";
import { Groupe, LigneValeur, LigneVide } from "@/components/ListeIOS";
import { Feuille } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { computeStatutAccord, computeStatutEvenement } from "@/lib/statuts";
import type { Resultat } from "@/lib/indexRecherche";
import { BADGE, FONTE, T } from "@/theme";
import { creerStyles } from "@/lib/apparence";

const ST_EVENT: Record<string, { label: string; c: string; bg: string }> = {
  a_venir:  { label: "À venir",  c: T.bleu,    bg: T.bleuVoile },
  en_cours: { label: "En cours", c: T.vert,    bg: "rgba(24,128,56,0.08)" },
  termine:  { label: "Terminé",  c: T.texte, bg: T.filet },
};

export default function FicheSheet({ resultat: r, onClose }: { resultat: Resultat; onClose: () => void }) {
  const a = r.item;
  let badge: { label: string; c: string; bg: string } | null = null;
  const champs: { label: string; valeur?: string | null }[] = [];

  if (r.type === "accord") {
    badge = BADGE[(computeStatutAccord(a) || "") as keyof typeof BADGE] || null;
    champs.push(
      { label: "Signature", valeur: a.date_signature ? fmtDate(a.date_signature) : null },
      { label: "Entrée en vigueur", valeur: a.date_entree_vigueur ? fmtDate(a.date_entree_vigueur) : null },
      { label: "Expiration", valeur: a.date_expiration ? fmtDate(a.date_expiration) : null },
      { label: "Parties signataires", valeur: a.parties_signataires },
      { label: "Référence", valeur: a.reference },
    );
  } else if (r.type === "evenement") {
    badge = ST_EVENT[computeStatutEvenement(a) || ""] || null;
    champs.push(
      { label: "Dates", valeur: a.date_debut ? (a.date_fin && a.date_fin !== a.date_debut ? `${fmtDate(a.date_debut)} → ${fmtDate(a.date_fin)}` : fmtDate(a.date_debut)) : null },
      { label: "Lieu", valeur: [a.ville, a.pays_hote_nom].filter(Boolean).join(", ") || null },
      { label: "Rôle APIX", valeur: a.role_apix },
      { label: "Édition", valeur: a.edition != null ? String(a.edition) : null },
    );
  } else if (r.type === "entreprise") {
    champs.push(
      { label: "Forme juridique", valeur: a.forme_juridique },
      { label: "Pôle territoire", valeur: a.pole_nom || a.pole_territoire },
      { label: "Région", valeur: a.region_nom },
      { label: "Date de création", valeur: a.date_creation ? fmtDate(a.date_creation) : null },
      { label: "Secteurs", valeur: Array.isArray(a.secteurs) && a.secteurs.length ? a.secteurs.join(", ") : null },
    );
  } else if (r.type === "zone") {
    champs.push(
      { label: "Type", valeur: a.type_zone },
      { label: "Superficie", valeur: a.superficie_hectares ? `${Number(a.superficie_hectares).toLocaleString("fr-FR")} ha` : null },
      { label: "Pôle", valeur: a.pole_nom },
      { label: "Région", valeur: a.region_nom },
    );
  } else if (r.type === "pays") {
    champs.push(
      { label: "Continent", valeur: a.continent },
      { label: "Région", valeur: a.region_geo },
      { label: "Code ISO3", valeur: a.code_iso3 },
    );
  }

  return (
    <Feuille onClose={onClose} ecart={10} fondGroupe
      titre={<Text style={s.type}>{r.type === "pays" ? "PAYS" : r.type.toUpperCase()}</Text>}
      sousEntete={
        <>
          <Text style={s.titre}>{r.nom}</Text>
          {badge && (
            <View style={[s.badge, { backgroundColor: badge.bg }]}>
              <Text style={[s.badgeTexte, { color: badge.c }]}>{badge.label}</Text>
            </View>
          )}
        </>
      }>
      {/* Les champs en lignes d'un même groupe, sur le fond gris */}
      <Groupe>
        {champs.filter(c => c.valeur).map(c => <LigneValeur key={c.label} label={c.label} valeur={c.valeur} />)}
        {champs.every(c => !c.valeur) && <LigneVide texte="Détails non renseignés." />}
      </Groupe>
    </Feuille>
  );
}

const s = creerStyles(() => ({
  type: { fontSize: 10, ...FONTE.gras, color: T.bleu, letterSpacing: 1.6, marginTop: 8 },
  titre: { fontSize: 19, ...FONTE.gras, color: T.encre, marginTop: 8, lineHeight: 25 },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginTop: 10 },
  badgeTexte: { fontSize: 11, ...FONTE.gras },
}));
