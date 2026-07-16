"use client";

// Hôte global des fiches — monté une fois dans Providers. La recherche
// globale (⌘K) émet « apix:fiche-item » et la fiche s'ouvre directement
// sur la page courante, sans navigation.

import { useEffect, useState } from "react";
import AccordVueModal from "@/components/shared/AccordVueModal";
import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import EvenementVueModal from "@/components/shared/EvenementVueModal";
import ProspectVueModal from "@/components/shared/ProspectVueModal";

export default function FichesGlobales() {
  const [entreprise, setEntreprise] = useState<any>(null);
  const [accord, setAccord] = useState<any>(null);
  const [evenement, setEvenement] = useState<any>(null);
  const [prospect, setProspect] = useState<any>(null);

  useEffect(() => {
    const h = (e: Event) => {
      const { type, item, onglet } = (e as CustomEvent).detail || {};
      if (!item) return;
      if (type === "entreprise") setEntreprise(item);
      if (type === "accord") setAccord(item);
      if (type === "evenement") setEvenement(item);
      if (type === "prospect") setProspect({ ...item, __onglet: onglet || "cibles" });
    };
    window.addEventListener("apix:fiche-item", h);
    return () => window.removeEventListener("apix:fiche-item", h);
  }, []);

  return (
    <>
      {entreprise && <EntreprisePublicModal entreprise={entreprise} onClose={() => setEntreprise(null)} zIndex={800} />}
      {accord && <AccordVueModal accord={accord} onClose={() => setAccord(null)} zIndex={800} />}
      {evenement && <EvenementVueModal ev={evenement} onClose={() => setEvenement(null)} />}
      {prospect && <ProspectVueModal p={prospect} onglet={prospect.__onglet} onClose={() => setProspect(null)} />}
    </>
  );
}
