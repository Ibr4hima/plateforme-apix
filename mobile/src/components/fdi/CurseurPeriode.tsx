// Curseur de période — deux poignées sur une piste, aimantées aux années.
//
// Le frère du curseur d'années de la carte vedette (CurseurAnnees) : même
// piste fine, même pouce blanc à ombre douce, même pilule qui suit le pouce,
// même aimantation aux années. Il en faut deux ici : une période a un début
// et une fin.
//
// LA SÉLECTION NE PART QU'AU LÂCHER. Un glissement traverse dix années en une
// seconde ; envoyer chacune au serveur ferait dix requêtes de liste et dix de
// périmètre pour n'en garder qu'une. Les pilules suivent le doigt en direct,
// la période est appliquée quand il se lève.
//
// Le doigt prend la poignée la plus proche de l'endroit touché : un tap sur la
// piste y amène directement la borne la plus voisine. Les deux poignées ne se
// croisent jamais ; elles peuvent se rejoindre — une seule année.
//
// Quand elles se rapprochent, leurs deux pilules se fondent en une seule
// (« 2015 – 2016 ») plutôt que de se chevaucher.
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanime, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { creerStyles, useCouleur, useStyleResolu } from "@/lib/apparence";
import { RESSORT } from "@/lib/motion";
import { POLICE, T } from "@/theme";

const POUCE = 26;
const PAD = POUCE / 2;
const PILULE = 48;          // largeur d'une pilule d'année
const FUSION = PILULE + 6;  // en deçà, les deux pilules n'en font qu'une

