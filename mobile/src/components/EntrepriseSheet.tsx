// Fiche entreprise — une fiche de contact, pas un modal de back-office.
//
// Le gain décisif du téléphone sur le web : il sait APPELER. La fiche mène
// donc par l'action — une rangée Appeler · Email · Site web sous l'identité,
// l'idiome de la fiche Contacts d'iOS — et chaque numéro ou adresse des
// points focaux est lui-même tappable (tel: / mailto:).
//
// Structure éditoriale, comme les autres fiches : identité (nom en grand,
// une ligne de méta forme · pôle · région), actions, puis sections plates —
// rangées clé-valeur, activités NAEMA, points focaux.
import { ActionSheetIOS, Alert, Linking, Platform, StyleSheet, Text, View } from "react-native";
import ArbreNaema, { useNaema } from "@/components/ArbreNaema";
import Icone from "@/components/Icone";
import { Feuille, Tapable } from "@/components/ui";
import { fmtDateLong } from "@/lib/format";
import { fmtPhone } from "@/lib/telephone";
import { POLICE, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={s.sectionTitre}>{titre.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Rangee({ label, valeur, onPress }: { label: string; valeur?: string | null; onPress?: () => void }) {
  if (!valeur) return null;
  const contenu = (
    <View style={s.rangee}>
      <Text style={s.rangeeLabel}>{label}</Text>
      <Text style={[s.rangeeValeur, onPress && { color: T.bleu }]} numberOfLines={2}>{valeur}</Text>
    </View>
  );
  return onPress ? <Tapable onPress={onPress} echelle={0.99}>{contenu}</Tapable> : contenu;
}

// Bouton de la rangée d'actions — n'apparaît que si la donnée existe
function Action({ sf, materiel, label, onPress }: { sf: string; materiel: string; label: string; onPress: () => void }) {
  return (
    <Tapable onPress={onPress} echelle={0.95} style={s.action}>
      <Icone sf={sf} materiel={materiel} taille={19} couleur={T.bleu} />
      <Text style={s.actionLabel}>{label}</Text>
    </Tapable>
  );
}

// Chip tappable (téléphone / email des points focaux)
function ChipContact({ texte, couleur, fond, onPress }: { texte: string; couleur: string; fond: string; onPress: () => void }) {
  return (
    <Tapable onPress={onPress} echelle={0.95} style={[s.chip, { backgroundColor: fond }]}>
      <Text style={[s.chipTexte, { color: couleur }]}>{texte}</Text>
    </Tapable>
  );
}

const ouvrirTel = (t: string) => Linking.openURL(`tel:${t.replace(/[^\d+]/g, "")}`).catch(() => {});
const ouvrirMail = (m: string) => Linking.openURL(`mailto:${m.trim()}`).catch(() => {});
const ouvrirSite = (u: string) => Linking.openURL(u.startsWith("http") ? u : `https://${u}`).catch(() => {});

// À plusieurs numéros ou adresses, on PROPOSE au lieu de choisir à la place
// de l'utilisateur : feuille d'action native sur iOS, alerte à boutons ailleurs.
function proposer(titre: string, libelles: string[], agir: (index: number) => void) {
  if (libelles.length === 1) { agir(0); return; }
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: titre, options: [...libelles, "Annuler"], cancelButtonIndex: libelles.length },
      i => { if (i < libelles.length) agir(i); },
    );
  } else {
    Alert.alert(titre, undefined, [
      ...libelles.map((l, i) => ({ text: l, onPress: () => agir(i) })),
      { text: "Annuler", style: "cancel" as const },
    ]);
  }
}

