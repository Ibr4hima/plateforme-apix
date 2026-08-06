// Événements — un agenda, pas une frise.
//
// L'écran répond d'abord à « qu'est-ce qui arrive ? » : la lentille À venir
// trie du plus proche au plus lointain (l'ordre d'un calendrier), les Passés
// vivent derrière une seconde lentille, du plus récent au plus ancien.
// « En cours » n'est pas un filtre : un événement en cours flotte de lui-même
// en tête d'À venir, en vert, « En ce moment ».
//
// La ligne est construite pour le balayage vertical : bloc date à gauche
// (l'œil descend les dates comme dans Calendrier — le prochain en bleu plein,
// même signature que l'accueil), titre et lieu au centre, échéance à droite.
// Groupes par mois, l'unité de planification sur téléphone. Sur tablette, la
// liste se plafonne à 680 pt et se centre.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Animated, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, EtatErreur, EtatVide, Tapable } from "@/components/ui";
import EnTetePage from "@/components/EnTetePage";
import EvenementSheet, { dansCombienEvenement, ordinal, statutEvenement } from "@/components/EvenementSheet";
import Icone from "@/components/Icone";
import { fetchTous } from "@/lib/api";
import { useMargeBas } from "@/lib/marges";
import { POLICE, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";
import TexteDefilant from "@/components/TexteDefilant";


const dateDe = (e: any): Date | null => {
  if (e.date_debut) return new Date(e.date_debut + "T00:00:00");
  if (e.prochain_annee) return new Date(e.prochain_annee, (e.prochain_mois || 1) - 1, e.prochain_jour || 1);
  return null;
};

// Intitulé du groupe : mois + année, toujours
const moisDe = (d: Date): string =>
  d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase();

// ── La ligne d'agenda ────────────────────────────────────────────────────────
function LigneEvenement({ e, prochain, onPress }: { e: any; prochain: boolean; onPress: () => void }) {
  const statut = statutEvenement(e);
  const enCours = statut === "en_cours";
  const passe = statut === "termine";
  const d = dateDe(e);
  const lieu = [e.ville, e.pays_hote_nom].filter(Boolean).join(" · ");
  const echeance = enCours ? "En ce moment" : passe ? null : dansCombienEvenement(e);

  return (
    <Tapable onPress={onPress} echelle={0.98} style={[s.ligne, passe && { backgroundColor: T.carteDouce }]}>
      {/* Bloc date : bleu plein pour le prochain, vert pour l'en cours */}
      <View style={[s.bloc, prochain && s.blocProchain, enCours && s.blocEnCours, passe && s.blocPasse]}>
        {d ? (
          <>
            <Text style={[s.blocJour, (prochain || enCours) && { color: "#fff" }, passe && { color: T.gris }]}>
              {d.getDate()}
            </Text>
            <Text style={[s.blocMois, (prochain || enCours) && { color: "rgba(255,255,255,0.85)" }, passe && { color: T.gris }]}>
              {d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "").toUpperCase()}
            </Text>
          </>
        ) : (
          // Récurrent sans date arrêtée : le pictogramme de récurrence
          <Icone sf="arrow.triangle.2.circlepath" materiel="autorenew" taille={18} couleur={T.gris} />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={s.ligneHaut}>
          <Text style={[s.titre, passe && { color: T.texte }]} numberOfLines={2}>{e.nom_event}</Text>
          {echeance && (
            <Text style={[s.echeance, enCours && { color: T.vert }]} numberOfLines={1}>{echeance}</Text>
          )}
        </View>
        {/* Seconde ligne : le lieu, ou à défaut l'édition. Le rôle APIX vit
            dans la fiche — la liste reste un agenda, pas un tableau. */}
        {(lieu || e.edition != null) && (
          <Text style={s.lieuTexte} numberOfLines={1}>{lieu || ordinal(e.edition)}</Text>
        )}
      </View>
    </Tapable>
  );
}

export default function Evenements() {
  const margeBas = useMargeBas();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState("");
  const [lentille, setLentille] = useState("a_venir");
  const [selec, setSelec] = useState<any>(null);


  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["evenements"], queryFn: () => fetchTous("/evenements"),
  });

  // La recherche seule, avant la lentille : les compteurs des segments
  // se calculent sur cette base
  const communs = useMemo(() => {
    let liste = data || [];
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      liste = liste.filter((e: any) =>
        (e.nom_event || "").toLowerCase().includes(t) ||
        (e.ville || "").toLowerCase().includes(t) ||
        (e.pays_hote_nom || "").toLowerCase().includes(t));
    }
    return liste;
  }, [data, q]);

  const aVenir = useMemo(() => communs
    .filter((e: any) => statutEvenement(e) !== "termine")
    .sort((a: any, b: any) => {
      const da = dateDe(a), db = dateDe(b);
      if (!da && !db) return 0;
      if (!da) return 1;                    // les sans-date ferment la marche
      if (!db) return -1;
      return da.getTime() - db.getTime();   // le plus proche d'abord
    }), [communs]);

  const passes = useMemo(() => communs
    .filter((e: any) => statutEvenement(e) === "termine")
    .sort((a: any, b: any) => (dateDe(b)?.getTime() ?? 0) - (dateDe(a)?.getTime() ?? 0)),
  [communs]);

  const liste = lentille === "a_venir" ? aVenir : passes;
  const prochainId = aVenir.find((e: any) => statutEvenement(e) === "a_venir")?.id ?? null;

  // Groupes par mois ; les récurrents sans date arrêtée sous « À programmer »
  const sections = useMemo(() => {
    const groupes = new Map<string, any[]>();
    for (const e of liste) {
      const d = dateDe(e);
      const cle = d ? moisDe(d) : "À PROGRAMMER";
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle)!.push(e);
    }
    return Array.from(groupes.entries()).map(([titre, donnees]) => ({ title: titre, data: donnees }));
  }, [liste]);

  // Tablette : la liste se centre et se plafonne — les lignes pleine largeur
  // sur 1 000 pt deviennent illisibles
  const cap = width >= 700 ? { width: "100%" as const, maxWidth: 680, alignSelf: "center" as const } : null;

  // Les compteurs vivent dans les segments eux-mêmes (pastilles), pas en
  // ligne de texte sous le hero
  const lentilles = [
    { cle: "a_venir", label: "À venir",  compte: isLoading || isError ? undefined : aVenir.length },
    { cle: "passes",  label: "Terminés", compte: isLoading || isError ? undefined : passes.length },
  ];

  const hero = (
    <EnTetePage titre="Événements"
      recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
      segments={{ options: lentilles, valeur: lentille, onChange: setLentille }} />
  );

  const vide = isLoading ? <SqueletteListe />
    : isError ? <EtatErreur onRetry={() => refetch()} />
    : <EtatVide texte={lentille === "a_venir"
        ? "Aucun événement à venir ne correspond."
        : "Aucun événement terminé ne correspond."} />;

  return (
    // L'en-tête est ANCRÉ hors du défilement : retour, recherche et segments
    // restent sous le pouce, quelle que soit la position dans la liste
    <View style={{ flex: 1, backgroundColor: T.fond }}>
      {hero}
      <Animated.SectionList
        style={{ backgroundColor: T.fond }}
        sections={isLoading || isError ? [] : sections}
        keyExtractor={(e: any) => String(e.id)}
        renderItem={({ item, index }: any) => (
          <Apparition index={Math.min(index, 8)} style={[s.rangee, cap]}>
            <LigneEvenement e={item} prochain={item.id === prochainId} onPress={() => setSelec(item)} />
          </Apparition>
        )}
        renderSectionHeader={({ section }: any) => (
          <View style={[s.mois, cap]}>
            <Text style={s.moisTexte}>{section.title}</Text>
            <View style={s.moisFilet} />
            <Text style={s.moisCompte}>{section.data.length}</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: margeBas }}
        ListHeaderComponentStyle={{ marginBottom: 4 }}
        stickySectionHeadersEnabled={false}
        refreshing={isRefetching}
        onRefresh={refetch}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={vide}
      />
      {selec && <EvenementSheet ev={selec} onClose={() => setSelec(null)} />}
    </View>
  );
}

