// Bibliothèque de composants canoniques de l'app — chaque brique est
// définie UNE fois ici et consommée partout : Tapable (retour physique
// à ressort), Bouton (primaire / secondaire / fantôme, trois tailles),
// Chip, Carte, Badge pastel, RangeeStats (rangée basse des cards),
// Feuille (échafaudage des bottom sheets) et les états de chargement /
// erreur / vide. Jetons : T, TYPO, ESPACE, RAYON, OMBRE (theme.ts).
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Dimensions, Modal, Pressable, ScrollView,
  StyleProp, StyleSheet, Text, View, ViewStyle,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Reanime, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from "react-native-reanimated";
import Symbole from "@/components/Symbole";
import { foncerPastel } from "@/lib/couleurs";
import { tick } from "@/lib/haptique";
import { DUREE, ENTREE, RESSORT, apparition } from "@/lib/motion";
import { origineRecente } from "@/lib/origineTap";
import { ESPACE, OMBRE, POLICE, RAYON, T, TYPO } from "@/theme";

const PressableReanime = Reanime.createAnimatedComponent(Pressable);

// ── Tapable : le retour tactile physique de toute l'app ──────────────────────
// Ressort vif à l'appui (0.97), ressort standard au relâcher — la même
// physique (lib/motion) partout. Toute surface cliquable passe par lui.
export function Tapable({ onPress, onLongPress, disabled, style, echelle = 0.97, hitSlop, children }: {
  onPress?: () => void; onLongPress?: () => void; disabled?: boolean;
  style?: StyleProp<ViewStyle>; echelle?: number; hitSlop?: number;
  children: React.ReactNode;
}) {
  const zoom = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));
  return (
    <PressableReanime
      onPress={onPress} onLongPress={onLongPress} disabled={disabled} hitSlop={hitSlop}
      onPressIn={() => { zoom.value = withSpring(echelle, RESSORT.vif); }}
      onPressOut={() => { zoom.value = withSpring(1, RESSORT.standard); }}
      style={[animStyle, disabled && { opacity: 0.45 }, style]}>
      {children}
    </PressableReanime>
  );
}

