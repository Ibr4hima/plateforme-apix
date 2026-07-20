// Accords & Traités — adaptation fidèle de la page web : onglets TBI /
// Traités internationaux (bientôt), recherche, filtres statut + pays
// signataires, cards identiques au site (badge pastel, ancienneté,
// rangée de dates), tri par échéance d'expiration.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Animated, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ListeRapide } from "@/components/ListeRapide";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, EtatErreur, EtatVide } from "@/components/ui";
import AccordSheet, { ST_PASTEL, sousTitreStatut } from "@/components/AccordSheet";
import { useNaemaArbre } from "@/components/ArbreNaema";
import { CascadeThema, Coche, FeuilleFiltres, SectionCoches, TitreSection, basculer } from "@/components/FiltresListe";
import HeroModule, { BarreHero, useHeroDefilant } from "@/components/HeroModule";
import Symbole from "@/components/Symbole";
import { fetchTous, getJson } from "@/lib/api";
import { foncerPastel } from "@/lib/couleurs";
import { fmtDate } from "@/lib/format";
import { computeStatutAccord } from "@/lib/statuts";
import { tick } from "@/lib/haptique";
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

  // Feuille de filtres — mêmes filtres que la barre latérale du site
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [apixSel, setApixSel] = useState(false);
  const [paysSel, setPaysSel] = useState<string[]>([]);
  const [secteursSel, setSecteursSel] = useState<string[]>([]);
  const [branchesSel, setBranchesSel] = useState<string[]>([]);
  const [activitesSel, setActivitesSel] = useState<string[]>([]);
  const { secteurs, branches, activites, arbre } = useNaemaArbre();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["accords"], queryFn: () => fetchTous("/accords"),
  });
  // Référentiel pays (même source et même cache que la fiche accord)
  const pays = useQuery({ queryKey: ["ref-pays-stat"], queryFn: () => getJson<any[]>("/statistiques/pays"), staleTime: Infinity, gcTime: 24 * 3600 * 1000 });

  // Pays signataires présents dans au moins un accord (tri français)
  const paysOptions = useMemo(() => {
    const utilises = new Set<number>();
    (data || []).forEach((a: any) => (a.parties_pays_ids || []).forEach((id: number) => utilises.add(id)));
    return (pays.data || []).filter((p: any) => utilises.has(p.id))
      .map((p: any) => p.nom as string).sort((a, b) => a.localeCompare(b, "fr"));
  }, [data, pays.data]);

  const filtres = useMemo(() => {
    let liste = (data || []).filter((a: any) => (a.type_accord || "tbi") === "tbi");
    if (statut !== "tous") liste = liste.filter((a: any) => computeStatutAccord(a) === statut);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      liste = liste.filter((a: any) => (a.titre || "").toLowerCase().includes(t) || (a.reference || "").toLowerCase().includes(t));
    }
    // Parties signataires — OR logique entre pays sélectionnés et APIX (règle du site)
    if (paysSel.length || apixSel) {
      const paysIds = paysSel.map(n => (pays.data || []).find((p: any) => p.nom === n)?.id).filter(Boolean);
      liste = liste.filter((a: any) =>
        paysIds.some((id: any) => (a.parties_pays_ids || []).includes(id)) ||
        (apixSel && String(a.parties_signataires || "").toLowerCase().includes("apix")));
    }
    // Thématiques par ids (conversion noms → ids comme le site)
    if (secteursSel.length) {
      const ids = secteursSel.map(n => secteurs.find((x: any) => x.nom === n)?.id).filter(Boolean);
      liste = liste.filter((a: any) => ids.some((id: any) => (a.secteur_ids || []).includes(id)));
    }
    if (branchesSel.length) {
      const ids = branchesSel.map(n => branches.find((x: any) => x.nom === n)?.id).filter(Boolean);
      liste = liste.filter((a: any) => ids.some((id: any) => (a.branche_ids || []).includes(id)));
    }
    if (activitesSel.length) {
      const ids = activitesSel.map(n => activites.find((x: any) => x.nom === n)?.id).filter(Boolean);
      liste = liste.filter((a: any) => ids.some((id: any) => (a.activite_ids || []).includes(id)));
    }
    // Tri du site : échéance d'expiration croissante, sans expiration à la fin
    return [...liste].sort((a: any, b: any) => {
      if (!a.date_expiration && !b.date_expiration) return 0;
      if (!a.date_expiration) return 1;
      if (!b.date_expiration) return -1;
      return a.date_expiration.localeCompare(b.date_expiration);
    });
  }, [data, q, statut, paysSel, apixSel, secteursSel, branchesSel, activitesSel, pays.data, secteurs, branches, activites]);

  const nbFiltres = paysSel.length + (apixSel ? 1 : 0) + secteursSel.length + branchesSel.length + activitesSel.length;
  const reinitFiltres = () => { setApixSel(false); setPaysSel([]); setSecteursSel([]); setBranchesSel([]); setActivitesSel([]); };
  const boutonFiltres = { icone: "filter_list", onPress: () => setFiltresOuverts(true), badge: nbFiltres || undefined };

  // Toggles thématiques du site : secteur remet branches + activités, branche remet activités
  const surSecteur = (v: string) => { setSecteursSel(p => basculer(p, v)); setBranchesSel([]); setActivitesSel([]); };
  const surBranche = (v: string) => { setBranchesSel(p => basculer(p, v)); setActivitesSel([]); };

  const feuille = filtresOuverts && (
    <FeuilleFiltres onClose={() => setFiltresOuverts(false)} onReinitialiser={reinitFiltres}>
      <View>
        <TitreSection titre="Parties signataires" nb={paysSel.length + (apixSel ? 1 : 0)} />
        <Coche label="APIX S.A" sel={apixSel} onPress={() => setApixSel(a => !a)} />
      </View>
      <SectionCoches titre="Pays" options={paysOptions} sel={paysSel}
        onBascule={v => setPaysSel(p => basculer(p, v))} />
      <CascadeThema secteurs={arbre}
        secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel}
        onSecteur={surSecteur} onBranche={surBranche}
        onActivite={v => setActivitesSel(p => basculer(p, v))} />
    </FeuilleFiltres>
  );

  const hero = (
    <>
      <HeroModule titre="Accords & Traités"
        recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
        segments={{ options: STATUTS, valeur: statut, onChange: setStatut }}
        bouton={boutonFiltres} />
      {/* Types de traités — extensible */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.chipsRangee}>
        {TYPES.map(o => {
          const actif = onglet === o.cle;
          return (
            <Pressable key={o.cle} onPress={() => { tick(); setOnglet(o.cle); }} style={[s.chipFiltre, actif && s.chipFiltreActif]}>
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
        {feuille}
      </View>
    );
  }

  return (
    <>
      <ListeRapide
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ backgroundColor: T.fond }}
        data={isLoading || isError ? [] : filtres}
        keyExtractor={(a: any) => String(a.id)}
        renderItem={({ item, index }: any) => <Apparition index={index} style={s.rangee}><CarteAccord a={item} onPress={() => setSelec(item)} /></Apparition>}
        contentContainerStyle={s.liste}
        refreshing={isRefetching}
        onRefresh={refetch}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={hero}
        ListEmptyComponent={
          isLoading ? <SqueletteListe />
          : isError ? (
            <EtatErreur onRetry={() => refetch()} />
          ) : (
            <EtatVide texte="Aucun accord ne correspond à ces filtres." />
          )
        }
      />
      <BarreHero titre="Accords & Traités" defilY={defilY} bouton={boutonFiltres} />
      {selec && <AccordSheet accord={selec} onClose={() => setSelec(null)} />}
      {feuille}
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
