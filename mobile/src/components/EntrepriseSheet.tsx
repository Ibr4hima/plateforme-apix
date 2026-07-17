// Fiche entreprise — réplique du modal EntreprisePublicModal de la
// plateforme : en-tête à pilules (forme juridique, pôle, région),
// Informations en grille, Contact (téléphones formatés, emails),
// Activités de l'entreprise (arbre NAEMA secteur → branche → activité),
// Points focaux avec chips téléphone/mail.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getJson } from "@/lib/api";
import { fmtDateLong } from "@/lib/format";
import { fmtPhone } from "@/lib/telephone";
import { POLICE, T } from "@/theme";

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
const V = ({ children, bleu }: { children: string; bleu?: boolean }) => (
  <Text style={[s.blocValeur, bleu && { color: T.bleu }]}>{children}</Text>
);

export default function EntrepriseSheet({ entreprise: e, onClose }: { entreprise: any; onClose: () => void }) {
  const OPTS = { staleTime: Infinity, gcTime: 24 * 3600 * 1000 } as const;
  const secteurs  = useQuery({ queryKey: ["ref", "secteurs"],  queryFn: () => getJson<any[]>("/entreprises/ref/secteurs"),  ...OPTS }).data || [];
  const branches  = useQuery({ queryKey: ["ref", "branches"],  queryFn: () => getJson<any[]>("/entreprises/ref/branches"),  ...OPTS }).data || [];
  const activites = useQuery({ queryKey: ["ref", "activites"], queryFn: () => getJson<any[]>("/entreprises/ref/activites"), ...OPTS }).data || [];

  const secIds: number[] = e.secteur_ids || [];
  const braIds: number[] = e.branche_ids || [];
  const actIds: number[] = e.activite_ids || [];
  const hasNaema = secIds.length > 0 || braIds.length > 0 || actIds.length > 0;
  // Mêmes règles que le site
  const locStr = [e.arrondissement_nom, e.departement_nom, e.region_nom].filter(Boolean).join(", ");
  const paysStr = e.siege_pays_nom || e.pays || null;
  const focaux: any[] = Array.isArray(e.points_focaux) ? e.points_focaux : [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.fond} onPress={onClose} />
      <View style={s.feuille}>
        <View style={s.poignee} />
        {/* En-tête : nom + pilules (comme le site) */}
        <View style={s.entete}>
          <Text style={s.titre}>{e.nom}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={s.fermer}>
            <Ionicons name="close" size={17} color={T.texte} />
          </Pressable>
        </View>
        <View style={s.pilules}>
          {e.forme_juridique ? <View style={[s.pilule, { backgroundColor: T.filet }]}><Text style={[s.piluleTexte, { color: "#6b7280" }]}>{e.forme_juridique}</Text></View> : null}
          {e.pole_territoire_nom ? <View style={[s.pilule, { backgroundColor: "rgba(106,27,154,0.07)" }]}><Text style={[s.piluleTexte, { color: "#6A1B9A" }]}>{e.pole_territoire_nom}</Text></View> : null}
          {e.region_nom ? <View style={[s.pilule, { backgroundColor: "rgba(0,79,145,0.07)" }]}><Text style={[s.piluleTexte, { color: T.bleu }]}>Région de {e.region_nom}</Text></View> : null}
        </View>

        <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ gap: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          {/* Informations */}
          <View>
            <SecTitle>Informations</SecTitle>
            <View style={s.grille}>
              {e.date_creation ? <Bloc label="Création"><V>{fmtDateLong(e.date_creation)}</V></Bloc> : null}
              {paysStr ? <Bloc label="Pays du siège"><V>{paysStr}</V></Bloc> : null}
              {locStr ? <Bloc label="Localisation"><V>{locStr}</V></Bloc> : null}
              {e.adresse ? <Bloc label="Adresse"><V>{e.adresse}</V></Bloc> : null}
              {e.siteweb ? (
                <Pressable style={{ width: "100%" }} onPress={() => Linking.openURL(e.siteweb.startsWith("http") ? e.siteweb : `https://${e.siteweb}`)}>
                  <Bloc label="Site web"><V bleu>{e.siteweb}</V></Bloc>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Contact */}
          {(e.telephone || e.mail) ? (
            <View>
              <SecTitle>Contact</SecTitle>
              <View style={s.grille}>
                {e.telephone ? (
                  <Bloc label={e.telephone.includes(",") ? "Téléphones" : "Téléphone"}>
                    {e.telephone.split(",").map((t: string, i: number) => <V key={i}>{fmtPhone(t.trim())}</V>)}
                  </Bloc>
                ) : null}
                {e.mail ? (
                  <Bloc label={e.mail.includes(",") ? "Emails" : "Email"}>
                    {e.mail.split(",").map((m: string, i: number) => <V key={i}>{m.trim()}</V>)}
                  </Bloc>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Activités de l'entreprise — arbre NAEMA */}
          {hasNaema && secteurs.length > 0 ? (
            <View>
              <SecTitle>Activités de l'entreprise</SecTitle>
              <View style={{ gap: 14 }}>
                {secIds.map((secId: number) => {
                  const sec = secteurs.find((x: any) => x.id === secId);
                  if (!sec) return null;
                  const brasDuSec = branches.filter((b: any) => b.secteur_id === secId && braIds.includes(b.id));
                  return (
                    <View key={`sec-${secId}`} style={{ gap: 8 }}>
                      <View style={s.arbreLigne}>
                        <View style={[s.arbrePoint, { width: 8, height: 8, backgroundColor: T.bleu, marginTop: 5 }]} />
                        <Text style={s.arbreSecteur}>{sec.nom}</Text>
                      </View>
                      {brasDuSec.length > 0 && (
                        <View style={s.arbreIndent}>
                          {brasDuSec.map((bra: any) => {
                            const actsDeBra = activites.filter((a: any) => a.branche_id === bra.id && actIds.includes(a.id));
                            return (
                              <View key={`bra-${bra.id}`} style={{ gap: 6 }}>
                                <View style={s.arbreLigne}>
                                  <View style={[s.arbrePoint, { width: 6, height: 6, backgroundColor: T.orange, marginTop: 6 }]} />
                                  <Text style={s.arbreBranche}>{bra.nom}</Text>
                                </View>
                                {actsDeBra.length > 0 && (
                                  <View style={{ paddingLeft: 16, gap: 5 }}>
                                    {actsDeBra.map((act: any) => (
                                      <View key={`act-${act.id}`} style={s.arbreLigne}>
                                        <View style={[s.arbrePoint, { width: 5, height: 5, backgroundColor: T.vert, marginTop: 6 }]} />
                                        <Text style={s.arbreActivite}>{act.nom}</Text>
                                      </View>
                                    ))}
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Points focaux */}
          {focaux.length > 0 ? (
            <View>
              <SecTitle>Points focaux</SecTitle>
              <View style={{ gap: 8 }}>
                {focaux.map((pf: any, i: number) => (
                  <View key={i} style={s.focal}>
                    <View style={s.focalEntete}>
                      <Text style={s.focalNom}>{[pf.civilite, pf.prenom, pf.nom].filter(Boolean).join(" ")}</Text>
                      {pf.poste ? <Text style={s.focalPoste}>{pf.poste}</Text> : null}
                      {pf.est_principal ? (
                        <View style={s.focalPrincipal}><Text style={s.focalPrincipalTexte}>Principal</Text></View>
                      ) : null}
                    </View>
                    {(pf.telephone || pf.mail) ? (
                      <View style={s.focalChips}>
                        {pf.telephone ? pf.telephone.split(",").map((t: string, ti: number) => (
                          <View key={`t${ti}`} style={[s.focalChip, { backgroundColor: "rgba(0,79,145,0.07)" }]}>
                            <Text style={[s.focalChipTexte, { color: T.bleu }]}>{fmtPhone(t.trim())}</Text>
                          </View>
                        )) : null}
                        {pf.mail ? pf.mail.split(",").map((m: string, mi: number) => (
                          <View key={`m${mi}`} style={[s.focalChip, { backgroundColor: "rgba(24,128,56,0.07)" }]}>
                            <Text style={[s.focalChipTexte, { color: T.vert }]}>{m.trim()}</Text>
                          </View>
                        )) : null}
                      </View>
                    ) : null}
                  </View>
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
  arbreLigne: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  arbrePoint: { borderRadius: 99, flexShrink: 0 },
  arbreIndent: { paddingLeft: 17, borderLeftWidth: 1.5, borderLeftColor: "rgba(0,79,145,0.12)", marginLeft: 3.5, gap: 8 },
  arbreSecteur: { flex: 1, fontSize: 13, fontFamily: POLICE.gras, color: T.bleu, lineHeight: 18 },
  arbreBranche: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: "#b5722f", lineHeight: 18 },
  arbreActivite: { flex: 1, fontSize: 12, fontFamily: POLICE.normal, color: "#4d8a63", lineHeight: 17 },
  focal: { backgroundColor: "#FAFAF9", borderWidth: 1, borderColor: "#F0EEEC", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  focalEntete: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  focalNom: { fontSize: 12.5, fontFamily: POLICE.gras, color: T.encre },
  focalPoste: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris },
  focalPrincipal: { backgroundColor: "rgba(202,99,31,0.08)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  focalPrincipalTexte: { fontSize: 10, fontFamily: POLICE.gras, color: T.orange },
  focalChips: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  focalChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  focalChipTexte: { fontSize: 11, fontFamily: POLICE.demi },
});
