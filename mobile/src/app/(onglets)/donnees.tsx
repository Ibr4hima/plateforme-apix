// Onglet Données — les deux modules de données lourdes (Investissements
// privés et Échanges commerciaux) sous un même onglet, bascule dans le
// hero. Accessible aussi depuis l'accueil avec ?module=ide|echanges.
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import IdeEcran from "@/ecrans/IdeEcran";
import StatistiquesEcran from "@/ecrans/StatistiquesEcran";

const OPTIONS = [
  { cle: "ide",      label: "Inv. privés" },
  { cle: "echanges", label: "Échanges commerciaux" },
] as const;

export default function Donnees() {
  const { module } = useLocalSearchParams<{ module?: string }>();
  const [actif, setActif] = useState<"ide" | "echanges">("ide");
  useEffect(() => {
    if (module === "ide" || module === "echanges") setActif(module);
  }, [module]);

  const bascule = { options: OPTIONS, valeur: actif, onChange: (cle: string) => setActif(cle as "ide" | "echanges") };
  return actif === "ide" ? <IdeEcran bascule={bascule} /> : <StatistiquesEcran bascule={bascule} />;
}
