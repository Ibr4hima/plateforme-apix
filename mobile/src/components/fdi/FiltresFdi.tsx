// Les filtres des Investissements projetés — une feuille par vue, appliquée
// en direct comme toutes les feuilles de filtres de l'app (Réinitialiser ·
// OK), dans les listes du système (ListeIOS), avec les règles de la colonne
// de filtres du site :
//
//   · AUCUNE FACETTE N'EN EXCLUT UNE AUTRE. Les valeurs restent toutes
//     affichées ; ce que la sélection change, c'est le COMPTE en regard —
//     zéro quand la combinaison est vide. On voit ce qu'on écarte au lieu de
//     le voir disparaître, et l'on peut toujours en changer.
//   · Une valeur cochée reste affichée même si les autres filtres la font
//     tomber à zéro : la retirer ôterait le moyen de la décocher.
//   · Secteur et sous-secteur sont EMBOÎTÉS : cocher un secteur ouvre ses
//     sous-secteurs, et en cocher un précise la sélection À L'INTÉRIEUR.
//   · Les signaux se filtrent à choix UNIQUE — recliquer retire le choix —,
//     les projets et les investisseurs à choix multiple.
//   · La période ouvre la feuille : c'est le cadre dans lequel tout le reste
//     se lit. Toute la période vaut « pas de filtre ».
import { useMemo, useState } from "react";
import { View } from "react-native";
import {
  ChampRecherche, EnTeteSection, Groupe, Ligne, LigneVide, SegmentsCapsule, SousEnTete,
} from "@/components/ListeIOS";
import { Os } from "@/components/Squelette";
import { Feuille } from "@/components/ui";
import { creerStyles } from "@/lib/apparence";
import {
  type ChoixSous, type Compte, type CompteSous, type FiltresEntreprises, type FiltresProjets,
  type FiltresSignaux, fmtEntier, plier, usePerimetreEntreprises, usePerimetreProjets,
  usePerimetreSignaux,
} from "@/lib/fdi";
import { IOS } from "@/lib/plateforme";
import { T } from "@/theme";
import CurseurPeriode from "./CurseurPeriode";
import { LARGEUR_FICHE } from "./FichesFdi";

// ── Briques ──────────────────────────────────────────────────────────────────

/** Une ligne de choix : le libellé, et le nombre que le choix rendrait. À
    zéro, la ligne s'estompe sans disparaître — elle dit ce qui n'existe pas
    dans la sélection. La coche d'iOS (orange pour un sous-secteur, comme le
    point de la plateforme) ; sur Android, la case à cocher — ou le bouton
    radio d'un choix unique (`unique`). */
function LigneChoix({ label, nb, sel, onPress, retrait = 0, orange, filetPlein, unique }: {
  label: string; nb?: number; sel: boolean; onPress: () => void; retrait?: number; orange?: boolean;
  /** La ligne ouvre une autre famille de la liste (régions, puis pays). */
  filetPlein?: boolean;
  unique?: boolean;
}) {
  return (
    <Ligne label={label} detail={nb != null ? fmtEntier(nb) : undefined} coche={sel}
      couleurCoche={orange ? T.orange : T.bleu} retrait={retrait} attenue={nb === 0 && !sel} filetPlein={filetPlein}
      role={unique && !IOS ? "radio" : "checkbox"} onPress={() => onPress()} />
  );
}

// Une liste de choix défile en elle-même au-delà de cette hauteur
const HAUTEUR_LISTE = 280;
const AUCUN = "Aucune valeur ne correspond.";

/** Les options d'une facette, plus celles qui sont cochées et que les autres
    filtres ont fait sortir de la liste. */
function avecCoches(options: Compte[], choix: string[]): Compte[] {
  const vus = new Set(options.map(o => o.nom));
  return [...options, ...choix.filter(c => !vus.has(c)).map(nom => ({ nom, nb: 0 }))];
}

/** Une facette à choix multiple. La recherche apparaît au-delà de douze
    valeurs : cent quarante pays d'origine ne se parcourent pas au pouce. */
