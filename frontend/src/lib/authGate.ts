"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

// L'application des contrôles côté UI suit le même interrupteur que le backend.
export const AUTH_ENFORCED = process.env.NEXT_PUBLIC_AUTH_ENFORCED === "true";

// Garde d'action : sur les pages publiques, l'ouverture d'une fiche détaillée
// exige une session — sinon redirection vers la connexion (retour prévu).
export function useAuthGate() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  return (action: () => void) => {
    if (AUTH_ENFORCED && !session) {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
    } else {
      action();
    }
  };
}

// Droit d'accès à un module protégé (pour filtrer la navigation).
export function moduleAutorise(session: any, slug: string): boolean {
  if (!AUTH_ENFORCED) return true;
  const role = session?.user?.role;
  if (!role) return false;
  if (role === "dev" || role === "admin" || role === "admin_plus" || role === "agent") return true;
  return (session?.user?.modules || []).includes(slug);  // ancien rôle « restreint »
}

// Nom affiché : premier prénom + initiale du second (s'il existe) + nom.
// « Mouhammad Moustapha » + « Ba » → « Mouhammad M. Ba ». À défaut : l'email.
export function nomAffiche(prenom?: string | null, nom?: string | null, email?: string | null): string {
  const prenoms = (prenom || "").trim().split(/\s+/).filter(Boolean);
  const n = (nom || "").trim();
  if (!prenoms.length || !n) return email || "";
  return `${prenoms[0]}${prenoms[1] ? ` ${prenoms[1][0].toUpperCase()}.` : ""} ${n}`;
}
