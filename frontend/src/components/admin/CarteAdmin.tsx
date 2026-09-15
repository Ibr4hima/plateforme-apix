"use client";

// La carte des grilles d'administration, et ses pièces — le gabarit commun.
//
// POURQUOI UN SEUL COMPOSANT POUR TOUS LES MODULES. Événements, accords,
// opportunités, pôles : ce sont quatre listes du même genre. Un objet y porte un
// NOM, un STATUT, une ou deux DATES, et trois gestes — modifier, publier,
// supprimer. Chaque page s'était pourtant écrit sa propre carte, et les écarts
// s'étaient installés : un rembourrage de 18 ici et de 20 là, un filet gris
// clair d'un côté et un filet ivoire de l'autre, une barre d'actions à colonnes
// égales contre une barre alignée à gauche. Rien de grave pris isolément ;
// ensemble, c'est ce qui fait qu'un produit « ne semble pas fini ».
//
// LA FORME VIENT DES FICHES PUBLIQUES : contexte discret en haut, titre en gros,
// un filet, puis les données en colonnes étiquetées. La plateforme l'emploie
// déjà pour un projet ou un signal ; deux grammaires de carte sur un même
// produit se voient.
//
// CE QUI EST VOLONTAIREMENT ABSENT : la couleur. Une carte de liste ne porte pas
// d'accent de teinte — ni liseré, ni fond, ni bande. Les seules couleurs sont
// celles des pastilles, qui DISENT quelque chose, et celle qui revient sous le
// curseur au survol d'une action. Une grille où chaque carte a sa couleur est
// une grille où plus rien ne ressort.

import React from "react";
import { Loader2 } from "lucide-react";

/** La feuille de style des grilles d'administration. À poser une fois par page.
    Le survol est en CSS et non en gestionnaire d'événement : à douze cartes,
    douze fermetures qui réécrivent un style en ligne se sentent au défilement. */
export const STYLE_GRILLE = `
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
/* align-items: start — CHAQUE CARTE GARDE SA HAUTEUR PROPRE. Par défaut une
   grille étire toutes les cartes d'une rangée à la hauteur de la plus haute :
   inoffensif tant qu'elles se ressemblent, désastreux dès que l'une s'ouvre.
   Le dépliant de conclusion d'une prospection fait passer sa carte de 183 à
   520 px, et sa voisine, vide, s'étirait avec elle — une colonne de blanc avec
   une barre d'actions échouée tout en bas. Les cartes ayant partout la même
   structure, leur hauteur naturelle est la même : rien ne change ailleurs. */
.adm-grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px; align-items: start; }
.adm-carte { background: var(--carte); border-radius: 16px; cursor: pointer; display: flex;
  flex-direction: column; overflow: hidden; border: 1px solid rgb(var(--encre-rgb) / 0.10);
  transition: box-shadow 0.18s, transform 0.18s, border-color 0.18s; }
.adm-carte.pointille { border-style: dashed; border-color: rgb(var(--encre-rgb) / 0.22); }
.adm-carte:hover { box-shadow: 0 8px 26px rgb(var(--ombre-rgb) / 0.10); transform: translateY(-2px);
  border-color: rgb(var(--encre-rgb) / 0.18); }
.adm-carte:focus-visible { outline: 2px solid rgb(var(--bleu-rgb) / 0.55); outline-offset: 2px; }
`;

/** Une donnée de carte : l'intitulé au-dessus, la valeur dessous.
 *
 *  LES INTITULÉS SONT ÉCRITS, pas figurés. Des pictogrammes ont été essayés à
 *  leur place : ils tenaient moins de place mais demandaient de reconnaître un
 *  calendrier ou une épingle avant de lire. Sur une grille qu'on parcourt en
 *  diagonale, un mot se lit plus vite qu'un symbole à interpréter. */
