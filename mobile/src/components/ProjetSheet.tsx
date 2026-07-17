// Fiche projet — réplique du modal ProjetVueModal de la plateforme :
// pilules territoriales (pôle, région, département, arrondissement),
// Informations (investissement, date de début), Description, Thématiques
// du projet (arbre NAEMA), Porteurs, Points focaux, Documents.
import { Ionicons } from "@expo/vector-icons";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ArbreNaema from "@/components/ArbreNaema";
import Symbole from "@/components/Symbole";
import { htmlEnTexte } from "@/components/ZoneSheet";
import { API } from "@/lib/api";
import { fmtDateLong } from "@/lib/format";
import { fmtPhone } from "@/lib/telephone";
import { POLICE, T } from "@/theme";

const DEVISE_SYM: Record<string, string> = { XOF: "FCFA", USD: "$", EUR: "€", GBP: "£", CNY: "¥" };
const devSym = (code?: string, sym?: string) => sym || (code ? DEVISE_SYM[code] || code : "");

// Montant d'investissement : valeur unique ou intervalle (règle du site)
export function fmtInvest(p: any): string | null {
  const sym = devSym(p.devise_code, p.devise_symbole);
  if (!p.investissement_est_intervalle)
    return p.investissement ? `${Number(p.investissement).toLocaleString("fr-FR")} ${sym}` : null;
  if (!p.investissement_min) return null;
  const min = Number(p.investissement_min).toLocaleString("fr-FR");
  const max = p.investissement_max ? Number(p.investissement_max).toLocaleString("fr-FR") : "…";
  return `${min} — ${max} ${sym}`;
}

