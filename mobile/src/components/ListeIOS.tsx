// Les listes du système — les sections groupées de Réglages, de Mail ou de
// Santé sur iOS, les listes de Material 3 sur Android.
//
// Sur iOS, une liste de choix ne se dessine ni en pastilles ni en points :
// c'est un GROUPE arrondi posé sur le fond gris de la feuille, des lignes
// d'au moins 44 pt séparées par un filet fin qui part du texte (pas du bord),
// une coche à droite de ce qui est choisi, un chevron pour ce qui se déplie.
//
// Sur Android, les mêmes groupes portent les lignes de Material 3 : 56 dp au
// moins, le libellé en 16 sp, la case à cocher ou le bouton radio EN TÊTE de
// ce qui se choisit, le compte au bout, la flèche qui se retourne pour ce qui
// se déplie, l'ondulation au toucher — et pas de chevron pour ce qui mène
// ailleurs. Les en-têtes de section sont ceux de Material : la teinte de
// l'app, sans capitales.
//
// Ce sont les briques des feuilles de filtres et des sélecteurs, sur les deux
// systèmes. La police reste Google Sans, comme partout.
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type AccessibilityRole, type ColorValue, type StyleProp, type ViewStyle,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import Reanime, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import type { SFSymbol } from "sf-symbols-typescript";
import Icone from "@/components/Icone";
import { Ondulable } from "@/components/ui";
import { creerStyles, useStyleResolu } from "@/lib/apparence";
import { RESSORT } from "@/lib/motion";
import { IOS } from "@/lib/plateforme";
import { coin, ECHELLE, POLICE, T } from "@/theme";

// Le retrait du texte dans une ligne — c'est de là que part son filet
const MARGE = 16;
// La place d'une icône de tête, et l'écart qui la sépare du texte (Material :
// 16 dp)
const LARGEUR_AVANT = IOS ? 22 : 24;
const ECART_AVANT = IOS ? 10 : 16;
// Android : la place de la case à cocher ou du bouton radio de tête
const LARGEUR_COMMANDE = 24;

/** L'en-tête d'une section : petites capitales grises ; à droite, le nombre
    de choix faits, à la teinte de l'app. */
export function EnTeteSection({ titre, nb }: { titre: string; nb?: number }) {
  return (
    <View style={s.entete}>
      <Text style={s.enteteTexte} accessibilityRole="header" maxFontSizeMultiplier={ECHELLE.compact}>
        {IOS ? titre.toUpperCase() : titre}
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
  // Android : ce qui se choisit porte sa commande en tête — la case à cocher
  // d'un choix multiple, le bouton radio d'un choix unique
  const commande = !IOS && coche !== undefined
    ? (role === "checkbox" ? <CaseACocher cochee={coche} couleur={couleurCoche} /> : <BoutonRadio choisi={coche} couleur={couleurCoche} />)
    : null;
  const tete = (avant ? LARGEUR_AVANT + ECART_AVANT : 0) + (commande ? LARGEUR_COMMANDE + ECART_AVANT : 0);
  const corps = (
    <>
      <View style={[s.filet, { left: filetPlein ? 0 : MARGE + retrait + tete }]} />
      {commande}
      {avant ? <View style={s.avant}>{avant}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.label, gras && s.labelGras]} numberOfLines={lignes}>{label}</Text>
        {legende ? <Text style={s.legende} numberOfLines={1}>{legende}</Text> : null}
      </View>
      {detail != null ? <Text style={s.detail} maxFontSizeMultiplier={ECHELLE.compact}>{detail}</Text> : null}
      {IOS && coche !== undefined ? (
        <View style={s.zoneCoche}>
          {coche ? <Icone sf="checkmark" materiel="check" taille={15} poids="semibold" couleur={couleurCoche ?? T.bleu} /> : null}
        </View>
      ) : null}
      {accessoire}
    </>
  );
  const pose = [s.ligne, { paddingLeft: MARGE + retrait }, !IOS && legende ? s.ligneDeuxLignes : null];
  if (!onPress) return <View style={[pose, attenue && s.attenue]}>{corps}</View>;
  // Un choix unique se dit « radio » à TalkBack
  const roleSysteme = !IOS && role === "button" && coche !== undefined ? "radio" : role;
  return (
    <Ondulable onPress={onPress} accessibilityRole={roleSysteme}
      accessibilityState={coche === undefined ? undefined : role === "checkbox" || !IOS ? { checked: coche } : { selected: coche }}
      style={({ pressed }) => [pose, pressed && s.enfoncee, attenue && s.attenue]}>
      {corps}
    </Ondulable>
  );
}

