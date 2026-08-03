// La situation — le bloc vedette de l'accueil, désormais COMMUTABLE.
//
// Un grand nombre et sa tendance, plus quatre repères en pied de carte
// (2 × 2) : Flux d'IDE sortants, PIB, Importations et Exportations (commerce
// extérieur NACE). Toucher un repère l'installe en vedette — le nombre
// recompte, la silhouette se redessine — et les Flux d'IDE entrants (la
// vedette par défaut) redescendent dans la grille. L'en-tête mène au module
// concerné.
//
// Les clés de requête sont volontairement celles des écrans Investissements,
// Échanges et Commerce extérieur : naviguer ensuite trouve les données déjà
// en cache — et réciproquement.
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Icone from "@/components/Icone";
import MiniTendance from "@/components/MiniTendance";
import { Os } from "@/components/Squelette";
import { Apparition, ChiffreAnime, IconeTendance, Tapable } from "@/components/ui";
import { getJson } from "@/lib/api";
import { fmtMFCFA, fmtMillionsUSD, fmtUnite } from "@/lib/format";
import { tick } from "@/lib/haptique";
import { ESPACE, POLICE, RAYON, T, TYPO } from "@/theme";

type Point = { annee: number; valeur: number };
type Cle = "entrants" | "sortants" | "pib" | "imports" | "exports";

const ORDRE: Cle[] = ["entrants", "sortants", "pib", "imports", "exports"];
const LABELS: Record<Cle, { long: string; court: string; route: string }> = {
  entrants: { long: "FLUX D'IDE ENTRANTS", court: "FLUX D'IDE ENTRANTS", route: "/investissements" },
  sortants: { long: "FLUX D'IDE SORTANTS", court: "FLUX D'IDE SORTANTS", route: "/investissements" },
  pib:      { long: "PIB",                 court: "PIB",                 route: "/flux" },
  imports:  { long: "IMPORTATIONS · COMMERCE EXTÉRIEUR", court: "IMPORTATIONS", route: "/flux" },
  exports:  { long: "EXPORTATIONS · COMMERCE EXTÉRIEUR", court: "EXPORTATIONS", route: "/flux" },
};

// Somme tolérante aux trous (règle du site)
const somme = (a: number | null, b: number | null) => a == null && b == null ? null : (a ?? 0) + (b ?? 0);

async function chargerCnuced() {
  const bornes = await getJson<any>("/ide/cnuced/annees");
  const p = new URLSearchParams({
    pays_list: "Sénégal",
    annee_min: String(bornes?.annee_min ?? 1990),
    annee_max: String(bornes?.annee_max ?? new Date().getFullYear()),
  });
  const brut = await getJson<any[]>(`/ide/cnuced?${p}`);
  const serieDe = (direction: string): Point[] => (brut || [])
    .filter(r => r.direction === direction && r.indicateur === "flux" && r.valeur != null)
    .map(r => ({ annee: r.annee, valeur: r.valeur }))
    .sort((a, b) => a.annee - b.annee);
  return { entrants: serieDe("entrant"), sortants: serieDe("sortant") };
}

