// Les listes d'iOS — les sections groupées de Réglages, de Mail ou de Santé.
//
// Sur iOS, une liste de choix ne se dessine ni en pastilles ni en points :
// c'est un GROUPE arrondi posé sur le fond gris de la feuille, des lignes
// d'au moins 44 pt séparées par un filet fin qui part du texte (pas du bord),
// une coche à droite de ce qui est choisi, un chevron pour ce qui se déplie.
// Ce sont les briques des feuilles de filtres et des sélecteurs sur iOS ;
// Android garde les siennes. La police reste Google Sans, comme partout.
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type AccessibilityRole, type ColorValue, type StyleProp, type ViewStyle,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import Reanime, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import type { SFSymbol } from "sf-symbols-typescript";
import Icone from "@/components/Icone";
import { creerStyles, useStyleResolu } from "@/lib/apparence";
import { tick } from "@/lib/haptique";
import { RESSORT } from "@/lib/motion";
import { ECHELLE, POLICE, T } from "@/theme";

// Le retrait du texte dans une ligne — c'est de là que part son filet
const MARGE = 16;
// La place d'une icône de tête
const LARGEUR_AVANT = 22;

/** L'en-tête d'une section : petites capitales grises ; à droite, le nombre
    de choix faits, à la teinte de l'app. */
export function EnTeteSection({ titre, nb }: { titre: string; nb?: number }) {
  return (
    <View style={s.entete}>
      <Text style={s.enteteTexte} accessibilityRole="header" maxFontSizeMultiplier={ECHELLE.compact}>
        {titre.toUpperCase()}
      </Text>
      {nb ? <Text style={s.enteteNb} maxFontSizeMultiplier={ECHELLE.compact}>{nb}</Text> : null}
    </View>
  );
}

/** Le groupe arrondi. `hauteurMax` le fait défiler en lui-même : cent
    quarante pays ne repoussent pas la section suivante au bout de la feuille. */
export function Groupe({ hauteurMax, style, children }: {
  hauteurMax?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode;
}) {
  // Chaque ligne trace le filet qui la sépare de la précédente ; décalé d'un
  // trait vers le haut, celui de la première est rogné par le groupe
  const interieur = <View style={s.interieur}>{children}</View>;
  return (
    <View style={[s.groupe, style]}>
      {hauteurMax ? (
        <ScrollView style={{ maxHeight: hauteurMax }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {interieur}
        </ScrollView>
      ) : interieur}
    </View>
  );
}

/** Une ligne : libellé (et sa légende), détail gris à droite, coche si
    `coche` est fourni, accessoire libre au bout (chevron de dépliage…).
    `attenue` l'estompe sans la retirer ; `filetPlein` trace un filet d'un bord
    à l'autre — il sépare deux familles d'une même liste. */
export function Ligne({
  label, legende, detail, coche, couleurCoche, retrait = 0, attenue, filetPlein, gras,
  lignes = 2, onPress, avant, accessoire, role = "button",
}: {
  label: string; legende?: string; detail?: string; coche?: boolean; couleurCoche?: ColorValue;
  retrait?: number; attenue?: boolean; filetPlein?: boolean; gras?: boolean; lignes?: number;
  /** En tête de ligne : une icône (document), un drapeau — le filet part alors du texte. */
  avant?: React.ReactNode;
  onPress?: () => void; accessoire?: React.ReactNode; role?: AccessibilityRole;
}) {
  const corps = (
    <>
      <View style={[s.filet, { left: filetPlein ? 0 : MARGE + retrait + (avant ? LARGEUR_AVANT + 10 : 0) }]} />
      {avant ? <View style={s.avant}>{avant}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.label, gras && s.labelGras]} numberOfLines={lignes}>{label}</Text>
        {legende ? <Text style={s.legende} numberOfLines={1}>{legende}</Text> : null}
      </View>
      {detail != null ? <Text style={s.detail} maxFontSizeMultiplier={ECHELLE.compact}>{detail}</Text> : null}
      {coche !== undefined ? (
        <View style={s.zoneCoche}>
          {coche ? <Icone sf="checkmark" materiel="check" taille={15} poids="semibold" couleur={couleurCoche ?? T.bleu} /> : null}
        </View>
      ) : null}
      {accessoire}
    </>
  );
  const pose = [s.ligne, { paddingLeft: MARGE + retrait }];
  if (!onPress) return <View style={[pose, attenue && s.attenue]}>{corps}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole={role}
      accessibilityState={coche === undefined ? undefined : role === "checkbox" ? { checked: coche } : { selected: coche }}
      style={({ pressed }) => [pose, pressed && s.enfoncee, attenue && s.attenue]}>
      {corps}
    </Pressable>
  );
}

