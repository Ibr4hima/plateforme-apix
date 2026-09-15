"use client";

// En-tête de page de l'espace d'administration — le gabarit commun.
//
// POURQUOI IL A REMPLACÉ L'APLAT PLEINE LARGEUR. Le bandeau dégradé venait des
// pages PUBLIQUES, où il ouvre un document : on arrive, il annonce le sujet, on
// descend. Une page d'administration ne se lit pas, elle se TRAVAILLE — on y
// revient vingt fois par jour, on y cherche une ligne, on la corrige. Un aplat
// saturé sur toute la largeur y prenait le premier rang de l'attention à chaque
// retour, pour redire un titre qu'on connaît déjà.
//
// L'en-tête est donc du PAPIER, comme le contenu. Ce qui le distingue n'est plus
// la couleur mais la POSITION : il reste collé en haut quand la liste défile, si
// bien que le titre, la recherche et l'action principale ne quittent jamais
// l'écran.
//
// ── LE BLEU, PAS L'ORANGE ────────────────────────────────────────────────────
// L'orange a été essayé ici, et retiré. Il signe l'espace d'administration, et
// la barre latérale le fait déjà — cartouche « Admin », liseré de la page
// courante, avatar. Le répéter sur la tuile, sur la pastille de compte et sur le
// bouton d'action en faisait la couleur DOMINANTE d'un écran de travail, alors
// qu'il n'a qu'un rôle de repère. Le bleu est la couleur de la plateforme : il
// porte les actions ici comme partout ailleurs, et l'orange redevient ce qu'il
// doit être — une signature, à un seul endroit.
//
// TOUT TIENT SUR UNE LIGNE : le titre, son compte, la recherche, l'action. La
// recherche y prend la forme d'une pastille, comme le bouton qu'elle voisine.
// Une deuxième rangée de contrôles sous le titre en faisait un premier bloc de
// contenu, et la page commençait par un encadré avant de commencer par des
// données.

import React from "react";
import { usePathname } from "next/navigation";
import { MODULES_ADMIN } from "@/components/admin/navAdmin";

/** Le pictogramme du module courant — CELUI DE LA BARRE LATÉRALE, pris à la
 *  même source.
 *
 *  POURQUOI IL N'EST PAS PASSÉ EN PARAMÈTRE. Chaque page choisissait le sien
 *  dans lucide, et la barre latérale le sien dans Material Symbols : le même
 *  module se présentait donc sous deux dessins selon qu'on le lisait dans le
 *  menu ou en tête de page. Deux sources, deux vérités, et une dérive garantie
 *  au premier module ajouté.
 *
 *  L'en-tête va désormais le chercher dans `navAdmin.ts`, d'après l'adresse
 *  courante. Il n'y a plus rien à tenir en accord : changer l'icône du menu
 *  change celle de la page, et une page ne PEUT PLUS en afficher une autre.
 *
 *  Il est rendu PLEIN, comme l'entrée active du menu : c'est la même page, elle
 *  se signale des deux côtés de la même façon. */
export function IconeModule({ taille = 20 }: { taille?: number }) {
  const pathname = usePathname() || "";
  const item = MODULES_ADMIN.find(
    m => m.type === "link" && (pathname === m.href || pathname.startsWith(m.href + "/")));
  const nom = item && item.type === "link" ? item.icon : null;
  if (!nom) return null;
  return (
    <span className="material-symbols-outlined" aria-hidden
      style={{ fontSize: taille, lineHeight: 1, fontVariationSettings:
        "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>{nom}</span>
  );
}

export default function EnteteAdmin({ titre, compteur, sousTitre, recherche, action, children }: {
  titre: string;
  /** Le nombre d'éléments du module. Affiché en pastille contre le titre. */
  compteur?: number | null;
  /** Une ligne de contexte sous le titre. À n'employer que si elle apprend
      quelque chose que la liste ne montre pas déjà. */
  sousTitre?: React.ReactNode;
  /** Le champ de recherche, sur la ligne du titre. */
  recherche?: React.ReactNode;
  /** L'action principale, à droite. Une seule : les autres vivent sur les lignes. */
  action?: React.ReactNode;
  /** Une barre d'outils supplémentaire, sous le titre, séparée d'un filet.
      Réservée aux modules qui ne peuvent pas s'en passer. */
  children?: React.ReactNode;
}) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--carte)",
      borderBottom: "1px solid var(--bordure)", fontFamily: "var(--font-google-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        padding: children ? "18px 32px 15px" : "18px 32px" }}>

        <span aria-hidden style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgb(var(--bleu-rgb) / 0.09)",
          border: "1px solid rgb(var(--bleu-rgb) / 0.16)", color: "var(--bleu)" }}>
          <IconeModule />
        </span>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: "1.34rem", fontWeight: 800, color: "var(--encre)",
              letterSpacing: "-0.015em", lineHeight: 1.2, whiteSpace: "nowrap" }}>{titre}</h1>
            {compteur != null && (
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--bleu)",
                background: "rgb(var(--bleu-rgb) / 0.09)", padding: "3px 10px", borderRadius: 999,
                fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{compteur}</span>
            )}
          </div>
          {sousTitre && (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--gris)", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sousTitre}</p>
          )}
        </div>

        {/* La recherche est poussée à droite avec l'action : ensemble elles
            forment le groupe des OUTILS, distinct du groupe qui NOMME la page. */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10,
          flexWrap: "wrap" }}>
          {recherche}
          {action}
        </div>
      </div>

      {children && (
        <div style={{ borderTop: "1px solid var(--bordure)", padding: "11px 32px 12px" }}>
          {children}
        </div>
      )}
    </header>
  );
}

/** Le bouton d'action principale d'une page d'administration : plein bleu, un
    seul par page. Plein et non contourné parce qu'il est l'unique action qui
    CRÉE quelque chose ; tout le reste de la page modifie l'existant. Arrondi en
    pastille pour s'accorder au champ de recherche qu'il voisine. */
export function BoutonPrincipal({ onClick, icone, children }: {
  onClick: () => void; icone?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <button className="ro-w" onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "none", height: 38,
        background: "var(--bleu-action)", color: "var(--sur-bleu)", fontWeight: 700,
        fontSize: 13, padding: "0 20px", borderRadius: 999, cursor: "pointer",
        fontFamily: "var(--font-google-sans)", whiteSpace: "nowrap",
        boxShadow: "0 2px 10px rgb(var(--bleu-rgb) / 0.26)",
        transition: "box-shadow 0.15s, transform 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgb(var(--bleu-rgb) / 0.38)";
        e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 10px rgb(var(--bleu-rgb) / 0.26)";
        e.currentTarget.style.transform = "none"; }}>
      {icone}{children}
    </button>
  );
}
