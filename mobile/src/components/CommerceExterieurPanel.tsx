// Commerce extérieur du Sénégal (NACE · ANSD) — la grammaire EXACTE de la
// carte vedette de l'accueil : les Exportations en vedette (micro-étiquette,
// badge « Sénégal » bleu sans point, nombre en 38 pt qui compte, variation
// vs N-1 fléchée, silhouette Skia sans axes, bornes d'années) et DEUX repères
// — Importations et Balance commerciale — la tendance en glyphe
// trending_up / down / flat teinté. Toucher un repère l'installe en vedette.
//
// Quand les Exportations sont en vedette, un SECOND module suit, en orange :
// les exportations par produits regroupés — même grammaire, le premier
// produit de l'année en vedette, les suivants en repères, et son PROPRE
// curseur d'années (le calendrier des produits n'est pas celui des totaux).
//
// Totaux annuels par sens : la somme des groupes d'utilisation, exhaustifs
// par construction (même règle que le site). Valeurs en millions de FCFA.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SqueletteDonnees } from "@/components/Squelette";
import { ChiffreAnime, EtatErreur, EtatVide, IconeTendance, Tapable } from "@/components/ui";
import CurseurAnnees from "@/components/CurseurAnnees";
import Icone from "@/components/Icone";
import MiniTendance from "@/components/MiniTendance";
import { getJson } from "@/lib/api";
import { fmtMFCFA } from "@/lib/format";
import { tick } from "@/lib/haptique";
import { POLICE, T, TYPO } from "@/theme";

type CleSerie = "exports" | "imports" | "balance";
const LABELS: Record<CleSerie, string> = {
  exports: "EXPORTATIONS", imports: "IMPORTATIONS", balance: "BALANCE COMMERCIALE",
};
const ORDRE: CleSerie[] = ["exports", "imports", "balance"];

type Point = { annee: number; valeur: number };
type DonneesNace = { disponible: boolean; annees: number[]; donnees: { export: any[]; import: any[] } };

// Somme tolérante aux trous (règle du site) : null + null reste null
const somme = (a: number | null, b: number | null) => a == null && b == null ? null : (a ?? 0) + (b ?? 0);

