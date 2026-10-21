// Fiche pôle territorial — éditoriale, comme les autres fiches : identité
// (silhouette du pôle en tuile pastel, nom en grand, régions en méta), une
// rangée de faits Zones | Entreprises | Régions sous filet, puis des sections
// plates : zones du pôle (chaque ligne ouvre la fiche zone), répartition
// sectorielle en barres fines, documents.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SilhouettePole } from "@/components/SilhouetteRegion";
import ZoneSheet from "@/components/ZoneSheet";
import { Bloc, Chevron, EnTeteSection, Groupe, GroupeDocuments, Ligne } from "@/components/ListeIOS";
import { useVisionneuse } from "@/components/Visionneuse";
import { Feuille } from "@/components/ui";
import { API, getJson } from "@/lib/api";
import { POLE_COULEURS, foncerPastel, normPole, useTeinte } from "@/lib/couleurs";
import { zoneTypeMeta } from "@/lib/zoneTypes";
import { POLICE, T } from "@/theme";
import { creerStyles } from "@/lib/apparence";

// « Kaolack, Fatick et Kaffrine » → ["Kaolack","Fatick","Kaffrine"] (règle du site)
export const splitLocalisation = (loc: string): string[] =>
  (loc || "").split(/,\s*|\s+et\s+/).map(x => x.trim()).filter(Boolean);

// Une FONCTION, pas une constante de module : sur Android un jeton se lit au
// rendu — figé à l'import, il resterait au schéma du lancement.
const secteursRepartition = () => [
  { label: "Secteur primaire",   cle: "primaire",   couleur: T.bleu },
  { label: "Secteur secondaire", cle: "secondaire", couleur: T.orange },
  { label: "Secteur tertiaire",  cle: "tertiaire",  couleur: T.vert },
] as const;

// La fiche se lit en listes groupées, sur iOS comme sur Android (ListeIOS) :
// les chiffres du pôle dans un bloc blanc, ses zones en liste (la pastille de
// leur type en tête), la répartition sectorielle dans son bloc, les documents
// en liste.

/** `liste` : la section porte des lignes (un groupe) plutôt qu'un contenu
    libre (un bloc). */
function Section({ titre, liste, children }: { titre: string; liste?: boolean; children: React.ReactNode }) {
  return <View><EnTeteSection titre={titre} />{liste ? children : <Bloc>{children}</Bloc>}</View>;
}

