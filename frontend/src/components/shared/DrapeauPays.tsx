"use client";
/**
 * Drapeau d'un pays — LE composant unique de la plateforme.
 *
 * Trois rendus, dans l'ordre :
 *   1. l'emoji, si le code figure dans la liste validée (lib/drapeaux) ;
 *   2. sinon le SVG local de public/drapeaux — jamais un CDN externe ;
 *   3. sans code ISO du tout (« Bunkers », zones spéciales…), un globe,
 *      ou rien si `sansIso="rien"` (les fiches où un globe serait du bruit).
 *
 * Quatre copies quasi identiques vivaient dans les pages, à ±1 px de taille
 * près ; celle du tableau de bord fabriquait même l'emoji sans passer par la
 * liste validée, donc affichait deux lettres pour les codes inconnus. Une
 * seule implémentation, une seule liste, un paramètre de taille.
 */
import { drapeauEmoji } from "@/lib/drapeaux";

export default function DrapeauPays({ iso, nom, taille = 16, sansIso = "globe" }: {
  iso?: string | null;
  nom: string;
  /** Corps de l'emoji en px ; l'image et le globe s'en déduisent. */
  taille?: number;
  sansIso?: "globe" | "rien";
}) {
  if (iso) {
    const emoji = drapeauEmoji(iso);
    if (emoji) return <span title={nom} style={{ fontSize: taille, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/drapeaux/${iso.toLowerCase()}.svg`} alt="" title={nom}
      style={{ width: taille * 1.25, height: taille * 0.875, objectFit: "cover", borderRadius: 2.5,
               boxShadow: "0 0 0 1px rgb(var(--ombre-rgb) / 0.14)", flexShrink: 0 }} />;
  }
  if (sansIso === "rien") return null;
  return <span title={nom} style={{ fontSize: taille - 1, lineHeight: 1, flexShrink: 0 }}>🌐</span>;
}