function SecTitle({ children }: { children: string }) {
  return <Text style={s.secTitle}>{children.toUpperCase()}</Text>;
}
function Bloc({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.bloc}>
      <Text style={s.blocLabel}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

// Carte contact (porteur ou point focal) : nom + chips téléphone / mail
export function CarteContact({ nom, sous, telephones, mails }: { nom: string; sous?: string | null; telephones: string[]; mails: string[] }) {
  return (
    <View style={s.contact}>
      <View style={s.contactEntete}>
        <Text style={s.contactNom}>{nom}</Text>
        {sous ? <Text style={s.contactSous}>{sous}</Text> : null}
      </View>
      {(telephones.length > 0 || mails.length > 0) && (
        <View style={s.contactChips}>
          {telephones.map((t, i) => (
            <View key={`t${i}`} style={[s.contactChip, { backgroundColor: "rgba(0,79,145,0.07)" }]}>
              <Text style={[s.contactChipTexte, { color: T.bleu }]}>{fmtPhone(t.trim())}</Text>
            </View>
          ))}
          {mails.map((m, i) => (
            <View key={`m${i}`} style={[s.contactChip, { backgroundColor: "rgba(24,128,56,0.07)" }]}>
              <Text style={[s.contactChipTexte, { color: T.vert }]}>{m.trim()}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function ProjetSheet({ projet: p, onClose }: { projet: any; onClose: () => void }) {
  const invest = fmtInvest(p);
  const porteurs: any[] = Array.isArray(p.porteurs) ? p.porteurs : [];
  const focaux: any[] = Array.isArray(p.points_focaux) ? p.points_focaux : [];
  const fichiers: any[] = Array.isArray(p.fichiers) ? p.fichiers : [];
  const secIds: number[] = p.secteur_ids || [];
  const braIds: number[] = p.branche_ids || [];
  const actIds: number[] = p.activite_ids || [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.fond} onPress={onClose} />
      <View style={s.feuille}>
        <View style={s.poignee} />
        <View style={s.entete}>
          <Text style={s.titre}>{p.titre_projet}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={s.fermer}>
            <Ionicons name="close" size={17} color={T.texte} />
          </Pressable>
        </View>
        <View style={s.pilules}>
          {p.pole_nom ? <View style={[s.pilule, { backgroundColor: "rgba(0,79,145,0.07)" }]}><Text style={[s.piluleTexte, { color: T.bleu }]}>{p.pole_nom}</Text></View> : null}
          {p.region_nom ? <View style={[s.pilule, { backgroundColor: "rgba(202,99,31,0.08)" }]}><Text style={[s.piluleTexte, { color: T.orange }]}>Région de {p.region_nom}</Text></View> : null}
          {p.departement_nom ? <View style={[s.pilule, { backgroundColor: "rgba(24,128,56,0.08)" }]}><Text style={[s.piluleTexte, { color: T.vert }]}>Département de {p.departement_nom}</Text></View> : null}
          {p.arrondissement_nom ? <View style={[s.pilule, { backgroundColor: "rgba(106,27,154,0.07)" }]}><Text style={[s.piluleTexte, { color: "#6A1B9A" }]}>Arrondissement de {p.arrondissement_nom}</Text></View> : null}
        </View>

        <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ gap: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          {/* Investissement / Date */}
          {(invest || p.date_debut) ? (
            <View>
              <SecTitle>Informations</SecTitle>
              <View style={s.grille}>
                {invest ? <Bloc label="Investissement"><Text style={[s.blocValeur, { fontFamily: POLICE.gras }]}>{invest}</Text></Bloc> : null}
                {p.date_debut ? <Bloc label="Date de début"><Text style={s.blocValeur}>{fmtDateLong(p.date_debut)}</Text></Bloc> : null}
              </View>
            </View>
          ) : null}

          {/* Description */}
          {p.description ? (
            <View>
              <SecTitle>Description</SecTitle>
              <View style={s.description}><Text style={s.descriptionTexte}>{htmlEnTexte(p.description)}</Text></View>
            </View>
          ) : null}

          {/* Thématiques du projet */}
          {(secIds.length > 0 || braIds.length > 0) ? (
            <View>
              <SecTitle>Thématiques du projet</SecTitle>
              <ArbreNaema secIds={secIds} braIds={braIds} actIds={actIds} />
            </View>
          ) : null}

          {/* Porteurs */}
          {porteurs.length > 0 ? (
            <View>
              <SecTitle>{porteurs.length > 1 ? "Porteurs du projet" : "Porteur du projet"}</SecTitle>
              <View style={{ gap: 8 }}>
                {porteurs.map((por: any, i: number) => (
                  <CarteContact key={i} nom={por.nom || "—"}
                    telephones={(por.telephones || []).filter(Boolean)} mails={(por.mails || []).filter(Boolean)} />
                ))}
              </View>
            </View>
          ) : null}

          {/* Points focaux */}
          {focaux.length > 0 ? (
            <View>
              <SecTitle>Points focaux</SecTitle>
              <View style={{ gap: 8 }}>
                {focaux.map((pf: any, i: number) => (
                  <CarteContact key={i} nom={[pf.civilite, pf.prenom, pf.nom].filter(Boolean).join(" ")}
                    telephones={(pf.telephones || []).filter(Boolean)} mails={(pf.mails || []).filter(Boolean)} />
                ))}
              </View>
            </View>
          ) : null}

          {/* Documents */}
          {fichiers.length > 0 ? (
            <View>
              <SecTitle>{fichiers.length > 1 ? "Documents" : "Document"}</SecTitle>
              <View style={{ gap: 5 }}>
                {fichiers.map((f: any) => (
                  <Pressable key={f.id} onPress={() => Linking.openURL(`${API}/projets/${p.id}/fichiers/${f.id}/download`)}
                    style={({ pressed }) => [s.doc, pressed && { backgroundColor: "rgba(0,79,145,0.09)" }]}>
                    <Symbole nom="description" taille={15} couleur={T.bleu} />
                    <Text style={s.docTexte} numberOfLines={1}>{f.titre || f.fichier_nom}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
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
    paddingHorizontal: 22, paddingTop: 10, maxHeight: "82%",
  },
  poignee: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: T.bordure, marginBottom: 12 },
  entete: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  titre: { flex: 1, fontSize: 19, fontFamily: POLICE.gras, color: T.encre, lineHeight: 25, letterSpacing: -0.3 },
  fermer: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.filet, alignItems: "center", justifyContent: "center" },
  pilules: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  pilule: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3.5 },
  piluleTexte: { fontSize: 10.5, fontFamily: POLICE.gras },
  secTitle: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.6, marginBottom: 10 },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bloc: {
    backgroundColor: "rgba(0,79,145,0.04)", borderWidth: 1, borderColor: "rgba(0,79,145,0.10)",
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexGrow: 1, flexBasis: "45%",
  },
  blocLabel: { fontSize: 9, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1, marginBottom: 4 },
  blocValeur: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre, lineHeight: 18 },
  description: { backgroundColor: "#FAFAF9", borderWidth: 1, borderColor: "#F0EEEC", borderRadius: 12, paddingHorizontal: 15, paddingVertical: 13 },
  descriptionTexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.texte, lineHeight: 21 },
  contact: { backgroundColor: "#FAFAF9", borderWidth: 1, borderColor: "#F0EEEC", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  contactEntete: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  contactNom: { fontSize: 12.5, fontFamily: POLICE.gras, color: T.encre },
  contactSous: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris },
  contactChips: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 7 },
  contactChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  contactChipTexte: { fontSize: 11, fontFamily: POLICE.demi },
  doc: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(0,79,145,0.05)", borderWidth: 1, borderColor: "rgba(0,79,145,0.15)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  docTexte: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: T.bleu },
});
