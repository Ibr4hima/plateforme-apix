// Chapitre du code — articles directs puis sections, chaque article en
// carte lisible. Arrivée depuis la recherche : défilement automatique
// jusqu'à l'article et surbrillance temporaire.
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import HeroModule from "@/components/HeroModule";
import { getJson } from "@/lib/api";
import { POLICE, T } from "@/theme";

function Article({ a, surligne, onPosition }: { a: any; surligne: boolean; onPosition: (id: string, y: number) => void }) {
  return (
    <View onLayout={e => onPosition(a.id, e.nativeEvent.layout.y)}
      style={[s.article, surligne && s.articleSurligne]}>
      <Text style={s.artNumero}>ARTICLE {String(a.num_display).toUpperCase()}</Text>
      {a.titre ? <Text style={s.artTitre}>{a.titre}</Text> : null}
      <Text style={s.artContenu}>{a.contenu}</Text>
    </View>
  );
}

export default function Chapitre() {
  const { chapitre, base = "code-investissement", art } = useLocalSearchParams<{ chapitre: string; base?: string; art?: string }>();
  const defileur = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const [surligneId, setSurligneId] = useState<string | null>(art || null);

  const { data: chapitres, isLoading } = useQuery({
    queryKey: ["code", base],
    queryFn: () => getJson<any[]>(`/${base}`),
    staleTime: 30 * 60 * 1000,
  });
  const chap = (chapitres || []).find((c: any) => c.id === chapitre);

  const enregistrerPosition = (id: string, y: number) => { positions.current[id] = y; };

  // Défilement vers l'article demandé (depuis la recherche)
  useEffect(() => {
    if (!art || !chap) return;
    const t = setTimeout(() => {
      const y = positions.current[art];
      if (y != null) defileur.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      setTimeout(() => setSurligneId(null), 2200);
    }, 350);
    return () => clearTimeout(t);
  }, [art, chap?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView ref={defileur} style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: 50 }}>
      <HeroModule
        titre={`Chapitre ${chap ? (chap.numero === 1 ? "premier" : chap.num_display) : "…"}`}
        sousTitre={base === "modalites-application" ? "Modalités d'application" : "Code des investissements"} />
      <View style={{ padding: 18 }}>
      {isLoading && <ActivityIndicator color={T.bleu} style={{ marginTop: 30 }} />}
      {chap && (
        <>
          <Text style={s.chapTitre}>{chap.titre}</Text>
          {chap.contenu ? <Text style={s.chapContenu}>{chap.contenu}</Text> : null}

          <View style={{ marginTop: 18, gap: 12 }}>
            {(chap.articles || []).map((a: any) => (
              <Article key={a.id} a={a} surligne={a.id === surligneId} onPosition={enregistrerPosition} />
            ))}
          </View>

          {(chap.sections || []).map((sec: any) => (
            <View key={sec.id} style={{ marginTop: 26 }}>
              <View style={s.sectionEntete}>
                <View style={s.sectionFilet} />
                <Text style={s.sectionTitre}>SECTION {String(sec.num_display).toUpperCase()} — {sec.titre}</Text>
              </View>
              {sec.contenu ? <Text style={s.chapContenu}>{sec.contenu}</Text> : null}
              <View style={{ marginTop: 12, gap: 12 }}>
                {(sec.articles || []).map((a: any) => (
                  <Article key={a.id} a={a} surligne={a.id === surligneId} onPosition={enregistrerPosition} />
                ))}
              </View>
            </View>
          ))}
        </>
      )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  chapTitre: { fontSize: 21, fontFamily: POLICE.gras, color: T.encre, lineHeight: 27 },
  chapContenu: { fontSize: 13.5, fontFamily: POLICE.normal, color: T.texte, lineHeight: 21, marginTop: 10 },
  sectionEntete: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  sectionFilet: { width: 22, height: 2.5, borderRadius: 2, backgroundColor: T.orange },
  sectionTitre: { flex: 1, fontSize: 11.5, fontFamily: POLICE.gras, color: "#8a5a30", letterSpacing: 0.8, lineHeight: 16 },
  article: {
    backgroundColor: "#fff", borderRadius: 18, padding: 17,
    shadowColor: "#001e3c", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  articleSurligne: { backgroundColor: "#FFF8EF", borderWidth: 1, borderColor: "rgba(202,99,31,0.35)" },
  artNumero: { fontSize: 10, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.4 },
  artTitre: { fontSize: 14.5, fontFamily: POLICE.demi, color: T.encre, lineHeight: 19, marginTop: 6 },
  artContenu: { fontSize: 13.5, fontFamily: POLICE.normal, color: T.texte, lineHeight: 21.5, marginTop: 8 },
});
