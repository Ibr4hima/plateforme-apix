// La pile de l'onglet Économie. La barre du système, en titre en ligne —
// celle d'UIKit sur iOS, celle de Material sur Android.
import { Stack } from "expo-router";
import { ecran, useOptionsPile } from "@/lib/navigation";

export default function PileEconomie() {
  return (
    <Stack screenOptions={useOptionsPile()}>
      <Stack.Screen name="index" options={ecran("Économie")} />
    </Stack>
  );
}
