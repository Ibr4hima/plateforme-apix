// Choisir la DESTINATION lue — un pays, ou une région entière.
//
// La question de l'écran des projets est « que reçoit… ? ». Elle se pose à
// deux échelles : un pays (« que reçoit le Sénégal ») ou une région (« que
// reçoit l'Afrique de l'Ouest »). Les deux s'excluent : une seule part dans la
// requête, et la feuille ne montre jamais les deux listes à la fois.
//
//   · Pays    — le Sénégal épinglé en tête dans son groupe (il est la
//               référence de la plateforme), puis les régions en UNE liste à
//               déplier, leurs pays en retrait. La recherche court-circuite
//               la hiérarchie.
//   · Régions — le continent d'abord (le plus large : on restreint depuis le
//               large), puis ses régions en retrait, dans son groupe.
//
// Ne sont proposés que les pays dont le relevé est COMPLET : les autres
// n'apparaissent dans la base que pour ce qu'ils ont échangé avec un pays
// relevé, et les proposer laisserait croire à une couverture qu'on n'a pas.
// Le compte d'une région est la somme de ses pays : un projet n'a qu'une
// destination, aucun n'est compté deux fois.
import { useMemo, useState } from "react";
import { View } from "react-native";
import { ChampRecherche, Groupe, Ligne, LigneDepliable, LigneVide, SegmentsCapsule } from "@/components/ListeIOS";
import { Feuille, usePoigneeFeuille } from "@/components/ui";
import { type ComptePays, PAYS_REFERENCE, fmtEntier, plier } from "@/lib/fdi";
import { LARGEUR_FICHE } from "./FichesFdi";

const ORDRE_CONTINENTS = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];
const rangContinent = (c: string) => {
  const i = ORDRE_CONTINENTS.indexOf(c);
  return i === -1 ? ORDRE_CONTINENTS.length : i;
};

export type Destination = { echelle: "pays" | "regions"; pays: string; region: string | null };

/** Les régions du relevé, chacune avec ses pays et leur somme. */
export function regionsDe(pays: ComptePays[]) {
  const parRegion = new Map<string, { continent: string; zone: string; dedans: ComptePays[] }>();
  for (const p of pays) {
    const continent = p.continent || "Autre", zone = p.region_geo || "Autre";
    const cle = `${continent} · ${zone}`;
    if (!parRegion.has(cle)) parRegion.set(cle, { continent, zone, dedans: [] });
    parRegion.get(cle)!.dedans.push(p);
  }
  return [...parRegion.entries()]
    .map(([cle, r]) => ({
      cle, ...r,
      dedans: r.dedans.sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
      nb: r.dedans.reduce((t, p) => t + p.nb, 0),
    }))
    .sort((a, b) => rangContinent(a.continent) - rangContinent(b.continent) || a.zone.localeCompare(b.zone, "fr"));
}

// ── Les lignes des listes ──
function LignePays({ p, retrait, valeur, choisir }: {
  p: ComptePays; retrait?: boolean; valeur: Destination; choisir: (d: Destination) => void;
}) {
  return (
    <Ligne label={p.nom} legende={p.nom === PAYS_REFERENCE ? "Pays de référence" : undefined}
      detail={fmtEntier(p.nb)} coche={valeur.echelle === "pays" && valeur.pays === p.nom}
      retrait={retrait ? 16 : 0} lignes={1}
      onPress={() => choisir({ echelle: "pays", pays: p.nom, region: valeur.region })} />
  );
}

function LigneZone({ nom, nb, retrait, valeur, choisir }: {
  nom: string; nb: number; retrait?: boolean; valeur: Destination; choisir: (d: Destination) => void;
}) {
  return (
    <Ligne label={nom} gras={!retrait} detail={fmtEntier(nb)} lignes={1}
      coche={valeur.echelle === "regions" && valeur.region === nom} retrait={retrait ? 16 : 0}
      onPress={() => choisir({ echelle: "regions", pays: valeur.pays, region: nom })} />
  );
}

