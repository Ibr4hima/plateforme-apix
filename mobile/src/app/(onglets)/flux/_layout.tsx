// La pile de l'onglet Économie. Sur iOS, elle porte la barre de navigation
// du système : le grand titre « Économie », qui se replie au défilement (voir
// lib/navigation). Sur Android, l'écran dessine son propre bandeau et la
// barre du système reste cachée.
import { Stack } from "expo-router";
import { useOptionsRacineOnglet } from "@/lib/navigation";

export default function PileEconomie() {
  return <Stack screenOptions={useOptionsRacineOnglet("Économie")} />;
}
