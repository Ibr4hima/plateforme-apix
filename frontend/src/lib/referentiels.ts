"use client";

// Référentiels partagés (pays, NAEMA, géographie, pôles…) servis par React
// Query avec staleTime infini : ces données ne changent qu'au rythme des
// migrations/admin, chaque hook ne déclenche donc qu'UN téléchargement par
// session quel que soit le nombre de pages et de modals qui l'utilisent.

import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const j = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

// gcTime long : le cache survit aux démontages (navigation entre pages)
const OPTS = { staleTime: Infinity, gcTime: 24 * 60 * 60 * 1000, retry: 1 } as const;

const REFS = {
  pays:            `${API}/entreprises/ref/pays`,
  secteurs:        `${API}/entreprises/ref/secteurs`,
  branches:        `${API}/entreprises/ref/branches`,
  activites:       `${API}/entreprises/ref/activites`,
  regions:         `${API}/entreprises/ref/regions`,
  departements:    `${API}/entreprises/ref/departements`,
  arrondissements: `${API}/entreprises/ref/arrondissements`,
  formes:          `${API}/entreprises/ref/formes-juridiques`,
  polesEntreprises: `${API}/entreprises/ref/poles`,
  polesTerritoires: `${API}/zones-types/poles`,
} as const;

function useRef_(cle: keyof typeof REFS) {
  return useQuery({ queryKey: ["ref", cle], queryFn: () => j(REFS[cle]), ...OPTS });
}

export const useRefPays             = () => useRef_("pays");
export const useRefSecteurs         = () => useRef_("secteurs");
export const useRefBranches         = () => useRef_("branches");
export const useRefActivites        = () => useRef_("activites");
export const useRefRegions          = () => useRef_("regions");
export const useRefDepartements     = () => useRef_("departements");
export const useRefArrondissements  = () => useRef_("arrondissements");
export const useRefFormesJuridiques = () => useRef_("formes");
export const useRefPolesEntreprises = () => useRef_("polesEntreprises");
export const useRefPolesTerritoires = () => useRef_("polesTerritoires");

// ── NAEMA à plat : { secteurs, branches, activites } ─────────────────────────
export function useNaema() {
  const rs = useQueries({
    queries: (["secteurs", "branches", "activites"] as const).map(cle => ({
      queryKey: ["ref", cle], queryFn: () => j(REFS[cle]), ...OPTS,
    })),
  });
  const [s, b, a] = rs;
  return {
    secteurs:  (s.data as any[]) || [],
    branches:  (b.data as any[]) || [],
    activites: (a.data as any[]) || [],
    isLoading: rs.some(r => r.isLoading),
  };
}

// ── Arbre NAEMA : secteurs → branches → activites (forme utilisée par les
//    filtres thématiques des pages publiques) ─────────────────────────────────
export function useNaemaArbre() {
  const { secteurs, branches, activites, isLoading } = useNaema();
  const arbre = useMemo(() => (secteurs || []).map((s: any) => ({
    ...s,
    branches: (branches || []).filter((b: any) => b.secteur_id === s.id).map((b: any) => ({
      ...b,
      activites: (activites || []).filter((a: any) => a.branche_id === b.id),
    })),
  })), [secteurs, branches, activites]);
  return { arbre, isLoading };
}

// ── Arbre géographique : régions → départements → arrondissements ────────────
export function useGeoArbre() {
  const rs = useQueries({
    queries: (["regions", "departements", "arrondissements"] as const).map(cle => ({
      queryKey: ["ref", cle], queryFn: () => j(REFS[cle]), ...OPTS,
    })),
  });
  const [r, d, a] = rs;
  const arbre = useMemo(() => ((r.data as any[]) || []).map((reg: any) => ({
    ...reg,
    departements: ((d.data as any[]) || []).filter((dep: any) => dep.region_id === reg.id).map((dep: any) => ({
      ...dep,
      arrondissements: ((a.data as any[]) || []).filter((arr: any) => arr.departement_id === dep.id),
    })),
  })), [r.data, d.data, a.data]);
  return { arbre, isLoading: rs.some(x => x.isLoading) };
}
