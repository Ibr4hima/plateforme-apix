// Fiche Pays — deux pays face à face, comme sur la plateforme.
//
// EN TÊTE, LES DEUX PAYS : deux pastilles sous la barre, le premier en bleu
// (le Sénégal par défaut), le second en orange. Elles restent là pendant
// toute la lecture : elles sont la légende des teintes de la fiche, et le
// toucher de l'une ouvre la liste des pays pour en changer — les deux se
// choisissent, comme sur le site. Choisir dans l'une le pays de l'autre les
// échange.
//
// TANT QUE LE SECOND PAYS N'EST PAS CHOISI, la page est la liste des pays :
// la recherche toujours visible, comme les listes des Investissements
// projetés, puis les continents à déplier. Un toucher pose le pays, et la
// fiche s'affiche en place.
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import EnTetePage from "@/components/EnTetePage";
import Icone from "@/components/Icone";
import PaysSheet, { ListePays } from "@/components/PaysSheet";
import { SqueletteListe } from "@/components/Squelette";
import { EtatErreur, Tapable, EtatHorsLigne } from "@/components/ui";
import FichePaysContenu from "@/components/fichePays/FichePaysContenu";
import type { PaysFiche } from "@/components/fichePays/AtomesFiche";
import { enPanne, getJson, enAttente, horsLigne } from "@/lib/api";
import { creerStyles } from "@/lib/apparence";
import { drapeauEmoji } from "@/lib/drapeaux";
import { DEFILEMENT, useCap, useMargeBas } from "@/lib/marges";
import { ECHELLE, FONTE, T } from "@/theme";
import TexteDefilant from "@/components/TexteDefilant";

type Emplacement = 0 | 1;
type Paire = [number | null, number | null];

/** La pastille d'un pays : son drapeau, son nom dans sa teinte, le chevron
    qui dit qu'on peut en changer. Vide, elle invite à choisir. */
function PastillePays({ pays, couleur, onPress }: { pays: PaysFiche | null; couleur: any; onPress: () => void }) {
  if (!pays) return (
    <Tapable onPress={onPress} style={[s.pastille, s.pastilleVide]} accessibilityRole="button"
      accessibilityLabel="Choisir le pays à comparer">
      <Icone sf="plus" materiel="add" taille={12} couleur={T.gris} poids="semibold" />
      <Text style={s.pastilleVideTexte} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.compact}>Choisir un pays</Text>
    </Tapable>
  );
  const drapeau = drapeauEmoji(pays.code_iso2);
  return (
    <Tapable onPress={onPress} style={s.pastille} accessibilityRole="button"
      accessibilityLabel={`${pays.nom}. Changer de pays`}>
      {drapeau ? <Text style={s.drapeau} maxFontSizeMultiplier={ECHELLE.compact}>{drapeau}</Text> : null}
      <TexteDefilant style={[s.pastilleNom, { color: couleur }]} maxFontSizeMultiplier={ECHELLE.compact}>
        {pays.nom}
      </TexteDefilant>
      <Icone sf="chevron.down" materiel="expand_more" taille={11} couleur={T.gris} poids="semibold" />
    </Tapable>
  );
}

