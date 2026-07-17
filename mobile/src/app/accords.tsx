// Accords & Traités — adaptation fidèle de la page web : onglets TBI /
// Traités internationaux (bientôt), recherche, filtres statut + pays
// signataires, cards identiques au site (badge pastel, ancienneté,
// rangée de dates), tri par échéance d'expiration.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AccordSheet, { ST_PASTEL, sousTitreStatut } from "@/components/AccordSheet";
import HeroModule from "@/components/HeroModule";
import Symbole from "@/components/Symbole";
import { fetchTous, getJson } from "@/lib/api";
import { foncerPastel } from "@/lib/couleurs";
import { fmtDate } from "@/lib/format";
import { computeStatutAccord } from "@/lib/statuts";
import { POLICE, T } from "@/theme";

const ONGLETS = [
  { cle: "tbi",   label: "Bilatéraux (TBI)" },
  { cle: "inter", label: "Internationaux" },
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
      style={({ pressed }) => [s.carte, estExpire && { backgroundColor: "#FBFAF9" }, pressed && { transform: [{ scale: 0.99 }], borderColor: st ? st.p : T.grisClair }]}>
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
  const [paysIds, setPaysIds] = useState<number[]>([]);
  const [selec, setSelec] = useState<any>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["accords"], queryFn: () => fetchTous("/accords"),
  });
  const paysDistincts = useQuery({
    queryKey: ["accords-parties"], queryFn: () => getJson<any[]>("/accords/parties-distinctes"), staleTime: 30 * 60 * 1000,
  });
  const autresPays = useMemo(() =>
    (paysDistincts.data || []).filter((p: any) => p.nom !== "Sénégal").sort((a: any, b: any) => a.nom.localeCompare(b.nom, "fr")),
    [paysDistincts.data]);

  const filtres = useMemo(() => {
    let liste = (data || []).filter((a: any) => (a.type_accord || "tbi") === "tbi");
    if (statut !== "tous") liste = liste.filter((a: any) => computeStatutAccord(a) === statut);
    if (paysIds.length > 0) liste = liste.filter((a: any) => paysIds.some(id => (a.parties_pays_ids || []).includes(id)));
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
  }, [data, q, statut, paysIds]);

  const togglePays = (id: number) => setPaysIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const hero = (
    <>
      <HeroModule titre="Accords & Traités"
        recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher un accord…" }}
        segments={{ options: ONGLETS, valeur: onglet, onChange: setOnglet }} />
      {onglet === "tbi" && (
        <>
          {/* Filtres de statut */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRangee}>
            {STATUTS.map(o => {
              const actif = statut === o.cle;
              return (
                <Pressable key={o.cle} onPress={() => setStatut(o.cle)} style={[s.chipFiltre, actif && s.chipFiltreActif]}>
                  <Text style={[s.chipFiltreTexte, actif && s.chipFiltreTexteActif]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {/* Pays signataires */}
          {autresPays.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.chipsRangee, { paddingTop: 0 }]}>
              {autresPays.map((p: any) => {
                const actif = paysIds.includes(p.id);
                return (
                  <Pressable key={p.id} onPress={() => togglePays(p.id)} style={[s.chipPays, actif && s.chipPaysActif]}>
                    <Text style={[s.chipPaysTexte, actif && s.chipPaysTexteActif]}>{p.nom}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          {!isLoading && !isError && (
            <Text style={s.compte}>{filtres.length} accord{filtres.length > 1 ? "s" : ""}</Text>
          )}
        </>
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
      <FlatList
        style={{ backgroundColor: T.fond }}
        data={isLoading || isError ? [] : filtres}
        keyExtractor={(a: any) => String(a.id)}
        renderItem={({ item }) => <View style={s.rangee}><CarteAccord a={item} onPress={() => setSelec(item)} /></View>}
        contentContainerStyle={s.liste}
        refreshing={isRefetching}
        onRefresh={refetch}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={hero}
        ListEmptyComponent={
          isLoading ? <View style={s.centre}><ActivityIndicator color={T.bleu} size="large" /></View>
          : isError ? (
            <View style={s.centre}>
              <Text style={s.erreur}>Impossible de joindre la plateforme.</Text>
              <Pressable onPress={() => refetch()} style={s.bouton}><Text style={s.boutonTexte}>Réessayer</Text></Pressable>
            </View>
          ) : (
            <View style={s.centre}><Text style={s.erreurSous}>Aucun accord ne correspond à ces filtres.</Text></View>
          )
        }
      />
      {selec && <AccordSheet accord={selec} onClose={() => setSelec(null)} />}
    </>
  );
}

const s = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  erreur: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre, textAlign: "center" },
  erreurSous: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center" },
  bouton: { marginTop: 12, backgroundColor: T.bleu, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  boutonTexte: { color: "#fff", fontFamily: POLICE.gras, fontSize: 13 },
  liste: { gap: 11, paddingBottom: 40 },
  rangee: { paddingHorizontal: 16 },
  chipsRangee: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  chipFiltre: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: T.bordure },
  chipFiltreActif: { backgroundColor: T.bleu, borderColor: T.bleu },
  chipFiltreTexte: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.texte },
  chipFiltreTexteActif: { color: "#fff" },
  chipPays: { paddingHorizontal: 13, paddingVertical: 6.5, borderRadius: 999, backgroundColor: "rgba(0,79,145,0.05)", borderWidth: 1, borderColor: "rgba(0,79,145,0.12)" },
  chipPaysActif: { backgroundColor: "rgba(0,79,145,0.12)", borderColor: T.bleu },
  chipPaysTexte: { fontSize: 12, fontFamily: POLICE.moyen, color: T.texte },
  chipPaysTexteActif: { color: T.bleu, fontFamily: POLICE.demi },
  compte: { fontSize: 11, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1, textTransform: "uppercase", marginTop: 12, marginBottom: 4, paddingHorizontal: 16 },
  carte: {
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: T.bordure,
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
  bientotPastille: { width: 56, height: 56, borderRadius: 17, backgroundColor: "rgba(0,79,145,0.08)", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  bientotTitre: { fontSize: 17, fontFamily: POLICE.gras, color: T.encre },
  bientotTexte: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", lineHeight: 19 },
});
