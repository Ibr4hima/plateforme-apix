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

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function FichesGlobales() {
  const [entreprise, setEntreprise] = useState<any>(null);
  const [accord, setAccord] = useState<any>(null);
  const [evenement, setEvenement] = useState<any>(null);
  const [prospect, setProspect] = useState<any>(null);
  const [projet, setProjet] = useState<any>(null);
  const [potentialite, setPotentialite] = useState<any>(null);
  const [avantage, setAvantage] = useState<any>(null);
  const [zone, setZone] = useState<any>(null);
  // Référentiels nécessaires aux modals projet / potentialité
  const { secteurs, branches, activites } = useNaema();
  const [refAvantages, setRefAvantages] = useState<any[]>([]);

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

  // Atouts de référence — chargés à la première ouverture d'une potentialité
  useEffect(() => {
    if (!potentialite || refAvantages.length) return;
    fetch(`${API}/ref-potentialites/flat`).then(r => r.json()).then(d => setRefAvantages(d || [])).catch(() => {});
  }, [potentialite, refAvantages.length]);

  return (
    <>
      {entreprise && <EntreprisePublicModal entreprise={entreprise} onClose={() => setEntreprise(null)} zIndex={800} />}
      {accord && <AccordVueModal accord={accord} onClose={() => setAccord(null)} zIndex={800} />}
      {evenement && <EvenementVueModal ev={evenement} onClose={() => setEvenement(null)} />}
      {prospect && <ProspectVueModal p={prospect} onglet={prospect.__onglet} onClose={() => setProspect(null)} />}
      {projet && <ProjetVueModal projet={projet} secteurs={secteurs} branches={branches} activites={activites} onClose={() => setProjet(null)} />}
      {potentialite && <PotentialiteVueModal pot={potentialite} refAvantages={refAvantages} onClose={() => setPotentialite(null)} />}
      {avantage && <AvantageVueModal avg={avantage} onClose={() => setAvantage(null)} />}
      {zone && <ZoneDetailModal zone={zone} onClose={() => setZone(null)} />}
    </>
  );
}