export default function CurseurPeriode({ min, max, debut, fin, onChange }: {
  min: number; max: number; debut: number; fin: number;
  /** Appelé au LÂCHER seulement, avec la période retenue. */
  onChange: (debut: number, fin: number) => void;
}) {
  const [largeur, setLargeur] = useState(0);
  // La période EN COURS de glissement — elle peut différer de celle reçue
  const [d, setD] = useState(debut);
  const [f, setF] = useState(fin);
  const courant = useRef({ d: debut, f: fin, actif: "d" as "d" | "f" });
  useEffect(() => {
    setD(debut); setF(fin);
    courant.current = { ...courant.current, d: debut, f: fin };
  }, [debut, fin]);

  const bleu = useCouleur(T.bleu) as unknown as string;
  const piste = useStyleResolu(s.piste);
  const rempli = useStyleResolu(s.rempli);
  const pouce = useStyleResolu(s.pouce);
  const pilule = useStyleResolu(s.pilule);
  const piluleTexte = useStyleResolu(s.piluleTexte);

  const n = Math.max(1, max - min);
  const utile = Math.max(1, largeur - 2 * PAD);
  const xDe = (a: number) => PAD + ((a - min) / n) * utile;
  const anneeDe = (x: number) => min + Math.round(Math.min(1, Math.max(0, (x - PAD) / utile)) * n);

  const txD = useSharedValue(PAD);
  const txF = useSharedValue(PAD);
  useEffect(() => {
    if (largeur <= 0) return;
    txD.value = withSpring(xDe(d), RESSORT.vif);
    txF.value = withSpring(xDe(f), RESSORT.vif);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, f, largeur, min, max]);

  const deplacer = (x: number) => {
    const a = anneeDe(x);
    const c = courant.current;
    if (c.actif === "d") {
      const v = Math.min(a, c.f);
      if (v !== c.d) { c.d = v; setD(v); }
    } else {
      const v = Math.max(a, c.d);
      if (v !== c.f) { c.f = v; setF(v); }
    }
  };
  const commencer = (x: number) => {
    const c = courant.current;
    const a = anneeDe(x);
    // La poignée la plus proche ; à égalité — poignées jointes —, celle du
    // côté où va le doigt
    const ecartD = Math.abs(a - c.d), ecartF = Math.abs(a - c.f);
    c.actif = ecartD < ecartF ? "d" : ecartF < ecartD ? "f" : (a < c.d ? "d" : "f");
    deplacer(x);
  };
  const lacher = () => {
    const c = courant.current;
    if (c.d !== debut || c.f !== fin) onChange(c.d, c.f);
  };

  const geste = Gesture.Pan().minDistance(0)
    .onBegin(e => { "worklet"; runOnJS(commencer)(e.x); })
    .onUpdate(e => { "worklet"; runOnJS(deplacer)(e.x); })
    .onFinalize(() => { "worklet"; runOnJS(lacher)(); });

  const stylePouceD = useAnimatedStyle(() => ({ transform: [{ translateX: txD.value - POUCE / 2 }] }));
  const stylePouceF = useAnimatedStyle(() => ({ transform: [{ translateX: txF.value - POUCE / 2 }] }));
  const styleRempli = useAnimatedStyle(() => ({
    left: txD.value, width: Math.max(0, txF.value - txD.value),
  }));
  const stylePiluleD = useAnimatedStyle(() => ({
    opacity: txF.value - txD.value < FUSION ? 0 : 1,
    transform: [{ translateX: txD.value - PILULE / 2 }],
  }));
  const stylePiluleF = useAnimatedStyle(() => ({
    opacity: txF.value - txD.value < FUSION ? 0 : 1,
    transform: [{ translateX: txF.value - PILULE / 2 }],
  }));
  const stylePiluleJointe = useAnimatedStyle(() => ({
    opacity: txF.value - txD.value < FUSION ? 1 : 0,
    transform: [{ translateX: (txD.value + txF.value) / 2 - 52 }],
  }));

  if (max <= min) return null;

  return (
    <GestureDetector gesture={geste}>
      <View style={s.zone} onLayout={e => setLargeur(e.nativeEvent.layout.width)}
        accessible accessibilityRole="adjustable" accessibilityLabel={`Période : de ${d} à ${f}`}>
        <Reanime.View style={[pilule, stylePiluleD]} pointerEvents="none">
          <Text style={piluleTexte}>{d}</Text>
        </Reanime.View>
        <Reanime.View style={[pilule, stylePiluleF]} pointerEvents="none">
          <Text style={piluleTexte}>{f}</Text>
        </Reanime.View>
        <Reanime.View style={[pilule, { width: 104 }, stylePiluleJointe]} pointerEvents="none">
          <Text style={piluleTexte}>{d === f ? d : `${d} – ${f}`}</Text>
        </Reanime.View>
        <View style={piste} />
        <Reanime.View style={[rempli, { backgroundColor: bleu }, styleRempli]} />
        <Reanime.View style={[pouce, stylePouceD]} />
        <Reanime.View style={[pouce, stylePouceF]} />
        {/* Les bornes du relevé, aux deux extrémités : on sait jusqu'où aller */}
        <View style={s.bornes} pointerEvents="none">
          <Text style={s.borne}>{min}</Text>
          <Text style={s.borne}>{max}</Text>
        </View>
      </View>
    </GestureDetector>
  );
}

const s = creerStyles(() => ({
  zone: { height: 74, justifyContent: "flex-end", paddingBottom: 22 },
  pilule: {
    position: "absolute", top: 0, width: PILULE, alignItems: "center",
    backgroundColor: T.bleuVoile, borderRadius: 999, paddingVertical: 3,
  },
  piluleTexte: { fontSize: 11.5, fontFamily: POLICE.gras, color: T.bleu, fontVariant: ["tabular-nums"] },
  piste: {
    position: "absolute", left: PAD, right: PAD, bottom: 33, height: 4,
    borderRadius: 99, backgroundColor: T.voileFort,
  },
  rempli: { position: "absolute", bottom: 33, height: 4, borderRadius: 99 },
  pouce: {
    position: "absolute", left: 0, bottom: 33 - (POUCE - 4) / 2,
    width: POUCE, height: POUCE, borderRadius: POUCE / 2,
    backgroundColor: T.pouce, borderWidth: StyleSheet.hairlineWidth, borderColor: T.voileFort,
    shadowColor: "#001e3c", shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  bornes: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", justifyContent: "space-between" },
  borne: { fontSize: 10, fontFamily: POLICE.demi, color: T.gris, fontVariant: ["tabular-nums"] },
}));
