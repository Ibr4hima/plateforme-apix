// Flux bilatéraux — la grammaire EXACTE de la carte vedette de l'accueil :
// les Exportations en vedette (micro-étiquette, badge pays bleu sans point,
// nombre en 38 pt qui compte, variation vs N-1 fléchée, silhouette Skia sans
// axes, bornes d'années) et DEUX repères en grille — Importations et Balance
// commerciale — la tendance en glyphe trending_up / down / flat teinté.
// Toucher un repère l'installe en vedette ; la carte porte tout l'écran.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SqueletteDonnees } from "@/components/Squelette";
import { ChiffreAnime, EtatErreur, EtatVide, IconeTendance, Tapable } from "@/components/ui";
import CurseurAnnees from "@/components/CurseurAnnees";
import Icone from "@/components/Icone";
import MiniTendance from "@/components/MiniTendance";
import StatistiquesFiltres, { FiltresStatistiques } from "@/components/StatistiquesFiltres";
import { getJson } from "@/lib/api";
import { fmtUSD } from "@/lib/format";
import { tick } from "@/lib/haptique";
import { POLICE, T, TYPO } from "@/theme";

type CleSerie = "exports" | "imports" | "balance";
const LABELS: Record<CleSerie, string> = {
  exports: "EXPORTATIONS", imports: "IMPORTATIONS", balance: "BALANCE COMMERCIALE",
};
const COURTS: Record<CleSerie, string> = {
  exports: "EXPORTATIONS", imports: "IMPORTATIONS", balance: "BALANCE COMMERCIALE",
};
const ORDRE: CleSerie[] = ["exports", "imports", "balance"];

type Point = { annee: number; valeur: number };

