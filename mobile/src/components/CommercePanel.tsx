// Flux bilatéraux — la grammaire EXACTE de la carte vedette de l'accueil :
// les Exportations en vedette (micro-étiquette, badge pays bleu sans point
// ouvrant le sélecteur, nombre en 38 pt qui compte, variation vs N-1 fléchée,
// silhouette Skia sans axes) et deux repères — Importations et Balance
// commerciale — avec le glyphe de tendance teinté.
//
// Sous la carte, LES RESSOURCES du sens en vedette (rien en Balance) :
// une SECONDE VEDETTE, en orange — la même grammaire (nombre qui compte,
// variation fléchée, silhouette, repères un par ligne), une ressource en
// vedette — Combustibles fossiles par défaut — et les autres catégories en
// repères. Le curseur d'années du haut la pilote aussi.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SqueletteDonnees } from "@/components/Squelette";
import { ChiffreAnime, EtatErreur, EtatVide, IconeTendance, Permutation, RangeeMouvante, Tapable } from "@/components/ui";
import CurseurAnnees from "@/components/CurseurAnnees";
import Icone from "@/components/Icone";
import MiniTendance from "@/components/MiniTendance";
import { getJson } from "@/lib/api";
import { fmtUSD } from "@/lib/format";
import { tick } from "@/lib/haptique";
import { POLICE, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";
import TexteDefilant from "@/components/TexteDefilant";

type CleSerie = "exports" | "imports" | "balance";
const LABELS: Record<CleSerie, string> = {
  exports: "EXPORTATIONS", imports: "IMPORTATIONS", balance: "BALANCE COMMERCIALE",
};
const ORDRE: CleSerie[] = ["exports", "imports", "balance"];

type Point = { annee: number; valeur: number };

export default function CommercePanel({ pays, paysId, onOuvrirPays }: {
  pays: any[]; paysId: number | null; onOuvrirPays: () => void;
}) {
  const [actif, setActif] = useState<CleSerie>("exports");
  const [anneeSel, setAnneeSel] = useState<number | null>(null);
  const [largeurTendance, setLargeurTendance] = useState(0);

  // Référentiel du commerce : années disponibles
  const { data: refs, isLoading, isError, refetch } = useQuery({
    queryKey: ["commerce-filtres"], queryFn: () => getJson<any>("/statistiques/commerce/filtres"), staleTime: Infinity,
  });
  const annees: number[] = useMemo(() => (refs?.annees || []).slice().sort((a: number, b: number) => a - b), [refs]);

  // Le sens suit la vedette ; la Balance conserve le dernier sens montré
  const [sens, setSens] = useState<"exportateur" | "importateur">("exportateur");
  const direction = actif === "imports" ? "importateur" : actif === "exports" ? "exportateur" : sens;
  const expDir = direction === "exportateur";

  // La série complète pour la vedette (toutes les années disponibles)
  const paramsSerie = useMemo(() => {
    if (paysId == null || !annees.length) return null;
    return new URLSearchParams({
      pays_id: String(paysId), direction,
      annee_min: String(annees[0]), annee_max: String(annees[annees.length - 1]),
    }).toString();
  }, [paysId, direction, annees]);

  const balance: any[] = useQuery({
    queryKey: ["commerce-balance", paramsSerie], enabled: !!paramsSerie,
    queryFn: () => getJson<any[]>(`/statistiques/commerce/balance?${paramsSerie}`).catch(() => []),
  }).data || [];

  // Les années servies ; le curseur ne pointe que dedans
  const anneesSerie = useMemo(() =>
    balance.map((b: any) => b.annee).sort((a: number, b: number) => a - b), [balance]);
  useEffect(() => {
    if (anneeSel != null && !anneesSerie.includes(anneeSel)) setAnneeSel(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneesSerie.join(",")]);
  const anneeRef = anneeSel ?? anneesSerie[anneesSerie.length - 1] ?? null;

  // Les tops portent sur l'ANNÉE de la vedette (pas un cumul) :
  // le curseur pilote donc aussi la carte des ressources
  const paramsAnnee = useMemo(() => {
    if (paysId == null || anneeRef == null) return null;
    return new URLSearchParams({ pays_id: String(paysId), direction, annees: String(anneeRef) }).toString();
  }, [paysId, direction, anneeRef]);

  const enBalance = actif === "balance";
  const tops = useQuery({
    queryKey: ["commerce-tops", paramsAnnee], enabled: !!paramsAnnee && !enBalance,
    queryFn: () => getJson<any>(`/statistiques/commerce/tops?${paramsAnnee}`).catch(() => null),
  }).data;

  // ── La ressource en vedette (seconde carte, en orange) ──
  const [resChoisi, setResChoisi] = useState<string | null>(null);
  const ressources: { nom: string; valeur: number }[] = useMemo(() =>
    (tops?.ressources || []).slice(0, 8).map((r: any) => ({ nom: r.ressource, valeur: r.valeur })), [tops]);
  const resDefaut = ressources.find(r => /combustible/i.test(r.nom))?.nom ?? ressources[0]?.nom ?? null;
  const resActive = resChoisi && ressources.some(r => r.nom === resChoisi) ? resChoisi : resDefaut;

  // La série de la ressource vedette — le filtre balance parle en codes nom_en
  const codeRes = ((refs?.ressources || []) as any[])
    .find(r => (r.libelle || r.nom_en) === resActive)?.nom_en ?? null;
  const paramsRes = useMemo(() => {
    if (paysId == null || !annees.length || !codeRes) return null;
    return new URLSearchParams({
      pays_id: String(paysId), direction, ressources: codeRes,
      annee_min: String(annees[0]), annee_max: String(annees[annees.length - 1]),
    }).toString();
  }, [paysId, direction, annees, codeRes]);
  const balRes: any[] = useQuery({
    queryKey: ["commerce-balance", paramsRes], enabled: !!paramsRes && !enBalance,
    queryFn: () => getJson<any[]>(`/statistiques/commerce/balance?${paramsRes}`).catch(() => []),
  }).data || [];

  // Les tops de l'année précédente servie — les variations des repères ressources
  const anneePrec = anneeRef != null ? anneesSerie[anneesSerie.indexOf(anneeRef) - 1] ?? null : null;
  const paramsPrec = useMemo(() => {
    if (paysId == null || anneePrec == null) return null;
    return new URLSearchParams({ pays_id: String(paysId), direction, annees: String(anneePrec) }).toString();
  }, [paysId, direction, anneePrec]);
  const topsPrec = useQuery({
    queryKey: ["commerce-tops", paramsPrec], enabled: !!paramsPrec && !enBalance,
    queryFn: () => getJson<any>(`/statistiques/commerce/tops?${paramsPrec}`).catch(() => null),
  }).data;

  const selPays = pays.find((p: any) => p.id === paysId);

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
    if (cle !== "balance") setSens(cle === "exports" ? "exportateur" : "importateur");
  };

  // ── La ressource en vedette : sa série, sa dernière valeur, sa variation ──
  const serieRes: Point[] = jusqu(balRes
    .map((b: any) => ({ annee: b.annee, valeur: expDir ? b.exportations : b.importations }))
    .filter((p: any): p is Point => p.valeur != null));
  const dernierRes = serieRes.at(-1) ?? null;
  const precRes = serieRes.length > 1 ? serieRes[serieRes.length - 2] : null;
  const deltaRes = dernierRes && precRes && precRes.valeur !== 0
    ? ((dernierRes.valeur - precRes.valeur) / Math.abs(precRes.valeur)) * 100 : null;
  const hausseRes = (deltaRes ?? 0) >= 0;
  // La variation d'un repère ressource : sa valeur vs l'année précédente
  const valPrecDe = (nom: string): number | null =>
    (topsPrec?.ressources || []).find((r: any) => r.ressource === nom)?.valeur ?? null;

  return (
    <>
      {/* ── La vedette ── */}
      <View style={s.rangee}>
        <CurseurAnnees annees={anneesSerie}
          valeur={anneeRef ?? 0}
          onChange={a => setAnneeSel(a === anneesSerie[anneesSerie.length - 1] ? null : a)} />
        <View style={s.vedette}>
          <View style={s.vedetteEnTete}>
            <TexteDefilant style={s.etiquette}>
              {LABELS[actif]}{dernier ? ` · ${dernier.annee}` : ""}
            </TexteDefilant>
            {/* Le pays en badge bleu, sans point — le tap ouvre le sélecteur */}
            <Pressable onPress={() => { tick(); onOuvrirPays(); }} style={s.badgePays}>
              <TexteDefilant style={s.badgePaysTexte}>{selPays?.nom || "—"}</TexteDefilant>
            </Pressable>
          </View>

          {/* Le mesureur reste monté ; la Permutation rejoue à chaque bascule */}
          <View onLayout={e => setLargeurTendance(e.nativeEvent.layout.width)}>
          <Permutation cle={actif}>
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

          <View style={{ marginTop: 10 }}>
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
          </Permutation>
          </View>

          {/* Les repères, un par ligne — ils glissent quand l'un monte en vedette */}
          <View style={s.pied}>
            {reperes.map((cle, i) => {
              const sx = jusqu(serieDe(cle));
              const d = sx.at(-1) ?? null;
              const p = sx.length > 1 ? sx[sx.length - 2] : null;
              const dpc = d && p && p.valeur !== 0 ? ((d.valeur - p.valeur) / Math.abs(p.valeur)) * 100 : null;
              return (
                <RangeeMouvante key={cle}>
                  <Tapable echelle={0.98} onPress={() => choisir(cle)}
                    style={[s.repere, i > 0 && s.repereBord]}>
                    <TexteDefilant style={s.repereLabel} texte={LABELS[cle]} />
                    <Text style={s.repereValeur} numberOfLines={1}>{d ? fmtUSD(d.valeur) : "—"}</Text>
                    <IconeTendance delta={dpc} />
                  </Tapable>
                </RangeeMouvante>
              );
            })}
          </View>
        </View>
      </View>

      {/* ── La ressource en vedette — la même grammaire, en orange ── */}
      {!enBalance && resActive != null && (
        <View style={s.rangee}>
          <View style={s.vedette}>
            <View style={s.vedetteEnTete}>
              <TexteDefilant style={s.etiquette}>
                {resActive.toUpperCase()}{dernierRes ? ` · ${dernierRes.annee}` : ""}
              </TexteDefilant>
              <View style={s.badgeRes}>
                <TexteDefilant style={s.badgeResTexte}>
                  {expDir ? "Exportations" : "Importations"}
                </TexteDefilant>
              </View>
            </View>

            {dernierRes ? (
              <View style={s.nombreLigne}>
                <ChiffreAnime texte={fmtUSD(dernierRes.valeur)} style={[s.nombre, { color: T.orange }]} />
                {deltaRes !== null && (
                  <View style={s.deltaLigne}>
                    <Icone sf={hausseRes ? "arrow.up.right" : "arrow.down.right"}
                      materiel={hausseRes ? "north_east" : "south_east"}
                      taille={12} couleur={hausseRes ? T.vert : "#dc2626"} poids="bold" />
                    <Text style={[s.deltaTexte, { color: hausseRes ? T.vert : "#dc2626" }]}>
                      {Math.abs(deltaRes).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                    </Text>
                    <Text style={s.deltaContexte}>vs {precRes!.annee}</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={s.indispo}>Donnée indisponible.</Text>
            )}

            <View style={{ marginTop: 10 }}>
              {largeurTendance > 0 && serieRes.length > 1 && (
                <MiniTendance valeurs={serieRes.map(x => x.valeur)} largeur={largeurTendance} couleur={T.orange as string} />
              )}
            </View>
            {serieRes.length > 1 && (
              <View style={s.bornes}>
                <Text style={s.borne}>{serieRes[0].annee}</Text>
                <Text style={s.borne}>{dernierRes!.annee}</Text>
              </View>
            )}

            {/* Les autres catégories en repères, un par ligne */}
            <View style={s.pied}>
              {ressources.filter(r => r.nom !== resActive).map((r, i) => {
                const vPrec = valPrecDe(r.nom);
                const dpc = vPrec != null && vPrec !== 0 ? ((r.valeur - vPrec) / Math.abs(vPrec)) * 100 : null;
                return (
                  <Tapable key={r.nom} echelle={0.98}
                    onPress={() => { tick(); setResChoisi(r.nom); }}
                    style={[s.repere, i > 0 && s.repereBord]}>
                    <TexteDefilant style={s.repereLabel} texte={r.nom.toUpperCase()} />
                    <Text style={s.repereValeur} numberOfLines={1}>{fmtUSD(r.valeur)}</Text>
                    <IconeTendance delta={dpc} />
                  </Tapable>
                );
              })}
            </View>
          </View>
        </View>
      )}

    </>
  );
}

const s = creerStyles(() => ({
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
    backgroundColor: T.carte, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3.5,
    borderWidth: 1, borderColor: "rgba(0,79,145,0.22)", maxWidth: 150,
  },
  badgePaysTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.bleu },
  badgeRes: {
    backgroundColor: T.carte, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3.5,
    borderWidth: 1, borderColor: "rgba(202,99,31,0.28)", maxWidth: 150,
  },
  badgeResTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.orange },
  nombreLigne: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  nombre: { fontSize: 38, lineHeight: 44, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -1, marginTop: 8, fontVariant: ["tabular-nums"] },
  deltaLigne: { flexDirection: "row", alignItems: "center", gap: 4 },
  deltaTexte: { fontSize: 13, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  deltaContexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.gris, marginLeft: 2 },
  indispo: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 10 },
  bornes: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  borne: { fontSize: 10, fontFamily: POLICE.demi, color: T.gris, fontVariant: ["tabular-nums"] },

  pied: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  repere: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10.5 },
  repereBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  repereLabel: { flex: 1, minWidth: 0, fontSize: 9.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 0.8 },
  repereValeur: { ...TYPO.sousTitre, color: T.encre, flexShrink: 1, fontVariant: ["tabular-nums"] },
}));
