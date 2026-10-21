// La pile de l'onglet Recherche — la recherche dans toute la plateforme
// (pays, accords, événements, entreprises, zones). La barre du système porte
// le titre, sur iOS comme sur Android.
import { Stack } from "expo-router";
import { ecran, useOptionsPile } from "@/lib/navigation";

export default function PileRecherche() {
  return (
    <Stack screenOptions={useOptionsPile()}>
      <Stack.Screen name="index" options={ecran("Recherche")} />
    </Stack>
  );
}
