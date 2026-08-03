// Commerce extérieur du Sénégal (NACE · ANSD) — la grammaire EXACTE de la
// carte vedette de l'accueil : les Exportations en vedette (micro-étiquette,
// badge « Sénégal » bleu sans point, nombre en 38 pt qui compte, variation
// vs N-1 fléchée, silhouette Skia sans axes, bornes d'années) et DEUX repères
// en grille — Importations et Balance commerciale — la tendance en glyphe
// trending_up / down / flat teinté. Toucher un repère l'installe en vedette ;
// la carte porte tout l'écran.
//
// Totaux annuels par sens : la somme des groupes d'utilisation, exhaustifs
// par construction (même règle que le site). Valeurs en millions de FCFA.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SqueletteDonnees } from "@/components/Squelette";
import { ChiffreAnime, EtatErreur, EtatVide, IconeTendance, Tapable } from "@/components/ui";
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
  const [largeurTendance, setLargeurTendance] = useState(0);

  const gu = useQuery({
    queryKey: ["nace-gu"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<DonneesNace>("/nace/groupes-utilisation"),
  });

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

  if (gu.isLoading) return <SqueletteDonnees />;
  if (gu.isError) return <EtatErreur onRetry={() => gu.refetch()} />;
  if (!gu.data?.disponible || series.exports.length === 0) return (
    <EtatVide texte="Commerce extérieur du Sénégal"
      sousTexte="Les indicateurs NACE seront disponibles après l'import des rapports annuels dans l'administration." />
  );

  const serie = series[actif];
  const dernier = serie.at(-1) ?? null;
  const precedent = serie.length > 1 ? serie[serie.length - 2] : null;
  const delta = dernier && precedent && precedent.valeur !== 0
    ? ((dernier.valeur - precedent.valeur) / Math.abs(precedent.valeur)) * 100 : null;
  const hausse = (delta ?? 0) >= 0;
  const reperes = ORDRE.filter(c => c !== actif);

  return (
    <View style={s.rangee}>
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

        {/* Deux repères, la tendance en glyphe teinté */}
        <View style={s.pied}>
          {reperes.map((cle, i) => {
            const sx = series[cle];
            const d = sx.at(-1) ?? null;
            const p = sx.length > 1 ? sx[sx.length - 2] : null;
            const dpc = d && p && p.valeur !== 0 ? ((d.valeur - p.valeur) / Math.abs(p.valeur)) * 100 : null;
            return (
              <Tapable key={cle} echelle={0.96}
                onPress={() => { tick(); setActif(cle); }}
                style={[s.repere, i % 2 === 1 && s.repereDroit]}>
                <Text style={s.repereLabel} numberOfLines={1}>{LABELS[cle]}</Text>
                <View style={s.repereLigne}>
                  <Text style={s.repereValeur} numberOfLines={1} adjustsFontSizeToFit>
                    {d ? fmtMFCFA(d.valeur) : "—"}
                    {d ? <Text style={s.repereAnnee}>  {d.annee}</Text> : null}
                  </Text>
                  <IconeTendance delta={dpc} />
                </View>
              </Tapable>
            );
          })}
        </View>
      </View>

      <Text style={s.source}>Source NACE · ANSD</Text>
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
  nombreLigne: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  nombre: { fontSize: 38, lineHeight: 44, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -1, marginTop: 8, fontVariant: ["tabular-nums"] },
  deltaLigne: { flexDirection: "row", alignItems: "center", gap: 4 },
  deltaTexte: { fontSize: 13, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  deltaContexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.gris, marginLeft: 2 },
  indispo: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 10 },
  bornes: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  borne: { fontSize: 10, fontFamily: POLICE.demi, color: T.grisClair, fontVariant: ["tabular-nums"] },

  pied: {
    flexDirection: "row",
    marginTop: 14, paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
  },
  repere: { flex: 1, paddingTop: 10, paddingBottom: 2, paddingRight: 10 },
  repereDroit: { paddingRight: 0, paddingLeft: 10, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: T.bordure },
  repereLabel: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 0.8 },
  repereLigne: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  repereValeur: { ...TYPO.sousTitre, color: T.encre, flexShrink: 1, fontVariant: ["tabular-nums"] },
  repereAnnee: { fontSize: 11, fontFamily: POLICE.normal, color: T.grisClair },

  source: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", marginTop: 16 },
});