/** Une petite légende à l'intérieur d'un groupe (« Sous-secteurs »…). */
export function SousEnTete({ texte, retrait = 0, couleur }: { texte: string; retrait?: number; couleur?: ColorValue }) {
  return (
    <View style={[s.sousEntete, { paddingLeft: MARGE + retrait }]}>
      <View style={[s.filet, { left: MARGE + retrait }]} />
      <Text style={[s.sousEnteteTexte, couleur ? { color: couleur } : null]} maxFontSizeMultiplier={ECHELLE.compact}>
        {texte.toUpperCase()}
      </Text>
    </View>
  );
}

/** Le message d'un groupe vide. */
export function LigneVide({ texte }: { texte: string }) {
  return <Text style={s.vide}>{texte}</Text>;
}

/** Le chevron d'une ligne qui mène ailleurs (une fiche, un document). */
export function Chevron() {
  return <Icone sf="chevron.right" materiel="chevron_right" taille={13} poids="semibold" couleur={T.grisClair} />;
}

/** Les documents d'une fiche : une liste, l'icône du document en tête, le
    chevron au bout — chaque ligne ouvre son fichier. */
export function GroupeDocuments({ fichiers, ouvrir }: { fichiers: any[]; ouvrir: (f: any) => void }) {
  return (
    <Groupe>
      {fichiers.map((f: any) => (
        <Ligne key={f.id} label={f.titre || f.nom || f.fichier_nom || "Document"} lignes={1}
          avant={<Icone sf="doc.text" materiel="description" taille={17} couleur={T.bleu} />}
          accessoire={<Chevron />} onPress={() => ouvrir(f)} />
      ))}
    </Groupe>
  );
}

/** Le chevron qui déplie une ligne — vers la droite fermé, vers le bas ouvert. */
export function Deplier({ ouvert, onPress, label }: { ouvert: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={() => { tick(); onPress(); }} hitSlop={10}
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: ouvert }}
      style={({ pressed }) => [s.deplier, pressed && { opacity: 0.4 }]}>
      <Icone sf={ouvert ? "chevron.down" : "chevron.right"} materiel={ouvert ? "expand_more" : "chevron_right"}
        taille={13} poids="semibold" couleur={T.bleu} />
    </Pressable>
  );
}

/** La ligne-titre d'une section qui se déplie (un continent, un secteur) :
    son nom, son compte, et le chevron qui dit si elle est ouverte. */
export function LigneDepliable({ titre, compte, ouvert, onPress }: {
  titre: string; compte?: number | string; ouvert: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={() => { tick(); onPress(); }}
      accessibilityRole="button" accessibilityState={{ expanded: ouvert }}
      style={({ pressed }) => [s.ligne, { paddingLeft: MARGE }, pressed && s.enfoncee]}>
      <View style={[s.filet, { left: MARGE }]} />
      <Text style={[s.label, s.labelGras, { flex: 1 }]} numberOfLines={1}>{titre}</Text>
      {compte != null ? <Text style={s.detail} maxFontSizeMultiplier={ECHELLE.compact}>{compte}</Text> : null}
      <Icone sf={ouvert ? "chevron.down" : "chevron.right"} materiel={ouvert ? "expand_more" : "chevron_right"}
        taille={13} poids="semibold" couleur={T.bleu} />
    </Pressable>
  );
}

// ── Les fiches ───────────────────────────────────────────────────────────────

/** Un bloc libre posé comme un groupe : les chiffres d'une fiche, son trajet,
    sa description. */