export default function EntrepriseSheet({ entreprise: e, onClose }: { entreprise: any; onClose: () => void }) {
  const { secteurs } = useNaema();

  const secIds: number[] = e.secteur_ids || [];
  const braIds: number[] = e.branche_ids || [];
  const actIds: number[] = e.activite_ids || [];
  const hasNaema = secIds.length > 0 || braIds.length > 0 || actIds.length > 0;
  const locStr = [e.arrondissement_nom, e.departement_nom, e.region_nom].filter(Boolean).join(", ");
  const paysStr = e.siege_pays_nom || e.pays || null;
  const focaux: any[] = Array.isArray(e.points_focaux) ? e.points_focaux : [];

  const telephones: string[] = (e.telephone || "").split(",").map((t: string) => t.trim()).filter(Boolean);
  const mails: string[] = (e.mail || "").split(",").map((m: string) => m.trim()).filter(Boolean);
  const meta = [
    (e.forme_juridique || "").replace(/\s*\([^)]*\)\s*$/, ""),
    e.pole_territoire_nom,
    e.region_nom ? `Région de ${e.region_nom}` : null,
  ].filter(Boolean).join("   ·   ");

  return (
    <Feuille onClose={onClose} ecart={22}
      titre={<Text style={s.titre}>{e.nom}</Text>}
      sousEntete={meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : undefined}>

      {/* ── Agir : appeler, écrire, visiter — l'atout du téléphone ── */}
      {(telephones.length > 0 || mails.length > 0 || e.siteweb) && (
        <View style={s.actions}>
          {telephones.length > 0 && (
            <Action sf="phone" materiel="call" label="Appeler"
              onPress={() => proposer("Appeler", telephones.map(fmtPhone), i => ouvrirTel(telephones[i]))} />
          )}
          {mails.length > 0 && (
            <Action sf="envelope" materiel="mail" label="Email"
              onPress={() => proposer("Écrire à", mails, i => ouvrirMail(mails[i]))} />
          )}
          {e.siteweb && (
            <Action sf="safari" materiel="language" label="Site web" onPress={() => ouvrirSite(e.siteweb)} />
          )}
        </View>
      )}

      {/* ── Informations ── */}
      <Section titre="Informations">
        <View style={s.rangees}>
          <Rangee label="Création" valeur={e.date_creation ? fmtDateLong(e.date_creation) : null} />
          <Rangee label="Pays du siège" valeur={paysStr} />
          <Rangee label="Localisation" valeur={locStr || null} />
          <Rangee label="Adresse" valeur={e.adresse} />
          {telephones.map((t, i) => (
            <Rangee key={`t${i}`} label={i === 0 ? (telephones.length > 1 ? "Téléphones" : "Téléphone") : ""}
              valeur={fmtPhone(t)} onPress={() => ouvrirTel(t)} />
          ))}
          {mails.map((m, i) => (
            <Rangee key={`m${i}`} label={i === 0 ? (mails.length > 1 ? "Emails" : "Email") : ""}
              valeur={m} onPress={() => ouvrirMail(m)} />
          ))}
          <Rangee label="Site web" valeur={e.siteweb} onPress={e.siteweb ? () => ouvrirSite(e.siteweb) : undefined} />
        </View>
      </Section>

      {/* ── Activités (hiérarchie NAEMA existante) ── */}
      {hasNaema && secteurs.length > 0 ? (
        <Section titre="Activités de l'entreprise">
          <ArbreNaema secIds={secIds} braIds={braIds} actIds={actIds} />
        </Section>
      ) : null}

      {/* ── Points focaux : les personnes, avec leurs actions ── */}
      {focaux.length > 0 ? (
        <Section titre="Points focaux">
          <View style={{ gap: 8 }}>
            {focaux.map((pf: any, i: number) => (
              <View key={i} style={s.focal}>
                <View style={s.focalEntete}>
                  <Text style={s.focalNom}>{[pf.civilite, pf.prenom, pf.nom].filter(Boolean).join(" ")}</Text>
                  {pf.est_principal ? (
                    <View style={s.focalPrincipal}><Text style={s.focalPrincipalTexte}>Principal</Text></View>
                  ) : null}
                </View>
                {pf.poste ? <Text style={s.focalPoste}>{pf.poste}</Text> : null}
                {(pf.telephone || pf.mail) ? (
                  <View style={s.focalChips}>
                    {(pf.telephone || "").split(",").map((t: string) => t.trim()).filter(Boolean).map((t: string, ti: number) => (
                      <ChipContact key={`t${ti}`} texte={fmtPhone(t)} couleur={T.bleu as string}
                        fond={T.bleuVoile as string} onPress={() => ouvrirTel(t)} />
                    ))}
                    {(pf.mail || "").split(",").map((m: string) => m.trim()).filter(Boolean).map((m: string, mi: number) => (
                      <ChipContact key={`m${mi}`} texte={m} couleur={T.vert as string}
                        fond="rgba(24,128,56,0.07)" onPress={() => ouvrirMail(m)} />
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </Section>
      ) : null}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  titre: { fontSize: 21, fontFamily: POLICE.gras, color: T.encre, lineHeight: 27, letterSpacing: -0.4, flex: 1 },
  meta: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.gris, marginTop: 7 },

  actions: { flexDirection: "row", gap: 8 },
  action: {
    flex: 1, alignItems: "center", gap: 5, paddingVertical: 11,
    backgroundColor: T.bleuVoile, borderRadius: 14,
  },
  actionLabel: { fontSize: 11, fontFamily: POLICE.demi, color: T.bleu },

  sectionTitre: { ...TYPO.micro, color: T.bleu, marginBottom: 10 },
  rangees: { gap: 9 },
  rangee: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  rangeeLabel: { width: 104, fontSize: 13, fontFamily: POLICE.normal, color: T.gris, lineHeight: 18 },
  rangeeValeur: { flex: 1, fontSize: 13, fontFamily: POLICE.demi, color: T.encre, lineHeight: 18 },

  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipTexte: { fontSize: 11, fontFamily: POLICE.demi },

  focal: { backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.carteBord, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  focalEntete: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  focalNom: { flex: 1, minWidth: 0, fontSize: 13, fontFamily: POLICE.gras, color: T.encre },
  focalPoste: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  focalPrincipal: { backgroundColor: "rgba(202,99,31,0.08)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  focalPrincipalTexte: { fontSize: 10, fontFamily: POLICE.gras, color: T.orange },
  focalChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
}));
