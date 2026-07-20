// Événements — adaptation fidèle de la page web : statuts dans le hero,
// vues Liste / Frise chronologique en chips, cards du site (titre,
// sous-titre édition ou échéance, badge de rôle pastel, rangée date · lieu),
// accents « Prochain événement » (bleu) et « En cours » (vert).
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import { Animated, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, EtatErreur, EtatVide } from "@/components/ui";
import { useNaemaArbre } from "@/components/ArbreNaema";
import EvenementSheet, { ROLE_PASTEL, dateEvenement, ordinal, statutEvenement } from "@/components/EvenementSheet";
import { CascadeThema, FeuilleFiltres, SectionCoches, basculer } from "@/components/FiltresListe";
import HeroModule, { BarreHero, useHeroDefilant } from "@/components/HeroModule";
import { fetchTous } from "@/lib/api";
import { foncerPastel } from "@/lib/couleurs";
import { POLICE, T } from "@/theme";

const STATUTS = [
  { cle: "tous",     label: "Tous" },
  { cle: "a_venir",  label: "À venir" },
  { cle: "en_cours", label: "En cours" },
  { cle: "termine",  label: "Terminés" },
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
    ? { grad: [T.bleu, T.bleu] as const, label: "PROCHAIN ÉVÉNEMENT" }
    : estEnCours
    ? { grad: ["#0d5c26", "#188038", "#2aa14e"] as const, label: "ÉVÉNEMENT EN COURS" }
    : null;
  const lieu = [e.ville, e.pays_hote_nom].filter(Boolean).join(", ");
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => [s.carte, estPasse && { backgroundColor: T.carteDouce }, pressed && { transform: [{ scale: 0.99 }] }]}>
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
  const [selec, setSelec] = useState<any>(null);
  const { defilY, onScroll } = useHeroDefilant();

  // Feuille de filtres — mêmes filtres que la barre latérale du site
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [paysSel, setPaysSel] = useState<string[]>([]);
  const [secteursSel, setSecteursSel] = useState<string[]>([]);
  const [branchesSel, setBranchesSel] = useState<string[]>([]);
  const [activitesSel, setActivitesSel] = useState<string[]>([]);
  const { arbre } = useNaemaArbre();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["evenements"], queryFn: () => fetchTous("/evenements"),
  });

  // Pays hôtes présents dans les données (tri français)
  const paysOptions = useMemo(() =>
    ([...new Set((data || []).map((e: any) => e.pays_hote_nom).filter(Boolean))] as string[])
      .sort((a, b) => a.localeCompare(b, "fr")),
  [data]);

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
    // Prédicats de la barre latérale du site (matching par noms)
    if (paysSel.length) liste = liste.filter((e: any) => paysSel.includes(e.pays_hote_nom || ""));
    if (secteursSel.length) liste = liste.filter((e: any) => secteursSel.some(s => (e.secteur_noms || []).includes(s)));
    if (branchesSel.length) liste = liste.filter((e: any) => branchesSel.some(b => (e.branche_noms || []).includes(b)));
    if (activitesSel.length) liste = liste.filter((e: any) => activitesSel.some(a => (e.activite_noms || []).includes(a)));
    // Tri chronologique décroissant (frise du site) ; les sans-date à la fin
    return [...liste].sort((a: any, b: any) => {
      const da = dateDe(a), db = dateDe(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db.getTime() - da.getTime();
    });
  }, [data, q, statut, paysSel, secteursSel, branchesSel, activitesSel]);

  const nbFiltres = paysSel.length + secteursSel.length + branchesSel.length + activitesSel.length;
  const reinitFiltres = () => { setPaysSel([]); setSecteursSel([]); setBranchesSel([]); setActivitesSel([]); };
  const boutonFiltres = { icone: "filter_list", onPress: () => setFiltresOuverts(true), badge: nbFiltres || undefined };

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
        segments={{ options: STATUTS, valeur: statut, onChange: setStatut }}
        bouton={boutonFiltres} />
      {!isLoading && !isError && (
        <Text style={s.compte}>{filtres.length} événement{filtres.length > 1 ? "s" : ""}</Text>
      )}
    </>
  );

  const vide = isLoading ? <SqueletteListe />
    : isError ? (
      <EtatErreur onRetry={() => refetch()} />
    ) : (
      <EtatVide texte="Aucun événement ne correspond à ces filtres." />
    );

  return (
    <>
      <Animated.SectionList
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ backgroundColor: T.fond }}
        sections={isLoading || isError ? [] : sections}
        keyExtractor={(e: any) => String(e.id)}
        renderItem={({ item, index, section }: any) => {
          const st = statutEvenement(item);
          const pointC = item.id === prochainId ? T.bleu : st === "en_cours" ? T.vert : st === "a_venir" ? T.bleu : "#C9D4DF";
          const dernier = index === section.data.length - 1;
          return (
            <Apparition index={Math.min(index, 8)} style={s.rangee}>
              {/* Rail chronologique */}
              <View style={s.rail}>
                <View style={[s.railLigne, index === 0 && { top: 22 }, dernier && { bottom: undefined, height: 22 }]} />
                <View style={[s.railPoint, { borderColor: pointC }]}>
                  <View style={[s.railPointCoeur, { backgroundColor: pointC }]} />
                </View>
              </View>
              <View style={{ flex: 1, marginBottom: 12 }}>
                <CarteEvenement e={item} prochainId={prochainId} onPress={() => setSelec(item)} />
              </View>
            </Apparition>
          );
        }}
        renderSectionHeader={({ section }: any) => (
          <View style={s.annee}>
            <View style={s.anneePastille}><Text style={s.anneeTexte}>{section.title}</Text></View>
            <View style={s.anneeFilet} />
            <Text style={s.anneeCompte}>{section.data.length}</Text>
          </View>
        )}
        contentContainerStyle={s.liste}
        stickySectionHeadersEnabled={false}
        refreshing={isRefetching}
        onRefresh={refetch}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={hero}
        ListEmptyComponent={vide}
      />
      <BarreHero titre="Événements" defilY={defilY} bouton={boutonFiltres} />
      {selec && <EvenementSheet ev={selec} onClose={() => setSelec(null)} />}
      {filtresOuverts && (
        <FeuilleFiltres onClose={() => setFiltresOuverts(false)} onReinitialiser={reinitFiltres}>
          <SectionCoches titre="Pays hôte" options={paysOptions} sel={paysSel}
            onBascule={v => setPaysSel(p => basculer(p, v))} />
          <CascadeThema secteurs={arbre}
            secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel}
            onSecteur={v => setSecteursSel(p => basculer(p, v))}
            onBranche={v => setBranchesSel(p => basculer(p, v))}
            onActivite={v => setActivitesSel(p => basculer(p, v))} />
        </FeuilleFiltres>
      )}
    </>
  );
}

