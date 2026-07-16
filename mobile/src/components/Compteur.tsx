// Compteur animé — même esprit que l'AnimatedCounter de l'accueil web :
// le chiffre « compte » jusqu'à sa valeur en ~700 ms avec easing.
import { useEffect, useRef, useState } from "react";
import { Text, TextStyle } from "react-native";

export default function Compteur({ valeur, style }: { valeur: number; style?: TextStyle | TextStyle[] }) {
  const [affiche, setAffiche] = useState(0);
  const minuteur = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const debut = Date.now();
    const duree = 700;
    if (minuteur.current) clearInterval(minuteur.current);
    minuteur.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - debut) / duree);
      const ease = 1 - Math.pow(1 - t, 3);
      setAffiche(Math.round(valeur * ease));
      if (t >= 1 && minuteur.current) clearInterval(minuteur.current);
    }, 16);
    return () => { if (minuteur.current) clearInterval(minuteur.current); };
  }, [valeur]);

  return <Text style={style}>{affiche.toLocaleString("fr-FR")}</Text>;
}
