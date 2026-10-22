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
import { Animated, StyleSheet, Text, View } from "react-native";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, EtatErreur, EtatVide, Tapable, EtatHorsLigne } from "@/components/ui";
import { useRafraichir } from "@/lib/rafraichir";
import EnTetePage from "@/components/EnTetePage";
import EvenementSheet from "@/components/EvenementSheet";
import Icone from "@/components/Icone";
import { enAttente, enPanne, fetchTous, horsLigne } from "@/lib/api";
import {
  comparerEvenements, dansCombienEvenement, dateEvenementDe, ordinal, prochainEvenement, statutEvenement, tuileDate,
  type DateEvenement,
} from "@/lib/evenements";
import { plier } from "@/lib/format";
import { DEFILEMENT, useMargeBas, useCap } from "@/lib/marges";
import { coin, ECHELLE, FONTE, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";
import TexteDefilant from "@/components/TexteDefilant";


// Intitulé du groupe : mois + année — ou l'année seule, pour une édition
// annoncée sans mois
const groupeDe = (de: DateEvenement): string => de.precision === "annee"
  ? String(de.date.getFullYear())
  : de.date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase();

// ── La ligne d'agenda ────────────────────────────────────────────────────────
function LigneEvenement({ e, prochain, onPress }: { e: any; prochain: boolean; onPress: () => void }) {
  const statut = statutEvenement(e);
  const enCours = statut === "en_cours";
  const passe = statut === "termine";
  const de = dateEvenementDe(e);
  const tuile = de ? tuileDate(de) : null;
  const lieu = [e.ville, e.pays_hote_nom].filter(Boolean).join(" · ");
  const echeance = enCours ? "En ce moment" : passe ? null : dansCombienEvenement(e);

  return (
    <Tapable onPress={onPress} style={[s.ligne, passe && { backgroundColor: T.carteDouce }]}>
      {/* Bloc date : bleu plein pour le prochain, vert pour l'en cours */}
      <View style={[s.bloc, prochain && s.blocProchain, enCours && s.blocEnCours, passe && s.blocPasse]}>
        {tuile ? (
          <>
            <Text style={[s.blocJour, tuile.textuel && s.blocJourTextuel, (prochain || enCours) && { color: "#fff" }, passe && { color: T.gris }]}
              // La tuile a une taille fixe : le texte y grandit d'un cran, pas plus
              numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={ECHELLE.chiffre}>
              {tuile.haut}
            </Text>
            {tuile.bas ? (
              <Text style={[s.blocMois, (prochain || enCours) && { color: "rgba(255,255,255,0.85)" }, passe && { color: T.gris }]}
                maxFontSizeMultiplier={ECHELLE.compact}>
                {tuile.bas}
              </Text>
            ) : null}
          </>
        ) : (
          // Récurrent sans date arrêtée : le pictogramme de récurrence
          <Icone sf="arrow.triangle.2.circlepath" materiel="autorenew" taille={18} couleur={T.gris} />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={s.ligneHaut}>
          <Text style={[s.titre, passe && { color: T.texte }]}>{e.nom_event}</Text>
          {echeance && (
            <TexteDefilant style={[s.echeance, enCours && { color: T.vert }]}>{echeance}</TexteDefilant>
          )}
        </View>
        {/* Seconde ligne : le lieu, ou à défaut l'édition. Le rôle APIX vit
            dans la fiche — la liste reste un agenda, pas un tableau. */}
        {(lieu || e.edition != null) && (
          <TexteDefilant style={s.lieuTexte}>{lieu || ordinal(e.edition)}</TexteDefilant>
        )}
      </View>
    </Tapable>
  );
}

export default function Evenements() {
  const margeBas = useMargeBas({ sousOnglets: true });
  const [q, setQ] = useState("");
  const [lentille, setLentille] = useState("a_venir");
  const [selec, setSelec] = useState<any>(null);


  const requete = useQuery({
    queryKey: ["evenements"], queryFn: () => fetchTous("/evenements"),
  });
  const { data, isError, refetch } = requete;
  const { tire, rafraichir } = useRafraichir(refetch);

  // La recherche seule, avant la lentille : les compteurs des segments
  // se calculent sur cette base
  const communs = useMemo(() => {
    let liste = data || [];
    // Accents et casse repliés : « senegal » trouve « Sénégal »
    const t = plier(q);
    if (t) {
      liste = liste.filter((e: any) =>
        plier(e.nom_event).includes(t) || plier(e.ville).includes(t) || plier(e.pays_hote_nom).includes(t));
    }
    return liste;
  }, [data, q]);

  const aVenir = useMemo(() => communs
    .filter((e: any) => statutEvenement(e) !== "termine")
    // Le plus proche d'abord ; les sans-date ferment la marche
    .sort(comparerEvenements), [communs]);

  const passes = useMemo(() => communs
    .filter((e: any) => statutEvenement(e) === "termine")
    .sort((a: any, b: any) => comparerEvenements(b, a)),
  [communs]);

  const liste = lentille === "a_venir" ? aVenir : passes;
  const prochainId = useMemo(() => prochainEvenement(aVenir)?.id ?? null, [aVenir]);

  // Groupes par mois ; les récurrents sans date arrêtée sous « À programmer »
  const sections = useMemo(() => {
    const groupes = new Map<string, any[]>();
    for (const e of liste) {
      const de = dateEvenementDe(e);
      const cle = de ? groupeDe(de) : "À PROGRAMMER";
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle)!.push(e);
    }
    return Array.from(groupes.entries()).map(([titre, donnees]) => ({ title: titre, data: donnees }));
  }, [liste]);

  // Tablette : la liste se centre et se plafonne — les lignes pleine largeur
  // sur 1 000 pt deviennent illisibles
  const cap = useCap();

  // Les compteurs vivent dans les segments eux-mêmes (pastilles), pas en
  // ligne de texte sous le hero
  const lentilles = [
    { cle: "a_venir", label: "À venir",  compte: data ? aVenir.length : undefined },
    { cle: "passes",  label: "Terminés", compte: data ? passes.length : undefined },
  ];

  const hero = (
    <EnTetePage titre="Événements"
      recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
      segments={{ options: lentilles, valeur: lentille, onChange: setLentille }} />
  );

  // La recherche ne trouve rien dans cette lentille mais trouve dans
  // l'autre : l'état vide le dit et y mène
  const ailleurs = q.trim() ? lentilles.find(l => l.cle !== lentille && (l.compte ?? 0) > 0) : undefined;
  const vide = horsLigne(requete) ? <EtatHorsLigne />
    : enAttente(requete) ? <SqueletteListe />
    : enPanne({ isError, data }) ? <EtatErreur onRetry={() => refetch()} />
    : <EtatVide texte={lentille === "a_venir"
        ? "Aucun événement à venir ne correspond."
        : "Aucun événement terminé ne correspond."}
        action={ailleurs ? {
          label: `Voir ${ailleurs.compte} résultat${(ailleurs.compte ?? 0) > 1 ? "s" : ""} dans ${ailleurs.label}`,
          onPress: () => setLentille(ailleurs.cle),
        } : undefined} />;

  return (
    // L'en-tête est ANCRÉ hors du défilement : retour, recherche et segments
    // restent sous le pouce, quelle que soit la position dans la liste
    <View style={{ flex: 1, backgroundColor: T.fond }}>
      {hero}
      <Animated.SectionList {...DEFILEMENT}
        style={{ backgroundColor: T.fond }}
        sections={sections}
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
        refreshing={tire}
        onRefresh={rafraichir}
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
  moisCompte: { fontSize: 11, ...FONTE.gras, color: T.grisClair, fontVariant: ["tabular-nums"] },
  rangee: { paddingHorizontal: 16, marginBottom: 10 },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: 13,
    backgroundColor: T.carte, borderRadius: coin(18), padding: 12,
    borderWidth: 1, borderColor: T.carteBord,
  },
  bloc: {
    width: 48, height: 54, borderRadius: coin(14), alignItems: "center", justifyContent: "center",
    backgroundColor: T.bleuVoile,
  },
  blocProchain: { backgroundColor: T.bleuAction },
  // Le blanc s'y pose : le vert plein de la nuit, et non le teal clair des
  // textes, sur lequel il ne se lisait plus
  blocEnCours: { backgroundColor: T.vertAction },
  blocPasse: { backgroundColor: T.filet },
  blocJour: { fontSize: 19, ...FONTE.gras, color: T.bleu, lineHeight: 23, fontVariant: ["tabular-nums"] },
  blocJourTextuel: { fontSize: 14, lineHeight: 18, letterSpacing: 0.4 },
  blocMois: { fontSize: 9, ...FONTE.gras, color: T.bleu, letterSpacing: 1.1, marginTop: 1 },
  ligneHaut: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  titre: { flex: 1, minWidth: 0, fontSize: 14.5, ...FONTE.demi, color: T.encre, lineHeight: 19, letterSpacing: -0.2 },
  echeance: { fontSize: 11, ...FONTE.gras, color: T.bleu, marginTop: 1.5, maxWidth: 96, textAlign: "right" },
  lieuTexte: { flexShrink: 1, fontSize: 12, ...FONTE.normal, color: T.gris },
}));
