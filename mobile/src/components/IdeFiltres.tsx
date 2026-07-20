// Filtres des Investissements Directs Étrangers — version app de la
// barre latérale du site. VUE (Pays / Secteurs) et TYPE D'ANALYSE
// dépendant de la vue (Pays : par pays / comparative / monde ;
// Secteurs : par secteur / comparative). Le sélecteur s'adapte :
// pays CNUCED (Sénégal référence), groupements mondiaux (continents,
// régions, groupements économiques, niveaux de revenu — 4 au plus) ou
// secteurs / branches CNUCED (« Global des secteurs », arbre secteur →
// branche). La période suit les bornes du contexte choisi.
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feuille } from "@/components/ui";
import { COMP_PALETTE } from "@/lib/couleurs";
import { succes, tick } from "@/lib/haptique";
import { POLICE, T } from "@/theme";

export const MAX_SEL_IDE = 4;

export type FiltresIde = {
  vue: "pays" | "secteurs";
  typeAnalyse: "pays" | "comparative" | "monde" | "secteur";
  paysSelection: number[];
  grpSelection: string[];
  secteurSelection: number[]; // 0 = Global des secteurs
  compNiveau?: "secteur" | "branche"; // niveau comparé en analyse comparative sectorielle
  modeAnnees: "plage" | "specifiques";
  anneeMin: number;
  anneeMax: number;
  anneesSpec: number[];
};

const CONT_ORDER = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];

function SecTitle({ children, droite }: { children: string; droite?: React.ReactNode }) {
  return (
    <View style={s.secLigne}>
      <Text style={s.secTitle}>{children.toUpperCase()}</Text>
      {droite}
    </View>
  );
}

