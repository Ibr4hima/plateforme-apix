// La situation — le bloc vedette de l'accueil, désormais COMMUTABLE.
//
// Un grand nombre et sa tendance, plus quatre repères en pied de carte
// (2 × 2) : Flux d'IDE sortants, PIB, Importations et Exportations (commerce
// extérieur NACE). Toucher un repère l'installe en vedette — le nombre
// recompte, seul mouvement de la carte — et les Flux d'IDE entrants (la
// vedette par défaut) redescendent dans la grille. L'en-tête mène au module
// concerné.
//
// Les clés de requête sont volontairement celles des écrans Investissements,
// Échanges et Commerce extérieur : naviguer ensuite trouve les données déjà
// en cache — et réciproquement.
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ouvrirModule } from "@/lib/navigation";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Icone from "@/components/Icone";
import MiniTendance from "@/components/MiniTendance";
import { Os } from "@/components/Squelette";
import { Apparition, ChiffreAnime, IconeTendance, Tapable } from "@/components/ui";
import { enPanne, getJson, horsLigne } from "@/lib/api";
import { fmtMFCFA, fmtMillionsUSD, fmtUnite } from "@/lib/format";
import { IOS } from "@/lib/plateforme";
import { coin, ECHELLE, ESPACE, FONTE, RAYON, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";
import TexteDefilant from "@/components/TexteDefilant";

type Point = { annee: number; valeur: number };
type Cle = "entrants" | "sortants" | "pib" | "imports" | "exports";

const ORDRE: Cle[] = ["entrants", "sortants", "pib", "imports", "exports"];
// Chaque série mène à SA vue : le PIB aux indicateurs, les échanges à
// Commerce extérieur dans leur sens
const LABELS: Record<Cle, { long: string; court: string; route: string; params?: Record<string, string> }> = {
  entrants: { long: "FLUX D'IDE ENTRANTS", court: "FLUX D'IDE ENTRANTS", route: "/investissements" },
  sortants: { long: "FLUX D'IDE SORTANTS", court: "FLUX D'IDE SORTANTS", route: "/investissements" },
  pib:      { long: "PIB",                 court: "PIB",                 route: "/flux", params: { vue: "indicateurs" } },
  imports:  { long: "IMPORTATIONS · COMMERCE EXTÉRIEUR", court: "IMPORTATIONS", route: "/flux", params: { vue: "exterieur", sens: "import" } },
  exports:  { long: "EXPORTATIONS · COMMERCE EXTÉRIEUR", court: "EXPORTATIONS", route: "/flux", params: { vue: "exterieur", sens: "export" } },
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
    queryFn: () => getJson<any>("/nace/groupes-utilisation"),
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

  // LES VALEURS LONGUES SE RÉDUISENT, ELLES NE SE COUPENT PAS. « 6 974 Md
  // FCFA » ne tenait pas dans un repère et finissait en « 6 973,9 Md FCF… » :
  // le chiffre lu n'était plus le vrai. Le corps se choisit d'après la
  // longueur du texte — la valeur reste entière et exacte —, et l'ajustement
  // du système ne sert plus que de filet (iOS le fait au plus juste ; Android
  // rétrécit trop, d'où son plancher plus haut).
  const corpsRepere = (texte: string) => (texte.length >= 13 ? 13 : texte.length >= 10 ? 14 : 15);
  const corpsVedette = (texte: string) => (texte.length >= 13 ? 30 : texte.length >= 10 ? 34 : 38);
  const plancher = IOS ? 0.6 : 0.82;

  // Hors ligne, sans rien en cache : la carte le dit sur une ligne, sans
  // squelette qui attendrait pour rien — elle se remplit d'elle-même au
  // retour du réseau
  if (horsLigne(cnuced)) {
    return (
      <View style={[s.carte, s.carteErreur]}>
        <Icone sf="wifi.slash" materiel="wifi_off" taille={15} couleur={T.gris} />
        <Text style={s.erreurTexte} maxFontSizeMultiplier={ECHELLE.texte}>
          Hors ligne — les chiffres s'afficheront au retour du réseau
        </Text>
      </View>
    );
  }
  // Tant qu'aucune réponse n'est là, on attend ; l'erreur ne s'affiche que
  // s'il n'y a rien à montrer
  if (cnuced.data === undefined && !enPanne(cnuced)) {
    return (
      <View style={[s.carte, { gap: ESPACE.s }]}>
        <Os style={{ width: 150, height: 11, borderRadius: 6 }} />
        <Os style={{ width: 190, height: 34, borderRadius: 9 }} />
        <Os style={{ width: "100%", height: 56, borderRadius: 12 }} />
      </View>
    );
  }
  if (enPanne(cnuced) || series.entrants.length === 0) {
    // La carte ne disparaît pas en silence : elle dit pourquoi et se relance
    return (
      <Tapable onPress={() => cnuced.refetch()} style={[s.carte, s.carteErreur]}>
        <Icone sf="arrow.clockwise" materiel="refresh" taille={15} couleur={T.gris} />
        <Text style={s.erreurTexte} maxFontSizeMultiplier={ECHELLE.texte}>
          {enPanne(cnuced) ? "Chiffres indisponibles — toucher pour réessayer" : "Aucune donnée d'IDE disponible"}
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
    <Apparition index={0} cle="accueil-vedette">
      <View style={s.carte}>
        {/* En-tête : la série vedette, la flèche mène à son module */}
        <Tapable onPress={() => ouvrirModule(router, LABELS[actif].route, LABELS[actif].params)} surbrillance={false}
          style={s.enTete} hitSlop={12} accessibilityRole="button"
          accessibilityLabel={`${LABELS[actif].long}. Ouvrir le module`}>
          <TexteDefilant style={s.etiquette} maxFontSizeMultiplier={ECHELLE.compact}>
            {LABELS[actif].long}{dernier ? ` · ${dernier.annee}` : ""}
          </TexteDefilant>
          <Icone sf="chevron.right" materiel="chevron_right" taille={13} couleur={T.grisClair} poids="semibold" />
        </Tapable>

        {/* Le nombre, puis sa variation — le mesureur reste monté d'une
            vedette à l'autre */}
        <View onLayout={e => setLargeur(e.nativeEvent.layout.width)}>
        <View>
        {dernier ? (
          <>
            <ChiffreAnime texte={fmtDe(actif)(dernier.valeur)} style={[s.nombre, {
              fontSize: corpsVedette(fmtDe(actif)(dernier.valeur)),
              lineHeight: Math.round(corpsVedette(fmtDe(actif)(dernier.valeur)) * 1.16),
            }]} />
            {delta !== null && (
              <View style={s.deltaLigne}>
                <Icone sf={hausse ? "arrow.up.right" : "arrow.down.right"}
                  materiel={hausse ? "north_east" : "south_east"}
                  taille={12} couleur={hausse ? T.vert : "#dc2626"} poids="bold" />
                <Text style={[s.deltaTexte, { color: hausse ? T.vert : "#dc2626" }]}
                  maxFontSizeMultiplier={ECHELLE.chiffre}>
                  {Math.abs(delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                </Text>
                <Text style={s.deltaContexte} maxFontSizeMultiplier={ECHELLE.chiffre}>vs {precedent!.annee}</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={s.indispo} maxFontSizeMultiplier={ECHELLE.texte}>Données non importées pour cette série.</Text>
        )}

        {/* La silhouette de la série entière */}
        <View style={{ marginTop: ESPACE.s }}>
          {largeur > 0 && serie.length > 1 && (
            <MiniTendance valeurs={serie.map(x => x.valeur)} largeur={largeur} couleur={T.bleu as string} />
          )}
        </View>
        {serie.length > 1 && (
          <View style={s.bornes}>
            <Text style={s.borne} maxFontSizeMultiplier={ECHELLE.compact}>{serie[0].annee}</Text>
            <Text style={s.borne} maxFontSizeMultiplier={ECHELLE.compact}>{dernier!.annee}</Text>
          </View>
        )}
        </View>
        </View>

        {/* Quatre repères (2 × 2) — le toucher de l'un l'installe en vedette */}
        <View style={s.pied}>
          {reperes.map((cle, i) => {
            const sx = series[cle];
            const d = sx.at(-1) ?? null;
            const p = sx.length > 1 ? sx[sx.length - 2] : null;
            const dpc = d && p && p.valeur !== 0 ? ((d.valeur - p.valeur) / Math.abs(p.valeur)) * 100 : null;
            const texte = d ? fmtDe(cle)(d.valeur) : "—";
            const corps = corpsRepere(texte);
            return (
              <View key={cle} style={[s.repere, i % 2 === 1 && s.repereDroit, i >= 2 && s.repereBas]}>
              <Tapable
                onPress={() => setActif(cle)}
                style={{ flex: 1 }}>
                <Text style={s.repereLabel} numberOfLines={2} maxFontSizeMultiplier={ECHELLE.compact}>{LABELS[cle].court}</Text>
                <View style={s.repereLigne}>
                  {/* minimumFontScale : sans plancher, Android rétrécit le
                      texte bien au-delà du nécessaire — « 7 161,4 Md FCFA »
                      finissait deux fois plus petit que son voisin */}
                  <Text style={[s.repereValeur, { fontSize: corps, lineHeight: corps + 5 }]} numberOfLines={1}
                    adjustsFontSizeToFit minimumFontScale={plancher} maxFontSizeMultiplier={ECHELLE.chiffre}>
                    {texte}
                    {d ? <Text style={[s.repereAnnee, corps < 15 && { fontSize: 10 }]}>  {d.annee}</Text> : null}
                  </Text>
                  <IconeTendance delta={dpc} />
                </View>
              </Tapable>
              </View>
            );
          })}
        </View>
      </View>
    </Apparition>
  );
}

const s = creerStyles(() => ({
  carte: {
    marginHorizontal: ESPACE.m, backgroundColor: T.carte, borderRadius: coin(RAYON.grand),
    borderCurve: "continuous", paddingHorizontal: 18, paddingVertical: 16, overflow: "hidden",
    borderWidth: 1, borderColor: T.carteBord,
  },
  carteErreur: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 18 },
  erreurTexte: { ...TYPO.legende, color: T.gris, flex: 1 },
  enTete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  etiquette: { ...TYPO.micro, color: T.gris, flexShrink: 1 },
  // Le nombre en bleu APIX — la donnée EST la marque, comme les KPIs du site
  nombre: { fontSize: 38, lineHeight: 44, ...FONTE.gras, color: T.bleu, letterSpacing: -1, marginTop: 8, fontVariant: ["tabular-nums"] },
  deltaLigne: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  deltaTexte: { fontSize: 13, ...FONTE.gras, fontVariant: ["tabular-nums"] },
  deltaContexte: { fontSize: 13, ...FONTE.normal, color: T.gris, marginLeft: 2 },
  indispo: { fontSize: 12.5, ...FONTE.normal, color: T.gris, marginTop: 10 },
  bornes: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  borne: { fontSize: 10, ...FONTE.demi, color: T.gris, fontVariant: ["tabular-nums"] },

  // La grille 2 × 2 des repères — filets fins, comme les rangées de faits
  pied: {
    flexDirection: "row", flexWrap: "wrap",
    marginTop: ESPACE.m, paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
  },
  repere: { width: "50%", paddingTop: 11, paddingBottom: 5, paddingRight: 10, minHeight: 44, justifyContent: "center" },
  repereDroit: { paddingRight: 0, paddingLeft: 10, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: T.bordure },
  repereBas: { marginTop: 8 },
  repereLabel: { fontSize: 9.5, ...FONTE.gras, color: T.gris, letterSpacing: 0.8 },
  repereLigne: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  repereValeur: { ...TYPO.sousTitre, color: T.encre, flexShrink: 1, fontVariant: ["tabular-nums"] },
  repereAnnee: { fontSize: 11, ...FONTE.normal, color: T.gris },
}));
