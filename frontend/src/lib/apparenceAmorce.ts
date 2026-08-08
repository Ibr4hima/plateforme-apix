// Le schéma d'apparence, appliqué avant la première peinture.
//
// Ce module est volontairement SÉPARÉ de lib/apparence.ts, et sans directive
// "use client". Le layout racine est un composant serveur : s'il importait
// cette chaîne depuis un module client, il n'en recevrait pas la valeur mais
// une référence vers le module client, et le script injecté serait vide.
//
// Il n'exporte donc que du texte et une clé — rien qui touche à React.

export const CLE_STOCKAGE = "apix.apparence";

/**
 * Injecté tel quel dans <head>, avant tout rendu.
 *
 * Appliquer le schéma depuis React, c'est-à-dire après l'hydratation, ferait
 * clignoter une page blanche devant un utilisateur en mode sombre. C'est le
 * seul endroit de la plateforme où un script en ligne se justifie.
 *
 * Il écrit la valeur RÉSOLUE (light/dark), jamais la préférence : le reste du
 * code lit ainsi le schéma en vigueur d'un simple coup d'œil au document.
 */
export const SCRIPT_APPARENCE = `try{
var p=localStorage.getItem(${JSON.stringify(CLE_STOCKAGE)});
var s=p==="sombre"||(p!=="clair"&&matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.dataset.theme=s?"dark":"light";
}catch(e){}`;
