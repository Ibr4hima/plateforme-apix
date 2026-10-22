// Curseur d'années — le doigt remonte le temps au-dessus de la carte vedette.
//
// Une piste fine, la portion parcourue en bleu, un pouce blanc à ombre douce
// et l'année choisie dans une pilule qui suit le pouce — au style des
// étiquettes de section (SeparateurSection) : le fond de la page, un liseré
// et le chiffre à la teinte de la section. Le glissement est
// AIMANTÉ aux années, le tap saute
// directement à l'année visée. Par défaut, le pouce est à droite : la
// dernière année connue.
//
// VoiceOver et TalkBack le lisent comme un réglage : « Année, 2024,
// ajustable » — un balayage vers le haut ou le bas passe à l'année voisine.
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanime, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { creerStyles, useCouleur, useStyleResolu } from "@/lib/apparence";
import { RESSORT } from "@/lib/motion";
import { ECHELLE, FONTE, T } from "@/theme";

const POUCE = 24;      // diamètre du pouce
const PAD = POUCE / 2; // demi-pouce de marge : il ne sort jamais de la piste
const PILULE = 48;     // largeur de la pilule de l'année

export default function CurseurAnnees({ annees, valeur, onChange, couleur: teinte }: {
  annees: number[]; valeur: number; onChange: (annee: number) => void;
  // Teinte d'accent (portion parcourue, année, liseré de la pilule) — bleu
  // par défaut, orange ou vert sous les sections de cette couleur
  couleur?: string;
}) {
  // Les teintes arrivent par les PROPS (couleur={T.orange}) : ce sont des
  // jetons dynamiques, que Reanimated refuse tout autant que dans un style
  const couleur = useCouleur(teinte);
  const bleu = useCouleur(T.bleu) as unknown as string;
  // La pilule est une vue Reanimated : son fond lui arrive résolu
  const fond = useCouleur(T.fond);
  const accent = (couleur as string | undefined) ?? bleu;
  const [largeur, setLargeur] = useState(0);
  // Reanimated exige des couleurs simples : les styles teintés sont résolus
  const pilule = useStyleResolu(s.pilule);
  const rempli = useStyleResolu(s.rempli);
  const pouce = useStyleResolu(s.pouce);
  const piluleTexte = useStyleResolu(s.piluleTexte);
  const piste = useStyleResolu(s.piste);
  const tx = useSharedValue(PAD);

  const n = annees.length;
  const xDe = (a: number) => {
    const idx = Math.max(0, annees.indexOf(a));
    return PAD + (n > 1 ? idx / (n - 1) : 1) * (largeur - 2 * PAD);
  };

  // Le pouce rejoint l'année choisie au ressort (aussi quand elle change
  // depuis l'extérieur : bascule de série, nouvelles données…). À la première
  // mesure, il s'y pose d'emblée : il balayait la piste à chaque ouverture
  const pose = useRef(false);
  useEffect(() => {
    if (largeur <= 0 || n === 0) return;
    if (!pose.current) { pose.current = true; tx.value = xDe(valeur); return; }
    tx.value = withSpring(xDe(valeur), RESSORT.vif);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur, largeur, annees.join(",")]);

  // L'année voisine — les gestes d'accessibilité (balayage haut / bas)
  const pas = (sens: 1 | -1) => {
    const i = annees.indexOf(valeur);
    const j = Math.min(n - 1, Math.max(0, (i < 0 ? n - 1 : i) + sens));
    if (annees[j] !== valeur) onChange(annees[j]);
  };

  const choisirDepuisX = (x: number) => {
    if (largeur <= 0 || n === 0) return;
    const ratio = Math.min(1, Math.max(0, (x - PAD) / Math.max(1, largeur - 2 * PAD)));
    const a = annees[Math.round(ratio * (n - 1))];
    if (a !== valeur) onChange(a);
  };

  // Le glissement ne s'arme qu'à l'horizontale : un geste vertical commencé
  // sur le curseur fait défiler la page — sans toucher à l'année —, comme un
  // curseur d'iOS dans une liste. Un toucher bref saute à l'année visée.
  const glisser = Gesture.Pan().activeOffsetX([-6, 6]).failOffsetY([-10, 10])
    .onStart(e => { "worklet"; runOnJS(choisirDepuisX)(e.x); })
    .onUpdate(e => { "worklet"; runOnJS(choisirDepuisX)(e.x); });
  const toucher = Gesture.Tap().maxDistance(10)
    .onEnd((e, reussi) => { "worklet"; if (reussi) runOnJS(choisirDepuisX)(e.x); });
  const geste = Gesture.Race(glisser, toucher);

  const stylePouce = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value - POUCE / 2 }] }));
  // La pilule suit le pouce sans jamais sortir de la piste : aux bords, elle
  // débordait de la marge de l'écran
  const stylePilule = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.min(Math.max(0, largeur - PILULE), Math.max(0, tx.value - PILULE / 2)) }],
  }));
  const styleRempli = useAnimatedStyle(() => ({ width: Math.max(0, tx.value - PAD) }));

  if (n < 2) return null;

  return (
    <GestureDetector gesture={geste}>
      <View style={s.zone} onLayout={e => setLargeur(e.nativeEvent.layout.width)}
        accessible accessibilityRole="adjustable" accessibilityLabel="Année"
        accessibilityValue={{ min: annees[0], max: annees[n - 1], now: valeur, text: String(valeur) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={e => pas(e.nativeEvent.actionName === "increment" ? 1 : -1)}>
        {/* L'année choisie suit le pouce */}
        <Reanime.View style={[pilule, { backgroundColor: fond, borderColor: `${accent}33` }, stylePilule]}>
          <Text style={[piluleTexte, couleur != null && { color: couleur }]} maxFontSizeMultiplier={ECHELLE.compact}>{valeur}</Text>
        </Reanime.View>
        {/* Piste, portion parcourue, pouce */}
        <View style={piste} />
        <Reanime.View style={[rempli, couleur != null && { backgroundColor: couleur }, styleRempli]} />
        <Reanime.View style={[pouce, stylePouce]} />
      </View>
    </GestureDetector>
  );
}

const s = creerStyles(() => ({
  zone: { height: 54, justifyContent: "flex-end", paddingBottom: 10 },
  pilule: {
    position: "absolute", top: 0, width: PILULE, alignItems: "center",
    borderRadius: 999, borderCurve: "continuous", borderWidth: 1, paddingVertical: 2,
  },
  piluleTexte: { fontSize: 11, ...FONTE.gras, color: T.bleu, fontVariant: ["tabular-nums"] },
  piste: {
    position: "absolute", left: PAD, right: PAD, bottom: 20, height: 4,
    borderRadius: 99, backgroundColor: T.voileFort,
  },
  rempli: {
    position: "absolute", left: PAD, bottom: 20, height: 4,
    borderRadius: 99, backgroundColor: T.bleuAction,
  },
  pouce: {
    position: "absolute", left: 0, bottom: 20 - (POUCE - 4) / 2,
    width: POUCE, height: POUCE, borderRadius: POUCE / 2,
    backgroundColor: T.pouce, borderWidth: StyleSheet.hairlineWidth, borderColor: T.voileFort,
    shadowColor: "#001e3c", shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
}));
