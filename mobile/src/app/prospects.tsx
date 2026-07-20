// Prospects — adaptation fidèle de la page web : vues Ciblés / En
// contact / Transformés dans le hero, recherche, cards du gabarit de
// l'app (dénomination, ancienneté contextuelle, badge de statut pastel,
// rangée Pays | info contextuelle), fiche ProspectSheet.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Animated, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ListeRapide } from "@/components/ListeRapide";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, EtatErreur, EtatVide } from "@/components/ui";
import { FeuilleFiltres, SectionCoches, basculer } from "@/components/FiltresListe";
import HeroModule, { BarreHero, useHeroDefilant } from "@/components/HeroModule";
import ProspectSheet, { OngletProspect, PROSPECT_PASTELS, badgeProspect, ilYa } from "@/components/ProspectSheet";
import { fetchTous } from "@/lib/api";
import { foncerPastel } from "@/lib/couleurs";
import { fmtDate } from "@/lib/format";
import { fmtPhone } from "@/lib/telephone";
import { POLICE, T } from "@/theme";

const VUES = [
  { cle: "cibles",     label: "Ciblés" },
  { cle: "historique", label: "En contact" },
  { cle: "termines",   label: "Transformés" },
] as const;

// Sous-titre relatif de la card (règles du site)
function sousTitreDe(p: any, onglet: OngletProspect): string | null {
  if (onglet === "cibles" && p.created_at) {
    const r = ilYa(p.created_at);
    if (!r) return p.siege_nom || null;
    return r === "Aujourd'hui" ? "Ciblé aujourd'hui" : `Ciblé depuis ${r.replace("Il y a ", "")}`;
  }
  if (onglet === "historique") return ilYa(p.date_dernier_echange) ?? p.siege_nom ?? null;
  if (onglet === "termines" && p.issue_conclu_le) {
    const r = ilYa(p.issue_conclu_le);
    if (!r) return p.siege_nom || null;
    const suffixe = r === "Aujourd'hui" ? "aujourd'hui" : r.replace("Il y a", "il y a");
    return `${p.issue === "decline" ? "Décliné" : "Conclu"} ${suffixe}`;
  }
  return p.siege_nom || null;
}

// Second bloc de la rangée basse, contextuel selon l'onglet (règles du site)
function info2De(p: any, onglet: OngletProspect): { label: string; valeur: string | null } {
  if (onglet === "cibles") {
    const tel = p.telephones?.[0] || p.points_focaux?.[0]?.telephones?.[0] || "";
    return { label: "TÉLÉPHONE", valeur: tel ? fmtPhone(tel) : null };
  }
  if (onglet === "historique") {
    return { label: "DERNIER ÉCHANGE", valeur: p.date_dernier_echange ? fmtDate(p.date_dernier_echange) : null };
  }
  if (p.issue === "installe") return { label: "ACCORD CONCLU", valeur: p.issue_conclu_le ? fmtDate(p.issue_conclu_le.slice(0, 10)) : null };
  if (p.issue === "decline") return { label: "DÉCLINÉ LE", valeur: p.issue_conclu_le ? fmtDate(p.issue_conclu_le.slice(0, 10)) : null };
  return { label: "CONCLUSION", valeur: null };
}

