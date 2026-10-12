// Les briques visuelles des Investissements projetés — drapeaux, montants, et
// les trois cartes de liste (projet, signal, investisseur).
//
// LES CARTES PARLENT LA LANGUE DE L'APP. Elles reprennent le gabarit de
// Prospects, des Accords & Traités, des Zones et des Opportunités : contour
// fin sans ombre, le nom en titre, un sous-titre gris qui le date, puis, sous
// un filet, la rangée de faits — étiquette en petites capitales, valeur
// dessous. Qui passe des Prospects aux projets annoncés lit la même carte.
//
// NI PASTILLE DE CATÉGORIE NI SECTEUR — ni le stade d'un signal
// (« Financement levé »), ni le type d'un projet (« Extension »), ni le
// secteur d'activité : la carte dit qui, quand, d'où, combien ; le reste se
// lit en clair dans la fiche, et se filtre.
import { Fragment } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { Tapable } from "@/components/ui";
import { creerStyles } from "@/lib/apparence";
import { drapeauEmoji } from "@/lib/drapeaux";
import {
  type Investisseur, type ProjetFdi, type Signal,
  accorder, fmtEntier, fmtMillions, moisEnClair, periodeEnClair,
} from "@/lib/fdi";
import { ECHELLE, POLICE, T } from "@/theme";

/** Le drapeau d'un pays, quand le référentiel le connaît. Un pays non
    rapproché n'en a pas : le nom reste, sans place réservée. */
export function Drapeau({ iso, taille = 14 }: { iso: string | null | undefined; taille?: number }) {
  const emoji = drapeauEmoji(iso);
  if (!emoji) return null;
  return <Text style={{ fontSize: taille, lineHeight: taille * 1.25 }} maxFontSizeMultiplier={ECHELLE.compact}>{emoji}</Text>;
}

/** Un pays : son drapeau puis son nom, sur une ligne. */
export function PaysDrapeau({ iso, nom, style, taille = 14, lignes = 1 }: {
  iso: string | null | undefined; nom: string | null | undefined;
  style?: StyleProp<TextStyle>; taille?: number; lignes?: number;
}) {
  return (
    <View style={s.pays}>
      <Drapeau iso={iso} taille={taille} />
      <Text style={[s.paysNom, style]} numberOfLines={lignes}>{nom || "—"}</Text>
    </View>
  );
}

/** Un montant de fiche : la valeur, son unité petite à côté, et l'estimation
    signalée par « ≈ » sans occuper la ligne. Le « ≈ » reste à l'encre : il
    qualifie la valeur, il ne l'alerte pas. */
export function Montant({ v, estime, unite, taille = 13.5, couleur }: {
  v: number | null; estime: boolean | null; unite: string; taille?: number; couleur?: string;
}) {
  if (v == null) return <Text style={[s.montant, { fontSize: taille, color: T.grisClair }]}>—</Text>;
  return (
    <Text style={[s.montant, { fontSize: taille }, couleur ? { color: couleur } : null]} numberOfLines={1}
      maxFontSizeMultiplier={ECHELLE.chiffre}
      accessibilityLabel={`${estime ? "environ " : ""}${fmtMillions(v)} ${unite}${estime ? ", valeur estimée" : ""}`}>
      {estime ? <Text style={{ fontSize: taille * 0.85 }}>≈ </Text> : null}
      {fmtMillions(v)}
      <Text style={[s.unite, { fontSize: Math.max(9.5, taille * 0.66) }]}> {unite}</Text>
    </Text>
  );
}

/** Ce que « ≈ » veut dire. Le site le dit au survol ; un téléphone ne survole
    pas : une ligne discrète, une seule fois, sous ce qui l'emploie. */
export const NoteEstimation = ({ style }: { style?: StyleProp<TextStyle> }) => (
  <Text style={[s.note, style]}>
    ≈ valeur estimée par le Financial Times, non déclarée par l'entreprise.
  </Text>
);

// ── Les trois cartes ─────────────────────────────────────────────────────────

