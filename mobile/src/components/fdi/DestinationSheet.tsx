// Choisir la DESTINATION lue — un pays, ou une région entière.
//
// La question de l'écran des projets est « que reçoit… ? ». Elle se pose à
// deux échelles : un pays (« que reçoit le Sénégal ») ou une région (« que
// reçoit l'Afrique de l'Ouest »). Les deux s'excluent : une seule part dans la
// requête, et la feuille ne montre jamais les deux listes à la fois.
//
//   · Pays    — le Sénégal épinglé en tête sous un tag « Réf. » (il est la
//               référence de la plateforme), puis les pays rangés par région
//               en accordéons. La recherche court-circuite la hiérarchie.
//   · Régions — le continent d'abord (le plus large : on restreint depuis le
//               large), puis ses régions, raccrochées à lui par un rail.
//
// Ne sont proposés que les pays dont le relevé est COMPLET : les autres
// n'apparaissent dans la base que pour ce qu'ils ont échangé avec un pays
// relevé, et les proposer laisserait croire à une couverture qu'on n'a pas.
// Le compte d'une région est la somme de ses pays : un projet n'a qu'une
// destination, aucun n'est compté deux fois.
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Icone from "@/components/Icone";
import { ChampRecherche, Groupe, Ligne, LigneDepliable, LigneVide } from "@/components/ListeIOS";
import { Feuille, Tapable } from "@/components/ui";
import { creerStyles } from "@/lib/apparence";
import { type ComptePays, PAYS_REFERENCE, fmtEntier, plier } from "@/lib/fdi";
import { cran, tick } from "@/lib/haptique";
import { IOS } from "@/lib/plateforme";
import { POLICE, T } from "@/theme";
import { LARGEUR_FICHE } from "./FichesFdi";
import { Segments } from "./FiltresFdi";

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

// ── iOS : les lignes des listes groupées ──
function PaysIOS({ p, retrait, valeur, choisir }: {
  p: ComptePays; retrait?: boolean; valeur: Destination; choisir: (d: Destination) => void;
}) {
  return (
    <Ligne label={p.nom} legende={p.nom === PAYS_REFERENCE ? "Pays de référence" : undefined}
      detail={fmtEntier(p.nb)} coche={valeur.echelle === "pays" && valeur.pays === p.nom}
      retrait={retrait ? 16 : 0} lignes={1}
      onPress={() => choisir({ echelle: "pays", pays: p.nom, region: valeur.region })} />
  );
}

