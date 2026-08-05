// Curseur d'années — le doigt remonte le temps au-dessus de la carte vedette.
//
// Une piste fine, la portion parcourue en bleu, un pouce blanc à ombre douce
// et l'année choisie dans une pilule qui suit le pouce. Le glissement est
// AIMANTÉ aux années (crantage haptique à chaque changement), le tap saute
// directement à l'année visée. Par défaut, le pouce est à droite : la
// dernière année connue.
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanime, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { creerStyles, useCouleur, useStyleResolu } from "@/lib/apparence";
import { cran } from "@/lib/haptique";
import { RESSORT } from "@/lib/motion";
import { POLICE, T } from "@/theme";

const POUCE = 24;      // diamètre du pouce
const PAD = POUCE / 2; // demi-pouce de marge : il ne sort jamais de la piste

export default function CurseurAnnees({ annees, valeur, onChange, couleur: teinte, voile: voileBrut }: {
  annees: number[]; valeur: number; onChange: (annee: number) => void;
  // Teinte d'accent (portion parcourue, année) et son voile (fond de la
  // pilule) — bleu par défaut, orange sous les modules orange
  couleur?: string; voile?: string;
}) {
  // Les teintes arrivent par les PROPS (couleur={T.orange}) : ce sont des
  // jetons dynamiques, que Reanimated refuse tout autant que dans un style
  const couleur = useCouleur(teinte);
  const voile = useCouleur(voileBrut);
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
  // depuis l'extérieur : bascule de série, nouvelles données…)
  useEffect(() => {
    if (largeur > 0 && n > 0) tx.value = withSpring(xDe(valeur), RESSORT.vif);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur, largeur, annees.join(",")]);

  const choisirDepuisX = (x: number) => {
    if (largeur <= 0 || n === 0) return;
    const ratio = Math.min(1, Math.max(0, (x - PAD) / Math.max(1, largeur - 2 * PAD)));
    const a = annees[Math.round(ratio * (n - 1))];
    if (a !== valeur) { cran(); onChange(a); }
  };

  // Pan à distance nulle : le tap ET le glissement passent par le même geste
  const geste = Gesture.Pan().minDistance(0)
    .onBegin(e => { "worklet"; runOnJS(choisirDepuisX)(e.x); })
    .onUpdate(e => { "worklet"; runOnJS(choisirDepuisX)(e.x); });

  const stylePouce = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value - POUCE / 2 }] }));
  const stylePilule = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value - 24 }] }));
  const styleRempli = useAnimatedStyle(() => ({ width: Math.max(0, tx.value - PAD) }));

  if (n < 2) return null;

  return (
    <GestureDetector gesture={geste}>
      <View style={s.zone} onLayout={e => setLargeur(e.nativeEvent.layout.width)}
        accessible accessibilityRole="adjustable" accessibilityLabel={`Année : ${valeur}`}>
        {/* L'année choisie suit le pouce */}
        <Reanime.View style={[pilule, voile != null && { backgroundColor: voile }, stylePilule]}>
          <Text style={[piluleTexte, couleur != null && { color: couleur }]}>{valeur}</Text>
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
    position: "absolute", top: 0, width: 48, alignItems: "center",
    backgroundColor: T.bleuVoile, borderRadius: 999, paddingVertical: 2.5,
  },
  piluleTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.bleu, fontVariant: ["tabular-nums"] },
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