/** Un montant de carte, en millions de dollars : « 56,6 M $ », « 1,4 Md $ ». */
function montantCourt(v: number | null, estime: boolean | null): string {
  if (v == null) return "—";
  const nf = (x: number) => x.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return `${estime ? "≈ " : ""}${Math.abs(v) >= 1000 ? `${nf(v / 1000)} Md $` : `${nf(v)} M $`}`;
}

/** Des emplois de carte : « 415 », « ≈ 38 ». */
function emploisCourts(v: number | null, estime: boolean | null): string {
  if (v == null) return "—";
  return `${estime ? "≈ " : ""}${fmtEntier(v)}`;
}

/** Un fait de la rangée basse. Un pays y porte son drapeau ; `poids` règle la
    part de largeur — un nom de pays en demande plus qu'un montant. */
type Fait = { label: string; valeur: string; iso?: string | null; vide?: boolean; poids?: number };

const faitPays = (label: string, nom: string | null, iso: string | null, poids = 1.4): Fait =>
  ({ label, valeur: nom ?? "—", iso, vide: !nom, poids });

/** Le gabarit des cartes de la plateforme — celui de Prospects et des
    Accords & Traités : le titre mène, le sous-titre situe ; sous le filet,
    les faits côte à côte, séparés d'un trait fin. */
function Gabarit({ onPress, titre, sousTitre, faits, libelle }: {
  onPress: () => void; titre: string; sousTitre?: string | null;
  faits: Fait[]; libelle: string;
}) {
  return (
    <Tapable onPress={onPress} echelle={0.985} style={s.carte} accessibilityRole="button" accessibilityLabel={libelle}>
      {/* La tête prend la hauteur libre : en grille, la carte s'étire à la
          hauteur de sa rangée, et les faits d'une même rangée restent alignés */}
      <View style={s.tete}>
        <Text style={s.titre} numberOfLines={1}>{titre}</Text>
        {sousTitre ? <Text style={s.sousTitre} numberOfLines={1}>{sousTitre}</Text> : null}
      </View>
      <View style={s.faits}>
        {faits.map((f, i) => (
          <Fragment key={f.label}>
            {i > 0 ? <View style={s.faitSep} /> : null}
            <View style={{ flex: f.poids ?? 1, minWidth: 0 }}>
              <Text style={s.faitLabel} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.compact}>{f.label}</Text>
              <View style={s.faitLigne}>
                <Drapeau iso={f.iso} taille={12} />
                <Text style={[s.faitVal, f.vide && { color: T.grisClair }]} numberOfLines={1}>{f.valeur}</Text>
              </View>
            </View>
          </Fragment>
        ))}
      </View>
    </Tapable>
  );
}

/** Un projet annoncé. Le sous-titre le date ; les faits disent d'où il
    vient, combien, et combien d'emplois. Lu depuis
    la source, le pays d'en face devient la destination ; lu à l'échelle
    d'une région, les deux pays s'affichent — une liste « Afrique » mêle
    cinquante destinations — et les emplois restent dans la fiche. */
export function CarteProjetFdi({ p, onPress, avecDestination, sensSource }: {
  p: ProjetFdi; onPress: () => void; avecDestination?: boolean; sensSource?: boolean;
}) {
  // `pays` est le pays lu, `partenaire` celui d'en face
  const origine = sensSource ? { nom: p.pays, iso: p.pays_iso } : { nom: p.partenaire, iso: p.partenaire_iso };
  const destination = sensSource ? { nom: p.partenaire, iso: p.partenaire_iso } : { nom: p.pays, iso: p.pays_iso };
  const montant: Fait = { label: "MONTANT", valeur: montantCourt(p.capex_musd, p.capex_estime), vide: p.capex_musd == null };
  const faits: Fait[] = avecDestination
    ? [faitPays("ORIGINE", origine.nom, origine.iso, 1.2), faitPays("DESTINATION", destination.nom, destination.iso, 1.2), montant]
    : [sensSource ? faitPays("DESTINATION", destination.nom, destination.iso) : faitPays("ORIGINE", origine.nom, origine.iso),
       montant,
       { label: "EMPLOIS", valeur: emploisCourts(p.emplois, p.emplois_estime), vide: p.emplois == null, poids: 0.8 }];
  return (
    <Gabarit onPress={onPress} titre={p.entreprise ?? "—"}
      sousTitre={moisEnClair(p.periode)}
      faits={faits}
      libelle={`${p.entreprise ?? "Projet"}, ${origine.nom ?? ""} vers ${destination.nom ?? ""}, ${moisEnClair(p.periode)}`} />
  );
}

