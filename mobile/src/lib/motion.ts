// Système de motion de l'app — UN seul vocabulaire physique, consommé
// partout. Deux ressorts (l'énergie), trois durées (le tempo), des courbes
// (les entrées/sorties non physiques, les feuilles). Toute animation de l'app
// doit puiser ici : c'est ce qui donne l'impression d'un même matériau
// qui répond sous le doigt, écran après écran.
import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";
// Le réglage tel que Reanimated l'a lu au lancement, de façon synchrone : la
// valeur de départ du suivi ci-dessous (ce n'est pas un hook, malgré son nom)
import { Easing, FadeInDown, useReducedMotion as reduitAuLancement } from "react-native-reanimated";

// ── « Réduire les animations », suivi en direct ──────────────────────────────
// Reanimated le lit une fois, au lancement : changé en cours d'usage, il
// n'arrêtait rien. Ici, le réglage suit le système à chaque bascule, et tous
// les composants qui l'écoutent se redessinent.
let reduit = reduitAuLancement();
const abonnesReduit = new Set<() => void>();
const majReduit = (v: boolean) => { if (v !== reduit) { reduit = v; abonnesReduit.forEach(f => f()); } };
AccessibilityInfo.isReduceMotionEnabled?.().then(majReduit).catch(() => {});
AccessibilityInfo.addEventListener?.("reduceMotionChanged", majReduit);
const abonnerReduit = (f: () => void) => { abonnesReduit.add(f); return () => { abonnesReduit.delete(f); }; };
const lireReduit = () => reduit;

/** Vrai si l'utilisateur a demandé moins de mouvement (réglage du système). */
export const useMouvementReduit = (): boolean => useSyncExternalStore(abonnerReduit, lireReduit);

// ── Ressorts (Reanimated, exécutés sur le fil UI) ────────────────────────────
// AUCUN NE REBONDIT : amortissement critique (ζ = c / 2√(km) ≈ 1). La valeur
// arrive vite et se pose, sans dépasser sa cible. Le ressort standard
// dépassait de 3,6 % : sur la pastille des segments, sur une feuille qui se
// repose, sur les entrées en cascade, cela se lisait comme un tressautement.
export const RESSORT = {
  // Retour tactile, curseurs aimantés : réponse immédiate
  vif:      { damping: 42, stiffness: 620, mass: 0.7 },
  // Éléments d'interface : pastilles, retours de position, petits déplacements
  standard: { damping: 36, stiffness: 320, mass: 1 },
} as const;

// ── Durées ───────────────────────────────────────────────────────────────────
export const DUREE = { courte: 160, moyenne: 300, longue: 480 } as const;

// ── Courbes (pour les timings non physiques : fondus, sorties) ───────────────
export const SORTIE = Easing.out(Easing.cubic);
export const ENTREE = Easing.in(Easing.cubic);

// ── Les feuilles : le mouvement d'une feuille d'iOS ──────────────────────────
// Un départ franc, une arrivée longue et posée, AUCUN rebond — et une durée
// fixe : la feuille met le même temps à venir quelle que soit la fiche.
const COURBE_FEUILLE = Easing.bezier(0.32, 0.72, 0, 1);
export const MOUVEMENT_FEUILLE = {
  ouverture: { duration: 440, easing: COURBE_FEUILLE },
  fermeture: { duration: 300, easing: COURBE_FEUILLE },
} as const;

// ── Entrée en cascade : fondu + 12 px, ressort standard, décalage 40 ms ──────
export const CASCADE_PAS_MS = 40;
export function apparition(index = 0) {
  return FadeInDown
    .delay(Math.min(index, 14) * CASCADE_PAS_MS)
    .springify()
    .damping(RESSORT.standard.damping)
    .stiffness(RESSORT.standard.stiffness)
    .mass(RESSORT.standard.mass)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] });
}
