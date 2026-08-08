"use client";
/**
 * Curseurs d'année, forme unique pour toute la plateforme.
 *
 * Le commerce extérieur a fixé la forme : bornes discrètes en gris de part et
 * d'autre, piste fine teintée, poignée ronde à liseré blanc, pastille de
 * valeur. Les autres onglets — flux bilatéraux, IDE — s'y rangent, pour qu'un
 * même geste se lise de la même façon d'une page à l'autre.
 *
 * Deux formes seulement :
 *   CurseurAnneeNace : une poignée, une valeur.
 *   CurseurPlageNace : deux poignées, un intervalle.
 *
 * La teinte passe par une variable CSS et non par un style en ligne : la
 * poignée d'un `input[type=range]` vit dans un pseudo-élément, qui n'est pas
 * atteignable autrement sans dupliquer la feuille de style par couleur.
 */
import React from "react";

export type AccentNace = { trait: string; piste: string; voile: string };
export const ACCENT_BLEU: AccentNace = { trait: "var(--bleu)", piste: "rgb(var(--bleu-rgb) / 0.18)", voile: "rgb(var(--bleu-rgb) / 0.08)" };
export const ACCENT_ORANGE: AccentNace = { trait: "var(--orange)", piste: "rgb(var(--orange-rgb) / 0.20)", voile: "rgb(var(--orange-rgb) / 0.09)" };
export const ACCENT_VERT: AccentNace = { trait: "var(--vert)", piste: "rgb(var(--vert-rgb) / 0.20)", voile: "rgb(var(--vert-rgb) / 0.09)" };
export const ACCENT_VIOLET: AccentNace = { trait: "var(--violet)", piste: "rgb(var(--violet-rgb) / 0.20)", voile: "rgb(var(--violet-rgb) / 0.09)" };

// Un accent complet à partir de la seule couleur de trait, pour les appelants
// qui n'en manipulent qu'une (les cartes IDE, teintées par indicateur).
export function accentDe(trait: string): AccentNace {
  return { trait, piste: `${trait}2E`, voile: `${trait}14` };
}

export const varsAccent = (a: AccentNace) =>
  ({ "--nace-accent": a.trait, "--nace-piste": a.piste }) as React.CSSProperties;

export const pastilleCurseur = (a: AccentNace): React.CSSProperties => ({
  fontSize: 12, fontWeight: 800, color: a.trait, background: a.voile, padding: "3px 11px",
  borderRadius: 999, fontVariantNumeric: "tabular-nums", minWidth: 46, textAlign: "center", whiteSpace: "nowrap",
  flexShrink: 0,
});

export function StylesCurseurNace() {
  return (
    <style>{`
      .nace-curseur { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 999px;
        background: var(--nace-piste, rgb(var(--bleu-rgb) / 0.18)); outline: none; cursor: pointer; }
      .nace-curseur::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 15px; height: 15px;
        border-radius: 50%; background: var(--nace-accent, var(--bleu-action)); border: 2.5px solid var(--carte); box-shadow: var(--ombre-1); cursor: grab; }
      .nace-curseur::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.12); }
      .nace-curseur::-moz-range-thumb { width: 15px; height: 15px; border-radius: 50%;
        background: var(--nace-accent, var(--bleu-action)); border: 2.5px solid var(--carte); box-shadow: var(--ombre-1); cursor: grab; }
      .nace-curseur::-moz-range-track { height: 4px; border-radius: 999px; background: var(--nace-piste, rgb(var(--bleu-rgb) / 0.18)); }
      .nace-plage { position: relative; height: 16px; }
      .nace-plage .nace-piste { position: absolute; top: 6px; left: 0; right: 0; height: 4px;
        border-radius: 999px; background: var(--nace-piste, rgb(var(--bleu-rgb) / 0.18)); }
      .nace-plage .nace-remplie { position: absolute; top: 6px; height: 4px; border-radius: 999px;
        background: var(--nace-accent, var(--bleu-action)); opacity: 0.55; }
      .nace-plage input { position: absolute; top: 0; left: 0; width: 100%; height: 16px; margin: 0;
        -webkit-appearance: none; appearance: none; background: transparent; pointer-events: none; outline: none; }
      .nace-plage input::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; pointer-events: auto;
        width: 15px; height: 15px; border-radius: 50%; background: var(--nace-accent, var(--bleu-action)); border: 2.5px solid var(--carte);
        box-shadow: var(--ombre-1); cursor: grab; }
      .nace-plage input::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.12); }
      .nace-plage input::-moz-range-thumb { pointer-events: auto; width: 15px; height: 15px; border-radius: 50%;
        background: var(--nace-accent, var(--bleu-action)); border: 2.5px solid var(--carte); box-shadow: var(--ombre-1); cursor: grab; }
      .nace-plage input::-moz-range-track { height: 4px; background: transparent; }
    `}</style>
  );
}