// ── Bouton ───────────────────────────────────────────────────────────────────
export function Bouton({ label, onPress, variante = "primaire", taille = "moyenne", icone, disabled, style }: {
  label: string; onPress: () => void;
  variante?: "primaire" | "secondaire" | "fantome";
  taille?: "petite" | "moyenne" | "grande";
  icone?: string; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const dims = taille === "petite"
    ? { pv: 8, ph: 14, fs: 12.5 }
    : taille === "grande" ? { pv: 13, ph: 24, fs: 14.5 } : { pv: 10, ph: 20, fs: 13 };
  const fond = variante === "primaire" ? { backgroundColor: T.bleuAction }
    : variante === "secondaire" ? { backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure }
    : { backgroundColor: "transparent" };
  const texteCouleur = variante === "primaire" ? "#fff" : variante === "secondaire" ? T.texte : T.bleu;
  return (
    <Tapable onPress={onPress} disabled={disabled}
      style={[sb.base, fond, { paddingVertical: dims.pv, paddingHorizontal: dims.ph }, style]}>
      {icone ? <Symbole nom={icone} taille={dims.fs + 3} couleur={texteCouleur} /> : null}
      <Text style={{ fontSize: dims.fs, fontFamily: POLICE.gras, color: texteCouleur }}>{label}</Text>
    </Tapable>
  );
}

// ── Chip (filtres, catégories) ───────────────────────────────────────────────
// « pleine » : active en bleu plein, texte blanc. « pastel » : active en
// voile de sa couleur, texte coloré gras (style zones / IDE).
export function Chip({ label, actif, onPress, variante = "pastel", couleur, desactive }: {
  label: string; actif: boolean; onPress: () => void;
  variante?: "pleine" | "pastel"; couleur?: string; desactive?: boolean;
}) {
  const c = couleur || "#004f91";
  const fondActif = variante === "pleine"
    ? { backgroundColor: T.bleuAction, borderColor: T.bleuAction }
    : { backgroundColor: `${c}14`, borderColor: `${c}66` };
  const texteActif = variante === "pleine" ? { color: "#fff" } : { color: c, fontFamily: POLICE.gras };
  return (
    <Tapable onPress={() => { tick(); onPress(); }} disabled={desactive} style={[sc.chip, actif && fondActif]}>
      <Text style={[sc.texte, couleur && !actif && { color: c }, actif && texteActif]}>{label}</Text>
    </Tapable>
  );
}

// ── Carte : la surface de base ───────────────────────────────────────────────
export function Carte({ onPress, elevation = 1, style, children }: {
  onPress?: () => void; elevation?: 0 | 1 | 2; style?: StyleProp<ViewStyle>; children: React.ReactNode;
}) {
  const ombre = elevation === 2 ? OMBRE.n2 : elevation === 1 ? OMBRE.n1 : null;
  const base = [scarte.carte, ombre, style];
  if (onPress) return <Tapable onPress={onPress} style={base}>{children}</Tapable>;
  return <View style={base}>{children}</View>;
}

// ── Badge pastel (statuts, pôles) ────────────────────────────────────────────
export function Badge({ label, pastel }: { label: string; pastel: string }) {
  return (
    <View style={[sbadge.badge, { backgroundColor: `${pastel}40`, borderColor: `${pastel}90` }]}>
      <Text style={[sbadge.texte, { color: foncerPastel(pastel) }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ── RangeeStats : la rangée basse des cards (LABEL | LABEL) ──────────────────
export function RangeeStats({ items }: {
  items: { label: string; valeur: string | null; numerique?: boolean }[];
}) {
  return (
    <View style={sr.rangee}>
      {items.map((it, i) => (
        <View key={it.label} style={{ flex: 1, minWidth: 0, flexDirection: "row" }}>
          {i > 0 && <View style={sr.separateur} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={sr.label}>{it.label.toUpperCase()}</Text>
            <Text style={[sr.valeur, { color: it.valeur ? T.encre : T.grisClair }, it.numerique !== false && { fontVariant: ["tabular-nums"] }]}
              numberOfLines={1}>
              {it.valeur || "—"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Feuille : l'échafaudage des bottom sheets ────────────────────────────────
// Fond assombri, poignée, en-tête (titre + fermer), sous-en-tête libre
// (pilules…), corps défilant. `pied` fixe optionnel (boutons de filtres).
// Transition contextuelle : la feuille « pousse » depuis la card touchée
// (origine capturée à la racine) au lieu de glisser génériquement.
export function Feuille({ titre, sousEntete, onClose, hauteur = "82%", ecart = 20, pied, sansDefilement, children }: {
  titre: React.ReactNode; sousEntete?: React.ReactNode; onClose: () => void;
  hauteur?: `${number}%`; ecart?: number; pied?: React.ReactNode; sansDefilement?: boolean;
  children: React.ReactNode;
}) {
  const H = Dimensions.get("window").height;
  // Point de départ : la card touchée si le tap vient d'avoir lieu, le bas sinon
  const [depart] = useState(() => {
    const y = origineRecente();
    if (y === null) return H * 0.35;
    return Math.max(-H * 0.25, Math.min(y - H * 0.62, H * 0.35));
  });

  // Deux grandeurs pilotent tout : l'ouverture (0→1, ressort doux) et le
  // tirage du doigt. Fond, échelle et position en dérivent en continu —
  // pendant le geste, c'est l'écran entier qui suit la main.
  const progres = useSharedValue(0);
  const tirage = useSharedValue(0);
  useEffect(() => { progres.value = withSpring(1, RESSORT.doux); }, [progres]);

  const fermer = () => {
    progres.value = withTiming(0, { duration: DUREE.courte, easing: ENTREE },
      fini => { if (fini) runOnJS(onClose)(); });
  };
  const fermerAuGeste = (velocite: number) => {
    tirage.value = withSpring(H * 0.9, { ...RESSORT.doux, velocity: velocite },
      fini => { if (fini) runOnJS(onClose)(); });
  };

  const geste = Gesture.Pan()
    .activeOffsetY(4)
    .onChange(e => {
      // Vers le bas : suit le doigt ; vers le haut : résistance élastique
      tirage.value = e.translationY > 0 ? e.translationY : e.translationY / 8;
    })
    .onEnd(e => {
      if (tirage.value > 130 || e.velocityY > 900) runOnJS(fermerAuGeste)(e.velocityY);
      else tirage.value = withSpring(0, RESSORT.standard);
    });

  const styleFond = useAnimatedStyle(() => ({
    // Le voile s'éclaircit à mesure que la feuille est tirée vers le bas
    opacity: progres.value * Math.max(0, 1 - tirage.value / (H * 0.7)),
  }));
  const styleFeuille = useAnimatedStyle(() => ({
    opacity: Math.min(1, progres.value * 2.5),
    transform: [
      { translateY: (1 - progres.value) * depart + Math.max(tirage.value, -30) },
      { scale: 0.86 + 0.14 * progres.value - Math.min(Math.max(tirage.value, 0) / (H * 14), 0.01) },
    ],
  }));

  return (
    <Modal visible transparent animationType="none" onRequestClose={fermer}>
      <GestureHandlerRootView style={{ flex: 1, justifyContent: "flex-end" }}>
      <PressableReanime style={[sf.fond, styleFond]} onPress={fermer} />
      <Reanime.View style={[sf.feuille, { maxHeight: hauteur }, styleFeuille]}>
        <GestureDetector gesture={geste}>
          <View style={sf.zonePoignee}>
            <View style={sf.poignee} />
          </View>
        </GestureDetector>
        <View style={sf.entete}>
          {typeof titre === "string"
            ? <Text style={sf.titre}>{titre}</Text>
            : <View style={{ flex: 1, minWidth: 0 }}>{titre}</View>}
          <Tapable onPress={fermer} hitSlop={10} style={sf.fermer}>
            <Ionicons name="close" size={17} color={T.texte} />
          </Tapable>
        </View>
        {sousEntete}
        {sansDefilement ? children : (
          <ScrollView style={{ marginTop: ESPACE.m }} contentContainerStyle={{ gap: ecart, paddingBottom: pied ? ESPACE.m : 36 }}
            showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        )}
        {pied}
      </Reanime.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ── Apparition : entrée en cascade (fondu + 12 px de translation) ────────────
// À poser autour des cards de liste et des KPIs : `index` décale chaque
// entrée de 40 ms pour l'effet de cascade. Ressort standard (lib/motion).
export function Apparition({ index = 0, style, children }: {
  index?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode;
}) {
  return (
    <Reanime.View entering={apparition(index)} style={style}>
      {children}
    </Reanime.View>
  );
}

// ── ChiffreAnime : le nombre compte jusqu'à sa valeur ────────────────────────
// Reçoit le texte déjà formaté (« 1 234,5 M $ ») : le premier nombre est
// animé de 0 à sa valeur en conservant préfixe, suffixe et décimales.
export function ChiffreAnime({ texte, style, duree = 750 }: {
  texte: string; style?: any; duree?: number;
}) {
  const m = /-?\d[\d\u202F\u00A0 ]*(?:,\d+)?/.exec(texte);
  const [affiche, setAffiche] = useState(m ? texte.replace(m[0], "0") : texte);
  useEffect(() => {
    if (!m) { setAffiche(texte); return; }
    const brut = m[0];
    const cible = parseFloat(brut.replace(/[\u202F\u00A0 ]/g, "").replace(",", "."));
    const decimales = brut.includes(",") ? brut.split(",")[1].length : 0;
    const anim = new Animated.Value(0);
    const id = anim.addListener(({ value }) => {
      const courant = (cible * value).toLocaleString("fr-FR", {
        minimumFractionDigits: decimales, maximumFractionDigits: decimales,
      });
      setAffiche(texte.replace(brut, courant));
    });
    Animated.timing(anim, { toValue: 1, duration: duree, useNativeDriver: false }).start(() => setAffiche(texte));
    return () => { anim.removeListener(id); anim.stopAnimation(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texte]);
  return <Text style={style} numberOfLines={1} adjustsFontSizeToFit>{affiche}</Text>;
}

// ── États : chargement / erreur / vide ───────────────────────────────────────
export function EtatCharge() {
  return <View style={se.centre}><ActivityIndicator color={T.bleu} size="large" /></View>;
}

export function EtatErreur({ onRetry, texte = "Impossible de joindre la plateforme." }: {
  onRetry: () => void; texte?: string;
}) {
  return (
    <View style={se.centre}>
      <View style={se.pastille}><Symbole nom="cloud_off" taille={24} couleur={T.gris} /></View>
      <Text style={se.titre}>{texte}</Text>
      <Bouton label="Réessayer" onPress={onRetry} style={{ marginTop: ESPACE.xs }} />
    </View>
  );
}

export function EtatVide({ texte, icone = "search_off", sousTexte, action }: {
  texte: string; icone?: string; sousTexte?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={se.centre}>
      <View style={se.pastille}><Symbole nom={icone} taille={24} couleur={T.gris} /></View>
      <Text style={se.titre}>{texte}</Text>
      {sousTexte ? <Text style={se.sous}>{sousTexte}</Text> : null}
      {action ? <Bouton label={action.label} onPress={action.onPress} variante="secondaire" taille="petite" style={{ marginTop: ESPACE.xs }} /> : null}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const sb = StyleSheet.create({
  base: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    borderRadius: RAYON.petit, alignSelf: "center",
  },
});

const sc = StyleSheet.create({
  chip: {
    paddingHorizontal: 15, paddingVertical: 8, borderRadius: RAYON.pilule,
    backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure,
  },
  texte: { ...TYPO.legende, fontFamily: POLICE.demi, color: T.texte },
});

const scarte = StyleSheet.create({
  carte: {
    backgroundColor: T.carte, borderRadius: RAYON.moyen,
    borderWidth: 1, borderColor: T.bordure,
  },
});

const sbadge = StyleSheet.create({
  badge: {
    borderRadius: RAYON.pilule, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 3,
    flexShrink: 1, maxWidth: 170,
  },
  texte: { ...TYPO.micro, letterSpacing: 0, fontSize: 10.5 },
});

const sr = StyleSheet.create({
  rangee: {
    flexDirection: "row", alignItems: "center",
    borderTopWidth: 1, borderTopColor: T.filet, paddingTop: ESPACE.s,
  },
  separateur: { width: 1, alignSelf: "stretch", backgroundColor: T.filet, marginHorizontal: 18 },
  label: { fontSize: 9, fontFamily: POLICE.gras, letterSpacing: 1.1, color: T.gris, marginBottom: 4 },
  valeur: { fontSize: 12.5, fontFamily: POLICE.gras },
});

const sf = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(2,20,38,0.45)" },
  feuille: {
    backgroundColor: T.carte, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 22, paddingTop: 10, ...OMBRE.n3,
  },
  zonePoignee: { alignSelf: "stretch", alignItems: "center", paddingTop: 2, paddingBottom: ESPACE.s, marginTop: -6 },
  poignee: { width: 38, height: 4, borderRadius: 2, backgroundColor: T.bordure, marginTop: 6 },
  entete: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: ESPACE.s },
  titre: { ...TYPO.titre, flex: 1, color: T.encre },
  fermer: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.filet, alignItems: "center", justifyContent: "center" },
});

const se = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center", padding: 44, gap: ESPACE.xs },
  pastille: {
    width: 52, height: 52, borderRadius: RAYON.moyen, backgroundColor: T.filet,
    alignItems: "center", justifyContent: "center", marginBottom: 2,
  },
  titre: { ...TYPO.sousTitre, color: T.encre, textAlign: "center" },
  sous: { ...TYPO.legende, color: T.gris, textAlign: "center" },
});
