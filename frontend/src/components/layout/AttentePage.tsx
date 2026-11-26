"use client";

// Ce qu'une page montre le temps de lire son adresse, au chargement direct.
//
// POURQUOI IL EXISTE. Les pages à onglets lisent leur état dans l'adresse
// (lib/useEtatUrl) dès leur PREMIER rendu — c'est ce qui évite d'afficher un
// instant l'onglet par défaut avant le bon. L'adresse n'est connue que dans le
// navigateur : à la construction du site, ces pages ne se prérendent donc pas,
// et c'est ce cadre qui tient leur place dans le HTML servi (la limite
// Suspense de TransitionPage). Il n'apparaît qu'au chargement direct — une
// adresse tapée, un lien reçu, F5 — et jamais en naviguant dans le site.
//
// CE QU'IL MONTRE : la barre de titre de la page, à sa place exacte, sur le
// fond de la page. Rien d'autre : ni onglet ni chiffre, qui dépendent
// justement de l'adresse. La page qui arrive pose sa propre barre au même
// endroit ; l'œil ne voit que les onglets et le contenu s'ajouter.

import BarreTitre from "@/components/shared/BarreTitre";
import NavActions from "@/components/layout/NavActions";

/** Le titre de la barre, par chemin — celui que la page affiche elle-même. */
const TITRES: Record<string, string> = {
  "/ide": "Investissements Privés",
  "/statistiques": "Échanges commerciaux",
  "/zones": "Zones d'Investissement",
  "/prospects": "Prospects",
  "/opportunites": "Opportunités d'investissement",
  "/evenements": "Événements",
  "/entreprises": "Entreprises formalisées",
  "/accords": "Accords & Traités",
};

export default function AttentePage({ chemin }: { chemin: string }) {
  const titre = TITRES[chemin];
  return (
    <div style={{ minHeight: "100dvh", background: "var(--champ)", fontFamily: "var(--font-google-sans)" }}>
      {titre && <BarreTitre titre={titre} compact actions={<NavActions home flouFond />} />}
    </div>
  );
}