export default function CommerceExterieurPanel() {
  const [actif, setActif] = useState<CleSerie>("exports");
  const [anneeSel, setAnneeSel] = useState<number | null>(null);
  const [largeurTendance, setLargeurTendance] = useState(0);

  const gu = useQuery({
    queryKey: ["nace-gu"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<DonneesNace>("/nace/groupes-utilisation"),
  });

  // ── Les exportations par produits regroupés (second module, en orange) ──
  const [produitChoisi, setProduitChoisi] = useState<string | null>(null);
  const [anneeSelPr, setAnneeSelPr] = useState<number | null>(null);
  const pr = useQuery({
    queryKey: ["nace-regroupes"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<any>("/nace/produits-regroupes"),
  });
  const exportsPr: any[] = useMemo(
    () => (pr.data?.donnees?.export || []).filter((r: any) => r.valeur != null), [pr.data]);
  // Le calendrier des produits — distinct de celui des totaux, d'où son curseur
  const anneesPr = useMemo(() =>
    [...new Set(exportsPr.map((r: any) => r.annee as number))].sort((a, b) => a - b), [exportsPr]);
  useEffect(() => {
    if (anneeSelPr != null && !anneesPr.includes(anneeSelPr)) setAnneeSelPr(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneesPr.join(",")]);

  // Totaux annuels par sens — les groupes d'utilisation couvrent tout
  const series = useMemo<Record<CleSerie, Point[]>>(() => {
    const totaux = { export: new Map<number, number | null>(), import: new Map<number, number | null>() };
    for (const cle of ["export", "import"] as const) {
      for (const r of gu.data?.donnees?.[cle] || []) {
        totaux[cle].set(r.annee, somme(totaux[cle].get(r.annee) ?? null, r.valeur));
      }
    }
    const en = (m: Map<number, number | null>): Point[] =>
      [...m.entries()].filter(([, v]) => v != null).map(([annee, valeur]) => ({ annee, valeur: valeur! }))
        .sort((a, b) => a.annee - b.annee);
    const exports = en(totaux.export), imports = en(totaux.import);
    const balance: Point[] = exports
      .map(e => {
        const i = imports.find(x => x.annee === e.annee);
        return i ? { annee: e.annee, valeur: e.valeur - i.valeur } : null;
      })
      .filter((p): p is Point => p != null);
    return { exports, imports, balance };
  }, [gu.data]);

  // Années couvertes ; le curseur ne pointe que dedans
  const anneesSerie = useMemo(() => series.exports.map(pt => pt.annee), [series]);
  useEffect(() => {
    if (anneeSel != null && !anneesSerie.includes(anneeSel)) setAnneeSel(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneesSerie.join(",")]);

  if (gu.isLoading) return <SqueletteDonnees />;
  if (gu.isError) return <EtatErreur onRetry={() => gu.refetch()} />;
  if (!gu.data?.disponible || series.exports.length === 0) return (
    <EtatVide texte="Commerce extérieur du Sénégal"
      sousTexte="Les indicateurs NACE seront disponibles après l'import des rapports annuels dans l'administration." />
  );

  const jusqu = (sx: Point[]) => anneeSel == null ? sx : sx.filter(pt => pt.annee <= anneeSel);
  const serie = jusqu(series[actif]);
  const dernier = serie.at(-1) ?? null;
  const precedent = serie.length > 1 ? serie[serie.length - 2] : null;
  const delta = dernier && precedent && precedent.valeur !== 0
    ? ((dernier.valeur - precedent.valeur) / Math.abs(precedent.valeur)) * 100 : null;
  const hausse = (delta ?? 0) >= 0;
  const reperes = ORDRE.filter(c => c !== actif);

  // ── Le second module : la vedette produit et son classement ──
  const anneeRefPr = anneeSelPr ?? anneesPr[anneesPr.length - 1] ?? null;
  const seriePrDe = (produit: string): Point[] => {
    const sx = exportsPr
      .filter((r: any) => r.produit === produit)
      .map((r: any) => ({ annee: r.annee, valeur: r.valeur }))
      .sort((a: Point, b: Point) => a.annee - b.annee);
    return anneeSelPr == null ? sx : sx.filter(pt => pt.annee <= anneeSelPr);
  };
  // Le classement COMPLET de l'année de référence : le premier en vedette,
  // tous les autres en repères, par valeur décroissante. Le fourre-tout
  // « Autres produits » sort du classement, comme sur le site : ce n'est pas
  // une modalité et lui donner le rang 1 fausserait la lecture.
  const classement: { produit: string; valeur: number }[] = exportsPr
    .filter((r: any) => r.annee === anneeRefPr && r.produit !== "Autres produits")
    .map((r: any) => ({ produit: r.produit, valeur: r.valeur }))
    .sort((a, b) => b.valeur - a.valeur);
  const produitActif = produitChoisi && classement.some(x => x.produit === produitChoisi)
    ? produitChoisi : classement[0]?.produit ?? null;
  const seriePr = produitActif ? seriePrDe(produitActif) : [];
  const dernierPr = seriePr.at(-1) ?? null;
  const precPr = seriePr.length > 1 ? seriePr[seriePr.length - 2] : null;
  const deltaPr = dernierPr && precPr && precPr.valeur !== 0
    ? ((dernierPr.valeur - precPr.valeur) / Math.abs(precPr.valeur)) * 100 : null;
  const haussePr = (deltaPr ?? 0) >= 0;

  return (
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
          {/* Module Sénégal uniquement — badge bleu sans point */}
          <View style={s.badgePays}>
            <Text style={s.badgePaysTexte}>Sénégal</Text>
          </View>
        </View>

        {dernier ? (
          <View style={s.nombreLigne}>
            <ChiffreAnime texte={fmtMFCFA(dernier.valeur)} style={s.nombre} />
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
            const sx = jusqu(series[cle]);
            const d = sx.at(-1) ?? null;
            const p = sx.length > 1 ? sx[sx.length - 2] : null;
            const dpc = d && p && p.valeur !== 0 ? ((d.valeur - p.valeur) / Math.abs(p.valeur)) * 100 : null;
            return (
              <Tapable key={cle} echelle={0.98}
                onPress={() => { tick(); setActif(cle); }}
                style={[s.repere, i > 0 && s.repereBord]}>
                <Text style={s.repereLabel} numberOfLines={1}>{LABELS[cle]}</Text>
                <Text style={s.repereValeur} numberOfLines={1}>
                  {d ? fmtMFCFA(d.valeur) : "—"}
                </Text>
                <IconeTendance delta={dpc} />
              </Tapable>
            );
          })}
        </View>
      </View>

      {/* ── Les exportations par produits regroupés — en orange ── */}
      {actif === "exports" && produitActif != null && (
        <>
          {/* Son propre curseur, en orange : le calendrier des produits */}
          <View style={{ marginTop: 18 }}>
            <CurseurAnnees annees={anneesPr}
              valeur={anneeRefPr ?? 0}
              couleur={T.orange as string} voile={T.orangeVoile as string}
              onChange={a => setAnneeSelPr(a === anneesPr[anneesPr.length - 1] ? null : a)} />
          </View>
          <View style={s.vedette}>
            <View style={s.vedetteEnTete}>
              <Text style={s.etiquette} numberOfLines={1}>
                {produitActif.toUpperCase()}{dernierPr ? ` · ${dernierPr.annee}` : ""}
              </Text>
              <View style={s.badgeProduit}>
                <Text style={s.badgeProduitTexte} numberOfLines={1}>Exportations</Text>
              </View>
            </View>

            {dernierPr ? (
              <View style={s.nombreLigne}>
                <ChiffreAnime texte={fmtMFCFA(dernierPr.valeur)} style={[s.nombre, { color: T.orange }]} />
                {deltaPr !== null && (
                  <View style={s.deltaLigne}>
                    <Icone sf={haussePr ? "arrow.up.right" : "arrow.down.right"}
                      materiel={haussePr ? "north_east" : "south_east"}
                      taille={12} couleur={haussePr ? T.vert : "#dc2626"} poids="bold" />
                    <Text style={[s.deltaTexte, { color: haussePr ? T.vert : "#dc2626" }]}>
                      {Math.abs(deltaPr).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                    </Text>
                    <Text style={s.deltaContexte}>vs {precPr!.annee}</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={s.indispo}>Donnée indisponible.</Text>
            )}

            <View style={{ marginTop: 10 }}>
              {largeurTendance > 0 && seriePr.length > 1 && (
                <MiniTendance valeurs={seriePr.map(x => x.valeur)} largeur={largeurTendance} couleur={T.orange as string} />
              )}
            </View>
            {seriePr.length > 1 && (
              <View style={s.bornes}>
                <Text style={s.borne}>{seriePr[0].annee}</Text>
                <Text style={s.borne}>{dernierPr!.annee}</Text>
              </View>
            )}

            {/* Les autres produits du classement, un par ligne */}
            <View style={s.pied}>
              {classement.filter(x => x.produit !== produitActif).map((x, i) => {
                const sx = seriePrDe(x.produit);
                const d = sx.at(-1) ?? null;
                const p = sx.length > 1 ? sx[sx.length - 2] : null;
                const dpc = d && p && p.valeur !== 0 ? ((d.valeur - p.valeur) / Math.abs(p.valeur)) * 100 : null;
                return (
                  <Tapable key={x.produit} echelle={0.98}
                    onPress={() => { tick(); setProduitChoisi(x.produit); }}
                    style={[s.repere, i > 0 && s.repereBord]}>
                    <Text style={s.repereLabel} numberOfLines={1}>{x.produit.toUpperCase()}</Text>
                    <Text style={s.repereValeur} numberOfLines={1}>{fmtMFCFA(x.valeur)}</Text>
                    <IconeTendance delta={dpc} />
                  </Tapable>
                );
              })}
            </View>
          </View>
        </>
      )}
    </View>
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
    borderWidth: 1, borderColor: "rgba(0,79,145,0.22)",
  },
  badgePaysTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.bleu },
  badgeProduit: {
    backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3.5,
    borderWidth: 1, borderColor: "rgba(202,99,31,0.28)",
  },
  badgeProduitTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.orange },
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
