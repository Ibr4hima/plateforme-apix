"use client";

import { useSession } from "next-auth/react";
import { AUTH_ENFORCED } from "@/lib/authGate";

// Rôle Admin = lecture seule : la classe `admin-ro` posée ici grise et
// désactive tous les éléments marqués `ro-w` (actions d'écriture) des pages.
export default function LectureSeule({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const ro = AUTH_ENFORCED && session?.user?.role === "admin";
  return (
    <div className={ro ? "admin-ro" : undefined}>
      {ro && <style>{`.admin-ro .ro-w{opacity:.38 !important;pointer-events:none !important;cursor:not-allowed !important;user-select:none}`}</style>}
      {children}
    </div>
  );
}
