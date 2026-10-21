// Recherche globale — pays, accords, événements, entreprises, zones.
// Résultats groupés ; un tap ouvre la VRAIE fiche du module (entreprise,
// zone, accord, événement — tout le contenu, pas un résumé générique).
//
// Sur iOS, la page de recherche d'une app d'Apple : le champ gris sous la
// barre, clavier ouvert, et les résultats en sections groupées — une ligne
// par résultat, sa légende dessous, le chevron au bout.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import AccordSheet from "@/components/AccordSheet";
import EntrepriseSheet from "@/components/EntrepriseSheet";
import EvenementSheet from "@/components/EvenementSheet";
import FicheSheet from "@/components/FicheSheet";
import ZoneSheet from "@/components/ZoneSheet";
import Icone from "@/components/Icone";
import { ChampRecherche, Chevron, EnTeteSection, Groupe, Ligne } from "@/components/ListeIOS";
import { EtatVide } from "@/components/ui";
import { getJson } from "@/lib/api";
import { chargerIndex, creerFuse, GROUPES, type Resultat } from "@/lib/indexRecherche";
import { T, POLICE } from "@/theme";
import { DEFILEMENT, useCap, useMargeBas } from "@/lib/marges";
import { creerStyles } from "@/lib/apparence";
import { IOS } from "@/lib/plateforme";

const MAX_PAR_GROUPE = 6;

