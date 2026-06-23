const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * Récupère le JWT NextAuth depuis le cookie de session (côté serveur uniquement).
 * Retourne null si pas de session ou si côté client.
 */
async function getServerToken(): Promise<string | null> {
  // Uniquement côté serveur (Server Components / Server Actions)
  if (typeof window !== "undefined") return null;
  try {
    const { getToken } = await import("next-auth/jwt");
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll()
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join("; ");
    // Crée un objet Request factice pour getToken
    const fakeReq = new Request("http://localhost", {
      headers: { cookie: cookieHeader },
    });
    const token = await getToken({
      req: fakeReq as Parameters<typeof getToken>[0]["req"],
      secret: process.env.AUTH_SECRET!,
      // Le cookie en prod est sécurisé ; en dev il ne l'est pas
      secureCookie: process.env.NODE_ENV === "production",
    });
    if (!token) return null;
    // Re-encode le token pour qu'il soit lisible par le backend (HS256)
    // On utilise directement le cookie raw (déjà signé HS256 via notre encode custom)
    const rawCookieName =
      process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token";
    return cookieStore.get(rawCookieName)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Appel API avec auth automatique.
 *
 * Côté serveur : récupère le JWT depuis le cookie NextAuth et l'envoie
 * en Authorization: Bearer.
 * Côté client : le cookie est envoyé via credentials:"include" (CORS).
 * Pour les mutations côté client, utilisez apiCall() depuis un composant.
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};

  // Récupérer le content-type existant si présent
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Injecter le Bearer token côté serveur
  const serverToken = await getServerToken();
  if (serverToken) {
    headers["Authorization"] = `Bearer ${serverToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Erreur ${res.status}`);
  }
  // 204 No Content — pas de corps JSON
  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * apiCall — variante client (utilise getSession de next-auth/react).
 * Pour les composants client qui font des mutations (POST/PATCH/DELETE).
 */
export async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};

  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Côté client : récupérer le token depuis la session
  if (typeof window !== "undefined") {
    try {
      const { getSession } = await import("next-auth/react");
      const session = await getSession();
      if (session) {
        // Le token JWT brut est dans le cookie ; on le lit directement
        const cookieName =
          window.location.protocol === "https:"
            ? "__Secure-authjs.session-token"
            : "authjs.session-token";
        const match = document.cookie
          .split("; ")
          .find((row) => row.startsWith(cookieName + "="));
        if (match) {
          headers["Authorization"] = `Bearer ${match.split("=")[1]}`;
        }
      }
    } catch {
      // pas de session, pas de token
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Erreur ${res.status}`);
  }
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
