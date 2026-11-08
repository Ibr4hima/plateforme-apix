"use client";

/**
 * L'administration lit toujours la base.
 *
 * L'API garde en mémoire les réponses qui ne changent qu'aux imports et aux
 * modifications de l'administration (référentiels, IDE, statistiques, fDi,
 * zones : backend/app/core/cache.py) et les rafraîchit d'elle-même — en
 * moins d'une seconde en général, au plus en une douzaine. Une page
 * d'administration qui vient d'enregistrer un secteur, un pays ou un pôle et
 * relit aussitôt la liste doit, elle, voir sa modification tout de suite.
 *
 * Plutôt que d'y penser à chaque appel, toute lecture de l'API (GET) faite
 * depuis une page /admin porte l'en-tête `Cache-Control: no-cache`, que l'API
 * honore en recalculant (et en rafraîchissant son cache pour tous). Les pages
 * publiques ne sont pas concernées.
 */
import { API_BASE } from "@/lib/api";

const MARQUE = "__apixAdminSansCache";

export function installerLecturesFraichesAdmin(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<string, unknown>;
  if (w[MARQUE]) return;
  w[MARQUE] = true;
  const origine = window.fetch.bind(window);
  window.fetch = (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
    const methode = (init?.method ?? (entree instanceof Request ? entree.method : "GET")).toUpperCase();
    if (methode === "GET" && url.startsWith(API_BASE) && window.location.pathname.startsWith("/admin")) {
      const entetes = new Headers(init?.headers ?? (entree instanceof Request ? entree.headers : undefined));
      if (!entetes.has("Cache-Control")) entetes.set("Cache-Control", "no-cache");
      return origine(entree, { ...init, headers: entetes });
    }
    return origine(entree, init);
  };
}
