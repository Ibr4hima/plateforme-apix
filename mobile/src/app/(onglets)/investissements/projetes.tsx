// Investissements projetés — les trois listes de fDi Markets (Financial
// Times) : les PROJETS annoncés, les SIGNAUX d'investissement, les
// INVESTISSEURS présents. UNE PAGE PAR LISTE.
//
// CE QUE CES LISTES DISENT ET QUE « INVESTISSEMENTS RÉALISÉS » NE DIT PAS. La
// CNUCED mesure ce qui est ENTRÉ, une fois l'argent versé ; fDi relève ce qui a
// été ANNONCÉ, projet par projet, avec son entreprise, son secteur, son pays —
// et, en amont, les INTENTIONS : une entreprise qui étudie un site, lève des
// fonds, nomme un responsable régional. C'est le stade où la prospection a
// encore prise.
//
// UNE SECTION, UNE PAGE. Le tableau des Investissements projetés a trois
// sections ; « Voir les 238 projets », « Voir les 6 signaux », « Voir les 200
// investisseurs » ouvrent chacune SA liste, à son nom. Un écran à trois
// onglets (Projets · Signaux · Entreprises) faisait croire qu'on changeait de
// rubrique alors qu'on venait d'en choisir une. La page, de haut en bas :
//   · la barre : le retour, le titre de la section, les filtres à droite —
//     leur nombre actif en pastille ;
//   · le champ de recherche, là d'emblée, qui dit ce qu'il cherche ;
//   · le contexte : la destination lue — le pays, la région ou le continent
//     (celle des projets se touche pour en changer) — et le compte de la
//     liste dans sa pastille ; ce qui est filtré ne s'y affiche pas ;
//   · la liste : défilement continu, fiche en feuille, grille sur tablette.
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import EnTetePage from "@/components/EnTetePage";
import Icone from "@/components/Icone";
import { SqueletteListe } from "@/components/Squelette";
import { EtatErreur, EtatVide, Tapable } from "@/components/ui";
import { CarteInvestisseur, CarteProjetFdi, CarteSignal } from "@/components/fdi/AtomesFdi";
import DestinationSheet, { type Destination } from "@/components/fdi/DestinationSheet";
import { FicheInvestisseurSheet, FicheProjetFdi, FicheSignal } from "@/components/fdi/FichesFdi";
import { FiltresEntreprisesSheet, FiltresProjetsSheet, FiltresSignauxSheet } from "@/components/fdi/FiltresFdi";
import { enPanne } from "@/lib/api";
import { creerStyles } from "@/lib/apparence";
import {
  FILTRES_ENTREPRISES_VIDES, FILTRES_SIGNAUX_VIDES, type FiltresEntreprises, type FiltresProjets,
  type FiltresSignaux, type Investisseur, PERIMETRE_AFRIQUE, type ProjetFdi, type Signal, type Vue,
  filtresProjetsInitiaux, fmtEntier, nbFiltresEntreprises, nbFiltresProjets, nbFiltresSignaux,
  paramsEntreprises, paramsProjets, paramsSignaux, titreListeFdi, useEntreprisesInfinies,
  usePerimetreProjets, useProjetsInfinis, useSignauxInfinis,
} from "@/lib/fdi";
import { tick } from "@/lib/haptique";
import { GOUTTIERE, MARGE, useGrille } from "@/lib/grille";
import { DEFILEMENT, useMargeBas } from "@/lib/marges";
import { ECHELLE, POLICE, T } from "@/theme";

const VUES: readonly Vue[] = ["projets", "signaux", "entreprises"];

/** Ce que cherche le champ de chaque liste. */
const INVITES: Record<Vue, string> = {
  projets: "Rechercher un projet ou une entreprise",
  signaux: "Rechercher un signal ou une entreprise",
  entreprises: "Rechercher un investisseur",
};

/** Une valeur qui ne suit la saisie qu'une fois la frappe arrêtée : chaque
    lettre tapée ne doit pas valoir une requête. */
