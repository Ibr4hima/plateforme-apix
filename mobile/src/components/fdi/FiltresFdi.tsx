// Les filtres des Investissements projetés — une feuille par vue, appliquée
// en direct comme toutes les feuilles de filtres de l'app (Réinitialiser /
// Terminé), avec les règles de la colonne de filtres du site :
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
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { FeuilleFiltres } from "@/components/FiltresListe";
import {
  ChampRecherche, EnTeteSection, Groupe, Ligne as LigneIOS, LigneVide, SegmentsIOS, SousEnTete,
} from "@/components/ListeIOS";
import { Os } from "@/components/Squelette";
import { creerStyles, useCouleur } from "@/lib/apparence";
import {
  type ChoixSous, type Compte, type CompteSous, type FiltresEntreprises, type FiltresProjets,
  type FiltresSignaux, fmtEntier, plier, usePerimetreEntreprises, usePerimetreProjets,
  usePerimetreSignaux,
} from "@/lib/fdi";
import { tick } from "@/lib/haptique";
import { IOS } from "@/lib/plateforme";
import { ECHELLE, POLICE, T } from "@/theme";
import CurseurPeriode from "./CurseurPeriode";
import { LARGEUR_FICHE } from "./FichesFdi";

// ── Briques ──────────────────────────────────────────────────────────────────

function Titre({ titre, nb }: { titre: string; nb?: number }) {
  // iOS : l'en-tête d'une section groupée
  if (IOS) return <EnTeteSection titre={titre} nb={nb} />;
  return (
    <View style={s.titreLigne}>
      <Text style={s.titre} accessibilityRole="header">{titre.toUpperCase()}</Text>
      {nb ? <Text style={s.titreBadge}>{nb}</Text> : null}
    </View>
  );
}

/** Une ligne de choix : le point de sélection de la plateforme, le libellé,
    et le nombre que le choix rendrait. À zéro, la ligne s'estompe sans
    disparaître — elle dit ce qui n'existe pas dans la sélection. */
function Ligne({ label, nb, sel, onPress, retrait = 0, orange, filetPlein }: {
  label: string; nb?: number; sel: boolean; onPress: () => void; retrait?: number; orange?: boolean;
  /** iOS : la ligne ouvre une autre famille de la liste (régions, puis pays). */
  filetPlein?: boolean;
}) {
  const couleur = useCouleur(orange ? T.orange : T.bleu) as unknown as string;
  const grisPoint = useCouleur(T.grisClair) as unknown as string;
  const vide = nb === 0 && !sel;
  // iOS : la ligne d'une liste groupée — le nombre en détail gris, la coche
  // à droite (orange pour un sous-secteur, comme le point de la plateforme)
  if (IOS) return (
    <LigneIOS label={label} detail={nb != null ? fmtEntier(nb) : undefined} coche={sel}
      couleurCoche={orange ? T.orange : T.bleu} retrait={retrait} attenue={vide} filetPlein={filetPlein}
      role="checkbox" onPress={() => { tick(); onPress(); }} />
  );
  return (
    <Pressable onPress={() => { tick(); onPress(); }}
      accessibilityRole="checkbox" accessibilityState={{ checked: sel }}
      accessibilityLabel={nb != null ? `${label}, ${nb}` : label}
      style={({ pressed }) => [s.ligne, { paddingLeft: 8 + retrait }, pressed && { backgroundColor: T.champ }, vide && { opacity: 0.45 }]}>
      <View style={[s.point, { borderColor: grisPoint }, sel && { borderColor: couleur, backgroundColor: couleur }]} />
      <Text style={[s.ligneTexte, sel && { fontFamily: POLICE.gras, color: orange ? couleur : T.encre }]}
        numberOfLines={2}>{label}</Text>
      {nb != null && <Text style={s.ligneNb}>{fmtEntier(nb)}</Text>}
    </Pressable>
  );
}

