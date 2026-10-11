// Lois & Règlementations — sommaire façon table des matières d'un livre.
//
// Les deux bases (Code des investissements, Modalités d'application) sont des
// chips colorées à compteur — le pattern des lentilles de l'app — et les deux
// se chargent d'emblée : la bascule est instantanée et chaque chip porte son
// nombre de chapitres. La recherche full-text sert ses extraits surlignés ;
// les chapitres restent des rangées typographiques (numéro romain en colonne,
// titre, compte d'articles), dans une surface au gabarit de la plateforme.
// Le lecteur immersif (page suivante) ne change pas.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, EtatErreur, EtatVide, Tapable } from "@/components/ui";
import EnTetePage from "@/components/EnTetePage";
import { enPanne, getJson } from "@/lib/api";
import { useMargeBas } from "@/lib/marges";
import { POLICE, T } from "@/theme";
import { creerStyles } from "@/lib/apparence";

export type BaseCode = "code-investissement" | "modalites-application";

// Les deux bases — chips colorées comme les lentilles des autres modules
const BASES = [
  { cle: "code-investissement" as BaseCode,   label: "Code des investissements" },
  { cle: "modalites-application" as BaseCode, label: "Modalités d'application" },
];

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

// Numérotation romaine homogène : le chapitre 1 s'affiche « I » (la base
// stocke « premier » pour lui)
export const romainDe = (c: any) => (c.numero === 1 ? "I" : String(c.num_display));

export default function CodeSommaire() {
  const router = useRouter();
  const margeBas = useMargeBas();
  const { width } = useWindowDimensions();
  const [base, setBase] = useState<BaseCode>("code-investissement");
  const [q, setQ] = useState("");
  const [qDebounce, setQDebounce] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQDebounce(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  // Les deux bases chargées d'emblée : bascule instantanée, compteurs sur les chips
  const codeQ = useQuery({
    queryKey: ["code", "code-investissement"],
    queryFn: () => getJson<any[]>("/code-investissement"), staleTime: 30 * 60 * 1000,
  });
  const modQ = useQuery({
    queryKey: ["code", "modalites-application"],
    queryFn: () => getJson<any[]>("/modalites-application"), staleTime: 30 * 60 * 1000,
  });
  const parBase: Record<BaseCode, typeof codeQ> = {
    "code-investissement": codeQ, "modalites-application": modQ,
  };
  const requete = parBase[base];

  const recherche = useQuery({
    queryKey: ["code-recherche", base, qDebounce],
    queryFn: () => getJson<any[]>(`/${base}/search?q=${encodeURIComponent(qDebounce)}`),
    enabled: qDebounce.length >= 2,
  });

  const enRecherche = qDebounce.length >= 2;
  const liste = requete.data || [];
  const totalArticles = liste.reduce((n: number, c: any) => n + nbArticlesDe(c), 0);
  const cap = width >= 700 ? { width: "100%" as const, maxWidth: 680, alignSelf: "center" as const } : null;

  return (
    <>
      {/* L'en-tête est ancré hors du défilement : la recherche et les deux
          bases restent accessibles au fil de la lecture */}
      <View style={{ flex: 1, backgroundColor: T.fond }}>
        <EnTetePage titre="Lois & Règlementations"
          recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
          segments={{
            options: BASES.map(b => ({ cle: b.cle, label: b.label })),
            valeur: base,
            onChange: cle => setBase(cle as BaseCode),
          }} />

        <Animated.ScrollView
          style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: margeBas }}
          keyboardShouldPersistTaps="handled">
        {/* Résultats de recherche */}
        {enRecherche ? (
          <View style={[s.liste, cap]}>
            {recherche.isLoading && <ActivityIndicator color={T.bleu} style={{ marginTop: 24 }} />}
            {recherche.data?.length === 0 && <EtatVide texte={`Aucun article pour « ${qDebounce} »`} />}
            {(recherche.data || []).map((r: any, i: number) => (
              <Apparition key={r.id} index={Math.min(i, 8)}>
                <Tapable echelle={0.985}
                  onPress={() => router.push({ pathname: "/code/[chapitre]", params: { chapitre: r.chapitre_id, base, art: r.id } } as any)}
                  style={s.resultat}>
                  <Text style={s.resNumero}>ARTICLE {String(r.num_display).toUpperCase()}</Text>
                  {r.titre ? <Text style={s.resTitre} numberOfLines={1}>{r.titre}</Text> : null}
                  <Extrait html={r.extrait} />
                </Tapable>
              </Apparition>
            ))}
          </View>
        ) : (
          /* Table des matières */
          <View style={[s.liste, cap]}>
            {enPanne(requete) ? <EtatErreur onRetry={() => requete.refetch()} />
            : requete.isLoading ? <SqueletteListe />
            : liste.length === 0 ? <EtatVide texte="Aucun chapitre disponible." />
            : (
              <Apparition index={0}>
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
                          style={({ pressed }) => [s.ligne, pressed && { backgroundColor: T.bleuVoile }]}>
                          <View style={s.numeroColonne}>
                            <Text style={s.numeroRomain}>{romainDe(c)}</Text>
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
              </Apparition>
            )}
          </View>
        )}
        </Animated.ScrollView>
      </View>
    </>
  );
}

const s = creerStyles(() => ({

  liste: { paddingHorizontal: 16, marginTop: 14 },
  meta: { fontSize: 10, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.4, marginBottom: 10, marginLeft: 4 },
  surface: { backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord, overflow: "hidden" },
  separateur: { height: StyleSheet.hairlineWidth, backgroundColor: T.bordure, marginLeft: 72 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 15, paddingHorizontal: 16 },
  numeroColonne: { width: 40, alignItems: "center" },
  numeroRomain: { fontSize: 17, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 0.3, lineHeight: 21 },
  numeroLegende: { fontSize: 7.5, fontFamily: POLICE.gras, color: T.grisClair, letterSpacing: 1.2, marginTop: 2 },
  ligneTitre: { fontSize: 15, fontFamily: POLICE.demi, color: T.encre, lineHeight: 20, letterSpacing: -0.2 },
  ligneSous: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 3 },

  resultat: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 16, paddingVertical: 13, marginBottom: 10,
  },
  resNumero: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.2 },
  resTitre: { fontSize: 13.5, fontFamily: POLICE.demi, color: T.encre, marginTop: 5 },
  resExtrait: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.texte, lineHeight: 19, marginTop: 6 },
  resSurligne: { backgroundColor: "rgba(202,99,31,0.18)", color: "#8a4514", fontFamily: POLICE.demi },
}));
