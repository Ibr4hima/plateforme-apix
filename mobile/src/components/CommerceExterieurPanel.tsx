// Commerce extérieur du Sénégal — version app du module NACE du site
// (Notes d'Analyse du Commerce Extérieur · ANSD, éditions annuelles).
//
// La grammaire des Investissements : la vedette commutable Exportations /
// Importations / Balance commerciale (totaux annuels des groupes
// d'utilisation, exhaustifs par construction), puis les classements de la
// dernière année en listes plates — principaux produits et continents, avec
// part du total et variation vs N-1 fléchée. Le sens des classements se
// choisit en chips, comme partout.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SqueletteDonnees } from "@/components/Squelette";
import { EtatErreur, EtatVide } from "@/components/ui";
import Icone from "@/components/Icone";
import VedetteSeries, { GrapheVedette } from "@/components/VedetteSeries";
import { getJson } from "@/lib/api";
import { fmtMFCFA } from "@/lib/format";
import { tick } from "@/lib/haptique";
import { POLICE, T, TYPO } from "@/theme";

type LigneNace = { annee: number; valeur: number | null; poids: number | null; edition: number } & Record<string, any>;
type DonneesNace = { disponible: boolean; annees: number[]; donnees: { export: LigneNace[]; import: LigneNace[] } };

const SENS = [
  { cle: "export", label: "Exportations" },
  { cle: "import", label: "Importations" },
] as const;

// Somme tolérante aux trous (règle du site) : null + null reste null
const somme = (a: number | null, b: number | null) => a == null && b == null ? null : (a ?? 0) + (b ?? 0);

