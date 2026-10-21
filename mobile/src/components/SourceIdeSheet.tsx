// Sélecteur de la SOURCE d'une lecture IDE — la VUE de la plateforme, portée
// au pouce : trois segments en tête (Pays · Monde · Secteurs) puis la liste
// qui correspond.
//
//   · Pays    — le Sénégal épinglé en tête sous un tag « Réf. » (il est la
//               référence de la plateforme), puis le monde groupé en
//               accordéons : continents, régions, pays
//   · Monde   — le total mondial, puis les continents, leurs régions et les
//               groupements économiques
//   · Secteurs — le global, les trois grands secteurs et leurs branches
//
// La recherche court-circuite la hiérarchie et sert les résultats à plat.
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Icone from "@/components/Icone";
import {
  ChampRecherche, Groupe, Ligne as LigneIOS, LigneDepliable, LigneVide, SegmentsIOS, SousEnTete,
} from "@/components/ListeIOS";
import { Feuille, Tapable } from "@/components/ui";
import type { SourceIde } from "@/lib/ideSource";
import { IOS } from "@/lib/plateforme";
import { POLICE, T } from "@/theme";
import { creerStyles } from "@/lib/apparence";

const ORDRE_CONTINENTS = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];
const SEGMENTS = [
  { cle: "pays", label: "Pays" },
  { cle: "monde", label: "Monde" },
  { cle: "secteurs", label: "Secteurs" },
] as const;

export type PaysOption = {
  id: number; nom: string; code_iso3?: string; continent?: string | null; region_geo?: string | null;
};
export type GroupementOption = { code: string; nom_fr: string; categorie: string };
export type SecteurOption = { id: number; nom_fr: string; branches?: { id: number; nom_fr: string }[] };