export function Donnee({ label, valeur, absent = "—" }: {
  label: string; valeur: string | null; absent?: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.13em", color: "var(--gris)",
        textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
      <p title={valeur || undefined} style={{ fontSize: 13, fontWeight: 700,
        color: valeur ? "var(--encre)" : "var(--gris)", fontVariantNumeric: "tabular-nums",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {valeur || absent}
      </p>
    </div>
  );
}

/** Une action de carte : muette au repos, teintée au survol.
 *
 *  ELLES NE SONT QUE DU GRIS TANT QU'ON NE LES VISE PAS. Coloriées en
 *  permanence, trois par carte et six cartes par écran, elles faisaient dix-huit
 *  taches de couleur pour des gestes qu'on fait rarement — et la donnée passait
 *  après. Le survol rend la couleur au moment où elle sert. */
export function ActionCarte({ onClick, titre, teinte, enCours, desactive, icone, children }: {
  onClick: () => void; titre: string; teinte: string; enCours?: boolean;
  /** Le geste existe mais n'est pas encore possible — conclure une prospection
   *  sans y avoir consigné le moindre échange, par exemple. Il reste À SA
   *  PLACE, en gris pâle, et son `title` dit ce qui manque : le retirer ferait
   *  changer la barre d'actions d'une carte à l'autre pour une raison qu'on ne
   *  pourrait pas deviner. Distinct de `enCours`, qui tourne pendant l'appel. */
  desactive?: boolean;
  icone: React.ReactNode; children?: React.ReactNode;
}) {
  const inerte = enCours || desactive;
  return (
    <button onClick={onClick} disabled={inerte} title={titre} aria-label={titre}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none",
        background: "transparent", color: desactive ? "var(--gris)" : "var(--gris-fort)",
        cursor: enCours ? "default" : desactive ? "not-allowed" : "pointer",
        padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 650,
        fontFamily: "var(--font-google-sans)", transition: "background 0.14s, color 0.14s" }}
      onMouseEnter={ev => { if (inerte) return; ev.currentTarget.style.color = teinte;
        ev.currentTarget.style.background = `color-mix(in srgb, ${teinte} 9%, transparent)`; }}
      onMouseLeave={ev => { if (inerte) return; ev.currentTarget.style.color = "var(--gris-fort)";
        ev.currentTarget.style.background = "transparent"; }}>
      {enCours ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : icone}
      {children}
    </button>
  );
}

/** La carte elle-même.
 *
 *  `contexte` et `badge` se partagent la ligne de service : le badge tient le
 *  coin droit parce qu'il est la propriété que TOUTES les cartes portent, donc
 *  la seule qui gagne à être toujours au même endroit ; le contexte, variable,
 *  vient à gauche.
 *
 *  `attenue` baisse l'opacité du corps — un objet clos reste lisible mais cesse
 *  d'appeler ; `pointille` passe la bordure en tirets, ce qui se repère de loin
 *  sur une grille et vaut mieux qu'un troisième badge. */