/** Android : la case à cocher de Material 3 — 18 dp, coins de 2 dp, le
    contour de 2 dp au repos ; choisie, pleine de la teinte et cochée de la
    couleur de la surface (blanche le jour, sombre la nuit, sur un bleu
    clair). */
function CaseACocher({ cochee, couleur }: { cochee: boolean; couleur?: ColorValue }) {
  const teinte = couleur ?? T.bleu;
  return (
    <View style={s.commande}>
      <View style={[s.case, cochee ? { backgroundColor: teinte, borderColor: teinte } : null]}>
        {cochee ? <Icone sf="checkmark" materiel="check" taille={14} couleur={T.carte} /> : null}
      </View>
    </View>
  );
}

/** Android : le bouton radio de Material 3 — un anneau de 20 dp, le point de
    10 dp au centre une fois choisi. */
function BoutonRadio({ choisi, couleur }: { choisi: boolean; couleur?: ColorValue }) {
  const teinte = couleur ?? T.bleu;
  return (
    <View style={s.commande}>
      <View style={[s.radio, choisi ? { borderColor: teinte } : null]}>
        {choisi ? <View style={[s.radioPoint, { backgroundColor: teinte }]} /> : null}
      </View>
    </View>
  );
}

/** Une petite légende à l'intérieur d'un groupe (« Sous-secteurs »…). */
export function SousEnTete({ texte, retrait = 0, couleur }: { texte: string; retrait?: number; couleur?: ColorValue }) {
  return (
    <View style={[s.sousEntete, { paddingLeft: MARGE + retrait }]}>
      <View style={[s.filet, { left: MARGE + retrait }]} />
      <Text style={[s.sousEnteteTexte, couleur ? { color: couleur } : null]} maxFontSizeMultiplier={ECHELLE.compact}>
        {IOS ? texte.toUpperCase() : texte}
      </Text>
    </View>
  );
}

/** Le message d'un groupe vide. */
export function LigneVide({ texte }: { texte: string }) {
  return <Text style={s.vide}>{texte}</Text>;
}

/** Le chevron d'une ligne qui mène ailleurs (une fiche, un document). Les
    listes d'Android n'en portent pas : la ligne entière ondule et ouvre. */
export function Chevron() {
  if (!IOS) return null;
  return <Icone sf="chevron.right" materiel="chevron_right" taille={13} poids="semibold" couleur={T.grisClair} />;
}

/** Les documents d'une fiche : une liste, l'icône du document en tête, le
    chevron au bout — chaque ligne ouvre son fichier. */
export function GroupeDocuments({ fichiers, ouvrir }: { fichiers: any[]; ouvrir: (f: any) => void }) {
  return (
    <Groupe>
      {fichiers.map((f: any) => (
        <Ligne key={f.id} label={f.titre || f.nom || f.fichier_nom || "Document"} lignes={1}
          avant={<Icone sf="doc.text" materiel="description" taille={IOS ? 17 : 24} couleur={T.bleu} />}
          accessoire={<Chevron />} onPress={() => ouvrir(f)} />
      ))}
    </Groupe>
  );
}

