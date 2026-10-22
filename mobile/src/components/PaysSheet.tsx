// Sélecteur de pays — la liste du monde, groupée comme on la pense, dans
// les listes du système (ListeIOS) : les continents en UNE liste à déplier,
// leurs régions en sous-titre, leurs pays en retrait. Le continent du pays
// courant s'ouvre à l'arrivée, et le pays choisi est marqué — la coche
// d'iOS, le bouton radio d'Android : on sait toujours où l'on est.
//
// Le Sénégal est ÉPINGLÉ au-dessus des continents, dans son propre groupe,
// sa légende dit « Pays de référence » : il est la référence de toute la
// plateforme, et le chercher dans l'Afrique de l'Ouest comme un pays parmi
// les autres n'avait pas de sens. Il est retiré du groupe pour ne pas y
// figurer deux fois.
//
// La recherche court-circuite la hiérarchie — elle sert les résultats à plat,
// avec le rattachement en légende (Afrique · Afrique de l'Ouest).
//
// LA LISTE VIT AUSSI HORS DE LA FEUILLE : la Fiche Pays la pose dans sa page
// tant qu'aucun pays n'est choisi (ListePays). C'est la même liste aux deux
// endroits, et le même geste.
import { useMemo, useState } from "react";
import { View } from "react-native";
import { ChampRecherche, Groupe, Ligne, LigneDepliable, LigneVide, SousEnTete } from "@/components/ListeIOS";
import { Feuille, usePoigneeFeuille } from "@/components/ui";
import { IOS } from "@/lib/plateforme";
import { plier } from "@/lib/format";

const ORDRE_CONTINENTS = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];

export type PaysOption = {
  id: number; nom: string; code_iso3?: string; continent?: string | null; region_geo?: string | null;
};


/** Un pays de la liste — sa marque dit celui qui est lu. Sans pays courant
    (la liste posée dans la Fiche Pays), rien n'est à marquer : Android n'y
    dessine pas cent quarante boutons radio vides. */
function LignePays({ p, legende, retrait, choisi, onChoisir }: {
  p: PaysOption; legende?: string; retrait?: boolean; choisi?: number | null; onChoisir: (id: number) => void;
}) {
  const marque = choisi != null || IOS ? p.id === choisi : undefined;
  return (
    <Ligne label={p.nom} legende={legende} coche={marque} lignes={1}
      retrait={retrait ? 16 : 0} onPress={() => onChoisir(p.id)} />
  );
}

/** La liste des pays : la référence épinglée, les continents à déplier, et
    la recherche `q` servie à plat. */
export function ListePays({ pays, choisi, q, onChoisir }: {
  pays: PaysOption[]; choisi?: number | null; q: string; onChoisir: (id: number) => void;
}) {
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

  const basculer = (cle: string) => setOuverts(prev => {
    const n = new Set(prev);
    n.has(cle) ? n.delete(cle) : n.add(cle);
    return n;
  });

  // La référence en tête dans son groupe ; les continents en UNE liste à
  // déplier, leurs régions en sous-titre et leurs pays en retrait.
  const ligne = { choisi, onChoisir };
  if (resultats) return (
    <Groupe>
      {resultats.map(p => (
        <LignePays key={p.id} p={p} {...ligne}
          legende={[p.continent, p.region_geo].filter(Boolean).join(" · ") || undefined} />
      ))}
      {!resultats.length && <LigneVide texte="Aucun pays ne correspond." />}
    </Groupe>
  );
  return (
    <View style={{ gap: 22 }}>
      {senegal && <Groupe><LignePays p={senegal} legende="Pays de référence" {...ligne} /></Groupe>}
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
                  {r.liste.map(p => <LignePays key={p.id} p={p} retrait {...ligne} />)}
                </View>
              ))}
            </View>
          );
        })}
      </Groupe>
    </View>
  );
}

export default function PaysSheet({ pays, choisi, titre = "Choisir un pays", onChoisir, onClose }: {
  pays: PaysOption[];
  choisi?: number | null;
  titre?: string;
  onChoisir: (id: number) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  // Le choix fait, la feuille descend — la même sortie animée que la croix
  const { poignee, fermer } = usePoigneeFeuille();
  const valider = (id: number) => { onChoisir(id); fermer(); };

  return (
    <Feuille poignee={poignee} onClose={onClose} ecart={22} fondGroupe
      titre={titre}
      sousEntete={<ChampRecherche valeur={q} onChange={setQ} placeholder="Rechercher un pays" style={{ marginTop: 14 }} />}>
      <ListePays pays={pays} choisi={choisi} q={q} onChoisir={valider} />
    </Feuille>
  );
}
