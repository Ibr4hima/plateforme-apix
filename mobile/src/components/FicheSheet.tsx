// Fiche de détail générique — feuille montante affichant l'essentiel d'un
// résultat de recherche (accord, événement, entreprise, zone, pays).
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fmtDate } from "@/lib/format";
import { computeStatutAccord, computeStatutEvenement } from "@/lib/statuts";
import type { Resultat } from "@/lib/indexRecherche";
import { BADGE, T, POLICE } from "@/theme";

function Champ({ label, valeur }: { label: string; valeur?: string | null }) {
  if (!valeur) return null;
  return (
    <View style={s.champ}>
      <Text style={s.champLabel}>{label.toUpperCase()}</Text>
      <Text style={s.champValeur}>{valeur}</Text>
    </View>
  );
}

const ST_EVENT: Record<string, { label: string; c: string; bg: string }> = {
  a_venir:  { label: "À venir",  c: T.bleu,    bg: "rgba(0,79,145,0.07)" },
  en_cours: { label: "En cours", c: T.vert,    bg: "rgba(24,128,56,0.08)" },
  termine:  { label: "Terminé",  c: "#6b7280", bg: T.filet },
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
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.fond} onPress={onClose} />
      <View style={s.feuille}>
        <View style={s.poignee} />
        <View style={s.entete}>
          <Text style={s.type}>{r.type === "pays" ? "PAYS" : r.type.toUpperCase()}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={s.fermer}>
            <Ionicons name="close" size={17} color={T.texte} />
          </Pressable>
        </View>
        <Text style={s.titre}>{r.nom}</Text>
        {badge && (
          <View style={[s.badge, { backgroundColor: badge.bg }]}>
            <Text style={[s.badgeTexte, { color: badge.c }]}>{badge.label}</Text>
          </View>
        )}
        <ScrollView style={{ marginTop: 14 }} contentContainerStyle={{ gap: 10, paddingBottom: 34 }}>
          {champs.filter(c => c.valeur).map(c => <Champ key={c.label} {...c} />)}
          {champs.every(c => !c.valeur) && <Text style={s.vide}>Détails non renseignés.</Text>}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(2,20,38,0.45)" },
  feuille: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 22, paddingTop: 10, maxHeight: "72%",
  },
  poignee: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: T.bordure, marginBottom: 12 },
  entete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  type: { fontSize: 10, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.6 },
  fermer: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.filet, alignItems: "center", justifyContent: "center" },
  titre: { fontSize: 19, fontFamily: POLICE.gras, color: T.encre, marginTop: 8, lineHeight: 25 },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginTop: 10 },
  badgeTexte: { fontSize: 11, fontFamily: POLICE.gras },
  champ: { backgroundColor: "rgba(0,79,145,0.04)", borderWidth: 1, borderColor: "rgba(0,79,145,0.10)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  champLabel: { fontSize: 9, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1 },
  champValeur: { fontSize: 13.5, fontFamily: POLICE.demi, color: T.encre, marginTop: 3 },
  vide: { fontSize: 12.5, color: T.gris, textAlign: "center", paddingVertical: 18 },
});
