// Sélecteur de la VUE des Investissements nationaux — la cascade BDEF portée
// au pouce : trois segments en tête (Macro-secteurs · Groupes · Secteurs), le
// Global des secteurs toujours accessible en tête de liste, puis la
// hiérarchie qui correspond — les groupes rangés sous leur macro-secteur, les
// secteurs sous leur groupe.
//
// La recherche court-circuite la hiérarchie et sert les résultats à plat.
import { useMemo, useState } from "react";
import { View } from "react-native";
import {
  ChampRecherche, Groupe, Ligne, LigneDepliable, LigneVide, SegmentsCapsule,
} from "@/components/ListeIOS";
import { Feuille, usePoigneeFeuille } from "@/components/ui";

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

/** Une ligne de la liste — sa marque dit la vue lue. */
function LigneVue({ cible, nom, legende, retrait, estChoisi, onChoisir }: {
  cible: SelNational; nom: string; legende?: string; retrait?: boolean;
  estChoisi: (s: SelNational) => boolean; onChoisir: (s: SelNational) => void;
}) {
  return (
    <Ligne label={nom} legende={legende} coche={estChoisi(cible)}
      retrait={retrait ? 16 : 0} onPress={() => onChoisir(cible)} />
  );
}
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

  // Stables d'un rendu à l'autre : les listes filtrées plus bas ne se
  // recalculent qu'à l'arrivée du référentiel
  const macros: any[] = useMemo(() => refs?.macro_secteur || [], [refs]);
  const groupes: any[] = useMemo(() => refs?.groupe || [], [refs]);
  const secteurs: any[] = useMemo(() => refs?.secteur || [], [refs]);

  // Le choix fait, la feuille descend — la même sortie animée que la croix
  const { poignee, fermer } = usePoigneeFeuille();
  const valider = (s: SelNational) => { onChoisir(s); fermer(); };
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

  const basculer = (id: number) => setOuverts(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  // Le global en tête dans son groupe ; la hiérarchie en UNE liste à
  // déplier, les enfants en retrait sous la ligne à chevron de leur parent.
  const ligne = { estChoisi, onChoisir: valider };
  return (
    <Feuille poignee={poignee} onClose={onClose} ecart={22} fondGroupe
      titre="Choisir une vue"
      sousEntete={
        <View style={{ gap: 10, marginTop: 14 }}>
          <SegmentsCapsule compact options={SEGMENTS.map(sg => ({ cle: sg.cle, label: sg.label }))} valeur={vue}
            onChange={v => { setVue(v); setQ(""); }} />
          <ChampRecherche valeur={q} onChange={setQ} placeholder="Rechercher" />
        </View>
      }>
      {resultats ? (
        <Groupe>
          {resultats.map(r => <LigneVue key={r.cle} cible={r.sel} nom={r.nom} legende={r.legende} {...ligne} />)}
          {!resultats.length && <LigneVide texte="Aucun résultat." />}
        </Groupe>
      ) : (
        <>
          <Groupe>
            <LigneVue cible={GLOBAL} nom="Global des secteurs" legende="Tous secteurs confondus" {...ligne} />
          </Groupe>
          {vue === "macro_secteur" && (
            <Groupe>
              {macros.map((m: any) => (
                <LigneVue key={m.id} cible={{ niveau: "macro_secteur", cible_id: m.id, libelle: m.libelle }}
                  nom={m.libelle} {...ligne} />
              ))}
            </Groupe>
          )}
          {vue !== "macro_secteur" && (
            <Groupe>
              {(vue === "groupe" ? macros : groupes).map((parent: any) => {
                const enfants = vue === "groupe"
                  ? groupes.filter((g: any) => g.macro_secteur_id === parent.id)
                  : secteurs.filter((sx: any) => sx.groupe_id === parent.id);
                if (!enfants.length) return null;
                const ouvert = ouverts.has(parent.id);
                return (
                  <View key={parent.id}>
                    <LigneDepliable titre={parent.libelle} compte={enfants.length} ouvert={ouvert}
                      onPress={() => basculer(parent.id)} />
                    {ouvert && enfants.map((x: any) => (
                      <LigneVue key={x.id} retrait {...ligne}
                        cible={{ niveau: vue as SelNational["niveau"], cible_id: x.id, libelle: x.libelle }}
                        nom={x.libelle} />
                    ))}
                  </View>
                );
              })}
            </Groupe>
          )}
        </>
      )}
    </Feuille>
  );
}
