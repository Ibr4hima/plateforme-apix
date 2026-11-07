"use client";

// Hôte global des fiches — monté une fois dans Providers. La recherche
// globale (⌘K) émet « apix:fiche-item » et la fiche s'ouvre directement
// sur la page courante, sans navigation.

import { useEffect, useState } from "react";
import AccordVueModal from "@/components/shared/AccordVueModal";
import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import EvenementVueModal from "@/components/shared/EvenementVueModal";
import ProspectVueModal from "@/components/shared/ProspectVueModal";
import ProjetVueModal from "@/components/shared/ProjetVueModal";
import PotentialiteVueModal from "@/components/shared/PotentialiteVueModal";
import AvantageVueModal from "@/components/shared/AvantageVueModal";
import ZoneDetailModal from "@/components/shared/ZoneDetailModal";
import { useNaema } from "@/lib/referentiels";

// La fiche projet et ses référentiels NAEMA, chargés à son ouverture
// seulement : monté sur toutes les pages, cet hôte les demandait à chaque
// visite sans jamais s'en servir.
function ProjetGlobal({ projet, onClose }: { projet: any; onClose: () => void }) {
  const { secteurs, branches, activites } = useNaema();
  return <ProjetVueModal projet={projet} secteurs={secteurs} branches={branches} activites={activites} onClose={onClose} />;
}

export default function FichesGlobales() {
  const [entreprise, setEntreprise] = useState<any>(null);
  const [accord, setAccord] = useState<any>(null);
  const [evenement, setEvenement] = useState<any>(null);
  const [prospect, setProspect] = useState<any>(null);
  const [projet, setProjet] = useState<any>(null);
  const [potentialite, setPotentialite] = useState<any>(null);
  const [avantage, setAvantage] = useState<any>(null);
  const [zone, setZone] = useState<any>(null);
  useEffect(() => {
    const h = (e: Event) => {
      const { type, item, onglet } = (e as CustomEvent).detail || {};
      if (!item) return;
      if (type === "entreprise") setEntreprise(item);
      if (type === "accord") setAccord(item);
      if (type === "evenement") setEvenement(item);
      if (type === "prospect") setProspect({ ...item, __onglet: onglet || "cibles" });
      if (type === "projet") setProjet(item);
      if (type === "potentialite") setPotentialite(item);
      if (type === "avantage") setAvantage(item);
      if (type === "zone") setZone(item);
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
      {projet && <ProjetGlobal projet={projet} onClose={() => setProjet(null)} />}
      {potentialite && <PotentialiteVueModal pot={potentialite} onClose={() => setPotentialite(null)} />}
      {avantage && <AvantageVueModal avg={avantage} onClose={() => setAvantage(null)} />}
      {zone && <ZoneDetailModal zone={zone} onClose={() => setZone(null)} />}
    </>
  );
}