export default function VedetteIde() {
  const router = useRouter();
  const [largeur, setLargeur] = useState(0);
  const [actif, setActif] = useState<Cle>("entrants");

  // ── IDE (CNUCED) — mêmes clés que l'onglet Investissements ──
  // v2 dans la clé : le cache persisté de l'ancienne forme ne doit pas resservir
  const cnuced = useQuery({ queryKey: ["accueil-situation", 2], queryFn: chargerCnuced, staleTime: 30 * 60 * 1000 });

  // ── PIB — mêmes clés que les Indicateurs économiques ──
  const pays = useQuery({ queryKey: ["stat-pays"], queryFn: () => getJson<any[]>("/statistiques/pays"), staleTime: 30 * 60 * 1000 });
  const indicateurs = useQuery({ queryKey: ["stat-indicateurs"], queryFn: () => getJson<any[]>("/statistiques/indicateurs"), staleTime: Infinity });
  const senId = useMemo(() => (pays.data || []).find((x: any) => x.code_iso3 === "SEN")?.id ?? null, [pays.data]);
  const donneesSen = useQuery({
    queryKey: ["stat-donnees", String(senId)], enabled: senId !== null,
    queryFn: () => getJson<any[]>(`/statistiques/donnees?pays=${senId}`), staleTime: 30 * 60 * 1000,
  });
  const unitePib = useMemo(() =>
    (indicateurs.data || []).find((i: any) => i.code === "pib")?.unite || "USD",
  [indicateurs.data]);
  const seriePib = useMemo<Point[]>(() =>
    (donneesSen.data || [])
      .filter((d: any) => d.indicateur === "pib" && d.valeur != null && d.annee > 0)
      .map((d: any) => ({ annee: d.annee, valeur: d.valeur }))
      .sort((a: Point, b: Point) => a.annee - b.annee),
  [donneesSen.data]);

  // ── Commerce extérieur (NACE) — même clé que le panneau dédié ──
  const gu = useQuery({
    queryKey: ["nace-gu"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<any>("/nace/groupes-utilisation").catch(() => null),
  });
  const seriesNace = useMemo(() => {
    const totaux = { export: new Map<number, number | null>(), import: new Map<number, number | null>() };
    for (const cle of ["export", "import"] as const) {
      for (const r of gu.data?.donnees?.[cle] || []) {
        totaux[cle].set(r.annee, somme(totaux[cle].get(r.annee) ?? null, r.valeur));
      }
    }
    const en = (m: Map<number, number | null>): Point[] =>
      [...m.entries()].filter(([, v]) => v != null).map(([annee, valeur]) => ({ annee, valeur: valeur! }))
        .sort((a, b) => a.annee - b.annee);
    return { exports: en(totaux.export), imports: en(totaux.import) };
  }, [gu.data]);

  const series: Record<Cle, Point[]> = {
    entrants: cnuced.data?.entrants ?? [],
    sortants: cnuced.data?.sortants ?? [],
    pib: seriePib,
    imports: seriesNace.imports,
    exports: seriesNace.exports,
  };
  const fmtDe = (cle: Cle) => (v: number) =>
    cle === "pib" ? fmtUnite(v, unitePib) : cle === "imports" || cle === "exports" ? fmtMFCFA(v) : fmtMillionsUSD(v);

  if (cnuced.isLoading) {
    return (
      <View style={[s.carte, { gap: ESPACE.s }]}>
        <Os style={{ width: 150, height: 11, borderRadius: 6 }} />
        <Os style={{ width: 190, height: 34, borderRadius: 9 }} />
        <Os style={{ width: "100%", height: 56, borderRadius: 12 }} />
      </View>
    );
  }
  if (cnuced.isError || series.entrants.length === 0) {
    // La carte ne disparaît pas en silence : elle dit pourquoi et se relance
    return (
      <Tapable onPress={() => cnuced.refetch()} style={[s.carte, s.carteErreur]}>
        <Icone sf="arrow.clockwise" materiel="refresh" taille={15} couleur={T.gris} />
        <Text style={s.erreurTexte}>
          {cnuced.isError ? "Chiffres indisponibles — toucher pour réessayer" : "Aucune donnée d'IDE disponible"}
        </Text>
      </Tapable>
    );
  }

  const serie = series[actif];
  const dernier = serie.at(-1) ?? null;
  const precedent = serie.length > 1 ? serie[serie.length - 2] : null;
  const delta = dernier && precedent && precedent.valeur !== 0
    ? ((dernier.valeur - precedent.valeur) / Math.abs(precedent.valeur)) * 100 : null;
  const hausse = (delta ?? 0) >= 0;
  const reperes = ORDRE.filter(c => c !== actif);

  return (
    <Apparition index={0}>
      <View style={s.carte}>
        {/* En-tête : la série vedette, la flèche mène à son module */}
        <Tapable onPress={() => router.push(LABELS[actif].route as any)} echelle={0.99} surbrillance={false}
          style={s.enTete}>
          <Text style={s.etiquette} numberOfLines={1}>
            {LABELS[actif].long}{dernier ? ` · ${dernier.annee}` : ""}
          </Text>
          <Icone sf="chevron.right" materiel="chevron_right" taille={13} couleur={T.grisClair} poids="semibold" />
        </Tapable>

        {/* Le nombre, puis sa variation */}
        {dernier ? (
          <>
            <ChiffreAnime texte={fmtDe(actif)(dernier.valeur)} style={s.nombre} />
            {delta !== null && (
              <View style={s.deltaLigne}>
                <Icone sf={hausse ? "arrow.up.right" : "arrow.down.right"}
                  materiel={hausse ? "north_east" : "south_east"}
                  taille={12} couleur={hausse ? T.vert : "#dc2626"} poids="bold" />
                <Text style={[s.deltaTexte, { color: hausse ? T.vert : "#dc2626" }]}>
                  {Math.abs(delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                </Text>
                <Text style={s.deltaContexte}>vs {precedent!.annee}</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={s.indispo}>Données non importées pour cette série.</Text>
        )}

        {/* La silhouette de la série entière */}
        <View style={{ marginTop: ESPACE.s }} onLayout={e => setLargeur(e.nativeEvent.layout.width)}>
          {largeur > 0 && serie.length > 1 && (
            <MiniTendance valeurs={serie.map(x => x.valeur)} largeur={largeur} couleur={T.bleu as string} />
          )}
        </View>
        {serie.length > 1 && (
          <View style={s.bornes}>
            <Text style={s.borne}>{serie[0].annee}</Text>
            <Text style={s.borne}>{dernier!.annee}</Text>
          </View>
        )}

        {/* Quatre repères (2 × 2) — toucher installe en vedette */}
        <View style={s.pied}>
          {reperes.map((cle, i) => {
            const sx = series[cle];
            const d = sx.at(-1) ?? null;
            const p = sx.length > 1 ? sx[sx.length - 2] : null;
            const dpc = d && p && p.valeur !== 0 ? ((d.valeur - p.valeur) / Math.abs(p.valeur)) * 100 : null;
            return (
              <Tapable key={cle} echelle={0.96}
                onPress={() => { tick(); setActif(cle); }}
                style={[s.repere, i % 2 === 1 && s.repereDroit, i >= 2 && s.repereBas]}>
                <Text style={s.repereLabel} numberOfLines={1}>{LABELS[cle].court}</Text>
                <View style={s.repereLigne}>
                  <Text style={s.repereValeur} numberOfLines={1} adjustsFontSizeToFit>
                    {d ? fmtDe(cle)(d.valeur) : "—"}
                    {d ? <Text style={s.repereAnnee}>  {d.annee}</Text> : null}
                  </Text>
                  <IconeTendance delta={dpc} />
                </View>
              </Tapable>
            );
          })}
        </View>
      </View>
    </Apparition>
  );
}

const s = StyleSheet.create({
  carte: {
    marginHorizontal: ESPACE.m, backgroundColor: T.carte, borderRadius: RAYON.grand,
    borderCurve: "continuous", paddingHorizontal: 18, paddingVertical: 16, overflow: "hidden",
    borderWidth: 1, borderColor: T.carteBord,
  },
  carteErreur: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 18 },
  erreurTexte: { ...TYPO.legende, color: T.gris, flex: 1 },
  enTete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  etiquette: { ...TYPO.micro, color: T.gris, flexShrink: 1 },
  // Le nombre en bleu APIX — la donnée EST la marque, comme les KPIs du site
  nombre: { fontSize: 38, lineHeight: 44, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -1, marginTop: 8, fontVariant: ["tabular-nums"] },
  deltaLigne: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  deltaTexte: { fontSize: 13, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  deltaContexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.gris, marginLeft: 2 },
  indispo: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 10 },
  bornes: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  borne: { fontSize: 10, fontFamily: POLICE.demi, color: T.grisClair, fontVariant: ["tabular-nums"] },

  // La grille 2 × 2 des repères — filets fins, comme les rangées de faits
  pied: {
    flexDirection: "row", flexWrap: "wrap",
    marginTop: ESPACE.m, paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
  },
  repere: { width: "50%", paddingTop: 10, paddingBottom: 2, paddingRight: 10 },
  repereDroit: { paddingRight: 0, paddingLeft: 10, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: T.bordure },
  repereBas: { marginTop: 8 },
  repereLabel: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 0.8 },
  repereLigne: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  repereValeur: { ...TYPO.sousTitre, color: T.encre, flexShrink: 1, fontVariant: ["tabular-nums"] },
  repereAnnee: { fontSize: 11, fontFamily: POLICE.normal, color: T.grisClair },
});
