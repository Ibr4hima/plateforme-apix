// Entreprises installées — adaptation fidèle de la page web : vues Liste /
// Vue territoriale dans le hero, cards du site (dénomination, forme
// juridique, badge pôle pastel, rangée Date de création | Région).
// La vue territoriale est une lecture par région : cards pastel avec
// compte, dépliables sur les entreprises de la région.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Animated, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ListeRapide } from "@/components/ListeRapide";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, EtatErreur, EtatVide } from "@/components/ui";
import { useNaemaArbre } from "@/components/ArbreNaema";
import EntrepriseSheet from "@/components/EntrepriseSheet";
import { CascadeGeo, CascadeThema, Coche, FeuilleFiltres, PlageAnnees, SectionCoches, TitreSection, basculer, construireArbreGeo } from "@/components/FiltresListe";
import HeroModule, { BarreHero, useHeroDefilant } from "@/components/HeroModule";
import { fetchTous } from "@/lib/api";
import { POLE_COULEURS, foncerPastel, normPole } from "@/lib/couleurs";
import { fmtDate } from "@/lib/format";
import { POLICE, T } from "@/theme";

const VUES = [
  { cle: "liste",      label: "Liste des entreprises" },
  { cle: "territoire", label: "Vue territoriale" },
] as const;

const formeCourte = (f?: string | null) => (f || "").replace(/\s*\([^)]*\)\s*$/, "");

