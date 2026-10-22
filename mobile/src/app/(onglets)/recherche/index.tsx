// L'onglet Recherche — toute la plateforme : pays, accords, événements,
// entreprises, zones. Résultats groupés ; un tap ouvre la VRAIE fiche du
// module (entreprise, zone, accord, événement — tout le contenu, pas un
// résumé générique).
//
// La page de recherche du système, sur les deux : sous la barre, le champ —
// la capsule d'iOS 26, la barre de recherche de Material 3 sur Android —, le
// clavier ouvert quand on arrive sur l'onglet tant que rien n'est cherché, et
// les résultats en sections, une ligne par résultat, sa légende dessous, le
// chevron au bout (ListeIOS, au dessin de chaque système).
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Text, type TextInput, View } from "react-native";
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
import { FONTE, T } from "@/theme";
import { DEFILEMENT, useCap, useMargeBas } from "@/lib/marges";
import { creerStyles } from "@/lib/apparence";

const MAX_PAR_GROUPE = 6;

export default function Recherche() {
  const margeBas = useMargeBas({ sousOnglets: true });
  const cap = useCap();
  const [q, setQ] = useState("");
  const [fiche, setFiche] = useState<Resultat | null>(null);

  // L'onglet ouvert, le clavier suit — si rien n'est encore cherché.
  // Pas d'autoFocus : les onglets sont montés dès le lancement, le clavier
  // surgirait sur l'Accueil
  const champ = useRef<TextInput>(null);
  const qCourant = useRef(q);
  qCourant.current = q;
  useFocusEffect(useCallback(() => {
    if (qCourant.current) return;
    const t = setTimeout(() => champ.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []));

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

  // Les résultats en sections — une section par module
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

  return (
    <View style={s.page}>
      <View style={[s.champ, cap]}>
        <ChampRecherche valeur={q} onChange={setQ} placeholder="Rechercher…" refChamp={champ} />
      </View>
      <FlatList {...DEFILEMENT}
        data={sections}
        keyExtractor={sec => sec.type}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: margeBas, flexGrow: 1 }, cap]}
        renderItem={({ item: sec }) => (
          <View style={s.section}>
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
            <EtatVide texte={`Aucun résultat pour « ${q.trim()} »`} />
          ) : !q.trim() ? (
            // Avant la saisie : l'invite, la loupe et un mot
            <View style={s.invite}>
              <Icone sf="magnifyingglass" materiel="search" taille={30} couleur={T.grisClair} />
              <Text style={s.inviteTitre}>Rechercher</Text>
            </View>
          ) : null
        }
      />
      {fiches}
    </View>
  );
}

const s = creerStyles(() => ({
  page: { flex: 1, backgroundColor: T.fond },
  centre: { alignItems: "center", padding: 28, gap: 8 },
  info: { fontSize: 12.5, color: T.gris },
  champ: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  section: { marginBottom: 22 },
  invite: { alignItems: "center", paddingTop: 64, paddingHorizontal: 40, gap: 8 },
  inviteTitre: { fontSize: 17, ...FONTE.demi, color: T.encre, marginTop: 6 },
}));
