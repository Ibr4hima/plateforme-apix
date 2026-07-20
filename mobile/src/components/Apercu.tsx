// Aperçu — KPIs officiels du Sénégal (CNUCED, macroéconomie) en pages de 4,
// défilement horizontal avec rotation automatique. Monochrome bleu.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { Apparition, ChiffreAnime } from "@/components/ui";
import { getJson } from "@/lib/api";
import { tick } from "@/lib/haptique";
import { fmtUSD, fmtUnite } from "@/lib/format";
import { POLICE, T } from "@/theme";

type Kpi = { label: string; valeur: string; annee?: number | null };

const LARGEUR = Dimensions.get("window").width;
const ROTATION_MS = 6000;

async function chargerKpis(): Promise<Kpi[]> {
  const paysListe = await getJson<any[]>("/statistiques/pays");
  const sen = (paysListe || []).find(p => p.code_iso3 === "SEN");
  if (!sen) return [];
  const [flux, stock, comp] = await Promise.allSettled([
    getJson<any>(`/statistiques/ide_flux?pays=${sen.id}`),
    getJson<any>(`/statistiques/ide_flux?pays=${sen.id}&indicateur=stock`),
    getJson<any>(`/statistiques/comparaison?pays=${sen.id}`),
  ]);
  const ok = (r: PromiseSettledResult<any>) => (r.status === "fulfilled" ? r.value : null);
  const f = ok(flux)?.[String(sen.id)] || {};
  const s = ok(stock)?.[String(sen.id)] || {};
  const donnees = ok(comp);
  const vals = donnees?.valeurs?.[String(sen.id)] || {};
  // Unité déclarée par la plateforme pour chaque indicateur (pas d'hypothèse
  // locale : le PIB peut être stocké en USD ou en Md USD selon les imports)
  const unites: Record<string, string> = Object.fromEntries(
    (donnees?.indicateurs || []).map((i: any) => [i.code, i.unite]));
  const macro = (code: string, label: string): Kpi | null => {
    const c = vals[code];
    return c ? { label, valeur: fmtUnite(c.valeur, unites[code] || ""), annee: c.annee } : null;
  };

  const kpis: (Kpi | null)[] = [
    f.entrant && { label: "Flux d'IDE entrants",  valeur: fmtUSD(f.entrant.valeur), annee: f.entrant.annee },
    f.sortant && { label: "Flux d'IDE sortants",  valeur: fmtUSD(f.sortant.valeur), annee: f.sortant.annee },
    f.entrant && f.sortant && {
      label: "Flux d'IDE net", valeur: fmtUSD(f.entrant.valeur - f.sortant.valeur),
      annee: Math.max(f.entrant.annee, f.sortant.annee),
    },
    s.entrant && { label: "Stock d'IDE entrant",  valeur: fmtUSD(s.entrant.valeur), annee: s.entrant.annee },
    s.sortant && { label: "Stock d'IDE sortant",  valeur: fmtUSD(s.sortant.valeur), annee: s.sortant.annee },
    macro("pib", "PIB"),
    macro("population", "Population"),
    macro("superficie", "Superficie"),
  ];
  return kpis.filter(Boolean) as Kpi[];
}

function decouper<T>(liste: T[], taille: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) pages.push(liste.slice(i, i + taille));
  return pages;
}

export default function Apercu() {
  const { data } = useQuery({ queryKey: ["apercu-senegal"], queryFn: chargerKpis, staleTime: 30 * 60 * 1000 });
  const pages = decouper(data || [], 4).slice(0, 3);
  const [page, setPage] = useState(0);
  const defileur = useRef<ScrollView>(null);
  const pageRef = useRef(0);
  const parGeste = useRef(false);
  pageRef.current = page;

  // Rotation automatique — reprend après un défilement manuel
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
    <View style={s.bloc}>
      <Text style={s.titre}>APERÇU · SÉNÉGAL</Text>
      <ScrollView
        ref={defileur} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => { parGeste.current = true; }}
        onMomentumScrollEnd={e => {
          const suivante = Math.round(e.nativeEvent.contentOffset.x / LARGEUR);
          if (parGeste.current && suivante !== pageRef.current) tick();
          parGeste.current = false;
          setPage(suivante);
        }}>
        {pages.map((kpis, i) => (
          <View key={i} style={[s.page, { width: LARGEUR }]}>
            {kpis.map((kpi, k) => (
              <Apparition key={kpi.label} index={k} style={s.carte}>
                <View style={s.carteFilet} />
                <Text style={s.carteLabel} numberOfLines={1}>{kpi.label.toUpperCase()}</Text>
                <ChiffreAnime texte={kpi.valeur} style={s.carteValeur} />
                {kpi.annee ? <View style={s.anneePille}><Text style={s.anneeTexte}>{kpi.annee}</Text></View> : null}
              </Apparition>
            ))}
          </View>
        ))}
      </ScrollView>
      {pages.length > 1 && (
        <View style={s.points}>
          {pages.map((_, i) => (
            <View key={i} style={[s.point, i === page && s.pointActif]} />
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { marginTop: 26 },
  titre: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.6, marginBottom: 12, paddingHorizontal: 18 },
  page: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 18 },
  carte: {
    width: (LARGEUR - 36 - 12) / 2, backgroundColor: T.carte, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 15, overflow: "hidden",
    shadowColor: "#001e3c", shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  carteFilet: { position: "absolute", left: 16, right: 16, top: 0, height: 2.5, borderRadius: 2, backgroundColor: T.blocBord },
  carteLabel: { fontSize: 9.5, fontFamily: POLICE.gras, color: "#7d95ad", letterSpacing: 1, marginTop: 4 },
  carteValeur: { fontSize: 23, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -0.5, marginTop: 9, fontVariant: ["tabular-nums"] },
  anneePille: { alignSelf: "flex-start", backgroundColor: T.bleuVoile, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2.5, marginTop: 9 },
  anneeTexte: { fontSize: 10, fontFamily: POLICE.gras, color: T.bleu, fontVariant: ["tabular-nums"] },
  points: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 13 },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.blocBord },
  pointActif: { width: 18, backgroundColor: T.bleu },
});
