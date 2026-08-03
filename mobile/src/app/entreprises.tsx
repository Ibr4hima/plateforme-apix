// Entreprises installées — un annuaire.
//
// Sections alphabétiques que l'œil descend (l'idiome Contacts), cartes au
// gabarit de la plateforme (titre, forme juridique, rangée Création | Région,
// contour fin). La Vue régionale montre la FORME de chaque région — la
// silhouette extraite du fond de carte du site — avec effectif, part et
// accordéon d'entreprises.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Animated, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ListeRapide } from "@/components/ListeRapide";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, EtatErreur, EtatVide, Tapable } from "@/components/ui";
import { useNaemaArbre } from "@/components/ArbreNaema";
import EntrepriseSheet from "@/components/EntrepriseSheet";
import { CascadeGeo, CascadeThema, Coche, FeuilleFiltres, PlageAnnees, SectionCoches, TitreSection, basculer, construireArbreGeo } from "@/components/FiltresListe";
import EnTetePage from "@/components/EnTetePage";
import Icone from "@/components/Icone";
import SilhouetteRegion, { regionConnue } from "@/components/SilhouetteRegion";
import { fetchTous } from "@/lib/api";
import { POLE_COULEURS, foncerPastel, normPole } from "@/lib/couleurs";
import { fmtDate } from "@/lib/format";
import { tick } from "@/lib/haptique";
import { useMargeBas } from "@/lib/marges";
import { POLICE, T, TYPO } from "@/theme";

const formeCourte = (f?: string | null) => (f || "").replace(/\s*\([^)]*\)\s*$/, "");

// Monogramme : initiales des deux premiers mots, ou les deux premières lettres
function monogramme(nom: string): string {
  const mots = (nom || "").trim().split(/\s+/).filter(m => /[a-zA-ZÀ-ÿ0-9]/.test(m[0] || ""));
  if (mots.length >= 2) return (mots[0][0] + mots[1][0]).toUpperCase();
  return (nom || "?").slice(0, 2).toUpperCase();
}

// Lettre de classement, accents repliés — hors alphabet : «#»
function lettreDe(nom: string): string {
  const l = (nom || "").trim().charAt(0).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  return /[A-Z]/.test(l) ? l : "#";
}

// ── La carte d'entreprise — le gabarit des accords ───────────────────────────
function CarteEntreprise({ e, onPress }: { e: any; onPress: () => void }) {
  return (
    <Tapable onPress={onPress} echelle={0.985} style={s.carte}>
      <Text style={s.nom} numberOfLines={2}>{e.nom}</Text>
      {e.forme_juridique ? <Text style={s.sous} numberOfLines={1}>{formeCourte(e.forme_juridique)}</Text> : null}
      <View style={s.dates}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.dateLabel}>DATE DE CRÉATION</Text>
          <Text style={[s.dateVal, !e.date_creation && { color: T.grisClair }]} numberOfLines={1}>
            {e.date_creation ? fmtDate(e.date_creation) : "—"}
          </Text>
        </View>
        <View style={s.dateSep} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.dateLabel}>RÉGION</Text>
          <Text style={[s.dateVal, !e.region_nom && { color: T.grisClair }]} numberOfLines={1}>
            {e.region_nom || "—"}
          </Text>
        </View>
      </View>
    </Tapable>
  );
}

