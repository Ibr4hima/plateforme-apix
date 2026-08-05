// Prospects — le pipeline de prospection en trois lentilles : Ciblés /
// En contact / Transformés, en chips bleues à compteurs. Les compteurs
// suivent la recherche : on voit où se trouvent les résultats sans changer
// de chip.
//
// Cartes au gabarit de la plateforme (contour fin, sans ombre) : dénomination,
// ancienneté contextuelle, statut en badge de la maison — fond blanc, liseré
// et texte teintés par le sens —, rangée Pays | info contextuelle sous
// filets. Fiche ProspectSheet.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ListeRapide } from "@/components/ListeRapide";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, EtatErreur, EtatVide, Tapable } from "@/components/ui";
import EnTetePage from "@/components/EnTetePage";
import ProspectSheet, { OngletProspect, badgeProspect, couleurProspect, ilYa } from "@/components/ProspectSheet";
import { fetchTous } from "@/lib/api";
import { tick } from "@/lib/haptique";
import { fmtDate } from "@/lib/format";
import { fmtPhone } from "@/lib/telephone";
import { POLICE, T } from "@/theme";
import { useMargeBas } from "@/lib/marges";

// Les trois étapes du pipeline — chips colorées, libellés complets
const LENTILLES = [
  { cle: "cibles",     label: "Investisseurs ciblés",      couleur: "#004f91" },
  { cle: "historique", label: "Investisseurs en contact",  couleur: "#004f91" },
  { cle: "termines",   label: "Investisseurs transformés", couleur: "#004f91" },
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

// ── La carte de prospect — le gabarit de la plateforme ───────────────────────
function CarteProspect({ p, onglet, onPress }: { p: any; onglet: OngletProspect; onPress: () => void }) {
  const badge = onglet !== "cibles" ? badgeProspect(p) : null;
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
          {badge && (
            <View style={[s.badge, { borderColor: `${couleurProspect(badge.label)}3D` }]}>
              <Text style={[s.badgeTexte, { color: couleurProspect(badge.label) }]} numberOfLines={1}>{badge.label}</Text>
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
  const chipsRef = useRef<ScrollView>(null);
  const chipsPos = useRef<Record<string, { x: number; largeur: number }>>({});

  const cibles = useQuery({ queryKey: ["prospects", "cibles"], queryFn: () => fetchTous("/prospects?conclu=false&contactes=false") });
  const contact = useQuery({ queryKey: ["prospects", "contact"], queryFn: () => fetchTous("/prospects?conclu=false&contactes=true") });
  const termines = useQuery({ queryKey: ["prospects", "termines"], queryFn: () => fetchTous("/prospects?conclu=true") });

  // La recherche seule filtre les listes ; les compteurs des chips se
  // calculent sur la même base, pour chacune des trois
  const filtrer = (liste: any[]) => {
    if (!q.trim()) return liste;
    const t = q.trim().toLowerCase();
    return liste.filter((p: any) => (p.nom || "").toLowerCase().includes(t));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const parVue = useMemo(() => ({
    cibles: cibles.data ? filtrer(cibles.data) : null,
    historique: contact.data ? filtrer(contact.data) : null,
    termines: termines.data ? filtrer(termines.data) : null,
  }), [cibles.data, contact.data, termines.data, q]);

  const courante = vue === "cibles" ? cibles : vue === "historique" ? contact : termines;
  const filtres = parVue[vue] || [];
  const cap = width >= 700 ? { width: "100%" as const, maxWidth: 680, alignSelf: "center" as const } : null;

  return (
    <>
      <ListeRapide
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
          <>
            <EnTetePage titre="Prospects"
              recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }} />
            <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }} contentContainerStyle={[s.chipsRangee, cap]}>
              {LENTILLES.map(l => {
                const actif = vue === l.cle;
                const compte = parVue[l.cle]?.length;
                return (
                  <Pressable key={l.cle}
                    onLayout={ev => { const { x, width: la } = ev.nativeEvent.layout; chipsPos.current[l.cle] = { x, largeur: la }; }}
                    onPress={() => {
                      tick();
                      setVue(l.cle);
                      const p = chipsPos.current[l.cle];
                      if (p) chipsRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
                    }}
                    style={[s.chipFiltre, actif && { backgroundColor: `${l.couleur}14`, borderColor: `${l.couleur}66` }]}>
                    <Text style={[s.chipFiltreTexte, { color: l.couleur }, actif && { fontFamily: POLICE.gras }]}>{l.label}</Text>
                    {compte != null && (
                      <View style={[s.chipCompte, actif && { backgroundColor: `${l.couleur}18` }]}>
                        <Text style={[s.chipCompteTexte, { color: l.couleur }]}>{compte}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        }
        ListEmptyComponent={
          courante.isLoading ? <SqueletteListe />
          : courante.isError ? <EtatErreur onRetry={() => courante.refetch()} />
          : <EtatVide texte="Aucun prospect ne correspond." />
        }
      />
      {selec && <ProspectSheet prospect={selec} onglet={vue} onClose={() => setSelec(null)} />}
    </>
  );
}

const s = StyleSheet.create({
  rangee: { paddingHorizontal: 16, marginBottom: 10 },
  chipsRangee: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  chipFiltre: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 14, paddingVertical: 7.5, borderRadius: 999,
    backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure,
  },
  chipFiltreTexte: { fontSize: 12.5, fontFamily: POLICE.demi },
  chipCompte: { backgroundColor: T.fond, borderRadius: 999, minWidth: 21, paddingHorizontal: 6, paddingVertical: 1.5, alignItems: "center" },
  chipCompteTexte: { fontSize: 11, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  carte: {
    backgroundColor: T.carte, borderRadius: 18,
    borderWidth: 1, borderColor: T.carteBord,
  },
  carteCorps: { flex: 1, minWidth: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 3 },
  ligneTitre: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  titre: { fontSize: 15.5, fontFamily: POLICE.demi, color: T.encre, lineHeight: 20, letterSpacing: -0.2 },
  sousTitre: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  badge: {
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3.5, flexShrink: 1, maxWidth: 160,
    backgroundColor: "#fff", borderWidth: 1,
  },
  badgeTexte: { fontSize: 10.5, fontFamily: POLICE.gras },
  faits: { flexDirection: "row", alignItems: "center", marginTop: 11, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  faitSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure, marginHorizontal: 16 },
  faitLabel: { fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 1, color: T.gris, marginBottom: 3 },
  faitVal: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre, fontVariant: ["tabular-nums"] },
});
