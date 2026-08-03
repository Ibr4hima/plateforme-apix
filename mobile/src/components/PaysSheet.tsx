// Sélecteur de pays — recherche + liste, l'ajout ferme la feuille.
// Consommé par les écrans qui gèrent leur comparaison au « + » dans la ligne
// de contexte (IDE, Indicateurs économiques).
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Icone from "@/components/Icone";
import { Feuille, Tapable } from "@/components/ui";
import { cran } from "@/lib/haptique";
import { POLICE, T } from "@/theme";

export default function PaysSheet({ pays, exclus, onChoisir, onClose }: {
  pays: { id: number; nom: string; continent?: string }[];
  exclus: number[]; onChoisir: (id: number) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const plier = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const liste = useMemo(() => {
    const t = plier(q.trim());
    return pays
      .filter(p => !exclus.includes(p.id) && (!t || plier(p.nom).includes(t)))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [pays, exclus, q]);
  return (
    <Feuille onClose={onClose} ecart={16} hauteur="76%"
      titre={<Text style={s.titre}>Ajouter un pays</Text>}
      sousEntete={
        <View style={s.champ}>
          <Icone sf="magnifyingglass" materiel="search" taille={15} couleur={T.gris} />
          <TextInput value={q} onChangeText={setQ} placeholder="Rechercher un pays"
            placeholderTextColor={T.grisClair as any} autoCorrect={false}
            clearButtonMode="while-editing" style={s.champTexte} />
        </View>
      }>
      <View>
        {liste.map((p, i) => (
          <Tapable key={p.id} echelle={0.99} onPress={() => { cran(); onChoisir(p.id); onClose(); }}
            style={[s.ligne, i > 0 && s.ligneBord]}>
            <Text style={s.nom} numberOfLines={1}>{p.nom}</Text>
            {p.continent ? <Text style={s.continent}>{p.continent}</Text> : null}
          </Tapable>
        ))}
        {!liste.length && <Text style={s.vide}>Aucun pays ne correspond.</Text>}
      </View>
    </Feuille>
  );
}

const s = StyleSheet.create({
  titre: { fontSize: 21, fontFamily: POLICE.gras, color: T.encre, lineHeight: 27, letterSpacing: -0.4, flex: 1 },
  champ: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12,
    backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.bordure,
    borderRadius: 12, paddingHorizontal: 12, height: 38,
  },
  champTexte: { flex: 1, fontSize: 14, fontFamily: POLICE.moyen, color: T.encre },
  ligne: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10.5 },
  ligneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  nom: { flex: 1, fontSize: 13.5, fontFamily: POLICE.demi, color: T.encre },
  continent: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris },
  vide: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", paddingVertical: 20 },
});