/** Le chevron qui déplie une ligne — vers la droite fermé, vers le bas ouvert. */
export function Deplier({ ouvert, onPress, label }: { ouvert: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={() => onPress()} hitSlop={10}
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: ouvert }}
      android_ripple={{ color: T.surbrillance as any, borderless: true, radius: 20 }}
      style={({ pressed }) => [s.deplier, IOS && pressed && { opacity: 0.4 }]}>
      {/* Android : la flèche de Material, qui se retourne */}
      <Icone sf={ouvert ? "chevron.down" : "chevron.right"} materiel={ouvert ? "expand_less" : "expand_more"}
        taille={IOS ? 13 : 24} poids="semibold" couleur={IOS ? T.bleu : T.gris} />
    </Pressable>
  );
}

/** La ligne-titre d'une section qui se déplie (un continent, un secteur) :
    son nom, son compte, et le chevron qui dit si elle est ouverte. */
export function LigneDepliable({ titre, compte, ouvert, onPress }: {
  titre: string; compte?: number | string; ouvert: boolean; onPress: () => void;
}) {
  return (
    <Ondulable onPress={() => onPress()}
      accessibilityRole="button" accessibilityState={{ expanded: ouvert }}
      style={({ pressed }) => [s.ligne, { paddingLeft: MARGE }, pressed && s.enfoncee]}>
      <View style={[s.filet, { left: MARGE }]} />
      <Text style={[s.label, s.labelGras, { flex: 1 }]} numberOfLines={1}>{titre}</Text>
      {compte != null ? <Text style={s.detail} maxFontSizeMultiplier={ECHELLE.compact}>{compte}</Text> : null}
      <Icone sf={ouvert ? "chevron.down" : "chevron.right"} materiel={ouvert ? "expand_less" : "expand_more"}
        taille={IOS ? 13 : 24} poids="semibold" couleur={IOS ? T.bleu : T.gris} />
    </Ondulable>
  );
}

// ── Les fiches ───────────────────────────────────────────────────────────────

/** Un bloc libre posé comme un groupe : les chiffres d'une fiche, son trajet,
    sa description. */
export function Bloc({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <View style={[s.groupe, s.bloc, style]}>{children}</View>;
}

/** Une ligne de fiche. iOS : le libellé à gauche, la valeur à côté — les
    « Informations » d'une page de l'App Store. Android : la valeur en 16 sp,
    son libellé dessous, comme une fiche de Google Contacts. La valeur se
    teinte quand elle agit (appeler, écrire, ouvrir). */
export function LigneValeur({ label, valeur, children, onPress, lignes }: {
  label: string; valeur?: string | null; children?: React.ReactNode; onPress?: () => void; lignes?: number;
}) {
  if (!IOS) return <LigneValeurAndroid label={label} valeur={valeur} onPress={onPress} lignes={lignes}>{children}</LigneValeurAndroid>;
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
    <Ondulable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [s.ligneValeur, pressed && s.enfoncee]}>
      {corps}
    </Ondulable>
  );
}

function LigneValeurAndroid({ label, valeur, children, onPress, lignes }: {
  label: string; valeur?: string | null; children?: React.ReactNode; onPress?: () => void; lignes?: number;
}) {
  const corps = (
    <>
      <View style={[s.filet, { left: MARGE }]} />
      {children ?? (
        <Text style={[s.valeurAndroid, onPress && { color: T.bleu }]} numberOfLines={lignes ?? (onPress ? 1 : undefined)}>
          {valeur}
        </Text>
      )}
      {label ? <Text style={s.legende} numberOfLines={1}>{label}</Text> : null}
    </>
  );
  if (!onPress) return <View style={s.ligneValeurAndroid}>{corps}</View>;
  return (
    <Ondulable onPress={onPress} accessibilityRole="button" style={s.ligneValeurAndroid}>
      {corps}
    </Ondulable>
  );
}

/** La note sous un groupe — le pied de section d'iOS. */
export function PiedSection({ texte }: { texte: string }) {
  return <Text style={s.pied}>{texte}</Text>;
}

export type TuileAction = { sf: SFSymbol; materiel: string; label: string; onPress: () => void };

/** Les tuiles d'action d'une fiche — Appeler · E-mail · Site web. iOS :
    comme la fiche Contacts, blanches sur le fond gris, l'icône et le mot
    teintés. Android : comme Google Contacts, l'icône dans sa pilule tonale,
    le mot dessous. */
