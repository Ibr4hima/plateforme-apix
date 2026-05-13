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
  return res.json();
}

export const api = {
  evenements: {
    liste:        (params?: string)        => apiFetch<any>(`/evenements${params ? `?${params}` : ""}`),
    chronogramme: (annee: number)          => apiFetch<any>(`/evenements/chronogramme?annee=${annee}`),
    detail:       (id: string)             => apiFetch<any>(`/evenements/${id}`),
    creer:        (data: any)              => apiFetch<any>("/evenements", { method: "POST", body: JSON.stringify(data) }),
    modifier:     (id: string, data: any)  => apiFetch<any>(`/evenements/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    supprimer:    (id: string)             => apiFetch<any>(`/evenements/${id}`, { method: "DELETE" }),
  },
  accords: {
    liste:        (params?: string)        => apiFetch<any>(`/accords${params ? `?${params}` : ""}`),
    detail:       (id: string)             => apiFetch<any>(`/accords/${id}`),
    modifier:     (id: string, data: any)  => apiFetch<any>(`/accords/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    supprimer:    (id: string)             => apiFetch<any>(`/accords/${id}`, { method: "DELETE" }),
  },
};
