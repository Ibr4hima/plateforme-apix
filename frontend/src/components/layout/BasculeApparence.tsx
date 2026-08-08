"use client";

// La commande d'apparence — un bouton, deux états.
//
// L'icône montre le mode COURANT : le soleil quand la page est claire, la lune
// quand elle est sombre. Une commande doit dire où l'on est ; ce que fera le
// clic est dans l'infobulle et dans le libellé accessible.
//
// Les deux glyphes (light_mode, dark_mode) viennent de Material Symbols, comme
// le reste des icônes de la plateforme — et de la police AUTO-HÉBERGÉE, pas de
// fonts.googleapis.com : le sous-ensemble de public/polices a été régénéré pour
// les inclure. Voir la note de globals.css pour la marche à suivre.
//
// ── Et le mode « système » ? ─────────────────────────────────────────────────
// Il reste, mais sans bouton : tant que l'utilisateur n'a rien choisi, aucune
// préférence n'est enregistrée et la page suit l'appareil, y compris s'il
// bascule pendant qu'elle est ouverte. Le premier clic fixe un choix explicite.
// C'est pourquoi l'icône suit le schéma RÉSOLU (useSombre) et non la préférence
// (useSchema) : en mode système, seule la première dit ce qui est à l'écran.

import { appliquerSchema, useSombre } from "@/lib/apparence";

export default function BasculeApparence({ style, className, couleur, taille = 18, libelle }: {
  /** Le gabarit du bouton — celui des autres commandes de la barre. */
  style?: React.CSSProperties;
  className?: string;
  couleur?: string;
  taille?: number;
  /** Affiche le nom du mode à côté de l'icône (barres latérales dépliées). */
  libelle?: boolean;
}) {
  const sombre = useSombre();
  const nom = sombre ? "sombre" : "clair";
  const suivant = sombre ? "clair" : "sombre";

  return (
    <button
      type="button"
      onClick={() => appliquerSchema(suivant)}
      title={`Mode ${nom} — passer au mode ${suivant}`}
      aria-label={`Mode ${nom}. Passer au mode ${suivant}.`}
      style={style}
      className={className}
    >
      <span
        className="material-symbols-outlined"
        aria-hidden
        style={{
          fontSize: taille,
          color: couleur,
          lineHeight: 1,
          fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24",
        }}
      >
        {sombre ? "dark_mode" : "light_mode"}
      </span>
      {libelle && <span className="nav-txt" style={{ fontWeight: 600, color: couleur }}>Mode {nom}</span>}
    </button>
  );
}
