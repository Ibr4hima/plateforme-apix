// Fiche Pays — sélecteur : le Sénégal est la référence, on choisit le pays
// à comparer. Pays groupés par continent (accordéons) puis zone géographique,
// comme le sélecteur du site. Le tap ouvre la fiche Sénégal × pays.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import HeroModule from "@/components/HeroModule";
import { getJson } from "@/lib/api";
import { POLICE, T } from "@/theme";

const CONT_ORDER = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];

type Pays = { id: number; nom: string; code_iso3: string; continent: string; region_geo: string | null };
type Section = { continent: string; zones: { zone: string; pays: Pays[] }[]; nb: number };

export default function FichePaysIndex() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [ouverts, setOuverts] = useState<Set<string>>(new Set(["Afrique"]));

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stat-pays"], queryFn: () => getJson<Pays[]>("/statistiques/pays"),
  });

  const sections: Section[] = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtres = (data || []).filter(p => p.code_iso3 !== "SEN" && (!t || p.nom.toLowerCase().includes(t)));
    const parCont = new Map<string, Map<string, Pays[]>>();
    for (const p of filtres) {
      const c = p.continent || "Autre", z = p.region_geo || "Autre";
      if (!parCont.has(c)) parCont.set(c, new Map());
      const zones = parCont.get(c)!;
      if (!zones.has(z)) zones.set(z, []);
      zones.get(z)!.push(p);
    }
    return Array.from(parCont.entries())
      .map(([continent, zones]) => ({
        continent,
        zones: Array.from(zones.entries())
          .map(([zone, pays]) => ({ zone, pays: pays.sort((a, b) => a.nom.localeCompare(b.nom, "fr")) }))
          .sort((a, b) => a.zone.localeCompare(b.zone, "fr")),
        nb: Array.from(zones.values()).reduce((n, l) => n + l.length, 0),
      }))
      .sort((a, b) => {
        const ia = CONT_ORDER.indexOf(a.continent), ib = CONT_ORDER.indexOf(b.continent);
        if (ia === -1 && ib === -1) return a.continent.localeCompare(b.continent, "fr");
        if (ia === -1) return 1; if (ib === -1) return -1;
        return ia - ib;
      });
  }, [data, q]);

  const recherche = q.trim().length > 0;

  const hero = (
    <>
      <HeroModule titre="Fiche Pays" sousTitre="Relations bilatérales du Sénégal"
        recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher un pays" }} />
      {/* Référence épinglée : le Sénégal est toujours la base de comparaison */}
      <View style={s.rangee}>
        <View style={s.reference}>
          <Image source={{ uri: "https://flagcdn.com/w80/sn.png" }} style={s.drapeau} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.refNom}>Sénégal</Text>
            <Text style={s.refSous}>Chaque fiche compare le Sénégal au pays choisi</Text>
          </View>
          <View style={s.refPastille}><Text style={s.refPastilleTexte}>RÉFÉRENCE</Text></View>
        </View>
      </View>
      {!isLoading && !isError && (
        <Text style={s.compte}>{sections.reduce((n, c) => n + c.nb, 0)} pays</Text>
      )}
    </>
  );

  return (
    <FlatList
      style={{ backgroundColor: T.fond }}
      data={isLoading || isError ? [] : sections}
      keyExtractor={c => c.continent}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.liste}
      ListHeaderComponent={hero}
      renderItem={({ item: c }) => {
        const ouvert = recherche || ouverts.has(c.continent);
        return (
          <View style={s.rangee}>
            <Pressable onPress={() => setOuverts(prev => {
              const n = new Set(prev); n.has(c.continent) ? n.delete(c.continent) : n.add(c.continent); return n;
            })}
              style={({ pressed }) => [s.continent, pressed && { backgroundColor: "rgba(0,79,145,0.08)" }]}>
              <Text style={s.continentTexte}>{c.continent.toUpperCase()}</Text>
              <View style={s.continentDroite}>
                <Text style={s.continentCompte}>{c.nb}</Text>
                <Ionicons name={ouvert ? "chevron-down" : "chevron-forward"} size={13} color={T.bleu} />
              </View>
            </Pressable>
            {ouvert && (
              <View style={s.surface}>
                {c.zones.map((z, zi) => (
                  <View key={z.zone}>
                    <Text style={[s.zone, zi > 0 && { borderTopWidth: 1, borderTopColor: T.filet }]}>{z.zone.toUpperCase()}</Text>
                    {z.pays.map(p => (
                      <Pressable key={p.id} onPress={() => router.push(`/fiche-pays/${p.id}` as any)}
                        style={({ pressed }) => [s.pays, pressed && { backgroundColor: "rgba(0,79,145,0.04)" }]}>
                        <Text style={s.paysNom} numberOfLines={1}>{p.nom}</Text>
                        <Text style={s.paysIso}>{p.code_iso3}</Text>
                        <Ionicons name="chevron-forward" size={13} color={T.grisClair} />
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      }}
      ListEmptyComponent={
        isLoading ? <View style={s.centre}><ActivityIndicator color={T.bleu} size="large" /></View>
        : isError ? (
          <View style={s.centre}>
            <Text style={s.erreur}>Impossible de joindre la plateforme.</Text>
            <Pressable onPress={() => refetch()} style={s.bouton}><Text style={s.boutonTexte}>Réessayer</Text></Pressable>
          </View>
        ) : (
          <View style={s.centre}><Text style={s.erreurSous}>Aucun pays trouvé.</Text></View>
        )
      }
    />
  );
}

const s = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  erreur: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre, textAlign: "center" },
  erreurSous: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center" },
  bouton: { marginTop: 12, backgroundColor: T.bleu, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  boutonTexte: { color: "#fff", fontFamily: POLICE.gras, fontSize: 13 },
  liste: { paddingBottom: 40 },
  rangee: { paddingHorizontal: 16, marginBottom: 9 },
  reference: {
    flexDirection: "row", alignItems: "center", gap: 13, marginTop: 14,
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: T.bordure,
    paddingHorizontal: 15, paddingVertical: 13,
    shadowColor: "#001e3c", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2,
  },
  drapeau: { width: 34, height: 24, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.12)" },
  refNom: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre },
  refSous: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  refPastille: { backgroundColor: "rgba(0,79,145,0.08)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3.5 },
  refPastilleTexte: { fontSize: 8.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1 },
  compte: { fontSize: 11, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1, textTransform: "uppercase", marginTop: 14, marginBottom: 8, paddingHorizontal: 16 },
  continent: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(0,79,145,0.05)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  continentTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.2 },
  continentDroite: { flexDirection: "row", alignItems: "center", gap: 7 },
  continentCompte: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, backgroundColor: "rgba(0,79,145,0.10)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1.5, overflow: "hidden", fontVariant: ["tabular-nums"] },
  surface: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: T.bordure, marginTop: 8, overflow: "hidden" },
  zone: { fontSize: 9, fontFamily: POLICE.gras, color: T.grisClair, letterSpacing: 1.1, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 3 },
  pays: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10.5 },
  paysNom: { flex: 1, fontSize: 13.5, fontFamily: POLICE.demi, color: T.encre },
  paysIso: { fontSize: 10.5, fontFamily: POLICE.moyen, color: T.grisClair, letterSpacing: 0.5 },
});