function CarteProspect({ p, onglet, onPress }: { p: any; onglet: OngletProspect; onPress: () => void }) {
  const badge = onglet !== "cibles" ? badgeProspect(p) : null;
  const pastel = badge ? PROSPECT_PASTELS[badge.label] || "#C5BFBB" : null;
  const sousTitre = sousTitreDe(p, onglet);
  const info2 = info2De(p, onglet);
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => [s.carte, pressed && { transform: [{ scale: 0.99 }], borderColor: pastel || "rgba(0,79,145,0.33)" }]}>
      <View style={s.ligneTitre}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.titre} numberOfLines={1}>{p.nom}</Text>
          {sousTitre ? <Text style={s.sousTitre} numberOfLines={1}>{sousTitre}</Text> : null}
        </View>
        {badge && pastel && (
          <View style={[s.badge, { backgroundColor: `${pastel}40`, borderColor: `${pastel}90` }]}>
            <Text style={[s.badgeTexte, { color: foncerPastel(pastel) }]} numberOfLines={1}>{badge.label}</Text>
          </View>
        )}
      </View>
      <View style={s.bas}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.basLabel}>PAYS</Text>
          <Text style={[s.basVal, { color: p.siege_nom ? T.encre : T.grisClair }]} numberOfLines={1}>{p.siege_nom || "—"}</Text>
        </View>
        <View style={s.basSep} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.basLabel}>{info2.label}</Text>
          <Text style={[s.basVal, { color: info2.valeur ? T.encre : T.grisClair }]} numberOfLines={1}>{info2.valeur || "—"}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function Prospects() {
  const [vue, setVue] = useState<OngletProspect>("cibles");
  const [q, setQ] = useState("");
  const [selec, setSelec] = useState<any>(null);
  const { defilY, onScroll } = useHeroDefilant();

  const cibles = useQuery({ queryKey: ["prospects", "cibles"], queryFn: () => fetchTous("/prospects?conclu=false&contactes=false") });
  const contact = useQuery({ queryKey: ["prospects", "contact"], queryFn: () => fetchTous("/prospects?conclu=false&contactes=true") });
  const termines = useQuery({ queryKey: ["prospects", "termines"], queryFn: () => fetchTous("/prospects?conclu=true") });

  // Feuille de filtres — mêmes filtres que la barre latérale du site
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [paysSel, setPaysSel] = useState<string[]>([]);
  const [secteursSel, setSecteursSel] = useState<string[]>([]);

  // Options construites sur l'ensemble des trois listes (comme le site)
  const tousProspects = useMemo(() =>
    [...(cibles.data || []), ...(contact.data || []), ...(termines.data || [])],
  [cibles.data, contact.data, termines.data]);
  const paysOptions = useMemo(() =>
    ([...new Set(tousProspects.map((p: any) => p.siege_nom).filter(Boolean))] as string[])
      .sort((a, b) => a.localeCompare(b, "fr")),
  [tousProspects]);
  const secteurOptions = useMemo(() =>
    ([...new Set(tousProspects.flatMap((p: any) => p.secteur_noms || []).filter(Boolean))] as string[])
      .sort((a, b) => a.localeCompare(b, "fr")),
  [tousProspects]);

  const courante = vue === "cibles" ? cibles : vue === "historique" ? contact : termines;
  const filtres = useMemo(() => {
    let liste = courante.data || [];
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      liste = liste.filter((p: any) => (p.nom || "").toLowerCase().includes(t));
    }
    // Prédicats de la barre latérale du site
    if (paysSel.length) liste = liste.filter((p: any) => paysSel.includes(p.siege_nom || ""));
    if (secteursSel.length) liste = liste.filter((p: any) => secteursSel.some(s => (p.secteur_noms || []).includes(s)));
    return liste;
  }, [courante.data, q, paysSel, secteursSel]);

  const nbFiltres = paysSel.length + secteursSel.length;
  const reinitFiltres = () => { setPaysSel([]); setSecteursSel([]); };
  const boutonFiltres = { icone: "filter_list", onPress: () => setFiltresOuverts(true), badge: nbFiltres || undefined };

  const compteLabel = vue === "cibles"
    ? `${filtres.length} investisseur${filtres.length > 1 ? "s" : ""} ciblé${filtres.length > 1 ? "s" : ""}`
    : vue === "historique"
    ? `${filtres.length} investisseur${filtres.length > 1 ? "s" : ""} en contact`
    : `${filtres.length} investisseur${filtres.length > 1 ? "s" : ""} transformé${filtres.length > 1 ? "s" : ""}`;

  return (
    <>
      <ListeRapide
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ backgroundColor: T.fond }}
        data={courante.isLoading || courante.isError ? [] : filtres}
        keyExtractor={(p: any) => String(p.id)}
        renderItem={({ item, index }: any) => <Apparition index={index} style={s.rangee}><CarteProspect p={item} onglet={vue} onPress={() => setSelec(item)} /></Apparition>}
        contentContainerStyle={s.liste}
        refreshing={courante.isRefetching} onRefresh={courante.refetch}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <HeroModule titre="Prospects"
              recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
              segments={{ options: VUES, valeur: vue, onChange: v => setVue(v as OngletProspect) }}
              bouton={boutonFiltres} />
            {!courante.isLoading && !courante.isError && <Text style={s.compte}>{compteLabel.toUpperCase()}</Text>}
          </>
        }
        ListEmptyComponent={
          courante.isLoading ? <SqueletteListe />
          : courante.isError ? (
            <EtatErreur onRetry={() => courante.refetch()} />
          ) : (
            <EtatVide texte="Aucun prospect ne correspond." />
          )
        }
      />
      <BarreHero titre="Prospects" defilY={defilY} bouton={boutonFiltres} />
      {selec && <ProspectSheet prospect={selec} onglet={vue} onClose={() => setSelec(null)} />}
      {filtresOuverts && (
        <FeuilleFiltres onClose={() => setFiltresOuverts(false)} onReinitialiser={reinitFiltres}>
          <SectionCoches titre="Pays" options={paysOptions} sel={paysSel}
            onBascule={v => setPaysSel(p => basculer(p, v))} />
          <SectionCoches titre="Secteurs" options={secteurOptions} sel={secteursSel}
            onBascule={v => setSecteursSel(p => basculer(p, v))} />
        </FeuilleFiltres>
      )}
    </>
  );
}

const s = StyleSheet.create({
  liste: { paddingBottom: 40 },
  rangee: { paddingHorizontal: 16, marginBottom: 11 },
  compte: { fontSize: 11, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1, marginTop: 14, marginBottom: 8, paddingHorizontal: 16 },
  carte: {
    backgroundColor: T.carte, borderRadius: 16, borderWidth: 1, borderColor: T.bordure,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, gap: 13,
  },
  ligneTitre: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  titre: { fontSize: 15, fontFamily: POLICE.gras, color: T.encre, lineHeight: 20, letterSpacing: -0.2 },
  sousTitre: { fontSize: 11, fontFamily: POLICE.moyen, color: T.gris, marginTop: 3 },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 3, flexShrink: 1, maxWidth: 160 },
  badgeTexte: { fontSize: 10.5, fontFamily: POLICE.gras },
  bas: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: T.filet, paddingTop: 12 },
  basSep: { width: 1, alignSelf: "stretch", backgroundColor: T.filet, marginHorizontal: 18 },
  basLabel: { fontSize: 9, fontFamily: POLICE.gras, letterSpacing: 1.1, color: T.gris, marginBottom: 4 },
  basVal: { fontSize: 12.5, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
});