const plier = (x: string) => (x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** iOS : une ligne de la liste — la coche dit la vue lue. */
function LigneSourceIOS({ src, nom, legende, retrait, estChoisi, onChoisir }: {
  src: SourceIde; nom: string; legende?: string; retrait?: boolean;
  estChoisi: (s: SourceIde) => boolean; onChoisir: (s: SourceIde) => void;
}) {
  return (
    <LigneIOS label={nom} legende={legende} coche={estChoisi(src)} lignes={1}
      retrait={retrait ? 16 : 0} onPress={() => onChoisir(src)} />
  );
}

export default function SourceIdeSheet({ pays, groupements, secteurs, source, onChoisir, onClose }: {
  pays: PaysOption[];
  groupements: GroupementOption[];
  secteurs: SecteurOption[];
  source: SourceIde;
  onChoisir: (s: SourceIde) => void;
  onClose: () => void;
}) {
  const [vue, setVue] = useState<string>(source.type === "secteur" ? "secteurs" : source.type === "monde" ? "monde" : "pays");
  const [q, setQ] = useState("");
  const paysCourant = source.type === "pays" ? pays.find(p => p.nom === source.nom) : undefined;
  const [ouverts, setOuverts] = useState<Set<string>>(
    () => new Set([paysCourant?.continent || "Afrique"]));

  const valider = (s: SourceIde) => { onChoisir(s); onClose(); };

  // Le Sénégal, épinglé en tête — et retiré de la hiérarchie pour ne pas y
  // figurer deux fois
  const senegal = useMemo(
    () => pays.find(p => p.code_iso3 === "SEN" || plier(p.nom) === "senegal"), [pays]);
  const autres = useMemo(
    () => (senegal ? pays.filter(p => p.id !== senegal.id) : pays), [pays, senegal]);

  // ── Pays : continent → région → pays ──
  const sections = useMemo(() => {
    const parCont = new Map<string, Map<string, PaysOption[]>>();
    for (const p of autres) {
      const c = p.continent || "Autre", r = p.region_geo || "Autre";
      if (!parCont.has(c)) parCont.set(c, new Map());
      const regions = parCont.get(c)!;
      if (!regions.has(r)) regions.set(r, []);
      regions.get(r)!.push(p);
    }
    return [...parCont.entries()]
      .map(([continent, regions]) => ({
        continent,
        nb: [...regions.values()].reduce((n, l) => n + l.length, 0),
        regions: [...regions.entries()]
          .map(([region, liste]) => ({ region, liste: liste.sort((a, b) => a.nom.localeCompare(b.nom, "fr")) }))
          .sort((a, b) => a.region.localeCompare(b.region, "fr")),
      }))
      .sort((a, b) => {
        const ia = ORDRE_CONTINENTS.indexOf(a.continent), ib = ORDRE_CONTINENTS.indexOf(b.continent);
        if (ia === -1 && ib === -1) return a.continent.localeCompare(b.continent, "fr");
        if (ia === -1) return 1; if (ib === -1) return -1;
        return ia - ib;
      });
  }, [autres]);

  // ── Monde : continents (avec leurs régions) puis groupements ──
  const continents = useMemo(() => groupements.filter(g => g.categorie === "continent"), [groupements]);
  const regionsDe = (nom: string) => groupements.filter(g => g.categorie === nom);
  const groupes = useMemo(() => groupements.filter(g => g.categorie === "groupe"), [groupements]);

  // La recherche sert à plat, hiérarchie court-circuitée
  const resultats = useMemo(() => {
    const t = plier(q.trim());
    if (!t) return null;
    if (vue === "pays") return pays.filter(p => plier(p.nom).includes(t)).slice(0, 40)
      .map(p => ({ cle: `p${p.id}`, nom: p.nom, legende: [p.continent, p.region_geo].filter(Boolean).join(" · "),
                   src: { type: "pays", nom: p.nom } as SourceIde }));
    if (vue === "monde") return groupements
      .filter(g => plier(g.nom_fr).includes(t) || plier(g.code).includes(t)).slice(0, 40)
      .map(g => ({ cle: g.code, nom: g.nom_fr, legende: g.categorie === "groupe" ? "Groupement" : g.categorie,
                   src: { type: "monde", code: g.code, label: g.nom_fr } as SourceIde }));
    const plat: { cle: string; nom: string; legende: string; src: SourceIde }[] = [];
    secteurs.forEach(sx => {
      if (plier(sx.nom_fr).includes(t)) plat.push({ cle: `s${sx.id}`, nom: sx.nom_fr, legende: "Secteur",
        src: { type: "secteur", id: sx.id, label: sx.nom_fr } });
      (sx.branches || []).forEach(b => {
        if (plier(b.nom_fr).includes(t)) plat.push({ cle: `s${b.id}`, nom: b.nom_fr, legende: sx.nom_fr,
          src: { type: "secteur", id: b.id, label: b.nom_fr } });
      });
    });
    return plat.slice(0, 40);
  }, [q, vue, pays, groupements, secteurs]);

  // La ligne courante est-elle celle qui est choisie ?
  const estChoisi = (s: SourceIde) =>
    s.type === source.type && (
      s.type === "pays" ? s.nom === (source as any).nom
      : s.type === "monde" ? s.code === (source as any).code
      : s.id === (source as any).id);

  const basculer = (cle: string) => setOuverts(prev => {
    const n = new Set(prev);
    n.has(cle) ? n.delete(cle) : n.add(cle);
    return n;
  });
  const placeholder = vue === "pays" ? "Rechercher un pays" : vue === "monde" ? "Rechercher une zone" : "Rechercher un secteur";

  // ── iOS : les listes groupées du système ──
  // Une liste à déplier par vue : continents, secteurs ou zones sont des
  // lignes à chevron, leur contenu vient en retrait dessous ; ce qui est
  // choisi porte la coche. La référence et les totaux gardent leur place en
  // tête, dans leur propre groupe.
  if (IOS) {
    return (
      <Feuille onClose={onClose} ecart={22} fondGroupe
        titre={<Text style={s.titre}>Choisir une vue</Text>}
        sousEntete={
          <View style={{ gap: 10, marginTop: 14 }}>
            <SegmentsIOS options={SEGMENTS.map(sg => ({ cle: sg.cle, label: sg.label }))} valeur={vue}
              onChange={v => { setVue(v); setQ(""); }} />
            <ChampRecherche valeur={q} onChange={setQ} placeholder={placeholder} />
          </View>
        }>
        {resultats ? (
          <Groupe>
            {resultats.map(r => <LigneSourceIOS estChoisi={estChoisi} onChoisir={valider} key={r.cle} src={r.src} nom={r.nom} legende={r.legende} />)}
            {!resultats.length && <LigneVide texte="Aucun résultat." />}
          </Groupe>
        ) : vue === "pays" ? (
          <>
            {senegal && (
              <Groupe><LigneSourceIOS estChoisi={estChoisi} onChoisir={valider} src={{ type: "pays", nom: senegal.nom }} nom={senegal.nom} legende="Pays de référence" /></Groupe>
            )}
            <Groupe>
              {sections.map(sec => {
                const ouvert = ouverts.has(sec.continent);
                return (
                  <View key={sec.continent}>
                    <LigneDepliable titre={sec.continent} compte={sec.nb} ouvert={ouvert}
                      onPress={() => basculer(sec.continent)} />
                    {ouvert && sec.regions.map(r => (
                      <View key={r.region}>
                        <SousEnTete texte={r.region} retrait={16} />
                        {r.liste.map(p => <LigneSourceIOS estChoisi={estChoisi} onChoisir={valider} key={p.id} src={{ type: "pays", nom: p.nom }} nom={p.nom} retrait />)}
                      </View>
                    ))}
                  </View>
                );
              })}
            </Groupe>
          </>
        ) : vue === "monde" ? (
          <>
            <Groupe><LigneSourceIOS estChoisi={estChoisi} onChoisir={valider} src={{ type: "monde", code: null, label: "Monde" }} nom="Monde" legende="Total mondial" /></Groupe>
            <Groupe>
              {continents.map(c => {
                const cle = `m${c.code}`, ouvert = ouverts.has(cle);
                return (
                  <View key={c.code}>
                    <LigneDepliable titre={c.nom_fr} ouvert={ouvert} onPress={() => basculer(cle)} />
                    {ouvert && (
                      <>
                        <LigneSourceIOS estChoisi={estChoisi} onChoisir={valider} src={{ type: "monde", code: c.code, label: c.nom_fr }} nom={c.nom_fr}
                          legende="Continent entier" retrait />
                        {regionsDe(c.nom_fr).map(r => (
                          <LigneSourceIOS estChoisi={estChoisi} onChoisir={valider} key={r.code} src={{ type: "monde", code: r.code, label: r.nom_fr }} nom={r.nom_fr} retrait />
                        ))}
                      </>
                    )}
                  </View>
                );
              })}
              {groupes.length > 0 && (
                <View>
                  <LigneDepliable titre="Groupements" compte={groupes.length} ouvert={ouverts.has("mgroupes")}
                    onPress={() => basculer("mgroupes")} />
                  {ouverts.has("mgroupes") && groupes.map(g => (
                    <LigneSourceIOS estChoisi={estChoisi} onChoisir={valider} key={g.code} src={{ type: "monde", code: g.code, label: g.nom_fr }}
                      nom={g.nom_fr} legende={g.code.replace(/_/g, " ")} retrait />
                  ))}
                </View>
              )}
            </Groupe>
          </>
        ) : (
          <>
            <Groupe>
              <LigneSourceIOS estChoisi={estChoisi} onChoisir={valider} src={{ type: "secteur", id: 0, label: "Global des secteurs" }} nom="Global des secteurs"
                legende="Tous secteurs confondus" />
            </Groupe>
            <Groupe>
              {secteurs.map(sx => {
                const cle = `s${sx.id}`, ouvert = ouverts.has(cle);
                return (
                  <View key={sx.id}>
                    <LigneDepliable titre={sx.nom_fr} compte={(sx.branches || []).length} ouvert={ouvert}
                      onPress={() => basculer(cle)} />
                    {ouvert && (
                      <>
                        <LigneSourceIOS estChoisi={estChoisi} onChoisir={valider} src={{ type: "secteur", id: sx.id, label: sx.nom_fr }} nom={sx.nom_fr}
                          legende="Secteur entier" retrait />
                        {(sx.branches || []).map(b => (
                          <LigneSourceIOS estChoisi={estChoisi} onChoisir={valider} key={b.id} src={{ type: "secteur", id: b.id, label: b.nom_fr }} nom={b.nom_fr} retrait />
                        ))}
                      </>
                    )}
                  </View>
                );
              })}
            </Groupe>
          </>
        )}
      </Feuille>
    );
  }

  const Ligne = ({ src, nom, legende, premier, reference }: {
    src: SourceIde; nom: string; legende?: string; premier: boolean; reference?: boolean;
  }) => {
    const actif = estChoisi(src);
    return (
      <Tapable onPress={() => valider(src)} style={[s.ligne, !premier && s.ligneBord]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.ligneNom, actif && { color: T.bleu, fontFamily: POLICE.gras }]} numberOfLines={1}>{nom}</Text>
          {legende ? <Text style={s.ligneLegende} numberOfLines={1}>{legende}</Text> : null}
        </View>
        {reference ? <View style={s.tagRef}><Text style={s.tagRefTexte}>Réf.</Text></View> : null}
        {actif ? <Icone sf="checkmark" materiel="check" taille={16} couleur={T.bleu} poids="semibold" /> : null}
      </Tapable>
    );
  };

  const Accordeon = ({ cle, titre, compte, enfants }: {
    cle: string; titre: string; compte?: number; enfants: React.ReactNode;
  }) => {
    const ouvert = ouverts.has(cle);
    return (
      <View>
        <Tapable
          onPress={() => basculer(cle)}
          style={[s.groupe, ouvert && s.groupeOuvert]}>
          <Text style={s.groupeTexte}>{titre.toUpperCase()}</Text>
          {compte != null && <Text style={s.groupeCompte}>{compte}</Text>}
          <Ionicons name={ouvert ? "chevron-down" : "chevron-forward"} size={13} color={T.bleu} />
        </Tapable>
        {ouvert && <View style={s.surface}>{enfants}</View>}
      </View>
    );
  };

  return (
    <Feuille onClose={onClose} ecart={16} hauteur="86%"
      titre={<Text style={s.titre}>Choisir une vue</Text>}
      sousEntete={
        <>
          {/* Les trois vues, comme sur la plateforme */}
          <View style={s.segments}>
            {SEGMENTS.map(sg => {
              const actif = vue === sg.cle;
              return (
                <Tapable key={sg.cle} surbrillance={false}
                  onPress={() => { setVue(sg.cle); setQ(""); }}
                  style={[s.segment, actif && s.segmentActif]}>
                  <Text style={[s.segmentTexte, actif && s.segmentTexteActif]}>{sg.label}</Text>
                </Tapable>
              );
            })}
          </View>
          <View style={s.champ}>
            <Icone sf="magnifyingglass" materiel="search" taille={15} couleur={T.gris} />
            <TextInput value={q} onChangeText={setQ}
              placeholder={placeholder}
              placeholderTextColor={T.grisClair as any} autoCorrect={false}
              clearButtonMode="while-editing" style={s.champTexte} />
          </View>
        </>
      }>
      {resultats ? (
        <View style={s.surface}>
          {resultats.map((r, i) => <Ligne key={r.cle} src={r.src} nom={r.nom} legende={r.legende} premier={i === 0} />)}
          {!resultats.length && <Text style={s.vide}>Aucun résultat.</Text>}
        </View>
      ) : vue === "pays" ? (
        <View style={{ gap: 10 }}>
          {/* La référence, au-dessus de tout le reste */}
          {senegal && (
            <View style={s.surface}>
              <Ligne src={{ type: "pays", nom: senegal.nom }} nom={senegal.nom} premier reference />
            </View>
          )}
          {sections.map(sec => (
            <Accordeon key={sec.continent} cle={sec.continent} titre={sec.continent} compte={sec.nb}
              enfants={sec.regions.map((r, ri) => (
                <View key={r.region}>
                  <Text style={[s.region, ri > 0 && s.regionBord]}>{r.region.toUpperCase()}</Text>
                  {r.liste.map((p, i) => (
                    <Ligne key={p.id} src={{ type: "pays", nom: p.nom }} nom={p.nom} premier={i === 0} />
                  ))}
                </View>
              ))} />
          ))}
        </View>
      ) : vue === "monde" ? (
        <View style={{ gap: 10 }}>
          {/* Le total mondial, en tête */}
          <View style={s.surface}>
            <Ligne src={{ type: "monde", code: null, label: "Monde" }} nom="Monde"
              legende="Total mondial" premier />
          </View>
          {continents.map(c => (
            <Accordeon key={c.code} cle={`m${c.code}`} titre={c.nom_fr}
              enfants={
                <>
                  <Ligne src={{ type: "monde", code: c.code, label: c.nom_fr }} nom={c.nom_fr}
                    legende="Continent entier" premier />
                  {regionsDe(c.nom_fr).map(r => (
                    <Ligne key={r.code} src={{ type: "monde", code: r.code, label: r.nom_fr }}
                      nom={r.nom_fr} premier={false} />
                  ))}
                </>
              } />
          ))}
          {groupes.length > 0 && (
            <Accordeon cle="mgroupes" titre="Groupements" compte={groupes.length}
              enfants={groupes.map((g, i) => (
                <Ligne key={g.code} src={{ type: "monde", code: g.code, label: g.nom_fr }}
                  nom={g.nom_fr} legende={g.code.replace(/_/g, " ")} premier={i === 0} />
              ))} />
          )}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <View style={s.surface}>
            <Ligne src={{ type: "secteur", id: 0, label: "Global des secteurs" }}
              nom="Global des secteurs" legende="Tous secteurs confondus" premier />
          </View>
          {secteurs.map(sx => (
            <Accordeon key={sx.id} cle={`s${sx.id}`} titre={sx.nom_fr} compte={(sx.branches || []).length}
              enfants={
                <>
                  <Ligne src={{ type: "secteur", id: sx.id, label: sx.nom_fr }} nom={sx.nom_fr}
                    legende="Secteur entier" premier />
                  {(sx.branches || []).map(b => (
                    <Ligne key={b.id} src={{ type: "secteur", id: b.id, label: b.nom_fr }}
                      nom={b.nom_fr} premier={false} />
                  ))}
                </>
              } />
          ))}
        </View>
      )}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  titre: { fontSize: 21, fontFamily: POLICE.gras, color: T.encre, lineHeight: 27, letterSpacing: -0.4, flex: 1 },
  segments: {
    flexDirection: "row", marginTop: 12, padding: 3.5, gap: 4,
    backgroundColor: T.voile, borderRadius: 999,
  },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 999 },
  segmentActif: {
    backgroundColor: T.carte,
    shadowColor: "#001e3c", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentTexte: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.gris },
  segmentTexteActif: { color: T.bleu, fontFamily: POLICE.gras },
  champ: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10,
    backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.bordure,
    borderRadius: 12, borderCurve: "continuous", paddingHorizontal: 12, height: 38,
  },
  champTexte: { flex: 1, fontSize: 14, fontFamily: POLICE.moyen, color: T.encre },

  groupe: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: T.bleuVoile, borderRadius: 12, borderCurve: "continuous",
    paddingHorizontal: 14, paddingVertical: 10,
  },
  groupeOuvert: { borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  groupeTexte: { flex: 1, fontSize: 11, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.2 },
  groupeCompte: { fontSize: 11, fontFamily: POLICE.gras, color: T.bleu, opacity: 0.6, fontVariant: ["tabular-nums"] },

  surface: {
    backgroundColor: T.carte, borderRadius: 14, borderCurve: "continuous",
    borderWidth: 1, borderColor: T.carteBord, overflow: "hidden", marginTop: 6,
  },
  region: {
    fontSize: 9, fontFamily: POLICE.gras, color: T.grisClair, letterSpacing: 1.1,
    paddingHorizontal: 14, paddingTop: 11, paddingBottom: 4,
  },
  regionBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure, marginTop: 4 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10.5 },
  ligneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  ligneNom: { fontSize: 13.5, fontFamily: POLICE.demi, color: T.encre },
  ligneLegende: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 1 },
  tagRef: { backgroundColor: T.bleuVoile, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2.5 },
  tagRefTexte: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 0.4 },
  vide: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", paddingVertical: 20 },
}));