const fmtPct = (v: number) => Math.abs(v).toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export default function CommerceExterieurPanel() {
  const [sens, setSens] = useState<"export" | "import">("export");

  const gu = useQuery({
    queryKey: ["nace-gu"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<DonneesNace>("/nace/groupes-utilisation"),
  });
  const produits = useQuery({
    queryKey: ["nace-produits"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<DonneesNace>("/nace/principaux-produits").catch(() => null),
  });
  const continents = useQuery({
    queryKey: ["nace-continents"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<DonneesNace>("/nace/continents").catch(() => null),
  });

  // Totaux annuels par sens — les groupes d'utilisation couvrent tout
  const totaux = useMemo(() => {
    const m = { export: new Map<number, number | null>(), import: new Map<number, number | null>() };
    for (const cle of ["export", "import"] as const) {
      for (const r of gu.data?.donnees?.[cle] || []) {
        m[cle].set(r.annee, somme(m[cle].get(r.annee) ?? null, r.valeur));
      }
    }
    return m;
  }, [gu.data]);

  const annees = useMemo(() =>
    [...new Set([...totaux.export.keys(), ...totaux.import.keys()])].sort((a, b) => a - b),
  [totaux]);
  const refAnnee = annees[annees.length - 1];

  const graphes: GrapheVedette[] = useMemo(() => {
    const serieDe = (vals: (a: number) => number | null) =>
      annees.map(a => ({ annee: a, valeur: vals(a) }));
    return [
      { cle: "export", label: "Exportations", fmt: fmtMFCFA, series: [{ nom: "Exportations", couleur: "#004f91", data: serieDe(a => totaux.export.get(a) ?? null) }] },
      { cle: "import", label: "Importations", fmt: fmtMFCFA, series: [{ nom: "Importations", couleur: "#ca631f", data: serieDe(a => totaux.import.get(a) ?? null) }] },
      { cle: "balance", label: "Balance commerciale", fmt: fmtMFCFA, series: [{ nom: "Balance", couleur: "#188038", data: serieDe(a => {
        const e = totaux.export.get(a) ?? null, i = totaux.import.get(a) ?? null;
        return e == null || i == null ? null : e - i;
      }) }] },
    ];
  }, [annees, totaux]);

  // Classement d'une famille pour l'année de référence : valeur, part du
  // total, variation vs N-1
  const classement = (data: DonneesNace | null | undefined, champ: string, top: number) => {
    if (!data?.disponible || refAnnee == null) return [];
    const rows = data.donnees[sens] || [];
    const total = totaux[sens].get(refAnnee) ?? null;
    return rows
      .filter(r => r.annee === refAnnee && r.valeur != null)
      .sort((a, b) => (b.valeur ?? 0) - (a.valeur ?? 0))
      .slice(0, top)
      .map(r => {
        const prec = rows.find(x => x.annee === refAnnee - 1 && x[champ] === r[champ])?.valeur ?? null;
        let delta: number | null = null;
        if (prec) { const pct = (r.valeur! - prec) / Math.abs(prec) * 100; if (isFinite(pct)) delta = pct; }
        return {
          cle: String(r[champ]), nom: String(r[champ]), valeur: r.valeur!,
          part: total ? (r.valeur! / total) * 100 : null, delta,
        };
      });
  };
  const topProduits = useMemo(() => classement(produits.data, "produit", 10),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [produits.data, sens, refAnnee, totaux]);
  const topContinents = useMemo(() => classement(continents.data, "continent", 6),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [continents.data, sens, refAnnee, totaux]);

  if (gu.isLoading) return <SqueletteDonnees />;
  if (gu.isError) return <EtatErreur onRetry={() => gu.refetch()} />;
  if (!gu.data?.disponible || !annees.length) return (
    <EtatVide texte="Commerce extérieur du Sénégal"
      sousTexte="Les indicateurs NACE seront disponibles après l'import des rapports annuels dans l'administration." />
  );

  const Classement = ({ titre, lignes }: { titre: string; lignes: ReturnType<typeof classement> }) => (
    lignes.length === 0 ? null : (
      <View style={s.rangee}>
        <Text style={s.sectionTitre}>{titre.toUpperCase()}</Text>
        <View style={s.carteListe}>
          {lignes.map((l, i) => {
            const hausse = (l.delta ?? 0) >= 0;
            return (
              <View key={l.cle} style={[s.ligne, i > 0 && s.ligneBord]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.ligneNom} numberOfLines={2}>{l.nom}</Text>
                  {l.part != null && <Text style={s.ligneNote}>{fmtPct(l.part)} % du total</Text>}
                </View>
                {l.delta != null && (
                  <View style={s.delta}>
                    <Icone sf={hausse ? "arrow.up.right" : "arrow.down.right"}
                      materiel={hausse ? "north_east" : "south_east"}
                      taille={10} couleur={hausse ? T.vert : "#dc2626"} poids="bold" />
                    <Text style={[s.deltaTexte, { color: hausse ? T.vert : "#dc2626" }]}>{fmtPct(l.delta)} %</Text>
                  </View>
                )}
                <Text style={s.ligneValeur}>{fmtMFCFA(l.valeur)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    )
  );

  return (
    <>
      {/* Contexte : période couverte, module Sénégal uniquement */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.pastilles}>
        <View style={s.periodePastille}>
          <Text style={s.periodePastilleTexte}>{annees[0]} — {refAnnee}</Text>
        </View>
        <View style={s.paysPastille}>
          <View style={s.paysPoint} />
          <Text style={s.paysPastilleTexte}>Sénégal</Text>
        </View>
      </ScrollView>

      {/* Exportations / Importations / Balance — une courbe à la fois */}
      <VedetteSeries graphes={graphes} />

      {/* Les classements suivent le sens choisi ici */}
      <View style={[s.rangee, { marginTop: 18 }]}>
        <View style={s.sensRangee}>
          {SENS.map(o => {
            const actif = sens === o.cle;
            return (
              <Pressable key={o.cle} onPress={() => { tick(); setSens(o.cle); }}
                style={[s.sensChip, actif && s.sensChipActif]}>
                <Text style={[s.sensChipTexte, actif && s.sensChipTexteActif]}>{o.label}</Text>
              </Pressable>
            );
          })}
          <Text style={s.sensAnnee}>en {refAnnee}</Text>
        </View>
      </View>
      <Classement titre="Principaux produits" lignes={topProduits} />
      <Classement titre="Répartition par continent" lignes={topContinents} />

      <Text style={s.source}>Source NACE · ANSD</Text>
    </>
  );
}

const s = StyleSheet.create({
  pastilles: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14, paddingHorizontal: 16 },
  periodePastille: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(108,117,125,0.28)",
  },
  periodePastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, color: "#6b7280", fontVariant: ["tabular-nums"] },
  paysPastille: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.7)", borderColor: "rgba(0,79,145,0.20)",
    paddingHorizontal: 12, paddingVertical: 5,
  },
  paysPoint: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.bleu },
  paysPastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, color: T.bleu },

  rangee: { paddingHorizontal: 16, marginTop: 14 },
  sensRangee: { flexDirection: "row", alignItems: "center", gap: 8 },
  sensChip: { paddingHorizontal: 14, paddingVertical: 7.5, borderRadius: 999, backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure },
  sensChipActif: { backgroundColor: T.bleuAction, borderColor: T.bleuAction },
  sensChipTexte: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.texte },
  sensChipTexteActif: { color: "#fff" },
  sensAnnee: { marginLeft: "auto", fontSize: 11.5, fontFamily: POLICE.demi, color: T.gris, fontVariant: ["tabular-nums"] },

  sectionTitre: { ...TYPO.micro, color: T.bleu, marginBottom: 10 },
  carteListe: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 16, paddingVertical: 3,
  },
  ligne: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9.5 },
  ligneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  ligneNom: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre, lineHeight: 18 },
  ligneNote: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 1 },
  ligneValeur: { fontSize: 13, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
  delta: { flexDirection: "row", alignItems: "center", gap: 2 },
  deltaTexte: { fontSize: 11, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },

  source: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", marginTop: 18 },
});
