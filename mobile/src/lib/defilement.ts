// Quand un titre a le droit de défiler — les conditions partagées par tous
// les TexteDefilant de l'app. Un titre ne bouge que s'il est lu : son écran a
// le focus, il est sur la couche du dessus (aucune feuille ne le recouvre) et
// l'app est au premier plan. Hors de là, rien ne tourne : pas une image n'est
// calculée pour un texte que personne ne voit.
//
// Et jamais plus de trois à la fois : une liste de dix noms trop longs ne
// devient pas un tableau d'affichage — ils passent chacun leur tour.
import { NavigationContext } from "@react-navigation/native";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";

// ── L'app au premier plan ────────────────────────────────────────────────────
// « background » et « inactive » (appel entrant, centre de contrôle) arrêtent
// tout ; un état encore inconnu au lancement compte pour actif.
let appActive = AppState.currentState !== "background" && AppState.currentState !== "inactive";
const abonnesApp = new Set<() => void>();
AppState.addEventListener("change", etat => {
  const actif = etat === "active";
  if (actif !== appActive) { appActive = actif; abonnesApp.forEach(f => f()); }
});
const abonnerApp = (f: () => void) => { abonnesApp.add(f); return () => { abonnesApp.delete(f); }; };
const lireApp = () => appActive;

// ── Les couches : l'écran, puis chaque feuille ouverte par-dessus ────────────
// Une feuille (Feuille, Visionneuse) ouvre une couche et la transmet à son
// contenu. La couche du dessus est la plus récente : son numéro, donné au
// premier rendu, croît avec l'ordre d'ouverture — une feuille ouverte depuis
// une autre la recouvre, même montées ensemble.
let prochaineCouche = 1;
const couchesOuvertes = new Set<number>();
let coucheHaute = 0;
const abonnesCouches = new Set<() => void>();
const recalculer = () => {
  const haute = couchesOuvertes.size ? Math.max(...couchesOuvertes) : 0;
  if (haute !== coucheHaute) { coucheHaute = haute; abonnesCouches.forEach(f => f()); }
};
const abonnerCouches = (f: () => void) => { abonnesCouches.add(f); return () => { abonnesCouches.delete(f); }; };
const lireCouche = () => coucheHaute;

/** La couche d'un contenu — 0 pour l'écran lui-même. */
export const CoucheContexte = createContext(0);

/** Ouvre une couche le temps que la feuille est montée ; à transmettre à son
    contenu par CoucheContexte. */
export function useOuvrirCouche(): number {
  const [id] = useState(() => prochaineCouche++);
  useEffect(() => {
    couchesOuvertes.add(id); recalculer();
    return () => { couchesOuvertes.delete(id); recalculer(); };
  }, [id]);
  return id;
}

// ── L'écran a le focus ───────────────────────────────────────────────────────
// useIsFocused, sans son exigence d'un navigateur : hors navigation (racine,
// aperçu), le contenu compte pour affiché.
function useFocusEcran(): boolean {
  const navigation = useContext(NavigationContext);
  const [focus, setFocus] = useState(() => navigation?.isFocused() ?? true);
  useEffect(() => {
    if (!navigation) return;
    setFocus(navigation.isFocused());
    const a = navigation.addListener("focus", () => setFocus(true));
    const b = navigation.addListener("blur", () => setFocus(false));
    return () => { a(); b(); };
  }, [navigation]);
  return focus;
}

/** Vrai si un titre de ce contenu peut défiler maintenant. */
export function useDefilementPermis(): boolean {
  const focus = useFocusEcran();
  const couche = useContext(CoucheContexte);
  const haute = useSyncExternalStore(abonnerCouches, lireCouche);
  const actif = useSyncExternalStore(abonnerApp, lireApp);
  return focus && couche === haute && actif;
}

// ── Trois titres au plus en mouvement ────────────────────────────────────────
const MAX_EN_MOUVEMENT = 3;
let enMouvement = 0;
/** Un tour de défilement — faux si trois tournent déjà : réessayer plus tard. */
export const prendreTour = (): boolean => {
  if (enMouvement >= MAX_EN_MOUVEMENT) return false;
  enMouvement++;
  return true;
};
export const rendreTour = () => { enMouvement = Math.max(0, enMouvement - 1); };
