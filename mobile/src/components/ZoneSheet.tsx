// Fiche zone — réplique du modal ZoneDetailModal de la plateforme :
// en-tête à pilules (type ZES/ZAI/ZFI coloré, pôle), Informations en
// grille (localisation, superficie, création, décret), Description,
// Activités autorisées (arbre NAEMA), Entreprises installées / éligibles
// (chaque ligne ouvre la fiche entreprise), Documents.
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ArbreNaema from "@/components/ArbreNaema";
import EntrepriseSheet from "@/components/EntrepriseSheet";
import Symbole from "@/components/Symbole";
import { API, getJson } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { zoneTypeMeta } from "@/lib/zoneTypes";
import { POLICE, T } from "@/theme";

// La description est stockée en HTML riche (site) : on la ramène à du texte
// avec puces et sauts de ligne pour l'app.
export function htmlEnTexte(html: string): string {
  return html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|ul|ol|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, "\"")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

export default function ZoneSheet({ zone, onClose }: { zone: any; onClose: () => void }) {
  const [ficheEnt, setFicheEnt] = useState<any>(null);

  const meta      = zoneTypeMeta(zone.type_zone);
  const col       = meta.color;
  const installes = (zone.entreprises || []).filter((ze: any) => ze.statut === "installee");
  const eligibles = (zone.entreprises || []).filter((ze: any) => ze.statut === "eligible");
  const secIds: number[] = zone.secteur_ids || [];
  const braIds: number[] = zone.branche_ids || [];
  const actIds: number[] = zone.activite_ids || [];
  const hasActivites = secIds.length > 0 || braIds.length > 0 || actIds.length > 0;
  const locStr = [zone.departement_nom, zone.region_nom].filter(Boolean).join(", ");
  const fichiers: any[] = Array.isArray(zone.fichiers) ? zone.fichiers : [];

  const ouvrirFiche = async (id?: number) => {
    if (!id) return;
    try { setFicheEnt(await getJson(`/entreprises/${id}`)); } catch {}
  };

  const LigneEnt = ({ ze }: { ze: any }) => (
    <Pressable onPress={() => ouvrirFiche(ze.entreprise?.id)}
      style={({ pressed }) => [s.ent, pressed && { backgroundColor: T.carte, borderColor: "rgba(0,79,145,0.25)" }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.entNom} numberOfLines={1}>{ze.entreprise?.nom}</Text>
        {ze.entreprise?.forme_juridique ? <Text style={s.entForme} numberOfLines={1}>{ze.entreprise.forme_juridique}</Text> : null}
      </View>
      <View style={s.entFiche}><Text style={s.entFicheTexte}>Fiche</Text><Ionicons name="chevron-forward" size={11} color={T.bleu} /></View>
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.fond} onPress={onClose} />
      <View style={s.feuille}>
        <View style={s.poignee} />
        {/* En-tête : nom + pilules type / pôle (comme le site) */}
        <View style={s.entete}>
          <Text style={s.titre}>{zone.nom_zone}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={s.fermer}>
            <Ionicons name="close" size={17} color={T.texte} />
          </Pressable>
        </View>
        <View style={s.pilules}>
          <View style={[s.pilule, { backgroundColor: `${col}12` }]}><Text style={[s.piluleTexte, { color: col, letterSpacing: 0.4 }]}>{zone.type_zone}</Text></View>
          {zone.pole_nom ? <View style={[s.pilule, { backgroundColor: T.bleuVoile }]}><Text style={[s.piluleTexte, { color: T.bleu }]}>{zone.pole_nom}</Text></View> : null}
        </View>

        <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ gap: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          {/* Informations */}
          {(zone.date_creation || zone.superficie || locStr || zone.decret_creation) ? (
            <View>
              <SecTitle>Informations</SecTitle>
              <View style={s.grille}>
                {locStr ? <Bloc label="Localisation"><Text style={s.blocValeur}>{locStr}</Text></Bloc> : null}
                {zone.superficie ? <Bloc label="Superficie"><Text style={s.blocValeur}>{Number(zone.superficie).toLocaleString("fr-FR")} ha</Text></Bloc> : null}
                {zone.date_creation ? <Bloc label="Création"><Text style={s.blocValeur}>{fmtDate(zone.date_creation)}</Text></Bloc> : null}
                {zone.decret_creation ? <Bloc label="Décret"><Text style={s.blocValeur}>{zone.decret_creation}</Text></Bloc> : null}
              </View>
            </View>
          ) : null}

          {/* Description */}
          {zone.description ? (
            <View>
              <SecTitle>Description</SecTitle>
              <View style={s.description}>
                <Text style={s.descriptionTexte}>{htmlEnTexte(zone.description)}</Text>
              </View>
            </View>
          ) : null}

          {/* Activités autorisées — arbre NAEMA */}
          {hasActivites ? (
            <View>
              <SecTitle>Activités autorisées</SecTitle>
              <ArbreNaema secIds={secIds} braIds={braIds} actIds={actIds} />
            </View>
          ) : null}

          {/* Entreprises installées */}
          {installes.length > 0 ? (
            <View>
              <SecTitle>{`Entreprises installées (${installes.length})`}</SecTitle>
              <View style={{ gap: 6 }}>
                {installes.map((ze: any) => <LigneEnt key={ze.id || ze.entreprise?.id} ze={ze} />)}
              </View>
            </View>
          ) : null}

          {/* Entreprises éligibles */}
          {eligibles.length > 0 ? (
            <View>
              <SecTitle>{`Entreprises éligibles (${eligibles.length})`}</SecTitle>
              <View style={{ gap: 6 }}>
                {eligibles.map((ze: any) => <LigneEnt key={ze.id || ze.entreprise?.id} ze={ze} />)}
              </View>
            </View>
          ) : null}

          {/* Documents PDF */}
          {fichiers.length > 0 ? (
            <View>
              <SecTitle>{fichiers.length > 1 ? "Documents" : "Document"}</SecTitle>
              <View style={{ gap: 5 }}>
                {fichiers.map((f: any) => (
                  <Pressable key={f.id} onPress={() => Linking.openURL(`${API}/zones-types/${zone.id}/fichiers/${f.id}/download`)}
                    style={({ pressed }) => [s.doc, pressed && { backgroundColor: "rgba(0,79,145,0.09)" }]}>
                    <Symbole nom="description" taille={15} couleur={T.bleu} />
                    <Text style={s.docTexte} numberOfLines={1}>{f.titre || f.nom}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* Fiche entreprise par-dessus la fiche zone */}
        {ficheEnt && <EntrepriseSheet entreprise={ficheEnt} onClose={() => setFicheEnt(null)} />}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(2,20,38,0.45)" },
  feuille: {
    backgroundColor: T.carte, borderTopLeftRadius: 26, borderTopRightRadius: 26,
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
    backgroundColor: T.blocFond, borderWidth: 1, borderColor: T.blocBord,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexGrow: 1, flexBasis: "45%",
  },
  blocLabel: { fontSize: 9, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1, marginBottom: 4 },
  blocValeur: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre, lineHeight: 18 },
  description: { backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.bordureDouce, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 13 },
  descriptionTexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.texte, lineHeight: 21 },
  ent: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.bordureDouce, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  entNom: { fontSize: 13, fontFamily: POLICE.gras, color: T.encre },
  entForme: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 1 },
  entFiche: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: T.bleuVoile, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4.5 },
  entFicheTexte: { fontSize: 11, fontFamily: POLICE.demi, color: T.bleu },
  doc: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.bleuVoile, borderWidth: 1, borderColor: T.blocBord,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  docTexte: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: T.bleu },
});