const s = creerStyles(() => ({
  mois: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginTop: 18, marginBottom: 10 },
  moisTexte: { ...TYPO.micro, color: T.bleu },
  moisFilet: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: T.bordure },
  moisCompte: { fontSize: 11, fontFamily: POLICE.gras, color: T.grisClair, fontVariant: ["tabular-nums"] },
  rangee: { paddingHorizontal: 16, marginBottom: 10 },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: 13,
    backgroundColor: T.carte, borderRadius: 18, padding: 12,
    borderWidth: 1, borderColor: T.carteBord,
  },
  bloc: {
    width: 48, height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: T.bleuVoile,
  },
  blocProchain: { backgroundColor: T.bleuAction },
  blocEnCours: { backgroundColor: T.vert },
  blocPasse: { backgroundColor: T.filet },
  blocJour: { fontSize: 19, fontFamily: POLICE.gras, color: T.bleu, lineHeight: 23, fontVariant: ["tabular-nums"] },
  blocMois: { fontSize: 9, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.1, marginTop: 1 },
  ligneHaut: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  titre: { flex: 1, minWidth: 0, fontSize: 14.5, fontFamily: POLICE.demi, color: T.encre, lineHeight: 19, letterSpacing: -0.2 },
  echeance: { fontSize: 11, fontFamily: POLICE.gras, color: T.orange, marginTop: 1.5, maxWidth: 96, textAlign: "right" },
  lieuTexte: { flexShrink: 1, fontSize: 12, fontFamily: POLICE.normal, color: T.gris },
}));
