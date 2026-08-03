// La situation — le bloc vedette de l'accueil.
//
// Un seul grand nombre : les flux d'IDE entrants de la dernière année connue,
// avec sa variation vs N-1 et la silhouette de toute la série (mini-tendance
// Skia). En pied de carte, deux repères : le stock d'IDE entrant et le PIB.
// Toute la carte mène à l'onglet Investissements — c'est un sommaire, le
// détail vit dans le module.
//
// Les clés de requête CNUCED sont volontairement celles de l'écran
// Investissements : quand l'utilisateur y navigue ensuite, ses données par
// défaut sont déjà en cache.
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Icone from "@/components/Icone";
import MiniTendance from "@/components/MiniTendance";
import { Os } from "@/components/Squelette";
import { Apparition, ChiffreAnime, Tapable } from "@/components/ui";
import { getJson } from "@/lib/api";
import { fmtMillionsUSD, fmtUnite } from "@/lib/format";
import { ESPACE, OMBRE, POLICE, RAYON, T, TYPO } from "@/theme";

type Point = { annee: number; valeur: number };

async function chargerSituation() {
  const bornes = await getJson<any>("/ide/cnuced/annees");
  const p = new URLSearchParams({
    pays_list: "Sénégal",
    annee_min: String(bornes?.annee_min ?? 1990),
    annee_max: String(bornes?.annee_max ?? new Date().getFullYear()),
  });
  const brut = await getJson<any[]>(`/ide/cnuced?${p}`);
  const serieDe = (indicateur: string): Point[] => (brut || [])
    .filter(r => r.direction === "entrant" && r.indicateur === indicateur && r.valeur != null)
    .map(r => ({ annee: r.annee, valeur: r.valeur }))
    .sort((a, b) => a.annee - b.annee);
  return { flux: serieDe("flux"), stock: serieDe("stock") };
}

async function chargerPib() {
  const pays = await getJson<any[]>("/statistiques/pays");
  const sen = (pays || []).find(x => x.code_iso3 === "SEN");
  if (!sen) return null;
  const d = await getJson<any>(`/statistiques/comparaison?pays=${sen.id}`);
  const cellule = d?.valeurs?.[String(sen.id)]?.pib;
  if (!cellule) return null;
  const unite = (d?.indicateurs || []).find((i: any) => i.code === "pib")?.unite || "USD";
  return { valeur: cellule.valeur as number, annee: cellule.annee as number, unite };
}

// Repère du pied de carte : étiquette, valeur, année
function Repere({ label, valeur, annee }: { label: string; valeur: string; annee?: number | null }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={s.repereLabel} numberOfLines={1}>{label}</Text>
      <Text style={s.repereValeur} numberOfLines={1} adjustsFontSizeToFit>
        {valeur}
        {annee ? <Text style={s.repereAnnee}>  {annee}</Text> : null}
      </Text>
    </View>
  );
}

