// Modules & Plus — listes groupées sur une seule surface, séparateurs en
// retrait, icônes Material Symbols (graisse 600) sur pastille dégradée.
// Les modules se réorganisent (bouton Réorganiser → flèches ↑/↓), l'ordre
// est persisté sur l'appareil.
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Symbole from "@/components/Symbole";
import { Apparition } from "@/components/ui";
import { chargerOrdre, sauverOrdre } from "@/lib/epingles";
import { tick } from "@/lib/haptique";
import { MODULES, PLUS, POLICE, T } from "@/theme";

type Entree = { cle: string; titre: string; sous: string; icone: string; href: string };

function ListeGroupee({ titre, entrees, reorganisable, ordre, onDeplacer, edition, onBasculerEdition }: {
  titre: string; entrees: readonly Entree[];
  reorganisable?: boolean; ordre?: string[];
  onDeplacer?: (cle: string, sens: -1 | 1) => void;
  edition?: boolean; onBasculerEdition?: () => void;
}) {
  const router = useRouter();
  const liste = ordre
    ? [...entrees].sort((a, b) => ordre.indexOf(a.cle) - ordre.indexOf(b.cle))
    : entrees;
  const ouvrir = (m: Entree) => {
    if (m.href) router.push(m.href as any);
    else Alert.alert(m.titre, "Cette section arrive dans une prochaine version de l'application.");
  };
  return (
    <View style={s.bloc}>
      <View style={s.titreLigne}>
        <Text style={s.titre}>{titre}</Text>
        {reorganisable && (
          <Pressable onPress={() => { tick(); onBasculerEdition?.(); }} hitSlop={8}>
            <Text style={s.reorganiser}>{edition ? "Terminé" : "Réorganiser"}</Text>
          </Pressable>
        )}
      </View>
      <View style={s.surface}>
        {liste.map((m, i) => (
          <Apparition key={m.cle} index={i}>
            {i > 0 && <View style={s.separateur} />}
            <Pressable onPress={edition ? undefined : () => ouvrir(m)}
              style={({ pressed }) => [s.ligne, pressed && !edition && { backgroundColor: "rgba(0,79,145,0.05)" }]}>
              <LinearGradient
                colors={["rgba(0,79,145,0.16)", "rgba(0,79,145,0.07)"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.pastille}>
                <Symbole nom={m.icone} taille={22} couleur={T.bleu} />
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.ligneTitre} numberOfLines={1}>{m.titre}</Text>
                <Text style={s.ligneSous} numberOfLines={1}>{m.sous}</Text>
              </View>
              {edition && (
                <View style={s.fleches}>
                  <Pressable hitSlop={6} disabled={i === 0}
                    onPress={() => { tick(); onDeplacer?.(m.cle, -1); }}
                    style={({ pressed }) => [s.fleche, i === 0 && { opacity: 0.25 }, pressed && { backgroundColor: T.bleuVoile }]}>
                    <Symbole nom="keyboard_arrow_up" taille={19} couleur={T.bleu} />
                  </Pressable>
                  <Pressable hitSlop={6} disabled={i === liste.length - 1}
                    onPress={() => { tick(); onDeplacer?.(m.cle, 1); }}
                    style={({ pressed }) => [s.fleche, i === liste.length - 1 && { opacity: 0.25 }, pressed && { backgroundColor: T.bleuVoile }]}>
                    <Symbole nom="keyboard_arrow_down" taille={19} couleur={T.bleu} />
                  </Pressable>
                </View>
              )}
            </Pressable>
          </Apparition>
        ))}
      </View>
    </View>
  );
}

export default function ModulesGrille() {
  const defaut: string[] = MODULES.map(m => m.cle);
  const [ordre, setOrdre] = useState<string[]>(defaut);
  const [edition, setEdition] = useState(false);

  useEffect(() => {
    chargerOrdre().then(sauve => {
      if (!sauve) return;
      // Les modules ajoutés depuis la sauvegarde rejoignent la fin
      const connu = sauve.filter(c => defaut.includes(c));
      setOrdre([...connu, ...defaut.filter(c => !connu.includes(c))]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deplacer = (cle: string, sens: -1 | 1) => {
    setOrdre(prev => {
      const i = prev.indexOf(cle);
      const j = i + sens;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const suivante = [...prev];
      [suivante[i], suivante[j]] = [suivante[j], suivante[i]];
      sauverOrdre(suivante);
      return suivante;
    });
  };

  return (
    <>
      <ListeGroupee titre="MODULES" entrees={MODULES}
        reorganisable ordre={ordre} onDeplacer={deplacer}
        edition={edition} onBasculerEdition={() => setEdition(v => !v)} />
      <ListeGroupee titre="PLUS" entrees={PLUS} />
    </>
  );
}

const s = StyleSheet.create({
  bloc: { marginTop: 30, paddingHorizontal: 18 },
  titreLigne: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  titre: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.6 },
  reorganiser: { fontSize: 11.5, fontFamily: POLICE.demi, color: T.bleu },
  surface: {
    backgroundColor: T.carte, borderRadius: 22, overflow: "hidden",
    shadowColor: "#001e3c", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  separateur: { height: 1, backgroundColor: "rgba(0,30,60,0.07)", marginLeft: 70 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 15, paddingVertical: 13, paddingHorizontal: 16 },
  pastille: {
    width: 39, height: 39, borderRadius: 12, alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,79,145,0.22)",
  },
  ligneTitre: { fontSize: 15, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2 },
  ligneSous: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  fleches: { flexDirection: "row", gap: 4 },
  fleche: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: T.filet },
});
