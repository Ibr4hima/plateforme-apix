// Fiche pôle territorial — réplique du modal pôle de la vue territoriale
// du site : surtitre à carré de couleur, régions en pilules, compteur
// d'entreprises installées, zones d'investissement du pôle (chaque ligne
// ouvre la fiche zone), répartition sectorielle, documents.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Symbole from "@/components/Symbole";
import ZoneSheet from "@/components/ZoneSheet";
import { Feuille } from "@/components/ui";
import { API, getJson } from "@/lib/api";
import { POLE_COULEURS, foncerPastel, normPole } from "@/lib/couleurs";
import { zoneTypeMeta } from "@/lib/zoneTypes";
import { POLICE, T } from "@/theme";

// « Kaolack, Fatick et Kaffrine » → ["Kaolack","Fatick","Kaffrine"] (règle du site)
export const splitLocalisation = (loc: string): string[] =>
  (loc || "").split(/,\s*|\s+et\s+/).map(x => x.trim()).filter(Boolean);

const SECTEURS_REPARTITION = [
  { label: "Secteur primaire",   cle: "primaire",   couleur: T.bleu },
  { label: "Secteur secondaire", cle: "secondaire", couleur: T.orange },
  { label: "Secteur tertiaire",  cle: "tertiaire",  couleur: T.vert },
] as const;

function SecTitle({ children }: { children: string }) {
  return <Text style={s.secTitle}>{children.toUpperCase()}</Text>;
}

export default function PoleSheet({ pole, zones, onClose }: { pole: any; zones: any[]; onClose: () => void }) {
  const [zoneOuverte, setZoneOuverte] = useState<any>(null);

  const couleur   = POLE_COULEURS[normPole(pole.pole_territoire)] || "#C5BFBB";
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
    <Feuille onClose={onClose}
      titre={
        <>
          <View style={s.surtitreLigne}>
            <View style={[s.carre, { backgroundColor: couleur }]} />
            <Text style={s.surtitre}>PÔLE TERRITORIAL</Text>
          </View>
          <Text style={s.titre}>{pole.pole_territoire}</Text>
        </>
      }
      sousEntete={regions.length > 0 ? (
        <View style={s.pilules}>
          {regions.map(r => (
            <View key={r} style={s.pilule}><Text style={s.piluleTexte}>{r}</Text></View>
          ))}
        </View>
      ) : null}
      pied={zoneOuverte ? <ZoneSheet zone={zoneOuverte} onClose={() => setZoneOuverte(null)} /> : null}>
          {/* Entreprises installées */}
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>ENTREPRISE{nbInst !== 1 ? "S" : ""} INSTALLÉE{nbInst !== 1 ? "S" : ""}</Text>
            <Text style={[s.kpiValeur, nbInst === 0 && { color: T.gris }]}>{nbInst}</Text>
          </View>

          {/* Zones d'investissement du pôle */}
          {poleZones.length > 0 && (
            <View>
              <SecTitle>Zones d'investissement</SecTitle>
              <View style={{ gap: 6 }}>
                {poleZones.map((z: any) => {
                  const tc = zoneTypeMeta(z.type_zone).color;
                  const nbEnts = (z.entreprises || []).filter((ze: any) => ze.statut === "installee").length;
                  return (
                    <Pressable key={z.id} onPress={() => setZoneOuverte(z)}
                      style={({ pressed }) => [s.zone, pressed && { backgroundColor: T.carte, borderColor: "rgba(0,79,145,0.25)" }]}>
                      <View style={[s.zoneType, { backgroundColor: `${tc}12` }]}><Text style={[s.zoneTypeTexte, { color: tc }]}>{z.type_zone}</Text></View>
                      <Text style={s.zoneNom} numberOfLines={1}>{z.nom_zone}</Text>
                      <View style={[s.zoneCompte, { backgroundColor: `${tc}12` }]}><Text style={[s.zoneCompteTexte, { color: tc }]}>{nbEnts} ent.</Text></View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Répartition sectorielle */}
          {totalSect > 0 && (
            <View>
              <SecTitle>Répartition sectorielle</SecTitle>
              <View style={{ gap: 10 }}>
                {SECTEURS_REPARTITION.map(r => {
                  const pct = Math.round(compte[r.cle] / totalSect * 100);
                  return (
                    <View key={r.cle}>
                      <View style={s.barLigne}>
                        <Text style={s.barLabel}>{r.label}</Text>
                        <Text style={[s.barPct, { color: r.couleur }]}>{pct}%</Text>
                      </View>
                      <View style={s.barFond}>
                        <View style={[s.barRempli, { width: `${pct}%`, backgroundColor: r.couleur }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Documents PDF */}
          {fichiers.length > 0 && (
            <View>
              <SecTitle>{fichiers.length > 1 ? "Documents" : "Document"}</SecTitle>
              <View style={{ gap: 5 }}>
                {fichiers.map((f: any) => (
                  <Pressable key={f.id} onPress={() => Linking.openURL(`${API}/zones-types/poles/${pole.id}/fichiers/${f.id}/download`)}
                    style={({ pressed }) => [s.doc, pressed && { backgroundColor: "rgba(0,79,145,0.09)" }]}>
                    <Symbole nom="description" taille={15} couleur={T.bleu} />
                    <Text style={s.docTexte} numberOfLines={1}>{f.titre || f.nom}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
    </Feuille>
  );
}

const s = StyleSheet.create({
  surtitreLigne: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 5 },
  carre: { width: 12, height: 12, borderRadius: 3, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  surtitre: { fontSize: 10, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.4 },
  titre: { fontSize: 19, fontFamily: POLICE.gras, color: T.encre, lineHeight: 25, letterSpacing: -0.3 },
  pilules: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  pilule: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3.5, backgroundColor: T.bleuVoile },
  piluleTexte: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu },
  secTitle: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.6, marginBottom: 10 },
  kpi: {
    backgroundColor: T.blocFond, borderWidth: 1, borderColor: T.blocBord,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  kpiLabel: { fontSize: 9, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1, marginBottom: 4 },
  kpiValeur: { fontSize: 26, fontFamily: POLICE.gras, color: T.bleu, lineHeight: 30, fontVariant: ["tabular-nums"] },
  zone: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.bordureDouce, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  zoneType: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  zoneTypeTexte: { fontSize: 9.5, fontFamily: POLICE.gras, letterSpacing: 0.4 },
  zoneNom: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre },
  zoneCompte: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 2 },
  zoneCompteTexte: { fontSize: 11, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  barLigne: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  barLabel: { fontSize: 12, fontFamily: POLICE.demi, color: T.encre },
  barPct: { fontSize: 12, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  barFond: { height: 6, backgroundColor: T.filet, borderRadius: 99, overflow: "hidden" },
  barRempli: { height: "100%", borderRadius: 99 },
  doc: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.bleuVoile, borderWidth: 1, borderColor: T.blocBord,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  docTexte: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: T.bleu },
});