export default function IdeFiltres({ pays, senId, groupements, refSecteurs, anneesPays, anneesSecteurs, valeurs, onAppliquer, onClose }: {
  pays: any[]; senId: number | null;
  groupements: { code: string; nom_fr: string; categorie: string }[];
  refSecteurs: any[];
  anneesPays: number[]; anneesSecteurs: number[];
  valeurs: FiltresIde;
  onAppliquer: (f: FiltresIde) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<FiltresIde>({
    ...valeurs,
    paysSelection: [...valeurs.paysSelection],
    grpSelection: [...valeurs.grpSelection],
    secteurSelection: [...valeurs.secteurSelection],
    anneesSpec: [...valeurs.anneesSpec],
  });
  const [qPays, setQPays] = useState("");
  const [qGrp, setQGrp] = useState("");
  const [contsOuverts, setContsOuverts] = useState<Set<string>>(new Set());
  const [regionsOuvertes, setRegionsOuvertes] = useState<Set<string>>(new Set());
  const [secteursOuverts, setSecteursOuverts] = useState<Set<number>>(new Set());

  const monde = f.typeAnalyse === "monde";
  const secteursVue = f.vue === "secteurs";
  const multiPays = f.vue === "pays" && f.typeAnalyse === "comparative";
  const multiSecteurs = secteursVue && f.typeAnalyse === "comparative";
  const anneesDispo = secteursVue ? anneesSecteurs : anneesPays;
  const bornes: [number, number] = anneesDispo.length ? [anneesDispo[0], anneesDispo[anneesDispo.length - 1]] : [f.anneeMin, f.anneeMax];

  const TYPES_ANALYSE = secteursVue
    ? [{ cle: "secteur", label: "Par secteur" }, { cle: "comparative", label: "Comparative" }] as const
    : [{ cle: "pays", label: "Par pays" }, { cle: "comparative", label: "Comparative" }, { cle: "monde", label: "Monde" }] as const;

  const changerVue = (vue: "pays" | "secteurs") => setF(prev => ({
    ...prev, vue,
    // Le type d'analyse repart sur le défaut de la vue (règle du site)
    typeAnalyse: vue === "secteurs" ? "secteur" : "pays",
    paysSelection: prev.paysSelection.slice(0, 1),
    secteurSelection: prev.secteurSelection.length ? prev.secteurSelection.slice(0, 1) : [0],
  }));
  const changerAnalyse = (typeAnalyse: FiltresIde["typeAnalyse"]) => setF(prev => ({
    ...prev, typeAnalyse,
    paysSelection: typeAnalyse === "comparative" ? prev.paysSelection : prev.paysSelection.slice(0, 1),
    // Comparative sectorielle : niveau Secteurs, les 3 grands secteurs par défaut (règle du site)
    compNiveau: prev.vue === "secteurs" && typeAnalyse === "comparative" ? "secteur" : prev.compNiveau,
    secteurSelection: prev.vue === "secteurs"
      ? (typeAnalyse === "comparative"
          ? (prev.secteurSelection.includes(0) ? [1, 2, 3] : prev.secteurSelection)
          : prev.secteurSelection.slice(0, 1))
      : prev.secteurSelection,
  }));
  // Niveau comparé (secteurs entre eux ou branches entre elles)
  const changerNiveau = (compNiveau: "secteur" | "branche") => setF(prev => ({
    ...prev, compNiveau,
    secteurSelection: compNiveau === "secteur" ? [1, 2, 3] : [],
  }));

  // ── Sélections ──
  const clicPays = (id: number) => setF(prev => {
    if (!multiPays) return { ...prev, paysSelection: [id] };
    if (prev.paysSelection.includes(id)) {
      return prev.paysSelection.length > 1 ? { ...prev, paysSelection: prev.paysSelection.filter(x => x !== id) } : prev;
    }
    if (prev.paysSelection.length >= MAX_SEL_IDE) return prev;
    return { ...prev, paysSelection: [...prev.paysSelection, id] };
  });
  const clicGrp = (code: string) => setF(prev => {
    if (prev.grpSelection.includes(code)) return { ...prev, grpSelection: prev.grpSelection.filter(c => c !== code) };
    if (prev.grpSelection.length >= MAX_SEL_IDE) return prev;
    return { ...prev, grpSelection: [...prev.grpSelection, code] };
  });
  const clicSecteur = (id: number) => setF(prev => {
    if (!multiSecteurs) return { ...prev, secteurSelection: [id] };
    if (prev.secteurSelection.includes(id)) {
      return prev.secteurSelection.length > 1 ? { ...prev, secteurSelection: prev.secteurSelection.filter(x => x !== id) } : prev;
    }
    if (prev.secteurSelection.length >= MAX_SEL_IDE) return prev;
    return { ...prev, secteurSelection: [...prev.secteurSelection, id] };
  });

  const reinitialiser = () => setF(prev => ({
    ...prev,
    vue: "pays", typeAnalyse: "pays",
    paysSelection: senId !== null ? [senId] : [],
    grpSelection: [],
    secteurSelection: [0],
    compNiveau: "secteur",
    modeAnnees: "plage", anneeMin: bornes[0], anneeMax: bornes[1], anneesSpec: [],
  }));

  // ── Pays groupés par continent ──
  const groupesPays = useMemo(() => {
    const t = qPays.trim().toLowerCase();
    const filtres = pays.filter((p: any) => p.id !== senId && (!t || p.nom.toLowerCase().includes(t)));
    const parCont = new Map<string, Map<string, any[]>>();
    for (const p of filtres) {
      const c = p.continent || "Autre", z = p.region_geo || "Autre";
      if (!parCont.has(c)) parCont.set(c, new Map());
      if (!parCont.get(c)!.has(z)) parCont.get(c)!.set(z, []);
      parCont.get(c)!.get(z)!.push(p);
    }
    return Array.from(parCont.entries())
      .map(([continent, zones]) => ({
        continent,
        zones: Array.from(zones.entries()).map(([zone, liste]) => ({
          zone, liste: liste.sort((a: any, b: any) => a.nom.localeCompare(b.nom, "fr")),
        })).sort((a, b) => a.zone.localeCompare(b.zone, "fr")),
      }))
      .sort((a, b) => {
        const ia = CONT_ORDER.indexOf(a.continent), ib = CONT_ORDER.indexOf(b.continent);
        if (ia === -1 && ib === -1) return a.continent.localeCompare(b.continent, "fr");
        if (ia === -1) return 1; if (ib === -1) return -1;
        return ia - ib;
      });
  }, [pays, qPays, senId]);

  // ── Groupements mondiaux par catégorie (règles du site) ──
  const qg = qGrp.trim().toLowerCase();
  const matchGrp = (g: any) => !qg || g.nom_fr.toLowerCase().includes(qg) || g.code.toLowerCase().includes(qg);
  const continents = groupements.filter(g => g.categorie === "continent");
  const grpEconomiques = groupements.filter(g => g.categorie === "groupe" && matchGrp(g));
  const grpRevenus = groupements.filter(g => g.categorie === "revenu" && matchGrp(g));
  const regionsDe = (cont: any) => groupements.filter(g => (g.categorie === cont.code || g.categorie === cont.nom_fr) && matchGrp(g));

  const couleurGrp = (code: string) => COMP_PALETTE[Math.max(0, f.grpSelection.indexOf(code)) % COMP_PALETTE.length];
  const couleurPaysDe = (id: number) => COMP_PALETTE[Math.max(0, f.paysSelection.indexOf(id)) % COMP_PALETTE.length];
  const secteurIds = new Set(refSecteurs.map((sx: any) => sx.id));
  const couleurSecteurDe = (id: number) => multiSecteurs
    ? COMP_PALETTE[Math.max(0, f.secteurSelection.indexOf(id)) % COMP_PALETTE.length]
    : (id !== 0 && !secteurIds.has(id) ? T.orange : T.bleu);

  const RangeSelection = ({ actif, desactive, couleur, nom, badge, indent, onPress }: {
    actif: boolean; desactive?: boolean; couleur: any; nom: string; badge?: string | null; indent?: boolean; onPress: () => void;
  }) => (
    <Pressable onPress={() => !desactive && onPress()}
      style={({ pressed }) => [s.ligne, indent && { paddingLeft: 26 }, pressed && { backgroundColor: T.champ }, desactive && { opacity: 0.4 }]}>
      <View style={[s.point, { borderColor: actif ? couleur : T.grisClair, backgroundColor: actif ? couleur : "transparent" }]} />
      <Text style={[s.ligneNom, actif && { fontFamily: POLICE.gras }]} numberOfLines={1}>{nom}</Text>
      {badge ? <View style={s.refBadge}><Text style={s.refBadgeTexte}>{badge}</Text></View> : null}
    </Pressable>
  );

  const AnneeChip = ({ a, actif, onPress }: { a: number; actif: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[s.anneeChip, actif && s.anneeChipActif]}>
      <Text style={[s.anneeChipTexte, actif && { color: "#fff" }]}>{a}</Text>
    </Pressable>
  );

  const basculer = (ens: Set<any>, cle: any, setter: (v: any) => void) => {
    const n = new Set(ens); n.has(cle) ? n.delete(cle) : n.add(cle); setter(n);
  };

  return (
    <Feuille onClose={onClose} titre="Filtres" hauteur="88%" ecart={22}
      pied={
        <View style={s.pied}>
          <Pressable onPress={() => { tick(); reinitialiser(); }} style={({ pressed }) => [s.boutonSecondaire, pressed && { backgroundColor: T.filet }]}>
            <Text style={s.boutonSecondaireTexte}>Réinitialiser</Text>
          </Pressable>
          <Pressable onPress={() => { succes(); onAppliquer(f); onClose(); }}
            style={({ pressed }) => [s.boutonPrincipal, pressed && { opacity: 0.85 }]}>
            <Text style={s.boutonPrincipalTexte}>Appliquer</Text>
          </Pressable>
        </View>
      }>
          {/* Vue */}
          <View>
            <SecTitle>Vue</SecTitle>
            <View style={s.segments}>
              {([["pays", "Pays"], ["secteurs", "Secteurs"]] as const).map(([cle, label]) => (
                <Pressable key={cle} onPress={() => changerVue(cle)} style={[s.segment, f.vue === cle && s.segmentActif]}>
                  <Text style={[s.segmentTexte, f.vue === cle && s.segmentTexteActif]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Type d'analyse (selon la vue) */}
          <View>
            <SecTitle>Type d'analyse</SecTitle>
            <View style={s.segments}>
              {TYPES_ANALYSE.map(o => (
                <Pressable key={o.cle} onPress={() => changerAnalyse(o.cle)} style={[s.segment, f.typeAnalyse === o.cle && s.segmentActif]}>
                  <Text style={[s.segmentTexte, f.typeAnalyse === o.cle && s.segmentTexteActif]} numberOfLines={1}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── Sélecteur selon le contexte ── */}
          {secteursVue ? (
            /* Secteurs / branches CNUCED */
            <View>
              <SecTitle droite={<Text style={s.compteBadge}>{multiSecteurs ? `${f.secteurSelection.length}/${MAX_SEL_IDE}` : "1"}</Text>}>Secteurs</SecTitle>
              {multiSecteurs ? (
                <>
                  {/* Niveau comparé : secteurs entre eux ou branches entre elles */}
                  <View style={[s.segments, { marginBottom: 10 }]}>
                    {([["secteur", "Secteurs"], ["branche", "Branches"]] as const).map(([cle, label]) => (
                      <Pressable key={cle} onPress={() => changerNiveau(cle)} style={[s.segment, (f.compNiveau ?? "secteur") === cle && s.segmentActif]}>
                        <Text style={[s.segmentTexte, (f.compNiveau ?? "secteur") === cle && s.segmentTexteActif]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={{ maxHeight: 300 }}>
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {(f.compNiveau ?? "secteur") === "secteur" ? (
                        refSecteurs.map((sec: any) => (
                          <RangeSelection key={sec.id} actif={f.secteurSelection.includes(sec.id)}
                            desactive={!f.secteurSelection.includes(sec.id) && f.secteurSelection.length >= MAX_SEL_IDE}
                            couleur={couleurSecteurDe(sec.id)} nom={sec.nom_fr} onPress={() => clicSecteur(sec.id)} />
                        ))
                      ) : (
                        refSecteurs.map((sec: any) => {
                          const ouvert = secteursOuverts.has(sec.id);
                          return (
                            <View key={sec.id}>
                              <Pressable onPress={() => basculer(secteursOuverts, sec.id, setSecteursOuverts)} style={s.continent}>
                                <Text style={s.continentTexte}>{sec.nom_fr.toUpperCase()}</Text>
                                <Ionicons name={ouvert ? "chevron-down" : "chevron-forward"} size={12} color={T.bleu} />
                              </Pressable>
                              {ouvert && (sec.branches || []).map((bra: any) => (
                                <RangeSelection key={bra.id} actif={f.secteurSelection.includes(bra.id)}
                                  desactive={!f.secteurSelection.includes(bra.id) && f.secteurSelection.length >= MAX_SEL_IDE}
                                  couleur={couleurSecteurDe(bra.id)} nom={bra.nom_fr} indent onPress={() => clicSecteur(bra.id)} />
                              ))}
                            </View>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
                </>
              ) : (
                <>
                  <RangeSelection actif={f.secteurSelection.includes(0)} couleur={couleurSecteurDe(0)}
                    nom="Global des secteurs" badge="Agrégat" onPress={() => clicSecteur(0)} />
                  <View style={s.filet} />
                  <View style={{ maxHeight: 300 }}>
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {refSecteurs.map((sec: any) => {
                        const ouvert = secteursOuverts.has(sec.id);
                        return (
                          <View key={sec.id}>
                            <View style={s.secteurLigne}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <RangeSelection actif={f.secteurSelection.includes(sec.id)}
                                  couleur={couleurSecteurDe(sec.id)} nom={sec.nom_fr} onPress={() => clicSecteur(sec.id)} />
                              </View>
                              {(sec.branches || []).length > 0 && (
                                <Pressable hitSlop={8} onPress={() => basculer(secteursOuverts, sec.id, setSecteursOuverts)} style={s.chevron}>
                                  <Ionicons name={ouvert ? "chevron-down" : "chevron-forward"} size={13} color={T.gris} />
                                </Pressable>
                              )}
                            </View>
                            {ouvert && (sec.branches || []).map((bra: any) => (
                              <RangeSelection key={bra.id} actif={f.secteurSelection.includes(bra.id)}
                                couleur={couleurSecteurDe(bra.id)} nom={bra.nom_fr} indent onPress={() => clicSecteur(bra.id)} />
                            ))}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                </>
              )}
            </View>
          ) : monde ? (
            /* Groupements mondiaux */
            <View>
              <SecTitle droite={<Text style={s.compteBadge}>{f.grpSelection.length}/{MAX_SEL_IDE}</Text>}>Groupements</SecTitle>
              <View style={s.recherche}>
                <Ionicons name="search" size={13} color={T.gris} />
                <TextInput value={qGrp} onChangeText={setQGrp} placeholder="Rechercher un groupement"
                  placeholderTextColor={T.gris} autoCorrect={false} clearButtonMode="while-editing" style={s.rechercheChamp} />
              </View>
              <View style={{ maxHeight: 320 }}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  <Text style={s.sousSection}>CONTINENTS & RÉGIONS</Text>
                  {continents.map(cont => {
                    const regions = regionsDe(cont);
                    const ouvert = contsOuverts.has(cont.code) || (!!qg && regions.length > 0);
                    const desactive = !f.grpSelection.includes(cont.code) && f.grpSelection.length >= MAX_SEL_IDE;
                    if (qg && !matchGrp(cont) && !regions.length) return null;
                    return (
                      <View key={cont.code}>
                        <View style={s.secteurLigne}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <RangeSelection actif={f.grpSelection.includes(cont.code)} desactive={desactive}
                              couleur={couleurGrp(cont.code)} nom={cont.nom_fr} onPress={() => clicGrp(cont.code)} />
                          </View>
                          {regionsDe(cont).length > 0 && (
                            <Pressable hitSlop={8} onPress={() => basculer(contsOuverts, cont.code, setContsOuverts)} style={s.chevron}>
                              <Ionicons name={ouvert ? "chevron-down" : "chevron-forward"} size={13} color={T.gris} />
                            </Pressable>
                          )}
                        </View>
                        {ouvert && regions.map(reg => (
                          <RangeSelection key={reg.code} actif={f.grpSelection.includes(reg.code)}
                            desactive={!f.grpSelection.includes(reg.code) && f.grpSelection.length >= MAX_SEL_IDE}
                            couleur={couleurGrp(reg.code)} nom={reg.nom_fr} indent onPress={() => clicGrp(reg.code)} />
                        ))}
                      </View>
                    );
                  })}
                  {grpEconomiques.length > 0 && <Text style={s.sousSection}>GROUPEMENTS ÉCONOMIQUES</Text>}
                  {grpEconomiques.map(g => (
                    <RangeSelection key={g.code} actif={f.grpSelection.includes(g.code)}
                      desactive={!f.grpSelection.includes(g.code) && f.grpSelection.length >= MAX_SEL_IDE}
                      couleur={couleurGrp(g.code)} nom={g.nom_fr} onPress={() => clicGrp(g.code)} />
                  ))}
                  {grpRevenus.length > 0 && <Text style={s.sousSection}>NIVEAUX DE REVENU</Text>}
                  {grpRevenus.map(g => (
                    <RangeSelection key={g.code} actif={f.grpSelection.includes(g.code)}
                      desactive={!f.grpSelection.includes(g.code) && f.grpSelection.length >= MAX_SEL_IDE}
                      couleur={couleurGrp(g.code)} nom={g.nom_fr} onPress={() => clicGrp(g.code)} />
                  ))}
                </ScrollView>
              </View>
            </View>
          ) : (
            /* Pays CNUCED */
            <View>
              <SecTitle droite={<Text style={s.compteBadge}>{multiPays ? `${f.paysSelection.length}/${MAX_SEL_IDE}` : "1"}</Text>}>Pays</SecTitle>
              <View style={s.recherche}>
                <Ionicons name="search" size={13} color={T.gris} />
                <TextInput value={qPays} onChangeText={setQPays} placeholder="Rechercher un pays"
                  placeholderTextColor={T.gris} autoCorrect={false} clearButtonMode="while-editing" style={s.rechercheChamp} />
              </View>
              {senId !== null && (
                <RangeSelection actif={f.paysSelection.includes(senId)} couleur={couleurPaysDe(senId)}
                  nom="Sénégal" badge="Réf." onPress={() => clicPays(senId)} />
              )}
              <View style={s.filet} />
              <View style={{ maxHeight: 260 }}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {groupesPays.map(g => {
                    const ouvert = qPays.trim().length > 0 || regionsOuvertes.has(g.continent);
                    return (
                      <View key={g.continent} style={{ marginBottom: 4 }}>
                        <Pressable onPress={() => basculer(regionsOuvertes, g.continent, setRegionsOuvertes)} style={s.continent}>
                          <Text style={s.continentTexte}>{g.continent.toUpperCase()}</Text>
                          <Ionicons name={ouvert ? "chevron-down" : "chevron-forward"} size={12} color={T.bleu} />
                        </Pressable>
                        {ouvert && g.zones.map(z => (
                          <View key={z.zone} style={{ marginLeft: 4 }}>
                            <Text style={s.zone}>{z.zone.toUpperCase()}</Text>
                            {z.liste.map((p: any) => (
                              <RangeSelection key={p.id} actif={f.paysSelection.includes(p.id)}
                                desactive={multiPays && !f.paysSelection.includes(p.id) && f.paysSelection.length >= MAX_SEL_IDE}
                                couleur={couleurPaysDe(p.id)} nom={p.nom} onPress={() => clicPays(p.id)} />
                            ))}
                          </View>
                        ))}
                      </View>
                    );
                  })}
                  {groupesPays.length === 0 && <Text style={s.vide}>Aucun pays trouvé</Text>}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Période — bornes du contexte (pays ou secteurs) */}
          <View>
            <SecTitle>Période</SecTitle>
            <View style={[s.segments, { marginBottom: 12 }]}>
              {([["plage", "Plage"], ["specifiques", "Années"]] as const).map(([cle, label]) => (
                <Pressable key={cle} onPress={() => setF(prev => ({ ...prev, modeAnnees: cle }))} style={[s.segment, f.modeAnnees === cle && s.segmentActif]}>
                  <Text style={[s.segmentTexte, f.modeAnnees === cle && s.segmentTexteActif]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {f.modeAnnees === "plage" ? (
              <View style={{ gap: 10 }}>
                <View>
                  <Text style={s.plageLabel}>DE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.anneesRangee}>
                    {anneesDispo.map(a => (
                      <AnneeChip key={a} a={a} actif={a === Math.max(f.anneeMin, bornes[0])}
                        onPress={() => setF(prev => ({ ...prev, anneeMin: a, anneeMax: Math.max(a, prev.anneeMax) }))} />
                    ))}
                  </ScrollView>
                </View>
                <View>
                  <Text style={s.plageLabel}>À</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.anneesRangee}>
                    {anneesDispo.map(a => (
                      <AnneeChip key={a} a={a} actif={a === Math.min(f.anneeMax, bornes[1])}
                        onPress={() => setF(prev => ({ ...prev, anneeMax: a, anneeMin: Math.min(a, prev.anneeMin) }))} />
                    ))}
                  </ScrollView>
                </View>
              </View>
            ) : (
              <View style={s.anneesGrille}>
                {anneesDispo.map(a => (
                  <AnneeChip key={a} a={a} actif={f.anneesSpec.includes(a)}
                    onPress={() => setF(prev => ({ ...prev, anneesSpec: prev.anneesSpec.includes(a) ? prev.anneesSpec.filter(x => x !== a) : [...prev.anneesSpec, a].sort((x, y) => x - y) }))} />
                ))}
              </View>
            )}
          </View>
    </Feuille>
  );
}

const s = StyleSheet.create({
  secLigne: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  secTitle: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.6 },
  compteBadge: {
    fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, backgroundColor: T.blocBord,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden", fontVariant: ["tabular-nums"],
  },
  segments: { flexDirection: "row", padding: 3.5, gap: 4, backgroundColor: T.filet, borderRadius: 999 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 999 },
  segmentActif: { backgroundColor: T.carte, shadowColor: "#001e3c", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segmentTexte: { fontSize: 12, fontFamily: POLICE.demi, color: T.gris },
  segmentTexteActif: { color: T.bleu },
  recherche: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10,
    backgroundColor: T.champ, borderWidth: 1, borderColor: T.bordure, borderRadius: 10,
    paddingHorizontal: 11, height: 38,
  },
  rechercheChamp: { flex: 1, fontSize: 13, fontFamily: POLICE.moyen, color: T.encre },
  ligne: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 7.5, paddingHorizontal: 8, borderRadius: 8 },
  point: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  ligneNom: { flex: 1, fontSize: 13, fontFamily: POLICE.normal, color: T.texte },
  refBadge: { backgroundColor: T.filet, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1.5 },
  refBadgeTexte: { fontSize: 9, fontFamily: POLICE.demi, color: T.gris },
  filet: { height: 1, backgroundColor: T.filet, marginVertical: 8 },
  secteurLigne: { flexDirection: "row", alignItems: "center" },
  chevron: { paddingHorizontal: 6, paddingVertical: 6 },
  continent: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: T.blocFond, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 3,
  },
  continentTexte: { fontSize: 10, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1 },
  zone: { fontSize: 8.5, fontFamily: POLICE.gras, color: T.grisClair, letterSpacing: 1, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 2 },
  sousSection: { fontSize: 9, fontFamily: POLICE.gras, color: T.grisClair, letterSpacing: 1.2, paddingHorizontal: 4, paddingTop: 10, paddingBottom: 4 },
  vide: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", paddingVertical: 10 },
  plageLabel: { fontSize: 9, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.2, marginBottom: 6 },
  anneesRangee: { gap: 6, paddingRight: 8 },
  anneesGrille: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  anneeChip: {
    paddingHorizontal: 12, paddingVertical: 6.5, borderRadius: 9,
    backgroundColor: T.champ, borderWidth: 1, borderColor: T.bordure,
  },
  anneeChipActif: { backgroundColor: T.bleuAction, borderColor: T.bleuAction },
  anneeChipTexte: { fontSize: 12, fontFamily: POLICE.demi, color: T.texte, fontVariant: ["tabular-nums"] },
  pied: {
    flexDirection: "row", gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: T.filet,
    paddingBottom: 26,
  },
  boutonSecondaire: {
    flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: T.bordure, backgroundColor: T.carte,
  },
  boutonSecondaireTexte: { fontSize: 13.5, fontFamily: POLICE.demi, color: T.texte },
  boutonPrincipal: { flex: 1.4, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: T.bleuAction },
  boutonPrincipalTexte: { fontSize: 13.5, fontFamily: POLICE.gras, color: "#fff" },
});