const BORNE: React.CSSProperties = {
  fontSize: 10, color: "var(--gris)", fontWeight: 700, fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap", flexShrink: 0,
};

/**
 * Une poignée. `pastille` permet d'afficher autre chose que la valeur brute —
 * « Cumul » quand le curseur est poussé au-delà de la dernière année — et
 * `borne` le libellé de gauche, qui n'est pas toujours `min` pour la même
 * raison.
 */
export function CurseurAnneeNace({ min, max, value, onChange, largeur = 150,
  accent = ACCENT_BLEU, pastille, borne, ariaLabel = "Année affichée", flexible }: {
  min: number; max: number; value: number; onChange: (v: number) => void; largeur?: number;
  accent?: AccentNace; pastille?: React.ReactNode; borne?: React.ReactNode;
  ariaLabel?: string; flexible?: boolean;
}) {
  if (!(max > min)) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 11, flexShrink: 0,
      ...(flexible ? { flex: 1, minWidth: 0 } : {}), ...varsAccent(accent) }}>
      <StylesCurseurNace />
      <span style={BORNE}>{borne ?? min}</span>
      <input type="range" min={min} max={max} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))} aria-label={ariaLabel}
        className="nace-curseur" style={flexible ? { flex: 1, minWidth: 0 } : { width: largeur }} />
      <span style={pastilleCurseur(accent)}>{pastille ?? value}</span>
    </span>
  );
}

/**
 * Deux poignées. Elles se bornent l'une l'autre à `ecartMin` année(s) d'écart,
 * et gardent les MÊMES bornes min/max : les restreindre décalerait leurs
 * échelles et les poignées ne pointeraient plus la même année à la même
 * position. La poignée de début est au-dessus, parce que c'est elle qu'on
 * saisit pour ouvrir un intervalle là où les deux se superposent.
 */
export function CurseurPlageNace({ min, max, debut, fin, onChange, largeur,
  accent = ACCENT_BLEU, ecartMin = 0 }: {
  min: number; max: number; debut: number; fin: number;
  onChange: (debut: number, fin: number) => void;
  largeur?: number; accent?: AccentNace; ecartMin?: number;
}) {
  if (!(max > min)) return null;
  const d = Math.max(min, Math.min(debut, fin - ecartMin));
  const f = Math.min(max, Math.max(d + ecartMin, fin));
  const pos = (a: number) => ((a - min) / (max - min)) * 100;
  return (
    <div className="nace-plage" style={{ ...(largeur ? { width: largeur } : { width: "100%" }), ...varsAccent(accent) }}>
      <StylesCurseurNace />
      <div className="nace-piste" />
      <div className="nace-remplie" style={{ left: `${pos(d)}%`, width: `${Math.max(0, pos(f) - pos(d))}%` }} />
      <input type="range" min={min} max={max} step={1} value={f} style={{ zIndex: 1 }}
        onChange={e => onChange(d, Math.max(d + ecartMin, Number(e.target.value)))}
        aria-label="Dernière année de l'intervalle" />
      <input type="range" min={min} max={max} step={1} value={d} style={{ zIndex: 2 }}
        onChange={e => onChange(Math.min(f - ecartMin, Number(e.target.value)), f)}
        aria-label="Première année de l'intervalle" />
    </div>
  );
}
