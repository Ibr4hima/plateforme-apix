// FlashList animée — recyclage des cellules de Shopify pour les longues
// listes, compatible avec le défilement animé des heros réductibles.
import { FlashList } from "@shopify/flash-list";
import { Animated } from "react-native";

export const ListeRapide = Animated.createAnimatedComponent(FlashList as any) as any;
