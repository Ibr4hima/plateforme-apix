// Fiche entreprise — réplique du modal EntreprisePublicModal de la
// plateforme : en-tête à pilules (forme juridique, pôle, région),
// Informations en grille, Contact (téléphones formatés, emails),
// Activités de l'entreprise (arbre NAEMA secteur → branche → activité),
// Points focaux avec chips téléphone/mail.
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import ArbreNaema, { useNaema } from "@/components/ArbreNaema";
import { Feuille } from "@/components/ui";
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
  const { secteurs } = useNaema();

  const secIds: number[] = e.secteur_ids || [];
  const braIds: number[] = e.branche_ids || [];
  const actIds: number[] = e.activite_ids || [];
  const hasNaema = secIds.length > 0 || braIds.length > 0 || actIds.length > 0;
  // Mêmes règles que le site
  const locStr = [e.arrondissement_nom, e.departement_nom, e.region_nom].filter(Boolean).join(", ");
  const paysStr = e.siege_pays_nom || e.pays || null;
  const focaux: any[] = Array.isArray(e.points_focaux) ? e.points_focaux : [];

  return (
    <Feuille onClose={onClose} titre={e.nom}
      sousEntete={
        <View style={s.pilules}>
          {e.forme_juridique ? <View style={[s.pilule, { backgroundColor: T.filet }]}><Text style={[s.piluleTexte, { color: T.texte }]}>{e.forme_juridique}</Text></View> : null}
          {e.pole_territoire_nom ? <View style={[s.pilule, { backgroundColor: "rgba(106,27,154,0.07)" }]}><Text style={[s.piluleTexte, { color: "#6A1B9A" }]}>{e.pole_territoire_nom}</Text></View> : null}
          {e.region_nom ? <View style={[s.pilule, { backgroundColor: T.bleuVoile }]}><Text style={[s.piluleTexte, { color: T.bleu }]}>Région de {e.region_nom}</Text></View> : null}
        </View>
      }>
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
              <ArbreNaema secIds={secIds} braIds={braIds} actIds={actIds} />
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
                          <View key={`t${ti}`} style={[s.focalChip, { backgroundColor: T.bleuVoile }]}>
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
    </Feuille>
  );
}

const s = StyleSheet.create({
  pilules: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  pilule: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3.5 },
  piluleTexte: { fontSize: 10.5, fontFamily: POLICE.gras },
  secTitle: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.6, marginBottom: 10 },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bloc: {
    backgroundColor: T.blocFond, borderWidth: 1, borderColor: T.blocBord,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexGrow: 1, flexBasis: "45%",
  },
  blocLabel: { fontSize: 9, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1, marginBottom: 4 },
  blocValeur: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre, lineHeight: 18 },
  focal: { backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.bordureDouce, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  focalEntete: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  focalNom: { fontSize: 12.5, fontFamily: POLICE.gras, color: T.encre },
  focalPoste: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris },
  focalPrincipal: { backgroundColor: "rgba(227,83,54,0.08)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  focalPrincipalTexte: { fontSize: 10, fontFamily: POLICE.gras, color: T.orange },
  focalChips: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  focalChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  focalChipTexte: { fontSize: 11, fontFamily: POLICE.demi },
});
