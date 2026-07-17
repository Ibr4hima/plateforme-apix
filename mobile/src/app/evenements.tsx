// Événements — adaptation fidèle de la page web : statuts dans le hero,
// vues Liste / Frise chronologique en chips, cards du site (titre,
// sous-titre édition ou échéance, badge de rôle pastel, rangée date · lieu),
// accents « Prochain événement » (bleu) et « En cours » (vert).
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from "react-native";
import EvenementSheet, { ROLE_PASTEL, dateEvenement, ordinal, statutEvenement } from "@/components/EvenementSheet";
import HeroModule from "@/components/HeroModule";
import { fetchTous } from "@/lib/api";
import { foncerPastel } from "@/lib/couleurs";
import { POLICE, T } from "@/theme";

const STATUTS = [
  { cle: "tous",     label: "Tous" },
  { cle: "a_venir",  label: "À venir" },
  { cle: "en_cours", label: "En cours" },
  { cle: "termine",  label: "Terminés" },
] as const;
const VUES = [
  { cle: "liste", label: "Liste" },
  { cle: "frise", label: "Frise chronologique" },
] as const;

// « Dans 2 ans / 3 mois / 12 jours » — port du dansCombien du site
function dansCombien(e: any): string | null {
  const d = e.date_debut ? new Date(e.date_debut + "T00:00:00")
    : e.prochain_annee ? new Date(e.prochain_annee, (e.prochain_mois || 1) - 1, e.prochain_jour || 1) : null;
  if (!d) return null;
  const now = new Date();
  const jours = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  if (jours <= 0) return null;
  let mois = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
  if (d.getDate() < now.getDate()) mois -= 1;
  const ans = Math.floor(mois / 12);
  if (ans >= 1) return `Dans ${ans} an${ans > 1 ? "s" : ""}`;
  if (mois >= 1) return `Dans ${mois} mois`;
  return `Dans ${jours} jour${jours > 1 ? "s" : ""}`;
}

const dateDe = (e: any): Date | null => {
  if (e.date_debut) return new Date(e.date_debut + "T00:00:00");
  if (e.prochain_annee) return new Date(e.prochain_annee, (e.prochain_mois || 1) - 1, e.prochain_jour || 1);
  return null;
};

