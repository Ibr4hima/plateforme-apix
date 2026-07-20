// Système de motion de l'app — UN seul vocabulaire physique, consommé
// partout. Trois ressorts (l'énergie), trois durées (le tempo), deux
// courbes (les entrées/sorties non physiques). Toute animation de l'app
// doit puiser ici : c'est ce qui donne l'impression d'un même matériau
// qui répond sous le doigt, écran après écran.
import { Easing, FadeInDown } from "react-native-reanimated";

// ── Ressorts (Reanimated, exécutés sur le fil UI) ────────────────────────────
export const RESSORT = {
  // Retour tactile : réponse immédiate, sans rebond parasite
  vif:      { damping: 34, stiffness: 620, mass: 0.7 },
  // Éléments d'interface : chips, retours de position, petits déplacements
  standard: { damping: 26, stiffness: 320, mass: 1 },
  // Grandes surfaces : feuilles, panneaux — amples et posés
  doux:     { damping: 30, stiffness: 200, mass: 1 },
} as const;

// ── Durées ───────────────────────────────────────────────────────────────────
export const DUREE = { courte: 160, moyenne: 300, longue: 480 } as const;

// ── Courbes (pour les timings non physiques : fondus, sorties) ───────────────
export const SORTIE = Easing.out(Easing.cubic);
export const ENTREE = Easing.in(Easing.cubic);

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
