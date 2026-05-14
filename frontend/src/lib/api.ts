const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Erreur ${res.status}`);
  }
  // 204 No Content — pas de corps JSON
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  evenements: {
    liste:        (params?: string)       => apiFetch<any>(`/evenements${params ? "?" + params : ""}`),
    chronogramme: (annee: number)         => apiFetch<any>("/evenements/chronogramme?annee=" + annee),
    detail:       (id: string)            => apiFetch<any>("/evenements/" + id),
    creer:        (data: any)             => apiFetch<any>("/evenements", { method: "POST", body: JSON.stringify(data) }),
    modifier:     (id: string, data: any) => apiFetch<any>("/evenements/" + id, { method: "PATCH", body: JSON.stringify(data) }),
    supprimer:    (id: string)            => apiFetch<any>("/evenements/" + id, { method: "DELETE" }),
  },
  accords: {
    liste:        (params?: string)       => apiFetch<any>(`/accords${params ? "?" + params : ""}`),
    detail:       (id: string)            => apiFetch<any>("/accords/" + id),
    modifier:     (id: string, data: any) => apiFetch<any>("/accords/" + id, { method: "PATCH", body: JSON.stringify(data) }),
    supprimer:    (id: string)            => apiFetch<any>("/accords/" + id, { method: "DELETE" }),
  },
  entreprises: {
    liste:        (params?: string)       => apiFetch<any>(`/entreprises${params ? "?" + params : ""}`),
    detail:       (id: string)            => apiFetch<any>("/entreprises/" + id),
    modifier:     (id: string, data: any) => apiFetch<any>("/entreprises/" + id, { method: "PATCH", body: JSON.stringify(data) }),
    supprimer:    (id: string)            => apiFetch<any>("/entreprises/" + id, { method: "DELETE" }),
  },
  ref: {
    secteurs:  () => apiFetch<any>("/entreprises/ref/secteurs"),
    branches:  (secteur_id?: number) => apiFetch<any>("/entreprises/ref/branches" + (secteur_id ? "?secteur_id=" + secteur_id : "")),
    activites: (branche_id?: number) => apiFetch<any>("/entreprises/ref/activites" + (branche_id ? "?branche_id=" + branche_id : "")),
    pays: () => apiFetch<any>("/entreprises/ref/pays"),
  },
};
