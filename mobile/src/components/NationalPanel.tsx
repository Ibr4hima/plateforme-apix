// Investissements nationaux (BDEF · ANSD) — la même grammaire que l'onglet
// IDE : UNE grande courbe en vedette (micro-étiquette, nombre en 38 pt qui
// compte, variation fléchée à côté, graphe signature épuré, légende de
// lecture en multi-séries), les sept autres indicateurs du site en rangées
// commutables, et le reste des indicateurs BDEF listés à plat par catégorie
// avec leur variation vs N-1 fléchée. Analyse sectorielle (Global, cascade
// macro-secteur → groupe → secteur) ou comparative (4 cibles au plus) — la
// vue globale compare les macro-secteurs sur chaque courbe, comme le site.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SqueletteDonnees } from "@/components/Squelette";
import { ChiffreAnime, EtatErreur, EtatVide, Feuille, Tapable } from "@/components/ui";
import GrapheLignes, { Serie } from "@/components/GrapheLignes";
import Icone from "@/components/Icone";
import MiniTendance from "@/components/MiniTendance";
import { getJson } from "@/lib/api";
import { COMP_PALETTE } from "@/lib/couleurs";
import { succes, tick } from "@/lib/haptique";
import { POLICE, T, TYPO } from "@/theme";

// ── Règles du site ──
const BDEF_KPI_DEFAUT_ORDRE = true; // tous les indicateurs, dans l'ordre servi
const BDEF_GRAPHES_DEFAUT = [
  "act_ca", "eff_vetuste", "inv_actif_immo", "inv_tx_autofin",
  "liq_fdr", "sf_pression_fisc", "sf_autonomie", "rent_ebe",
];
const BDEF_MACRO_COULEURS = ["#004f91", "#ca631f", "#188038", "#6A1B9A"];
const NIVEAU_COULEUR: Record<string, string> = {
  global: "#004f91", macro_secteur: "#004f91", groupe: "#ca631f", secteur: "#188038",
};

type BdefIndic = { code: string; libelle: string; unite: string; categorie: string; valeurs: Record<string, number | null> };
type Sel = { niveau: "global" | "macro_secteur" | "groupe" | "secteur"; cible_id: number | null; libelle: string };

type FiltresNational = {
  sousVue: "sectorielle" | "comparative";
  sel: Sel;
  compType: "macro_secteur" | "groupe" | "secteur";
  compSelec: number[];
  modeAnnees: "plage" | "specifiques";
  anneeMin: number; anneeMax: number; anneesSpec: number[];
};

