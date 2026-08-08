"use client";

// La commande d'apparence — un bouton, trois états.
//
// Trois et non deux : « système » n'est pas un intermédiaire entre clair et
// sombre, c'est le réglage par défaut, celui qui suit l'appareil et bascule
// tout seul au coucher du soleil. Un simple interrupteur clair/sombre l'aurait
// rendu inatteignable dès le premier clic.
//
// L'icône montre l'état COURANT, jamais celui qu'on obtiendrait en cliquant :
// une commande doit dire où l'on est. Ce que fera le clic est dans l'infobulle
// et dans le libellé accessible.

import { Monitor, Moon, Sun } from "lucide-react";
import { appliquerSchema, schemaSuivant, useSchema, type Schema } from "@/lib/apparence";

const ETATS: Record<Schema, { icone: typeof Sun; nom: string }> = {
  systeme: { icone: Monitor, nom: "système" },
  clair:   { icone: Sun,     nom: "clair" },
  sombre:  { icone: Moon,    nom: "sombre" },
};

export default function BasculeApparence({ style, className, couleur, taille = 17, libelle }: {
  /** Le gabarit du bouton — celui des autres commandes de la barre. */
  style?: React.CSSProperties;
  className?: string;
  couleur?: string;
  taille?: number;
  /** Affiche le nom de l'état à côté de l'icône (barres latérales dépliées). */
  libelle?: boolean;
}) {
  const schema = useSchema();
  const { icone: Icone, nom } = ETATS[schema];
  const suivant = schemaSuivant(schema);

  return (
    <button
      type="button"
      onClick={() => appliquerSchema(suivant)}
      title={`Apparence : ${nom} — passer au mode ${ETATS[suivant].nom}`}
      aria-label={`Apparence : ${nom}. Passer au mode ${ETATS[suivant].nom}.`}
      style={style}
      className={className}
    >
      <Icone size={taille} strokeWidth={2} color={couleur} aria-hidden />
      {libelle && <span className="nav-txt" style={{ fontWeight: 600, color: couleur }}>Apparence : {nom}</span>}
    </button>
  );
}
