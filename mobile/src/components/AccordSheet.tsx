// Fiche accord — feuille de détail fidèle au modal de la plateforme :
// badge pastel de statut, ancienneté, dates, parties signataires,
// thématiques (secteurs / branches / activités) et commentaires.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getJson } from "@/lib/api";
import { foncerPastel } from "@/lib/couleurs";
import { fmtDate } from "@/lib/format";
import { computeStatutAccord } from "@/lib/statuts";
import { POLICE, T } from "@/theme";

export const ST_PASTEL: Record<string, { label: string; p: string }> = {
  en_vigueur: { label: "En vigueur",           p: "#B4DE9D" },
  signe:      { label: "Signé non en vigueur", p: "#9DC3E6" },
  expire:     { label: "Expiré",               p: "#E6C79D" },
};

// « 8 ans », « 4 mois », « 12 jours » — port du dureeDepuis de la plateforme
export function dureeDepuis(dstr: string): string {
  const d = new Date(dstr.slice(0, 10) + "T00:00:00");
  const jours = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (jours < 31) return `${Math.max(jours, 1)} jour${jours > 1 ? "s" : ""}`;
  const mois = Math.floor(jours / 30.44);
  if (mois < 12) return `${mois} mois`;
  const ans = Math.floor(mois / 12);
  return `${ans} an${ans > 1 ? "s" : ""}`;
}

export function sousTitreStatut(a: any): string | null {
  const statut = computeStatutAccord(a);
  if (statut === "en_vigueur" && a.date_entree_vigueur) return `En vigueur depuis ${dureeDepuis(a.date_entree_vigueur)}`;
  if (statut === "signe" && a.date_signature) return `Signé il y a ${dureeDepuis(a.date_signature)}`;
  if (statut === "expire" && a.date_expiration) return `Expiré depuis ${dureeDepuis(a.date_expiration)}`;
  return a.reference || null;
}