export default function Entreprises() {
  const margeBas = useMargeBas();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState("");
  const [vue, setVue] = useState("annuaire");
  const [regionOuverte, setRegionOuverte] = useState<string | null>(null);
  const [selec, setSelec] = useState<any>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["entreprises"], queryFn: () => fetchTous("/entreprises"),
  });

  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [formesSel, setFormesSel] = useState<string[]>([]);
  const [secteursSel, setSecteursSel] = useState<string[]>([]);
  const [branchesSel, setBranchesSel] = useState<string[]>([]);
  const [activitesSel, setActivitesSel] = useState<string[]>([]);
  const [regionsSel, setRegionsSel] = useState<string[]>([]);
  const [deptsSel, setDeptsSel] = useState<string[]>([]);
  const [arrsSel, setArrsSel] = useState<string[]>([]);
  const [polesSel, setPolesSel] = useState<string[]>([]);
  const [anneeDebut, setAnneeDebut] = useState(0);
  const [anneeFin, setAnneeFin] = useState(0);
  const { secteurs, branches, activites, arbre } = useNaemaArbre();

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

  // Annuaire : sections alphabétiques (l'idiome Contacts)
  const sections = useMemo(() => {
    const groupes = new Map<string, any[]>();
    for (const e of filtres) {
      const l = lettreDe(e.nom);
      if (!groupes.has(l)) groupes.set(l, []);
      groupes.get(l)!.push(e);
    }
    return Array.from(groupes.entries()).map(([titre, donnees]) => ({ title: titre, data: donnees }));
  }, [filtres]);

  // Par région : effectifs décroissants, part sur le total filtré.
  // La couleur d'une région est celle de SON PÔLE TERRITOIRE — la même
  // palette que la carte territoriale de la plateforme. Le pôle se lit dans
  // les entreprises de la région (pole_territoire_nom) : aucune requête de
  // plus, et la couleur reste stable quel que soit le tri.
  const regions = useMemo(() => {
    const groupes = new Map<string, any[]>();
    for (const e of filtres) {
      const cle = e.region_nom || "Sans région";
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle)!.push(e);
    }
    return Array.from(groupes.entries())
      .map(([nom, entreprises]) => {
        const pole = entreprises.find((e: any) => e.pole_territoire_nom)?.pole_territoire_nom;
        const pastel = (pole && POLE_COULEURS[normPole(pole)]) || "#9DC3E6";
        return { nom, entreprises, pastel };
      })
      .sort((a, b) => b.entreprises.length - a.entreprises.length || a.nom.localeCompare(b.nom, "fr"));
  }, [filtres]);

  const nbFiltres = formesSel.length + secteursSel.length + branchesSel.length + activitesSel.length +
    regionsSel.length + deptsSel.length + arrsSel.length + polesSel.length + (plageActive ? 1 : 0);
  const reinitFiltres = () => {
    setFormesSel([]); setSecteursSel([]); setBranchesSel([]); setActivitesSel([]);
    setRegionsSel([]); setDeptsSel([]); setArrsSel([]); setPolesSel([]);
    setAnneeDebut(0); setAnneeFin(0);
  };
  const boutonFiltres = { icone: "filter_list", onPress: () => setFiltresOuverts(true), badge: nbFiltres || undefined };

  const surSecteur = (v: string) => { setSecteursSel(p => basculer(p, v)); setBranchesSel([]); setActivitesSel([]); };
  const surBranche = (v: string) => { setBranchesSel(p => basculer(p, v)); setActivitesSel([]); };
  const surRegion = (v: string) => { setRegionsSel(p => basculer(p, v)); setDeptsSel([]); setArrsSel([]); };
  const surDept = (v: string) => { setDeptsSel(p => basculer(p, v)); setArrsSel([]); };

  const cap = width >= 700 ? { width: "100%" as const, maxWidth: 680, alignSelf: "center" as const } : null;
  const pret = !isLoading && !isError;

  const lentilles = [
    { cle: "annuaire", label: "Liste des entreprises", compte: pret ? filtres.length : undefined },
    { cle: "region",   label: "Vue régionale",         compte: pret ? regions.length : undefined },
  ];

  const hero = (
    <EnTetePage titre="Entreprises installées"
      recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
      segments={{ options: lentilles, valeur: vue, onChange: v => { setVue(v); setRegionOuverte(null); } }}
      bouton={boutonFiltres} />
  );

  const vide = isLoading ? <SqueletteListe />
    : isError ? <EtatErreur onRetry={() => refetch()} />
    : <EtatVide texte="Aucune entreprise ne correspond à ces filtres." />;

  const feuille = filtresOuverts && (
    <FeuilleFiltres onClose={() => setFiltresOuverts(false)} onReinitialiser={reinitFiltres}>
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
  );

  return (
    <>
      {vue === "annuaire" ? (
        <Animated.SectionList
          style={{ backgroundColor: T.fond }}
          sections={isLoading || isError ? [] : sections}
          keyExtractor={(e: any) => String(e.id)}
          renderItem={({ item, index }: any) => (
            <Apparition index={Math.min(index, 8)} style={[s.rangee, cap]}>
              <CarteEntreprise e={item} onPress={() => setSelec(item)} />
            </Apparition>
          )}
          renderSectionHeader={({ section }: any) => (
            <View style={[s.lettre, cap]}>
              <Text style={s.lettreTexte}>{section.title}</Text>
              <View style={s.lettreFilet} />
              <Text style={s.lettreCompte}>{section.data.length}</Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: margeBas }}
          stickySectionHeadersEnabled={false}
          refreshing={isRefetching} onRefresh={refetch}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={hero}
          ListEmptyComponent={vide}
        />
      ) : (
        <ListeRapide
          style={{ backgroundColor: T.fond }}
          data={isLoading || isError ? [] : regions}
          keyExtractor={(r: any) => r.nom}
          renderItem={({ item: r, index }: any) => {
            const ouvert = regionOuverte === r.nom;
            const part = filtres.length ? r.entreprises.length / filtres.length : 0;
            return (
              <Apparition index={Math.min(index, 8)} style={[s.rangee, cap]}>
                <Tapable onPress={() => { tick(); setRegionOuverte(ouvert ? null : r.nom); }} echelle={0.98}
                  style={[s.region, ouvert && { borderColor: T.bleu }]}>
                  {/* La forme réelle du territoire — un chiffre abstrait
                      n'identifie pas une région, sa silhouette si. Silhouette
                      dans la couleur de son pôle, tuile dans la même teinte
                      très diluée : les deux s'accordent. */}
                  <View style={[s.regionTuile, { backgroundColor: `${r.pastel}33` }]}>
                    {regionConnue(r.nom)
                      ? <SilhouetteRegion nom={r.nom} taille={38} couleur={foncerPastel(r.pastel)} />
                      : <Text style={[s.regionCompte, { color: foncerPastel(r.pastel) }]}>{r.entreprises.length}</Text>}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.regionNom} numberOfLines={1}>{r.nom}</Text>
                    <Text style={s.regionSous} numberOfLines={1}>
                      {r.entreprises.length} entreprise{r.entreprises.length > 1 ? "s" : ""} · {Math.round(part * 100)} %
                    </Text>
                  </View>
                  <Icone sf={ouvert ? "chevron.up" : "chevron.down"} materiel={ouvert ? "expand_less" : "expand_more"}
                    taille={16} couleur={T.grisClair} />
                </Tapable>
                {ouvert && (
                  <View style={s.regionListe}>
                    {r.entreprises.map((e: any, i: number) => (
                      <Tapable key={e.id} onPress={() => setSelec(e)} echelle={0.99}
                        style={[s.regionEntreprise, i > 0 && s.regionEntrepriseBord]}>
                        <View style={s.blocPetit}>
                          <Text style={s.blocPetitTexte}>{monogramme(e.nom)}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.regionEntNom} numberOfLines={1}>{e.nom}</Text>
                          <Text style={s.regionEntSous} numberOfLines={1}>
                            {[formeCourte(e.forme_juridique), e.pole_territoire_nom].filter(Boolean).join(" · ") || "—"}
                          </Text>
                        </View>
                      </Tapable>
                    ))}
                  </View>
                )}
              </Apparition>
            );
          }}
          contentContainerStyle={{ paddingBottom: margeBas }}
          ListHeaderComponentStyle={{ marginBottom: 14 }}
          refreshing={isRefetching} onRefresh={refetch}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={hero}
          ListEmptyComponent={vide}
        />
      )}
      {selec && <EntrepriseSheet entreprise={selec} onClose={() => setSelec(null)} />}
      {feuille}
    </>
  );
}

