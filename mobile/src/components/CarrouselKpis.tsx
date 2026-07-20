// Carrousel de KPIs — pages de 4 cards (2×2) avec défilement manuel,
// rotation automatique douce et points de navigation (motif de l'accueil).
// Partagé entre Indicateurs économiques et Flux bilatéraux.
import { memo, useEffect, useRef, useState } from "react";
import { Pressable } from "react-native";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { Apparition, ChiffreAnime } from "@/components/ui";
import { abonnerEpingles, basculerEpingle, chargerEpingles, rafraichirEpingles } from "@/lib/epingles";
import { succes, tick } from "@/lib/haptique";
import Symbole from "@/components/Symbole";
import { POLICE, T } from "@/theme";

export type KpiCarrousel = { cle: string; label: string; valeur: string; note?: string | null; negatif?: boolean };
// Source d'épinglage : identifiant stable + libellé + destination accueil
export type SourceKpis = { id: string; label: string; href: string };

const LARGEUR = Dimensions.get("window").width;
const ROTATION_MS = 6000;

function decouper<T>(liste: T[], taille: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) pages.push(liste.slice(i, i + taille));
  return pages;
}

function CarrouselKpis({ kpis, source }: { kpis: KpiCarrousel[]; source?: SourceKpis }) {
  const pages = decouper(kpis, 4);
  const [page, setPage] = useState(0);
  const defileur = useRef<ScrollView>(null);
  const pageRef = useRef(0);
  const parGeste = useRef(false); // tick haptique sur geste seulement, pas sur la rotation auto
  pageRef.current = page;

  // ── Épinglage sur l'accueil (appui long) ──
  const [epingles, setEpingles] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!source) return;
    let vivant = true;
    const charger = () => chargerEpingles().then(l => { if (vivant) setEpingles(new Set(l.map(e => e.id))); });
    charger();
    const desabonner = abonnerEpingles(charger);
    return () => { vivant = false; desabonner(); };
  }, [source?.id]);
  // Les valeurs recalculées rafraîchissent les épinglés correspondants
  useEffect(() => {
    if (source && kpis.length) rafraichirEpingles(source.id, kpis);
  }, [source?.id, kpis]);
  const epingler = (kpi: KpiCarrousel) => {
    if (!source) return;
    basculerEpingle({
      id: `${source.id}:${kpi.cle}`, cle: kpi.cle, label: kpi.label,
      valeur: kpi.valeur, note: kpi.note, sourceLabel: source.label, href: source.href,
    }).then(({ ajoute }) => (ajoute ? succes() : tick()));
  };

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
        onScrollBeginDrag={() => { parGeste.current = true; }}
        onMomentumScrollEnd={e => {
          const suivante = Math.round(e.nativeEvent.contentOffset.x / LARGEUR);
          if (parGeste.current && suivante !== pageRef.current) tick();
          parGeste.current = false;
          setPage(suivante);
        }}>
        {pages.map((groupe, i) => (
          <View key={i} style={[s.page, { width: LARGEUR }]}>
            {groupe.map((kpi, k) => {
              const estEpingle = source ? epingles.has(`${source.id}:${kpi.cle}`) : false;
              return (
                <Apparition key={kpi.cle} index={k} style={s.carte}>
                  <Pressable onLongPress={source ? () => epingler(kpi) : undefined} delayLongPress={340}>
                    <View style={s.filet} />
                    {estEpingle && (
                      <View style={s.epingle}><Symbole nom="keep" taille={12} couleur={T.bleu} /></View>
                    )}
                    <Text style={s.label} numberOfLines={2}>{kpi.label.toUpperCase()}</Text>
                    <ChiffreAnime texte={kpi.valeur} style={[s.valeur, kpi.negatif && { color: "#dc2626" }]} />
                    {kpi.note ? (
                      <View style={s.note}><Text style={s.noteTexte} numberOfLines={1}>{kpi.note}</Text></View>
                    ) : null}
                  </Pressable>
                </Apparition>
              );
            })}
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
    width: (LARGEUR - 32 - 11) / 2, backgroundColor: T.carte, borderRadius: 18,
    paddingHorizontal: 15, paddingVertical: 13, overflow: "hidden",
    shadowColor: "#001e3c", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  filet: { position: "absolute", left: 15, right: 15, top: 0, height: 2.5, borderRadius: 2, backgroundColor: T.blocBord },
  label: { fontSize: 9, fontFamily: POLICE.gras, color: "#7d95ad", letterSpacing: 0.9, lineHeight: 12, marginTop: 4, minHeight: 24 },
  valeur: { fontSize: 20, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -0.4, marginTop: 7, fontVariant: ["tabular-nums"] },
  note: { alignSelf: "flex-start", maxWidth: "100%", backgroundColor: T.bleuVoile, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 8 },
  noteTexte: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.bleu, fontVariant: ["tabular-nums"] },
  epingle: { position: "absolute", top: 6, right: 0 },
  points: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.blocBord },
  pointActif: { width: 18, backgroundColor: T.bleu },
});

export default memo(CarrouselKpis);