function FacetteMulti({ titre, options, choix, onChange, chercher }: {
  titre: string; options: Compte[]; choix: string[]; onChange: (v: string[]) => void; chercher?: string;
}) {
  const [q, setQ] = useState("");
  const toutes = avecCoches(options, choix);
  if (!toutes.length) return null;
  const t = plier(q.trim());
  const visibles = t ? toutes.filter(o => plier(o.nom).includes(t)) : toutes;
  const basculer = (nom: string) =>
    onChange(choix.includes(nom) ? choix.filter(x => x !== nom) : [...choix, nom]);
  return (
    <View>
      <EnTeteSection titre={titre} nb={choix.length} />
      {toutes.length > 12 && (
        <ChampRecherche valeur={q} onChange={setQ} placeholder={chercher ?? "Rechercher…"} style={{ marginBottom: 8 }} />
      )}
      <Groupe hauteurMax={HAUTEUR_LISTE}>
        {visibles.map(o => (
          <LigneChoix key={o.nom} label={o.nom} nb={o.nb} sel={choix.includes(o.nom)} onPress={() => basculer(o.nom)} />
        ))}
        {!visibles.length && <LigneVide texte={AUCUN} />}
      </Groupe>
    </View>
  );
}

/** Une facette à choix UNIQUE : rien n'est coché au départ, et rien ne vaut
    « tout » — une facette vide montre déjà tout. Recliquer retire le choix.
    `groupe` sépare deux familles d'un filet (les régions, puis les pays) ;
    `cherchable: false` tient une valeur hors de portée de la recherche. */
type OptionUnique = Compte & { groupe?: string; cherchable?: boolean };

function FacetteUnique({ titre, options, valeur, onChange, chercher }: {
  titre: string; options: OptionUnique[]; valeur: string; onChange: (v: string) => void; chercher?: string;
}) {
  const [q, setQ] = useState("");
  const toutes: OptionUnique[] = valeur && !options.some(o => o.nom === valeur)
    ? [...options, { nom: valeur, nb: 0 }] : options;
  if (!toutes.length) return null;
  const t = plier(q.trim());
  const visibles = t ? toutes.filter(o => o.cherchable !== false && plier(o.nom).includes(t)) : toutes;
  return (
    <View>
      <EnTeteSection titre={titre} nb={valeur ? 1 : 0} />
      {chercher && toutes.length > 12 && (
        <ChampRecherche valeur={q} onChange={setQ} placeholder={chercher} style={{ marginBottom: 8 }} />
      )}
      <Groupe hauteurMax={HAUTEUR_LISTE}>
        {visibles.map((o, i) => (
          <LigneChoix key={`${o.groupe ?? ""}${o.nom}`} label={o.nom} nb={o.nb} sel={valeur === o.nom} unique
            filetPlein={i > 0 && o.groupe !== visibles[i - 1].groupe}
            onPress={() => onChange(valeur === o.nom ? "" : o.nom)} />
        ))}
        {!visibles.length && <LigneVide texte={AUCUN} />}
      </Groupe>
    </View>
  );
}

/** Le secteur et ses sous-secteurs, EMBOÎTÉS. Décocher un secteur emporte les
    sous-secteurs qu'on y avait précisés — les laisser filtrer depuis une
    section refermée serait invisible —, et la facette n'émet qu'UN appel
    portant les deux listes : deux écritures successives calculées sur la
    même valeur d'avant ressusciteraient le secteur qu'on vient de décocher. */
function FacetteSecteurs({ secteurs, sousSecteurs, choixSec, choixSous, onChange }: {
  secteurs: Compte[]; sousSecteurs: CompteSous[];
  choixSec: string[]; choixSous: ChoixSous[];
  onChange: (sec: string[], sous: ChoixSous[]) => void;
}) {
  const visibles = avecCoches(secteurs, choixSec);
  if (!visibles.length) return null;
  const basculerSecteur = (nom: string) => {
    if (!choixSec.includes(nom)) { onChange([...choixSec, nom], choixSous); return; }
    onChange(choixSec.filter(x => x !== nom), choixSous.filter(x => x.secteur !== nom));
  };
  const basculerSous = (secteur: string, nom: string) => {
    const deja = choixSous.some(x => x.nom === nom && x.secteur === secteur);
    onChange(choixSec, deja
      ? choixSous.filter(x => !(x.nom === nom && x.secteur === secteur))
      : [...choixSous, { secteur, nom }]);
  };
  return (
    <View>
      <EnTeteSection titre="Secteurs économiques" nb={choixSous.length || choixSec.length} />
      <Groupe hauteurMax={340}>
        {visibles.map(o => {
          const ouvert = choixSec.includes(o.nom);
          const dedans = sousSecteurs.filter(x => x.secteur === o.nom);
          return (
            <View key={o.nom}>
              <LigneChoix label={o.nom} nb={o.nb} sel={ouvert} onPress={() => basculerSecteur(o.nom)} />
              {/* Les sous-secteurs en retrait, sous leur légende orange */}
              {ouvert && dedans.length > 0 && (
                <>
                  <SousEnTete texte="Sous-secteurs" retrait={16} couleur={T.orange} />
                  {dedans.map(x => (
                    <LigneChoix key={x.nom} label={x.nom} nb={x.nb} orange retrait={16}
                      sel={choixSous.some(c => c.nom === x.nom && c.secteur === o.nom)}
                      onPress={() => basculerSous(o.nom, x.nom)} />
                  ))}
                </>
              )}
            </View>
          );
        })}
      </Groupe>
    </View>
  );
}

