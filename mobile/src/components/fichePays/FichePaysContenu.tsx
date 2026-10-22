// Fiche Pays — la comparaison de deux pays, dans l'ordre des rubriques de la
// plateforme (frontend/src/app/fiche-pays) :
//
//   · LES ACCORDS signés entre les deux pays, en pastilles — la fiche de
//     l'accord au toucher ;
//   · QUATRE CHIFFRES : ce que le partenaire investit au Sénégal, ses
//     signaux, les emplois de ses projets — fDi Markets, pour une fiche
//     « Sénégal × X » seulement —, et le cumul des échanges ;
//   · LES INDICATEURS SOCIO-ÉCONOMIQUES, l'IDE en tête ;
//   · LES ÉCHANGES BILATÉRAUX : le face-à-face des deux sens et leur balance,
//     puis la composition ;
//   · LES INVESTISSEMENTS AU SÉNÉGAL (FdiSenegal).
//
// CHAQUE PAYS A SA TEINTE, partout : le bleu pour le premier, l'orange pour
// le second — celles de leurs pastilles en tête de page, qui servent de
// légende à tout l'écran. La teinte dit QUI, pas si c'est bien : ni vert ni
// rouge, importer n'est pas une faute.
//
// L'ancienne fiche montrait aussi les entreprises et les organisations
// communes ; la plateforme ne les présente pas ici, l'app non plus.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AccordSheet from "@/components/AccordSheet";
import Icone, { type NomsIcone } from "@/components/Icone";
import { Groupe } from "@/components/ListeIOS";
import { Os, SqueletteGraphe, SqueletteListe } from "@/components/Squelette";
import { ChiffreAnime, EtatErreur, EtatHorsLigne, SeparateurSection, Tapable } from "@/components/ui";
import { Drapeau } from "@/components/fdi/AtomesFdi";
import FdiSenegal from "@/components/fichePays/FdiSenegal";
import { Rubrique, Suite, pct1, type PaysFiche } from "@/components/fichePays/AtomesFiche";
import { enAttente, enPanne, getJson, horsLigne } from "@/lib/api";
import { creerStyles } from "@/lib/apparence";
import { type ProjetFdi, type Signal, fmtEntier } from "@/lib/fdi";
import { fmtUSD, fmtUnite } from "@/lib/format";
import { dePays } from "@/lib/pays";
import { coin, ECHELLE, FONTE, T } from "@/theme";
import TexteDefilant from "@/components/TexteDefilant";

type Indicateur = { code: string; libelle: string; unite: string; categorie: string };
type Cellule = { valeur: number | null; annee?: number } | null;
type Ressource = { ressource: string; valeur: number };

// ── LES QUATRE LIGNES DE L'IDE ──────────────────────────────────────────────
// Flux et stock, entrant et sortant. Elles ne viennent pas du référentiel des
// indicateurs mais de la CNUCED, par un service à part : on les déclare ici,
// avec la rubrique qui les regroupe — et qui OUVRE le tableau : une agence de
// promotion des investissements compare d'abord ce que deux pays attirent.
const CAT_IDE = "Investissements directs étrangers";
const IDE_LIGNES: Indicateur[] = [
  { code: "__ide_flux_entrant", libelle: "Flux entrants", unite: "USD", categorie: CAT_IDE },
  { code: "__ide_flux_sortant", libelle: "Flux sortants", unite: "USD", categorie: CAT_IDE },
  { code: "__ide_stock_entrant", libelle: "Stock entrant", unite: "USD", categorie: CAT_IDE },
  { code: "__ide_stock_sortant", libelle: "Stock sortant", unite: "USD", categorie: CAT_IDE },
];

/** L'icône de chaque rubrique : un repère, pas une décoration. */
const ICONES_CAT: Record<string, NomsIcone> = {
  [CAT_IDE]: { sf: "chart.line.uptrend.xyaxis", materiel: "trending_up" },
  "Démographie": { sf: "person.2", materiel: "group" },
  "Géographie": { sf: "map", materiel: "map" },
  "Économie": { sf: "building.columns", materiel: "account_balance" },
  "Commerce extérieur": { sf: "ferry", materiel: "directions_boat" },
};
const ICONE_AUTRE: NomsIcone = { sf: "chart.bar", materiel: "bar_chart" };