export default function DestinationSheet({ pays, valeur, regionsPermises = true, onChoisir, onClose }: {
  pays: ComptePays[];
  valeur: Destination;
  /** Faux là où seule la maille du pays a un sens (le tableau de bord). */
  regionsPermises?: boolean;
  onChoisir: (d: Destination) => void;
  onClose: () => void;
}) {
  const [echelle, setEchelle] = useState<"pays" | "regions">(regionsPermises ? valeur.echelle : "pays");
  const [q, setQ] = useState("");
  const paysCourant = pays.find(p => p.nom === valeur.pays);
  // La région du pays lu s'ouvre d'elle-même : c'est là que l'œil le cherche
  const [ouverts, setOuverts] = useState<Set<string>>(() => new Set(paysCourant && paysCourant.nom !== PAYS_REFERENCE
    ? [`${paysCourant.continent || "Autre"} · ${paysCourant.region_geo || "Autre"}`] : []));

  const reference = pays.find(p => p.nom === PAYS_REFERENCE) ?? null;
  const regions = useMemo(() => regionsDe(pays), [pays]);
  const continents = useMemo(() => ORDRE_CONTINENTS
    .map(nom => ({ nom, zones: regions.filter(r => r.continent === nom) }))
    .filter(c => c.zones.length > 0)
    .map(c => ({ ...c, nb: c.zones.reduce((t, z) => t + z.nb, 0) })), [regions]);

  const resultats = useMemo(() => {
    const t = plier(q.trim());
    if (!t) return null;
    return pays.filter(p => plier(p.nom).includes(t)).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [q, pays]);

  // Le choix fait, la feuille descend — la même sortie animée que la croix
  const { poignee, fermer } = usePoigneeFeuille();
  const choisir = (d: Destination) => { onChoisir(d); fermer(); };
  const basculerRegion = (cle: string) =>
    setOuverts(prev => { const n = new Set(prev); n.has(cle) ? n.delete(cle) : n.add(cle); return n; });

  // Les régions forment UNE liste à déplier (sa flèche dit si elle est
  // ouverte, ses pays viennent en retrait) plutôt qu'une pile d'accordéons ;
  // la référence garde sa place en tête, sa légende dit pourquoi.
  return (
    <Feuille poignee={poignee} onClose={onClose} ecart={22} largeurMax={LARGEUR_FICHE} fondGroupe
      titre="Destination"
      sousEntete={
        <View style={{ gap: 10, marginTop: 14 }}>
          {regionsPermises && (
            <SegmentsCapsule compact valeur={echelle} onChange={v => { setEchelle(v as "pays" | "regions"); setQ(""); }}
              options={[{ cle: "pays", label: "Pays" }, { cle: "regions", label: "Régions" }]} />
          )}
          {echelle === "pays" && <ChampRecherche valeur={q} onChange={setQ} placeholder="Rechercher un pays" />}
        </View>
      }>
      {echelle === "regions" ? (
        continents.length ? continents.map(c => (
          <Groupe key={c.nom}>
            <LigneZone valeur={valeur} choisir={choisir} nom={c.nom} nb={c.nb} />
            {c.zones.map(z => <LigneZone valeur={valeur} choisir={choisir} key={z.cle} nom={z.zone} nb={z.nb} retrait />)}
          </Groupe>
        )) : <LigneVide texte="Aucune région relevée." />
      ) : resultats ? (
        <Groupe>
          {resultats.map(p => <LignePays valeur={valeur} choisir={choisir} key={p.nom} p={p} />)}
          {!resultats.length && <LigneVide texte="Aucun pays trouvé." />}
        </Groupe>
      ) : (
        <>
          {reference && <Groupe><LignePays valeur={valeur} choisir={choisir} p={reference} /></Groupe>}
          <Groupe>
            {regions.map(r => {
              const ouvert = ouverts.has(r.cle);
              return (
                <View key={r.cle}>
                  <LigneDepliable titre={r.zone} compte={fmtEntier(r.nb)} ouvert={ouvert}
                    onPress={() => basculerRegion(r.cle)} />
                  {ouvert && r.dedans.map(p => <LignePays valeur={valeur} choisir={choisir} key={p.nom} p={p} retrait />)}
                </View>
              );
            })}
          </Groupe>
        </>
      )}
    </Feuille>
  );
}
