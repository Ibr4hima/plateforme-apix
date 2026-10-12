// Investissements projetés — les trois bases de fDi Markets (Financial
// Times), en trois vues : les PROJETS annoncés, les SIGNAUX d'investissement,
// les ENTREPRISES investisseuses.
//
// CE QUE CET ÉCRAN DIT ET QUE « INVESTISSEMENTS RÉALISÉS » NE DIT PAS. La
// CNUCED mesure ce qui est ENTRÉ, une fois l'argent versé ; fDi relève ce qui a
// été ANNONCÉ, projet par projet, avec son entreprise, son secteur, son pays —
// et, en amont, les INTENTIONS : une entreprise qui étudie un site, lève des
// fonds, nomme un responsable régional. C'est le stade où la prospection a
// encore prise.
//
// LA GRAMMAIRE DE L'APP, celle des Entreprises installées et des Prospects :
// un bandeau ancré (retour, recherche, filtres), les vues en segments à
// compteurs, puis la liste. Ce qui change d'avec le site tient au téléphone :
//   · la colonne de filtres devient une feuille, ouverte depuis le bandeau, et
//     les filtres actifs se lisent — et se retirent — en pastilles au-dessus
//     de la liste ;
//   · la pagination devient un défilement continu ;
//   · la fiche s'ouvre en feuille ;
//   · sur tablette, les cartes passent en grille de deux ou trois colonnes.
//
// CHAQUE VUE GARDE SES FILTRES ET SA RECHERCHE : elles ne filtrent pas les
// mêmes objets, et un secteur retenu sur l'une n'a aucune raison de se
// reporter sur l'autre. Une vue déjà ouverte reste montée : y revenir rend
// la liste là où on l'avait laissée.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
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
  paramsEntreprises, paramsProjets, paramsSignaux, periodeEnClair, useEntreprisesInfinies,
  usePerimetreProjets, useProjetsInfinis, useSignauxInfinis,
} from "@/lib/fdi";
import { tick } from "@/lib/haptique";
import { GOUTTIERE, MARGE, useGrille } from "@/lib/grille";
import { useMargeBas } from "@/lib/marges";
import { ECHELLE, POLICE, T } from "@/theme";

const VUES: { cle: Vue; label: string }[] = [
  { cle: "projets", label: "Projets" },
  { cle: "signaux", label: "Signaux" },
  { cle: "entreprises", label: "Entreprises" },
];

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

const accordRecu = (n: number) => (n > 1 ? "reçus" : "reçu");

const lireListe = (v?: string | string[]) =>
  (Array.isArray(v) ? v.join("|") : v ?? "").split("|").filter(Boolean);

