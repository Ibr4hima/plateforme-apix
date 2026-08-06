// Sélecteur de la VUE des Investissements nationaux — la cascade BDEF portée
// au pouce : trois segments en tête (Macro-secteurs · Groupes · Secteurs), le
// Global des secteurs toujours accessible en tête de liste, puis la
// hiérarchie qui correspond — les groupes rangés sous leur macro-secteur, les
// secteurs sous leur groupe.
//
// La recherche court-circuite la hiérarchie et sert les résultats à plat.
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Icone from "@/components/Icone";
import { Feuille, Tapable } from "@/components/ui";
import { cran, tick } from "@/lib/haptique";
import { POLICE, T } from "@/theme";
import { creerStyles } from "@/lib/apparence";
import TexteDefilant from "@/components/TexteDefilant";

export type SelNational = {
  niveau: "global" | "macro_secteur" | "groupe" | "secteur";
  cible_id: number | null;
  libelle: string;
};

const SEGMENTS = [
  { cle: "macro_secteur", label: "Macro-secteurs" },
  { cle: "groupe", label: "Groupes" },
  { cle: "secteur", label: "Secteurs" },
] as const;

const GLOBAL: SelNational = { niveau: "global", cible_id: null, libelle: "Global des secteurs" };
const plier = (x: string) => (x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function SourceNationalSheet({ refs, sel, onChoisir, onClose }: {
  refs: any;
  sel: SelNational;
  onChoisir: (s: SelNational) => void;
  onClose: () => void;
}) {
  const [vue, setVue] = useState<string>(sel.niveau === "global" ? "macro_secteur" : sel.niveau);
  const [q, setQ] = useState("");
  const [ouverts, setOuverts] = useState<Set<number>>(new Set());

  const macros: any[] = refs?.macro_secteur || [];
  const groupes: any[] = refs?.groupe || [];
  const secteurs: any[] = refs?.secteur || [];

  const valider = (s: SelNational) => { cran(); onChoisir(s); onClose(); };
  const estChoisi = (s: SelNational) => s.niveau === sel.niveau && s.cible_id === sel.cible_id;

  // La recherche sert à plat, dans le niveau affiché
  const resultats = useMemo(() => {
    const t = plier(q.trim());
    if (!t) return null;
    const liste = vue === "macro_secteur" ? macros : vue === "groupe" ? groupes : secteurs;
    return liste.filter((x: any) => plier(x.libelle).includes(t)).slice(0, 40)
      .map((x: any) => ({
        cle: `${vue}${x.id}`, nom: x.libelle,
        legende: vue === "groupe"
          ? macros.find((m: any) => m.id === x.macro_secteur_id)?.libelle
          : vue === "secteur"
            ? groupes.find((g: any) => g.id === x.groupe_id)?.libelle
            : undefined,
        sel: { niveau: vue as any, cible_id: x.id, libelle: x.libelle } as SelNational,
      }));
  }, [q, vue, macros, groupes, secteurs]);

  const Ligne = ({ s: cible, nom, legende, premier }: {
    s: SelNational; nom: string; legende?: string; premier: boolean;
  }) => {
    const actif = estChoisi(cible);
    return (
      <Tapable echelle={0.99} onPress={() => valider(cible)} style={[st.ligne, !premier && st.ligneBord]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[st.ligneNom, actif && { color: T.bleu, fontFamily: POLICE.gras }]} numberOfLines={2}>{nom}</Text>
          {legende ? <Text style={st.ligneLegende} numberOfLines={1}>{legende}</Text> : null}
        </View>
        {actif ? <Icone sf="checkmark" materiel="check" taille={16} couleur={T.bleu} poids="semibold" /> : null}
      </Tapable>
    );
  };

  const Accordeon = ({ id, titre, compte, enfants }: {
    id: number; titre: string; compte?: number; enfants: React.ReactNode;
  }) => {
    const ouvert = ouverts.has(id);
    return (
      <View>
        <Tapable echelle={0.99}
          onPress={() => {
            tick();
            setOuverts(prev => {
              const n = new Set(prev);
              n.has(id) ? n.delete(id) : n.add(id);
              return n;
            });
          }}
          style={[st.groupe, ouvert && st.groupeOuvert]}>
          <Text style={st.groupeTexte} numberOfLines={1}>{titre.toUpperCase()}</Text>
          {compte != null && <Text style={st.groupeCompte}>{compte}</Text>}
          <Ionicons name={ouvert ? "chevron-down" : "chevron-forward"} size={13} color={T.bleu} />
        </Tapable>
        {ouvert && <View style={st.surface}>{enfants}</View>}
      </View>
    );
  };

  return (
    <Feuille onClose={onClose} ecart={16} hauteur="86%"
      titre={<Text style={st.titre}>Choisir une vue</Text>}
      sousEntete={
        <>
          <View style={st.segments}>
            {SEGMENTS.map(sg => {
              const actif = vue === sg.cle;
              return (
                <Tapable key={sg.cle} echelle={0.97} surbrillance={false}
                  onPress={() => { tick(); setVue(sg.cle); setQ(""); }}
                  style={[st.segment, actif && st.segmentActif]}>
                  <Text style={[st.segmentTexte, actif && st.segmentTexteActif]} numberOfLines={1}>{sg.label}</Text>
                </Tapable>
              );
            })}
          </View>
          <View style={st.champ}>
            <Icone sf="magnifyingglass" materiel="search" taille={15} couleur={T.gris} />
            <TextInput value={q} onChangeText={setQ} placeholder="Rechercher"
              placeholderTextColor={T.grisClair as any} autoCorrect={false}
              clearButtonMode="while-editing" style={st.champTexte} />
          </View>
        </>
      }>
      {resultats ? (
        <View style={st.surface}>
          {resultats.map((r, i) => <Ligne key={r.cle} s={r.sel} nom={r.nom} legende={r.legende} premier={i === 0} />)}
          {!resultats.length && <Text style={st.vide}>Aucun résultat.</Text>}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {/* Le global, toujours à portée */}
          <View style={st.surface}>
            <Ligne s={GLOBAL} nom="Global des secteurs" legende="Tous secteurs confondus" premier />
          </View>

          {vue === "macro_secteur" && (
            <View style={st.surface}>
              {macros.map((m: any, i: number) => (
                <Ligne key={m.id} s={{ niveau: "macro_secteur", cible_id: m.id, libelle: m.libelle }}
                  nom={m.libelle} premier={i === 0} />
              ))}
            </View>
          )}

          {vue === "groupe" && macros.map((m: any) => {
            const enfants = groupes.filter((g: any) => g.macro_secteur_id === m.id);
            if (!enfants.length) return null;
            return (
              <Accordeon key={m.id} id={m.id} titre={m.libelle} compte={enfants.length}
                enfants={enfants.map((g: any, i: number) => (
                  <Ligne key={g.id} s={{ niveau: "groupe", cible_id: g.id, libelle: g.libelle }}
                    nom={g.libelle} premier={i === 0} />
                ))} />
            );
          })}

          {vue === "secteur" && groupes.map((g: any) => {
            const enfants = secteurs.filter((sx: any) => sx.groupe_id === g.id);
            if (!enfants.length) return null;
            return (
              <Accordeon key={g.id} id={g.id} titre={g.libelle} compte={enfants.length}
                enfants={enfants.map((sx: any, i: number) => (
                  <Ligne key={sx.id} s={{ niveau: "secteur", cible_id: sx.id, libelle: sx.libelle }}
                    nom={sx.libelle} premier={i === 0} />
                ))} />
            );
          })}
        </View>
      )}
    </Feuille>
  );
}

const st = creerStyles(() => ({
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
  segmentTexte: { fontSize: 12, fontFamily: POLICE.demi, color: T.gris },
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
  ligne: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10.5 },
  ligneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  ligneNom: { fontSize: 13.5, fontFamily: POLICE.demi, color: T.encre, lineHeight: 18 },
  ligneLegende: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 1 },
  vide: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", paddingVertical: 20 },
}));
