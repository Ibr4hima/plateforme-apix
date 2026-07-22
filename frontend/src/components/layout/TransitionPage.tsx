"use client";

// Transition de route : rejoue une animation d'entrée (fondu + léger glissement)
// à chaque changement de chemin. On clé sur le pathname seul (pas la query)
// pour ne pas réanimer sur un simple changement de filtre/URL.

import { usePathname } from "next/navigation";

export default function TransitionPage({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="apix-route-in">
      {children}
    </div>
  );
}
