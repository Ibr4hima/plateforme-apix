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
import { useQueries, useQuery } from "@tanstack/react-query";
import { useScrollToTop } from "@react-navigation/native";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Text, type TextInput, View } from "react-native";
import AccordSheet from "@/components/AccordSheet";
import EntrepriseSheet from "@/components/EntrepriseSheet";
import EvenementSheet from "@/components/EvenementSheet";
import ZoneSheet from "@/components/ZoneSheet";
import Icone from "@/components/Icone";
import { ChampRecherche, Chevron, EnTeteSection, Groupe, Ligne, LigneDepliable } from "@/components/ListeIOS";
import { EtatHorsLigne, EtatVide } from "@/components/ui";
import { enAttente, getJson, horsLigne } from "@/lib/api";
import { plier } from "@/lib/format";
import { creerFuse, GROUPES, type Resultat, SOURCES_INDEX, construireIndex } from "@/lib/indexRecherche";
import { FONTE, T } from "@/theme";
import { DEFILEMENT, useCap, useMargeBas } from "@/lib/marges";
import { ouvrirModule } from "@/lib/navigation";
import { creerStyles } from "@/lib/apparence";

const MAX_PAR_GROUPE = 6;
type Section = { type: Resultat["type"]; items: Resultat[] };

export default function Recherche() {
  const margeBas = useMargeBas({ sousOnglets: true });
  const cap = useCap();
  const [q, setQ] = useState("");
  const [fiche, setFiche] = useState<Resultat | null>(null);
  const router = useRouter();
  // Un pays ouvre SA Fiche Pays, face au Sénégal — pas un résumé
  const choisir = (r: Resultat) => {
    if (r.type === "pays") ouvrirModule(router, "/fiche-pays", { pays: String(r.item.id) });
    else setFiche(r);
  };

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
    queryFn: () => getJson<any>(`/entreprises/${fiche!.item.id}`),
  });
  // Les cinq sources des modules : l'index vit avec elles
  const sources = useQueries({ queries: SOURCES_INDEX.map(src => ({ queryKey: [...src.cle], queryFn: src.fn })) });
  const donnees = sources.map(r => r.data as any[] | undefined);
  const signature = sources.map(r => r.dataUpdatedAt).join("|");
  const index = useMemo(() => construireIndex(donnees),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [signature]);
  const fuse = useMemo(() => (index.length ? creerFuse(index) : null), [index]);
  // En attente tant qu'aucune source n'a répondu — hors ligne, sans rien en
  // cache, l'attente le dit au lieu de tourner sans fin
  const rien = sources.every(r => r.data === undefined);
  const indexHorsLigne = rien && sources.some(r => horsLigne(r));
  const isLoading = rien && sources.some(r => enAttente(r));

  // Les résultats en sections — une section par module, TOUS ses résultats :
  // l'en-tête dit leur vrai nombre, les six premiers se montrent, le reste
  // se déplie (« Tout afficher »)
  const sections = useMemo((): Section[] => {
    if (!q.trim() || !fuse) return [];
    const bruts: Resultat[] = fuse.search(plier(q), { limit: 300 }).map((r: any) => r.item);
    const parGroupe: Partial<Record<Resultat["type"], Resultat[]>> = {};
    for (const r of bruts) (parGroupe[r.type] ||= []).push(r);
    return (Object.keys(GROUPES) as Resultat["type"][])
      .filter(t => parGroupe[t]?.length)
      .map(t => ({ type: t, items: parGroupe[t]! }));
  }, [q, fuse]);
  const [deplies, setDeplies] = useState<ReadonlySet<string>>(new Set());
  const basculer = (type: string) => setDeplies(d => {
    const n = new Set(d);
    if (n.has(type)) n.delete(type); else n.add(type);
    return n;
  });
  // Retoucher l'onglet Recherche déjà actif remonte la liste en haut
  const liste = useRef<FlatList<Section>>(null);
  useScrollToTop(liste);

  const fiches = (
    <>
      {/* La fiche complète du module correspondant au résultat */}
      {fiche?.type === "accord" && <AccordSheet accord={fiche.item} onClose={() => setFiche(null)} />}
      {fiche?.type === "evenement" && <EvenementSheet ev={fiche.item} onClose={() => setFiche(null)} />}
      {fiche?.type === "zone" && <ZoneSheet zone={fiche.item} onClose={() => setFiche(null)} />}
      {fiche?.type === "entreprise" && (
        <EntrepriseSheet entreprise={detailEntreprise.data || fiche.item} onClose={() => setFiche(null)} />
      )}
    </>
  );

  const aucun = !isLoading && q.trim().length > 1 && sections.length === 0;

  return (
    <View style={s.page}>
      <View style={[s.champ, cap]}>
        <ChampRecherche valeur={q} onChange={setQ} placeholder="Rechercher…" refChamp={champ} />
      </View>
      <FlatList {...DEFILEMENT} ref={liste}
        data={sections}
        extraData={deplies}
        keyExtractor={sec => sec.type}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: margeBas, flexGrow: 1 }, cap]}
        renderItem={({ item: sec }) => {
          const ouvert = deplies.has(sec.type);
          return (
            <View style={s.section}>
              <EnTeteSection titre={GROUPES[sec.type]} nb={sec.items.length} />
              <Groupe>
                {(ouvert ? sec.items : sec.items.slice(0, MAX_PAR_GROUPE)).map((r, i) => (
                  <Ligne key={`${r.nom}-${i}`} label={r.nom} legende={r.sous || undefined} lignes={1}
                    accessoire={<Chevron />} onPress={() => choisir(r)} />
                ))}
                {sec.items.length > MAX_PAR_GROUPE && (
                  <LigneDepliable titre={ouvert ? "Afficher moins" : "Tout afficher"}
                    compte={ouvert ? undefined : sec.items.length} ouvert={ouvert} onPress={() => basculer(sec.type)} />
                )}
              </Groupe>
            </View>
          );
        }}
        ListEmptyComponent={
          indexHorsLigne && q.trim().length > 0 ? (
            <EtatHorsLigne />
          ) : isLoading && q.trim().length > 0 ? (
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