/** Les indicateurs dont on n'affiche pas l'année : ils ne varient pas. */
const SANS_ANNEE = new Set(["superficie"]);

/** Ce que la Fiche Pays n'affiche pas. Comme le site, la croissance du PIB :
    le taux d'une seule année, qui varie du simple au triple d'un millésime à
    l'autre — à côté de grandeurs de stock, il comparait deux conjonctures
    plutôt que deux pays. Et, sur un téléphone, les deux balances
    commerciales : elles se déduisent des importations et des exportations
    juste au-dessus. */
const EXCLUS_FICHE = new Set(["croissance_pib", "balance_marchandises", "balance_services"]);

/** Les produits montrés d'emblée dans chaque sens d'échange. */
const RESSOURCES_VISIBLES = 5;

// ── Les accords ─────────────────────────────────────────────────────────────

/** Une pastille par accord — « TBI · Sénégal × France » : le type, puis les
    parties dans l'ordre de la fiche ; un traité garde son titre. */
function Accords({ accords, a, b, onOuvrir }: {
  accords: any[]; a: PaysFiche; b: PaysFiche; onOuvrir: (ac: any) => void;
}) {
  if (!accords.length) return null;
  return (
    <View style={s.accords}>
      {accords.map(ac => {
        const tbi = (ac.type_accord || "tbi") === "tbi";
        const texte = tbi ? `${a.nom} × ${b.nom}` : ac.titre;
        const annee = ac.date_signature ? String(ac.date_signature).slice(0, 4) : null;
        return (
          <Tapable key={ac.id} onPress={() => onOuvrir(ac)} style={s.accord} accessibilityRole="button"
            accessibilityLabel={[tbi ? "Traité bilatéral d'investissement" : "Traité", texte, annee ? `signé en ${annee}` : null].filter(Boolean).join(", ")}>
            <Icone sf="signature" materiel="signature" taille={14} couleur={T.bleu} />
            <Text style={s.accordType} maxFontSizeMultiplier={ECHELLE.compact}>{tbi ? "TBI" : "Traité"}</Text>
            <Text style={s.accordPoint}>·</Text>
            <TexteDefilant style={s.accordTexte} maxFontSizeMultiplier={ECHELLE.compact}>{texte}</TexteDefilant>
          </Tapable>
        );
      })}
    </View>
  );
}

// ── Les chiffres de tête ────────────────────────────────────────────────────

/** `valeur` nulle : le chiffre charge encore. */
type Kpi = { cle: string; label: string; valeur: string | null; note: string };

