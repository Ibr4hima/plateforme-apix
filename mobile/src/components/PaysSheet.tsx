// Sélecteur de pays — la liste du monde, groupée comme on la pense :
// continents en accordéons, régions géographiques à l'intérieur, pays à plat
// dessous. Le continent du pays courant s'ouvre à l'arrivée, et le pays
// choisi porte une coche bleue : on sait toujours où l'on est.
//
// Le Sénégal est ÉPINGLÉ au-dessus des continents, sous un tag « Réf. » : il
// est la référence de toute la plateforme, et le chercher dans l'Afrique de
// l'Ouest comme un pays parmi les autres n'avait pas de sens. Il est retiré
// du groupe pour ne pas y figurer deux fois.
//
// La recherche court-circuite la hiérarchie — elle sert les résultats à plat,
// avec le rattachement en légende (Afrique · Afrique de l'Ouest).
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Icone from "@/components/Icone";
import { Feuille, Tapable } from "@/components/ui";
import { cran, tick } from "@/lib/haptique";
import { POLICE, T } from "@/theme";
import { creerStyles } from "@/lib/apparence";

const ORDRE_CONTINENTS = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];

export type PaysOption = {
  id: number; nom: string; code_iso3?: string; continent?: string | null; region_geo?: string | null;
};

const plier = (x: string) => (x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function PaysSheet({ pays, choisi, titre = "Choisir un pays", onChoisir, onClose }: {
  pays: PaysOption[];
  choisi?: number | null;
  titre?: string;
  onChoisir: (id: number) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const paysChoisi = pays.find(p => p.id === choisi);
  // À l'arrivée, le continent du pays courant est déplié
  const [ouverts, setOuverts] = useState<Set<string>>(
    () => new Set([paysChoisi?.continent || "Afrique"]));

  // Le Sénégal, épinglé en tête — et retiré de la hiérarchie
  const senegal = useMemo(
    () => pays.find(p => p.code_iso3 === "SEN" || plier(p.nom) === "senegal"), [pays]);
  const autres = useMemo(
    () => (senegal ? pays.filter(p => p.id !== senegal.id) : pays), [pays, senegal]);

  // Hiérarchie continent → région → pays
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

  // La recherche sert à plat, hiérarchie court-circuitée
  const resultats = useMemo(() => {
    const t = plier(q.trim());
    if (!t) return null;
    return pays.filter(p => plier(p.nom).includes(t))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
      .slice(0, 40);
  }, [pays, q]);

  const valider = (id: number) => { cran(); onChoisir(id); onClose(); };

  const LignePays = ({ p, premier, legende, reference }: {
    p: PaysOption; premier: boolean; legende?: boolean; reference?: boolean;
  }) => {
    const actif = p.id === choisi;
    return (
      <Tapable echelle={0.99} onPress={() => valider(p.id)} style={[s.pays, !premier && s.paysBord]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.paysNom, actif && { color: T.bleu, fontFamily: POLICE.gras }]} numberOfLines={1}>{p.nom}</Text>
          {legende && (p.continent || p.region_geo) ? (
            <Text style={s.paysLegende} numberOfLines={1}>
              {[p.continent, p.region_geo].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
        </View>
        {reference ? <View style={s.tagRef}><Text style={s.tagRefTexte}>Réf.</Text></View> : null}
        {actif ? <Icone sf="checkmark" materiel="check" taille={16} couleur={T.bleu} poids="semibold" /> : null}
      </Tapable>
    );
  };

  return (
    <Feuille onClose={onClose} ecart={16} hauteur="84%"
      titre={<Text style={s.titre}>{titre}</Text>}
      sousEntete={
        <View style={s.champ}>
          <Icone sf="magnifyingglass" materiel="search" taille={15} couleur={T.gris} />
          <TextInput value={q} onChangeText={setQ} placeholder="Rechercher un pays"
            placeholderTextColor={T.grisClair as any} autoCorrect={false}
            clearButtonMode="while-editing" style={s.champTexte} />
        </View>
      }>
      {resultats ? (
        <View style={s.surface}>
          {resultats.map((p, i) => <LignePays key={p.id} p={p} premier={i === 0} legende />)}
          {!resultats.length && <Text style={s.vide}>Aucun pays ne correspond.</Text>}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {/* La référence, au-dessus de tout le reste */}
          {senegal && (
            <View style={[s.surface, { marginTop: 0 }]}>
              <LignePays p={senegal} premier reference />
            </View>
          )}
          {sections.map(sec => {
            const ouvert = ouverts.has(sec.continent);
            return (
              <View key={sec.continent}>
                <Tapable echelle={0.99}
                  onPress={() => {
                    tick();
                    setOuverts(prev => {
                      const n = new Set(prev);
                      n.has(sec.continent) ? n.delete(sec.continent) : n.add(sec.continent);
                      return n;
                    });
                  }}
                  style={[s.continent, ouvert && s.continentOuvert]}>
                  <Text style={s.continentTexte}>{sec.continent.toUpperCase()}</Text>
                  <Text style={s.continentCompte}>{sec.nb}</Text>
                  <Ionicons name={ouvert ? "chevron-down" : "chevron-forward"} size={13} color={T.bleu} />
                </Tapable>
                {ouvert && (
                  <View style={s.surface}>
                    {sec.regions.map((r, ri) => (
                      <View key={r.region}>
                        <Text style={[s.region, ri > 0 && s.regionBord]}>{r.region.toUpperCase()}</Text>
                        {r.liste.map((p, i) => <LignePays key={p.id} p={p} premier={i === 0} />)}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  titre: { fontSize: 21, fontFamily: POLICE.gras, color: T.encre, lineHeight: 27, letterSpacing: -0.4, flex: 1 },
  champ: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12,
    backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.bordure,
    borderRadius: 12, borderCurve: "continuous", paddingHorizontal: 12, height: 38,
  },
  champTexte: { flex: 1, fontSize: 14, fontFamily: POLICE.moyen, color: T.encre },

  continent: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: T.bleuVoile, borderRadius: 12, borderCurve: "continuous",
    paddingHorizontal: 14, paddingVertical: 10,
  },
  continentOuvert: { borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  continentTexte: { flex: 1, fontSize: 11, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.2 },
  continentCompte: { fontSize: 11, fontFamily: POLICE.gras, color: T.bleu, opacity: 0.6, fontVariant: ["tabular-nums"] },

  surface: {
    backgroundColor: T.carte, borderRadius: 14, borderCurve: "continuous",
    borderWidth: 1, borderColor: T.carteBord, overflow: "hidden", marginTop: 6,
  },
  region: {
    fontSize: 9, fontFamily: POLICE.gras, color: T.grisClair, letterSpacing: 1.1,
    paddingHorizontal: 14, paddingTop: 11, paddingBottom: 4,
  },
  regionBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure, marginTop: 4 },
  pays: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10.5 },
  paysBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  paysNom: { fontSize: 13.5, fontFamily: POLICE.demi, color: T.encre },
  paysLegende: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 1 },
  tagRef: { backgroundColor: T.bleuVoile, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2.5 },
  tagRefTexte: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 0.4 },
  vide: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", paddingVertical: 20 },
}));
