// Carrousel de KPIs — pages de 4 cards (2×2) avec défilement manuel,
// rotation automatique douce et points de navigation (motif de l'accueil).
// Partagé entre Indicateurs économiques et Flux bilatéraux.
import { useEffect, useRef, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { POLICE, T } from "@/theme";

export type KpiCarrousel = { cle: string; label: string; valeur: string; note?: string | null; negatif?: boolean };

const LARGEUR = Dimensions.get("window").width;
const ROTATION_MS = 6000;

function decouper<T>(liste: T[], taille: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) pages.push(liste.slice(i, i + taille));
  return pages;
}

export default function CarrouselKpis({ kpis }: { kpis: KpiCarrousel[] }) {
  const pages = decouper(kpis, 4);
  const [page, setPage] = useState(0);
  const defileur = useRef<ScrollView>(null);
  const pageRef = useRef(0);
  pageRef.current = page;

  useEffect(() => {
    if (pages.length < 2) return;
    const minuteur = setInterval(() => {
      const suivante = (pageRef.current + 1) % pages.length;
      defileur.current?.scrollTo({ x: suivante * LARGEUR, animated: true });
    }, ROTATION_MS);
    return () => clearInterval(minuteur);
  }, [pages.length]);

  if (!pages.length) return null;
  return (
    <View>
      <ScrollView
        ref={defileur} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / LARGEUR))}>
        {pages.map((groupe, i) => (
          <View key={i} style={[s.page, { width: LARGEUR }]}>
            {groupe.map(kpi => (
              <View key={kpi.cle} style={s.carte}>
                <View style={s.filet} />
                <Text style={s.label} numberOfLines={2}>{kpi.label.toUpperCase()}</Text>
                <Text style={[s.valeur, kpi.negatif && { color: "#dc2626" }]} numberOfLines={1} adjustsFontSizeToFit>{kpi.valeur}</Text>
                {kpi.note ? (
                  <View style={s.note}><Text style={s.noteTexte} numberOfLines={1}>{kpi.note}</Text></View>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      {pages.length > 1 && (
        <View style={s.points}>
          {pages.map((_, i) => <View key={i} style={[s.point, i === page && s.pointActif]} />)}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flexDirection: "row", flexWrap: "wrap", gap: 11, paddingHorizontal: 16 },
  carte: {
    width: (LARGEUR - 32 - 11) / 2, backgroundColor: "#fff", borderRadius: 18,
    paddingHorizontal: 15, paddingVertical: 13, overflow: "hidden",
    shadowColor: "#001e3c", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  filet: { position: "absolute", left: 15, right: 15, top: 0, height: 2.5, borderRadius: 2, backgroundColor: "rgba(0,79,145,0.14)" },
  label: { fontSize: 9, fontFamily: POLICE.gras, color: "#7d95ad", letterSpacing: 0.9, lineHeight: 12, marginTop: 4, minHeight: 24 },
  valeur: { fontSize: 20, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -0.4, marginTop: 7, fontVariant: ["tabular-nums"] },
  note: { alignSelf: "flex-start", maxWidth: "100%", backgroundColor: "rgba(0,79,145,0.07)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 8 },
  noteTexte: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.bleu, fontVariant: ["tabular-nums"] },
  points: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(0,79,145,0.18)" },
  pointActif: { width: 18, backgroundColor: T.bleu },
});