export default function Recherche() {
  const margeBas = useMargeBas({ sousOnglets: true });
  const cap = useCap();
  const [q, setQ] = useState("");
  const [fiche, setFiche] = useState<Resultat | null>(null);

  // L'entreprise mérite son détail complet (points focaux, NAEMA…)
  const detailEntreprise = useQuery({
    queryKey: ["entreprise-detail", fiche?.type === "entreprise" ? fiche.item.id : null],
    enabled: fiche?.type === "entreprise",
    queryFn: () => getJson<any>(`/entreprises/${fiche!.item.id}`).catch(() => fiche!.item),
  });
  const { data: index, isLoading } = useQuery({ queryKey: ["index-recherche"], queryFn: chargerIndex, staleTime: Infinity });
  const fuse = useMemo(() => (index ? creerFuse(index) : null), [index]);

  const resultats: Resultat[] = useMemo(() => {
    if (!q.trim() || !fuse) return [];
    const bruts: Resultat[] = fuse.search(q.trim(), { limit: 60 }).map((r: any) => r.item);
    const parGroupe: Record<string, Resultat[]> = {};
    for (const r of bruts) {
      (parGroupe[r.type] ||= []);
      if (parGroupe[r.type].length < MAX_PAR_GROUPE) parGroupe[r.type].push(r);
    }
    return (Object.keys(GROUPES) as Resultat["type"][]).flatMap(t => parGroupe[t] || []);
  }, [q, fuse]);

  // iOS : les résultats en sections — une section par module
  const sections = useMemo(() => {
    const liste: { type: Resultat["type"]; items: Resultat[] }[] = [];
    for (const r of resultats) {
      const derniere = liste[liste.length - 1];
      if (derniere?.type === r.type) derniere.items.push(r);
      else liste.push({ type: r.type, items: [r] });
    }
    return liste;
  }, [resultats]);

  const fiches = (
    <>
      {/* La fiche complète du module correspondant au résultat */}
      {fiche?.type === "accord" && <AccordSheet accord={fiche.item} onClose={() => setFiche(null)} />}
      {fiche?.type === "evenement" && <EvenementSheet ev={fiche.item} onClose={() => setFiche(null)} />}
      {fiche?.type === "zone" && <ZoneSheet zone={fiche.item} onClose={() => setFiche(null)} />}
      {fiche?.type === "entreprise" && (
        <EntrepriseSheet entreprise={detailEntreprise.data || fiche.item} onClose={() => setFiche(null)} />
      )}
      {fiche?.type === "pays" && <FicheSheet resultat={fiche} onClose={() => setFiche(null)} />}
    </>
  );

  const aucun = !isLoading && q.trim().length > 1 && resultats.length === 0;

  if (IOS) {
    return (
      <View style={s.page}>
        <View style={[s.champIOS, cap]}>
          <ChampRecherche valeur={q} onChange={setQ} placeholder="Pays, accords, entreprises, zones" autoFocus />
        </View>
        <FlatList {...DEFILEMENT}
          data={sections}
          keyExtractor={sec => sec.type}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: margeBas, flexGrow: 1 }, cap]}
          renderItem={({ item: sec }) => (
            <View style={s.sectionIOS}>
              <EnTeteSection titre={GROUPES[sec.type]} nb={sec.items.length} />
              <Groupe>
                {sec.items.map((r, i) => (
                  <Ligne key={`${r.nom}-${i}`} label={r.nom} legende={r.sous || undefined} lignes={1}
                    accessoire={<Chevron />} onPress={() => setFiche(r)} />
                ))}
              </Groupe>
            </View>
          )}
          ListEmptyComponent={
            isLoading && q.trim().length > 0 ? (
              <View style={s.centre}><ActivityIndicator color={T.gris} /><Text style={s.info}>{"Chargement de l'index…"}</Text></View>
            ) : aucun ? (
              <EtatVide texte={`Aucun résultat pour « ${q.trim()} »`}
                sousTexte="Pays, accords, événements, entreprises et zones sont couverts." />
            ) : !q.trim() ? (
              // Avant la saisie : ce que couvre la recherche, en une phrase
              <View style={s.invite}>
                <Icone sf="magnifyingglass" materiel="search" taille={30} couleur={T.grisClair} />
                <Text style={s.inviteTitre}>Toute la plateforme</Text>
                <Text style={s.inviteTexte}>{"Pays, accords, événements, entreprises installées et zones d'investissement."}</Text>
              </View>
            ) : null
          }
        />
        {fiches}
      </View>
    );
  }

  let dernierGroupe = "";

  return (
    <View style={s.page}>
      {/* La barre d'état est réglée en blanc pour toute l'app (heros bleus).
          Cet écran est un modal à en-tête clair : sans cette bascule, l'heure
          et les indicateurs système sont blancs sur blanc, donc invisibles.
          expo-status-bar rétablit le style précédent en quittant l'écran. */}
      <StatusBar style="dark" />
      <View style={s.barre}>
        <Ionicons name="search" size={17} color={T.gris} />
        <TextInput
          value={q} onChangeText={setQ} placeholder="Rechercher…" placeholderTextColor={T.gris}
          autoFocus autoCorrect={false} style={s.champ} clearButtonMode="while-editing" />
      </View>

      {isLoading && q.trim().length > 0 && (
        <View style={s.centre}><ActivityIndicator color={T.bleu} /><Text style={s.info}>{"Chargement de l'index…"}</Text></View>
      )}
      {aucun && (
        <EtatVide texte={`Aucun résultat pour « ${q.trim()} »`}
          sousTexte="Pays, accords, événements, entreprises et zones sont couverts."
          action={{ label: "Effacer la recherche", onPress: () => setQ("") }} />
      )}

      <FlatList {...DEFILEMENT}
        data={resultats}
        keyExtractor={(r, i) => `${r.type}-${r.nom}-${i}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[{ paddingHorizontal: 16, paddingBottom: margeBas }, cap]}
        renderItem={({ item: r }) => {
          const entete = r.type !== dernierGroupe;
          dernierGroupe = r.type;
          return (
            <View>
              {entete && <Text style={s.groupe}>{GROUPES[r.type].toUpperCase()}</Text>}
              <Pressable onPress={() => setFiche(r)} style={({ pressed }) => [s.ligne, pressed && { backgroundColor: T.bleuVoile }]}>
                <Text style={s.nom} numberOfLines={1}>{r.nom}</Text>
                {r.sous ? <Text style={s.sous} numberOfLines={1}>{r.sous}</Text> : null}
              </Pressable>
            </View>
          );
        }}
      />
      {fiches}
    </View>
  );
}

const s = creerStyles(() => ({
  page: { flex: 1, backgroundColor: T.fond },
  barre: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.carte, margin: 16, marginBottom: 8, paddingHorizontal: 17, height: 48,
    borderRadius: 999, borderWidth: 1, borderColor: T.bordure,
  },
  champ: { flex: 1, fontSize: 15.5, color: T.encre, fontFamily: POLICE.moyen },
  centre: { alignItems: "center", padding: 28, gap: 8 },
  info: { fontSize: 12.5, color: T.gris },
  groupe: { fontSize: 10, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.4, marginTop: 16, marginBottom: 6, marginLeft: 4 },
  ligne: { backgroundColor: T.carte, borderRadius: 13, borderWidth: 1, borderColor: T.bordure, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 7 },
  nom: { fontSize: 13.5, fontFamily: POLICE.gras, color: T.encre },
  sous: { fontSize: 11.5, color: T.gris, marginTop: 3 },
  champIOS: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  sectionIOS: { marginBottom: 22 },
  invite: { alignItems: "center", paddingTop: 64, paddingHorizontal: 40, gap: 8 },
  inviteTitre: { fontSize: 17, fontFamily: POLICE.demi, color: T.encre, marginTop: 6 },
  inviteTexte: { fontSize: 14, lineHeight: 20, fontFamily: POLICE.normal, color: T.gris, textAlign: "center" },
}));