export default function CommercePanel({ filtresOuverts, onFermerFiltres, onOuvrirFiltres, onNbFiltres }: {
  filtresOuverts: boolean; onFermerFiltres: () => void; onOuvrirFiltres: () => void; onNbFiltres: (n: number) => void;
}) {
  const [actif, setActif] = useState<CleSerie>("exports");
  const [anneeSel, setAnneeSel] = useState<number | null>(null);
  const [largeurTendance, setLargeurTendance] = useState(0);

  // Référentiel du commerce : années disponibles, ressources, pays
  const { data: refs, isLoading, isError, refetch } = useQuery({
    queryKey: ["commerce-filtres"], queryFn: () => getJson<any>("/statistiques/commerce/filtres"), staleTime: Infinity,
  });
  const annees: number[] = useMemo(() => (refs?.annees || []).slice().sort((a: number, b: number) => a - b), [refs]);
  const paysOpts: any[] = refs?.pays || [];
  const senId = useMemo(() => paysOpts.find((p: any) => p.code_iso3 === "SEN")?.id ?? null, [paysOpts]);

  const [filtres, setFiltres] = useState<FiltresStatistiques | null>(null);
  const f: FiltresStatistiques = filtres ?? {
    vue: "exportateur", selection: senId !== null ? [senId] : [],
    modeAnnees: "plage", anneeMin: annees[0] ?? 0, anneeMax: annees[annees.length - 1] ?? 9999, anneesSpec: [],
  };
  const selId = f.selection[0] ?? null;
  const bornes: [number, number] = annees.length ? [annees[0], annees[annees.length - 1]] : [0, 0];
  const anneeMin = Math.max(f.anneeMin, bornes[0]) || bornes[0];
  const anneeMax = Math.min(f.anneeMax, bornes[1]) || bornes[1];

  // Le sens (exportateur / importateur) suit la vedette, la Balance garde
  // le dernier sens choisi — il pilote la feuille de filtres
  const direction = actif === "imports" ? "importateur" : actif === "exports" ? "exportateur" : f.vue;

  // Paramètres communs des endpoints commerce (mêmes règles que le site)
  const params = useMemo(() => {
    if (selId === null) return null;
    const p = new URLSearchParams({ pays_id: String(selId), direction });
    if (f.modeAnnees === "specifiques" && f.anneesSpec.length) p.set("annees", f.anneesSpec.join(","));
    else { p.set("annee_min", String(anneeMin)); p.set("annee_max", String(anneeMax)); }
    return p.toString();
  }, [selId, direction, f.modeAnnees, f.anneesSpec, anneeMin, anneeMax]);

  const balance: any[] = useQuery({
    queryKey: ["commerce-balance", params], enabled: !!params,
    queryFn: () => getJson<any[]>(`/statistiques/commerce/balance?${params}`).catch(() => []),
  }).data || [];

  // Badge du bouton filtre du hero
  const nbFiltres =
    (senId !== null && selId !== senId ? 1 : 0) +
    (f.modeAnnees === "specifiques" ? (f.anneesSpec.length ? 1 : 0) : (filtres && (f.anneeMin > bornes[0] || f.anneeMax < bornes[1]) ? 1 : 0));
  useEffect(() => { onNbFiltres(nbFiltres); }, [nbFiltres, onNbFiltres]);

  const selPays = paysOpts.find((p: any) => p.id === selId);
  // Années servies par la réponse balance ; le curseur ne pointe que dedans
  const anneesSerie = useMemo(() => balance.map((b: any) => b.annee).sort((a: number, b: number) => a - b), [balance]);
  useEffect(() => {
    if (anneeSel != null && !anneesSerie.includes(anneeSel)) setAnneeSel(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneesSerie.join(",")]);

  if (isLoading) return <SqueletteDonnees />;
  if (isError) return <EtatErreur onRetry={() => refetch()} />;
  if (!annees.length) return (
    <EtatVide texte="Aucune donnée commerciale" sousTexte="Les flux bilatéraux seront disponibles après import dans l'administration." />
  );

  // ── Les trois séries, depuis la même réponse balance ──
  const serieDe = (cle: CleSerie): Point[] => balance
    .map((b: any) => ({ annee: b.annee, valeur: cle === "exports" ? b.exportations : cle === "imports" ? b.importations : b.balance }))
    .filter((p: any): p is Point => p.valeur != null);

  const jusqu = (sx: Point[]) => anneeSel == null ? sx : sx.filter(pt => pt.annee <= anneeSel);
  const serie = jusqu(serieDe(actif));
  const dernier = serie.at(-1) ?? null;
  const precedent = serie.length > 1 ? serie[serie.length - 2] : null;
  const delta = dernier && precedent && precedent.valeur !== 0
    ? ((dernier.valeur - precedent.valeur) / Math.abs(precedent.valeur)) * 100 : null;
  const hausse = (delta ?? 0) >= 0;
  const reperes = ORDRE.filter(c => c !== actif);

  const choisir = (cle: CleSerie) => {
    tick();
    setActif(cle);
    // Le sens des filtres suit la vedette Exportations / Importations
    if (cle !== "balance") setFiltres({ ...f, vue: cle === "exports" ? "exportateur" : "importateur" });
  };

  return (
    <>
      {/* ── La vedette (grammaire exacte de l'accueil) ── */}
      <View style={s.rangee}>
        {/* Le curseur d'années — le doigt remonte le temps */}
        <CurseurAnnees annees={anneesSerie}
          valeur={anneeSel ?? anneesSerie[anneesSerie.length - 1]}
          onChange={a => setAnneeSel(a === anneesSerie[anneesSerie.length - 1] ? null : a)} />
        <View style={s.vedette}>
          <View style={s.vedetteEnTete}>
            <Text style={s.etiquette} numberOfLines={1}>
              {LABELS[actif]}{dernier ? ` · ${dernier.annee}` : ""}
            </Text>
            {/* Le pays en badge bleu, sans point — le tap ouvre les filtres */}
            <Pressable onPress={onOuvrirFiltres} style={s.badgePays}>
              <Text style={s.badgePaysTexte} numberOfLines={1}>{selPays?.nom || "—"}</Text>
            </Pressable>
          </View>

          {dernier ? (
            <View style={s.nombreLigne}>
              <ChiffreAnime texte={fmtUSD(dernier.valeur)} style={s.nombre} />
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
            </View>
          ) : (
            <Text style={s.indispo}>Donnée indisponible.</Text>
          )}

          {/* La silhouette de la série entière */}
          <View style={{ marginTop: 10 }} onLayout={e => setLargeurTendance(e.nativeEvent.layout.width)}>
            {largeurTendance > 0 && serie.length > 1 && (
              <MiniTendance valeurs={serie.map(x => x.valeur)} largeur={largeurTendance} couleur={T.bleu as string} />
            )}
          </View>
          {serie.length > 1 && (
            <View style={s.bornes}>
              <Text style={s.borne}>{serie[0].annee}</Text>
              <Text style={s.borne}>{dernier!.annee}</Text>
            </View>
          )}

          {/* Les repères, un par ligne — la tendance en glyphe teinté */}
          <View style={s.pied}>
            {reperes.map((cle, i) => {
              const sx = jusqu(serieDe(cle));
              const d = sx.at(-1) ?? null;
              const p = sx.length > 1 ? sx[sx.length - 2] : null;
              const dpc = d && p && p.valeur !== 0 ? ((d.valeur - p.valeur) / Math.abs(p.valeur)) * 100 : null;
              return (
                <Tapable key={cle} echelle={0.98}
                  onPress={() => choisir(cle)}
                  style={[s.repere, i > 0 && s.repereBord]}>
                  <Text style={s.repereLabel} numberOfLines={1}>{COURTS[cle]}</Text>
                  <Text style={s.repereValeur} numberOfLines={1}>
                    {d ? fmtUSD(d.valeur) : "—"}
                  </Text>
                  <IconeTendance delta={dpc} />
                </Tapable>
              );
            })}
          </View>
        </View>
      </View>

      {filtresOuverts && (
        <StatistiquesFiltres
          pays={paysOpts} senId={senId}
          anneesDispo={annees}
          vues={[{ cle: "exportateur", label: "Vue exportateur" }, { cle: "importateur", label: "Vue importateur" }]}
          multiPour={() => false}
          valeurs={{ ...f, anneeMin, anneeMax }}
          onAppliquer={nf => { setFiltres(nf); if (actif !== "balance") setActif(nf.vue === "importateur" ? "imports" : "exports"); }}
          onClose={onFermerFiltres} />
      )}
    </>
  );
}

const s = StyleSheet.create({
  rangee: { paddingHorizontal: 16, marginTop: 14 },

  // La carte vedette — les styles exacts de l'accueil
  vedette: {
    backgroundColor: T.carte, borderRadius: 18, borderCurve: "continuous",
    paddingHorizontal: 18, paddingVertical: 16, overflow: "hidden",
    borderWidth: 1, borderColor: T.carteBord,
  },
  vedetteEnTete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  etiquette: { ...TYPO.micro, color: T.gris, flexShrink: 1 },
  badgePays: {
    backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3.5,
    borderWidth: 1, borderColor: "rgba(0,79,145,0.22)", maxWidth: 150,
  },
  badgePaysTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.bleu },
  nombreLigne: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  nombre: { fontSize: 38, lineHeight: 44, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -1, marginTop: 8, fontVariant: ["tabular-nums"] },
  deltaLigne: { flexDirection: "row", alignItems: "center", gap: 4 },
  deltaTexte: { fontSize: 13, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  deltaContexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.gris, marginLeft: 2 },
  indispo: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 10 },
  bornes: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  borne: { fontSize: 10, fontFamily: POLICE.demi, color: T.grisClair, fontVariant: ["tabular-nums"] },

  // Les repères, un par ligne — le label à gauche, la valeur et sa tendance à droite
  pied: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  repere: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10.5 },
  repereBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  repereLabel: { flex: 1, minWidth: 0, fontSize: 9.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 0.8 },
  repereValeur: { ...TYPO.sousTitre, color: T.encre, flexShrink: 1, fontVariant: ["tabular-nums"] },
});