export function CarteAdmin({ onVoir, aria, attenue, pointille, contexte, badge, titre,
  donnees, actions, pied }: {
  onVoir: () => void;
  aria: string;
  attenue?: boolean;
  pointille?: boolean;
  contexte?: React.ReactNode;
  badge?: React.ReactNode;
  titre: string;
  /** Deux au plus : au-delà, les colonnes deviennent illisibles à 340 px. */
  donnees: React.ReactNode[];
  actions: React.ReactNode;
  /** Un dépliant sous la barre d'actions, replié par défaut.
   *
   *  RÉSERVÉ AU GESTE QUI DEMANDE UNE SAISIE SUR PLACE. Conclure une
   *  prospection réclame une issue et un commentaire ; les demander dans une
   *  modale ferait perdre de vue la fiche qu'on est en train de clore. Le
   *  dépliant s'ouvre SOUS la carte concernée, à l'endroit où l'on a cliqué, et
   *  n'agrandit qu'elle. Aucun autre module ne s'en sert : une carte de liste
   *  qui contient un formulaire n'est plus une carte de liste. */
  pied?: React.ReactNode;
}) {
  return (
    <div role="button" tabIndex={0} aria-label={aria} onClick={onVoir}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onVoir(); } }}
      className={`adm-carte${pointille ? " pointille" : ""}`}>

      <div style={{ padding: "15px 20px 13px", flex: 1, display: "flex",
        flexDirection: "column", opacity: attenue ? 0.84 : 1 }}>

        {/* 27 px, LA HAUTEUR D'UNE PASTILLE. La ligne de service était réservée
            à 24 px : une carte qui porte un badge mesurait 183 px, une carte qui
            n'en porte pas, 180. Trois pixels ne se voient pas seuls — ils se
            voient quand deux cartes se touchent dans une grille, et ils
            suffisaient à ce que deux onglets d'un même module ne s'alignent pas.
            La réserve vaut désormais la hauteur du badge : toutes les cartes de
            l'administration font la même. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, minHeight: 27 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {contexte}
          </span>
          {badge}
        </div>

        {/* 15,5 px : le corps des cartes publiques. Plus grand, le titre d'un
            objet de liste prenait le rang d'un titre de section. */}
        <h3 title={titre} style={{ fontWeight: 800, fontSize: 15.5, color: "var(--encre)",
          lineHeight: 1.35, letterSpacing: "-0.01em", margin: "5px 0 0", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titre}</h3>

        <div style={{ display: "flex", alignItems: "stretch", borderTop: "1px solid var(--bordure)",
          paddingTop: 12, marginTop: 13 }}>
          {donnees.map((d, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div style={{ width: 1, alignSelf: "stretch", background: "var(--bordure)", margin: "0 20px" }} />}
              <div style={{ flex: i === 0 ? 1.15 : 1, minWidth: 0, display: "flex" }}>{d}</div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* La barre retient clic ET clavier : sans quoi Entrée sur « Modifier »
          remonterait à la carte et ouvrirait la fiche. */}
      <div className="ro-w" style={{ display: "flex", alignItems: "center", gap: 2,
        padding: "4px 10px", borderTop: "1px solid var(--bordure)" }}
        onClick={ev => ev.stopPropagation()} onKeyDown={ev => ev.stopPropagation()}>
        {actions}
      </div>

      {pied && (
        <div onClick={ev => ev.stopPropagation()} onKeyDown={ev => ev.stopPropagation()}>
          {pied}
        </div>
      )}
    </div>
  );
}

/** La pastille de contexte, en tête de la ligne de service : un statut qui ne
    concerne qu'une carte sur six, et qui n'a donc pas sa place au coin droit. */
export function PastilleContexte({ teinte, rgb, children }: {
  teinte: string; rgb: string; children: React.ReactNode;
}) {
  return (
    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.10em",
      textTransform: "uppercase", color: teinte, padding: "3px 9px", borderRadius: 999,
      background: `rgb(${rgb} / 0.10)`, flexShrink: 0, whiteSpace: "nowrap" }}>{children}</span>
  );
}

/** Le texte de la ligne de service, à côté de la pastille. */
export const TexteContexte = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gris)", overflow: "hidden",
    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span>
);

/** L'étiquette « Non publié », posée dans la barre d'actions à côté du bouton
    qui la change : c'est une propriété de GESTION, pas une caractéristique de
    l'objet, et elle n'a donc rien à faire près du titre. */
export const EtiquetteNonPublie = () => (
  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
    textTransform: "uppercase", color: "var(--gris)", background: "rgb(var(--encre-rgb) / 0.06)",
    padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>Non publié</span>
);

/** Un état vide d'administration : un pictogramme dans sa tuile, une phrase qui
    dit ce que le module contient, et la sortie.
 *
 *  LES ANCIENS EXPLIQUAIENT L'INTERFACE — « Cliquez sur "Ajouter…" » — en
 *  désignant un bouton situé ailleurs sur l'écran. Le bouton est maintenant DANS
 *  le vide, là où le regard est déjà, et la phrase sert à dire ce à quoi le
 *  module sert. */
export function EtatVide({ icone, titre, texte, action }: {
  icone: React.ReactNode; titre: string; texte: string; action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      textAlign: "center", padding: "78px 24px", background: "var(--carte)",
      border: "1px dashed var(--bordure-forte)", borderRadius: 16 }}>
      <span aria-hidden style={{ width: 54, height: 54, borderRadius: 16, display: "flex",
        alignItems: "center", justifyContent: "center", background: "rgb(var(--bleu-rgb) / 0.07)",
        color: "var(--bleu)", marginBottom: 16 }}>{icone}</span>
      <p style={{ fontSize: 15.5, fontWeight: 800, color: "var(--encre)", letterSpacing: "-0.01em" }}>{titre}</p>
      <p style={{ fontSize: 13, color: "var(--gris)", marginTop: 6, maxWidth: 380, lineHeight: 1.6 }}>{texte}</p>
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}
