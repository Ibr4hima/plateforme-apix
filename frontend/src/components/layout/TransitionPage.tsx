"use client";

// Le cadre commun des pages.
//
// AUCUNE ANIMATION D'ENTRÉE. Chaque changement de page rejouait un fondu parti
// de l'opacité zéro : entre la page quittée et la page ouverte, l'écran passait
// par une image entièrement vide — mesuré image par image, c'est le
// « clignement » que l'on voyait à chaque navigation, même quand les données
// étaient déjà en mémoire. La page ouverte s'affiche désormais d'un coup, à la
// place de la précédente : rien ne s'efface entre les deux.
//
// LA LIMITE SUSPENSE tient la place des pages qui lisent leur adresse au
// premier rendu (lib/useEtatUrl → useSearchParams) : à la construction du
// site, Next ne peut pas les prérendre, et sert ce repli à leur place — la
// barre de titre de la page (AttentePage). Les autres pages restent prérendues
// en entier. En naviguant dans le site, ce repli ne s'affiche jamais : l'adresse
// de destination est connue dès le premier rendu.

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import AttentePage from "@/components/layout/AttentePage";

export default function TransitionPage({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <Suspense fallback={<AttentePage chemin={pathname} />}>{children}</Suspense>
    </div>
  );
}