export default function PoleSheet({ pole, zones, onClose }: { pole: any; zones: any[]; onClose: () => void }) {
  // Les documents s'ouvrent dans l'app (visionneuse), pas dans Safari
  const { ouvrir: ouvrirDoc, element: visionneuse } = useVisionneuse();
  const teinte = useTeinte();
  const [zoneOuverte, setZoneOuverte] = useState<any>(null);

  const pastel    = POLE_COULEURS[normPole(pole.pole_territoire)] || "#C5BFBB";
  const regions   = splitLocalisation(pole.localisation);
  const poleZones = zones.filter(z => z.pole_id === pole.id);
  const nbInst    = poleZones.reduce((n, z) => n + (z.entreprises || []).filter((ze: any) => ze.statut === "installee").length, 0);
  const fichiers: any[] = Array.isArray(pole.fichiers) ? pole.fichiers : [];

  // Répartition sectorielle des régions du pôle (même endpoint que le site)
  const { data: statsRegions } = useQuery({
    queryKey: ["region-stats"], queryFn: () => getJson<any[]>("/dashboard/viz/region-stats"),
  });
  const compte = { primaire: 0, secondaire: 0, tertiaire: 0 };
  for (const r of regions) {
    const st = (statsRegions || []).find((x: any) => x.region === r);
    if (!st) continue;
    compte.primaire += st.primaire; compte.secondaire += st.secondaire; compte.tertiaire += st.tertiaire;
  }
  const totalSect = compte.primaire + compte.secondaire + compte.tertiaire;

  return (
    <Feuille onClose={onClose} ecart={22} fondGroupe
      titre={
        <View style={s.entete}>
          {/* La forme du territoire d'abord — la même tuile que la liste */}
          <View style={[s.tuile, { backgroundColor: `${pastel}33` }]}>
            <SilhouettePole noms={regions} taille={38} couleur={foncerPastel(pastel)} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.surtitre}>PÔLE TERRITORIAL</Text>
            <Text style={s.titre}>{pole.pole_territoire}</Text>
          </View>
        </View>
      }
      sousEntete={regions.length > 0 ? (
        <Text style={s.meta} numberOfLines={1}>{regions.join(" · ")}</Text>
      ) : undefined}
      pied={zoneOuverte ? <ZoneSheet zone={zoneOuverte} onClose={() => setZoneOuverte(null)} /> : null}>

      {/* ── Les trois chiffres du pôle ── */}
      <View style={s.faits}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.faitLabel}>ZONE{poleZones.length > 1 ? "S" : ""}</Text>
          <Text style={[s.faitVal, poleZones.length === 0 && { color: T.grisClair }]}>{poleZones.length}</Text>
        </View>
        <View style={s.faitSep} />
        <View style={{ flex: 1.4, minWidth: 0 }}>
          <Text style={s.faitLabel}>ENTREPRISE{nbInst > 1 ? "S" : ""} INSTALLÉE{nbInst > 1 ? "S" : ""}</Text>
          <Text style={[s.faitVal, nbInst === 0 && { color: T.grisClair }]}>{nbInst}</Text>
        </View>
        <View style={s.faitSep} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.faitLabel}>RÉGION{regions.length > 1 ? "S" : ""}</Text>
          <Text style={s.faitVal}>{regions.length}</Text>
        </View>
      </View>

      {/* ── Zones du pôle — chaque ligne ouvre la fiche zone ── */}
      {poleZones.length > 0 && (
        <Section titre="Zones d'investissement" liste>
          <Groupe>
            {poleZones.map((z: any) => {
              const nbEnts = (z.entreprises || []).filter((ze: any) => ze.statut === "installee").length;
              return (
                <Ligne key={z.id} label={z.nom_zone} lignes={1} onPress={() => setZoneOuverte(z)}
                  legende={`${z.type_zone}   ·   ${nbEnts} entreprise${nbEnts > 1 ? "s" : ""} installée${nbEnts > 1 ? "s" : ""}`}
                  avant={<View style={[s.pastilleType, { backgroundColor: teinte(zoneTypeMeta(z.type_zone).color) }]} />}
                  accessoire={<Chevron />} />
              );
            })}
          </Groupe>
        </Section>
      )}

      {/* ── Répartition sectorielle des régions du pôle ── */}
      {totalSect > 0 && (
        <Section titre="Répartition sectorielle">
          <View style={{ gap: 12 }}>
            {secteursRepartition().map(r => {
              const pct = Math.round(compte[r.cle] / totalSect * 100);
              return (
                <View key={r.cle}>
                  <View style={s.barLigne}>
                    <Text style={s.barLabel}>{r.label}</Text>
                    <Text style={[s.barPct, { color: r.couleur }]}>{pct} %</Text>
                  </View>
                  <View style={s.barFond}>
                    <View style={[s.barRempli, { width: `${pct}%`, backgroundColor: r.couleur }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </Section>
      )}

      {/* ── Documents ── */}
      {fichiers.length > 0 && (
        <Section titre={fichiers.length > 1 ? "Documents" : "Document"} liste>
          <GroupeDocuments fichiers={fichiers}
            ouvrir={f => ouvrirDoc(`${API}/zones-types/poles/${pole.id}/fichiers/${f.id}/download`, f.titre || f.nom)} />
        </Section>
      )}
      {visionneuse}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  entete: { flexDirection: "row", alignItems: "center", gap: 13 },
  tuile: { width: 48, height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  surtitre: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.4, marginBottom: 3 },
  titre: { fontSize: 20, fontFamily: POLICE.gras, color: T.encre, lineHeight: 26, letterSpacing: -0.4 },
  meta: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.gris, marginTop: 8 },

  // Les chiffres dans un bloc blanc du groupe
  faits: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.carte, borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord, borderRadius: 16, borderCurve: "continuous", paddingVertical: 14, paddingHorizontal: 16,
  },
  pastilleType: { width: 9, height: 9, borderRadius: 5 },
  faitSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure, marginHorizontal: 14 },
  faitLabel: { fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 1, color: T.gris, marginBottom: 3 },
  faitVal: { fontSize: 14, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },

  barLigne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  barLabel: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre },
  barPct: { fontSize: 12.5, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  barFond: { height: 5, backgroundColor: T.filet, borderRadius: 99, overflow: "hidden" },
  barRempli: { height: "100%", borderRadius: 99 },
}));