function useDifere<V>(valeur: V, delai = 300): V {
  const [v, setV] = useState(valeur);
  useEffect(() => {
    const t = setTimeout(() => setV(valeur), delai);
    return () => clearTimeout(t);
  }, [valeur, delai]);
  return v;
}

const lireListe = (v?: string | string[]) =>
  (Array.isArray(v) ? v.join("|") : v ?? "").split("|").filter(Boolean);

export default function InvestissementsProjetes() {
  const params = useLocalSearchParams<{
    vue?: string; pays?: string; region?: string; destination?: string; destinations?: string;
  }>();
  const margeBas = useMargeBas({ sousOnglets: true });
  const { colonnes, cap, largeur } = useGrille();

  // La liste est celle de la section qui a ouvert la page : elle ne change pas
  const vue: Vue = VUES.includes(params.vue as Vue) ? (params.vue as Vue) : "projets";

  // ── Les filtres de la liste ──
  const [fp, setFp] = useState<FiltresProjets>(() => {
    const f = filtresProjetsInitiaux(params.pays || undefined);
    return params.region ? { ...f, echelle: "regions", region: params.region } : f;
  });
  const [fs, setFs] = useState<FiltresSignaux>(() => ({
    ...FILTRES_SIGNAUX_VIDES, destination: params.destination ?? "",
  }));
  const [fe, setFe] = useState<FiltresEntreprises>(() => ({
    ...FILTRES_ENTREPRISES_VIDES, destinations: lireListe(params.destinations),
  }));

  // La recherche se tape dans le champ de la page ; elle ne part au serveur
  // qu'une fois la frappe arrêtée
  const [saisie, setSaisie] = useState("");
  const recherche = useDifere(saisie);
  const fpR = useMemo(() => ({ ...fp, recherche }), [fp, recherche]);
  const fsR = useMemo(() => ({ ...fs, recherche }), [fs, recherche]);
  const feR = useMemo(() => ({ ...fe, recherche }), [fe, recherche]);

  // Seule la liste de la page se charge
  const qP = useProjetsInfinis(fpR, vue === "projets");
  const qS = useSignauxInfinis(fsR, vue === "signaux");
  const qE = useEntreprisesInfinies(feR, vue === "entreprises");
  const perP = usePerimetreProjets(fp, vue === "projets");

  const bornesProjets = perP.data?.annees ?? [null, null];
  const nbFiltres = vue === "projets" ? nbFiltresProjets(fp, bornesProjets)
    : vue === "signaux" ? nbFiltresSignaux(fs) : nbFiltresEntreprises(fe);

  // ── Feuilles ──
  const [feuille, setFeuille] = useState<null | "filtres" | "destination">(null);
  const [ouvert, setOuvert] = useState<
    | { type: "projet"; p: ProjetFdi } | { type: "signal"; s: Signal } | { type: "investisseur"; e: Investisseur }
    | null>(null);

  // Réinitialiser garde la destination : c'est le sujet de la liste, pas un filtre
  const reinitialiser = () => {
    if (vue === "projets") setFp(f => ({ ...filtresProjetsInitiaux(f.pays), sens: f.sens, echelle: f.echelle, region: f.region }));
    else if (vue === "signaux") setFs(f => ({ ...FILTRES_SIGNAUX_VIDES, destination: f.destination }));
    else setFe(f => ({ ...FILTRES_ENTREPRISES_VIDES, destinations: f.destinations }));
  };

  const ouvrirFiltres = () => { tick(); setFeuille("filtres"); };

  const totalProjets = qP.data?.pages[0]?.kpis.projets;
  const totalSignaux = qS.data?.pages[0]?.kpis.signaux;
  const totalInvestisseurs = qE.data?.pages[0]?.total;

  return (
    <View style={{ flex: 1, backgroundColor: T.fond }}>
      <EnTetePage titre={titreListeFdi(vue)}
        bouton={{ icone: "tune", onPress: ouvrirFiltres, badge: nbFiltres || undefined }}
        recherche={{ valeur: saisie, onChange: setSaisie, placeholder: INVITES[vue], toujours: true }} />

      {vue === "projets" && (
        <Liste requete={qP} colonnes={colonnes} cap={cap} largeur={largeur} margeBas={margeBas}
          cleFiltre={paramsProjets(fpR).toString()}
          elements={qP.data?.pages.flatMap(p => p.projets) ?? []}
          cle={(p: ProjetFdi) => String(p.id)}
          rendre={(p: ProjetFdi) => (
            <CarteProjetFdi p={p} avecDestination={fp.echelle === "regions"} sensSource={fp.sens === "source"}
              onPress={() => setOuvert({ type: "projet", p })} />
          )}
          entete={
            <Contexte
              principal={
                <PuceDestination libelle={(fp.echelle === "regions" ? fp.region : fp.pays) ?? "—"}
                  onPress={() => { tick(); setFeuille("destination"); }} />
              }
              compte={totalProjets != null ? `${fmtEntier(totalProjets)} ${totalProjets > 1 ? "projets" : "projet"}` : null}
              chargement={qP.isPlaceholderData} />
          }
          vide={
            <EtatVide texte="Aucun projet sur ce périmètre" icone="search_off"
              sousTexte={nbFiltres || recherche ? "Les filtres actifs ne laissent aucun projet." : undefined}
              action={nbFiltres ? { label: "Tout réinitialiser", onPress: reinitialiser } : undefined} />
          } />
      )}

      {vue === "signaux" && (
        <Liste requete={qS} colonnes={colonnes} cap={cap} largeur={largeur} margeBas={margeBas}
          cleFiltre={paramsSignaux(fsR).toString()}
          elements={qS.data?.pages.flatMap(p => p.signaux) ?? []}
          cle={(x: Signal) => String(x.id)}
          rendre={(x: Signal) => <CarteSignal s={x} onPress={() => setOuvert({ type: "signal", s: x })} />}
          entete={
            // La destination lue — le Sénégal, une région, ou l'Afrique
            // entière quand aucune n'est choisie
            <Contexte principal={<Text style={s.contexteTitre} numberOfLines={1}>{fs.destination || PERIMETRE_AFRIQUE}</Text>}
              compte={totalSignaux != null ? `${fmtEntier(totalSignaux)} ${totalSignaux > 1 ? "signaux" : "signal"}` : null}
              chargement={qS.isPlaceholderData} />
          }
          vide={
            <EtatVide texte="Aucun signal ne correspond" icone="search_off"
              action={nbFiltresSignaux(fs) ? { label: "Tout réinitialiser", onPress: reinitialiser } : undefined} />
          } />
      )}

      {vue === "entreprises" && (
        <Liste requete={qE} colonnes={colonnes} cap={cap} largeur={largeur} margeBas={margeBas}
          cleFiltre={paramsEntreprises(feR).toString()}
          elements={qE.data?.pages.flatMap(p => p.entreprises) ?? []}
          cle={(e: Investisseur) => `${e.nom}|${e.origine ?? ""}`}
          rendre={(e: Investisseur) => <CarteInvestisseur e={e} onPress={() => setOuvert({ type: "investisseur", e })} />}
          entete={
            <Contexte principal={
                <Text style={s.contexteTitre} numberOfLines={1}>
                  {fe.destinations.length ? fe.destinations.join(", ") : PERIMETRE_AFRIQUE}
                </Text>
              }
              compte={totalInvestisseurs != null ? `${fmtEntier(totalInvestisseurs)} ${totalInvestisseurs > 1 ? "investisseurs" : "investisseur"}` : null}
              chargement={qE.isPlaceholderData} />
          }
          vide={
            <EtatVide texte="Aucune entreprise ne correspond" icone="search_off"
              action={nbFiltresEntreprises(fe) ? { label: "Tout réinitialiser", onPress: reinitialiser } : undefined} />
          } />
      )}

      {/* ── Les feuilles ── */}
      {feuille === "filtres" && (
        vue === "projets" ? (
          <FiltresProjetsSheet filtres={fp} onChange={setFp} onReinitialiser={reinitialiser} onClose={() => setFeuille(null)} />
        ) : vue === "signaux" ? (
          <FiltresSignauxSheet filtres={fsR} onChange={f => setFs({ ...f, recherche: "" })}
            onReinitialiser={reinitialiser} onClose={() => setFeuille(null)} />
        ) : (
          <FiltresEntreprisesSheet filtres={feR} onChange={f => setFe({ ...f, recherche: "" })}
            onReinitialiser={reinitialiser} onClose={() => setFeuille(null)} />
        )
      )}
      {feuille === "destination" && (
        <DestinationSheet pays={perP.data?.pays ?? []}
          valeur={{ echelle: fp.echelle, pays: fp.pays, region: fp.region }}
          onChoisir={(d: Destination) => setFp(f => ({ ...f, ...d }))}
          onClose={() => setFeuille(null)} />
      )}
      {ouvert?.type === "projet" && <FicheProjetFdi p={ouvert.p} onClose={() => setOuvert(null)} />}
      {ouvert?.type === "signal" && <FicheSignal s={ouvert.s} onClose={() => setOuvert(null)} />}
      {ouvert?.type === "investisseur" && <FicheInvestisseurSheet e={ouvert.e} onClose={() => setOuvert(null)} />}
    </View>
  );
}