/** La période, entre les bornes du relevé ENTIER : réduire la plage ne
    rétrécit pas le curseur à la sélection qu'on vient de faire. */
function Periode({ bornes, debut, fin, onChange }: {
  bornes: [number | null, number | null]; debut: number | null; fin: number | null;
  onChange: (debut: number | null, fin: number | null) => void;
}) {
  const [b0, b1] = bornes;
  if (b0 == null || b1 == null || b1 <= b0) return null;
  const d = debut ?? b0, f = fin ?? b1;
  const curseur = (
    <CurseurPeriode min={b0} max={b1} debut={d} fin={f}
      onChange={(a, b) => onChange(a === b0 && b === b1 ? null : a, a === b0 && b === b1 ? null : b)} />
  );
  return (
    <View>
      <EnTeteSection titre="Période" nb={d !== b0 || f !== b1 ? 1 : 0} />
      {/* Le curseur dans son groupe, comme une commande de réglages */}
      <Groupe style={s.periode}>{curseur}</Groupe>
    </View>
  );
}

function Attente() {
  return (
    <View style={{ gap: 12 }}>
      <Os style={{ height: 10, width: "30%" }} />
      <Os style={{ height: 120, width: "100%", borderRadius: 12 }} />
      <Os style={{ height: 10, width: "40%", marginTop: 10 }} />
      <Os style={{ height: 160, width: "100%", borderRadius: 12 }} />
    </View>
  );
}

// ── Les trois feuilles ───────────────────────────────────────────────────────

/** La feuille des filtres, appliqués en direct : « Réinitialiser » et « OK »
    dans sa barre — celle d'une feuille d'UIKit sur iOS, des boutons texte de
    Material 3 sur Android —, les listes du système sur le fond des groupes. */
function FeuilleFiltres({ onClose, onReinitialiser, children }: {
  onClose: () => void; onReinitialiser: () => void; children: React.ReactNode;
}) {
  return (
    <Feuille onClose={onClose} titre="Filtres" ecart={26} largeurMax={LARGEUR_FICHE} fondGroupe
      actions={{
        gauche: { label: "Réinitialiser", onPress: () => onReinitialiser() },
        droite: { label: "OK", onPress: () => onClose() },
      }}>
      {children}
    </Feuille>
  );
}

export function FiltresProjetsSheet({ filtres, onChange, onReinitialiser, onClose }: {
  filtres: FiltresProjets; onChange: (f: FiltresProjets) => void;
  onReinitialiser: () => void; onClose: () => void;
}) {
  const per = usePerimetreProjets(filtres).data;
  return (
    <FeuilleFiltres onClose={onClose} onReinitialiser={onReinitialiser}>
      {!per ? <Attente /> : (
        <>
          {/* La bascule de sens n'apparaît que si les deux relevés existent :
              offrir la lecture inverse sans lui ouvrirait une liste vide. */}
          {per.sens_disponibles.length > 1 && (
            <View>
              <EnTeteSection titre="Sens de lecture" />
              <SegmentsCapsule compact valeur={filtres.sens}
                options={[{ cle: "destination", label: "Reçoit" }, { cle: "source", label: "Investit" }]}
                onChange={v => onChange({ ...filtres, sens: v as FiltresProjets["sens"] })} />
            </View>
          )}
          <Periode bornes={per.annees} debut={filtres.anneeMin} fin={filtres.anneeMax}
            onChange={(a, b) => onChange({ ...filtres, anneeMin: a, anneeMax: b })} />
          <FacetteSecteurs secteurs={per.secteurs} sousSecteurs={per.sous_secteurs}
            choixSec={filtres.secteurs} choixSous={filtres.sousSecteurs}
            onChange={(secteurs, sousSecteurs) => onChange({ ...filtres, secteurs, sousSecteurs })} />
          <FacetteMulti titre="Activités économiques" options={per.activites} choix={filtres.activites}
            onChange={activites => onChange({ ...filtres, activites })} />
          <FacetteMulti titre="Type de projet" options={per.types} choix={filtres.types}
            onChange={types => onChange({ ...filtres, types })} />
        </>
      )}
    </FeuilleFiltres>
  );
}