export default function InvestissementsProjetes() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    vue?: string; pays?: string; region?: string; destination?: string; destinations?: string;
  }>();
  const margeBas = useMargeBas();
  const { colonnes, cap, largeur } = useGrille();

  const [vue, setVue] = useState<Vue>(() =>
    VUES.some(v => v.cle === params.vue) ? (params.vue as Vue) : "projets");
  // Une vue ouverte reste montée : on y revient là où on l'avait laissée
  const [visitees, setVisitees] = useState<Set<Vue>>(() => new Set([vue]));
  const choisirVue = (v: Vue) => { setVue(v); setVisitees(p => (p.has(v) ? p : new Set(p).add(v))); };

  // ── Les filtres, vue par vue ──
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

  // La recherche se tape dans le bandeau ; chaque vue a la sienne, et elle ne
  // part au serveur qu'une fois la frappe arrêtée
  const [saisies, setSaisies] = useState<Record<Vue, string>>({ projets: "", signaux: "", entreprises: "" });
  const rP = useDifere(saisies.projets), rS = useDifere(saisies.signaux), rE = useDifere(saisies.entreprises);
  const fpR = useMemo(() => ({ ...fp, recherche: rP }), [fp, rP]);
  const fsR = useMemo(() => ({ ...fs, recherche: rS }), [fs, rS]);
  const feR = useMemo(() => ({ ...fe, recherche: rE }), [fe, rE]);

  // Les trois listes partent ensemble : leurs compteurs remplissent les
  // segments dès l'ouverture, et passer d'une vue à l'autre n'attend pas
  const qP = useProjetsInfinis(fpR);
  const qS = useSignauxInfinis(fsR);
  const qE = useEntreprisesInfinies(feR);
  const perP = usePerimetreProjets(fp);

  const bornesProjets = perP.data?.annees ?? [null, null];
  const nbFiltres = vue === "projets" ? nbFiltresProjets(fp, bornesProjets)
    : vue === "signaux" ? nbFiltresSignaux(fs) : nbFiltresEntreprises(fe);

  const totaux: Record<Vue, number | undefined> = {
    projets: qP.data?.pages[0]?.kpis.projets,
    signaux: qS.data?.pages[0]?.kpis.signaux,
    entreprises: qE.data?.pages[0]?.total,
  };

  // ── Feuilles ──
  const [feuille, setFeuille] = useState<null | "filtres" | "destination">(null);
  const [ouvert, setOuvert] = useState<
    | { type: "projet"; p: ProjetFdi } | { type: "signal"; s: Signal } | { type: "investisseur"; e: Investisseur }
    | null>(null);

  const reinitialiser = () => {
    if (vue === "projets") setFp(f => ({ ...filtresProjetsInitiaux(f.pays), sens: f.sens, echelle: f.echelle, region: f.region }));
    else if (vue === "signaux") setFs(FILTRES_SIGNAUX_VIDES);
    else setFe(FILTRES_ENTREPRISES_VIDES);
  };

  const ouvrirFiltres = () => { tick(); setFeuille("filtres"); };

  const ouvrirRapport = () => {
    tick();
    const f = vue === "projets"
      ? { echelle: fp.echelle, pays: fp.pays, region: fp.region, sens: fp.sens }
      : vue === "signaux" ? fsR : feR;
    router.push({ pathname: "/investissements-projetes/rapport", params: { vue, f: JSON.stringify(f) } } as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.fond }}>
      <EnTetePage titre="Investissements projetés"
        recherche={{
          valeur: saisies[vue],
          onChange: v => setSaisies(s => ({ ...s, [vue]: v })),
          placeholder: vue === "projets" ? "Rechercher un projet ou une entreprise"
            : vue === "signaux" ? "Rechercher un signal ou une entreprise" : "Rechercher un investisseur",
        }}
        segments={{ options: VUES, valeur: vue, onChange: c => choisirVue(c as Vue) }} />

      {visitees.has("projets") && (
        <Liste visible={vue === "projets"} requete={qP} colonnes={colonnes} cap={cap} largeur={largeur} margeBas={margeBas}
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
              description={[
                totaux.projets != null ? `${fmtEntier(totaux.projets)} ${totaux.projets > 1 ? "projets" : "projet"} ${fp.sens === "source" ? "implantés à l'étranger" : accordRecu(totaux.projets)}` : null,
                periodeEnClair(qP.data?.pages[0]?.kpis.annees)]}
              nbFiltres={nbFiltres} onFiltres={ouvrirFiltres}
              onRapport={ouvrirRapport} chargement={qP.isPlaceholderData}
              puces={pucesProjets(fp, bornesProjets, setFp)} />
          }
          vide={
            <EtatVide texte="Aucun projet sur ce périmètre" icone="search_off"
              sousTexte={nbFiltres || rP ? "Les filtres actifs ne laissent aucun projet." : undefined}
              action={nbFiltres ? { label: "Tout réinitialiser", onPress: reinitialiser } : undefined} />
          }
          nom={["projet", "projets"]} />
      )}

      {visitees.has("signaux") && (
        <Liste visible={vue === "signaux"} requete={qS} colonnes={colonnes} cap={cap} largeur={largeur} margeBas={margeBas}
          cleFiltre={paramsSignaux(fsR).toString()}
          elements={qS.data?.pages.flatMap(p => p.signaux) ?? []}
          cle={(x: Signal) => String(x.id)}
          rendre={(x: Signal) => <CarteSignal s={x} onPress={() => setOuvert({ type: "signal", s: x })} />}
          entete={
            <Contexte principal={<Text style={s.contexteTitre}>{PERIMETRE_AFRIQUE}</Text>}
              description={[
                totaux.signaux != null ? `${fmtEntier(totaux.signaux)} ${totaux.signaux > 1 ? "signaux" : "signal"} d'investissement` : null,
                periodeEnClair(qS.data?.pages[0]?.kpis.annees)]}
              nbFiltres={nbFiltres} onFiltres={ouvrirFiltres}
              onRapport={ouvrirRapport} chargement={qS.isPlaceholderData}
              puces={pucesSignaux(fs, setFs)} />
          }
          vide={
            <EtatVide texte="Aucun signal ne correspond" icone="search_off"
              action={nbFiltresSignaux(fs) ? { label: "Tout réinitialiser", onPress: reinitialiser } : undefined} />
          }
          nom={["signal", "signaux"]} />
      )}

      {visitees.has("entreprises") && (
        <Liste visible={vue === "entreprises"} requete={qE} colonnes={colonnes} cap={cap} largeur={largeur} margeBas={margeBas}
          cleFiltre={paramsEntreprises(feR).toString()}
          elements={qE.data?.pages.flatMap(p => p.entreprises) ?? []}
          cle={(e: Investisseur) => `${e.nom}|${e.origine ?? ""}`}
          rendre={(e: Investisseur) => <CarteInvestisseur e={e} onPress={() => setOuvert({ type: "investisseur", e })} />}
          entete={
            <Contexte principal={<Text style={s.contexteTitre}>{PERIMETRE_AFRIQUE}</Text>}
              description={[
                totaux.entreprises != null ? `${fmtEntier(totaux.entreprises)} ${totaux.entreprises > 1 ? "investisseurs" : "investisseur"}` : null,
                "groupés par maison mère"]}
              nbFiltres={nbFiltres} onFiltres={ouvrirFiltres}
              onRapport={ouvrirRapport} chargement={qE.isPlaceholderData}
              puces={pucesEntreprises(fe, setFe)} />
          }
          vide={
            <EtatVide texte="Aucune entreprise ne correspond" icone="search_off"
              action={nbFiltresEntreprises(fe) ? { label: "Tout réinitialiser", onPress: reinitialiser } : undefined} />
          }
          nom={["investisseur", "investisseurs"]} />
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

function Liste<E>({ visible, requete, elements, cle, rendre, entete, vide, colonnes, cap, largeur, margeBas, cleFiltre, nom }: {
  visible: boolean; requete: Requete; elements: E[];
  cle: (e: E) => string; rendre: (e: E) => React.ReactNode;
  entete: React.ReactElement; vide: React.ReactElement;
  colonnes: number; cap: object | null; largeur: number; margeBas: number;
  /** La sélection envoyée : quand elle change, la liste remonte en tête. */
  cleFiltre: string;
  nom: [string, string];
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

  const pied = requete.isFetchingNextPage ? (
    <View style={s.pied}><ActivityIndicator color={T.bleu as any} /></View>
  ) : !requete.hasNextPage && uniques.length > 0 ? (
    <View style={s.pied}>
      <View style={s.finFilet} />
      <Text style={s.finTexte} maxFontSizeMultiplier={ECHELLE.compact}>
        {fmtEntier(uniques.length)} {uniques.length > 1 ? nom[1] : nom[0]}
      </Text>
      <View style={s.finFilet} />
    </View>
  ) : null;

  return (
    <View style={[{ flex: 1 }, !visible && { display: "none" }]}>
      <FlatList
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
        // Une liste MASQUÉE ne charge rien : sans mise en page, elle se croit
        // toujours au bout, et tirerait page après page tout le relevé
        onEndReached={() => { if (visible && requete.hasNextPage && !requete.isFetchingNextPage) requete.fetchNextPage(); }}
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

// ── Le contexte de la liste : de quoi elle parle, et ce qui la filtre ────────

function Contexte({ principal, description, nbFiltres, onFiltres, onRapport, chargement, puces }: {
  principal: React.ReactNode; description: (string | null | undefined)[];
  nbFiltres: number; onFiltres: () => void; onRapport: () => void;
  chargement?: boolean; puces: { cle: string; label: string; retirer: () => void }[];
}) {
  return (
    <View style={s.contexte}>
      <View style={s.contexteLigne}>
        <View style={s.contexteGauche}>{principal}</View>
        {/* Les filtres, À CÔTÉ DE LA LISTE qu'ils restreignent ; le nombre de
            ceux qui sont actifs s'y lit sans ouvrir la feuille */}
        <Tapable onPress={onFiltres} echelle={0.95} style={[s.bouton, nbFiltres > 0 && s.boutonActif]}
          accessibilityRole="button"
          accessibilityLabel={nbFiltres ? `Filtres, ${nbFiltres} actif${nbFiltres > 1 ? "s" : ""}` : "Filtres"}>
          <Icone sf="line.3.horizontal.decrease" materiel="tune" taille={16} couleur={T.bleu} />
          <Text style={s.boutonTexte} maxFontSizeMultiplier={ECHELLE.compact}>
            {nbFiltres > 0 ? `Filtres · ${nbFiltres}` : "Filtres"}
          </Text>
        </Tapable>
        <Tapable onPress={onRapport} echelle={0.95} style={s.bouton}
          accessibilityRole="button" accessibilityLabel="Ouvrir le rapport">
          <Icone sf="doc.text" materiel="description" taille={15} couleur={T.bleu} />
          <Text style={s.boutonTexte} maxFontSizeMultiplier={ECHELLE.compact}>Rapport</Text>
        </Tapable>
      </View>
      <View style={s.descriptionLigne}>
        <Text style={s.description} numberOfLines={2}>{description.filter(Boolean).join(" · ")}</Text>
        {chargement && <ActivityIndicator size="small" color={T.gris as any} />}
      </View>
      {/* LES FILTRES ACTIFS, EN PASTILLES : la feuille est refermée, et sans
          elles on ne saurait plus ce qui restreint la liste. Une croix les
          retire une à une. */}
      {puces.length > 0 && (
        <View style={s.puces}>
          {puces.map(p => (
            <Tapable key={p.cle} onPress={() => { tick(); p.retirer(); }} echelle={0.95} style={s.puce}
              accessibilityRole="button" accessibilityLabel={`Retirer le filtre ${p.label}`}>
              <Text style={s.puceTexte} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.compact}>{p.label}</Text>
              <Icone sf="xmark" materiel="close" taille={13} couleur={T.bleu} />
            </Tapable>
          ))}
        </View>
      )}
    </View>
  );
}

/** La destination lue : un titre qui se touche pour en changer. */
function PuceDestination({ libelle, onPress }: { libelle: string; onPress: () => void }) {
  return (
    <Tapable onPress={onPress} echelle={0.97} style={s.destination}
      accessibilityRole="button" accessibilityLabel={`Destination : ${libelle}. Changer`}>
      <Text style={s.contexteTitre} numberOfLines={1}>{libelle}</Text>
      <Icone sf="chevron.down" materiel="expand_more" taille={22} couleur={T.bleu} />
    </Tapable>
  );
}

// ── Les pastilles de filtres actifs, vue par vue ─────────────────────────────

type Puce = { cle: string; label: string; retirer: () => void };

function pucePeriode(a0: number | null, a1: number | null, bornes: [number | null, number | null],
                     retirer: () => void): Puce[] {
  const actif = (a0 != null && a0 !== bornes[0]) || (a1 != null && a1 !== bornes[1]);
  if (!actif) return [];
  const d = a0 ?? bornes[0], f = a1 ?? bornes[1];
  return [{ cle: "periode", label: d === f ? `${d}` : `${d} – ${f}`, retirer }];
}

function pucesProjets(f: FiltresProjets, bornes: [number | null, number | null],
                      set: (fn: (f: FiltresProjets) => FiltresProjets) => void): Puce[] {
  const precises = new Set(f.sousSecteurs.map(x => x.secteur));
  return [
    ...pucePeriode(f.anneeMin, f.anneeMax, bornes, () => set(x => ({ ...x, anneeMin: null, anneeMax: null }))),
    ...f.secteurs.filter(v => !precises.has(v)).map(v => ({ cle: `sec:${v}`, label: v,
      retirer: () => set(x => ({ ...x, secteurs: x.secteurs.filter(y => y !== v) })) })),
    ...f.sousSecteurs.map(v => ({ cle: `ss:${v.secteur}:${v.nom}`, label: v.nom,
      retirer: () => set(x => {
        const sous = x.sousSecteurs.filter(y => !(y.nom === v.nom && y.secteur === v.secteur));
        // Le dernier sous-secteur retiré libère son secteur, qui ne restait
        // coché que pour les porter
        const encore = sous.some(y => y.secteur === v.secteur);
        return { ...x, sousSecteurs: sous, secteurs: encore ? x.secteurs : x.secteurs.filter(y => y !== v.secteur) };
      }) })),
    ...f.activites.map(v => ({ cle: `act:${v}`, label: v,
      retirer: () => set(x => ({ ...x, activites: x.activites.filter(y => y !== v) })) })),
    ...f.types.map(v => ({ cle: `typ:${v}`, label: v,
      retirer: () => set(x => ({ ...x, types: x.types.filter(y => y !== v) })) })),
  ];
}

function pucesSignaux(f: FiltresSignaux, set: (fn: (f: FiltresSignaux) => FiltresSignaux) => void): Puce[] {
  const une = (k: "origine" | "destination" | "secteur" | "activite", prefixe: string): Puce[] =>
    f[k] ? [{ cle: k, label: `${prefixe}${f[k]}`, retirer: () => set(x => ({ ...x, [k]: "" })) }] : [];
  return [
    ...(f.anneeMin != null || f.anneeMax != null ? [{
      cle: "periode", label: `${f.anneeMin ?? "…"} – ${f.anneeMax ?? "…"}`,
      retirer: () => set(x => ({ ...x, anneeMin: null, anneeMax: null })),
    }] : []),
    ...une("origine", "De : "), ...une("destination", "Vers : "),
    ...une("secteur", ""), ...une("activite", ""),
  ];
}

function pucesEntreprises(f: FiltresEntreprises,
                          set: (fn: (f: FiltresEntreprises) => FiltresEntreprises) => void): Puce[] {
  const precises = new Set(f.sousSecteurs.map(x => x.secteur));
  const liste = (k: "origines" | "destinations" | "activites", prefixe: string): Puce[] =>
    f[k].map(v => ({ cle: `${k}:${v}`, label: `${prefixe}${v}`,
      retirer: () => set(x => ({ ...x, [k]: x[k].filter(y => y !== v) })) }));
  return [
    ...liste("origines", "De : "), ...liste("destinations", "Vers : "),
    ...f.secteurs.filter(v => !precises.has(v)).map(v => ({ cle: `sec:${v}`, label: v,
      retirer: () => set(x => ({ ...x, secteurs: x.secteurs.filter(y => y !== v) })) })),
    ...f.sousSecteurs.map(v => ({ cle: `ss:${v.secteur}:${v.nom}`, label: v.nom,
      retirer: () => set(x => {
        const sous = x.sousSecteurs.filter(y => !(y.nom === v.nom && y.secteur === v.secteur));
        const encore = sous.some(y => y.secteur === v.secteur);
        return { ...x, sousSecteurs: sous, secteurs: encore ? x.secteurs : x.secteurs.filter(y => y !== v.secteur) };
      }) })),
    ...liste("activites", ""),
  ];
}

const s = creerStyles(() => ({
  cellule: { paddingHorizontal: MARGE, marginBottom: 10 },
  rangeeGrille: { gap: GOUTTIERE, paddingHorizontal: MARGE },

  contexte: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 8 },
  contexteLigne: { flexDirection: "row", alignItems: "center", gap: 8 },
  contexteGauche: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
  contexteTitre: { flexShrink: 1, fontSize: 21, lineHeight: 27, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.5 },
  descriptionLigne: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 18 },
  description: { flexShrink: 1, fontSize: 12.5, lineHeight: 18, fontFamily: POLICE.demi, color: T.gris },
  // Deux boutons légers et identiques : la liste reste le sujet de l'écran
  bouton: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: T.carte, borderRadius: 999, borderWidth: 1, borderColor: T.carteBord,
    paddingLeft: 11, paddingRight: 13, paddingVertical: 7,
  },
  boutonActif: { backgroundColor: T.bleuVoile, borderColor: "transparent" },
  boutonTexte: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.bleu, fontVariant: ["tabular-nums"] },

  destination: { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 1 },

  puces: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  puce: {
    flexDirection: "row", alignItems: "center", gap: 5, maxWidth: 260,
    backgroundColor: T.bleuVoile, borderRadius: 999, paddingLeft: 11, paddingRight: 8, paddingVertical: 5,
  },
  puceTexte: { flexShrink: 1, fontSize: 12, fontFamily: POLICE.demi, color: T.bleu },

  pied: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18, paddingHorizontal: 40 },
  finFilet: { flex: 1, height: 1, backgroundColor: T.bordure },
  finTexte: { fontSize: 11, fontFamily: POLICE.demi, color: T.gris, fontVariant: ["tabular-nums"] },
}));