/** Deux chiffres par rangée ; un chiffre seul prend la rangée. */
function Kpis({ kpis }: { kpis: Kpi[] }) {
  const rangees: Kpi[][] = [];
  for (let i = 0; i < kpis.length; i += 2) rangees.push(kpis.slice(i, i + 2));
  return (
    <View style={s.kpis}>
      {rangees.map(r => (
        <View key={r.map(k => k.cle).join("|")} style={s.kpisRangee}>
          {r.map(k => (
            <View key={k.cle} style={s.kpi} accessible
              accessibilityLabel={`${k.label} : ${k.valeur ?? "chargement"}. ${k.note}`}>
              {/* Jamais coupés : deux lignes réservées (les chiffres d'une rangée
                  restent alignés), davantage s'il le faut */}
              <Text style={s.kpiLabel} maxFontSizeMultiplier={ECHELLE.compact}>{k.label.toUpperCase()}</Text>
              {k.valeur == null ? <Os style={s.kpiOs} /> : (
                <ChiffreAnime texte={k.valeur} style={[s.kpiValeur, k.valeur === "—" && { color: T.grisClair }]} />
              )}
              <Text style={s.kpiNote} maxFontSizeMultiplier={ECHELLE.compact}>{k.note}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Les indicateurs socio-économiques ───────────────────────────────────────

/** Une ligne du tableau comparatif. LA QUESTION N'EST PAS SEULEMENT
    « COMBIEN », C'EST « QUI MÈNE, ET DE COMBIEN » : les deux valeurs, chacune
    dans la teinte de son pays, celle qui mène en gras ; entre elles, la barre
    en papillon qui part du centre vers chaque pays — la plus longue est celle
    du plus grand, et l'écart se voit avant de se lire. */
function LigneIndicateur({ ind, ca, cb, noms, premier }: {
  ind: Indicateur; ca: Cellule; cb: Cellule; noms: [string, string]; premier: boolean;
}) {
  const va = ca?.valeur ?? null, vb = cb?.valeur ?? null;
  const deux = va !== null && vb !== null;
  // LA BARRE NE S'AFFICHE QUE LÀ OÙ ELLE A UN SENS : une longueur suppose deux
  // grandeurs positives d'une même nature — ni un taux, ni une valeur
  // négative (un désinvestissement, une balance déficitaire). La règle est
  // tirée des valeurs elles-mêmes, non d'une liste d'indicateurs.
  const comparable = deux && ind.unite !== "%" && va >= 0 && vb >= 0 && (va > 0 || vb > 0);
  const max = comparable ? Math.max(va, vb) : 0;
  const mene = deux && va !== vb ? (va > vb ? 0 : 1) : null;
  const teintes = [T.bleu, T.orange];
  const largeur = (v: number) => `${Math.max((v / max) * 100, v > 0 ? 2 : 0)}%` as const;
  // LE MILLÉSIME SE DIT UNE FOIS, au bout du libellé : le même pour les deux
  // pays le plus souvent, les deux dans l'ordre des pays sinon. Aucun pour une
  // grandeur qui ne bouge pas — sous 196 722 km², une année laissait croire
  // qu'elle changerait.
  const anA = ca?.annee, anB = cb?.annee;
  const annee = SANS_ANNEE.has(ind.code) ? null
    : anA && anB ? (anA === anB ? String(anA) : `${anA} · ${anB}`)
    : anA ?? anB ?? null;
  const valeur = (v: number | null, i: 0 | 1) => (
    <Text style={[s.valeurTexte, i === 1 && { textAlign: "right" }, mene === i && { ...FONTE.gras, color: teintes[i] }, v === null && { color: T.grisClair }]}
      numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={ECHELLE.chiffre}>
      {fmtUnite(v, ind.unite, ind.code)}
    </Text>
  );
  return (
    <View style={s.indic} accessible
      accessibilityLabel={`${ind.libelle}${annee ? `, ${annee}` : ""} : ${noms[0]}, ${fmtUnite(va, ind.unite, ind.code)} ; ${noms[1]}, ${fmtUnite(vb, ind.unite, ind.code)}`}>
      {!premier && <View style={s.indicFilet} />}
      <View style={s.indicTete}>
        <Text style={s.indicLibelle} maxFontSizeMultiplier={ECHELLE.texte}>{ind.libelle}</Text>
        {annee ? <Text style={s.indicAnnee} maxFontSizeMultiplier={ECHELLE.compact}>{annee}</Text> : null}
      </View>
      <View style={s.indicValeurs}>
        {valeur(va, 0)}
        {/* Le papillon. Rien quand la ligne ne s'y prête pas — la place reste,
            pour que les colonnes ne bougent pas d'une ligne à l'autre */}
        <View style={s.papillon}>
          {comparable && [va, vb].map((v, i) => (
            <View key={i} style={[s.demi, i === 0 ? s.demiA : s.demiB]}>
              <View style={[s.barre, i === 0 ? s.demiA : s.demiB,
                { width: largeur(v), backgroundColor: teintes[i], opacity: mene === i ? 1 : 0.45 }]} />
            </View>
          ))}
        </View>
        {valeur(vb, 1)}
      </View>
    </View>
  );
}

// ── Les échanges bilatéraux ─────────────────────────────────────────────────

/** Un sens de l'échange : de qui vers qui, et combien — le montant seul,
    l'étiquette dit déjà le sens. Les pays s'y nomment par leur code ISO3
    (SEN → ZAF) : l'étiquette tient sur une ligne, les pastilles du haut
    disent déjà qui ils sont. */
function Sens({ de, vers, couleur, valeur, droite }: {
  de: PaysFiche; vers: PaysFiche; couleur: any; valeur: number; droite?: boolean;
}) {
  return (
    <View style={[s.sens, droite && s.sensDroite]} accessible
      accessibilityLabel={`${de.nom} vers ${vers.nom} : ${fmtUSD(valeur)}`}>
      <View style={[s.sensTete, droite && { justifyContent: "flex-end" }]}>
        <View style={[s.point, { backgroundColor: couleur }]} />
        <Text style={[s.sensLabel, droite && { textAlign: "right" }]} maxFontSizeMultiplier={ECHELLE.compact}>
          {`${de.code_iso3 || de.nom} → ${vers.code_iso3 || vers.nom}`.toUpperCase()}
        </Text>
      </View>
      <ChiffreAnime texte={fmtUSD(valeur)} style={[s.sensMontant, { color: couleur }, droite && { textAlign: "right" }]} />
    </View>
  );
}

/** Ce qu'un pays vend à l'autre. LA BARRE EST LINÉAIRE, en part du total du
    sens : sa longueur EST la part affichée. */
function Composition({ de, vers, couleur, voile, total, ressources }: {
  de: PaysFiche; vers: PaysFiche; couleur: any; voile: any; total: number; ressources: Ressource[];
}) {
  const [tout, setTout] = useState(false);
  const vues = tout ? ressources : ressources.slice(0, RESSOURCES_VISIBLES);
  return (
    <Groupe>
      <View style={[s.compoTete, { backgroundColor: voile }]}>
        <Drapeau iso={de.code_iso2} taille={14} />
        <TexteDefilant style={[s.compoPays, { color: couleur }]}>{de.nom}</TexteDefilant>
        <Icone sf="arrow.right" materiel="arrow_forward" taille={11} couleur={T.gris} poids="semibold" />
        <Drapeau iso={vers.code_iso2} taille={14} />
        <TexteDefilant style={s.compoPays}>{vers.nom}</TexteDefilant>
        <Text style={[s.compoTotal, { color: couleur }]} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.chiffre}>{fmtUSD(total)}</Text>
      </View>
      {ressources.length === 0 ? (
        <Text style={s.compoVide}>Aucun échange enregistré dans ce sens.</Text>
      ) : (
        <View style={s.compoCorps}>
          {vues.map(r => {
            const part = total > 0 ? r.valeur / total : 0;
            return (
              <View key={r.ressource} accessible accessibilityLabel={`${r.ressource} : ${fmtUSD(r.valeur)}, ${pct1(part)}`}>
                <View style={s.resLigne}>
                  <TexteDefilant style={s.resNom}>{r.ressource}</TexteDefilant>
                  <Text style={s.resValeur} maxFontSizeMultiplier={ECHELLE.chiffre}>{fmtUSD(r.valeur)}</Text>
                  <Text style={[s.resPart, { color: couleur }]} maxFontSizeMultiplier={ECHELLE.chiffre}>{pct1(part)}</Text>
                </View>
                <View style={s.resPiste}>
                  <View style={[s.resBarre, { width: `${Math.max(part * 100, 1)}%`, backgroundColor: couleur }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}
      <Suite reste={ressources.length - RESSOURCES_VISIBLES} tout={tout} onPress={() => setTout(v => !v)} />
    </Groupe>
  );
}

/** LES ÉCHANGES, du plus synthétique au plus fin : le face-à-face des deux
    sens, la balance au pied — le solde des deux —, puis la composition. */
function Echanges({ a, b, bilat }: { a: PaysFiche; b: PaysFiche; bilat: any }) {
  const ab: number = bilat.a_vers_b || 0, ba: number = bilat.b_vers_a || 0;
  const diff = ab - ba;
  const gagnant = diff >= 0 ? a : b;
  const teinteGagnant = diff >= 0 ? T.bleu : T.orange;
  // « en faveur de la » + le nom, que la teinte du pays met en avant
  const enFaveur = dePays(gagnant.nom).slice(0, -gagnant.nom.length);
  const resAB: Ressource[] = bilat.a_vers_b_ressources || [];
  const resBA: Ressource[] = bilat.b_vers_a_ressources || [];
  return (
    <>
      <View style={s.carte}>
        <View style={s.faceAFace}>
          <Sens de={a} vers={b} couleur={T.bleu} valeur={ab} />
          <View style={s.faceSep} />
          <Sens de={b} vers={a} couleur={T.orange} valeur={ba} droite />
        </View>
        {/* La balance, NEUTRE : la teinte reste au montant et au pays qui en
            profite — c'est là qu'elle dit quelque chose */}
        <View style={s.balance} accessible
          accessibilityLabel={diff === 0 ? "Balance équilibrée"
            : `Balance : ${fmtUSD(Math.abs(diff))} en faveur ${dePays(gagnant.nom)}`}>
          <View style={s.balanceTete}>
            <Icone sf="scalemass" materiel="balance" taille={12} couleur={T.gris} poids="semibold" />
            <Text style={s.balanceLabel} maxFontSizeMultiplier={ECHELLE.compact}>BALANCE</Text>
          </View>
          {diff === 0 ? (
            <Text style={s.balanceEquilibre}>Équilibrée</Text>
          ) : (
            <>
              <ChiffreAnime texte={`+${fmtUSD(Math.abs(diff))}`} style={[s.balanceMontant, { color: teinteGagnant }]} />
              <Text style={s.balanceTexte} maxFontSizeMultiplier={ECHELLE.texte}>
                en faveur {enFaveur}<Text style={{ ...FONTE.gras, color: teinteGagnant }}>{gagnant.nom}</Text>
              </Text>
            </>
          )}
        </View>
      </View>

      {(resAB.length > 0 || resBA.length > 0) && (
        <View style={s.rubrique}>
          <Rubrique sf="shippingbox" materiel="inventory_2" titre="Composition des échanges" />
          <View style={{ gap: 12 }}>
            <Composition de={a} vers={b} couleur={T.bleu} voile={T.bleuVoile} total={ab} ressources={resAB} />
            <Composition de={b} vers={a} couleur={T.orange} voile={T.orangeVoile} total={ba} ressources={resBA} />
          </View>
        </View>
      )}
    </>
  );
}

// ── La fiche ────────────────────────────────────────────────────────────────

export default function FichePaysContenu({ a, b, senId }: { a: PaysFiche; b: PaysFiche; senId: number | null }) {
  const [accordOuvert, setAccordOuvert] = useState<any>(null);
  const ids = `${a.id},${b.id}`;

  const qComp = useQuery({
    queryKey: ["fiche-pays", "comparaison", ids],
    queryFn: () => getJson<any>(`/statistiques/comparaison?pays=${ids}`),
  });
  // LE STOCK À CÔTÉ DU FLUX : le flux est ce qui est entré une année — il
  // peut être négatif, et varie du simple au décuple —, le stock tout ce qui
  // a été accumulé. Sur le seul flux, on comparait deux années ; sur le
  // stock, deux histoires.
  const qFlux = useQuery({
    queryKey: ["fiche-pays", "ide-flux", ids],
    queryFn: () => getJson<any>(`/statistiques/ide_flux?pays=${ids}`),
  });
  const qStock = useQuery({
    queryKey: ["fiche-pays", "ide-stock", ids],
    queryFn: () => getJson<any>(`/statistiques/ide_flux?pays=${ids}&indicateur=stock`),
  });
  const qBilat = useQuery({
    queryKey: ["fiche-pays", "bilateral", a.id, b.id],
    queryFn: () => getJson<any>(`/statistiques/commerce/bilateral?pays_a=${a.id}&pays_b=${b.id}`),
  });
  // fDi Markets : seulement pour une fiche « Sénégal × X »
  const partenaire = senId == null ? null : a.id === senId ? b : b.id === senId ? a : null;
  const senegal = partenaire ? (partenaire.id === a.id ? b : a) : null;
  const qFdi = useQuery({
    queryKey: ["fiche-pays", "fdi", partenaire?.id],
    queryFn: () => getJson<{ projets: ProjetFdi[]; signaux: Signal[] }>(`/fdi/public/fiche-pays?partenaire_id=${partenaire!.id}`),
    enabled: partenaire != null,
  });

  const bilat = qBilat.data;
  const accords: any[] = bilat?.accords || [];
  const totalEchanges = (bilat?.a_vers_b || 0) + (bilat?.b_vers_a || 0);
  const periode = bilat?.annee_min ? `${bilat.annee_min}–${bilat.annee_max}` : "";
  const avecEchanges = !!bilat && totalEchanges > 0;

  // ── Les quatre chiffres. Ceux de fDi Markets sont les sommes des listes de
  // la dernière section : chaque chiffre du haut s'y retrouve ligne à ligne.
  // Hors d'une fiche « Sénégal × X », il n'y a pas de relevé à lire : seul
  // reste le cumul des échanges.
  const projets = qFdi.data?.projets ?? [];
  const signaux = qFdi.data?.signaux ?? [];
  const capex = projets.reduce((t, p) => t + (p.capex_musd ?? 0), 0);
  const emplois = projets.reduce((t, p) => t + (p.emplois ?? 0), 0);
  // Une réponse qui attend laisse son chiffre en squelette — jamais un « — »
  // qui dirait, à tort, qu'il n'y a rien
  const fdiPret = !enAttente(qFdi);
  const kpiEchanges: Kpi = {
    cle: "echanges", label: "Échanges bilatéraux",
    valeur: enAttente(qBilat) ? null : avecEchanges ? fmtUSD(totalEchanges) : "—",
    note: periode ? `cumul ${periode}` : "cumul des flux connus",
  };
  const kpis: Kpi[] = partenaire ? [
    { cle: "capex", label: "Montant des investissements",
      valeur: fdiPret ? (capex > 0 ? fmtUSD(capex * 1e6) : "—") : null,
      note: `${partenaire.nom} → ${senegal!.nom}` },
    // Le Sénégal, l'Afrique de l'Ouest ou le continent : une note d'une ligne
    // les dit ensemble — le détail est dans la fiche de chaque signal
    { cle: "signaux", label: "Signaux d'investissement",
      valeur: fdiPret ? (signaux.length ? fmtEntier(signaux.length) : "—") : null,
      note: `${partenaire.nom} → Afrique` },
    { cle: "emplois", label: "Emplois créés",
      valeur: fdiPret ? (emplois > 0 ? fmtEntier(emplois) : "—") : null,
      note: projets.length ? `${fmtEntier(projets.length)} ${projets.length > 1 ? "projets" : "projet"}` : "projets annoncés" },
    kpiEchanges,
  ] : [kpiEchanges];

  // ── Les indicateurs, rubrique par rubrique, l'IDE en tête
  const cellule = (pid: number, code: string): Cellule => {
    const k = String(pid);
    if (code === "__ide_flux_entrant") return qFlux.data?.[k]?.entrant || null;
    if (code === "__ide_flux_sortant") return qFlux.data?.[k]?.sortant || null;
    if (code === "__ide_stock_entrant") return qStock.data?.[k]?.entrant || null;
    if (code === "__ide_stock_sortant") return qStock.data?.[k]?.sortant || null;
    return qComp.data?.valeurs?.[k]?.[code] || null;
  };
  const inds: Indicateur[] = [
    ...IDE_LIGNES,
    ...((qComp.data?.indicateurs || []) as Indicateur[]).filter(i => !EXCLUS_FICHE.has(i.code)),
  ];
  // Une ligne sans valeur ni d'un côté ni de l'autre ne dit rien : elle se
  // retire, et la rubrique avec elle si elle n'a plus rien à montrer
  const cats: string[] = [];
  const parCat: Record<string, Indicateur[]> = {};
  inds.forEach(ind => {
    if (cellule(a.id, ind.code)?.valeur == null && cellule(b.id, ind.code)?.valeur == null) return;
    const c = ind.categorie || "Autres";
    if (!parCat[c]) { parCat[c] = []; cats.push(c); }
    parCat[c].push(ind);
  });
  // Les trois sources arrivent ensemble, pour que les lignes de l'IDE ne
  // s'insèrent pas en tête après coup — sauf hors ligne : ce qui est en cache
  // se montre sans attendre le reste
  const indicateursEnAttente = [qComp, qFlux, qStock].some(q => enAttente(q) && !horsLigne(q));

  return (
    <View style={s.page}>
      <Accords accords={accords} a={a} b={b} onOuvrir={setAccordOuvert} />
      <Kpis kpis={kpis} />

      {/* ── Indicateurs socio-économiques ── */}
      <View style={s.section}>
        <SeparateurSection titre="INDICATEURS SOCIO-ÉCONOMIQUES" couleur={T.bleu as string} />
        {enPanne(qComp) ? (
          <EtatErreur onRetry={() => { qComp.refetch(); qFlux.refetch(); qStock.refetch(); }} />
        ) : horsLigne(qComp) ? (
          <EtatHorsLigne />
        ) : indicateursEnAttente ? (
          <View style={s.squelette}><SqueletteListe n={3} /></View>
        ) : cats.length === 0 ? (
          <Text style={s.aucun}>Aucun indicateur disponible pour ces deux pays.</Text>
        ) : (
          cats.map((cat, ci) => (
            <View key={cat} style={ci > 0 ? s.rubrique : undefined}>
              <Rubrique {...(ICONES_CAT[cat] ?? ICONE_AUTRE)} titre={cat} />
              <Groupe>
                {parCat[cat].map((ind, i) => (
                  <LigneIndicateur key={ind.code} ind={ind} noms={[a.nom, b.nom]} premier={i === 0}
                    ca={cellule(a.id, ind.code)} cb={cellule(b.id, ind.code)} />
                ))}
              </Groupe>
            </View>
          ))
        )}
      </View>

      {/* ── Échanges bilatéraux ── */}
      {enAttente(qBilat) && !horsLigne(qBilat) ? (
        <View style={[s.section, s.squelette]}><SqueletteGraphe /></View>
      ) : avecEchanges ? (
        <View style={s.section}>
          <SeparateurSection titre={`ÉCHANGES BILATÉRAUX${periode ? ` · ${periode}` : ""}`} couleur={T.bleu as string} />
          <Echanges a={a} b={b} bilat={bilat} />
        </View>
      ) : null}

      {/* ── Investissements au Sénégal (fDi Markets) ── */}
      {partenaire && senegal && qFdi.data && (
        <View style={s.section}>
          <FdiSenegal senegal={senegal} projets={projets} signaux={signaux} />
        </View>
      )}

      {accordOuvert && <AccordSheet accord={accordOuvert} onClose={() => setAccordOuvert(null)} />}
    </View>
  );
}

const s = creerStyles(() => ({
  page: { paddingHorizontal: 16 },
  section: { marginTop: 30 },
  rubrique: { marginTop: 20 },
  aucun: { fontSize: 13, ...FONTE.normal, color: T.gris, textAlign: "center", paddingVertical: 18 },
  // Les squelettes portent leurs propres marges d'écran
  squelette: { marginHorizontal: -16 },

  // Les accords — les pastilles du bandeau du site, posées sur la page
  accords: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  accord: {
    flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%",
    backgroundColor: T.carte, borderRadius: 999, borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord,
    paddingHorizontal: 13, paddingVertical: 7,
    shadowColor: "#0B1220", shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  accordType: { fontSize: 12.5, ...FONTE.gras, color: T.bleu, letterSpacing: 0.4 },
  accordPoint: { fontSize: 12.5, ...FONTE.normal, color: T.grisClair },
  accordTexte: { flexShrink: 1, fontSize: 12.5, ...FONTE.demi, color: T.encre },

  // Les chiffres de tête — le gabarit des cartes de l'app
  kpis: { gap: 10 },
  kpisRangee: { flexDirection: "row", gap: 10 },
  kpi: {
    flex: 1, minWidth: 0, backgroundColor: T.carte, borderRadius: coin(16), borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord,
    paddingHorizontal: 14, paddingTop: 13, paddingBottom: 12,
  },
  // Deux lignes réservées : les chiffres d'une même rangée restent alignés
  kpiLabel: { fontSize: 9.5, lineHeight: 13, minHeight: 26, ...FONTE.gras, color: T.gris, letterSpacing: 0.9 },
  kpiValeur: { fontSize: 22, lineHeight: 28, ...FONTE.gras, color: T.encre, letterSpacing: -0.5, marginTop: 6, fontVariant: ["tabular-nums"] },
  kpiOs: { height: 20, width: "62%", marginTop: 10, marginBottom: 4, borderRadius: 6 },
  kpiNote: { fontSize: 11, lineHeight: 15, ...FONTE.normal, color: T.gris, marginTop: 4 },

  // Une ligne du tableau comparatif
  indic: { paddingHorizontal: 16, paddingVertical: 11 },
  indicFilet: { position: "absolute", top: 0, left: 16, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: T.voileFort },
  indicTete: { flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 6 },
  indicLibelle: { flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 18, ...FONTE.demi, color: T.encre },
  indicAnnee: { fontSize: 11, ...FONTE.normal, color: T.gris, fontVariant: ["tabular-nums"] },
  indicValeurs: { flexDirection: "row", alignItems: "center", gap: 10 },
  // Des colonnes de largeur fixe : le centre du papillon reste au même
  // endroit d'une ligne à l'autre
  valeurTexte: { width: 100, fontSize: 14, lineHeight: 19, ...FONTE.demi, color: T.encre, fontVariant: ["tabular-nums"] },
  papillon: { flex: 1, height: 19, flexDirection: "row", alignItems: "center", gap: 3 },
  demi: { flex: 1, height: 8, flexDirection: "row", backgroundColor: T.filet, overflow: "hidden" },
  demiA: { justifyContent: "flex-end", borderTopLeftRadius: 999, borderBottomLeftRadius: 999, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  demiB: { justifyContent: "flex-start", borderTopRightRadius: 999, borderBottomRightRadius: 999, borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
  barre: { height: "100%" },

  // Le face-à-face des échanges
  carte: {
    backgroundColor: T.carte, borderRadius: coin(16), borderCurve: "continuous", overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord,
  },
  faceAFace: { flexDirection: "row", gap: 14, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 14 },
  faceSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.voileFort },
  sens: { flex: 1, minWidth: 0 },
  sensDroite: { alignItems: "flex-end" },
  sensTete: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  point: { width: 8, height: 8, borderRadius: 4, marginTop: 2.5 },
  sensLabel: { flexShrink: 1, fontSize: 9.5, lineHeight: 13, ...FONTE.gras, color: T.gris, letterSpacing: 0.8 },
  sensMontant: { fontSize: 22, lineHeight: 28, ...FONTE.gras, letterSpacing: -0.5, marginTop: 7, fontVariant: ["tabular-nums"] },
  balance: {
    alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 13,
    backgroundColor: T.carteDouce, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.voileFort,
  },
  balanceTete: { flexDirection: "row", alignItems: "center", gap: 6 },
  balanceLabel: { fontSize: 9.5, ...FONTE.gras, color: T.gris, letterSpacing: 1.2 },
  balanceMontant: { fontSize: 19, lineHeight: 24, ...FONTE.gras, letterSpacing: -0.3, marginTop: 5, fontVariant: ["tabular-nums"] },
  balanceEquilibre: { fontSize: 15, ...FONTE.gras, color: T.encre, marginTop: 6 },
  balanceTexte: { fontSize: 11.5, lineHeight: 16, ...FONTE.normal, color: T.gris, marginTop: 2, textAlign: "center" },

  // La trajectoire

  // La composition
  compoTete: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  compoPays: { flexShrink: 1, fontSize: 13, ...FONTE.gras, color: T.encre },
  compoTotal: { marginLeft: "auto", paddingLeft: 8, fontSize: 13, ...FONTE.gras, fontVariant: ["tabular-nums"] },
  compoVide: {
    fontSize: 12.5, ...FONTE.normal, color: T.gris, paddingHorizontal: 16, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.voileFort,
  },
  compoCorps: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 13,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.voileFort,
  },
  resLigne: { flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 5 },
  resNom: { flex: 1, minWidth: 0, fontSize: 12.5, ...FONTE.demi, color: T.encre },
  resValeur: { fontSize: 12.5, ...FONTE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
  resPart: { width: 50, textAlign: "right", fontSize: 11.5, ...FONTE.gras, fontVariant: ["tabular-nums"] },
  resPiste: { height: 6, backgroundColor: T.filet, borderRadius: 99, overflow: "hidden" },
  resBarre: { height: "100%", borderRadius: 99 },
}));
