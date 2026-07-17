// Code des investissements — sommaire façon table des matières d'un
// livre : bascule Code / Modalités, recherche full-text avec extraits
// surlignés, chapitres en rangées typographiques (numéro romain en
// colonne, titre, compte d'articles).
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import HeroModule from "@/components/HeroModule";
import { getJson } from "@/lib/api";
import { POLICE, T } from "@/theme";

export type BaseCode = "code-investissement" | "modalites-application";

// Extrait de recherche : « … <mark>investisseur</mark> … » → segments stylés
function Extrait({ html }: { html: string }) {
  const morceaux = (html || "").split(/<\/?mark>/);
  return (
    <Text style={s.resExtrait} numberOfLines={2}>
      {morceaux.map((m, i) => i % 2 === 1
        ? <Text key={i} style={s.resSurligne}>{m}</Text>
        : <Text key={i}>{m}</Text>)}
    </Text>
  );
}

const nbArticlesDe = (c: any) =>
  (c.articles?.length || 0) + (c.sections || []).reduce((n: number, sec: any) => n + (sec.articles?.length || 0), 0);

export default function CodeSommaire() {
  const router = useRouter();
  const [base, setBase] = useState<BaseCode>("code-investissement");
  const [q, setQ] = useState("");
  const [qDebounce, setQDebounce] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQDebounce(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const chapitres = useQuery({
    queryKey: ["code", base],
    queryFn: () => getJson<any[]>(`/${base}`),
    staleTime: 30 * 60 * 1000,
  });
  const recherche = useQuery({
    queryKey: ["code-recherche", base, qDebounce],
    queryFn: () => getJson<any[]>(`/${base}/search?q=${encodeURIComponent(qDebounce)}`),
    enabled: qDebounce.length >= 2,
  });

  const enRecherche = qDebounce.length >= 2;
  const liste = chapitres.data || [];
  const totalArticles = liste.reduce((n: number, c: any) => n + nbArticlesDe(c), 0);

  return (
    <ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: 46 }} keyboardShouldPersistTaps="handled">
      <HeroModule titre="Code des investissements"
        recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher dans le code…" }}
        segments={{
          options: [{ cle: "code-investissement", label: "Code des inv." }, { cle: "modalites-application", label: "Modalités d'app." }],
          valeur: base, onChange: cle => setBase(cle as BaseCode),
        }} />

      {/* Résultats de recherche */}
      {enRecherche ? (
        <View style={s.liste}>
          {recherche.isLoading && <ActivityIndicator color={T.bleu} style={{ marginTop: 24 }} />}
          {recherche.data?.length === 0 && <Text style={s.vide}>Aucun article pour « {qDebounce} »</Text>}
          {(recherche.data || []).map((r: any) => (
            <Pressable key={r.id} onPress={() => router.push({ pathname: "/code/[chapitre]", params: { chapitre: r.chapitre_id, base, art: r.id } } as any)}
              style={({ pressed }) => [s.resultat, pressed && { borderColor: "rgba(0,79,145,0.35)" }]}>
              <Text style={s.resNumero}>ARTICLE {String(r.num_display).toUpperCase()}</Text>
              {r.titre ? <Text style={s.resTitre} numberOfLines={1}>{r.titre}</Text> : null}
              <Extrait html={r.extrait} />
            </Pressable>
          ))}
        </View>
      ) : (
        /* Table des matières */
        <View style={s.liste}>
          {chapitres.isLoading && <ActivityIndicator color={T.bleu} style={{ marginTop: 24 }} />}
          {liste.length > 0 && (
            <>
              <Text style={s.meta}>
                {liste.length} CHAPITRE{liste.length > 1 ? "S" : ""} · {totalArticles} ARTICLE{totalArticles > 1 ? "S" : ""}
              </Text>
              <View style={s.surface}>
                {liste.map((c: any, i: number) => {
                  const nb = nbArticlesDe(c);
                  return (
                    <View key={c.id}>
                      {i > 0 && <View style={s.separateur} />}
                      <Pressable onPress={() => router.push({ pathname: "/code/[chapitre]", params: { chapitre: c.id, base } } as any)}
                        style={({ pressed }) => [s.ligne, pressed && { backgroundColor: "rgba(0,79,145,0.05)" }]}>
                        <View style={s.numeroColonne}>
                          <Text style={s.numeroRomain}>{c.num_display}</Text>
                          <Text style={s.numeroLegende}>CHAP.</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.ligneTitre} numberOfLines={2}>{c.titre}</Text>
                          <Text style={s.ligneSous}>{nb} article{nb > 1 ? "s" : ""}{c.sections?.length ? ` · ${c.sections.length} section${c.sections.length > 1 ? "s" : ""}` : ""}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={T.grisClair} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  liste: { paddingHorizontal: 18, marginTop: 16 },
  vide: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", marginTop: 24 },
  meta: { fontSize: 10, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.4, marginBottom: 10, marginLeft: 4 },
  surface: {
    backgroundColor: "#fff", borderRadius: 22, overflow: "hidden",
    shadowColor: "#001e3c", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  separateur: { height: 1, backgroundColor: "rgba(0,30,60,0.07)", marginLeft: 74 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 15, paddingHorizontal: 18 },
  numeroColonne: { width: 40, alignItems: "center" },
  numeroRomain: { fontSize: 17, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 0.3, lineHeight: 21 },
  numeroLegende: { fontSize: 7.5, fontFamily: POLICE.gras, color: T.grisClair, letterSpacing: 1.2, marginTop: 2 },
  ligneTitre: { fontSize: 15, fontFamily: POLICE.demi, color: T.encre, lineHeight: 20, letterSpacing: -0.2 },
  ligneSous: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 3 },
  resultat: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: T.bordure, padding: 15, marginBottom: 10 },
  resNumero: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.2 },
  resTitre: { fontSize: 13.5, fontFamily: POLICE.demi, color: T.encre, marginTop: 5 },
  resExtrait: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.texte, lineHeight: 19, marginTop: 6 },
  resSurligne: { backgroundColor: "rgba(202,99,31,0.18)", color: "#8a4514", fontFamily: POLICE.demi },
});