const s = StyleSheet.create({
  liste: { paddingBottom: 40 },
  rangee: { paddingLeft: 12, paddingRight: 16, flexDirection: "row" },
  compte: { fontSize: 11, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1, textTransform: "uppercase", marginTop: 14, marginBottom: 8, paddingHorizontal: 16 },
  annee: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, marginTop: 8, marginBottom: 12 },
  anneePastille: { backgroundColor: T.bleuVoile, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  anneeTexte: { fontSize: 14, fontFamily: POLICE.gras, color: T.bleu, fontVariant: ["tabular-nums"], letterSpacing: 0.5 },
  anneeFilet: { flex: 1, height: 1, backgroundColor: "#E4E1DE" },
  anneeCompte: { fontSize: 11, fontFamily: POLICE.gras, color: T.grisClair, fontVariant: ["tabular-nums"] },
  rail: { width: 26, alignItems: "center" },
  railLigne: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: "rgba(0,30,60,0.09)", borderRadius: 1 },
  railPoint: {
    marginTop: 16, width: 13, height: 13, borderRadius: 7, borderWidth: 2,
    backgroundColor: T.fond, alignItems: "center", justifyContent: "center",
  },
  railPointCoeur: { width: 5, height: 5, borderRadius: 3 },
  carte: {
    backgroundColor: T.carte, borderRadius: 16, borderWidth: 1, borderColor: T.bordure, overflow: "hidden",
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