/** Un signal : les faits disent d'où part l'intention et où elle va. Les
    autres destinations ne disparaissent pas : leur nombre est dit. Pas de
    colonne montant : sept signaux sur dix n'en publient aucun. Le stade se
    lit dans la fiche — et la lecture vocale le dit dès la carte. */
export function CarteSignal({ s: sg, onPress }: { s: Signal; onPress: () => void }) {
  const stade = sg.natures[0];
  const court = stade?.court ?? stade?.libelle ?? null;
  const premiere = sg.destinations[0]?.libelle ?? null;
  const autres = sg.destinations.length > 1 ? ` +${sg.destinations.length - 1}` : "";
  return (
    <Gabarit onPress={onPress} titre={sg.entreprise ?? "—"}
      sousTitre={moisEnClair(sg.periode)}
      faits={[
        faitPays("ORIGINE", sg.origine, sg.origine_iso, 1),
        { label: "DESTINATION", valeur: premiere ? `${premiere}${autres}` : "—", vide: !premiere },
      ]}
      libelle={`${sg.entreprise ?? "Signal"}, ${court ?? ""}, ${sg.origine ?? ""} vers ${premiere ?? ""}, ${moisEnClair(sg.periode)}`} />
  );
}

/** Un investisseur — le groupe, non la filiale qui signe. Le sous-titre
    donne ses années d'annonce, de la première à la dernière : un groupe dont
    la dernière annonce date de 2011 ne se prospecte pas comme celui qui a
    annoncé cette année. Pas de montant total : il mêlerait déclarés et
    estimés. */
export function CarteInvestisseur({ e, onPress }: { e: Investisseur; onPress: () => void }) {
  return (
    <Gabarit onPress={onPress} titre={e.nom} sousTitre={periodeEnClair(e.annees)}
      faits={[
        faitPays("ORIGINE", e.origine, e.origine_iso),
        { label: accorder(e.projets, "projet").toUpperCase(), valeur: fmtEntier(e.projets) },
        { label: "PAYS", valeur: fmtEntier(e.pays), poids: 0.8 },
      ]}
      libelle={`${e.nom}, ${e.origine ?? ""}, ${e.projets} projets dans ${e.pays} pays`} />
  );
}

const s = creerStyles(() => ({
  // Le gabarit de Prospects et des Accords, au pixel près
  carte: {
    flex: 1, backgroundColor: T.carte, borderRadius: 18,
    borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 3,
  },
  tete: { flexGrow: 1 },
  titre: { fontSize: 15.5, fontFamily: POLICE.demi, color: T.encre, lineHeight: 20, letterSpacing: -0.2 },
  sousTitre: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  faits: {
    flexDirection: "row", alignItems: "center", marginTop: 11, paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
  },
  faitSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure, marginHorizontal: 16 },
  faitLabel: { fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 1, color: T.gris, marginBottom: 3 },
  faitLigne: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
  faitVal: { flexShrink: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre, fontVariant: ["tabular-nums"] },

  pays: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  paysNom: { flexShrink: 1, fontSize: 13, fontFamily: POLICE.demi, color: T.encre },

  montant: { fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"], letterSpacing: -0.2 },
  unite: { fontFamily: POLICE.demi, color: T.gris },

  note: { fontSize: 11, lineHeight: 16, fontFamily: POLICE.normal, color: T.gris },
}));