export function Bloc({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <View style={[s.groupe, s.bloc, style]}>{children}</View>;
}

/** Une ligne de fiche : le libellé à gauche, la valeur à côté — les
    « Informations » d'une page de l'App Store. La valeur se teinte quand elle
    agit (appeler, écrire, ouvrir). */
export function LigneValeur({ label, valeur, children, onPress, lignes }: {
  label: string; valeur?: string | null; children?: React.ReactNode; onPress?: () => void; lignes?: number;
}) {
  const corps = (
    <>
      <View style={[s.filet, { left: MARGE }]} />
      <Text style={s.valeurLabel}>{label}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Une valeur qui agit (numéro, adresse, site) tient sur une ligne et
            se resserre au besoin : une adresse ne se coupe pas au milieu */}
        {children ?? (
          <Text style={[s.valeur, onPress && { color: T.bleu }]} numberOfLines={lignes ?? (onPress ? 1 : undefined)}
            adjustsFontSizeToFit={!!onPress && lignes == null} minimumFontScale={0.75}>
            {valeur}
          </Text>
        )}
      </View>
    </>
  );
  if (!onPress) return <View style={s.ligneValeur}>{corps}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [s.ligneValeur, pressed && s.enfoncee]}>
      {corps}
    </Pressable>
  );
}

/** La note sous un groupe — le pied de section d'iOS. */
export function PiedSection({ texte }: { texte: string }) {
  return <Text style={s.pied}>{texte}</Text>;
}

export type TuileAction = { sf: SFSymbol; materiel: string; label: string; onPress: () => void };

/** Les tuiles d'action d'une fiche — Appeler · E-mail · Site web, comme la
    fiche Contacts d'iOS : blanches sur le fond gris, l'icône et le mot teintés. */
