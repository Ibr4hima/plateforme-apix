"use client";

// d3 (~300 ko) et @observablehq/plot ne sont plus dans le bundle initial des
// routes : ils sont chargés à la demande dans un chunk séparé. Les proxys
// `d3` / `Plot` exposent les mêmes identifiants qu'un import namespace — le
// code des pages reste inchangé — mais les propriétés ne sont résolues qu'à
// l'appel, après chargement. Les pages/effets consommateurs se gardent avec
// `useD3Pret()` avant de rendre quoi que ce soit qui touche d3.

import { useEffect, useState } from "react";

type ModD3 = typeof import("d3");
type ModPlot = typeof import("@observablehq/plot");

let modD3: ModD3 | null = null;
let modPlot: ModPlot | null = null;
let pD3: Promise<ModD3> | null = null;
let pPlot: Promise<ModPlot> | null = null;

export function chargerD3(): Promise<ModD3> {
  if (modD3) return Promise.resolve(modD3);
  pD3 ||= import("d3").then(m => (modD3 = m));
  return pD3;
}

export function chargerPlot(): Promise<ModPlot> {
  if (modPlot) return Promise.resolve(modPlot);
  pPlot ||= import("@observablehq/plot").then(m => (modPlot = m));
  return pPlot;
}

export const d3: ModD3 = new Proxy({} as any, {
  get(_t, prop) {
    if (!modD3) throw new Error("d3 n'est pas encore chargé — garder le rendu avec useD3Pret()");
    return (modD3 as any)[prop];
  },
}) as ModD3;

export const Plot: ModPlot = new Proxy({} as any, {
  get(_t, prop) {
    if (!modPlot) throw new Error("Plot n'est pas encore chargé — garder le rendu avec useD3Pret(true)");
    return (modPlot as any)[prop];
  },
}) as ModPlot;

export function useD3Pret(avecPlot = false): boolean {
  const [pret, setPret] = useState(!!modD3 && (!avecPlot || !!modPlot));
  useEffect(() => {
    let actif = true;
    Promise.all([chargerD3(), ...(avecPlot ? [chargerPlot()] : [])])
      .then(() => { if (actif) setPret(true); });
    return () => { actif = false; };
  }, [avecPlot]);
  return pret;
}