/** Le cadre d'une liste de choix : elle défile dedans, rien ne déborde. */
function Cadre({ hauteurMax = 280, children }: { hauteurMax?: number; children: React.ReactNode }) {
  if (IOS) return <Groupe hauteurMax={hauteurMax}>{children}</Groupe>;
  return (
    <View style={s.cadre}>
      <ScrollView style={{ maxHeight: hauteurMax }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

function Champ({ valeur, onChange, placeholder }: { valeur: string; onChange: (v: string) => void; placeholder: string }) {
  if (IOS) return <ChampRecherche valeur={valeur} onChange={onChange} placeholder={placeholder} style={{ marginBottom: 8 }} />;
  return (
    <TextInput value={valeur} onChangeText={onChange} placeholder={placeholder}
      placeholderTextColor={T.gris as any} autoCorrect={false} clearButtonMode="while-editing"
      style={s.champ} />
  );
}

/** Le message d'une liste que la recherche a vidée. */
function Aucun() {
  if (IOS) return <LigneVide texte="Aucune valeur ne correspond." />;
  return <Text style={s.aucun}>Aucune valeur ne correspond.</Text>;
}

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
      <Titre titre={titre} nb={choix.length} />
      {toutes.length > 12 && <Champ valeur={q} onChange={setQ} placeholder={chercher ?? "Rechercher…"} />}
      <Cadre>
        {visibles.map(o => (
          <Ligne key={o.nom} label={o.nom} nb={o.nb} sel={choix.includes(o.nom)} onPress={() => basculer(o.nom)} />
        ))}
        {!visibles.length && <Aucun />}
      </Cadre>
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
      <Titre titre={titre} nb={valeur ? 1 : 0} />
      {chercher && toutes.length > 12 && <Champ valeur={q} onChange={setQ} placeholder={chercher} />}
      <Cadre>
        {visibles.map((o, i) => {
          const autreFamille = i > 0 && o.groupe !== visibles[i - 1].groupe;
          return (
            <View key={`${o.groupe ?? ""}${o.nom}`}>
              {autreFamille && !IOS && <View style={s.filetGroupe} />}
              <Ligne label={o.nom} nb={o.nb} sel={valeur === o.nom} filetPlein={autreFamille}
                onPress={() => onChange(valeur === o.nom ? "" : o.nom)} />
            </View>
          );
        })}
        {!visibles.length && <Aucun />}
      </Cadre>
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
      <Titre titre="Secteurs économiques" nb={choixSous.length || choixSec.length} />
      <Cadre hauteurMax={340}>
        {visibles.map(o => {
          const ouvert = choixSec.includes(o.nom);
          const dedans = sousSecteurs.filter(x => x.secteur === o.nom);
          return (
            <View key={o.nom}>
              <Ligne label={o.nom} nb={o.nb} sel={ouvert} onPress={() => basculerSecteur(o.nom)} />
              {ouvert && dedans.length > 0 && (IOS ? (
                // iOS : les sous-secteurs en retrait, sous leur légende orange
                <>
                  <SousEnTete texte="Sous-secteurs" retrait={16} couleur={T.orange} />
                  {dedans.map(x => (
                    <Ligne key={x.nom} label={x.nom} nb={x.nb} orange retrait={16}
                      sel={choixSous.some(c => c.nom === x.nom && c.secteur === o.nom)}
                      onPress={() => basculerSous(o.nom, x.nom)} />
                  ))}
                </>
              ) : (
                <View style={s.sous}>
                  <Text style={s.sousTitre}>SOUS-SECTEUR</Text>
                  {dedans.map(x => (
                    <Ligne key={x.nom} label={x.nom} nb={x.nb} orange
                      sel={choixSous.some(c => c.nom === x.nom && c.secteur === o.nom)}
                      onPress={() => basculerSous(o.nom, x.nom)} />
                  ))}
                </View>
              ))}
            </View>
          );
        })}
      </Cadre>
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
      <Titre titre="Période" nb={d !== b0 || f !== b1 ? 1 : 0} />
      {/* iOS : le curseur dans son groupe, comme une commande de réglages */}
      {IOS ? <Groupe style={s.periodeIOS}>{curseur}</Groupe> : <View style={s.periode}>{curseur}</View>}
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

export function FiltresProjetsSheet({ filtres, onChange, onReinitialiser, onClose }: {
  filtres: FiltresProjets; onChange: (f: FiltresProjets) => void;
  onReinitialiser: () => void; onClose: () => void;
}) {
  const per = usePerimetreProjets(filtres).data;
  return (
    <FeuilleFiltres onClose={onClose} onReinitialiser={onReinitialiser} largeurMax={LARGEUR_FICHE}>
      {!per ? <Attente /> : (
        <>
          {/* La bascule de sens n'apparaît que si les deux relevés existent :
              offrir la lecture inverse sans lui ouvrirait une liste vide. */}
          {per.sens_disponibles.length > 1 && (
            <View>
              <Titre titre="Sens de lecture" />
              <Segments valeur={filtres.sens}
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
    <FeuilleFiltres onClose={onClose} onReinitialiser={onReinitialiser} largeurMax={LARGEUR_FICHE}>
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
    <FeuilleFiltres onClose={onClose} onReinitialiser={onReinitialiser} largeurMax={LARGEUR_FICHE}>
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

/** Une bascule segmentée — la piste de la plateforme, l'actif en carte. */
export function Segments({ options, valeur, onChange }: {
  options: { cle: string; label: string }[]; valeur: string; onChange: (cle: string) => void;
}) {
  // iOS : le contrôle segmenté du système
  if (IOS) return <SegmentsIOS options={options} valeur={valeur} onChange={onChange} />;
  return (
    <View style={s.segments}>
      {options.map(o => {
        const actif = valeur === o.cle;
        return (
          <Pressable key={o.cle} onPress={() => { if (!actif) { tick(); onChange(o.cle); } }}
            accessibilityRole="tab" accessibilityState={{ selected: actif }}
            style={[s.segment, actif && s.segmentActif]}>
            <Text style={[s.segmentTexte, actif && s.segmentTexteActif]} numberOfLines={1}
              maxFontSizeMultiplier={ECHELLE.compact}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = creerStyles(() => ({
  titreLigne: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  titre: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.6 },
  titreBadge: {
    fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, backgroundColor: T.blocBord,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden", fontVariant: ["tabular-nums"],
  },
  cadre: {
    backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.bordureDouce,
    borderRadius: 12, borderCurve: "continuous", paddingHorizontal: 6, paddingVertical: 4, overflow: "hidden",
  },
  ligne: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingRight: 8, borderRadius: 8 },
  point: { width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  ligneTexte: { flex: 1, fontSize: 13, lineHeight: 17, fontFamily: POLICE.normal, color: T.texte },
  ligneNb: { fontSize: 11, fontFamily: POLICE.demi, color: T.gris, fontVariant: ["tabular-nums"] },
  sous: {
    marginLeft: 13, paddingLeft: 6, marginBottom: 4,
    borderLeftWidth: 2, borderLeftColor: "rgba(202,99,31,0.28)",
  },
  sousTitre: { fontSize: 9, fontFamily: POLICE.gras, letterSpacing: 1.1, color: T.orange, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 2 },
  filetGroupe: { height: StyleSheet.hairlineWidth, backgroundColor: T.bordure, marginVertical: 5, marginHorizontal: 8 },
  aucun: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.gris, paddingVertical: 8, paddingLeft: 8 },
  champ: {
    backgroundColor: T.champ, borderWidth: 1, borderColor: T.bordure, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, fontFamily: POLICE.normal, color: T.encre, marginBottom: 8,
  },
  periode: { paddingHorizontal: 4 },
  periodeIOS: { paddingHorizontal: 16, paddingVertical: 14 },
  segments: { flexDirection: "row", padding: 3.5, gap: 4, backgroundColor: T.voile, borderRadius: 999 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 999 },
  segmentActif: {
    backgroundColor: T.carte,
    shadowColor: "#001e3c", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentTexte: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.gris },
  segmentTexteActif: { color: T.bleu, fontFamily: POLICE.gras },
}));