function Bloc({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.bloc}>
      <Text style={s.blocLabel}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

export default function AccordSheet({ accord: a, onClose }: { accord: any; onClose: () => void }) {
  const statut = computeStatutAccord(a);
  const st = statut ? ST_PASTEL[statut] : null;
  const sousTitre = sousTitreStatut(a);

  // Référentiels (mêmes endpoints que le site, cache 24 h)
  const OPTS = { staleTime: Infinity, gcTime: 24 * 3600 * 1000 } as const;
  const pays      = useQuery({ queryKey: ["ref-pays-stat"], queryFn: () => getJson<any[]>("/statistiques/pays"), ...OPTS });
  const secteurs  = useQuery({ queryKey: ["ref", "secteurs"],  queryFn: () => getJson<any[]>("/entreprises/ref/secteurs"),  ...OPTS });
  const branches  = useQuery({ queryKey: ["ref", "branches"],  queryFn: () => getJson<any[]>("/entreprises/ref/branches"),  ...OPTS });
  const activites = useQuery({ queryKey: ["ref", "activites"], queryFn: () => getJson<any[]>("/entreprises/ref/activites"), ...OPTS });

  const nomsPays: string[] = (a.parties_pays_ids?.length && pays.data)
    ? a.parties_pays_ids.map((id: number) => pays.data!.find((p: any) => p.id === id)?.nom).filter(Boolean)
    : (a.parties_signataires ? String(a.parties_signataires).split(", ").filter(Boolean) : []);

  const noms = (ids: number[] | null | undefined, ref?: any[]) =>
    (ids || []).map(id => ref?.find((r: any) => r.id === id)?.nom).filter(Boolean) as string[];
  const themes = [
    ...noms(a.secteur_ids, secteurs.data).map(n => ({ n, c: T.bleu })),
    ...noms(a.branche_ids, branches.data).map(n => ({ n, c: T.orange })),
    ...noms(a.activite_ids, activites.data).map(n => ({ n, c: T.vert })),
  ];

  const DATES = [
    { label: "Signature",         val: a.date_signature ? fmtDate(a.date_signature) : "—" },
    { label: "Entrée en vigueur", val: a.date_entree_vigueur ? fmtDate(a.date_entree_vigueur) : "Non définie" },
    { label: "Expiration",        val: a.date_expiration ? fmtDate(a.date_expiration) : "—" },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.fond} onPress={onClose} />
      <View style={s.feuille}>
        <View style={s.poignee} />
        <View style={s.entete}>
          {st && (
            <View style={[s.badge, { backgroundColor: `${st.p}40`, borderColor: `${st.p}90` }]}>
              <Text style={[s.badgeTexte, { color: foncerPastel(st.p) }]}>{st.label}</Text>
            </View>
          )}
          <Pressable onPress={onClose} hitSlop={10} style={s.fermer}>
            <Ionicons name="close" size={17} color={T.texte} />
          </Pressable>
        </View>
        <Text style={s.titre}>{a.titre}</Text>
        {sousTitre ? <Text style={s.sousTitre}>{sousTitre}</Text> : null}

        <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ gap: 12, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          {/* Dates */}
          <View style={s.datesRangee}>
            {DATES.map((d, i) => (
              <View key={d.label} style={[s.dateCase, i > 0 && s.dateCaseBord]}>
                <Text style={s.dateLabel}>{d.label.toUpperCase()}</Text>
                <Text style={s.dateVal}>{d.val}</Text>
              </View>
            ))}
          </View>

          {nomsPays.length > 0 && (
            <Bloc label="Parties signataires">
              <View style={s.chips}>
                {nomsPays.map(n => (
                  <View key={n} style={s.chip}><Text style={s.chipTexte}>{n}</Text></View>
                ))}
              </View>
            </Bloc>
          )}

          {themes.length > 0 && (
            <Bloc label="Thématiques">
              <View style={s.chips}>
                {themes.map(t => (
                  <View key={t.n} style={[s.chip, { backgroundColor: `${t.c}0D`, borderColor: `${t.c}30` }]}>
                    <Text style={[s.chipTexte, { color: t.c }]}>{t.n}</Text>
                  </View>
                ))}
              </View>
            </Bloc>
          )}

          {a.commentaires ? (
            <Bloc label="Commentaires">
              <Text style={s.commentaires}>{a.commentaires}</Text>
            </Bloc>
          ) : null}
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
  entete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4 },
  badgeTexte: { fontSize: 11, fontFamily: POLICE.gras },
  fermer: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.filet, alignItems: "center", justifyContent: "center" },
  titre: { fontSize: 19, fontFamily: POLICE.gras, color: T.encre, marginTop: 10, lineHeight: 25, letterSpacing: -0.3 },
  sousTitre: { fontSize: 12, fontFamily: POLICE.moyen, color: T.gris, marginTop: 5 },
  datesRangee: {
    flexDirection: "row", backgroundColor: T.blocFond,
    borderWidth: 1, borderColor: T.blocBord, borderRadius: 14, paddingVertical: 12,
  },
  dateCase: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  dateCaseBord: { borderLeftWidth: 1, borderLeftColor: T.blocBord },
  dateLabel: { fontSize: 8, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 0.8, textAlign: "center" },
  dateVal: { fontSize: 12, fontFamily: POLICE.gras, color: T.encre, marginTop: 4, fontVariant: ["tabular-nums"], textAlign: "center" },
  bloc: { backgroundColor: "#FCFBFA", borderWidth: 1, borderColor: T.filet, borderRadius: 14, padding: 13 },
  blocLabel: { fontSize: 9, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.2, marginBottom: 9 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { backgroundColor: T.filet, borderWidth: 1, borderColor: "#E8E5E2", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4.5 },
  chipTexte: { fontSize: 11.5, fontFamily: POLICE.demi, color: T.texte },
  commentaires: { fontSize: 13, fontFamily: POLICE.normal, color: T.texte, lineHeight: 20 },
});
