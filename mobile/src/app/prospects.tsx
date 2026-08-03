// Prospects — le pipeline de prospection en trois lentilles : Ciblés /
// En contact / Transformés, en segments à compteurs (le pattern des
// Événements). Les compteurs suivent la recherche et les filtres : on voit
// où se trouvent les résultats sans changer de segment.
//
// Cartes au gabarit de la plateforme (contour fin, sans ombre) : dénomination,
// ancienneté contextuelle, statut en badge pastel doux, rangée Pays | info
// contextuelle sous filets. Fiche ProspectSheet.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ListeRapide } from "@/components/ListeRapide";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, EtatErreur, EtatVide, Tapable } from "@/components/ui";
import { FeuilleFiltres, SectionCoches, basculer } from "@/components/FiltresListe";
import HeroModule, { BarreHero, useHeroDefilant } from "@/components/HeroModule";
import ProspectSheet, { OngletProspect, PROSPECT_PASTELS, badgeProspect, ilYa } from "@/components/ProspectSheet";
import { fetchTous } from "@/lib/api";
import { foncerPastel } from "@/lib/couleurs";
import { fmtDate } from "@/lib/format";
import { fmtPhone } from "@/lib/telephone";
import { POLICE, T } from "@/theme";
import { useMargeBas } from "@/lib/marges";

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

// ── La carte de prospect — le gabarit de la plateforme ───────────────────────
function CarteProspect({ p, onglet, onPress }: { p: any; onglet: OngletProspect; onPress: () => void }) {
  const badge = onglet !== "cibles" ? badgeProspect(p) : null;
  const pastel = badge ? PROSPECT_PASTELS[badge.label] || "#C5BFBB" : null;
  const sousTitre = sousTitreDe(p, onglet);
  const info2 = info2De(p, onglet);
  return (
    <Tapable onPress={onPress} echelle={0.985} style={s.carte}>
      <View style={s.carteCorps}>
        <View style={s.ligneTitre}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.titre} numberOfLines={1}>{p.nom}</Text>
            {sousTitre ? <Text style={s.sousTitre} numberOfLines={1}>{sousTitre}</Text> : null}
          </View>
          {badge && pastel && (
            <View style={[s.badge, { backgroundColor: `${pastel}33` }]}>
              <Text style={[s.badgeTexte, { color: foncerPastel(pastel) }]} numberOfLines={1}>{badge.label}</Text>
            </View>
          )}
        </View>
        <View style={s.faits}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.faitLabel}>PAYS</Text>
            <Text style={[s.faitVal, !p.siege_nom && { color: T.grisClair }]} numberOfLines={1}>{p.siege_nom || "—"}</Text>
          </View>
          <View style={s.faitSep} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.faitLabel}>{info2.label}</Text>
            <Text style={[s.faitVal, !info2.valeur && { color: T.grisClair }]} numberOfLines={1}>{info2.valeur || "—"}</Text>
          </View>
        </View>
      </View>
    </Tapable>
  );
}

export default function Prospects() {
  const margeBas = useMargeBas();
  const { width } = useWindowDimensions();
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

  // Prédicats communs (recherche + feuille) — les compteurs des segments se
  // calculent sur cette base, pour chacune des trois listes
  const filtrer = (liste: any[]) => {
    let res = liste;
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      res = res.filter((p: any) => (p.nom || "").toLowerCase().includes(t));
    }
    if (paysSel.length) res = res.filter((p: any) => paysSel.includes(p.siege_nom || ""));
    if (secteursSel.length) res = res.filter((p: any) => secteursSel.some(sx => (p.secteur_noms || []).includes(sx)));
    return res;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const parVue = useMemo(() => ({
    cibles: cibles.data ? filtrer(cibles.data) : null,
    historique: contact.data ? filtrer(contact.data) : null,
    termines: termines.data ? filtrer(termines.data) : null,
  }), [cibles.data, contact.data, termines.data, q, paysSel, secteursSel]);

  const courante = vue === "cibles" ? cibles : vue === "historique" ? contact : termines;
  const filtres = parVue[vue] || [];

  const nbFiltres = paysSel.length + secteursSel.length;
  const reinitFiltres = () => { setPaysSel([]); setSecteursSel([]); };
  const boutonFiltres = { icone: "filter_list", onPress: () => setFiltresOuverts(true), badge: nbFiltres || undefined };
  const cap = width >= 700 ? { width: "100%" as const, maxWidth: 680, alignSelf: "center" as const } : null;

  const segments = [
    { cle: "cibles",     label: "Ciblés",      compte: parVue.cibles?.length },
    { cle: "historique", label: "En contact",  compte: parVue.historique?.length },
    { cle: "termines",   label: "Transformés", compte: parVue.termines?.length },
  ];

  return (
    <>
      <ListeRapide
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ backgroundColor: T.fond }}
        data={courante.isLoading || courante.isError ? [] : filtres}
        keyExtractor={(p: any) => String(p.id)}
        renderItem={({ item, index }: any) => (
          <Apparition index={Math.min(index, 8)} style={[s.rangee, cap]}>
            <CarteProspect p={item} onglet={vue} onPress={() => setSelec(item)} />
          </Apparition>
        )}
        contentContainerStyle={{ paddingBottom: margeBas }}
        ListHeaderComponentStyle={{ marginBottom: 14 }}
        refreshing={courante.isRefetching} onRefresh={courante.refetch}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <HeroModule retour titre="Prospects"
            recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
            segments={{ options: segments, valeur: vue, onChange: v => setVue(v as OngletProspect) }}
            bouton={boutonFiltres} />
        }
        ListEmptyComponent={
          courante.isLoading ? <SqueletteListe />
          : courante.isError ? <EtatErreur onRetry={() => courante.refetch()} />
          : <EtatVide texte="Aucun prospect ne correspond." />
        }
      />
      <BarreHero retour titre="Prospects" defilY={defilY} bouton={boutonFiltres} />
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
  rangee: { paddingHorizontal: 16, marginBottom: 10 },
  carte: {
    backgroundColor: T.carte, borderRadius: 18,
    borderWidth: 1, borderColor: T.carteBord,
  },
  carteCorps: { flex: 1, minWidth: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 3 },
  ligneTitre: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  titre: { fontSize: 15.5, fontFamily: POLICE.demi, color: T.encre, lineHeight: 20, letterSpacing: -0.2 },
  sousTitre: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3.5, flexShrink: 1, maxWidth: 160 },
  badgeTexte: { fontSize: 10.5, fontFamily: POLICE.gras },
  faits: { flexDirection: "row", alignItems: "center", marginTop: 11, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  faitSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure, marginHorizontal: 16 },
  faitLabel: { fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 1, color: T.gris, marginBottom: 3 },
  faitVal: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre, fontVariant: ["tabular-nums"] },
});
