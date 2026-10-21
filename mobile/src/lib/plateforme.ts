// La plateforme, pour le DESIGN : chaque système reçoit ce qui lui va le mieux.
//
// iOS se lit avec les composants d'iOS — barre d'onglets et barres de
// navigation du système, SF Pro, SF Symbols, contrôle segmenté natif — et
// Android garde, pour l'heure, le dessin de l'app. Toutes les bifurcations de
// design passent par cette constante plutôt que par Platform.OS épars : un
// seul endroit décide, et l'aperçu web de l'app peut s'y faire passer pour
// iOS (les chemins de code iOS s'exécutent, sans les vues natives).
import { Platform } from "react-native";

/** Vrai sur iPhone et iPad. */
export const IOS = Platform.OS === "ios";
