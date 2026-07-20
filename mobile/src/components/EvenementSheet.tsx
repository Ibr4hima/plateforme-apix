// Fiche événement — feuille de détail fidèle au modal de la plateforme :
// statut, édition, rôle APIX pastel, date, lieu, organisateur, récurrence,
// description, participants (pays invités / entreprises invitées).
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { foncerPastel } from "@/lib/couleurs";
import { fmtDate } from "@/lib/format";
import { computeStatutEvenement } from "@/lib/statuts";
import { POLICE, T } from "@/theme";

export const ROLE_PASTEL: Record<string, string> = {
  "Organisateur":    "#B4DE9D",
  "Co-organisateur": "#9DDEC2",
  "Participant":     "#9DC3E6",
  "Partenaire":      "#9DD3DE",
  "Sponsor":         "#E6C79D",
  "Invité":          "#E6AC9D",
};
export const ST_EVENT: Record<string, { label: string; c: string; bg: string }> = {
  a_venir:  { label: "À venir",  c: "#004f91", bg: T.bleuVoile },
  en_cours: { label: "En cours", c: "#188038", bg: "rgba(24,128,56,0.08)" },
  termine:  { label: "Terminé",  c: T.texte, bg: T.filet },
};
export const ordinal = (n: number) => (n === 1 ? "1ère édition" : `${n}ème édition`);
const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export function statutEvenement(e: any) {
  return computeStatutEvenement(e) ?? ((e.prochain_annee || e.prochain_mois) ? "a_venir" : null);
}
export function dateEvenement(e: any): string | null {
  if (e.date_debut) {
    return e.date_debut === e.date_fin || !e.date_fin
      ? fmtDate(e.date_debut)
      : `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}`;
  }
  if (e.prochain_mois || e.prochain_annee) {
    return `${e.prochain_jour ? e.prochain_jour + " " : ""}${e.prochain_mois ? MOIS[(e.prochain_mois || 1) - 1] + " " : ""}${e.prochain_annee || ""}`.trim();
  }
  return null;
}

function Bloc({ label, valeur }: { label: string; valeur?: string | null }) {
  if (!valeur) return null;
  return (
    <View style={s.bloc}>
      <Text style={s.blocLabel}>{label.toUpperCase()}</Text>
      <Text style={s.blocValeur}>{valeur}</Text>
    </View>
  );
}