function ZoneIOS({ nom, nb, retrait, valeur, choisir }: {
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

  const choisir = (d: Destination) => { cran(); onChoisir(d); onClose(); };
  const basculerRegion = (cle: string) =>
    setOuverts(prev => { const n = new Set(prev); n.has(cle) ? n.delete(cle) : n.add(cle); return n; });

  // ── iOS : les listes groupées du système ──
  // Les régions forment UNE liste à déplier (le chevron dit si elle est
  // ouverte, ses pays viennent en retrait) plutôt qu'une pile d'accordéons ;
  // la référence garde sa place en tête, sa légende dit pourquoi.
  if (IOS) {
    return (
      <Feuille onClose={onClose} ecart={22} largeurMax={LARGEUR_FICHE} fondGroupe
        titre={<Text style={s.titre}>Destination</Text>}
        sousEntete={
          <View style={{ gap: 10, marginTop: 14 }}>
            {regionsPermises && (
              <Segments valeur={echelle} onChange={v => { setEchelle(v as "pays" | "regions"); setQ(""); }}
                options={[{ cle: "pays", label: "Pays" }, { cle: "regions", label: "Régions" }]} />
            )}
            {echelle === "pays" && <ChampRecherche valeur={q} onChange={setQ} placeholder="Rechercher un pays" />}
          </View>
        }>
        {echelle === "regions" ? (
          continents.length ? continents.map(c => (
            <Groupe key={c.nom}>
              <ZoneIOS valeur={valeur} choisir={choisir} nom={c.nom} nb={c.nb} />
              {c.zones.map(z => <ZoneIOS valeur={valeur} choisir={choisir} key={z.cle} nom={z.zone} nb={z.nb} retrait />)}
            </Groupe>
          )) : <LigneVide texte="Aucune région relevée." />
        ) : resultats ? (
          <Groupe>
            {resultats.map(p => <PaysIOS valeur={valeur} choisir={choisir} key={p.nom} p={p} />)}
            {!resultats.length && <LigneVide texte="Aucun pays trouvé." />}
          </Groupe>
        ) : (
          <>
            {reference && <Groupe><PaysIOS valeur={valeur} choisir={choisir} p={reference} /></Groupe>}
            <Groupe>
              {regions.map(r => {
                const ouvert = ouverts.has(r.cle);
                return (
                  <View key={r.cle}>
                    <LigneDepliable titre={r.zone} compte={fmtEntier(r.nb)} ouvert={ouvert}
                      onPress={() => basculerRegion(r.cle)} />
                    {ouvert && r.dedans.map(p => <PaysIOS valeur={valeur} choisir={choisir} key={p.nom} p={p} retrait />)}
                  </View>
                );
              })}
            </Groupe>
          </>
        )}
      </Feuille>
    );
  }

  const LignePays = ({ p, premier, estRef }: { p: ComptePays; premier: boolean; estRef?: boolean }) => {
    const actif = valeur.echelle === "pays" && valeur.pays === p.nom;
    return (
      <Tapable echelle={0.99} onPress={() => choisir({ echelle: "pays", pays: p.nom, region: valeur.region })}
        style={[s.ligne, !premier && s.ligneBord]} accessibilityRole="button"
        accessibilityState={{ selected: actif }} accessibilityLabel={`${p.nom}, ${p.nb} projets`}>
        <Text style={[s.ligneNom, actif && s.ligneNomActif]} numberOfLines={1}>{p.nom}</Text>
        {estRef && <View style={s.tagRef}><Text style={s.tagRefTexte}>Réf.</Text></View>}
        <Text style={s.ligneNb}>{fmtEntier(p.nb)}</Text>
        <View style={s.coche}>
          {actif && <Icone sf="checkmark" materiel="check" taille={16} couleur={T.bleu} />}
        </View>
      </Tapable>
    );
  };

  const LigneZone = ({ nom, nb, premier, retrait }: { nom: string; nb: number; premier: boolean; retrait?: boolean }) => {
    const actif = valeur.echelle === "regions" && valeur.region === nom;
    return (
      <Tapable echelle={0.99} onPress={() => choisir({ echelle: "regions", pays: valeur.pays, region: nom })}
        style={[s.ligne, !premier && s.ligneBord, retrait && s.ligneRetrait]} accessibilityRole="button"
        accessibilityState={{ selected: actif }} accessibilityLabel={`${nom}, ${nb} projets`}>
        <Text style={[s.ligneNom, !retrait && s.ligneContinent, actif && s.ligneNomActif]} numberOfLines={1}>{nom}</Text>
        <Text style={s.ligneNb}>{fmtEntier(nb)}</Text>
        <View style={s.coche}>
          {actif && <Icone sf="checkmark" materiel="check" taille={16} couleur={T.bleu} />}
        </View>
      </Tapable>
    );
  };

  return (
    <Feuille onClose={onClose} ecart={12} hauteur="86%" largeurMax={LARGEUR_FICHE}
      titre={<Text style={s.titre}>Destination</Text>}
      sousEntete={
        <View style={{ gap: 10, marginTop: 10 }}>
          {regionsPermises && (
            <Segments valeur={echelle} onChange={v => { setEchelle(v as "pays" | "regions"); setQ(""); }}
              options={[{ cle: "pays", label: "Pays" }, { cle: "regions", label: "Régions" }]} />
          )}
          {echelle === "pays" && (
            <View style={s.champ}>
              <Icone sf="magnifyingglass" materiel="search" taille={15} couleur={T.gris} />
              <TextInput value={q} onChangeText={setQ} placeholder="Rechercher un pays"
                placeholderTextColor={T.grisClair as any} autoCorrect={false}
                clearButtonMode="while-editing" style={s.champTexte} />
            </View>
          )}
        </View>
      }>
      {echelle === "regions" ? (
        <View style={{ gap: 10 }}>
          {continents.map(c => (
            <View key={c.nom} style={s.surface}>
              <LigneZone nom={c.nom} nb={c.nb} premier />
              {c.zones.map(z => <LigneZone key={z.cle} nom={z.zone} nb={z.nb} premier={false} retrait />)}
            </View>
          ))}
          {!continents.length && <Text style={s.vide}>Aucune région relevée.</Text>}
        </View>
      ) : resultats ? (
        <View style={s.surface}>
          {resultats.map((p, i) => <LignePays key={p.nom} p={p} premier={i === 0} estRef={p.nom === PAYS_REFERENCE} />)}
          {!resultats.length && <Text style={s.vide}>Aucun pays trouvé.</Text>}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {/* La référence, au-dessus de tout le reste. Elle garde aussi sa
              place dans sa région, où l'œil ira la chercher s'il y descend. */}
          {reference && (
            <View style={s.surface}><LignePays p={reference} premier estRef /></View>
          )}
          {regions.map(r => {
            const ouvert = ouverts.has(r.cle);
            return (
              <View key={r.cle}>
                <Tapable echelle={0.99} accessibilityRole="button" accessibilityState={{ expanded: ouvert }}
                  onPress={() => { tick(); basculerRegion(r.cle); }}
                  style={[s.groupe, ouvert && s.groupeOuvert]}>
                  <Text style={s.groupeTexte} numberOfLines={1}>{r.zone.toUpperCase()}</Text>
                  <Text style={s.groupeCompte}>{fmtEntier(r.nb)}</Text>
                  <Ionicons name={ouvert ? "chevron-down" : "chevron-forward"} size={13} color={T.bleu as any} />
                </Tapable>
                {ouvert && (
                  <View style={s.surface}>
                    {r.dedans.map((p, i) => <LignePays key={p.nom} p={p} premier={i === 0} estRef={p.nom === PAYS_REFERENCE} />)}
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
    flexDirection: "row", alignItems: "center", gap: 8,
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
  ligne: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  ligneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  ligneRetrait: { paddingLeft: 28 },
  ligneNom: { flex: 1, fontSize: 13.5, fontFamily: POLICE.demi, color: T.encre },
  ligneContinent: { fontFamily: POLICE.gras },
  ligneNomActif: { color: T.bleu, fontFamily: POLICE.gras },
  ligneNb: { fontSize: 11.5, fontFamily: POLICE.demi, color: T.gris, fontVariant: ["tabular-nums"] },
  coche: { width: 18, alignItems: "center" },
  tagRef: { backgroundColor: T.bleuVoile, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2.5 },
  tagRefTexte: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 0.4 },
  vide: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", paddingVertical: 20 },
}));