export default function FichePays() {
  const margeBas = useMargeBas({ sousOnglets: true });
  const cap = useCap();
  const qPays = useQuery({
    queryKey: ["stat-pays"], queryFn: () => getJson<PaysFiche[]>("/statistiques/pays"),
  });
  const liste = useMemo(() => qPays.data ?? [], [qPays.data]);
  const senId = useMemo(() => liste.find(p => p.code_iso3 === "SEN")?.id ?? null, [liste]);

  // Les deux emplacements ; le premier vaut le Sénégal tant qu'on n'y a pas touché
  const [choix, setChoix] = useState<Paire>([null, null]);
  // Ouverte depuis la Recherche sur un pays : il se pose face au Sénégal (le
  // jeton change à chaque ouverture — le même pays demandé deux fois s'y
  // repose deux fois)
  const lien = useLocalSearchParams<{ pays?: string; jeton?: string }>();
  useEffect(() => {
    const id = Number(lien.pays);
    if (!lien.pays || isNaN(id)) return;
    setChoix(c => (id === senId ? [c[0], null] : [c[0] === id ? null : c[0], id]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lien.jeton, senId]);
  const ids: Paire = [choix[0] ?? senId, choix[1]];
  const a = liste.find(p => p.id === ids[0]) ?? null;
  const b = liste.find(p => p.id === ids[1]) ?? null;

  const [q, setQ] = useState("");
  const [feuille, setFeuille] = useState<Emplacement | null>(null);

  const choisir = (pos: Emplacement, id: number) => {
    const n: Paire = [ids[0], ids[1]];
    // Le pays de l'autre emplacement : les deux pays s'échangent
    if (n[1 - pos] === id) n[1 - pos] = n[pos];
    n[pos] = id;
    setChoix(n);
    setQ("");
  };

  const pastilles = (
    <View style={s.pastilles}>
      <PastillePays pays={a} couleur={T.bleu} onPress={() => setFeuille(0)} />
      {/* Un signe, pas un mot : VoiceOver le lisait « multiplié par » */}
      <Text style={s.croix} accessible={false} importantForAccessibility="no" accessibilityElementsHidden>×</Text>
      <PastillePays pays={b} couleur={T.orange} onPress={() => setFeuille(1)} />
    </View>
  );

  const selecteur = feuille !== null && (
    <PaysSheet pays={liste} choisi={ids[feuille]}
      onChoisir={id => choisir(feuille, id)} onClose={() => setFeuille(null)} />
  );

  // ── La fiche : les deux pays sont là ──
  if (a && b) return (
    <View style={s.ecran}>
      <EnTetePage titre="Fiche Pays">{pastilles}</EnTetePage>
      {/* Une paire nouvelle repart du haut, ses listes repliées */}
      <ScrollView key={`${a.id}-${b.id}`} {...DEFILEMENT} style={s.ecran}
        contentContainerStyle={[s.contenu, { paddingBottom: margeBas }, cap]}>
        <FichePaysContenu a={a} b={b} senId={senId} />
      </ScrollView>
      {selecteur}
    </View>
  );

  // ── La liste des pays : elle remplit l'emplacement resté vide ──
  const vide: Emplacement = b ? 0 : 1;
  const autre = ids[1 - vide];
  return (
    <View style={s.ecran}>
      <EnTetePage titre="Fiche Pays"
        recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher un pays", toujours: true }}>
        {pastilles}
      </EnTetePage>
      <ScrollView {...DEFILEMENT} style={s.ecran} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={[s.contenu, { paddingBottom: margeBas }, cap]}>
        {horsLigne(qPays) ? <EtatHorsLigne /> : enAttente(qPays) ? <SqueletteListe /> : enPanne(qPays) ? (
          <EtatErreur onRetry={() => qPays.refetch()} />
        ) : (
          <View style={s.liste}>
            <ListePays pays={liste.filter(p => p.id !== autre)} q={q}
              onChoisir={id => choisir(vide, id)} />
          </View>
        )}
      </ScrollView>
      {selecteur}
    </View>
  );
}

const s = creerStyles(() => ({
  ecran: { flex: 1, backgroundColor: T.fond },
  contenu: { paddingTop: 14 },
  liste: { paddingHorizontal: 16 },

  pastilles: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  pastille: {
    flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    height: 40, paddingHorizontal: 14, borderRadius: 20, borderCurve: "continuous",
    backgroundColor: T.carte, borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord,
    shadowColor: "#0B1220", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  pastilleVide: {
    backgroundColor: "transparent", borderStyle: "dashed", borderWidth: 1.2, borderColor: T.voileFort,
    shadowOpacity: 0, elevation: 0,
  },
  drapeau: { fontSize: 16, lineHeight: 20 },
  pastilleNom: { flexShrink: 1, fontSize: 14, ...FONTE.gras, letterSpacing: -0.1 },
  pastilleVideTexte: { flexShrink: 1, fontSize: 13.5, ...FONTE.demi, color: T.gris },
  croix: { fontSize: 15, ...FONTE.demi, color: T.grisClair },
}));