export default function EvenementSheet({ ev: e, onClose }: { ev: any; onClose: () => void }) {
  const statut = statutEvenement(e);
  const st = statut ? ST_EVENT[statut] : null;
  const roleP = e.role_apix ? ROLE_PASTEL[e.role_apix] || "#C5BFBB" : null;
  // pays_invites_noms est une chaîne « Maroc, Canada » côté API ;
  // entreprises_invitees peut être tableau ou chaîne selon les fiches
  const enListe = (v: any): string[] =>
    Array.isArray(v) ? v.filter(Boolean)
    : typeof v === "string" ? v.split(",").map(x => x.trim()).filter(Boolean)
    : [];
  const paysInvites = enListe(e.pays_invites_noms);
  const entreprisesInvitees = enListe(e.entreprises_invitees);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.fond} onPress={onClose} />
      <View style={s.feuille}>
        <View style={s.poignee} />
        <View style={s.entete}>
          <View style={s.pilules}>
            {st && <View style={[s.pilule, { backgroundColor: st.bg }]}><Text style={[s.piluleTexte, { color: st.c }]}>{st.label}</Text></View>}
            {e.edition != null && <View style={[s.pilule, { backgroundColor: T.bleuVoile }]}><Text style={[s.piluleTexte, { color: T.bleu }]}>{ordinal(e.edition)}</Text></View>}
            {roleP && (
              <View style={[s.pilule, { backgroundColor: `${roleP}40`, borderWidth: 1, borderColor: `${roleP}90` }]}>
                <Text style={[s.piluleTexte, { color: foncerPastel(roleP) }]}>{e.role_apix}</Text>
              </View>
            )}
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={s.fermer}>
            <Ionicons name="close" size={17} color={T.texte} />
          </Pressable>
        </View>
        <Text style={s.titre}>{e.nom_event}</Text>

        <ScrollView style={{ marginTop: 14 }} contentContainerStyle={{ gap: 10, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          <Bloc label="Date" valeur={dateEvenement(e)} />
          <Bloc label="Lieu" valeur={[e.ville, e.pays_hote_nom].filter(Boolean).join(", ") || null} />
          <Bloc label="Organisateur" valeur={e.organisateur} />
          {e.frequence_valeur ? (
            <Bloc label="Récurrence" valeur={`Tous les ${e.frequence_valeur} ${e.frequence_type === "mois" ? "mois" : `an${e.frequence_valeur > 1 ? "s" : ""}`}`} />
          ) : null}
          {e.description ? (
            <View style={s.bloc}>
              <Text style={s.blocLabel}>DESCRIPTION</Text>
              <Text style={s.description}>{e.description}</Text>
            </View>
          ) : null}
          {Object.keys(e.thematiques_tree || {}).length > 0 && (
            <View style={s.bloc}>
              <Text style={s.blocLabel}>THÉMATIQUES</Text>
              <View style={{ gap: 16 }}>
                {Object.entries(e.thematiques_tree).map(([sec, branches]: any) => (
                  <View key={sec} style={{ gap: 9 }}>
                    <View style={s.themeLigne}>
                      <View style={[s.themePoint, { width: 8, height: 8, backgroundColor: T.bleu, marginTop: 5 }]} />
                      <Text style={s.themeSecteur}>{sec}</Text>
                    </View>
                    {Object.entries(branches).map(([bra, acts]: any) => (
                      <View key={bra} style={s.themeBranche}>
                        <View style={s.themeLigne}>
                          <View style={[s.themePoint, { width: 6, height: 6, backgroundColor: T.orange, marginTop: 6 }]} />
                          <Text style={s.themeBrancheTexte}>{bra}</Text>
                        </View>
                        {acts.length > 0 && (
                          <View style={{ paddingLeft: 16, gap: 6, marginTop: 7 }}>
                            {acts.map((act: string) => (
                              <View key={act} style={s.themeLigne}>
                                <View style={[s.themePoint, { width: 5, height: 5, backgroundColor: T.vert, marginTop: 6 }]} />
                                <Text style={s.themeActivite}>{act}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          )}
          {paysInvites.length > 0 && (
            <View style={s.bloc}>
              <Text style={s.blocLabel}>PAYS INVITÉS</Text>
              <View style={s.chips}>
                {paysInvites.map(n => <View key={n} style={s.chip}><Text style={s.chipTexte}>{n}</Text></View>)}
              </View>
            </View>
          )}
          {entreprisesInvitees.length > 0 && (
            <View style={s.bloc}>
              <Text style={s.blocLabel}>ENTREPRISES INVITÉES</Text>
              <View style={s.chips}>
                {entreprisesInvitees.map(n => <View key={n} style={[s.chip, { backgroundColor: T.bleuVoile, borderColor: T.blocBord }]}><Text style={[s.chipTexte, { color: T.bleu }]}>{n}</Text></View>)}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(2,20,38,0.45)" },
  feuille: {
    backgroundColor: T.carte, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 22, paddingTop: 10, maxHeight: "78%",
  },
  poignee: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: T.bordure, marginBottom: 12 },
  entete: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  pilules: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 },
  pilule: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  piluleTexte: { fontSize: 10.5, fontFamily: POLICE.gras },
  fermer: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.filet, alignItems: "center", justifyContent: "center" },
  titre: { fontSize: 19, fontFamily: POLICE.gras, color: T.encre, marginTop: 10, lineHeight: 25, letterSpacing: -0.3 },
  bloc: { backgroundColor: T.blocFond, borderWidth: 1, borderColor: T.blocBord, borderRadius: 14, padding: 13 },
  blocLabel: { fontSize: 9, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.2, marginBottom: 6 },
  blocValeur: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre },
  description: { fontSize: 13, fontFamily: POLICE.normal, color: T.texte, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  themeLigne: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  themePoint: { borderRadius: 99, flexShrink: 0 },
  themeBranche: { paddingLeft: 17, borderLeftWidth: 1.5, borderLeftColor: T.bleuVoile, marginLeft: 3.5 },
  themeSecteur: { flex: 1, fontSize: 13, fontFamily: POLICE.gras, color: T.bleu, lineHeight: 18 },
  themeBrancheTexte: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: "#b5722f", lineHeight: 18 },
  themeActivite: { flex: 1, fontSize: 12, fontFamily: POLICE.normal, color: "#4d8a63", lineHeight: 17 },
  chip: { backgroundColor: T.filet, borderWidth: 1, borderColor: "#E8E5E2", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4.5 },
  chipTexte: { fontSize: 11.5, fontFamily: POLICE.demi, color: T.texte },
});