export function TuilesActions({ actions }: { actions: (TuileAction | null | false | undefined)[] }) {
  const liste = actions.filter(Boolean) as TuileAction[];
  if (!liste.length) return null;
  return (
    <View style={s.tuiles}>
      {liste.map(a => (
        <Pressable key={a.label} onPress={a.onPress} accessibilityRole="button" accessibilityLabel={a.label}
          style={({ pressed }) => [s.tuile, pressed && s.enfoncee]}>
          <Icone sf={a.sf} materiel={a.materiel} taille={20} couleur={T.bleu} />
          <Text style={s.tuileLabel} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.compact}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Le champ de recherche d'iOS 26 — celui de Podcasts : une CAPSULE grise,
    la loupe en tête, et à droite, hors du champ, le X rond d'iOS. Quand la
    recherche a été ouverte (la loupe d'un en-tête), le X la referme
    (onFermer) ; ailleurs, il paraît dès qu'on tape ou qu'on touche le champ,
    efface la saisie et baisse le clavier. Pas de petite croix dans le
    champ : le X rond la remplace. */
export function ChampRecherche({ valeur, onChange, placeholder, style, autoFocus, refChamp, onFermer }: {
  valeur: string; onChange: (v: string) => void; placeholder: string; style?: StyleProp<ViewStyle>;
  /** Le clavier s'ouvre avec le champ (la loupe d'un en-tête vient d'être touchée). */
  autoFocus?: boolean;
  /** Pour donner le focus au champ de l'extérieur (l'onglet Recherche qu'on ouvre). */
  refChamp?: React.RefObject<TextInput | null>;
  /** Referme la recherche — le X est alors toujours là. */
  onFermer?: () => void;
}) {
  const interne = useRef<TextInput>(null);
  const champ = refChamp ?? interne;
  const [focus, setFocus] = useState(!!autoFocus);
  const montrerX = !!onFermer || focus || valeur.length > 0;
  const effacer = () => { onChange(""); champ.current?.blur(); };
  return (
    <View style={[s.rangeeChamp, style]}>
      <View style={s.champ}>
        <Icone sf="magnifyingglass" materiel="search" taille={17} couleur={T.gris} />
        {/* Les champs de recherche d'iOS disent « Rechercher », sans points de suspension */}
        <TextInput ref={champ} value={valeur} onChangeText={onChange} placeholder={placeholder.replace(/(…|\.\.\.)$/, "")}
          placeholderTextColor={T.gris as any} autoCorrect={false} autoCapitalize="none"
          clearButtonMode="never" returnKeyType="search" autoFocus={autoFocus} style={s.champTexte}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
      </View>
      {montrerX && (
        <Pressable onPress={onFermer ?? effacer} hitSlop={4} accessibilityRole="button"
          accessibilityLabel={onFermer ? "Fermer la recherche" : "Effacer la recherche"}
          style={({ pressed }) => [s.xRond, pressed && { opacity: 0.55 }]}>
          <Icone sf="xmark" materiel="close" taille={15} couleur={T.encre} poids="semibold" />
        </Pressable>
      )}
    </View>
  );
}

/** Les segments d'iOS 26 — ceux de Podcasts ou de Musique : une capsule
    blanche au liseré fin, le choix posé dans une pastille grise qui glisse de
    l'un à l'autre. Dessinés ici plutôt que confiés au contrôle du système :
    même dessin sur tous les iPhone, en Google Sans, et sans compteurs — un
    segment nomme une vue, il ne la mesure pas. Les libellés se resserrent
    plutôt que de se couper sur les petits écrans. */
export function SegmentsCapsule({ options, valeur, onChange, compact }: {
  options: readonly { cle: string; label: string }[]; valeur: string; onChange: (cle: string) => void;
  /** Dans une feuille : un cran plus bas. */
  compact?: boolean;
}) {
  const [largeur, setLargeur] = useState(0);
  const index = Math.max(0, options.findIndex(o => o.cle === valeur));
  const position = useSharedValue(index);
  useEffect(() => { position.value = withSpring(index, RESSORT.standard); }, [index, position]);
  const pas = largeur > 0 ? (largeur - 2 * BORD_CAPSULE) / options.length : 0;
  const styleCurseur = useAnimatedStyle(() => ({ width: pas, transform: [{ translateX: position.value * pas }] }));
  // Le curseur est une vue Reanimated : sa couleur lui arrive résolue — un
  // jeton dynamique d'iOS (DynamicColorIOS) y ferait tomber l'app
  const curseur = useStyleResolu(s.curseur);
  return (
    <View style={[s.capsule, compact && s.capsuleCompacte]} accessibilityRole="tablist"
      onLayout={e => setLargeur(e.nativeEvent.layout.width)}>
      {pas > 0 && <Reanime.View style={[curseur, compact && s.curseurCompact, styleCurseur]} />}
      {options.map((o, i) => (
        <Pressable key={o.cle} style={s.segment} accessibilityRole="tab" accessibilityState={{ selected: i === index }}
          onPress={() => { if (o.cle !== valeur) { tick(); onChange(o.cle); } }}>
          <Text style={[s.segmentTexte, compact && s.segmentTexteCompact, i === index && s.segmentTexteActif]}
            numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} maxFontSizeMultiplier={ECHELLE.compact}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Les segments d'une feuille : la même capsule, en compact. */
export function SegmentsIOS(props: {
  options: readonly { cle: string; label: string }[]; valeur: string; onChange: (cle: string) => void;
}) {
  return <SegmentsCapsule {...props} compact />;
}

// L'épaisseur entre le bord de la capsule et la pastille
const BORD_CAPSULE = 4;

const s = creerStyles(() => ({
  entete: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8,
    paddingHorizontal: MARGE, marginBottom: 7,
  },
  enteteTexte: { flex: 1, fontSize: 12.5, fontFamily: POLICE.moyen, color: T.gris, letterSpacing: 0.5 },
  enteteNb: { fontSize: 13, fontFamily: POLICE.demi, color: T.bleu, fontVariant: ["tabular-nums"] },
  // Les surfaces blanches portent un liseré fin : sur le fond très clair de
  // l'app, c'est lui qui les détache
  groupe: {
    backgroundColor: T.carte, borderRadius: 16, borderCurve: "continuous", overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord,
  },
  interieur: { marginTop: -StyleSheet.hairlineWidth },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: 10,
    minHeight: 44, paddingVertical: 10, paddingRight: MARGE - 2,
  },
  // Le gris de la ligne touchée — celui des cellules d'iOS
  enfoncee: { backgroundColor: T.voileFort },
  attenue: { opacity: 0.45 },
  avant: { width: LARGEUR_AVANT, alignItems: "center" },
  filet: { position: "absolute", top: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: T.voileFort },
  label: { fontSize: 15, lineHeight: 20, fontFamily: POLICE.normal, color: T.encre },
  labelGras: { fontFamily: POLICE.demi },
  legende: { fontSize: 12.5, lineHeight: 16, fontFamily: POLICE.normal, color: T.gris, marginTop: 1 },
  detail: { fontSize: 14, fontFamily: POLICE.normal, color: T.gris, fontVariant: ["tabular-nums"] },
  // La place de la coche est réservée : les détails restent alignés, cochés ou non
  zoneCoche: { width: 18, alignItems: "flex-end" },
  sousEntete: { paddingTop: 12, paddingBottom: 5, paddingRight: MARGE },
  sousEnteteTexte: { fontSize: 11, fontFamily: POLICE.demi, color: T.gris, letterSpacing: 0.6 },
  vide: { fontSize: 14, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", paddingVertical: 16, paddingHorizontal: MARGE },
  deplier: { width: 28, height: 28, alignItems: "center", justifyContent: "center", marginRight: -6 },
  bloc: { paddingHorizontal: MARGE, paddingVertical: 14 },
  ligneValeur: {
    flexDirection: "row", alignItems: "flex-start", gap: 14,
    minHeight: 44, paddingVertical: 12, paddingHorizontal: MARGE,
  },
  valeurLabel: { width: 112, fontSize: 14, lineHeight: 20, fontFamily: POLICE.normal, color: T.gris },
  valeur: { fontSize: 15, lineHeight: 20, fontFamily: POLICE.normal, color: T.encre },
  pied: { fontSize: 12.5, lineHeight: 17, fontFamily: POLICE.normal, color: T.gris, paddingHorizontal: MARGE, marginTop: 7 },
  tuiles: { flexDirection: "row", gap: 8 },
  tuile: {
    flex: 1, alignItems: "center", gap: 5, paddingVertical: 11,
    backgroundColor: T.carte, borderRadius: 14, borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord,
  },
  tuileLabel: { fontSize: 11.5, fontFamily: POLICE.moyen, color: T.bleu },
  capsule: {
    flexDirection: "row", height: 42, padding: BORD_CAPSULE,
    borderRadius: 21, borderCurve: "continuous",
    backgroundColor: T.carte, borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord,
    shadowColor: "#0B1220", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  capsuleCompacte: { height: 38, borderRadius: 19 },
  curseur: {
    position: "absolute", top: BORD_CAPSULE, bottom: BORD_CAPSULE, left: BORD_CAPSULE,
    borderRadius: 17, borderCurve: "continuous", backgroundColor: T.pastilleSegment,
  },
  curseurCompact: { borderRadius: 15 },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  segmentTexte: { fontSize: 15, fontFamily: POLICE.moyen, color: T.encre },
  segmentTexteCompact: { fontSize: 14 },
  segmentTexteActif: { fontFamily: POLICE.demi },
  rangeeChamp: { flexDirection: "row", alignItems: "center", gap: 10 },
  // La capsule d'iOS 26 : 40 pt, pleinement arrondie, le gris neutre des
  // champs du système et un liseré à peine visible (qui fait le verre la nuit)
  champ: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.champRecherche, borderRadius: 20, borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.bordChampRecherche,
    paddingHorizontal: 14, height: 40,
  },
  champTexte: { flex: 1, fontSize: 16, fontFamily: POLICE.normal, color: T.encre, paddingVertical: 0 },
  // Le X rond, à la hauteur de la capsule
  xRond: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: T.champRecherche, borderWidth: StyleSheet.hairlineWidth, borderColor: T.bordChampRecherche,
  },
}));
