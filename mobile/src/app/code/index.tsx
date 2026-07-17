// Code des investissements — sommaire : bascule Code / Modalités
// d'application, recherche full-text avec extraits surlignés, chapitres
// en liste groupée (médaillon en chiffres romains).
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import HeroModule from "@/components/HeroModule";
import { getJson } from "@/lib/api";
import { POLICE, T } from "@/theme";

export type BaseCode = "code-investissement" | "modalites-application";

// Extrait de recherche : « … <mark>investisseur</mark> … » → segments stylés
export function Extrait({ html }: { html: string }) {
  const morceaux = (html || "").split(/<\/?mark>/);
  return (
    <Text style={s.resExtrait} numberOfLines={2}>
      {morceaux.map((m, i) => i % 2 === 1
        ? <Text key={i} style={s.resSurligne}>{m}</Text>
        : <Text key={i}>{m}</Text>)}
    </Text>
  );
}

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

  return (
    <ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: 46 }} keyboardShouldPersistTaps="handled">
      <HeroModule titre="Code des investissements"
        recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher dans le code…" }}
        segments={{
          options: [{ cle: "code-investissement", label: "Le Code" }, { cle: "modalites-application", label: "Modalités" }],
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
        /* Sommaire des chapitres */
        <View style={s.liste}>
          {chapitres.isLoading && <ActivityIndicator color={T.bleu} style={{ marginTop: 24 }} />}
          <View style={chapitres.data?.length ? s.surface : undefined}>
            {(chapitres.data || []).map((c: any, i: number) => {
              const nbArticles = (c.articles?.length || 0) + (c.sections || []).reduce((n: number, sec: any) => n + (sec.articles?.length || 0), 0);
              return (
                <View key={c.id}>
                  {i > 0 && <View style={s.separateur} />}
                  <Pressable onPress={() => router.push({ pathname: "/code/[chapitre]", params: { chapitre: c.id, base } } as any)}
                    style={({ pressed }) => [s.ligne, pressed && { backgroundColor: "rgba(0,79,145,0.05)" }]}>
                    <View style={s.medaillon}>
                      <Text style={s.medaillonTexte}>{c.numero === 1 ? "Ier" : c.num_display}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.ligneTitre} numberOfLines={2}>{c.titre}</Text>
                      <Text style={s.ligneSous}>{nbArticles} article{nbArticles > 1 ? "s" : ""}{c.sections?.length ? ` · ${c.sections.length} section${c.sections.length > 1 ? "s" : ""}` : ""}</Text>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  liste: { paddingHorizontal: 18, marginTop: 16 },
  vide: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", marginTop: 24 },
  surface: {
    backgroundColor: "#fff", borderRadius: 22, overflow: "hidden",
    shadowColor: "#001e3c", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  separateur: { height: 1, backgroundColor: "rgba(0,30,60,0.07)", marginLeft: 70 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 15, paddingVertical: 14, paddingHorizontal: 16 },
  medaillon: {
    width: 39, height: 39, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,79,145,0.08)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,79,145,0.22)",
  },
  medaillonTexte: { fontSize: 12, fontFamily: POLICE.gras, color: T.bleu },
  ligneTitre: { fontSize: 14.5, fontFamily: POLICE.demi, color: T.encre, lineHeight: 19 },
  ligneSous: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 3 },
  resultat: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: T.bordure, padding: 15, marginBottom: 10 },
  resNumero: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.2 },
  resTitre: { fontSize: 13.5, fontFamily: POLICE.demi, color: T.encre, marginTop: 5 },
  resExtrait: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.texte, lineHeight: 19, marginTop: 6 },
  resSurligne: { backgroundColor: "rgba(202,99,31,0.18)", color: "#8a4514", fontFamily: POLICE.demi },
});
