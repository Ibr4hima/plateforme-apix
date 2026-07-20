// Filtres des indicateurs économiques — version app de la barre latérale
// du site, en feuille : Vue (Pays / Analyse comparative), Pays (Sénégal
// épinglé, continents en accordéons, 4 pays au plus en comparaison),
// Période (plage ou années spécifiques).
// Brouillon local, appliqué d'un bloc par « Appliquer ».
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { COMP_PALETTE } from "@/lib/couleurs";
import { POLICE, T } from "@/theme";

export const MAX_SEL = 4;

export type FiltresStatistiques = {
  vue: string;
  selection: number[];
  modeAnnees: "plage" | "specifiques";
  anneeMin: number;
  anneeMax: number;
  anneesSpec: number[];
};

const CONT_ORDER = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];

function SecTitle({ children, droite }: { children: string; droite?: React.ReactNode }) {
  return (
    <View style={s.secLigne}>
      <Text style={s.secTitle}>{children.toUpperCase()}</Text>
      {droite}
    </View>
  );
}

const VUES_DEFAUT = [
  { cle: "pays", label: "Pays" },
  { cle: "comparative", label: "Analyse comparative" },
] as const;

export default function StatistiquesFiltres({ pays, senId, anneesDispo, valeurs, vues = VUES_DEFAUT, multiPour, onAppliquer, onClose }: {
  pays: any[]; senId: number | null; anneesDispo: number[];
  valeurs: FiltresStatistiques;
  vues?: readonly { cle: string; label: string }[];
  multiPour?: (vue: string) => boolean;
  onAppliquer: (f: FiltresStatistiques) => void;
  onClose: () => void;
}) {
  const estMulti = multiPour ?? ((v: string) => v === "comparative");
  const [f, setF] = useState<FiltresStatistiques>({ ...valeurs, selection: [...valeurs.selection], anneesSpec: [...valeurs.anneesSpec] });
  const [qPays, setQPays] = useState("");
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());

  const multi = estMulti(f.vue);
  const bornes: [number, number] = anneesDispo.length ? [anneesDispo[0], anneesDispo[anneesDispo.length - 1]] : [f.anneeMin, f.anneeMax];

  const couleurDe = (id: number) => COMP_PALETTE[Math.max(0, f.selection.indexOf(id)) % COMP_PALETTE.length];

  const clicPays = (id: number) => setF(prev => {
    if (!estMulti(prev.vue)) return { ...prev, selection: [id] };
    if (prev.selection.includes(id)) {
      return prev.selection.length > 1 ? { ...prev, selection: prev.selection.filter(x => x !== id) } : prev;
    }
    if (prev.selection.length >= MAX_SEL) return prev;
    return { ...prev, selection: [...prev.selection, id] };
  });

  const changerVue = (vue: string) => setF(prev => ({
    ...prev, vue,
    // Retour en vue mono-pays : on garde le premier pays sélectionné
    selection: estMulti(vue) ? prev.selection : prev.selection.slice(0, 1),
  }));


  const reinitialiser = () => setF({
    vue: vues[0].cle, selection: senId !== null ? [senId] : [],
    modeAnnees: "plage", anneeMin: bornes[0], anneeMax: bornes[1], anneesSpec: [],
  });

  const groupes = useMemo(() => {
    const t = qPays.trim().toLowerCase();
    const filtres = pays.filter((p: any) => p.id !== senId && (!t || p.nom.toLowerCase().includes(t)));
    const parCont = new Map<string, Map<string, any[]>>();
    for (const p of filtres) {
      const c = p.continent || "Autre", z = p.region_geo || "Autre";
      if (!parCont.has(c)) parCont.set(c, new Map());
      if (!parCont.get(c)!.has(z)) parCont.get(c)!.set(z, []);
      parCont.get(c)!.get(z)!.push(p);
    }
    return Array.from(parCont.entries())
      .map(([continent, zones]) => ({
        continent,
        zones: Array.from(zones.entries()).map(([zone, liste]) => ({
          zone, liste: liste.sort((a: any, b: any) => a.nom.localeCompare(b.nom, "fr")),
        })).sort((a, b) => a.zone.localeCompare(b.zone, "fr")),
      }))
      .sort((a, b) => {
        const ia = CONT_ORDER.indexOf(a.continent), ib = CONT_ORDER.indexOf(b.continent);
        if (ia === -1 && ib === -1) return a.continent.localeCompare(b.continent, "fr");
        if (ia === -1) return 1; if (ib === -1) return -1;
        return ia - ib;
      });
  }, [pays, qPays, senId]);

  const recherchePays = qPays.trim().length > 0;

  const RangePays = ({ p }: { p: any }) => {
    const sel = f.selection.includes(p.id);
    const desactive = multi && !sel && f.selection.length >= MAX_SEL;
    const col = sel ? couleurDe(p.id) : T.grisClair;
    return (
      <Pressable onPress={() => !desactive && clicPays(p.id)}
        style={({ pressed }) => [s.paysLigne, pressed && { backgroundColor: T.champ }, desactive && { opacity: 0.4 }]}>
        <View style={[s.point, { borderColor: col, backgroundColor: sel ? col : "transparent" }]} />
        <Text style={[s.paysNom, sel && { fontFamily: POLICE.gras }]} numberOfLines={1}>{p.nom}</Text>
      </Pressable>
    );
  };

  const AnneeChip = ({ a, actif, onPress }: { a: number; actif: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[s.anneeChip, actif && s.anneeChipActif]}>
      <Text style={[s.anneeChipTexte, actif && { color: "#fff" }]}>{a}</Text>
    </Pressable>
  );

  const sen = senId !== null ? { sel: f.selection.includes(senId) } : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.fond} onPress={onClose} />
      <View style={s.feuille}>
        <View style={s.poignee} />
        <View style={s.entete}>
          <Text style={s.titre}>Filtres</Text>
          <Pressable onPress={onClose} hitSlop={10} style={s.fermer}>
            <Ionicons name="close" size={17} color={T.texte} />
          </Pressable>
        </View>

        <ScrollView style={{ marginTop: 12 }} contentContainerStyle={{ gap: 22, paddingBottom: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Vue */}
          <View>
            <SecTitle>Vue</SecTitle>
            <View style={s.segments}>
              {vues.map(o => (
                <Pressable key={o.cle} onPress={() => changerVue(o.cle)} style={[s.segment, f.vue === o.cle && s.segmentActif]}>
                  <Text style={[s.segmentTexte, f.vue === o.cle && s.segmentTexteActif]}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Pays */}
          <View>
            <SecTitle droite={<Text style={s.compteBadge}>{multi ? `${f.selection.length}/${MAX_SEL}` : "1"}</Text>}>Pays</SecTitle>
            <View style={s.recherche}>
              <Ionicons name="search" size={13} color={T.gris} />
              <TextInput value={qPays} onChangeText={setQPays} placeholder="Rechercher un pays"
                placeholderTextColor={T.gris} autoCorrect={false} clearButtonMode="while-editing" style={s.rechercheChamp} />
            </View>
            {/* Sénégal épinglé */}
            {senId !== null && sen && (
              <Pressable onPress={() => clicPays(senId)}
                style={({ pressed }) => [s.paysLigne, pressed && { backgroundColor: T.champ }]}>
                <View style={[s.point, { borderColor: sen.sel ? couleurDe(senId) : T.grisClair, backgroundColor: sen.sel ? couleurDe(senId) : "transparent" }]} />
                <Text style={[s.paysNom, sen.sel && { fontFamily: POLICE.gras }]}>Sénégal</Text>
                <View style={s.refBadge}><Text style={s.refBadgeTexte}>Réf.</Text></View>
              </Pressable>
            )}
            <View style={s.filet} />
            <View style={{ maxHeight: 260 }}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {groupes.map(g => {
                  const ouvert = recherchePays || ouverts.has(g.continent);
                  return (
                    <View key={g.continent} style={{ marginBottom: 4 }}>
                      <Pressable onPress={() => setOuverts(prev => { const n = new Set(prev); n.has(g.continent) ? n.delete(g.continent) : n.add(g.continent); return n; })}
                        style={s.continent}>
                        <Text style={s.continentTexte}>{g.continent.toUpperCase()}</Text>
                        <Ionicons name={ouvert ? "chevron-down" : "chevron-forward"} size={12} color={T.bleu} />
                      </Pressable>
                      {ouvert && g.zones.map(z => (
                        <View key={z.zone} style={{ marginLeft: 4 }}>
                          <Text style={s.zone}>{z.zone.toUpperCase()}</Text>
                          {z.liste.map((p: any) => <RangePays key={p.id} p={p} />)}
                        </View>
                      ))}
                    </View>
                  );
                })}
                {groupes.length === 0 && <Text style={s.vide}>Aucun pays trouvé</Text>}
              </ScrollView>
            </View>
          </View>

          {/* Période */}
          <View>
            <SecTitle>Période</SecTitle>
            <View style={[s.segments, { marginBottom: 12 }]}>
              {([["plage", "Plage"], ["specifiques", "Années"]] as const).map(([cle, label]) => (
                <Pressable key={cle} onPress={() => setF(prev => ({ ...prev, modeAnnees: cle }))} style={[s.segment, f.modeAnnees === cle && s.segmentActif]}>
                  <Text style={[s.segmentTexte, f.modeAnnees === cle && s.segmentTexteActif]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {f.modeAnnees === "plage" ? (
              <View style={{ gap: 10 }}>
                <View>
                  <Text style={s.plageLabel}>DE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.anneesRangee}>
                    {anneesDispo.map(a => (
                      <AnneeChip key={a} a={a} actif={a === f.anneeMin}
                        onPress={() => setF(prev => ({ ...prev, anneeMin: a, anneeMax: Math.max(a, prev.anneeMax) }))} />
                    ))}
                  </ScrollView>
                </View>
                <View>
                  <Text style={s.plageLabel}>À</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.anneesRangee}>
                    {anneesDispo.map(a => (
                      <AnneeChip key={a} a={a} actif={a === f.anneeMax}
                        onPress={() => setF(prev => ({ ...prev, anneeMax: a, anneeMin: Math.min(a, prev.anneeMin) }))} />
                    ))}
                  </ScrollView>
                </View>
                <Text style={s.plageResume}>{f.anneeMax - f.anneeMin + 1} année{f.anneeMax - f.anneeMin + 1 > 1 ? "s" : ""} · {f.anneeMin} — {f.anneeMax}</Text>
              </View>
            ) : (
              <View style={s.anneesGrille}>
                {anneesDispo.map(a => (
                  <AnneeChip key={a} a={a} actif={f.anneesSpec.includes(a)}
                    onPress={() => setF(prev => ({ ...prev, anneesSpec: prev.anneesSpec.includes(a) ? prev.anneesSpec.filter(x => x !== a) : [...prev.anneesSpec, a].sort((x, y) => x - y) }))} />
                ))}
              </View>
            )}
          </View>

        </ScrollView>

        {/* Pied : réinitialiser + appliquer */}
        <View style={s.pied}>
          <Pressable onPress={reinitialiser} style={({ pressed }) => [s.boutonSecondaire, pressed && { backgroundColor: T.filet }]}>
            <Text style={s.boutonSecondaireTexte}>Réinitialiser</Text>
          </Pressable>
          <Pressable onPress={() => { onAppliquer(f); onClose(); }}
            style={({ pressed }) => [s.boutonPrincipal, pressed && { opacity: 0.85 }]}>
            <Text style={s.boutonPrincipalTexte}>Appliquer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(2,20,38,0.45)" },
  feuille: {
    backgroundColor: T.carte, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 22, paddingTop: 10, maxHeight: "88%",
  },
  poignee: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: T.bordure, marginBottom: 12 },
  entete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  titre: { fontSize: 19, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.3 },
  fermer: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.filet, alignItems: "center", justifyContent: "center" },
  secLigne: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  secTitle: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.6 },
  compteBadge: {
    fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, backgroundColor: T.blocBord,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden", fontVariant: ["tabular-nums"],
  },
  segments: { flexDirection: "row", padding: 3.5, gap: 4, backgroundColor: T.filet, borderRadius: 999 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 999 },
  segmentActif: { backgroundColor: T.carte, shadowColor: "#001e3c", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segmentTexte: { fontSize: 12, fontFamily: POLICE.demi, color: T.gris },
  segmentTexteActif: { color: T.bleu },
  recherche: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10,
    backgroundColor: T.champ, borderWidth: 1, borderColor: T.bordure, borderRadius: 10,
    paddingHorizontal: 11, height: 38,
  },
  rechercheChamp: { flex: 1, fontSize: 13, fontFamily: POLICE.moyen, color: T.encre },
  paysLigne: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 7.5, paddingHorizontal: 8, borderRadius: 8 },
  point: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  paysNom: { flex: 1, fontSize: 13, fontFamily: POLICE.normal, color: T.texte },
  refBadge: { backgroundColor: T.filet, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1.5 },
  refBadgeTexte: { fontSize: 9, fontFamily: POLICE.demi, color: T.gris },
  uniteBadge: { fontSize: 9.5, fontFamily: POLICE.demi, color: T.grisClair },
  filet: { height: 1, backgroundColor: T.filet, marginVertical: 8 },
  continent: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: T.bleuVoile, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 3,
  },
  continentTexte: { fontSize: 10, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1 },
  zone: { fontSize: 8.5, fontFamily: POLICE.gras, color: T.grisClair, letterSpacing: 1, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 2 },
  vide: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", paddingVertical: 10 },
  plageLabel: { fontSize: 9, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.2, marginBottom: 6 },
  anneesRangee: { gap: 6, paddingRight: 8 },
  anneesGrille: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  anneeChip: {
    paddingHorizontal: 12, paddingVertical: 6.5, borderRadius: 9,
    backgroundColor: T.champ, borderWidth: 1, borderColor: T.bordure,
  },
  anneeChipActif: { backgroundColor: T.bleuAction, borderColor: T.bleuAction },
  anneeChipTexte: { fontSize: 12, fontFamily: POLICE.demi, color: T.texte, fontVariant: ["tabular-nums"] },
  plageResume: { fontSize: 11.5, fontFamily: POLICE.demi, color: T.gris, textAlign: "center" },
  pied: {
    flexDirection: "row", gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: T.filet,
    paddingBottom: 26,
  },
  boutonSecondaire: {
    flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: T.bordure, backgroundColor: T.carte,
  },
  boutonSecondaireTexte: { fontSize: 13.5, fontFamily: POLICE.demi, color: T.texte },
  boutonPrincipal: { flex: 1.4, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: T.bleuAction },
  boutonPrincipalTexte: { fontSize: 13.5, fontFamily: POLICE.gras, color: "#fff" },
});