export function TuilesActions({ actions }: { actions: (TuileAction | null | false | undefined)[] }) {
  const liste = actions.filter(Boolean) as TuileAction[];
  if (!liste.length) return null;
  if (!IOS) return (
    <View style={s.tuiles}>
      {liste.map(a => (
        <Ondulable key={a.label} onPress={a.onPress} accessibilityRole="button" accessibilityLabel={a.label}
          style={s.tuileAndroid}>
          <View style={s.pastilleAction}>
            <Icone sf={a.sf} materiel={a.materiel} taille={24} couleur={T.bleu} />
          </View>
          <Text style={s.tuileLabelAndroid} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.compact}>{a.label}</Text>
        </Ondulable>
      ))}
    </View>
  );
  return (
    <View style={s.tuiles}>
      {liste.map(a => (
        <Ondulable key={a.label} onPress={a.onPress} accessibilityRole="button" accessibilityLabel={a.label}
          style={({ pressed }) => [s.tuile, pressed && s.enfoncee]}>
          <Icone sf={a.sf} materiel={a.materiel} taille={20} couleur={T.bleu} />
          <Text style={s.tuileLabel} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.compact}>{a.label}</Text>
        </Ondulable>
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
type ProprietesChamp = {
  valeur: string; onChange: (v: string) => void; placeholder: string; style?: StyleProp<ViewStyle>;
  /** Le clavier s'ouvre avec le champ (la loupe d'un en-tête vient d'être touchée). */
  autoFocus?: boolean;
  /** Pour donner le focus au champ de l'extérieur (l'onglet Recherche qu'on ouvre). */
  refChamp?: React.RefObject<TextInput | null>;
  /** Referme la recherche — le X est alors toujours là. */
  onFermer?: () => void;
};

export function ChampRecherche(props: ProprietesChamp) {
  return IOS ? <ChampRechercheIOS {...props} /> : <ChampRechercheAndroid {...props} />;
}

function ChampRechercheIOS({ valeur, onChange, placeholder, style, autoFocus, refChamp, onFermer }: ProprietesChamp) {
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

/** Android : la barre de recherche de Material 3 — une pilule tonale, la loupe
    en tête, et le X DANS la barre, au bout, comme sur Android : il efface la
    saisie, ou referme la recherche quand elle a été ouverte par la loupe. */
function ChampRechercheAndroid({ valeur, onChange, placeholder, style, autoFocus, refChamp, onFermer }: ProprietesChamp) {
  const interne = useRef<TextInput>(null);
  const champ = refChamp ?? interne;
  const montrerX = !!onFermer || valeur.length > 0;
  return (
    <View style={[s.champAndroid, style]}>
      <Icone sf="magnifyingglass" materiel="search" taille={24} couleur={T.gris} />
      <TextInput ref={champ} value={valeur} onChangeText={onChange} placeholder={placeholder.replace(/(…|\.\.\.)$/, "")}
        placeholderTextColor={T.gris as any} autoCorrect={false} autoCapitalize="none"
        returnKeyType="search" autoFocus={autoFocus} style={s.champTexteAndroid} />
      {montrerX && (
        <Pressable onPress={onFermer ?? (() => onChange(""))} accessibilityRole="button"
          accessibilityLabel={onFermer ? "Fermer la recherche" : "Effacer la recherche"}
          android_ripple={{ color: T.surbrillance as any, borderless: true, radius: 20 }} style={s.xAndroid}>
          <Icone sf="xmark" materiel="close" taille={24} couleur={T.gris} />
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
type ProprietesSegments = {
  options: readonly { cle: string; label: string }[]; valeur: string; onChange: (cle: string) => void;
  /** Dans une feuille : un cran plus bas. */
  compact?: boolean;
  /** La couleur des libellés — l'encre par défaut ; le bleu de l'app quand la
      bascule commande toute une page (Exportations · Importations). */
  teinte?: ColorValue;
};

export function SegmentsCapsule(props: ProprietesSegments) {
  return IOS ? <SegmentsCapsuleIOS {...props} /> : <SegmentsAndroid {...props} />;
}

function SegmentsCapsuleIOS({ options, valeur, onChange, compact, teinte }: ProprietesSegments) {
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
          onPress={() => { if (o.cle !== valeur) onChange(o.cle); }}>
          <Text style={[s.segmentTexte, compact && s.segmentTexteCompact, i === index && s.segmentTexteActif, teinte ? { color: teinte } : null]}
            numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} maxFontSizeMultiplier={ECHELLE.compact}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Android : les boutons segmentés de Material 3 — une rangée au contour fin,
    pleinement arrondie aux deux bouts, les segments séparés d'un filet ; le
    choisi se remplit du ton de sélection et porte sa coche, comme sur
    Android. L'ondulation au toucher. */
function SegmentsAndroid({ options, valeur, onChange, compact, teinte }: ProprietesSegments) {
  return (
    <View style={[s.segmentsAndroid, compact && s.segmentsAndroidCompact]} accessibilityRole="tablist">
      {options.map((o, i) => {
        const actif = o.cle === valeur;
        return (
          <Pressable key={o.cle} onPress={() => { if (!actif) onChange(o.cle); }}
            accessibilityRole="tab" accessibilityState={{ selected: actif }}
            android_ripple={{ color: T.surbrillance as any }}
            style={[s.segmentAndroid, i > 0 && s.segmentAndroidBord, actif && s.segmentAndroidActif]}>
            {actif ? <Icone sf="checkmark" materiel="check" taille={18} couleur={teinte ?? T.bleu} /> : null}
            <Text style={[s.segmentAndroidTexte, actif && s.segmentAndroidTexteActif, teinte ? { color: teinte } : null]}
              numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={ECHELLE.compact}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// L'épaisseur entre le bord de la capsule et la pastille
const BORD_CAPSULE = 4;

const s = creerStyles(() => ({
  entete: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8,
    paddingHorizontal: MARGE, marginBottom: 7,
  },
  enteteTexte: IOS
    ? { flex: 1, fontSize: 12.5, fontFamily: POLICE.moyen, color: T.gris, letterSpacing: 0.5 }
    // Android : l'en-tête de section de Material 3, à la teinte de l'app
    : { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: POLICE.moyen, color: T.bleu, letterSpacing: 0.1 },
  enteteNb: { fontSize: 13, fontFamily: POLICE.demi, color: T.bleu, fontVariant: ["tabular-nums"] },
  // Les surfaces blanches portent un liseré fin : sur le fond très clair de
  // l'app, c'est lui qui les détache
  groupe: {
    backgroundColor: T.carte, borderRadius: coin(16), borderCurve: "continuous", overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord,
  },
  interieur: { marginTop: -StyleSheet.hairlineWidth },
  ligne: IOS ? {
    flexDirection: "row", alignItems: "center", gap: 10,
    minHeight: 44, paddingVertical: 10, paddingRight: MARGE - 2,
  } : {
    // Android : la ligne de liste de Material 3 — 56 dp, 16 dp de chaque côté
    flexDirection: "row", alignItems: "center", gap: ECART_AVANT,
    minHeight: 56, paddingVertical: 8, paddingRight: MARGE,
  },
  // Android : une ligne à légende — la ligne de deux lignes de Material
  ligneDeuxLignes: { minHeight: 64 },
  // Le gris de la ligne touchée — celui des cellules d'iOS
  enfoncee: { backgroundColor: T.voileFort },
  attenue: { opacity: 0.45 },
  avant: { width: LARGEUR_AVANT, alignItems: "center" },
  filet: { position: "absolute", top: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: T.voileFort },
  label: IOS
    ? { fontSize: 15, lineHeight: 20, fontFamily: POLICE.normal, color: T.encre }
    : { fontSize: 16, lineHeight: 24, fontFamily: POLICE.normal, color: T.encre },
  labelGras: { fontFamily: POLICE.demi },
  legende: IOS
    ? { fontSize: 12.5, lineHeight: 16, fontFamily: POLICE.normal, color: T.gris, marginTop: 1 }
    : { fontSize: 14, lineHeight: 20, fontFamily: POLICE.normal, color: T.gris },
  detail: { fontSize: 14, fontFamily: POLICE.normal, color: T.gris, fontVariant: ["tabular-nums"] },
  // Android : la case à cocher et le bouton radio, centrés dans leur place
  commande: { width: LARGEUR_COMMANDE, height: LARGEUR_COMMANDE, alignItems: "center", justifyContent: "center" },
  case: {
    width: 18, height: 18, borderRadius: 2, borderWidth: 2, borderColor: T.gris,
    alignItems: "center", justifyContent: "center",
  },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: T.gris,
    alignItems: "center", justifyContent: "center",
  },
  radioPoint: { width: 10, height: 10, borderRadius: 5 },
  // La place de la coche est réservée : les détails restent alignés, cochés ou non
  zoneCoche: { width: 18, alignItems: "flex-end" },
  sousEntete: { paddingTop: 12, paddingBottom: 5, paddingRight: MARGE },
  sousEnteteTexte: IOS
    ? { fontSize: 11, fontFamily: POLICE.demi, color: T.gris, letterSpacing: 0.6 }
    : { fontSize: 12, lineHeight: 16, fontFamily: POLICE.moyen, color: T.gris, letterSpacing: 0.5 },
  vide: { fontSize: 14, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", paddingVertical: 16, paddingHorizontal: MARGE },
  deplier: IOS
    ? { width: 28, height: 28, alignItems: "center", justifyContent: "center", marginRight: -6 }
    : { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: -8 },
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
    backgroundColor: T.carte, borderRadius: coin(14), borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord,
  },
  tuileLabel: { fontSize: 11.5, fontFamily: POLICE.moyen, color: T.bleu },
  // Android : la fiche de Google Contacts — la valeur, son libellé dessous ;
  // les actions en pilules tonales
  ligneValeurAndroid: { minHeight: 56, paddingVertical: 10, paddingHorizontal: MARGE, justifyContent: "center" },
  valeurAndroid: { fontSize: 16, lineHeight: 24, fontFamily: POLICE.normal, color: T.encre },
  tuileAndroid: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 6, borderRadius: coin(16) },
  pastilleAction: {
    width: 64, height: 40, borderRadius: 20, backgroundColor: T.selection,
    alignItems: "center", justifyContent: "center",
  },
  tuileLabelAndroid: { fontSize: 12, lineHeight: 16, fontFamily: POLICE.moyen, color: T.encre },
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
  // Android : la barre de recherche de Material 3 — 48 dp, pleinement arrondie
  champAndroid: {
    flexDirection: "row", alignItems: "center", gap: 12, height: 48, borderRadius: 24,
    paddingLeft: 16, paddingRight: 4, backgroundColor: T.champRecherche,
  },
  champTexteAndroid: { flex: 1, fontSize: 16, fontFamily: POLICE.normal, color: T.encre, paddingVertical: 0 },
  xAndroid: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  // Android : les boutons segmentés de Material 3
  segmentsAndroid: {
    flexDirection: "row", height: 40, borderRadius: 20, overflow: "hidden",
    borderWidth: 1, borderColor: T.voileFort,
  },
  segmentsAndroidCompact: { height: 36, borderRadius: 18 },
  segmentAndroid: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12 },
  segmentAndroidBord: { borderLeftWidth: 1, borderLeftColor: T.voileFort },
  segmentAndroidActif: { backgroundColor: T.selection },
  segmentAndroidTexte: { flexShrink: 1, fontSize: 14, fontFamily: POLICE.moyen, color: T.encre },
  segmentAndroidTexteActif: { color: T.bleu },
  // Le X rond, à la hauteur de la capsule
  xRond: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: T.champRecherche, borderWidth: StyleSheet.hairlineWidth, borderColor: T.bordChampRecherche,
  },
}));
