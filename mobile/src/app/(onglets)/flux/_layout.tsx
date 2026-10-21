// La pile de l'onglet Économie. Sur iOS, la barre de navigation du système,
// en titre en ligne ; sur Android, l'écran dessine son propre bandeau et la
// barre du système reste cachée.
import { Stack } from "expo-router";
import { ecran, useOptionsPile } from "@/lib/navigation";

export default function PileEconomie() {
  return (
    <Stack screenOptions={useOptionsPile()}>
      <Stack.Screen name="index" options={ecran("Économie")} />
    </Stack>
  );
}