export default function VedetteIde() {
  const router = useRouter();
  const [largeur, setLargeur] = useState(0);
  const situation = useQuery({ queryKey: ["accueil-situation"], queryFn: chargerSituation, staleTime: 30 * 60 * 1000 });
  const pib = useQuery({ queryKey: ["accueil-pib"], queryFn: chargerPib, staleTime: 30 * 60 * 1000 });

  if (situation.isLoading) {
    return (
      <View style={[s.carte, { gap: ESPACE.s }]}>
        <Os style={{ width: 150, height: 11, borderRadius: 6 }} />
        <Os style={{ width: 190, height: 34, borderRadius: 9 }} />
        <Os style={{ width: "100%", height: 56, borderRadius: 12 }} />
      </View>
    );
  }

  const flux = situation.data?.flux ?? [];
  if (situation.isError || flux.length === 0) {
    // La carte ne disparaît pas en silence : elle dit pourquoi et se relance
    return (
      <Tapable onPress={() => situation.refetch()} style={[s.carte, s.carteErreur]}>
        <Icone sf="arrow.clockwise" materiel="refresh" taille={15} couleur={T.gris} />
        <Text style={s.erreurTexte}>
          {situation.isError ? "Chiffres indisponibles — toucher pour réessayer" : "Aucune donnée d'IDE disponible"}
        </Text>
      </Tapable>
    );
  }

  const dernier = flux[flux.length - 1];
  const precedent = flux.length > 1 ? flux[flux.length - 2] : null;
  const delta = precedent && precedent.valeur !== 0
    ? ((dernier.valeur - precedent.valeur) / Math.abs(precedent.valeur)) * 100 : null;
  const hausse = (delta ?? 0) >= 0;
  const stock = situation.data?.stock.at(-1);

  return (
    <Apparition index={0}>
      <Tapable onPress={() => router.push("/investissements")} echelle={0.98} style={s.carte}>
        {/* Lavis bleu très doux du haut vers le blanc : la carte se détache
            du fond sans peser — le blanc pur est réservé au bas de carte */}
        <LinearGradient colors={["#E9F1F8", "#FDFDFD"]} start={{ x: 0.2, y: 0 }} end={{ x: 0.5, y: 0.7 }}
          style={StyleSheet.absoluteFill} />
        {/* Étiquette + signal de navigation */}
        <View style={s.enTete}>
          <Text style={s.etiquette}>FLUX D&apos;IDE ENTRANTS · {dernier.annee}</Text>
          <Icone sf="chevron.right" materiel="chevron_right" taille={13} couleur={T.grisClair} poids="semibold" />
        </View>

        {/* Le nombre, puis sa variation */}
        <ChiffreAnime texte={fmtMillionsUSD(dernier.valeur)} style={s.nombre} />
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

        {/* La silhouette de la série entière */}
        <View style={{ marginTop: ESPACE.s }} onLayout={e => setLargeur(e.nativeEvent.layout.width)}>
          {largeur > 0 && <MiniTendance valeurs={flux.map(x => x.valeur)} largeur={largeur} couleur={T.bleu as string} />}
        </View>
        <View style={s.bornes}>
          <Text style={s.borne}>{flux[0].annee}</Text>
          <Text style={s.borne}>{dernier.annee}</Text>
        </View>

        {/* Deux repères : stock, PIB */}
        {(stock || pib.data) && (
          <View style={s.pied}>
            {stock && <Repere label="STOCK D'IDE ENTRANT" valeur={fmtMillionsUSD(stock.valeur)} annee={stock.annee} />}
            {stock && pib.data && <View style={s.filetVertical} />}
            {pib.data && <Repere label="PIB" valeur={fmtUnite(pib.data.valeur, pib.data.unite)} annee={pib.data.annee} />}
          </View>
        )}
      </Tapable>
    </Apparition>
  );
}

const s = StyleSheet.create({
  carte: {
    marginHorizontal: ESPACE.m, backgroundColor: T.carte, borderRadius: RAYON.grand,
    paddingHorizontal: 18, paddingVertical: 16, overflow: "hidden",
    borderWidth: 1, borderColor: T.carteBord,
  },
  carteErreur: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 18 },
  erreurTexte: { ...TYPO.legende, color: T.gris, flex: 1 },
  enTete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  etiquette: { ...TYPO.micro, color: T.gris },
  // Le nombre en bleu APIX — la donnée EST la marque, comme les KPIs du site
  nombre: { fontSize: 38, lineHeight: 44, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -1, marginTop: 8, fontVariant: ["tabular-nums"] },
  deltaLigne: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  deltaTexte: { fontSize: 13, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  deltaContexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.gris, marginLeft: 2 },
  bornes: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  borne: { fontSize: 10, fontFamily: POLICE.demi, color: T.grisClair, fontVariant: ["tabular-nums"] },
  pied: {
    flexDirection: "row", alignItems: "center", gap: 14,
    marginTop: ESPACE.m, paddingTop: ESPACE.s + 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
  },
  filetVertical: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure },
  repereLabel: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 0.8 },
  repereValeur: { ...TYPO.sousTitre, color: T.encre, marginTop: 3, fontVariant: ["tabular-nums"] },
  repereAnnee: { fontSize: 11, fontFamily: POLICE.normal, color: T.grisClair },
});
