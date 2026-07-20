// Accords & Traités — adaptation fidèle de la page web : onglets TBI /
// Traités internationaux (bientôt), recherche, filtres statut + pays
// signataires, cards identiques au site (badge pastel, ancienneté,
// rangée de dates), tri par échéance d'expiration.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Animated, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { EtatCharge, EtatErreur, EtatVide } from "@/components/ui";
import AccordSheet, { ST_PASTEL, sousTitreStatut } from "@/components/AccordSheet";
import HeroModule, { BarreHero, useHeroDefilant } from "@/components/HeroModule";
import Symbole from "@/components/Symbole";
import { fetchTous } from "@/lib/api";
import { foncerPastel } from "@/lib/couleurs";
import { fmtDate } from "@/lib/format";
import { computeStatutAccord } from "@/lib/statuts";
import { POLICE, T } from "@/theme";

const TYPES = [
  { cle: "tbi",   label: "Traités Bilatéraux" },
  { cle: "inter", label: "Traités Internationaux" },
] as const;
const STATUTS = [
  { cle: "tous",       label: "Tous" },
  { cle: "en_vigueur", label: "En vigueur" },
  { cle: "signe",      label: "Signés" },
  { cle: "expire",     label: "Expirés" },
] as const;

function CarteAccord({ a, onPress }: { a: any; onPress: () => void }) {
  const statut = computeStatutAccord(a);
  const st = statut ? ST_PASTEL[statut] : null;
  const estExpire = statut === "expire";
  const txtC = estExpire ? T.texte : T.encre;
  const sousTitre = sousTitreStatut(a);
  // Date secondaire : expiration si renseignée, sinon entrée en vigueur (règle du site)
  const dateSec = a.date_expiration
    ? { label: "EXPIRATION", val: fmtDate(a.date_expiration), vide: false }
    : { label: "ENTRÉE EN VIGUEUR", val: a.date_entree_vigueur ? fmtDate(a.date_entree_vigueur) : "Non définie", vide: !a.date_entree_vigueur };
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => [s.carte, estExpire && { backgroundColor: T.carteDouce }, pressed && { transform: [{ scale: 0.99 }], borderColor: st ? st.p : T.grisClair }]}>
      <View style={s.ligneTitre}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.titre, { color: txtC }]} numberOfLines={2}>{a.titre}</Text>
          {sousTitre ? <Text style={s.sousTitre} numberOfLines={1}>{sousTitre}</Text> : null}
        </View>
        {st && (
          <View style={[s.badge, { backgroundColor: `${st.p}40`, borderColor: `${st.p}90` }]}>
            <Text style={[s.badgeTexte, { color: foncerPastel(st.p) }]}>{st.label}</Text>
          </View>
        )}
      </View>
      <View style={s.dates}>
        <View style={{ flex: 1 }}>
          <Text style={s.dateLabel}>SIGNATURE</Text>
          <Text style={[s.dateVal, { color: a.date_signature ? txtC : T.grisClair }]}>{a.date_signature ? fmtDate(a.date_signature) : "—"}</Text>
        </View>
        <View style={s.dateSep} />
        <View style={{ flex: 1 }}>
          <Text style={s.dateLabel}>{dateSec.label}</Text>
          <Text style={[s.dateVal, { color: dateSec.vide ? T.grisClair : txtC }]}>{dateSec.val}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function Accords() {
  const [onglet, setOnglet] = useState("tbi");
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState("tous");
  const [selec, setSelec] = useState<any>(null);
  const { defilY, onScroll } = useHeroDefilant();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["accords"], queryFn: () => fetchTous("/accords"),
  });
  // L'endpoint renvoie { pays: [...], organisations: [...] } (comme sur le site)
  const filtres = useMemo(() => {
    let liste = (data || []).filter((a: any) => (a.type_accord || "tbi") === "tbi");
    if (statut !== "tous") liste = liste.filter((a: any) => computeStatutAccord(a) === statut);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      liste = liste.filter((a: any) => (a.titre || "").toLowerCase().includes(t) || (a.reference || "").toLowerCase().includes(t));
    }
    // Tri du site : échéance d'expiration croissante, sans expiration à la fin
    return [...liste].sort((a: any, b: any) => {
      if (!a.date_expiration && !b.date_expiration) return 0;
      if (!a.date_expiration) return 1;
      if (!b.date_expiration) return -1;
      return a.date_expiration.localeCompare(b.date_expiration);
    });
  }, [data, q, statut]);

  const hero = (
    <>
      <HeroModule titre="Accords & Traités"
        recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
        segments={{ options: STATUTS, valeur: statut, onChange: setStatut }} />
      {/* Types de traités — extensible */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.chipsRangee}>
        {TYPES.map(o => {
          const actif = onglet === o.cle;
          return (
            <Pressable key={o.cle} onPress={() => setOnglet(o.cle)} style={[s.chipFiltre, actif && s.chipFiltreActif]}>
              <Text style={[s.chipFiltreTexte, actif && s.chipFiltreTexteActif]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {onglet === "tbi" && !isLoading && !isError && (
        <Text style={s.compte}>{filtres.length} accord{filtres.length > 1 ? "s" : ""}</Text>
      )}
    </>
  );

  if (onglet === "inter") {
    return (
      <View style={{ flex: 1, backgroundColor: T.fond }}>
        {hero}
        <View style={s.centre}>
          <View style={s.bientotPastille}><Symbole nom="signature" taille={26} couleur={T.bleu} /></View>
          <Text style={s.bientotTitre}>Traités Internationaux</Text>
          <Text style={s.bientotTexte}>Cette section arrive prochainement.{"\n"}Les traités bilatéraux d'investissement restent disponibles.</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <Animated.FlatList
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ backgroundColor: T.fond }}
        data={isLoading || isError ? [] : filtres}
        keyExtractor={(a: any) => String(a.id)}
        renderItem={({ item }: any) => <View style={s.rangee}><CarteAccord a={item} onPress={() => setSelec(item)} /></View>}
        contentContainerStyle={s.liste}
        refreshing={isRefetching}
        onRefresh={refetch}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={hero}
        ListEmptyComponent={
          isLoading ? <EtatCharge />
          : isError ? (
            <EtatErreur onRetry={() => refetch()} />
          ) : (
            <EtatVide texte="Aucun accord ne correspond à ces filtres." />
          )
        }
      />
      <BarreHero titre="Accords & Traités" defilY={defilY} />
      {selec && <AccordSheet accord={selec} onClose={() => setSelec(null)} />}
    </>
  );
}

const s = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  liste: { gap: 11, paddingBottom: 40 },
  rangee: { paddingHorizontal: 16 },
  chipsRangee: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  chipFiltre: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure },
  chipFiltreActif: { backgroundColor: T.bleuAction, borderColor: T.bleuAction },
  chipFiltreTexte: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.texte },
  chipFiltreTexteActif: { color: "#fff" },
  compte: { fontSize: 11, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1, textTransform: "uppercase", marginTop: 12, marginBottom: 4, paddingHorizontal: 16 },
  carte: {
    backgroundColor: T.carte, borderRadius: 16, borderWidth: 1, borderColor: T.bordure,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, gap: 13,
  },
  ligneTitre: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  titre: { fontSize: 15, fontFamily: POLICE.gras, lineHeight: 20, letterSpacing: -0.2 },
  sousTitre: { fontSize: 11, fontFamily: POLICE.moyen, color: T.gris, marginTop: 3 },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 3 },
  badgeTexte: { fontSize: 10.5, fontFamily: POLICE.gras },
  dates: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: T.filet, paddingTop: 12 },
  dateSep: { width: 1, alignSelf: "stretch", backgroundColor: T.filet, marginHorizontal: 18 },
  dateLabel: { fontSize: 9, fontFamily: POLICE.gras, letterSpacing: 1.1, color: T.gris, marginBottom: 4 },
  dateVal: { fontSize: 12.5, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  bientotPastille: { width: 56, height: 56, borderRadius: 17, backgroundColor: T.bleuVoile, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  bientotTitre: { fontSize: 17, fontFamily: POLICE.gras, color: T.encre },
  bientotTexte: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", lineHeight: 19 },
});
