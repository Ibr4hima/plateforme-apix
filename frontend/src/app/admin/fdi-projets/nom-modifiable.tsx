"use client";

// Un nom d'entreprise — société mère ou entreprise — qui se corrige SUR PLACE.
//
// LE GESTE, le même dans Project database et dans Investor signals : le nom se
// souligne au survol ; un clic le change en champ, TEXTE ENTIER SÉLECTIONNÉ —
// on tape le nouveau nom par-dessus, ou → pour compléter ce qui est là ;
// Entrée enregistre, Échap renonce. Sur des milliers de lignes à vérifier
// contre fDi, c'est ce qui sépare un outil d'une corvée.
//
// CE QUE LE CHAMP PROPOSE au départ :
//   · un nom coupé encore à trancher : la partie visible chez fDi, sans ses
//     points de suspension — ou le nom complet que la base propose déjà pour
//     ce texte, qu'Entrée suffit alors à confirmer. Entrée sur la partie
//     visible la garde comme nom : on juge parfois qu'elle suffit ;
//   · un nom déjà tranché : sa valeur actuelle, puisqu'on vient la corriger.
//
// Ce que le nom atteint — cette ligne, ou toutes celles qui attendent le même
// texte coupé — se décide côté serveur (app/services/fdi_noms.py) : l'écran
// n'a sous les yeux qu'une page.

import { useEffect, useRef, useState } from "react";

import { IS } from "@/components/admin/UIAdmin";

const FIN_TRONQUEE = /\s*(?:…|\.{3})\s*$/;
const estTronque = (v: string | null | undefined) => FIN_TRONQUEE.test(v ?? "");

/** Ce que le serveur rend d'un nom enregistré. */
export type ReponseNom = { nom: string; lignes: number; partout: boolean; renomme: string | null };

/** Ce qu'un nom enregistré a changé, dit en une phrase — la même dans les deux
    tableaux. Un nom qui a valu au delà de la ligne le DIT, avec le compte : on
    doit savoir qu'on vient de corriger d'autres lignes que celle cliquée. */
export function messageNom(d: ReponseNom): string {
  const connu = d.renomme
    ? ` Entreprise déjà connue sous « ${d.renomme} » : elle porte désormais ce nom partout.` : "";
  if (d.partout && d.lignes > 1)
    return `« ${d.nom} » : ${d.lignes} lignes complétées, partout où fDi coupait ce nom.${connu}`;
  if (d.partout) return `« ${d.nom} » : nom complété.${connu}`;
  return `« ${d.nom} » : nom corrigé sur cette ligne.${connu}`;
}

export default function NomModifiable({ nom, brut, aTrancher, occupe, onValider, gras = false }: {
  /** Le nom affiché : celui de l'entreprise en base, ou le texte de fDi. */
  nom: string | null;
  /** Le texte tel que fDi l'écrit, coupé ou non. */
  brut: string | null;
  /** Un nom coupé que rien n'a encore complété : il s'affiche en orange. */
  aTrancher: boolean;
  occupe: boolean;
  onValider: (nom: string) => void;
  gras?: boolean;
}) {
  const [edition, setEdition] = useState(false);
  const [survol, setSurvol] = useState(false);
  const affiche = nom ?? brut;
  if (!affiche) return <span style={{ color: "var(--gris)" }}>—</span>;

  if (edition) {
    const depart = aTrancher
      ? (nom && !estTronque(nom) ? nom : (brut ?? nom ?? "").replace(FIN_TRONQUEE, ""))
      : affiche;
    return (
      <Champ depart={depart} occupe={occupe}
        onValider={v => {
          setEdition(false);
          // Un nom tranché qu'on n'a pas changé : rien à écrire. Un nom coupé
          // validé tel quel, si — c'est une décision, la partie visible gardée.
          if (aTrancher || v !== affiche) onValider(v);
        }}
        onFermer={() => setEdition(false)} />
    );
  }

  return (
    <button type="button" onClick={() => { setEdition(true); setSurvol(false); }} disabled={occupe}
      onMouseEnter={() => setSurvol(true)} onMouseLeave={() => setSurvol(false)}
      title={aTrancher
        ? `Coupé par fDi : « ${brut ?? affiche} ». Cliquer pour le compléter.`
        : brut && brut !== affiche
          ? `Texte de fDi : « ${brut} ». Cliquer pour corriger ce nom.`
          : "Cliquer pour corriger ce nom."}
      style={{
        border: "none", background: "none", padding: 0, margin: 0,
        cursor: occupe ? "default" : "text", fontFamily: "inherit", fontSize: "inherit",
        fontWeight: gras ? 600 : 400, textAlign: "left", lineHeight: "inherit",
        color: aTrancher ? "var(--orange)" : "var(--encre)",
        // Un nom à trancher reste souligné : il reste à faire. Les autres ne le
        // sont qu'au survol, pour dire qu'ils se corrigent aussi.
        textDecorationLine: aTrancher || survol ? "underline" : "none",
        textDecorationStyle: "dotted", textUnderlineOffset: 3,
      }}>
      {affiche}
    </button>
  );
}

function Champ({ depart, occupe, onValider, onFermer }: {
  depart: string; occupe: boolean;
  onValider: (nom: string) => void; onFermer: () => void;
}) {
  const [valeur, setValeur] = useState(depart);
  const champ = useRef<HTMLInputElement>(null);
  // TOUT LE TEXTE SÉLECTIONNÉ dès l'ouverture : taper remplace, → complète.
  // Le champ naît APRÈS le clic qui l'ouvre — aucun relâchement de souris ne
  // viendra donc défaire la sélection.
  useEffect(() => { champ.current?.focus(); champ.current?.select(); }, []);
  return (
    <input ref={champ} value={valeur} disabled={occupe}
      onChange={e => setValeur(e.target.value)}
      onKeyDown={e => {
        if (e.key === "Enter") {
          e.preventDefault();
          const v = valeur.split(/\s+/).filter(Boolean).join(" ");
          if (v) onValider(v); else onFermer();
        }
        if (e.key === "Escape") { e.preventDefault(); onFermer(); }
      }}
      // Quitter le champ renonce : un nom ne s'enregistre que par Entrée, jamais
      // parce qu'on a cliqué ailleurs.
      onBlur={onFermer}
      placeholder="Nom complet, puis Entrée"
      aria-label="Nom complet, puis Entrée"
      style={{ ...IS, padding: "4px 8px", fontSize: 12, minWidth: 220 }} />
  );
}
