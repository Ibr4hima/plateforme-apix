// Fiche zone — éditoriale, comme les autres fiches : identité (nom en grand,
// une ligne de méta type · pôle · localisation), une rangée de faits
// Superficie | Entreprises | Création sous filet — les trois chiffres qu'on
// vient chercher — puis des sections plates : description, activités NAEMA,
// entreprises (chaque ligne ouvre la fiche entreprise), documents.
//
// Plus de grille de blocs ni d'encadrés : du texte bien hiérarchisé, des
// filets fins, l'écran respire.
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import ArbreNaema from "@/components/ArbreNaema";
import EntrepriseSheet from "@/components/EntrepriseSheet";
import Symbole from "@/components/Symbole";
import TexteRiche from "@/components/TexteRiche";
import { Feuille, Tapable } from "@/components/ui";
import { API, getJson } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { zoneTypeMeta } from "@/lib/zoneTypes";
import { POLICE, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";
import { useTeinte } from "@/lib/couleurs";

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

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={s.sectionTitre}>{titre.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Rangee({ label, valeur }: { label: string; valeur?: string | null }) {
  if (!valeur) return null;
  return (
    <View style={s.rangee}>
      <Text style={s.rangeeLabel}>{label}</Text>
      <Text style={s.rangeeValeur}>{valeur}</Text>
    </View>
  );
}

// Une ligne d'entreprise — plate, filet entre les lignes, la fiche au tap
function LigneEnt({ ze, premier, onPress }: { ze: any; premier: boolean; onPress: () => void }) {
  return (
    <Tapable onPress={onPress} echelle={0.99} style={[s.ent, !premier && s.entBord]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.entNom} numberOfLines={1}>{ze.entreprise?.nom}</Text>
        {ze.entreprise?.forme_juridique ? (
          <Text style={s.entForme} numberOfLines={1}>{ze.entreprise.forme_juridique}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={14} color={T.grisClair} />
    </Tapable>
  );
}

export default function ZoneSheet({ zone, onClose }: { zone: any; onClose: () => void }) {
  const [ficheEnt, setFicheEnt] = useState<any>(null);

  const teinte = useTeinte();
  const col = teinte(zoneTypeMeta(zone.type_zone).color);
  const installes = (zone.entreprises || []).filter((ze: any) => ze.statut === "installee");
  const eligibles = (zone.entreprises || []).filter((ze: any) => ze.statut === "eligible");
  const secIds: number[] = zone.secteur_ids || [];
  const braIds: number[] = zone.branche_ids || [];
  const actIds: number[] = zone.activite_ids || [];
  const hasActivites = secIds.length > 0 || braIds.length > 0 || actIds.length > 0;
  const locStr = [zone.departement_nom, zone.region_nom].filter(Boolean).join(", ");
  const fichiers: any[] = Array.isArray(zone.fichiers) ? zone.fichiers : [];
  const nbEnts = (zone.entreprises || []).length;

  const ouvrirFiche = async (id?: number) => {
    if (!id) return;
    try { setFicheEnt(await getJson(`/entreprises/${id}`)); } catch {}
  };

  return (
    <Feuille onClose={onClose} ecart={22}
      titre={<Text style={s.titre}>{zone.nom_zone}</Text>}
      sousEntete={
        <Text style={s.meta} numberOfLines={1}>
          <Text style={{ color: col, fontFamily: POLICE.gras }}>{zone.type_zone}</Text>
          {[zone.pole_nom, locStr].filter(Boolean).map(p => `   ·   ${p}`).join("")}
        </Text>
      }
      pied={ficheEnt ? <EntrepriseSheet entreprise={ficheEnt} onClose={() => setFicheEnt(null)} /> : null}>

      {/* ── Les trois chiffres qu'on vient chercher ── */}
      <View style={s.faits}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.faitLabel}>SUPERFICIE</Text>
          <Text style={[s.faitVal, !zone.superficie && { color: T.grisClair }]} numberOfLines={1}>
            {zone.superficie ? `${Number(zone.superficie).toLocaleString("fr-FR")} ha` : "—"}
          </Text>
        </View>
        <View style={s.faitSep} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.faitLabel}>ENTREPRISE{nbEnts > 1 ? "S" : ""}</Text>
          <Text style={[s.faitVal, nbEnts === 0 && { color: T.grisClair }]}>{nbEnts}</Text>
        </View>
        <View style={s.faitSep} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.faitLabel}>CRÉATION</Text>
          <Text style={[s.faitVal, !zone.date_creation && { color: T.grisClair }]} numberOfLines={1}>
            {zone.date_creation ? fmtDate(zone.date_creation) : "—"}
          </Text>
        </View>
      </View>

      {/* ── Informations complémentaires ── */}
      {zone.decret_creation ? (
        <Section titre="Informations">
          <View style={s.rangees}>
            <Rangee label="Décret" valeur={zone.decret_creation} />
          </View>
        </Section>
      ) : null}

      {/* ── Description ── */}
      {zone.description ? (
        <Section titre="Description">
          <TexteRiche html={zone.description} couleur={T.texte as any} fontSize={13} lineHeight={21} />
        </Section>
      ) : null}

      {/* ── Activités autorisées — hiérarchie NAEMA partagée ── */}
      {hasActivites ? (
        <Section titre="Activités autorisées">
          <ArbreNaema secIds={secIds} braIds={braIds} actIds={actIds} />
        </Section>
      ) : null}

      {/* ── Entreprises — chaque ligne ouvre la fiche ── */}
      {installes.length > 0 ? (
        <Section titre={`Entreprises installées (${installes.length})`}>
          <View>
            {installes.map((ze: any, i: number) => (
              <LigneEnt key={ze.id || ze.entreprise?.id} ze={ze} premier={i === 0}
                onPress={() => ouvrirFiche(ze.entreprise?.id)} />
            ))}
          </View>
        </Section>
      ) : null}
      {eligibles.length > 0 ? (
        <Section titre={`Entreprises éligibles (${eligibles.length})`}>
          <View>
            {eligibles.map((ze: any, i: number) => (
              <LigneEnt key={ze.id || ze.entreprise?.id} ze={ze} premier={i === 0}
                onPress={() => ouvrirFiche(ze.entreprise?.id)} />
            ))}
          </View>
        </Section>
      ) : null}

      {/* ── Documents ── */}
      {fichiers.length > 0 ? (
        <Section titre={fichiers.length > 1 ? "Documents" : "Document"}>
          <View style={{ gap: 8 }}>
            {fichiers.map((f: any) => (
              <Tapable key={f.id} echelle={0.98} style={s.doc}
                onPress={() => Linking.openURL(`${API}/zones-types/${zone.id}/fichiers/${f.id}/download`).catch(() => {})}>
                <Symbole nom="description" taille={16} couleur={T.bleu} />
                <Text style={s.docTexte} numberOfLines={1}>{f.titre || f.nom}</Text>
              </Tapable>
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

  faits: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: T.bordure,
  },
  faitSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure, marginHorizontal: 14 },
  faitLabel: { fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 1, color: T.gris, marginBottom: 3 },
  faitVal: { fontSize: 14, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },

  sectionTitre: { ...TYPO.micro, color: T.bleu, marginBottom: 10 },
  rangees: { gap: 9 },
  rangee: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  rangeeLabel: { width: 104, fontSize: 13, fontFamily: POLICE.normal, color: T.gris, lineHeight: 18 },
  rangeeValeur: { flex: 1, fontSize: 13, fontFamily: POLICE.demi, color: T.encre, lineHeight: 18 },

  ent: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  entBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  entNom: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre },
  entForme: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 1 },

  doc: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: T.bleuVoile, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10,
  },
  docTexte: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: T.bleu },
}));
