// Recherche globale — pays, accords, événements, entreprises, zones.
// Résultats groupés ; un tap ouvre la fiche en feuille de détail.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FicheSheet from "@/components/FicheSheet";
import { chargerIndex, creerFuse, GROUPES, type Resultat } from "@/lib/indexRecherche";
import { T, POLICE } from "@/theme";

const MAX_PAR_GROUPE = 6;

export default function Recherche() {
  const [q, setQ] = useState("");
  const [fiche, setFiche] = useState<Resultat | null>(null);
  const { data: index, isLoading } = useQuery({ queryKey: ["index-recherche"], queryFn: chargerIndex, staleTime: Infinity });
  const fuse = useMemo(() => (index ? creerFuse(index) : null), [index]);

  const resultats: Resultat[] = useMemo(() => {
    if (!q.trim() || !fuse) return [];
    const bruts: Resultat[] = fuse.search(q.trim(), { limit: 60 }).map((r: any) => r.item);
    const parGroupe: Record<string, Resultat[]> = {};
    for (const r of bruts) {
      (parGroupe[r.type] ||= []);
      if (parGroupe[r.type].length < MAX_PAR_GROUPE) parGroupe[r.type].push(r);
    }
    return (Object.keys(GROUPES) as Resultat["type"][]).flatMap(t => parGroupe[t] || []);
  }, [q, fuse]);

  let dernierGroupe = "";

  return (
    <View style={s.page}>
      <View style={s.barre}>
        <Ionicons name="search" size={17} color={T.gris} />
        <TextInput
          value={q} onChangeText={setQ} placeholder="Rechercher" placeholderTextColor={T.gris}
          autoFocus autoCorrect={false} style={s.champ} clearButtonMode="while-editing" />
      </View>

      {isLoading && q.trim().length > 0 && (
        <View style={s.centre}><ActivityIndicator color={T.bleu} /><Text style={s.info}>Chargement de l'index…</Text></View>
      )}
      {!isLoading && q.trim().length > 1 && resultats.length === 0 && (
        <View style={s.centre}><Text style={s.info}>Aucun résultat pour « {q.trim()} »</Text></View>
      )}

      <FlatList
        data={resultats}
        keyExtractor={(r, i) => `${r.type}-${r.nom}-${i}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        renderItem={({ item: r }) => {
          const entete = r.type !== dernierGroupe;
          dernierGroupe = r.type;
          return (
            <View>
              {entete && <Text style={s.groupe}>{GROUPES[r.type].toUpperCase()}</Text>}
              <Pressable onPress={() => setFiche(r)} style={({ pressed }) => [s.ligne, pressed && { backgroundColor: T.bleuVoile }]}>
                <Text style={s.nom} numberOfLines={1}>{r.nom}</Text>
                {r.sous ? <Text style={s.sous} numberOfLines={1}>{r.sous}</Text> : null}
              </Pressable>
            </View>
          );
        }}
      />
      {fiche && <FicheSheet resultat={fiche} onClose={() => setFiche(null)} />}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: T.fond },
  barre: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.carte, margin: 16, marginBottom: 8, paddingHorizontal: 17, height: 48,
    borderRadius: 999, borderWidth: 1, borderColor: T.bordure,
  },
  champ: { flex: 1, fontSize: 15.5, color: T.encre, fontFamily: POLICE.moyen },
  centre: { alignItems: "center", padding: 28, gap: 8 },
  info: { fontSize: 12.5, color: T.gris },
  groupe: { fontSize: 10, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.4, marginTop: 16, marginBottom: 6, marginLeft: 4 },
  ligne: { backgroundColor: T.carte, borderRadius: 13, borderWidth: 1, borderColor: T.bordure, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 7 },
  nom: { fontSize: 13.5, fontFamily: POLICE.gras, color: T.encre },
  sous: { fontSize: 11.5, color: T.gris, marginTop: 3 },
});