function CarteEvenement({ e, prochainId, onPress }: { e: any; prochainId: number | null; onPress: () => void }) {
  const statut = statutEvenement(e);
  const estProchain = prochainId != null && e.id === prochainId;
  const estEnCours = statut === "en_cours";
  const estPasse = statut === "termine";
  const txtC = estPasse ? T.texte : T.encre;
  const roleP = e.role_apix ? ROLE_PASTEL[e.role_apix] || "#C5BFBB" : null;
  // Sous-titre du site : échéance pour les à-venir, sinon édition
  const sousTitre = statut === "a_venir" ? (dansCombien(e) || (e.edition != null ? ordinal(e.edition) : null))
    : e.edition != null ? ordinal(e.edition) : null;
  const accent = estProchain
    ? { grad: ["#003a6e", "#004f91", "#1a6ab0"] as const, label: "PROCHAIN ÉVÉNEMENT" }
    : estEnCours
    ? { grad: ["#0d5c26", "#188038", "#2aa14e"] as const, label: "ÉVÉNEMENT EN COURS" }
    : null;
  const lieu = [e.ville, e.pays_hote_nom].filter(Boolean).join(", ");
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => [s.carte, estPasse && { backgroundColor: "#FBFAF9" }, pressed && { transform: [{ scale: 0.99 }] }]}>
      {accent && (
        <LinearGradient colors={accent.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.accentBande}>
          <Text style={s.accentTexte}>{accent.label}</Text>
        </LinearGradient>
      )}
      <View style={s.corps}>
        <View style={s.ligneTitre}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.titre, { color: txtC }]} numberOfLines={2}>{e.nom_event}</Text>
            {sousTitre ? <Text style={s.sousTitre} numberOfLines={1}>{sousTitre}</Text> : null}
          </View>
          {roleP && (
            <View style={[s.badge, { backgroundColor: `${roleP}40`, borderColor: `${roleP}90` }]}>
              <Text style={[s.badgeTexte, { color: foncerPastel(roleP) }]}>{e.role_apix}</Text>
            </View>
          )}
        </View>
        <View style={s.bas}>
          <View style={{ flex: 1 }}>
            <Text style={s.basLabel}>DATE</Text>
            <Text style={[s.basVal, { color: txtC }]} numberOfLines={1}>{dateEvenement(e) || "—"}</Text>
          </View>
          <View style={s.basSep} />
          <View style={{ flex: 1 }}>
            <Text style={s.basLabel}>LIEU</Text>
            <Text style={[s.basVal, { color: lieu ? txtC : T.grisClair }]} numberOfLines={1}>{lieu || "—"}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function Evenements() {
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState("tous");
  const [vue, setVue] = useState("liste");
  const [selec, setSelec] = useState<any>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["evenements"], queryFn: () => fetchTous("/evenements"),
  });

  // Prochain événement (même règle que l'accueil / le site)
  const prochainId = useMemo(() => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const futurs = (data || [])
      .filter((e: any) => e.date_debut && e.date_debut >= aujourdhui)
      .sort((a: any, b: any) => a.date_debut.localeCompare(b.date_debut));
    return futurs[0]?.id ?? null;
  }, [data]);

  const filtres = useMemo(() => {
    let liste = data || [];
    if (statut !== "tous") liste = liste.filter((e: any) => statutEvenement(e) === statut);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      liste = liste.filter((e: any) =>
        (e.nom_event || "").toLowerCase().includes(t) ||
        (e.ville || "").toLowerCase().includes(t) ||
        (e.pays_hote_nom || "").toLowerCase().includes(t));
    }
    // Tri chronologique décroissant (frise du site) ; les sans-date à la fin
    return [...liste].sort((a: any, b: any) => {
      const da = dateDe(a), db = dateDe(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db.getTime() - da.getTime();
    });
  }, [data, q, statut]);

  // Frise : groupes par année (ordre décroissant, comme le site)
  const sections = useMemo(() => {
    const parAnnee = new Map<string, any[]>();
    for (const e of filtres) {
      const d = dateDe(e);
      const cle = d ? String(d.getFullYear()) : "Sans date";
      if (!parAnnee.has(cle)) parAnnee.set(cle, []);
      parAnnee.get(cle)!.push(e);
    }
    return Array.from(parAnnee.entries()).map(([titre, donnees]) => ({ title: titre, data: donnees }));
  }, [filtres]);

  const hero = (
    <>
      <HeroModule titre="Événements"
        recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
        segments={{ options: STATUTS, valeur: statut, onChange: setStatut }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.chipsRangee}>
        {VUES.map(o => {
          const actif = vue === o.cle;
          return (
            <Pressable key={o.cle} onPress={() => setVue(o.cle)} style={[s.chipFiltre, actif && s.chipFiltreActif]}>
              <Text style={[s.chipFiltreTexte, actif && s.chipFiltreTexteActif]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {!isLoading && !isError && (
        <Text style={s.compte}>{filtres.length} événement{filtres.length > 1 ? "s" : ""}</Text>
      )}
    </>
  );

  const vide = isLoading ? <View style={s.centre}><ActivityIndicator color={T.bleu} size="large" /></View>
    : isError ? (
      <View style={s.centre}>
        <Text style={s.erreur}>Impossible de joindre la plateforme.</Text>
        <Pressable onPress={() => refetch()} style={s.bouton}><Text style={s.boutonTexte}>Réessayer</Text></Pressable>
      </View>
    ) : (
      <View style={s.centre}><Text style={s.erreurSous}>Aucun événement ne correspond à ces filtres.</Text></View>
    );

  return (
    <>
      <SectionList
        style={{ backgroundColor: T.fond }}
        sections={isLoading || isError ? [] : (vue === "frise" ? sections : [{ title: "", data: filtres }])}
        keyExtractor={(e: any) => String(e.id)}
        renderItem={({ item }) => (
          <View style={s.rangee}>
            <CarteEvenement e={item} prochainId={prochainId} onPress={() => setSelec(item)} />
          </View>
        )}
        renderSectionHeader={({ section }) => section.title && vue === "frise" ? (
          <View style={s.annee}>
            <Text style={s.anneeTexte}>{section.title}</Text>
            <View style={s.anneeFilet} />
          </View>
        ) : null}
        contentContainerStyle={s.liste}
        stickySectionHeadersEnabled={false}
        refreshing={isRefetching}
        onRefresh={refetch}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={hero}
        ListEmptyComponent={vide}
      />
      {selec && <EvenementSheet ev={selec} onClose={() => setSelec(null)} />}
    </>
  );
}

const s = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  erreur: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre, textAlign: "center" },
  erreurSous: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center" },
  bouton: { marginTop: 12, backgroundColor: T.bleu, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  boutonTexte: { color: "#fff", fontFamily: POLICE.gras, fontSize: 13 },
  liste: { paddingBottom: 40 },
  rangee: { paddingHorizontal: 16, marginBottom: 11 },
  chipsRangee: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  chipFiltre: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: T.bordure },
  chipFiltreActif: { backgroundColor: T.bleu, borderColor: T.bleu },
  chipFiltreTexte: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.texte },
  chipFiltreTexteActif: { color: "#fff" },
  compte: { fontSize: 11, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1, textTransform: "uppercase", marginTop: 12, marginBottom: 8, paddingHorizontal: 16 },
  annee: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, marginTop: 10, marginBottom: 12 },
  anneeTexte: { fontSize: 15, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
  anneeFilet: { flex: 1, height: 1, backgroundColor: "#E4E1DE" },
  carte: {
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: T.bordure, overflow: "hidden",
  },
  accentBande: { paddingVertical: 5, alignItems: "center" },
  accentTexte: { color: "#fff", fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 1.4 },
  corps: { paddingHorizontal: 18, paddingTop: 15, paddingBottom: 14, gap: 13 },
  ligneTitre: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  titre: { fontSize: 15, fontFamily: POLICE.gras, lineHeight: 20, letterSpacing: -0.2 },
  sousTitre: { fontSize: 11, fontFamily: POLICE.moyen, color: T.gris, marginTop: 3 },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 3 },
  badgeTexte: { fontSize: 10.5, fontFamily: POLICE.gras },
  bas: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: T.filet, paddingTop: 12 },
  basSep: { width: 1, alignSelf: "stretch", backgroundColor: T.filet, marginHorizontal: 18 },
  basLabel: { fontSize: 9, fontFamily: POLICE.gras, letterSpacing: 1.1, color: T.gris, marginBottom: 4 },
  basVal: { fontSize: 12.5, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
});
