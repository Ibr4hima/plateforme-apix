"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConfirmationHote from "@/components/shared/Confirmation";
import FichesGlobales from "@/components/shared/FichesGlobales";
import RechercheGlobale from "@/components/shared/RechercheGlobale";
import ChatWidget from "@/components/shared/ChatWidget";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Client créé une seule fois par session navigateur (useState et non module :
  // évite de partager le cache entre requêtes en cas de rendu serveur)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,     // les données restent « fraîches » 5 min
        refetchOnWindowFocus: false,  // pas de refetch au simple retour d'onglet
        retry: 1,
      },
    },
  }));
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <ConfirmationHote/>
        <RechercheGlobale/>
        <FichesGlobales/>
        <ChatWidget/>
      </QueryClientProvider>
    </SessionProvider>
  );
}
