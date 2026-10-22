// Commerce extérieur du Sénégal (NACE · ANSD) — la grammaire de Flux
// bilatéraux, celle de la carte vedette de l'accueil.
//
// UNE BASCULE, EN TÊTE : Exportations · Importations. Elle met TOUTE la page
// dans un sens :
//   · la carte vedette montre le total de ce sens (micro-étiquette, badge
//     « Sénégal » sans point, nombre en 38 pt qui compte, variation vs N-1
//     fléchée, silhouette Skia sans axes, bornes d'années), puis deux
//     repères : l'autre flux — le toucher bascule la page — et la balance
//     commerciale, AFFICHÉE seulement : elle n'est pas un sens, elle ne
//     s'installe pas en vedette ;
//   · les produits de ce sens suivent, dans l'une des quatre nomenclatures du
//     rapport, comme sur le site — Principaux, Groupes d'utilisation,
//     Regroupés, Chapitres SH : le premier de l'année en vedette, les
//     suivants en repères ;
//   · puis ses zones géographiques, par continent ou par région, et le top 10
//     des pays de la zone en vedette.
// Le sens étant dit par la bascule, les cartes ne le répètent pas en badge.
//
// UN SEUL CURSEUR, sous la bascule, règle l'année de toute la page. Il la
// dit : les cartes ne la répètent pas, sauf celle dont la valeur date d'une
// autre année (un module sans relevé pour l'année choisie lit le dernier
// qu'il a avant elle).
//
// LA COULEUR DIT LE SENS, comme sur Flux bilatéraux : bleu pour les
// exportations, orange pour les importations. Dans la bascule, l'onglet
// choisi prend la sienne, l'autre reste à l'encre ; la page prend celle du
// sens choisi.
//
// Totaux annuels par sens : la somme des groupes d'utilisation, exhaustifs
// par construction (même règle que le site). Valeurs en millions de FCFA.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { optionsSens } from "@/components/CommercePanel";
import { SqueletteDonnees } from "@/components/Squelette";
import { ChiffreAnime, ChipFiltre, EtatErreur, EtatVide, IconeTendance, Tapable } from "@/components/ui";
import CurseurAnnees from "@/components/CurseurAnnees";
import Icone from "@/components/Icone";
import { SegmentsCapsule } from "@/components/ListeIOS";
import MiniTendance from "@/components/MiniTendance";
import { enPanne, getJson } from "@/lib/api";
import { drapeauEmoji } from "@/lib/drapeaux";
import { fmtMFCFA } from "@/lib/format";
import { coin, FONTE, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";
import TexteDefilant from "@/components/TexteDefilant";

type CleSerie = "exports" | "imports" | "balance";
const LABELS: Record<CleSerie, string> = {
  exports: "EXPORTATIONS", imports: "IMPORTATIONS", balance: "BALANCE COMMERCIALE",
};

// Le sens de la page, sous les noms des données NACE
type Sens = "export" | "import";

// Les quatre nomenclatures de produits du rapport, de la plus synthétique à
// la plus fine — les mêmes que sur le site. Elles ne s'emboîtent pas : ce
// sont quatre lectures indépendantes du même commerce, pas les niveaux d'une
// hiérarchie. Chacune nomme sa modalité à sa façon (`champ`).
type Famille = "principaux" | "groupes" | "regroupes" | "chapitres";
const FAMILLES: { cle: Famille; label: string; champ: string; noms: string }[] = [
  { cle: "principaux", label: "Principaux",            champ: "produit",  noms: "produits" },
  { cle: "groupes",    label: "Groupes d'utilisation", champ: "groupe",   noms: "groupes" },
  { cle: "regroupes",  label: "Regroupés",             champ: "produit",  noms: "produits" },
  { cle: "chapitres",  label: "Chapitres SH",          champ: "chapitre", noms: "chapitres" },
];

type Point = { annee: number; valeur: number };
type DonneesNace = { disponible: boolean; annees: number[]; donnees: { export: any[]; import: any[] } };

// Somme tolérante aux trous (règle du site) : null + null reste null
const somme = (a: number | null, b: number | null) => a == null && b == null ? null : (a ?? 0) + (b ?? 0);

export default function CommerceExterieurPanel({ sensDemande, jeton }: {
  /** Le sens où se poser, ouvert depuis l'Accueil (Importations ›) ; le
      jeton change à chaque ouverture */
  sensDemande?: Sens; jeton?: string;
} = {}) {
  // Le sens de la page — la bascule du haut
  const [sens, setSens] = useState<Sens>(sensDemande ?? "export");
  useEffect(() => {
    if (sensDemande) setSens(sensDemande);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jeton]);
  const actif: CleSerie = sens === "export" ? "exports" : "imports";
  const expDir = sens === "export";
  // La couleur du sens, que toute la page prend, et son ton de sélection
  // (Android : la puce choisie)
  const couleurSens = expDir ? T.bleu : T.orange;
  const voileSens = expDir ? T.selection : T.selectionOrange;
  const [anneeSel, setAnneeSel] = useState<number | null>(null);
  const [largeurTendance, setLargeurTendance] = useState(0);

  const gu = useQuery({
    queryKey: ["nace-gu"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<DonneesNace>("/nace/groupes-utilisation"),
  });

  // ── Les produits du sens, dans la nomenclature choisie (second module) ──
  // Principaux par défaut, comme sur le site
  const [famille, setFamille] = useState<Famille>("principaux");
  const [produitChoisi, setProduitChoisi] = useState<string | null>(null);
  const [listeDepliee, setListeDepliee] = useState(false);
  const choisirFamille = (f: Famille) => {
    if (f === famille) return;
    setFamille(f); setProduitChoisi(null); setListeDepliee(false);
  };
  // La rangée de puces des nomenclatures et la place de chacune
  const pucesRef = useRef<ScrollView>(null);
  const pucesPos = useRef<Partial<Record<Famille, { x: number; largeur: number }>>>({});
  // Les quatre se chargent ensemble : changer de nomenclature est immédiat.
  // Les groupes d'utilisation sont déjà là — ils font les totaux.
  const pp = useQuery({
    queryKey: ["nace-principaux"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<any>("/nace/principaux-produits"),
  });
  const pr = useQuery({
    queryKey: ["nace-regroupes"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<any>("/nace/produits-regroupes"),
  });
  const ch = useQuery({
    queryKey: ["nace-chapitres"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<any>("/nace/chapitres"),
  });
  const requeteFamille = { principaux: pp, groupes: gu, regroupes: pr, chapitres: ch }[famille];
  const { champ, noms } = FAMILLES.find(f => f.cle === famille)!;
  // Toutes les lignes du sens, la modalité ramenée à `produit` quelle que soit
  // la nomenclature — certains postes paraissent SANS valeur une année donnée
  // (Tourteaux d'arachide à l'export 2024) : ils restent listés, seules les
  // séries et le calendrier se limitent aux lignes chiffrées
  const brutPr: any[] = useMemo(() =>
    ((requeteFamille.data as any)?.donnees?.[sens] || [])
      .map((r: any) => ({ produit: r[champ] as string, annee: r.annee as number, valeur: (r.valeur ?? null) as number | null })),
  [requeteFamille.data, sens, champ]);
  const lignesPr: any[] = useMemo(() => brutPr.filter((r: any) => r.valeur != null), [brutPr]);
  // Le calendrier des produits — en pratique celui des totaux (les mêmes
  // rapports annuels), sans garantie : le curseur du haut y cherche son année
  const anneesPr = useMemo(() =>
    [...new Set(lignesPr.map((r: any) => r.annee as number))].sort((a, b) => a - b), [lignesPr]);

  // ── Les zones géographiques du sens (troisième module) ──
  const [zone, setZone] = useState<"continent" | "region">("continent");
  const [zoneChoisie, setZoneChoisie] = useState<string | null>(null);
  const co = useQuery({
    queryKey: ["nace-continents"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<any>("/nace/continents"),
  });
  const rg = useQuery({
    queryKey: ["nace-regions"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<any>("/nace/regions"),
  });
  // Les pays partenaires — pour le top 10 de la zone en vedette
  const py = useQuery({
    queryKey: ["nace-pays"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<any>("/nace/pays"),
  });
  // Les lignes du découpage choisi, normalisées { nom, annee, valeur }
  const brutZg: { nom: string; annee: number; valeur: number | null }[] = useMemo(() => {
    const source = zone === "continent" ? co.data : rg.data;
    const cle = zone === "continent" ? "continent" : "region";
    return (source?.donnees?.[sens] || [])
      .map((r: any) => ({ nom: r[cle] as string, annee: r.annee as number, valeur: (r.valeur ?? null) as number | null }));
  }, [co.data, rg.data, zone, sens]);
  const lignesZg = useMemo(() => brutZg.filter(r => r.valeur != null), [brutZg]);
  const anneesZg = useMemo(() =>
    [...new Set(lignesZg.map(r => r.annee))].sort((a, b) => a - b), [lignesZg]);

  // Totaux annuels par sens — les groupes d'utilisation couvrent tout
  const series = useMemo<Record<CleSerie, Point[]>>(() => {
    const totaux = { export: new Map<number, number | null>(), import: new Map<number, number | null>() };
    for (const cle of ["export", "import"] as const) {
      for (const r of gu.data?.donnees?.[cle] || []) {
        totaux[cle].set(r.annee, somme(totaux[cle].get(r.annee) ?? null, r.valeur));
      }
    }
    const en = (m: Map<number, number | null>): Point[] =>
      [...m.entries()].filter(([, v]) => v != null).map(([annee, valeur]) => ({ annee, valeur: valeur! }))
        .sort((a, b) => a.annee - b.annee);
    const exports = en(totaux.export), imports = en(totaux.import);
    const balance: Point[] = exports
      .map(e => {
        const i = imports.find(x => x.annee === e.annee);
        return i ? { annee: e.annee, valeur: e.valeur - i.valeur } : null;
      })
      .filter((p): p is Point => p != null);
    return { exports, imports, balance };
  }, [gu.data]);

  // Années couvertes ; le curseur ne pointe que dedans
  const anneesSerie = useMemo(() => series.exports.map(pt => pt.annee), [series]);
  useEffect(() => {
    if (anneeSel != null && !anneesSerie.includes(anneeSel)) setAnneeSel(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneesSerie.join(",")]);

  // isLoading vaut isPending ET isFetching : une requête MISE EN PAUSE par le
  // gestionnaire hors-ligne est pending sans être fetching. Elle échappait donc
  // aux deux premières branches et tombait dans « pas de données », où l'app
  // affirmait que les indicateurs n'existent pas — alors qu'elle ne les avait
  // simplement jamais reçus. Tant qu'aucune réponse n'est arrivée, on attend.
  if (enPanne(gu)) return <EtatErreur onRetry={() => gu.refetch()} />;
  if (!gu.data) return <SqueletteDonnees />;
  if (!gu.data.disponible || series.exports.length === 0) return (
    <EtatVide texte="Commerce extérieur du Sénégal"
      sousTexte="Les indicateurs NACE seront disponibles après l'import des rapports annuels dans l'administration." />
  );

  const jusqu = (sx: Point[]) => anneeSel == null ? sx : sx.filter(pt => pt.annee <= anneeSel);
  // L'année de la page, celle du curseur. Un module qui ne l'a pas dans son
  // calendrier lit la dernière qu'il a avant elle — et sa carte dit alors
  // l'année, puisqu'elle n'est plus celle du curseur.
  const anneeRef = anneeSel ?? anneesSerie[anneesSerie.length - 1] ?? null;
  const auPlusTard = (annees: number[]) =>
    anneeRef == null ? null : annees.filter(a => a <= anneeRef).at(-1) ?? null;
  // Aucune année n'est dite par le curseur quand il s'efface, faute de deux
  const anneeCurseur = anneesSerie.length > 1 ? anneeRef : null;
  const autreAnnee = (pt: Point | null) => pt && pt.annee !== anneeCurseur ? ` · ${pt.annee}` : "";
  const serie = jusqu(series[actif]);
  const dernier = serie.at(-1) ?? null;
  const precedent = serie.length > 1 ? serie[serie.length - 2] : null;
  const delta = dernier && precedent && precedent.valeur !== 0
    ? ((dernier.valeur - precedent.valeur) / Math.abs(precedent.valeur)) * 100 : null;
  const hausse = (delta ?? 0) >= 0;
  // L'autre flux, puis la balance
  const reperes: CleSerie[] = [actif === "exports" ? "imports" : "exports", "balance"];
  const basculer = (cible: Sens) => { if (cible !== sens) setSens(cible); };

  // ── Le second module : la vedette produit et son classement ──
  const anneeRefPr = auPlusTard(anneesPr);
  const seriePrDe = (produit: string): Point[] => lignesPr
    .filter((r: any) => r.produit === produit && anneeRefPr != null && r.annee <= anneeRefPr)
    .map((r: any) => ({ annee: r.annee, valeur: r.valeur }))
    .sort((a: Point, b: Point) => a.annee - b.annee);
  // Le classement COMPLET de l'année de référence, par valeur décroissante —
  // TOUS les postes du rapport, y compris ceux sans valeur cette année-là
  // (affichés « — », relégués en fin). Le fourre-tout « Autres produits »
  // sort du classement et FERME la liste, comme sur le site : ce n'est pas
  // une modalité, mais il reste lisible en dernier. Les groupes
  // d'utilisation et les chapitres SH, exhaustifs, n'en ont pas. Plafond à
  // 100 postes, par précaution (96 chapitres SH par sens, 56 regroupés à
  // l'import).
  const lignesAnnee = brutPr
    .filter((r: any) => r.annee === anneeRefPr)
    .map((r: any) => ({ produit: r.produit as string, valeur: (r.valeur ?? null) as number | null }));
  const classement: { produit: string; valeur: number | null }[] = [
    ...lignesAnnee.filter(x => x.produit !== "Autres produits")
      .sort((a, b) => (b.valeur ?? -Infinity) - (a.valeur ?? -Infinity)),
    ...lignesAnnee.filter(x => x.produit === "Autres produits"),
  ].slice(0, 100);
  const produitActif = produitChoisi && classement.some(x => x.produit === produitChoisi)
    ? produitChoisi : classement[0]?.produit ?? null;
  const seriePr = produitActif ? seriePrDe(produitActif) : [];
  const dernierPr = seriePr.at(-1) ?? null;
  const precPr = seriePr.length > 1 ? seriePr[seriePr.length - 2] : null;
  const deltaPr = dernierPr && precPr && precPr.valeur !== 0
    ? ((dernierPr.valeur - precPr.valeur) / Math.abs(precPr.valeur)) * 100 : null;
  const haussePr = (deltaPr ?? 0) >= 0;

  // ── Le troisième module : la zone géographique en vedette ──
  const anneeRefZg = auPlusTard(anneesZg);
  const serieZgDe = (nom: string): Point[] => lignesZg
    .filter(r => r.nom === nom && anneeRefZg != null && r.annee <= anneeRefZg)
    .map(r => ({ annee: r.annee, valeur: r.valeur! }))
    .sort((a, b) => a.annee - b.annee);
  // Le classement de l'année — 6 continents ou 12 régions, tous listés,
  // « Divers » rangé à sa place comme sur le site
  const classementZg: { nom: string; valeur: number | null }[] = brutZg
    .filter(r => r.annee === anneeRefZg)
    .map(r => ({ nom: r.nom, valeur: r.valeur }))
    .sort((a, b) => (b.valeur ?? -Infinity) - (a.valeur ?? -Infinity))
    .slice(0, 20);
  const zoneActive = zoneChoisie && classementZg.some(x => x.nom === zoneChoisie)
    ? zoneChoisie : classementZg[0]?.nom ?? null;
  const serieZg = zoneActive ? serieZgDe(zoneActive) : [];
  const dernierZg = serieZg.at(-1) ?? null;
  const precZg = serieZg.length > 1 ? serieZg[serieZg.length - 2] : null;
  const deltaZg = dernierZg && precZg && precZg.valeur !== 0
    ? ((dernierZg.valeur - precZg.valeur) / Math.abs(precZg.valeur)) * 100 : null;
  const hausseZg = (deltaZg ?? 0) >= 0;

  // ── Le top 10 des pays de la zone en vedette ──
  // Un continent se choisit par le rattachement région → continent que sert
  // le backend ; une région, directement. « Autres pays » — l'agrégat des
  // partenaires hors référentiel — sort du top, comme sur le site.
  const versContinent: Record<string, string> = py.data?.continents || rg.data?.continents || {};
  const paysZone: any[] = (py.data?.donnees?.[sens] || [])
    .filter((r: any) => r.annee === anneeRefZg && r.valeur != null && r.pays !== "Autres pays" &&
      (zone === "continent" ? versContinent[r.region] === zoneActive : r.region === zoneActive))
    .sort((a: any, b: any) => b.valeur - a.valeur)
    .slice(0, 10);
  // La part se lit sur le TOTAL de la zone (« Autres pays » compris)
  const totalZone = classementZg.find(x => x.nom === zoneActive)?.valeur ?? null;

  return (
    <View style={s.rangee}>
      {/* ── La bascule du sens, puis la vedette ── */}
      <View style={s.bascule}>
        <SegmentsCapsule options={optionsSens("export", "import")} valeur={sens} onChange={c => basculer(c as Sens)} />
      </View>
      {/* Le curseur d'années, seul pour toute la page — le doigt remonte le
          temps. Bleu par défaut : il ne reçoit que l'orange des importations */}
      <CurseurAnnees annees={anneesSerie}
        valeur={anneeSel ?? anneesSerie[anneesSerie.length - 1]}
        couleur={expDir ? undefined : (T.orange as string)}
        onChange={a => setAnneeSel(a === anneesSerie[anneesSerie.length - 1] ? null : a)} />
      <View style={s.vedette}>
        <View style={s.vedetteEnTete}>
          <TexteDefilant style={s.etiquette}>
            {LABELS[actif]}{autreAnnee(dernier)}
          </TexteDefilant>
          {/* Module Sénégal uniquement — badge sans point, à la couleur du sens */}
          <View style={[s.badgePays, !expDir && s.badgePaysImport]}>
            <Text style={[s.badgePaysTexte, { color: couleurSens }]}>Sénégal</Text>
          </View>
        </View>

        {/* Le mesureur reste monté d'une bascule à l'autre */}
        <View onLayout={e => setLargeurTendance(e.nativeEvent.layout.width)}>
        <View>
        {dernier ? (
          <View style={s.nombreLigne}>
            <ChiffreAnime texte={fmtMFCFA(dernier.valeur)} style={[s.nombre, { color: couleurSens }]} />
            {delta !== null && (
              <View style={s.deltaLigne}>
                <Icone sf={hausse ? "arrow.up.right" : "arrow.down.right"}
                  materiel={hausse ? "north_east" : "south_east"}
                  taille={12} couleur={hausse ? T.vert : "#dc2626"} poids="bold" />
                <Text style={[s.deltaTexte, { color: hausse ? T.vert : "#dc2626" }]}>
                  {Math.abs(delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                </Text>
                <Text style={s.deltaContexte}>vs {precedent!.annee}</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={s.indispo}>Donnée indisponible.</Text>
        )}

        {/* La silhouette de la série entière */}
        <View style={{ marginTop: 10 }}>
          {largeurTendance > 0 && serie.length > 1 && (
            <MiniTendance valeurs={serie.map(x => x.valeur)} largeur={largeurTendance} couleur={couleurSens as string} />
          )}
        </View>
        {serie.length > 1 && (
          <View style={s.bornes}>
            <Text style={s.borne}>{serie[0].annee}</Text>
            <Text style={s.borne}>{dernier!.annee}</Text>
          </View>
        )}
        </View>
        </View>

        {/* Les repères, un par ligne : l'autre flux — le toucher bascule la
            page —, et la balance, qui se lit sans se toucher */}
        <View style={s.pied}>
          {reperes.map((cle, i) => {
            const sx = jusqu(series[cle]);
            const d = sx.at(-1) ?? null;
            const p = sx.length > 1 ? sx[sx.length - 2] : null;
            const dpc = d && p && p.valeur !== 0 ? ((d.valeur - p.valeur) / Math.abs(p.valeur)) * 100 : null;
            const contenu = (
              <>
                <TexteDefilant style={s.repereLabel}>{LABELS[cle]}</TexteDefilant>
                <Text style={s.repereValeur} numberOfLines={1}>
                  {d ? fmtMFCFA(d.valeur) : "—"}
                </Text>
                <IconeTendance delta={dpc} />
              </>
            );
            return cle === "balance" ? (
              <View key={cle} style={[s.repere, i > 0 && s.repereBord]} accessible
                accessibilityLabel={`${LABELS[cle]} : ${d ? fmtMFCFA(d.valeur) : "indisponible"}`}>
                {contenu}
              </View>
            ) : (
              <Tapable key={cle} onPress={() => basculer(cle === "exports" ? "export" : "import")}
                style={[s.repere, i > 0 && s.repereBord]} accessibilityRole="button">
                {contenu}
              </Tapable>
            );
          })}
        </View>
      </View>

      {/* ── Les produits du sens — la nomenclature en puces, puis sa carte, à
          la couleur du sens et à l'année du curseur. La rangée défile d'un
          bord à l'autre de l'écran, la puce touchée vient au centre ── */}
      <ScrollView ref={pucesRef} horizontal showsHorizontalScrollIndicator={false}
        style={s.puces} contentContainerStyle={s.pucesContenu}>
        {FAMILLES.map(f => (
          <ChipFiltre key={f.cle} compact label={f.label} actif={famille === f.cle}
            teinte={couleurSens} voile={voileSens}
            onLayout={ev => { const { x, width: la } = ev.nativeEvent.layout; pucesPos.current[f.cle] = { x, largeur: la }; }}
            onPress={() => {
              choisirFamille(f.cle);
              const p = pucesPos.current[f.cle];
              if (p) pucesRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
            }} />
        ))}
      </ScrollView>
      {produitActif == null ? (
        // La nomenclature arrive, ou n'a rien pour cette année
        <View style={s.vedette}>
          <Text style={s.indispo}>{requeteFamille.isPending ? "Chargement…" : "Donnée indisponible."}</Text>
        </View>
      ) : (
        <>
          <View style={s.vedette}>
            <View style={s.vedetteEnTete}>
              {/* Un chapitre SH se nomme longuement : il défile */}
              <TexteDefilant style={s.etiquette}>
                {produitActif.toUpperCase()}{autreAnnee(dernierPr)}
              </TexteDefilant>
            </View>

            {dernierPr ? (
              <View style={s.nombreLigne}>
                <ChiffreAnime texte={fmtMFCFA(dernierPr.valeur)} style={[s.nombre, { color: couleurSens }]} />
                {deltaPr !== null && (
                  <View style={s.deltaLigne}>
                    <Icone sf={haussePr ? "arrow.up.right" : "arrow.down.right"}
                      materiel={haussePr ? "north_east" : "south_east"}
                      taille={12} couleur={haussePr ? T.vert : "#dc2626"} poids="bold" />
                    <Text style={[s.deltaTexte, { color: haussePr ? T.vert : "#dc2626" }]}>
                      {Math.abs(deltaPr).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                    </Text>
                    <Text style={s.deltaContexte}>vs {precPr!.annee}</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={s.indispo}>Donnée indisponible.</Text>
            )}

            <View style={{ marginTop: 10 }}>
              {largeurTendance > 0 && seriePr.length > 1 && (
                <MiniTendance valeurs={seriePr.map(x => x.valeur)} largeur={largeurTendance} couleur={couleurSens as string} />
              )}
            </View>
            {seriePr.length > 1 && (
              <View style={s.bornes}>
                <Text style={s.borne}>{seriePr[0].annee}</Text>
                <Text style={s.borne}>{dernierPr!.annee}</Text>
              </View>
            )}

            {/* Les autres produits du classement, un par ligne — cinq
                d'abord, la liste entière à la demande */}
            <View style={s.pied}>
              {(() => {
                const autres = classement.filter(x => x.produit !== produitActif);
                const visibles = listeDepliee ? autres : autres.slice(0, 5);
                return (
                  <>
                    {visibles.map((x, i) => {
                      const sx = seriePrDe(x.produit);
                      const d = sx.at(-1) ?? null;
                      const p = sx.length > 1 ? sx[sx.length - 2] : null;
                      const dpc = d && p && p.valeur !== 0 ? ((d.valeur - p.valeur) / Math.abs(p.valeur)) * 100 : null;
                      return (
                        <Tapable key={x.produit}
                          onPress={() => setProduitChoisi(x.produit)}
                          style={[s.repere, i > 0 && s.repereBord]}>
                          <TexteDefilant style={s.repereLabel}>{x.produit.toUpperCase()}</TexteDefilant>
                          <Text style={s.repereValeur} numberOfLines={1}>
                            {x.valeur != null ? fmtMFCFA(x.valeur) : "—"}
                          </Text>
                          <IconeTendance delta={dpc} />
                        </Tapable>
                      );
                    })}
                    {autres.length > 5 && (
                      <Tapable
                        onPress={() => setListeDepliee(v => !v)}
                        style={[s.repere, s.repereBord, s.deplier]}>
                        <Text style={[s.deplierTexte, { color: couleurSens }]}>
                          {listeDepliee ? "Réduire la liste" : `Voir les ${autres.length - 5} autres ${noms}`}
                        </Text>
                        <Icone sf={listeDepliee ? "chevron.up" : "chevron.down"}
                          materiel={listeDepliee ? "expand_less" : "expand_more"}
                          taille={14} couleur={couleurSens} />
                      </Tapable>
                    )}
                  </>
                );
              })()}
            </View>
          </View>
        </>
      )}

      {/* ── Les zones géographiques du sens — à sa couleur, à l'année du curseur ── */}
      {zoneActive != null && (
        <>
          {/* Le découpage : continent ou région — les puces des onglets du
              haut, en plus petit, la choisie à la couleur du sens */}
          <View style={s.chipsZone}>
            {(["continent", "region"] as const).map(z => (
              <ChipFiltre key={z} compact label={z === "continent" ? "Continent" : "Région"}
                actif={zone === z} teinte={couleurSens} voile={voileSens}
                onPress={() => { if (z !== zone) { setZone(z); setZoneChoisie(null); } }} />
            ))}
          </View>

          <View style={s.vedette}>
            <View style={s.vedetteEnTete}>
              <TexteDefilant style={s.etiquette}>
                {zoneActive.toUpperCase()}{autreAnnee(dernierZg)}
              </TexteDefilant>
            </View>

            {dernierZg ? (
              <View style={s.nombreLigne}>
                <ChiffreAnime texte={fmtMFCFA(dernierZg.valeur)} style={[s.nombre, { color: couleurSens }]} />
                {deltaZg !== null && (
                  <View style={s.deltaLigne}>
                    <Icone sf={hausseZg ? "arrow.up.right" : "arrow.down.right"}
                      materiel={hausseZg ? "north_east" : "south_east"}
                      taille={12} couleur={hausseZg ? T.vert : "#dc2626"} poids="bold" />
                    <Text style={[s.deltaTexte, { color: hausseZg ? T.vert : "#dc2626" }]}>
                      {Math.abs(deltaZg).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                    </Text>
                    <Text style={s.deltaContexte}>vs {precZg!.annee}</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={s.indispo}>Donnée indisponible.</Text>
            )}

            <View style={{ marginTop: 10 }}>
              {largeurTendance > 0 && serieZg.length > 1 && (
                <MiniTendance valeurs={serieZg.map(x => x.valeur)} largeur={largeurTendance} couleur={couleurSens as string} />
              )}
            </View>
            {serieZg.length > 1 && (
              <View style={s.bornes}>
                <Text style={s.borne}>{serieZg[0].annee}</Text>
                <Text style={s.borne}>{dernierZg!.annee}</Text>
              </View>
            )}

            {/* Les autres zones du classement, une par ligne */}
            <View style={s.pied}>
              {classementZg.filter(x => x.nom !== zoneActive).map((x, i) => {
                const sx = serieZgDe(x.nom);
                const d = sx.at(-1) ?? null;
                const p = sx.length > 1 ? sx[sx.length - 2] : null;
                const dpc = d && p && p.valeur !== 0 ? ((d.valeur - p.valeur) / Math.abs(p.valeur)) * 100 : null;
                return (
                  <Tapable key={x.nom}
                    onPress={() => setZoneChoisie(x.nom)}
                    style={[s.repere, i > 0 && s.repereBord]}>
                    <TexteDefilant style={s.repereLabel}>{x.nom.toUpperCase()}</TexteDefilant>
                    <Text style={s.repereValeur} numberOfLines={1}>
                      {x.valeur != null ? fmtMFCFA(x.valeur) : "—"}
                    </Text>
                    <IconeTendance delta={dpc} />
                  </Tapable>
                );
              })}
            </View>
          </View>

          {/* Le top 10 des pays de la zone — clients ou fournisseurs */}
          {paysZone.length > 0 && (
            <View style={s.cartePays}>
              <View style={s.paysEnTete}>
                <Text style={s.paysTitre}>
                  {expDir ? "CLIENTS" : "FOURNISSEURS"}
                  <Text style={s.paysTitreZone}>  ·  {zoneActive.toUpperCase()}</Text>
                </Text>
                {totalZone != null && <Text style={[s.paysTotal, { color: couleurSens }]}>{fmtMFCFA(totalZone)}</Text>}
              </View>
              {paysZone.map((r: any, i: number) => {
                const part = totalZone ? (r.valeur / totalZone) * 100 : null;
                const drapeau = drapeauEmoji(r.code_iso2);
                return (
                  <View key={r.pays} style={[s.paysLigne, i > 0 && s.repereBord]}>
                    {/* Le podium à la couleur du sens */}
                    <View style={[s.paysRang, i < 3 && { backgroundColor: couleurSens }]}>
                      <Text style={[s.paysRangTexte, i < 3 && s.paysRangTexteTop]}>{i + 1}</Text>
                    </View>
                    {drapeau ? <Text style={s.paysDrapeau}>{drapeau}</Text> : null}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <TexteDefilant style={s.paysNom}>{r.pays}</TexteDefilant>
                      {zone === "continent" && (
                        <TexteDefilant style={s.paysRegion}>{r.region}</TexteDefilant>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={s.paysValeur} numberOfLines={1}>{fmtMFCFA(r.valeur)}</Text>
                      {part != null && (
                        <Text style={s.paysPart}>
                          {part.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const s = creerStyles(() => ({
  rangee: { paddingHorizontal: 16, marginTop: 14 },
  bascule: { marginBottom: 14 },
  // Les puces des nomenclatures : la rangée sort de la marge pour défiler
  // d'un bord à l'autre de l'écran, et se centre quand elle tient (tablette)
  puces: { marginHorizontal: -16, marginTop: 18, marginBottom: 10, flexGrow: 0 },
  pucesContenu: { flexGrow: 1, justifyContent: "center", gap: 8, paddingHorizontal: 16 },

  // La carte vedette — les styles exacts de l'accueil
  vedette: {
    backgroundColor: T.carte, borderRadius: coin(18), borderCurve: "continuous",
    paddingHorizontal: 18, paddingVertical: 16, overflow: "hidden",
    borderWidth: 1, borderColor: T.carteBord,
  },
  vedetteEnTete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  etiquette: { ...TYPO.micro, color: T.gris, flexShrink: 1 },
  badgePays: {
    backgroundColor: T.carte, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3.5,
    borderWidth: 1, borderColor: "rgba(0,79,145,0.22)",
  },
  badgePaysImport: { borderColor: "rgba(202,99,31,0.28)" },
  badgePaysTexte: { fontSize: 11, ...FONTE.gras, color: T.bleu },
  deplier: { justifyContent: "center" },
  deplierTexte: { fontSize: 12, ...FONTE.gras },
  chipsZone: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 18, marginBottom: 10 },

  // Le top 10 des pays de la zone
  cartePays: {
    backgroundColor: T.carte, borderRadius: coin(18), borderCurve: "continuous",
    paddingHorizontal: 18, paddingVertical: 14, overflow: "hidden",
    borderWidth: 1, borderColor: T.carteBord, marginTop: 12,
  },
  paysEnTete: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 10, paddingBottom: 8,
  },
  paysTitre: { ...TYPO.micro, color: T.gris, flexShrink: 1 },
  paysTitreZone: { color: T.grisClair },
  paysTotal: { fontSize: 13, ...FONTE.gras, fontVariant: ["tabular-nums"] },
  paysLigne: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  paysRang: {
    width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center",
    backgroundColor: T.voile,
  },
  paysRangTexte: { fontSize: 11, ...FONTE.gras, color: T.gris, fontVariant: ["tabular-nums"] },
  // Le chiffre sur la couleur du sens : blanc le jour, nuit sur ses tons clairs
  paysRangTexteTop: { color: T.surAccent },
  paysDrapeau: { fontSize: 16 },
  paysNom: { fontSize: 13, ...FONTE.demi, color: T.encre },
  paysRegion: { fontSize: 10.5, ...FONTE.normal, color: T.gris, marginTop: 1 },
  paysValeur: { fontSize: 13, ...FONTE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
  paysPart: { fontSize: 10.5, ...FONTE.demi, color: T.gris, marginTop: 1, fontVariant: ["tabular-nums"] },
  nombreLigne: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  nombre: { fontSize: 38, lineHeight: 44, ...FONTE.gras, color: T.bleu, letterSpacing: -1, marginTop: 8, fontVariant: ["tabular-nums"] },
  deltaLigne: { flexDirection: "row", alignItems: "center", gap: 4 },
  deltaTexte: { fontSize: 13, ...FONTE.gras, fontVariant: ["tabular-nums"] },
  deltaContexte: { fontSize: 13, ...FONTE.normal, color: T.gris, marginLeft: 2 },
  indispo: { fontSize: 12.5, ...FONTE.normal, color: T.gris, marginTop: 10 },
  bornes: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  borne: { fontSize: 10, ...FONTE.demi, color: T.gris, fontVariant: ["tabular-nums"] },

  // Les repères, un par ligne — le label à gauche, la valeur et sa tendance à droite
  pied: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  repere: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10.5 },
  repereBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  repereLabel: { flex: 1, minWidth: 0, fontSize: 9.5, ...FONTE.gras, color: T.gris, letterSpacing: 0.8 },
  repereValeur: { ...TYPO.sousTitre, color: T.encre, flexShrink: 1, fontVariant: ["tabular-nums"] },
}));