// ── La liste d'une vue ───────────────────────────────────────────────────────

type Requete = {
  isLoading: boolean; isError: boolean; data?: unknown;
  isFetchingNextPage: boolean; hasNextPage: boolean; isRefetching: boolean;
  fetchNextPage: () => unknown; refetch: () => unknown;
};

function Liste<E>({ requete, elements, cle, rendre, entete, vide, colonnes, cap, largeur, margeBas, cleFiltre }: {
  requete: Requete; elements: E[];
  cle: (e: E) => string; rendre: (e: E) => React.ReactNode;
  entete: React.ReactElement; vide: React.ReactElement;
  colonnes: number; cap: object | null; largeur: number; margeBas: number;
  /** La sélection envoyée : quand elle change, la liste remonte en tête. */
  cleFiltre: string;
}) {
  const liste = useRef<FlatList<E>>(null);
  // Une nouvelle sélection repart du haut : rester au 200ᵉ projet d'un
  // résultat qui n'en compte plus que douze n'aurait aucun sens
  useEffect(() => { liste.current?.scrollToOffset({ offset: 0, animated: false }); }, [cleFiltre]);

  // Les pages ne se chevauchent pas — l'ordre du serveur est total —, mais
  // une donnée mise à jour entre deux pages pourrait faire glisser une ligne :
  // la clé de React doit rester unique quoi qu'il arrive
  const uniques = useMemo(() => {
    const vus = new Set<string>();
    return elements.filter(e => { const k = cle(e); if (vus.has(k)) return false; vus.add(k); return true; });
  }, [elements, cle]);

  // Au pied, la roue de la page suivante, et rien d'autre : le compte de la
  // liste est déjà dans sa pastille, en tête
  const pied = requete.isFetchingNextPage ? (
    <View style={s.pied}><ActivityIndicator color={T.bleu as any} /></View>
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      <FlatList {...DEFILEMENT}
        ref={liste}
        key={`grille-${colonnes}`}
        data={uniques}
        numColumns={colonnes}
        keyExtractor={cle}
        // PAS DE CASCADE D'ENTRÉE SUR CES LISTES. Elle a été essayée : une
        // cellule animée à son montage se détachait du flux le temps de jouer,
        // et les premières cartes finissaient rangées SOUS les suivantes — la
        // liste commençait au neuvième projet sans que rien ne le signale.
        // Une liste qui se recharge à chaque filtre et s'allonge à chaque page
        // n'a de toute façon rien à mettre en scène : elle doit être là.
        renderItem={({ item }) => (
          <View style={[s.cellule, colonnes > 1 && { width: largeur, paddingHorizontal: 0 }]}>{rendre(item)}</View>
        )}
        columnWrapperStyle={colonnes > 1 ? [s.rangeeGrille, cap] : undefined}
        ListHeaderComponent={<View style={cap}>{entete}</View>}
        ListEmptyComponent={
          requete.isLoading ? <SqueletteListe />
          : enPanne(requete) ? <EtatErreur onRetry={() => requete.refetch()} />
          : vide
        }
        ListFooterComponent={pied}
        contentContainerStyle={{ paddingBottom: margeBas }}
        onEndReached={() => { if (requete.hasNextPage && !requete.isFetchingNextPage) requete.fetchNextPage(); }}
        onEndReachedThreshold={0.7}
        refreshing={requete.isRefetching && !requete.isFetchingNextPage}
        onRefresh={() => requete.refetch()}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        windowSize={9}
      />
    </View>
  );
}