export function FiltresSignauxSheet({ filtres, onChange, onReinitialiser, onClose }: {
  filtres: FiltresSignaux; onChange: (f: FiltresSignaux) => void;
  onReinitialiser: () => void; onClose: () => void;
}) {
  const per = usePerimetreSignaux(filtres).data;
  // Les régions d'abord, les pays ensuite, séparés d'un filet ; la recherche
  // ne porte que sur les pays — les régions, en tête, se prennent du regard
  const destinations = useMemo(() => (per?.destinations ?? []).map(d => ({
    ...d, groupe: d.nature, cherchable: d.nature === "pays",
  })), [per]);
  const set = <K extends keyof FiltresSignaux>(k: K) => (v: FiltresSignaux[K]) => onChange({ ...filtres, [k]: v });
  return (
    <FeuilleFiltres onClose={onClose} onReinitialiser={onReinitialiser}>
      {!per ? <Attente /> : (
        <>
          <Periode bornes={per.annees} debut={filtres.anneeMin} fin={filtres.anneeMax}
            onChange={(a, b) => onChange({ ...filtres, anneeMin: a, anneeMax: b })} />
          {/* D'OÙ PART L'INTENTION, puis OÙ ELLE VA : les deux questions
              géographiques se lisent ensemble, avant le secteur. */}
          <FacetteUnique titre="Pays d'origine" options={per.origines} valeur={filtres.origine}
            onChange={set("origine")} chercher="Rechercher un pays…" />
          <FacetteUnique titre="Destination" options={destinations} valeur={filtres.destination}
            onChange={set("destination")} chercher="Rechercher un pays…" />
          <FacetteUnique titre="Secteurs économiques" options={per.secteurs} valeur={filtres.secteur}
            onChange={set("secteur")} />
          <FacetteUnique titre="Activités économiques" options={per.activites} valeur={filtres.activite}
            onChange={set("activite")} />
        </>
      )}
    </FeuilleFiltres>
  );
}

export function FiltresEntreprisesSheet({ filtres, onChange, onReinitialiser, onClose }: {
  filtres: FiltresEntreprises; onChange: (f: FiltresEntreprises) => void;
  onReinitialiser: () => void; onClose: () => void;
}) {
  const per = usePerimetreEntreprises(filtres).data;
  return (
    <FeuilleFiltres onClose={onClose} onReinitialiser={onReinitialiser}>
      {!per ? <Attente /> : (
        <>
          {/* LE PAYS D'ORIGINE OUVRE LA FEUILLE : il dit QUI l'on regarde —
              cocher « France » retient les investisseurs FRANÇAIS, avec tous
              leurs projets —, quand les suivantes disent ce qu'ils font. Les
              comptes sont des nombres d'INVESTISSEURS. */}
          <FacetteMulti titre="Pays d'origine" options={per.origines} choix={filtres.origines}
            onChange={origines => onChange({ ...filtres, origines })} chercher="Rechercher un pays…" />
          {/* La destination qualifie le PROJET : sous « Nigeria », un groupe
              apparaît avec ses seuls projets nigérians en regard. */}
          <FacetteMulti titre="Destination" options={per.destinations} choix={filtres.destinations}
            onChange={destinations => onChange({ ...filtres, destinations })} chercher="Rechercher un pays…" />
          <FacetteSecteurs secteurs={per.secteurs} sousSecteurs={per.sous_secteurs}
            choixSec={filtres.secteurs} choixSous={filtres.sousSecteurs}
            onChange={(secteurs, sousSecteurs) => onChange({ ...filtres, secteurs, sousSecteurs })} />
          <FacetteMulti titre="Activités économiques" options={per.activites} choix={filtres.activites}
            onChange={activites => onChange({ ...filtres, activites })} />
        </>
      )}
    </FeuilleFiltres>
  );
}

const s = creerStyles(() => ({
  periode: { paddingHorizontal: 16, paddingVertical: 14 },
}));
