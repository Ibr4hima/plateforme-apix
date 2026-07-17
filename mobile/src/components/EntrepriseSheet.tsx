// Fiche entreprise — feuille de détail fidèle au modal de la plateforme :
// badge pôle territoire pastel, identité, localisation, contacts,
// thématiques NAEMA, points focaux.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getJson } from "@/lib/api";
import { POLE_COULEURS, foncerPastel, normPole } from "@/lib/couleurs";
import { fmtDate, fmtDateLong } from "@/lib/format";
import { POLICE, T } from "@/theme";

function Bloc({ label, valeur, children }: { label: string; valeur?: string | null; children?: React.ReactNode }) {
  if (!valeur && !children) return null;
  return (
    <View style={s.bloc}>
      <Text style={s.blocLabel}>{label.toUpperCase()}</Text>
      {children || <Text style={s.blocValeur}>{valeur}</Text>}
    </View>
  );
}

export default function EntrepriseSheet({ entreprise: e, onClose }: { entreprise: any; onClose: () => void }) {
  const cPole = (e.pole_territoire_nom && POLE_COULEURS[normPole(e.pole_territoire_nom)]) || "#C5BFBB";

  const OPTS = { staleTime: Infinity, gcTime: 24 * 3600 * 1000 } as const;
  const secteurs  = useQuery({ queryKey: ["ref", "secteurs"],  queryFn: () => getJson<any[]>("/entreprises/ref/secteurs"),  ...OPTS });
  const branches  = useQuery({ queryKey: ["ref", "branches"],  queryFn: () => getJson<any[]>("/entreprises/ref/branches"),  ...OPTS });
  const activites = useQuery({ queryKey: ["ref", "activites"], queryFn: () => getJson<any[]>("/entreprises/ref/activites"), ...OPTS });
  const noms = (ids: number[] | null | undefined, ref?: any[]) =>
    (ids || []).map(id => ref?.find((r: any) => r.id === id)?.nom).filter(Boolean) as string[];
  const themes = [
    ...noms(e.secteur_ids, secteurs.data).map(n => ({ n, c: T.bleu })),
    ...noms(e.branche_ids, branches.data).map(n => ({ n, c: T.orange })),
    ...noms(e.activite_ids, activites.data).map(n => ({ n, c: T.vert })),
  ];

  const localisation = [e.adresse, e.arrondissement_nom, e.departement_nom, e.region_nom].filter(Boolean).join(" · ");
  const siege = e.siege_pays_nom || e.pays;
  const contacts = [e.telephone, e.mail, e.siteweb].filter(Boolean);
  const focaux: any[] = Array.isArray(e.points_focaux) ? e.points_focaux : [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.fond} onPress={onClose} />
      <View style={s.feuille}>
        <View style={s.poignee} />
        <View style={s.entete}>
          {e.pole_territoire_nom ? (
            <View style={[s.badge, { backgroundColor: `${cPole}40`, borderColor: `${cPole}90` }]}>
              <Text style={[s.badgeTexte, { color: foncerPastel(cPole) }]} numberOfLines={1}>{e.pole_territoire_nom}</Text>
            </View>
          ) : <View />}
          <Pressable onPress={onClose} hitSlop={10} style={s.fermer}>
            <Ionicons name="close" size={17} color={T.texte} />
          </Pressable>
        </View>
        <Text style={s.titre}>{e.nom}</Text>
        {e.forme_juridique ? <Text style={s.sousTitre}>{e.forme_juridique}</Text> : null}

        <ScrollView style={{ marginTop: 14 }} contentContainerStyle={{ gap: 10, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          <Bloc label="Date de création" valeur={e.date_creation ? fmtDateLong(e.date_creation) : null} />
          <Bloc label="Localisation" valeur={localisation || null} />
          <Bloc label="Siège" valeur={siege || null} />
          {contacts.length > 0 && (
            <Bloc label="Contact">
              <View style={{ gap: 5 }}>
                {e.telephone ? <Text style={s.blocValeur}>{e.telephone}</Text> : null}
                {e.mail ? <Text style={s.blocValeur}>{e.mail}</Text> : null}
                {e.siteweb ? <Text style={[s.blocValeur, { color: T.bleu }]}>{e.siteweb}</Text> : null}
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
          {focaux.length > 0 && (
            <Bloc label={focaux.length > 1 ? "Points focaux" : "Point focal"}>
              <View style={{ gap: 9 }}>
                {focaux.map((f: any, i: number) => (
                  <View key={i}>
                    <Text style={s.blocValeur}>{[f.prenom, f.nom].filter(Boolean).join(" ") || "—"}</Text>
                    {f.fonction ? <Text style={s.focalFonction}>{f.fonction}</Text> : null}
                  </View>
                ))}
              </View>
            </Bloc>
          )}
          {e.background ? (
            <Bloc label="À propos">
              <Text style={s.paragraphe}>{e.background}</Text>
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
    backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 22, paddingTop: 10, maxHeight: "78%",
  },
  poignee: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: T.bordure, marginBottom: 12 },
  entete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, flexShrink: 1 },
  badgeTexte: { fontSize: 11, fontFamily: POLICE.gras },
  fermer: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.filet, alignItems: "center", justifyContent: "center" },
  titre: { fontSize: 19, fontFamily: POLICE.gras, color: T.encre, marginTop: 10, lineHeight: 25, letterSpacing: -0.3 },
  sousTitre: { fontSize: 12, fontFamily: POLICE.moyen, color: T.gris, marginTop: 4 },
  bloc: { backgroundColor: "rgba(0,79,145,0.04)", borderWidth: 1, borderColor: "rgba(0,79,145,0.10)", borderRadius: 14, padding: 13 },
  blocLabel: { fontSize: 9, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.2, marginBottom: 6 },
  blocValeur: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre },
  focalFonction: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  paragraphe: { fontSize: 13, fontFamily: POLICE.normal, color: T.texte, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4.5 },
  chipTexte: { fontSize: 11.5, fontFamily: POLICE.demi },
});
