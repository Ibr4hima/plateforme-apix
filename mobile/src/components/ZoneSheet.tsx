// Fiche zone — éditoriale, comme les autres fiches : identité (nom en grand,
// une ligne de méta type · pôle · localisation), une rangée de faits
// Superficie | Entreprises | Création sous filet — les trois chiffres qu'on
// vient chercher — puis des sections plates : description, activités NAEMA,
// entreprises (chaque ligne ouvre la fiche entreprise), documents.
//
// Les listes du système (ListeIOS), sur iOS comme sur Android : les trois
// chiffres dans un bloc blanc, les informations en lignes, la description et
// les activités chacune dans son bloc, les entreprises et les documents en
// listes qui mènent à leur fiche ou à leur fichier.
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import ArbreNaema from "@/components/ArbreNaema";
import EntrepriseSheet from "@/components/EntrepriseSheet";
import TexteRiche from "@/components/TexteRiche";
import { Bloc, Chevron, EnTeteSection, Groupe, GroupeDocuments, Ligne, LigneValeur } from "@/components/ListeIOS";
import { useVisionneuse } from "@/components/Visionneuse";
import { Feuille } from "@/components/ui";
import { API, getJson } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { zoneTypeMeta } from "@/lib/zoneTypes";
import { coin, POLICE, T } from "@/theme";
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

/** `liste` : la section porte des lignes (un groupe) plutôt qu'un contenu
    libre (un bloc). */
function Section({ titre, liste, children }: { titre: string; liste?: boolean; children: React.ReactNode }) {
  return <View><EnTeteSection titre={titre} />{liste ? children : <Bloc>{children}</Bloc>}</View>;
}

function Rangee({ label, valeur }: { label: string; valeur?: string | null }) {
  if (!valeur) return null;
  return <LigneValeur label={label} valeur={valeur} />;
}

// Une ligne d'entreprise — la fiche au toucher
function LigneEnt({ ze, onPress }: { ze: any; onPress: () => void }) {
  return (
    <Ligne label={ze.entreprise?.nom ?? "—"} legende={ze.entreprise?.forme_juridique || undefined}
      lignes={1} onPress={onPress} accessoire={<Chevron />} />
  );
}

export default function ZoneSheet({ zone, onClose }: { zone: any; onClose: () => void }) {
  // Les documents s'ouvrent dans l'app (visionneuse), pas dans Safari
  const { ouvrir: ouvrirDoc, element: visionneuse } = useVisionneuse();
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
    <Feuille onClose={onClose} ecart={22} fondGroupe
      titre={zone.nom_zone}
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
          <Text style={[s.faitVal, !zone.superficie && { color: T.grisClair }]} numberOfLines={1}
            adjustsFontSizeToFit minimumFontScale={0.8}>{zone.superficie ? `${Number(zone.superficie).toLocaleString("fr-FR")} ha` : "—"}</Text>
        </View>
        <View style={s.faitSep} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.faitLabel}>ENTREPRISE{nbEnts > 1 ? "S" : ""}</Text>
          <Text style={[s.faitVal, nbEnts === 0 && { color: T.grisClair }]}>{nbEnts}</Text>
        </View>
        <View style={s.faitSep} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.faitLabel}>CRÉATION</Text>
          {/* Trois chiffres sur la largeur d'un téléphone : la date se resserre plutôt que de se couper */}
          <Text style={[s.faitVal, !zone.date_creation && { color: T.grisClair }]} numberOfLines={1}
            adjustsFontSizeToFit minimumFontScale={0.8}>{zone.date_creation ? fmtDate(zone.date_creation) : "—"}</Text>
        </View>
      </View>

      {/* ── Informations complémentaires ── */}
      {zone.decret_creation ? (
        <Section titre="Informations" liste>
          <Groupe><Rangee label="Décret" valeur={zone.decret_creation} /></Groupe>
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
        <Section titre={`Entreprises installées (${installes.length})`} liste>
          <Groupe>
            {installes.map((ze: any) => (
              <LigneEnt key={ze.id || ze.entreprise?.id} ze={ze} onPress={() => ouvrirFiche(ze.entreprise?.id)} />
            ))}
          </Groupe>
        </Section>
      ) : null}
      {eligibles.length > 0 ? (
        <Section titre={`Entreprises éligibles (${eligibles.length})`} liste>
          <Groupe>
            {eligibles.map((ze: any) => (
              <LigneEnt key={ze.id || ze.entreprise?.id} ze={ze} onPress={() => ouvrirFiche(ze.entreprise?.id)} />
            ))}
          </Groupe>
        </Section>
      ) : null}

      {/* ── Documents ── */}
      {fichiers.length > 0 ? (
        <Section titre={fichiers.length > 1 ? "Documents" : "Document"} liste>
          <GroupeDocuments fichiers={fichiers}
            ouvrir={f => ouvrirDoc(`${API}/zones-types/${zone.id}/fichiers/${f.id}/download`, f.titre || f.nom)} />
        </Section>
      ) : null}
      {visionneuse}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  meta: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.gris, marginTop: 7 },

  // Les trois chiffres dans un bloc blanc du groupe
  faits: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.carte, borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord, borderRadius: coin(16), borderCurve: "continuous", paddingVertical: 14, paddingHorizontal: 14,
  },
  faitSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure, marginHorizontal: 11 },
  faitLabel: { fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 1, color: T.gris, marginBottom: 3 },
  faitVal: { fontSize: 14, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
}));
