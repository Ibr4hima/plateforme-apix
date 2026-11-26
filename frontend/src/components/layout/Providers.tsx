"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConfirmationHote from "@/components/shared/Confirmation";
import FichesGlobales from "@/components/shared/FichesGlobales";
import VisionneuseGlobale from "@/components/shared/Visionneuse";
import { FichePaysPickerGlobal } from "@/components/fiche-pays/FichePaysLauncher";
import TransitionPage from "@/components/layout/TransitionPage";
import D3Tooltip from "@/components/charts/D3Tooltip";
import { SessionProvider } from "next-auth/react";
import { useEffect, useState } from "react";
import { installerLecturesFraichesAdmin } from "@/lib/adminSansCache";
import { chargerD3 } from "@/lib/d3lazy";
import { installerReleve, installerSurvol } from "@/lib/prechargement";

// L'administration lit toujours la base (lib/adminSansCache.ts) : installé dès
// le chargement du module, avant les premières requêtes de la page
installerLecturesFraichesAdmin();

export default function Providers({ children }: { children: React.ReactNode }) {
  // Client créé une seule fois par session navigateur (useState et non module :
  // évite de partager le cache entre requêtes en cas de rendu serveur)
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,     // les données restent « fraîches » 5 min
          // Une réponse reste EN MÉMOIRE une heure après la dernière page qui
          // s'en servait (le défaut est de cinq minutes) : revenir sur une page
          // lue dans la demi-heure la raffiche complète, sans squelette — elle
          // se remet à jour en arrière-plan si elle a plus de cinq minutes.
          gcTime: 60 * 60 * 1000,
          refetchOnWindowFocus: false,  // pas de refetch au simple retour d'onglet
          retry: 1,
        },
      },
    });
    // Le relevé de ce que chaque page demande à son ouverture — installé ici,
    // avant les abonnements de la première page (lib/prechargement).
    installerReleve(client);
    return client;
  });
  // d3 EST PRÉCHARGÉ DÈS QUE LE NAVIGATEUR A UN INSTANT. Presque toutes les
  // pages dessinent avec lui, et il vit dans un chunk à part : la première page
  // à graphes attendait son arrivée devant un écran vide. Demandé ici, au
  // repos, il est là avant qu'on ne clique.
  useEffect(() => {
    const charger = () => { void chargerD3(); };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(charger, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(charger, 300);
    return () => window.clearTimeout(t);
  }, []);
  // Les données d'une page sont demandées dès le survol de son lien, d'après
  // ce qu'elle a demandé à sa dernière ouverture (lib/prechargement).
  useEffect(() => installerSurvol(queryClient), [queryClient]);
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <TransitionPage>{children}</TransitionPage>
        <ConfirmationHote/>
        {/* La recherche globale (components/shared/RechercheGlobale.tsx,
            Ctrl+K) est retirée du site, son bouton avec elle : jugée inutile.
            Le composant reste prêt ; pour la remettre, le monter ici et
            rendre son bouton à NavActions. */}
        <FichesGlobales/>
        {/* La visionneuse des documents, ouverte par LienDocument d'où qu'il soit */}
        <VisionneuseGlobale/>
        <FichePaysPickerGlobal/>
        <D3Tooltip/>
        {/* L'assistant (components/shared/ChatWidget.tsx) est retiré du site
            pour le moment. Le composant reste prêt : pour le remettre sur
            toutes les pages, l'importer et le monter ici, <ChatWidget/>. */}
      </QueryClientProvider>
    </SessionProvider>
  );
}