// Montants en FCFA réels (fichier source en millions de FCFA) — règle du site
export function fmtBdef(v: number | null, unite: string, court = false): string {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  const nf1 = (x: number) => x.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  if (unite === "%") return `${nf1(v)} %`;
  if (unite === "ratio") return v.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
  if (unite === "jours") return `${Math.round(v)} j`;
  const suf = court ? "" : " FCFA";
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf1(v / 1e9)} Md${suf}`;
  if (a >= 1e6) return `${nf1(v / 1e6)} M${suf}`;
  if (a >= 1e3) return `${Math.round(v / 1e3).toLocaleString("fr-FR")} k${suf}`;
  return `${Math.round(v).toLocaleString("fr-FR")} FCFA`;
}

const NIVEAU_LABEL: Record<string, string> = {
  macro_secteur: "Macro-secteurs", groupe: "Groupes", secteur: "Secteurs",
};

export default function NationalPanel({ filtresOuverts, onFermerFiltres, onOuvrirFiltres, onNbFiltres }: {
  filtresOuverts: boolean; onFermerFiltres: () => void; onOuvrirFiltres: () => void; onNbFiltres: (n: number) => void;
}) {
  const { width } = useWindowDimensions();
  const [serieActive, setSerieActive] = useState(0);
  // Référentiel de la cascade
  const { data: refs } = useQuery({
    queryKey: ["bdef-secteurs"], queryFn: () => getJson<any>("/bdef/secteurs"), staleTime: Infinity,
  });

  const [filtres, setFiltres] = useState<FiltresNational | null>(null);
  const macros: any[] = refs?.macro_secteur || [];
  const f: FiltresNational = useMemo(() => filtres ?? {
    sousVue: "sectorielle",
    sel: { niveau: "global", cible_id: null, libelle: "Global des secteurs" },
    compType: "macro_secteur",
    compSelec: macros.slice(0, 4).map((m: any) => m.id),
    modeAnnees: "plage", anneeMin: 0, anneeMax: 9999, anneesSpec: [],
  }, [filtres, macros]);
  const comparative = f.sousVue === "comparative";

  // ── Valeurs de la sélection sectorielle ──
  const qsSel = f.sel.niveau === "global" ? "niveau=global" : `niveau=${f.sel.niveau}&cible_id=${f.sel.cible_id}`;
  const { data: valeurs, isLoading, isError, refetch } = useQuery({
    queryKey: ["bdef-valeurs", qsSel], enabled: !comparative,
    queryFn: () => getJson<any>(`/bdef/valeurs?${qsSel}`),
  });
  const indicateurs: BdefIndic[] = valeurs?.indicateurs || [];
  const anneesData: number[] = valeurs?.annees || [];

  // Vue globale : les 4 macro-secteurs comparés sur chaque graphe (règle du site)
  const { data: macroData } = useQuery({
    queryKey: ["bdef-macros", macros.map((m: any) => m.id).join(",")],
    enabled: !comparative && f.sel.niveau === "global" && macros.length > 0,
    queryFn: async () => Promise.all(macros.map((m: any) =>
      getJson<any>(`/bdef/valeurs?niveau=macro_secteur&cible_id=${m.id}`)
        .then(d => ({ id: m.id, libelle: m.libelle, inds: (d?.indicateurs || []) as BdefIndic[] }))
        .catch(() => ({ id: m.id, libelle: m.libelle, inds: [] as BdefIndic[] })))),
  });

  // ── Valeurs comparatives (une requête par cible) ──
  const { data: compResultats, isLoading: chargComp } = useQuery({
    queryKey: ["bdef-comp", f.compType, f.compSelec.join(",")],
    enabled: comparative && f.compSelec.length > 0,
    queryFn: async () => Promise.all(f.compSelec.map(id =>
      getJson<any>(`/bdef/valeurs?niveau=${f.compType}&cible_id=${id}`)
        .then(d => ({ id, inds: (d?.indicateurs || []) as BdefIndic[], annees: (d?.annees || []) as number[] }))
        .catch(() => ({ id, inds: [] as BdefIndic[], annees: [] as number[] })))),
  });
  const compAnnees = useMemo(() =>
    [...new Set((compResultats || []).flatMap(r => r.annees))].sort((a, b) => a - b),
  [compResultats]);

  // ── Période ──
  const anneesBase = comparative ? compAnnees : anneesData;
  const bornes: [number, number] = anneesBase.length ? [anneesBase[0], anneesBase[anneesBase.length - 1]] : [0, 0];
  const anneeMin = Math.max(f.anneeMin, bornes[0]) || bornes[0];
  const anneeMax = Math.min(Math.max(f.anneeMax, anneeMin), bornes[1]) || bornes[1];
  const anneesAffichees = (f.modeAnnees === "specifiques" && f.anneesSpec.length)
    ? f.anneesSpec.filter(a => anneesBase.includes(a))
    : anneesBase.filter(a => a >= anneeMin && a <= anneeMax);
  const derniereAnnee = anneesAffichees.length ? anneesAffichees[anneesAffichees.length - 1] : null;

  const couleurSel = NIVEAU_COULEUR[f.sel.niveau] || T.bleu;
  const nomDe = (niveau: string, id: number): string => {
    const liste: any[] = niveau === "macro_secteur" ? refs?.macro_secteur : niveau === "groupe" ? refs?.groupe : refs?.secteur;
    return (liste || []).find((n: any) => n.id === id)?.libelle || "?";
  };

  // La série vedette repart en tête quand la sélection change
  useEffect(() => { setSerieActive(0); }, [f.sousVue, f.sel.niveau, f.sel.cible_id, f.compType]);

  // ── Autres indicateurs : le reste des BDEF, à plat par catégorie, avec la
  // variation vs N-1 fléchée (les 8 courbes vivent déjà à l'écran) ──
  const autresIndics = useMemo(() => {
    if (comparative || !indicateurs.length || derniereAnnee === null) return [];
    const groupes: { nom: string; lignes: { code: string; libelle: string; valeur: string; delta: number | null }[] }[] = [];
    for (const ind of indicateurs) {
      if (BDEF_GRAPHES_DEFAUT.includes(ind.code)) continue;
      const as = anneesAffichees.filter(a => ind.valeurs[a] != null);
      const v = ind.valeurs[derniereAnnee] ?? null;
      let delta: number | null = null;
      if (as.length >= 2) {
        const d = ind.valeurs[as[as.length - 1]]!, p = ind.valeurs[as[as.length - 2]]!;
        if (p) { const pct = (d - p) / Math.abs(p) * 100; if (isFinite(pct)) delta = pct; }
      }
      const nom = ind.categorie || "Autres";
      let g = groupes.find(x => x.nom === nom);
      if (!g) { g = { nom, lignes: [] }; groupes.push(g); }
      g.lignes.push({ code: ind.code, libelle: ind.libelle, valeur: fmtBdef(v, ind.unite, true), delta });
    }
    return groupes;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicateurs, derniereAnnee, comparative, anneesAffichees.join(",")]);

  // ── Graphes : les 8 indicateurs du site ──
  const graphes = useMemo(() => {
    const indexComp = new Map((compResultats || []).map(r => [r.id, r.inds]));
    const source = comparative
      ? (compResultats?.[0]?.inds || [])
      : indicateurs;
    return BDEF_GRAPHES_DEFAUT
      .map(code => source.find(i => i.code === code))
      .filter((i): i is BdefIndic => !!i)
      .map(ind => {
        let series: Serie[];
        if (comparative) {
          series = f.compSelec.map((id, i) => {
            const mInd = (indexComp.get(id) || []).find(x => x.code === ind.code);
            return {
              nom: nomDe(f.compType, id), couleur: COMP_PALETTE[i % COMP_PALETTE.length],
              data: anneesAffichees.map(a => ({ annee: a, valeur: (mInd?.valeurs[a] ?? null) as number | null })),
            };
          });
        } else if (f.sel.niveau === "global" && (macroData || []).length > 0) {
          series = (macroData || []).map((m, mi) => {
            const mInd = m.inds.find(x => x.code === ind.code);
            return {
              nom: m.libelle, couleur: BDEF_MACRO_COULEURS[mi % BDEF_MACRO_COULEURS.length],
              data: anneesAffichees.map(a => ({ annee: a, valeur: (mInd?.valeurs[a] ?? null) as number | null })),
            };
          });
        } else {
          series = [{
            nom: ind.libelle, couleur: couleurSel,
            data: anneesAffichees.map(a => ({ annee: a, valeur: (ind.valeurs[a] ?? null) as number | null })),
          }];
        }
        return { ind, series };
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicateurs, macroData, compResultats, comparative, f.compSelec, f.compType, f.sel.niveau, anneesAffichees.join(","), couleurSel]);

  // Dernier point / précédent d'UNE série (vedette, rangées, légende)
  const bilanSerie = (sr?: Serie) => {
    const pts = (sr?.data || []).filter(d => d.valeur !== null);
    if (!pts.length) return null;
    const dernier = pts[pts.length - 1];
    const prec = pts.length > 1 ? pts[pts.length - 2] : null;
    let delta: number | null = null;
    if (prec && prec.valeur) {
      const pct = (dernier.valeur! - prec.valeur!) / Math.abs(prec.valeur!) * 100;
      if (isFinite(pct)) delta = pct;
    }
    return { dernier, prec, delta, valeurs: pts.map(p => p.valeur as number) };
  };

  // Retirer une cible comparée depuis sa pastille (✕)
  const retirerComp = (id: string) => {
    const ids = f.compSelec.filter(x => String(x) !== id);
    if (!ids.length) return;
    setFiltres({ ...f, compSelec: ids });
  };

  // ── Badge du hero ──
  const nbFiltres =
    (comparative ? 1 : 0) +
    (!comparative && f.sel.niveau !== "global" ? 1 : 0) +
    (f.modeAnnees === "specifiques" ? (f.anneesSpec.length ? 1 : 0) : (filtres && (f.anneeMin > bornes[0] || f.anneeMax < bornes[1]) ? 1 : 0));
  useEffect(() => { onNbFiltres(nbFiltres); }, [nbFiltres, onNbFiltres]);

  const perLabel = f.modeAnnees === "specifiques" && f.anneesSpec.length
    ? (f.anneesSpec.length === 1 ? `${f.anneesSpec[0]}` : `${f.anneesSpec[0]} — ${f.anneesSpec[f.anneesSpec.length - 1]}`)
    : `${anneeMin} — ${anneeMax}`;
  const pastilles = comparative
    ? f.compSelec.map((id, i) => ({ cle: String(id), nom: nomDe(f.compType, id), couleur: COMP_PALETTE[i % COMP_PALETTE.length] }))
    : [{ cle: "sel", nom: f.sel.libelle, couleur: couleurSel }];

  const chargement = !refs || (comparative ? chargComp : isLoading);

  return (
    <>
      {chargement ? (
        <SqueletteDonnees />
      ) : !comparative && isError ? (
        <EtatErreur onRetry={() => refetch()} />
      ) : (comparative ? !compResultats?.some(r => r.inds.length) : indicateurs.length === 0) ? (
        <EtatVide texte="Aucune donnée pour cette sélection" sousTexte="Les données BDEF seront disponibles après import dans l'administration." />
      ) : (
        (() => {
          const cap = width >= 700 ? { width: "100%" as const, maxWidth: 680, alignSelf: "center" as const } : null;
          const idx = Math.min(serieActive, Math.max(0, graphes.length - 1));
          const gActive = graphes[idx];
          const multi = (gActive?.series.length ?? 0) > 1;
          const bilan = gActive ? bilanSerie(gActive.series[0]) : null;
          const hausse = (bilan?.delta ?? 0) >= 0;
          const autres = graphes.map((g, i) => ({ ...g, i })).filter(x => x.i !== idx);
          const fmtInd = (ind: BdefIndic) => (v: number | null) => fmtBdef(v, ind.unite, true);
          return (
            <View style={cap}>
              {/* La sélection se lit et s'ouvre ICI : période → filtres,
                  pastille comparée → retirer (✕), pastille simple → filtres */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.pastilles}>
                <Pressable onPress={onOuvrirFiltres} style={s.periodePastille}>
                  <Text style={s.periodePastilleTexte}>{perLabel}</Text>
                </Pressable>
                {pastilles.map(pa => {
                  const retirable = comparative && pastilles.length > 1;
                  return (
                    <Pressable key={pa.cle}
                      onPress={retirable ? () => { tick(); retirerComp(pa.cle); } : onOuvrirFiltres}
                      style={[s.selPastille, { borderColor: `${pa.couleur}33` }]}>
                      <View style={[s.selPoint, { backgroundColor: pa.couleur }]} />
                      <Text style={[s.selPastilleTexte, { color: pa.couleur }]} numberOfLines={1}>{pa.nom}</Text>
                      {retirable && <Icone sf="xmark" materiel="close" taille={11} couleur={pa.couleur} />}
                    </Pressable>
                  );
                })}
                {comparative && (
                  <Pressable onPress={() => { tick(); onOuvrirFiltres(); }} style={s.plusPastille}
                    accessibilityLabel="Modifier les cibles comparées">
                    <Icone sf="plus" materiel="add" taille={14} couleur={T.bleu} poids="semibold" />
                  </Pressable>
                )}
              </ScrollView>

              {gActive && (
                <>
                  {/* ── La vedette : UN indicateur en grand ── */}
                  <View style={s.rangee}>
                    <View style={s.vedette}>
                      <Text style={s.etiquette} numberOfLines={1}>
                        {gActive.ind.libelle.toUpperCase()}{!multi && bilan ? ` · ${bilan.dernier.annee}` : ""}
                      </Text>
                      {!multi && bilan && (
                        <View style={s.nombreLigne}>
                          <ChiffreAnime texte={fmtBdef(bilan.dernier.valeur, gActive.ind.unite)} style={s.nombre} />
                          {bilan.delta !== null && (
                            <View style={s.deltaLigne}>
                              <Icone sf={hausse ? "arrow.up.right" : "arrow.down.right"}
                                materiel={hausse ? "north_east" : "south_east"}
                                taille={12} couleur={hausse ? T.vert : "#dc2626"} poids="bold" />
                              <Text style={[s.deltaTexteV, { color: hausse ? T.vert : "#dc2626" }]}>
                                {Math.abs(bilan.delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                              </Text>
                              <Text style={s.deltaContexte}>vs {bilan.prec!.annee}</Text>
                            </View>
                          )}
                        </View>
                      )}
                      <View style={{ marginTop: multi ? 4 : 10 }}>
                        <GrapheLignes series={gActive.series} hauteur={multi ? 190 : 172}
                          fmt={fmtInd(gActive.ind)} epure />
                      </View>
                      {/* En multi-séries, la lecture vit sous la courbe */}
                      {multi && (
                        <View style={s.legende}>
                          {gActive.series.map(sr => {
                            const b = bilanSerie(sr);
                            const bHausse = (b?.delta ?? 0) >= 0;
                            return (
                              <View key={sr.nom} style={s.legendeLigne}>
                                <View style={[s.selPoint, { backgroundColor: sr.couleur }]} />
                                <Text style={s.legendeNom} numberOfLines={1}>{sr.nom}</Text>
                                {b?.dernier && <Text style={s.legendeAnnee}>{b.dernier.annee}</Text>}
                                <Text style={s.legendeValeur}>{b ? fmtInd(gActive.ind)(b.dernier.valeur) : "—"}</Text>
                                {b?.delta != null ? (
                                  <View style={s.legendeDelta}>
                                    <Icone sf={bHausse ? "arrow.up.right" : "arrow.down.right"}
                                      materiel={bHausse ? "north_east" : "south_east"}
                                      taille={10} couleur={bHausse ? T.vert : "#dc2626"} poids="bold" />
                                    <Text style={[s.legendeDeltaTexte, { color: bHausse ? T.vert : "#dc2626" }]}>
                                      {Math.abs(b.delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                                    </Text>
                                  </View>
                                ) : <View style={s.legendeDelta} />}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </View>

                  {/* ── Les autres indicateurs graphés — rangées commutables ── */}
                  {autres.length > 0 && (
                    <View style={s.rangee}>
                      <View style={s.carteListe}>
                        {autres.map((g, pos) => {
                          const b = bilanSerie(g.series[0]);
                          const bHausse = (b?.delta ?? 0) >= 0;
                          return (
                            <Tapable key={g.ind.code} echelle={0.99}
                              onPress={() => { tick(); setSerieActive(g.i); }}
                              style={[s.serieLigne, pos > 0 && s.serieLigneBord]}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={s.serieLabel} numberOfLines={1}>{g.ind.libelle}</Text>
                                {multi ? (
                                  <View style={s.serieSous}>
                                    {g.series.map(sr => {
                                      const bs = bilanSerie(sr);
                                      return (
                                        <Text key={sr.nom} style={[s.serieValeur, { color: sr.couleur }]}>
                                          {bs ? fmtInd(g.ind)(bs.dernier.valeur) : "—"}
                                        </Text>
                                      );
                                    })}
                                  </View>
                                ) : (
                                  <View style={s.serieSous}>
                                    <Text style={s.serieValeur}>{b ? fmtInd(g.ind)(b.dernier.valeur) : "—"}</Text>
                                    {b?.delta != null && (
                                      <Text style={[s.serieDelta, { color: bHausse ? T.vert : "#dc2626" }]}>
                                        {bHausse ? "+" : "−"}{Math.abs(b.delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                                      </Text>
                                    )}
                                  </View>
                                )}
                              </View>
                              {!multi && b && b.valeurs.length > 1 && (
                                <MiniTendance valeurs={b.valeurs} largeur={72} hauteur={30}
                                  couleur={g.series[0]?.couleur || (T.bleu as string)} />
                              )}
                            </Tapable>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* ── Le reste des indicateurs BDEF — à plat, variations fléchées ── */}
              {autresIndics.length > 0 && (
                <View style={s.rangee}>
                  <Text style={s.sectionTitre}>AUTRES INDICATEURS</Text>
                  <View style={[s.carteListe, { paddingVertical: 3 }]}>
                    {autresIndics.map(g => (
                      <View key={g.nom}>
                        <Text style={s.groupeTitre}>{g.nom.toUpperCase()}</Text>
                        {g.lignes.map(l => {
                          const lHausse = (l.delta ?? 0) >= 0;
                          return (
                            <View key={l.code} style={[s.indicLigne, s.serieLigneBord]}>
                              <Text style={s.indicLabel} numberOfLines={2}>{l.libelle}</Text>
                              {l.delta != null && (
                                <View style={s.legendeDelta}>
                                  <Icone sf={lHausse ? "arrow.up.right" : "arrow.down.right"}
                                    materiel={lHausse ? "north_east" : "south_east"}
                                    taille={10} couleur={lHausse ? T.vert : "#dc2626"} poids="bold" />
                                  <Text style={[s.legendeDeltaTexte, { color: lHausse ? T.vert : "#dc2626" }]}>
                                    {Math.abs(l.delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                                  </Text>
                                </View>
                              )}
                              <Text style={s.indicValeur}>{l.valeur}</Text>
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              )}
              <Text style={s.source}>Source BDEF · ANSD</Text>
            </View>
          );
        })()
      )}

      {filtresOuverts && refs && (
        <NationalFiltres refs={refs} anneesDispo={anneesBase} valeurs={{ ...f, anneeMin, anneeMax }}
          onAppliquer={setFiltres} onClose={onFermerFiltres} />
      )}
    </>
  );
}

// ── Feuille de filtres nationale ─────────────────────────────────────────────
function NationalFiltres({ refs, anneesDispo, valeurs, onAppliquer, onClose }: {
  refs: any; anneesDispo: number[]; valeurs: FiltresNational;
  onAppliquer: (f: FiltresNational) => void; onClose: () => void;
}) {
  const [f, setF] = useState<FiltresNational>({ ...valeurs, compSelec: [...valeurs.compSelec], anneesSpec: [...valeurs.anneesSpec] });
  const [q, setQ] = useState("");
  const [macrosOuverts, setMacrosOuverts] = useState<Set<number>>(new Set());
  const [groupesOuverts, setGroupesOuverts] = useState<Set<number>>(new Set());

  const comparative = f.sousVue === "comparative";
  const bornes: [number, number] = anneesDispo.length ? [anneesDispo[0], anneesDispo[anneesDispo.length - 1]] : [f.anneeMin, f.anneeMax];
  const macros: any[] = refs.macro_secteur || [];
  const groupesDe = (mid: number) => (refs.groupe || []).filter((g: any) => g.macro_secteur_id === mid);
  const secteursDe = (gid: number) => (refs.secteur || []).filter((sx: any) => sx.groupe_id === gid);

  const couleurComp = (id: number) => COMP_PALETTE[Math.max(0, f.compSelec.indexOf(id)) % COMP_PALETTE.length];
  const basculer = (ens: Set<number>, cle: number, setter: (v: Set<number>) => void) => {
    const n = new Set(ens); n.has(cle) ? n.delete(cle) : n.add(cle); setter(n);
  };

  const choisir = (niveau: Sel["niveau"], node: any | null) => setF(prev => ({
    ...prev, sel: { niveau, cible_id: node ? node.id : null, libelle: node ? node.libelle : "Global des secteurs" },
  }));
  const estSel = (niveau: string, id: number | null) => f.sel.niveau === niveau && f.sel.cible_id === id;
  const clicComp = (id: number) => setF(prev => ({
    ...prev,
    compSelec: prev.compSelec.includes(id)
      ? prev.compSelec.filter(x => x !== id)
      : prev.compSelec.length >= 4 ? prev.compSelec : [...prev.compSelec, id],
  }));

  const reinitialiser = () => setF({
    sousVue: "sectorielle",
    sel: { niveau: "global", cible_id: null, libelle: "Global des secteurs" },
    compType: "macro_secteur", compSelec: macros.slice(0, 4).map((m: any) => m.id),
    modeAnnees: "plage", anneeMin: bornes[0], anneeMax: bornes[1], anneesSpec: [],
  });

  // Recherche sectorielle : résultats à plat tous niveaux confondus (règle du site)
  const qn = q.trim().toLowerCase();
  const resultats = qn ? [
    ...macros.filter((m: any) => m.libelle.toLowerCase().includes(qn)).map((n: any) => ({ niveau: "macro_secteur" as const, node: n })),
    ...(refs.groupe || []).filter((g: any) => g.libelle.toLowerCase().includes(qn)).map((n: any) => ({ niveau: "groupe" as const, node: n })),
    ...(refs.secteur || []).filter((sx: any) => sx.libelle.toLowerCase().includes(qn)).map((n: any) => ({ niveau: "secteur" as const, node: n })),
  ] : [];

  const Range = ({ actif, couleur, nom, indent = 0, badge, desactive, onPress }: {
    actif: boolean; couleur: any; nom: string; indent?: number; badge?: string | null; desactive?: boolean; onPress: () => void;
  }) => (
    <Pressable onPress={() => !desactive && onPress()}
      style={({ pressed }) => [s.fLigne, indent > 0 && { paddingLeft: 8 + indent * 18 }, pressed && { backgroundColor: T.champ }, desactive && { opacity: 0.4 }]}>
      <View style={[s.fPoint, { borderColor: actif ? couleur : T.grisClair, backgroundColor: actif ? couleur : "transparent" }]} />
      <Text style={[s.fNom, actif && { fontFamily: POLICE.gras }]} numberOfLines={1}>{nom}</Text>
      {badge ? <View style={s.fBadge}><Text style={s.fBadgeTexte}>{badge}</Text></View> : null}
    </Pressable>
  );

  const AnneeChip = ({ a, actif, onPress }: { a: number; actif: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[s.anneeChip, actif && s.anneeChipActif]}>
      <Text style={[s.anneeChipTexte, actif && { color: "#fff" }]}>{a}</Text>
    </Pressable>
  );

  // Liste du niveau comparé (groupes groupés par macro, secteurs par groupe)
  const listeComp = () => {
    if (f.compType === "macro_secteur") {
      return macros.map((m: any) => (
        <Range key={m.id} actif={f.compSelec.includes(m.id)} couleur={couleurComp(m.id)} nom={m.libelle}
          desactive={!f.compSelec.includes(m.id) && f.compSelec.length >= 4} onPress={() => clicComp(m.id)} />
      ));
    }
    if (f.compType === "groupe") {
      return macros.map((m: any) => (
        <View key={m.id}>
          <Pressable onPress={() => basculer(macrosOuverts, m.id, setMacrosOuverts)} style={s.fSection}>
            <Text style={s.fSectionTexte}>{m.libelle.toUpperCase()}</Text>
            <Ionicons name={macrosOuverts.has(m.id) ? "chevron-down" : "chevron-forward"} size={12} color={T.bleu} />
          </Pressable>
          {macrosOuverts.has(m.id) && groupesDe(m.id).map((g: any) => (
            <Range key={g.id} actif={f.compSelec.includes(g.id)} couleur={couleurComp(g.id)} nom={g.libelle} indent={1}
              desactive={!f.compSelec.includes(g.id) && f.compSelec.length >= 4} onPress={() => clicComp(g.id)} />
          ))}
        </View>
      ));
    }
    return (refs.groupe || []).map((g: any) => (
      <View key={g.id}>
        <Pressable onPress={() => basculer(groupesOuverts, g.id, setGroupesOuverts)} style={s.fSection}>
          <Text style={s.fSectionTexte} numberOfLines={1}>{g.libelle.toUpperCase()}</Text>
          <Ionicons name={groupesOuverts.has(g.id) ? "chevron-down" : "chevron-forward"} size={12} color={T.bleu} />
        </Pressable>
        {groupesOuverts.has(g.id) && secteursDe(g.id).map((sx: any) => (
          <Range key={sx.id} actif={f.compSelec.includes(sx.id)} couleur={couleurComp(sx.id)} nom={sx.libelle} indent={1}
            desactive={!f.compSelec.includes(sx.id) && f.compSelec.length >= 4} onPress={() => clicComp(sx.id)} />
        ))}
      </View>
    ));
  };

  return (
    <Feuille onClose={onClose} titre="Filtres" hauteur="88%" ecart={22}
      pied={
        <View style={s.pied}>
          <Tapable onPress={() => { tick(); reinitialiser(); }} style={s.boutonSecondaire}>
            <Text style={s.boutonSecondaireTexte}>Réinitialiser</Text>
          </Tapable>
          <Tapable onPress={() => { succes(); onAppliquer(f); onClose(); }} style={s.boutonPrincipal}>
            <Text style={s.boutonPrincipalTexte}>Appliquer</Text>
          </Tapable>
        </View>
      }>
          {/* Type d'analyse */}
          <View>
            <Text style={s.fSecTitle}>TYPE D'ANALYSE</Text>
            <View style={s.segments}>
              {([["sectorielle", "Sectorielle"], ["comparative", "Comparative"]] as const).map(([cle, label]) => (
                <Pressable key={cle} onPress={() => setF(prev => ({ ...prev, sousVue: cle }))} style={[s.segment, f.sousVue === cle && s.segmentActif]}>
                  <Text style={[s.segmentTexte, f.sousVue === cle && s.segmentTexteActif]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {comparative ? (
            <View>
              <View style={s.fSecLigne}>
                <Text style={s.fSecTitle}>NIVEAU COMPARÉ</Text>
                <Text style={s.fCompte}>{f.compSelec.length}/4</Text>
              </View>
              <View style={[s.segments, { marginBottom: 10 }]}>
                {(["macro_secteur", "groupe", "secteur"] as const).map(cle => (
                  <Pressable key={cle} onPress={() => setF(prev => ({ ...prev, compType: cle, compSelec: cle === "macro_secteur" ? macros.slice(0, 4).map((m: any) => m.id) : [] }))}
                    style={[s.segment, f.compType === cle && s.segmentActif]}>
                    <Text style={[s.segmentTexte, f.compType === cle && s.segmentTexteActif]} numberOfLines={1}>{NIVEAU_LABEL[cle]}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ maxHeight: 300 }}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>{listeComp()}</ScrollView>
              </View>
            </View>
          ) : (
            <View>
              <Text style={s.fSecTitle}>SECTEURS</Text>
              <View style={s.recherche}>
                <Ionicons name="search" size={13} color={T.gris} />
                <TextInput value={q} onChangeText={setQ} placeholder="Rechercher un secteur"
                  placeholderTextColor={T.gris} autoCorrect={false} clearButtonMode="while-editing" style={s.rechercheChamp} />
              </View>
              {qn ? (
                <View style={{ maxHeight: 320 }}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {resultats.map(r => (
                      <Range key={`${r.niveau}-${r.node.id}`} actif={estSel(r.niveau, r.node.id)}
                        couleur={NIVEAU_COULEUR[r.niveau]} nom={r.node.libelle} onPress={() => { choisir(r.niveau, r.node); setQ(""); }} />
                    ))}
                    {resultats.length === 0 && <Text style={s.fVide}>Aucun résultat</Text>}
                  </ScrollView>
                </View>
              ) : (
                <>
                  <Range actif={estSel("global", null)} couleur={NIVEAU_COULEUR.global} nom="Global des secteurs" badge="Agrégat"
                    onPress={() => choisir("global", null)} />
                  <View style={s.fFilet} />
                  <View style={{ maxHeight: 320 }}>
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {macros.map((m: any) => (
                        <View key={m.id}>
                          <View style={s.fCascadeLigne}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Range actif={estSel("macro_secteur", m.id)} couleur={NIVEAU_COULEUR.macro_secteur} nom={m.libelle}
                                onPress={() => choisir("macro_secteur", m)} />
                            </View>
                            {groupesDe(m.id).length > 0 && (
                              <Pressable hitSlop={8} onPress={() => basculer(macrosOuverts, m.id, setMacrosOuverts)} style={s.fChevron}>
                                <Ionicons name={macrosOuverts.has(m.id) ? "chevron-down" : "chevron-forward"} size={13} color={T.gris} />
                              </Pressable>
                            )}
                          </View>
                          {macrosOuverts.has(m.id) && groupesDe(m.id).map((g: any) => (
                            <View key={g.id}>
                              <View style={s.fCascadeLigne}>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Range actif={estSel("groupe", g.id)} couleur={NIVEAU_COULEUR.groupe} nom={g.libelle} indent={1}
                                    onPress={() => choisir("groupe", g)} />
                                </View>
                                {secteursDe(g.id).length > 0 && (
                                  <Pressable hitSlop={8} onPress={() => basculer(groupesOuverts, g.id, setGroupesOuverts)} style={s.fChevron}>
                                    <Ionicons name={groupesOuverts.has(g.id) ? "chevron-down" : "chevron-forward"} size={13} color={T.gris} />
                                  </Pressable>
                                )}
                              </View>
                              {groupesOuverts.has(g.id) && secteursDe(g.id).map((sx: any) => (
                                <Range key={sx.id} actif={estSel("secteur", sx.id)} couleur={NIVEAU_COULEUR.secteur} nom={sx.libelle} indent={2}
                                  onPress={() => choisir("secteur", sx)} />
                              ))}
                            </View>
                          ))}
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Période */}
          <View>
            <Text style={s.fSecTitle}>PÉRIODE</Text>
            <View style={[s.segments, { marginVertical: 10 }]}>
              {([["plage", "Plage"], ["specifiques", "Années"]] as const).map(([cle, label]) => (
                <Pressable key={cle} onPress={() => setF(prev => ({ ...prev, modeAnnees: cle }))} style={[s.segment, f.modeAnnees === cle && s.segmentActif]}>
                  <Text style={[s.segmentTexte, f.modeAnnees === cle && s.segmentTexteActif]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {f.modeAnnees === "plage" ? (
              <View style={{ gap: 10 }}>
                <View>
                  <Text style={s.plageLabel}>DE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.anneesRangee}>
                    {anneesDispo.map(a => (
                      <AnneeChip key={a} a={a} actif={a === Math.max(f.anneeMin, bornes[0])}
                        onPress={() => setF(prev => ({ ...prev, anneeMin: a, anneeMax: Math.max(a, prev.anneeMax) }))} />
                    ))}
                  </ScrollView>
                </View>
                <View>
                  <Text style={s.plageLabel}>À</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.anneesRangee}>
                    {anneesDispo.map(a => (
                      <AnneeChip key={a} a={a} actif={a === Math.min(f.anneeMax, bornes[1])}
                        onPress={() => setF(prev => ({ ...prev, anneeMax: a, anneeMin: Math.min(a, prev.anneeMin) }))} />
                    ))}
                  </ScrollView>
                </View>
              </View>
            ) : (
              <View style={s.anneesGrille}>
                {anneesDispo.map(a => (
                  <AnneeChip key={a} a={a} actif={f.anneesSpec.includes(a)}
                    onPress={() => setF(prev => ({ ...prev, anneesSpec: prev.anneesSpec.includes(a) ? prev.anneesSpec.filter(x => x !== a) : [...prev.anneesSpec, a].sort((x, y) => x - y) }))} />
                ))}
              </View>
            )}
          </View>
    </Feuille>
  );
}

const s = StyleSheet.create({
  pastilles: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14, paddingHorizontal: 16 },
  // Les styles badge_* de la plateforme : pastille blanche translucide à
  // bordure teintée, texte de la couleur (gris pour la période)
  periodePastille: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(108,117,125,0.28)",
  },
  periodePastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, color: "#6b7280", fontVariant: ["tabular-nums"] },
  selPastille: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 12, paddingVertical: 5, maxWidth: 230,
  },
  selPoint: { width: 7, height: 7, borderRadius: 4 },
  selPastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, flexShrink: 1 },
  plusPastille: {
    width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: T.bleuVoile, borderWidth: 1, borderColor: "rgba(0,79,145,0.22)",
  },

  rangee: { paddingHorizontal: 16, marginTop: 14 },
  vedette: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, overflow: "hidden",
  },
  etiquette: { ...TYPO.micro, color: T.gris },
  nombreLigne: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  nombre: { fontSize: 34, lineHeight: 40, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -0.8, marginTop: 8, fontVariant: ["tabular-nums"] },
  deltaLigne: { flexDirection: "row", alignItems: "center", gap: 4 },
  deltaTexteV: { fontSize: 13, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  deltaContexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.gris, marginLeft: 2 },

  legende: {
    marginTop: 8, paddingTop: 4, paddingBottom: 6, gap: 7,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
  },
  legendeLigne: { flexDirection: "row", alignItems: "center", gap: 7, paddingTop: 4 },
  legendeNom: { flex: 1, minWidth: 0, fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre },
  legendeAnnee: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.grisClair, fontVariant: ["tabular-nums"] },
  legendeValeur: { fontSize: 12.5, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
  legendeDelta: { flexDirection: "row", alignItems: "center", gap: 2, minWidth: 58, justifyContent: "flex-end" },
  legendeDeltaTexte: { fontSize: 11, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },

  carteListe: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 16,
  },
  serieLigne: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 11 },
  serieLigneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  serieLabel: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre },
  serieSous: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 2, flexWrap: "wrap" },
  serieValeur: { fontSize: 12.5, fontFamily: POLICE.gras, color: T.texte, fontVariant: ["tabular-nums"] },
  serieDelta: { fontSize: 11, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },

  sectionTitre: { ...TYPO.micro, color: T.bleu, marginBottom: 10 },
  groupeTitre: { fontSize: 9, fontFamily: POLICE.gras, letterSpacing: 1.1, color: T.gris, marginTop: 12, marginBottom: 2 },
  indicLigne: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9.5 },
  indicLabel: { flex: 1, minWidth: 0, fontSize: 13, fontFamily: POLICE.demi, color: T.encre, lineHeight: 18 },
  indicValeur: { fontSize: 13.5, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },

  source: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", marginTop: 18 },
  // Feuille de filtres
  fSecLigne: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  fSecTitle: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.6, marginBottom: 10 },
  fCompte: {
    fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, backgroundColor: T.blocBord,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden", fontVariant: ["tabular-nums"],
  },
  segments: { flexDirection: "row", padding: 3.5, gap: 4, backgroundColor: T.filet, borderRadius: 999 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 999 },
  segmentActif: { backgroundColor: T.carte, shadowColor: "#001e3c", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segmentTexte: { fontSize: 12, fontFamily: POLICE.demi, color: T.gris },
  segmentTexteActif: { color: T.bleu },
  recherche: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10,
    backgroundColor: T.champ, borderWidth: 1, borderColor: T.bordure, borderRadius: 10,
    paddingHorizontal: 11, height: 38,
  },
  rechercheChamp: { flex: 1, fontSize: 13, fontFamily: POLICE.moyen, color: T.encre },
  fLigne: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 7.5, paddingHorizontal: 8, borderRadius: 8 },
  fPoint: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  fNom: { flex: 1, fontSize: 13, fontFamily: POLICE.normal, color: T.texte },
  fBadge: { backgroundColor: T.filet, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1.5 },
  fBadgeTexte: { fontSize: 9, fontFamily: POLICE.demi, color: T.gris },
  fFilet: { height: 1, backgroundColor: T.filet, marginVertical: 8 },
  fCascadeLigne: { flexDirection: "row", alignItems: "center" },
  fChevron: { paddingHorizontal: 6, paddingVertical: 6 },
  fSection: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: T.blocFond, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 3, marginTop: 4,
  },
  fSectionTexte: { flex: 1, fontSize: 10, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1 },
  fVide: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", paddingVertical: 10 },
  plageLabel: { fontSize: 9, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.2, marginBottom: 6 },
  anneesRangee: { gap: 6, paddingRight: 8 },
  anneesGrille: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  anneeChip: {
    paddingHorizontal: 12, paddingVertical: 6.5, borderRadius: 9,
    backgroundColor: T.champ, borderWidth: 1, borderColor: T.bordure,
  },
  anneeChipActif: { backgroundColor: T.bleuAction, borderColor: T.bleuAction },
  anneeChipTexte: { fontSize: 12, fontFamily: POLICE.demi, color: T.texte, fontVariant: ["tabular-nums"] },
  pied: {
    flexDirection: "row", gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: T.filet,
    paddingBottom: 26,
  },
  boutonSecondaire: {
    flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: T.bordure, backgroundColor: T.carte,
  },
  boutonSecondaireTexte: { fontSize: 13.5, fontFamily: POLICE.demi, color: T.texte },
  boutonPrincipal: { flex: 1.4, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: T.bleuAction },
  boutonPrincipalTexte: { fontSize: 13.5, fontFamily: POLICE.gras, color: "#fff" },
});