const s = StyleSheet.create({
  rangee: { paddingHorizontal: 16, marginBottom: 10 },
  // Sections alphabétiques — le même langage que les groupes par mois
  lettre: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginTop: 16, marginBottom: 10 },
  lettreTexte: { ...TYPO.micro, color: T.bleu },
  lettreFilet: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: T.bordure },
  lettreCompte: { fontSize: 11, fontFamily: POLICE.gras, color: T.grisClair, fontVariant: ["tabular-nums"] },

  carte: {
    backgroundColor: T.carte, borderRadius: 18,
    borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 3,
  },
  nom: { fontSize: 15.5, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2, lineHeight: 20 },
  sous: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris },
  dates: { flexDirection: "row", alignItems: "center", marginTop: 11, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  dateSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure, marginHorizontal: 16 },
  dateLabel: { fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 1, color: T.gris, marginBottom: 3 },
  dateVal: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre, fontVariant: ["tabular-nums"] },

  region: {
    flexDirection: "row", alignItems: "center", gap: 13,
    backgroundColor: T.carte, borderRadius: 18, padding: 12,
    borderWidth: 1, borderColor: T.carteBord,
  },
  regionTuile: { width: 48, height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  regionCompte: { fontSize: 17, fontFamily: POLICE.gras, color: T.bleu, fontVariant: ["tabular-nums"] },
  regionNom: { fontSize: 15, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2 },
  regionSous: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  regionListe: {
    backgroundColor: T.carte, borderRadius: 16, borderWidth: 1, borderColor: T.carteBord,
    marginTop: 8, overflow: "hidden",
  },
  regionEntreprise: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, paddingVertical: 10 },
  regionEntrepriseBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  blocPetit: {
    width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: T.bleuVoile,
  },
  blocPetitTexte: { fontSize: 12, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 0.4 },
  regionEntNom: { fontSize: 13.5, fontFamily: POLICE.demi, color: T.encre },
  regionEntSous: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 1.5 },
});
