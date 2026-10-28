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
// L'en-tête est donc écrit À MÊME LE FOND de la page, comme dans e-Voting : ni
// bandeau, ni carte. Ce qui le distingue n'est pas la couleur mais la POSITION :
// il reste collé en haut quand la liste défile, si bien que le titre, la
// recherche et l'action principale ne quittent jamais l'écran.
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
// recherche y prend la hauteur et les coins du bouton qu'elle voisine. Une
// deuxième rangée de contrôles sous le titre en faisait un premier bloc de
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
 *  menu ou dans la page. Deux sources, deux vérités, et une dérive garantie
 *  au premier module ajouté.
 *
 *  Les états vides vont donc le chercher dans `navAdmin.ts`, d'après l'adresse
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

export default function EnteteAdmin({ titre, compteur, recherche, action, children }: {
  titre: string;
  /** Le nombre d'éléments du module. Affiché en pastille contre le titre. */
  compteur?: number | null;
  /** Le champ de recherche, sur la ligne du titre. */
  recherche?: React.ReactNode;
  /** L'action principale, à droite. Une seule : les autres vivent sur les lignes. */
  action?: React.ReactNode;
  /** Une barre d'outils supplémentaire, sous le titre, séparée d'un filet.
      Réservée aux modules qui ne peuvent pas s'en passer. */
  children?: React.ReactNode;
}) {
  return (
    // 76 px, la hauteur de l'en-tête de la barre latérale : le titre de l'écran
    // se lit sur la même ligne que le logo, comme dans e-Voting.
    <header style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--fond)",
      fontFamily: "var(--font-google-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        minHeight: 76, padding: children ? "14px 32px 12px" : "14px 32px" }}>

        {/* LE TITRE EST SEUL SUR SA LIGNE, sans ligne de contexte sous lui. Les
            sous-titres essayés y redisaient ce que la grille montre déjà —
            « 7 événements », « Zones Économiques Spéciales · 2 entreprises
            installées » — et faisaient du titre un bloc de deux étages là où une
            page d'administration n'a qu'à se nommer. Le compte tient dans la
            pastille, le reste se lit sur les cartes. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--encre)",
            letterSpacing: "-0.02em", lineHeight: 1.25, whiteSpace: "nowrap" }}>{titre}</h1>
          {compteur != null && (
            <span style={{ display: "inline-flex", alignItems: "center", height: 22, fontSize: 11.5,
              fontWeight: 700, color: "var(--bleu)", background: "var(--carte)",
              border: "1px solid rgb(var(--bleu-rgb) / 0.35)", padding: "0 9px", borderRadius: 999,
              fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{compteur}</span>
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
        <div style={{ padding: "0 32px 14px" }}>
          {children}
        </div>
      )}
    </header>
  );
}

/** Le bouton d'action principale d'une page d'administration : plein bleu, un
    seul par page. Plein et non contourné parce qu'il est l'unique action qui
    CRÉE quelque chose ; tout le reste de la page modifie l'existant. 36 px,
    la hauteur du champ de recherche qu'il voisine. */
export function BoutonPrincipal({ onClick, icone, children }: {
  onClick: () => void; icone?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <button className="ro-w ds-bouton ds-bouton--primaire" onClick={onClick}
      style={{ height: 36, padding: "0 14px", fontSize: 13 }}>
      {icone}{children}
    </button>
  );
}