function CarteEntreprise({ e, onPress }: { e: any; onPress: () => void }) {
  const cPole = (e.pole_territoire_nom && POLE_COULEURS[normPole(e.pole_territoire_nom)]) || "#C5BFBB";
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => [s.carte, pressed && { transform: [{ scale: 0.99 }], borderColor: cPole }]}>
      <View style={s.ligneTitre}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.titre} numberOfLines={1}>{e.nom}</Text>
          {e.forme_juridique ? <Text style={s.sousTitre} numberOfLines={1}>{formeCourte(e.forme_juridique)}</Text> : null}
        </View>
        {e.pole_territoire_nom && (
          <View style={[s.badge, { backgroundColor: `${cPole}40`, borderColor: `${cPole}90` }]}>
            <Text style={[s.badgeTexte, { color: foncerPastel(cPole) }]} numberOfLines={1}>{e.pole_territoire_nom}</Text>
          </View>
        )}
      </View>
      <View style={s.bas}>
        <View style={{ flex: 1 }}>
          <Text style={s.basLabel}>DATE DE CRÉATION</Text>
          <Text style={[s.basVal, { color: e.date_creation ? T.encre : T.grisClair }]}>{e.date_creation ? fmtDate(e.date_creation) : "—"}</Text>
        </View>
        <View style={s.basSep} />
        <View style={{ flex: 1 }}>
          <Text style={s.basLabel}>RÉGION</Text>
          <Text style={[s.basVal, { color: e.region_nom ? T.encre : T.grisClair }]} numberOfLines={1}>{e.region_nom || "—"}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function Entreprises() {
  const [q, setQ] = useState("");
  const [vue, setVue] = useState("liste");
  const [poleOuvert, setPoleOuvert] = useState<string | null>(null);
  const [selec, setSelec] = useState<any>(null);
  const { defilY, onScroll } = useHeroDefilant();
  useEffect(() => { defilY.setValue(0); }, [vue, defilY]);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["entreprises"], queryFn: () => fetchTous("/entreprises"),
  });

  // Feuille de filtres — mêmes filtres que la barre latérale du site
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [formesSel, setFormesSel] = useState<string[]>([]);
  const [secteursSel, setSecteursSel] = useState<string[]>([]);
  const [branchesSel, setBranchesSel] = useState<string[]>([]);
  const [activitesSel, setActivitesSel] = useState<string[]>([]);
  const [regionsSel, setRegionsSel] = useState<string[]>([]);
  const [deptsSel, setDeptsSel] = useState<string[]>([]);
  const [arrsSel, setArrsSel] = useState<string[]>([]);
  const [polesSel, setPolesSel] = useState<string[]>([]);
  // Période de création : 0 = borne non resserrée
  const [anneeDebut, setAnneeDebut] = useState(0);
  const [anneeFin, setAnneeFin] = useState(0);
  const { secteurs, branches, activites, arbre } = useNaemaArbre();

  // Options construites depuis les données
  const triFr = (a: string, b: string) => a.localeCompare(b, "fr");
  const formesOptions = useMemo(() =>
    ([...new Set((data || []).map((e: any) => e.forme_juridique).filter(Boolean))] as string[]).sort(triFr), [data]);
  const polesOptions = useMemo(() =>
    ([...new Set((data || []).map((e: any) => e.pole_territoire_nom).filter(Boolean))] as string[]).sort(triFr), [data]);
  const regionsArbre = useMemo(() => construireArbreGeo(data || []), [data]);
  const bornesAnnees = useMemo<[number, number]>(() => {
    const annees = (data || []).map((e: any) => parseInt((e.date_creation || "").split("-")[0], 10)).filter((y: number) => !isNaN(y));
    return annees.length ? [Math.min(...annees), Math.max(...annees)] : [0, 0];
  }, [data]);
  const debutEff = anneeDebut || bornesAnnees[0];
  const finEff = anneeFin || bornesAnnees[1];
  const plageActive = bornesAnnees[0] < bornesAnnees[1] && (debutEff > bornesAnnees[0] || finEff < bornesAnnees[1]);

  const filtres = useMemo(() => {
    let liste = data || [];
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      liste = liste.filter((e: any) =>
        (e.nom || "").toLowerCase().includes(t) ||
        (e.region_nom || "").toLowerCase().includes(t) ||
        (e.pole_territoire_nom || "").toLowerCase().includes(t));
    }
    // Prédicats de la barre latérale du site
    if (formesSel.length) liste = liste.filter((e: any) => formesSel.includes(e.forme_juridique || ""));
    if (secteursSel.length) {
      const ids = secteursSel.map(n => secteurs.find((x: any) => x.nom === n)?.id).filter(Boolean);
      liste = liste.filter((e: any) => ids.some((id: any) => (e.secteur_ids || []).includes(id)));
    }
    if (branchesSel.length) {
      const ids = branchesSel.map(n => branches.find((x: any) => x.nom === n)?.id).filter(Boolean);
      liste = liste.filter((e: any) => ids.some((id: any) => (e.branche_ids || []).includes(id)));
    }
    if (activitesSel.length) {
      const ids = activitesSel.map(n => activites.find((x: any) => x.nom === n)?.id).filter(Boolean);
      liste = liste.filter((e: any) => ids.some((id: any) => (e.activite_ids || []).includes(id)));
    }
    if (regionsSel.length) liste = liste.filter((e: any) => regionsSel.includes(e.region_nom || ""));
    if (deptsSel.length) liste = liste.filter((e: any) => deptsSel.includes(e.departement_nom || ""));
    if (arrsSel.length) liste = liste.filter((e: any) => arrsSel.includes(e.arrondissement_nom || ""));
    if (polesSel.length) liste = liste.filter((e: any) => polesSel.includes(e.pole_territoire_nom || ""));
    if (plageActive) liste = liste.filter((e: any) => {
      if (!e.date_creation) return true;
      const y = parseInt(e.date_creation.split("-")[0], 10);
      return isNaN(y) || (y >= debutEff && y <= finEff);
    });
    return [...liste].sort((a: any, b: any) => (a.nom || "").localeCompare(b.nom || "", "fr"));
  }, [data, q, formesSel, secteursSel, branchesSel, activitesSel, regionsSel, deptsSel, arrsSel, polesSel, plageActive, debutEff, finEff, secteurs, branches, activites]);

  const nbFiltres = formesSel.length + secteursSel.length + branchesSel.length + activitesSel.length +
    regionsSel.length + deptsSel.length + arrsSel.length + polesSel.length + (plageActive ? 1 : 0);
  const reinitFiltres = () => {
    setFormesSel([]); setSecteursSel([]); setBranchesSel([]); setActivitesSel([]);
    setRegionsSel([]); setDeptsSel([]); setArrsSel([]); setPolesSel([]);
    setAnneeDebut(0); setAnneeFin(0);
  };
  const boutonFiltres = { icone: "filter_list", onPress: () => setFiltresOuverts(true), badge: nbFiltres || undefined };

  // Toggles en cascade du site : secteur remet branches + activités, région remet depts + arrs…
  const surSecteur = (v: string) => { setSecteursSel(p => basculer(p, v)); setBranchesSel([]); setActivitesSel([]); };
  const surBranche = (v: string) => { setBranchesSel(p => basculer(p, v)); setActivitesSel([]); };
  const surRegion = (v: string) => { setRegionsSel(p => basculer(p, v)); setDeptsSel([]); setArrsSel([]); };
  const surDept = (v: string) => { setDeptsSel(p => basculer(p, v)); setArrsSel([]); };

  // Vue territoriale : groupes par région (pastel stable par région)
  const PASTELS = Object.values(POLE_COULEURS);
  const poles = useMemo(() => {
    const groupes = new Map<string, any[]>();
    for (const e of filtres) {
      const cle = e.region_nom || "Sans région";
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle)!.push(e);
    }
    return Array.from(groupes.entries())
      .map(([nom, entreprises]) => ({ nom, entreprises }))
      .sort((a, b) => b.entreprises.length - a.entreprises.length || a.nom.localeCompare(b.nom, "fr"))
      .map((g, i) => ({ ...g, couleur: PASTELS[i % PASTELS.length] }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtres]);

  const hero = (
    <>
      <HeroModule titre="Entreprises installées"
        recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
        segments={{ options: VUES, valeur: vue, onChange: v => { setVue(v); setPoleOuvert(null); } }}
        bouton={boutonFiltres} />
      {!isLoading && !isError && (
        <Text style={s.compte}>
          {vue === "liste"
            ? `${filtres.length} entreprise${filtres.length > 1 ? "s" : ""}`
            : `${poles.length} région${poles.length > 1 ? "s" : ""} · ${filtres.length} entreprise${filtres.length > 1 ? "s" : ""}`}
        </Text>
      )}
    </>
  );

  const vide = isLoading ? <SqueletteListe />
    : isError ? (
      <EtatErreur onRetry={() => refetch()} />
    ) : (
      <EtatVide texte="Aucune entreprise ne correspond." />
    );

  return (
    <>
      {vue === "liste" ? (
        <ListeRapide
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={{ backgroundColor: T.fond }}
          data={isLoading || isError ? [] : filtres}
          keyExtractor={(e: any) => String(e.id)}
          renderItem={({ item, index }: any) => <Apparition index={index} style={s.rangee}><CarteEntreprise e={item} onPress={() => setSelec(item)} /></Apparition>}
          contentContainerStyle={s.liste}
          refreshing={isRefetching} onRefresh={refetch}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={hero}
          ListEmptyComponent={vide}
        />
      ) : (
        <ListeRapide
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={{ backgroundColor: T.fond }}
          data={isLoading || isError ? [] : poles}
          keyExtractor={(p: any) => p.nom}
          renderItem={({ item: p }: any) => {
            const ouvert = poleOuvert === p.nom;
            return (
              <View style={s.rangee}>
                <Pressable onPress={() => setPoleOuvert(ouvert ? null : p.nom)}
                  style={({ pressed }) => [s.pole, { borderColor: ouvert ? p.couleur : T.bordure }, pressed && { transform: [{ scale: 0.99 }] }]}>
                  <View style={[s.poleTuile, { backgroundColor: `${p.couleur}40`, borderColor: `${p.couleur}90` }]}>
                    <Text style={[s.poleCompte, { color: foncerPastel(p.couleur) }]}>{p.entreprises.length}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.poleNom} numberOfLines={1}>{p.nom}</Text>
                    <Text style={s.poleSous}>{p.entreprises.length} entreprise{p.entreprises.length > 1 ? "s" : ""}</Text>
                  </View>
                  <Ionicons name={ouvert ? "chevron-up" : "chevron-down"} size={15} color={T.grisClair} />
                </Pressable>
                {ouvert && (
                  <View style={s.poleListe}>
                    {p.entreprises.map((e: any, i: number) => (
                      <Pressable key={e.id} onPress={() => setSelec(e)}
                        style={({ pressed }) => [s.poleEntreprise, i > 0 && s.poleEntrepriseBord, pressed && { backgroundColor: T.blocFond }]}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.poleEntNom} numberOfLines={1}>{e.nom}</Text>
                          <Text style={s.poleEntSous} numberOfLines={1}>
                            {[formeCourte(e.forme_juridique), e.pole_territoire_nom].filter(Boolean).join(" · ") || "—"}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={13} color={T.grisClair} />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
          contentContainerStyle={s.liste}
          refreshing={isRefetching} onRefresh={refetch}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={hero}
          ListEmptyComponent={vide}
        />
      )}
      <BarreHero titre="Entreprises installées" defilY={defilY} bouton={boutonFiltres} />
      {selec && <EntrepriseSheet entreprise={selec} onClose={() => setSelec(null)} />}
      {filtresOuverts && (
        <FeuilleFiltres onClose={() => setFiltresOuverts(false)} onReinitialiser={reinitFiltres}>
          {/* Forme juridique : libellé sans le suffixe entre parenthèses, matching sur la valeur brute */}
          <View>
            <TitreSection titre="Forme juridique" nb={formesSel.length} />
            {formesOptions.map(f => (
              <Coche key={f} label={formeCourte(f)} sel={formesSel.includes(f)}
                onPress={() => setFormesSel(p => basculer(p, f))} />
            ))}
          </View>
          {bornesAnnees[0] < bornesAnnees[1] && (
            <PlageAnnees key={`${debutEff}-${finEff}`} titre="Période de création"
              min={bornesAnnees[0]} max={bornesAnnees[1]} debut={debutEff} fin={finEff}
              onChange={(d, f) => { setAnneeDebut(d); setAnneeFin(f); }} />
          )}
          <CascadeThema secteurs={arbre}
            secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel}
            onSecteur={surSecteur} onBranche={surBranche}
            onActivite={v => setActivitesSel(p => basculer(p, v))} />
          <CascadeGeo regions={regionsArbre}
            regionsSel={regionsSel} deptsSel={deptsSel} arrsSel={arrsSel}
            onRegion={surRegion} onDept={surDept}
            onArr={v => setArrsSel(p => basculer(p, v))} />
          {polesOptions.length > 0 && (
            <SectionCoches titre="Pôle territoire" options={polesOptions} sel={polesSel}
              onBascule={v => setPolesSel(p => basculer(p, v))} />
          )}
        </FeuilleFiltres>
      )}
    </>
  );
}

const s = StyleSheet.create({
  liste: { paddingBottom: 40 },
  rangee: { paddingHorizontal: 16, marginBottom: 11 },
  compte: { fontSize: 11, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1, textTransform: "uppercase", marginTop: 14, marginBottom: 8, paddingHorizontal: 16 },
  carte: {
    backgroundColor: T.carte, borderRadius: 16, borderWidth: 1, borderColor: T.bordure,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, gap: 13,
  },
  ligneTitre: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  titre: { fontSize: 15, fontFamily: POLICE.gras, color: T.encre, lineHeight: 20, letterSpacing: -0.2 },
  sousTitre: { fontSize: 11, fontFamily: POLICE.moyen, color: T.gris, marginTop: 3 },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 3, flexShrink: 1, maxWidth: 150 },
  badgeTexte: { fontSize: 10.5, fontFamily: POLICE.gras },
  bas: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: T.filet, paddingTop: 12 },
  basSep: { width: 1, alignSelf: "stretch", backgroundColor: T.filet, marginHorizontal: 18 },
  basLabel: { fontSize: 9, fontFamily: POLICE.gras, letterSpacing: 1.1, color: T.gris, marginBottom: 4 },
  basVal: { fontSize: 12.5, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  pole: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.carte, borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 15, paddingVertical: 13,
  },
  poleTuile: { width: 46, height: 46, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  poleCompte: { fontSize: 17, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  poleNom: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre },
  poleSous: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  poleListe: {
    backgroundColor: T.carte, borderRadius: 16, borderWidth: 1, borderColor: T.bordure,
    marginTop: 8, overflow: "hidden",
  },
  poleEntreprise: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 11.5 },
  poleEntrepriseBord: { borderTopWidth: 1, borderTopColor: T.filet },
  poleEntNom: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre },
  poleEntSous: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
});
