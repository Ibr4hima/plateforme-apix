"use client";
/**
 * En-tête des pages à bandeau — tableau de bord, Fiche Pays, Lexique, Code
 * des investissements —, écrit à même le fond de la page. LA version unique :
 * chaque page portait sa copie, et les copies avaient commencé à dériver
 * (espacements, aria, taille et netteté du logo).
 *
 * Deux identités :
 * - par défaut, celle des barres de titre des autres pages (voir BarreTitre) :
 *   le logo de l'APIX, un filet et le titre centrés sur une même ligne, les
 *   commandes à droite, le sous-titre dessous ;
 * - `armoiries` : un texte de l'État (le Code des investissements) porte les
 *   armoiries du Sénégal et le surtitre qui les nomme, en colonne à côté
 *   d'elles.
 * Sous le tout, la rangée d'outils de la page.
 */
import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";
import NavActions from "@/components/layout/NavActions";

const TITRE: React.CSSProperties = { fontSize: 24, fontWeight: 800, margin: 0, lineHeight: 1.2, letterSpacing: "-0.02em" };
const SOUS_TITRE: React.CSSProperties = { fontSize: 13, color: "var(--gris-fort)", fontWeight: 500 };

export default function BandeauDocument({ titre, sousTitre, outils, armoiries, largeur = 1180 }: {
  titre: React.ReactNode;
  sousTitre: React.ReactNode;
  outils?: React.ReactNode; // rangée sous le titre : onglets, recherche, sélecteurs…
  /** Les armoiries du Sénégal à la place du logo de l'APIX. */
  armoiries?: { surtitre: string };
  /** La largeur utile : celle du corps de la page, qu'il surplombe au pixel. */
  largeur?: number;
}) {
  const commandes = <NavActions home flouTotal />;
  return (
    <div data-bandeau style={{ background: "var(--fond)", color: "var(--encre)", padding: "28px 40px 24px" }}>
      <div style={{ maxWidth: largeur, margin: "0 auto" }}>
        {armoiries ? (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, minWidth: 0 }}>
              <div style={{ width: 54, height: 66, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Image src="/armoiries_senegal.svg" alt="Armoiries du Sénégal" width={54} height={66} style={{ height: 64, width: "auto", objectFit: "contain" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bleu)", margin: "2px 0 8px" }}>{armoiries.surtitre}</p>
                <h1 style={TITRE}>{titre}</h1>
                <p style={{ ...SOUS_TITRE, margin: "9px 0 0" }}>{sousTitre}</p>
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>{commandes}</div>
          </div>
        ) : (
          <>
            {/* Sur une seule ligne : un titre long (deux pays aux noms longs)
                passe à la ligne plutôt que de chasser les commandes dessous. */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Sur téléphone, le logo s'efface comme dans les barres de
                  titre, pour laisser la place au titre. */}
              <span className="barre-titre-logo" style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                {/* Le dessin ne commence qu'à 12 % de la largeur de l'image :
                    la marge négative l'aligne, à l'œil, sur le corps de la
                    page. 120 × 68 : les proportions de l'image (595 × 337),
                    pour que sa place soit juste avant même qu'elle ne charge.
                    La source servie (256 px de large) est celle des barres de
                    titre : l'écran la réduit, et le logo reste net. */}
                <Link href="/" aria-label="Accueil" style={{ display: "flex", marginLeft: -8 }}>
                  <Image src="/logo_apix.png" alt="APIX Sénégal" width={120} height={68}
                    style={{ height: 40, width: "auto", objectFit: "contain" }} />
                </Link>
                <span aria-hidden style={{ width: 1, height: 30, background: "var(--bordure-forte)" }} />
              </span>
              <h1 style={{ ...TITRE, minWidth: 0, overflowWrap: "anywhere" }}>{titre}</h1>
              <div style={{ marginLeft: "auto", flexShrink: 0 }}>{commandes}</div>
            </div>
            <p style={{ ...SOUS_TITRE, margin: "12px 0 0" }}>{sousTitre}</p>
          </>
        )}
        {outils && <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 20 }}>{outils}</div>}
      </div>
    </div>
  );
}

/** Champ de recherche de l'en-tête, avec bouton d'effacement. */
export function RechercheBandeau({ q, setQ, ariaLabel = "Rechercher" }: {
  q: string;
  setQ: (v: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div style={{ position: "relative", width: "min(300px, 100%)", flexShrink: 0 }}>
      <Search size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--gris-fort)", pointerEvents: "none" }} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" aria-label={ariaLabel}
        className="ds-champ" style={{ height: 36, padding: "0 34px 0 36px", fontSize: 13 }} />
      {q && <button onClick={() => setQ("")} aria-label="Effacer la recherche"
        style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
        <X size={12} style={{ color: "var(--gris-fort)" }} />
      </button>}
    </div>
  );
}
