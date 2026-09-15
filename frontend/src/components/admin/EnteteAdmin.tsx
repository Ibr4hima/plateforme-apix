"use client";

// En-tête de page de l'espace d'administration — le gabarit commun.
//
// POURQUOI IL REMPLACE L'APLAT ORANGE PLEINE LARGEUR. Le bandeau dégradé venait
// des pages PUBLIQUES, où il ouvre un document : on arrive, il annonce le sujet,
// on descend. Une page d'administration ne se lit pas, elle se TRAVAILLE — on y
// revient vingt fois par jour, on y cherche une ligne, on la corrige. Un aplat
// saturé sur toute la largeur y prend le premier rang de l'attention à chaque
// retour, pour redire un titre qu'on connaît déjà.
//
// Depuis que la barre latérale porte le bleu profond, il y avait de surcroît
// deux surfaces saturées côte à côte, qui se disputaient l'œil.
//
// L'en-tête est donc du PAPIER, comme le contenu, et l'orange s'y réduit à sa
// signature : la tuile du pictogramme. Ce qui le distingue du contenu n'est plus
// la couleur mais la POSITION — il reste collé en haut quand la liste défile, si
// bien que le titre, le compte et l'action principale ne quittent jamais
// l'écran.
//
// LA BARRE D'OUTILS EST DANS L'EN-TÊTE, pas dans une carte sous lui. Filtrer une
// liste, c'est agir sur le sujet de la page ; poser ces contrôles dans un cadre
// séparé en faisait un premier bloc de contenu, et la page commençait par un
// encadré avant de commencer par des données.

import React from "react";

export default function EnteteAdmin({ icone, titre, compteur, sousTitre, action, children }: {
  icone?: React.ReactNode;
  titre: string;
  /** Le nombre d'éléments du module. Affiché en pastille contre le titre. */
  compteur?: number | null;
  /** Une ligne de contexte sous le titre — ce que la page contient, en clair. */
  sousTitre?: React.ReactNode;
  /** L'action principale, à droite. Une seule : les autres vivent sur les lignes. */
  action?: React.ReactNode;
  /** La barre d'outils, posée sous le titre et séparée d'un filet. */
  children?: React.ReactNode;
}) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--carte)",
      borderBottom: "1px solid var(--bordure-forte)", fontFamily: "var(--font-google-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        padding: children ? "20px 32px 16px" : "20px 32px" }}>

        {icone && (
          // LA TUILE ORANGE EST TOUT CE QUI RESTE DE L'APLAT, et cela suffit :
          // une couleur qui désigne un espace n'a pas besoin d'en peindre le
          // fond, elle a besoin d'être toujours au même endroit.
          <span aria-hidden style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgb(var(--orange-rgb) / 0.11)",
            border: "1px solid rgb(var(--orange-rgb) / 0.20)", color: "var(--orange)" }}>
            {icone}
          </span>
        )}

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: "1.32rem", fontWeight: 800, color: "var(--encre)",
              letterSpacing: "-0.015em", lineHeight: 1.2, whiteSpace: "nowrap" }}>{titre}</h1>
            {compteur != null && (
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--orange)",
                background: "rgb(var(--orange-rgb) / 0.11)", padding: "3px 10px", borderRadius: 999,
                fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{compteur}</span>
            )}
          </div>
          {sousTitre && (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--gris)", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sousTitre}</p>
          )}
        </div>

        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>

      {children && (
        <div style={{ borderTop: "1px solid var(--bordure)", padding: "11px 32px 12px" }}>
          {children}
        </div>
      )}
    </header>
  );
}

/** Le bouton d'action principale d'une page d'administration : plein orange,
    un seul par page. Plein et non contourné parce qu'il est l'unique action qui
    CRÉE quelque chose ; tout le reste de la page modifie l'existant. */
export function BoutonPrincipal({ onClick, icone, children }: {
  onClick: () => void; icone?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <button className="ro-w" onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "none",
        background: "var(--orange-action)", color: "var(--sur-bleu)", fontWeight: 700,
        fontSize: 13, padding: "10px 18px", borderRadius: 10, cursor: "pointer",
        fontFamily: "var(--font-google-sans)", whiteSpace: "nowrap",
        boxShadow: "0 2px 10px rgb(var(--orange-rgb) / 0.30)",
        transition: "box-shadow 0.15s, transform 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgb(var(--orange-rgb) / 0.42)";
        e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 10px rgb(var(--orange-rgb) / 0.30)";
        e.currentTarget.style.transform = "none"; }}>
      {icone}{children}
    </button>
  );
}
