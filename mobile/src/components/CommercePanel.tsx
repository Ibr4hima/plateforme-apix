// Flux bilatéraux — la grammaire EXACTE de la carte vedette de l'accueil.
//
// UNE BASCULE, EN TÊTE : Exportations · Importations. Elle met TOUTE la page
// dans un sens :
//   · la carte vedette montre le flux de ce sens (micro-étiquette, badge pays
//     bleu ouvrant le sélecteur, nombre en 38 pt qui compte, variation vs N-1
//     fléchée, silhouette Skia sans axes), puis deux repères : l'autre flux —
//     le toucher bascule la page — et la balance commerciale, AFFICHÉE
//     seulement : elle n'est pas un sens, elle ne s'installe pas en vedette ;
//   · la seconde carte, en orange, montre les ressources de ce sens — une en
//     vedette, Combustibles fossiles par défaut, les autres en repères. Le sens
//     étant dit par la bascule, elle ne le répète plus en badge.
// Le curseur d'années, sous la bascule, pilote les deux cartes.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SqueletteDonnees } from "@/components/Squelette";
import { ChiffreAnime, EtatErreur, EtatVide, IconeTendance, Ondulable, Tapable } from "@/components/ui";
import CurseurAnnees from "@/components/CurseurAnnees";
import Icone from "@/components/Icone";
import MiniTendance from "@/components/MiniTendance";
import { enPanne, getJson } from "@/lib/api";
import { fmtUSD } from "@/lib/format";
import { coin, FONTE, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";
import { SegmentsCapsule } from "@/components/ListeIOS";

type CleSerie = "exports" | "imports" | "balance";
const LABELS: Record<CleSerie, string> = {
  exports: "EXPORTATIONS", imports: "IMPORTATIONS", balance: "BALANCE COMMERCIALE",
};

type Sens = "exportateur" | "importateur";
const SENS: { cle: Sens; label: string }[] = [
  { cle: "exportateur", label: "Exportations" },
  { cle: "importateur", label: "Importations" },
];

type Point = { annee: number; valeur: number };

export default function CommercePanel({ pays, paysId, onOuvrirPays }: {
  pays: any[]; paysId: number | null; onOuvrirPays: () => void;
}) {
  // Le sens de la page — la bascule du haut
  const [sens, setSens] = useState<Sens>("exportateur");
  const actif: CleSerie = sens === "exportateur" ? "exports" : "imports";
  const direction = sens;
  const expDir = sens === "exportateur";
  const [anneeSel, setAnneeSel] = useState<number | null>(null);
  const [largeurTendance, setLargeurTendance] = useState(0);

  // Référentiel du commerce : années disponibles
  const { data: refs, isLoading, isError, refetch } = useQuery({
    queryKey: ["commerce-filtres"], queryFn: () => getJson<any>("/statistiques/commerce/filtres"), staleTime: Infinity,
  });
  const annees: number[] = useMemo(() => (refs?.annees || []).slice().sort((a: number, b: number) => a - b), [refs]);

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

  const tops = useQuery({
    queryKey: ["commerce-tops", paramsAnnee], enabled: !!paramsAnnee,
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
    queryKey: ["commerce-balance", paramsRes], enabled: !!paramsRes,
    queryFn: () => getJson<any[]>(`/statistiques/commerce/balance?${paramsRes}`).catch(() => []),
  }).data || [];

  // Les tops de l'année précédente servie — les variations des repères ressources
  const anneePrec = anneeRef != null ? anneesSerie[anneesSerie.indexOf(anneeRef) - 1] ?? null : null;
  const paramsPrec = useMemo(() => {
    if (paysId == null || anneePrec == null) return null;
    return new URLSearchParams({ pays_id: String(paysId), direction, annees: String(anneePrec) }).toString();
  }, [paysId, direction, anneePrec]);
  const topsPrec = useQuery({
    queryKey: ["commerce-tops", paramsPrec], enabled: !!paramsPrec,
    queryFn: () => getJson<any>(`/statistiques/commerce/tops?${paramsPrec}`).catch(() => null),
  }).data;

  const selPays = pays.find((p: any) => p.id === paysId);

  // L'erreur ne prend le dessus que s'il n'y a RIEN d'autre : quand une
  // réponse est déjà en cache, on la garde et on la montre — c'est ce qui
  // rend l'écran lisible hors ligne.
  if (enPanne({ isError, data: refs })) return <EtatErreur onRetry={() => refetch()} />;
  if (isLoading) return <SqueletteDonnees />;
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
  // L'autre flux, puis la balance
  const reperes: CleSerie[] = [actif === "exports" ? "imports" : "exports", "balance"];
  const basculer = (s: Sens) => { if (s !== sens) setSens(s); };

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
      {/* ── La bascule du sens, puis la vedette ── */}
      <View style={s.rangee}>
        <View style={s.bascule}>
          <SegmentsCapsule options={SENS} valeur={sens} onChange={c => basculer(c as Sens)} teinte={T.bleu} />
        </View>
        <CurseurAnnees annees={anneesSerie}
          valeur={anneeRef ?? 0}
          onChange={a => setAnneeSel(a === anneesSerie[anneesSerie.length - 1] ? null : a)} />
        <View style={s.vedette}>
          <View style={s.vedetteEnTete}>
            <Text style={s.etiquette} numberOfLines={1}>
              {LABELS[actif]}{dernier ? ` · ${dernier.annee}` : ""}
            </Text>
            {/* Le pays en badge bleu, sans point — le tap ouvre le sélecteur */}
            <Ondulable onPress={() => onOuvrirPays()} style={s.badgePays}>
              <Text style={s.badgePaysTexte} numberOfLines={1}>{selPays?.nom || "—"}</Text>
            </Ondulable>
          </View>

          {/* Le mesureur reste monté d'une bascule à l'autre */}
          <View onLayout={e => setLargeurTendance(e.nativeEvent.layout.width)}>
          <View>
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
          </View>
          </View>

          {/* Les repères, un par ligne : l'autre flux — le toucher bascule la
              page —, et la balance, qui se lit sans se toucher */}
          <View style={s.pied}>
            {reperes.map((cle, i) => {
              const sx = jusqu(serieDe(cle));
              const d = sx.at(-1) ?? null;
              const p = sx.length > 1 ? sx[sx.length - 2] : null;
              const dpc = d && p && p.valeur !== 0 ? ((d.valeur - p.valeur) / Math.abs(p.valeur)) * 100 : null;
              const contenu = (
                <>
                  <Text style={s.repereLabel} numberOfLines={1}>{LABELS[cle]}</Text>
                  <Text style={s.repereValeur} numberOfLines={1}>{d ? fmtUSD(d.valeur) : "—"}</Text>
                  <IconeTendance delta={dpc} />
                </>
              );
              return cle === "balance" ? (
                <View key={cle} style={[s.repere, i > 0 && s.repereBord]} accessible
                  accessibilityLabel={`${LABELS[cle]} : ${d ? fmtUSD(d.valeur) : "indisponible"}`}>
                  {contenu}
                </View>
              ) : (
                <Tapable key={cle} onPress={() => basculer(cle === "exports" ? "exportateur" : "importateur")}
                  style={[s.repere, i > 0 && s.repereBord]} accessibilityRole="button">
                  {contenu}
                </Tapable>
              );
            })}
          </View>
        </View>
      </View>

      {/* ── La ressource en vedette — la même grammaire, en orange ── */}
      {resActive != null && (
        <View style={s.rangee}>
          <View style={s.vedette}>
            <View style={s.vedetteEnTete}>
              <Text style={s.etiquette} numberOfLines={1}>
                {resActive.toUpperCase()}{dernierRes ? ` · ${dernierRes.annee}` : ""}
              </Text>
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
                  <Tapable key={r.nom}
                    onPress={() => setResChoisi(r.nom)}
                    style={[s.repere, i > 0 && s.repereBord]}>
                    <Text style={s.repereLabel} numberOfLines={1}>{r.nom.toUpperCase()}</Text>
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
  bascule: { marginBottom: 14 },

  // La carte vedette — les styles exacts de l'accueil
  vedette: {
    backgroundColor: T.carte, borderRadius: coin(18), borderCurve: "continuous",
    paddingHorizontal: 18, paddingVertical: 16, overflow: "hidden",
    borderWidth: 1, borderColor: T.carteBord,
  },
  vedetteEnTete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  etiquette: { ...TYPO.micro, color: T.gris, flexShrink: 1 },
  badgePays: {
    backgroundColor: T.carte, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3.5,
    borderWidth: 1, borderColor: "rgba(0,79,145,0.22)", maxWidth: 150,
  },
  badgePaysTexte: { fontSize: 11, ...FONTE.gras, color: T.bleu },
  nombreLigne: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  nombre: { fontSize: 38, lineHeight: 44, ...FONTE.gras, color: T.bleu, letterSpacing: -1, marginTop: 8, fontVariant: ["tabular-nums"] },
  deltaLigne: { flexDirection: "row", alignItems: "center", gap: 4 },
  deltaTexte: { fontSize: 13, ...FONTE.gras, fontVariant: ["tabular-nums"] },
  deltaContexte: { fontSize: 13, ...FONTE.normal, color: T.gris, marginLeft: 2 },
  indispo: { fontSize: 12.5, ...FONTE.normal, color: T.gris, marginTop: 10 },
  bornes: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  borne: { fontSize: 10, ...FONTE.demi, color: T.gris, fontVariant: ["tabular-nums"] },

  pied: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  repere: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10.5 },
  repereBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  repereLabel: { flex: 1, minWidth: 0, fontSize: 9.5, ...FONTE.gras, color: T.gris, letterSpacing: 0.8 },
  repereValeur: { ...TYPO.sousTitre, color: T.encre, flexShrink: 1, fontVariant: ["tabular-nums"] },
}));