// ── Le contexte de la liste : de quoi elle parle ─────────────────────────────
// Rien de ce qui est filtré ne s'affiche ici : la page reste nette. Les
// filtres vivent dans leur feuille, ouverte depuis la barre, dont le bouton
// se remplit et porte le compte quand un filtre est appliqué.

function Contexte({ principal, compte, chargement }: {
  principal: React.ReactNode; compte: string | null; chargement?: boolean;
}) {
  return (
    <View style={s.contexte}>
      {/* Le lieu, puis le compte de la liste dans sa pastille — le style des
          onglets des Investissements privés : blanche, le nombre en bleu */}
      <View style={s.contexteLigne}>
        <View style={s.contexteGauche}>{principal}</View>
        {compte ? (
          <View style={s.compte}>
            <Text style={s.compteTexte} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.compact}>{compte}</Text>
          </View>
        ) : null}
        {chargement && <ActivityIndicator size="small" color={T.gris as any} />}
      </View>
    </View>
  );
}

/** La destination lue : un titre qui se touche pour en changer. */
function PuceDestination({ libelle, onPress }: { libelle: string; onPress: () => void }) {
  return (
    <Tapable onPress={onPress} echelle={0.97} style={s.destination}
      accessibilityRole="button" accessibilityLabel={`Destination : ${libelle}. Changer`}>
      <Text style={s.contexteTitre} numberOfLines={1}>{libelle}</Text>
      {/* Un chevron discret, détaché du nom : il dit qu'on peut changer de
          pays sans lui disputer le regard */}
      <Icone sf="chevron.down" materiel="expand_more" taille={13} couleur={T.bleu} poids="semibold" />
    </Tapable>
  );
}

const s = creerStyles(() => ({
  cellule: { paddingHorizontal: MARGE, marginBottom: 10 },
  rangeeGrille: { gap: GOUTTIERE, paddingHorizontal: MARGE },

  contexte: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  // Le lieu et son compte côte à côte : la pastille suit le nom, elle ne file
  // pas au bord de l'écran
  contexteLigne: { flexDirection: "row", alignItems: "center", gap: 10 },
  contexteGauche: { flexShrink: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
  contexteTitre: { flexShrink: 1, fontSize: 21, lineHeight: 27, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.5 },
  // La pastille du compte — le style des onglets des Investissements privés
  compte: {
    flexShrink: 0, backgroundColor: T.carte, borderRadius: 999, borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord,
    paddingHorizontal: 11, paddingVertical: 4.5,
    shadowColor: "#0B1220", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  compteTexte: { fontSize: 13, fontFamily: POLICE.gras, color: T.bleu, fontVariant: ["tabular-nums"] },

  destination: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },


  pied: { alignItems: "center", justifyContent: "center", paddingVertical: 18 },
}));
