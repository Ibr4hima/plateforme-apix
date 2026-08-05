// Commerce extérieur du Sénégal (NACE · ANSD) — la grammaire EXACTE de la
// carte vedette de l'accueil : les Exportations en vedette (micro-étiquette,
// badge « Sénégal » bleu sans point, nombre en 38 pt qui compte, variation
// vs N-1 fléchée, silhouette Skia sans axes, bornes d'années) et DEUX repères
// — Importations et Balance commerciale — la tendance en glyphe
// trending_up / down / flat teinté. Toucher un repère l'installe en vedette.
//
// Quand les Exportations sont en vedette, un SECOND module suit, en orange :
// les exportations par produits regroupés — même grammaire, le premier
// produit de l'année en vedette, les suivants en repères, et son PROPRE
// curseur d'années (le calendrier des produits n'est pas celui des totaux).
//
// Totaux annuels par sens : la somme des groupes d'utilisation, exhaustifs
// par construction (même règle que le site). Valeurs en millions de FCFA.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SqueletteDonnees } from "@/components/Squelette";
import { ChiffreAnime, EtatErreur, EtatVide, IconeTendance, Permutation, RangeeMouvante, Tapable } from "@/components/ui";
import CurseurAnnees from "@/components/CurseurAnnees";
import Icone from "@/components/Icone";
import MiniTendance from "@/components/MiniTendance";
import { getJson } from "@/lib/api";
import { drapeauEmoji } from "@/lib/drapeaux";
import { fmtMFCFA } from "@/lib/format";
import { tick } from "@/lib/haptique";
import { POLICE, T, TYPO } from "@/theme";

type CleSerie = "exports" | "imports" | "balance";
const LABELS: Record<CleSerie, string> = {
  exports: "EXPORTATIONS", imports: "IMPORTATIONS", balance: "BALANCE COMMERCIALE",
};
const ORDRE: CleSerie[] = ["exports", "imports", "balance"];

type Point = { annee: number; valeur: number };
type DonneesNace = { disponible: boolean; annees: number[]; donnees: { export: any[]; import: any[] } };

// Somme tolérante aux trous (règle du site) : null + null reste null
const somme = (a: number | null, b: number | null) => a == null && b == null ? null : (a ?? 0) + (b ?? 0);

export default function CommerceExterieurPanel() {
  const [actif, setActif] = useState<CleSerie>("exports");
  const [anneeSel, setAnneeSel] = useState<number | null>(null);
  const [largeurTendance, setLargeurTendance] = useState(0);

  const gu = useQuery({
    queryKey: ["nace-gu"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<DonneesNace>("/nace/groupes-utilisation"),
  });

  // ── Les produits regroupés du sens en vedette (second module, en orange) ──
  const [produitChoisi, setProduitChoisi] = useState<string | null>(null);
  const [anneeSelPr, setAnneeSelPr] = useState<number | null>(null);
  const [listeDepliee, setListeDepliee] = useState(false);
  const pr = useQuery({
    queryKey: ["nace-regroupes"], staleTime: 30 * 60 * 1000,
    queryFn: () => getJson<any>("/nace/produits-regroupes"),
  });
  // Le sens suit la vedette du haut : export ou import (rien en Balance)
  const sensPr = actif === "imports" ? "import" : "export";
  // Toutes les lignes du sens — certains postes paraissent SANS valeur une
  // année donnée (Tourteaux d'arachide à l'export 2024) : ils restent listés,
  // seules les séries et le calendrier se limitent aux lignes chiffrées
  const brutPr: any[] = useMemo(() => pr.data?.donnees?.[sensPr] || [], [pr.data, sensPr]);
  const lignesPr: any[] = useMemo(() => brutPr.filter((r: any) => r.valeur != null), [brutPr]);
  // Le calendrier des produits — distinct de celui des totaux, d'où son curseur
  const anneesPr = useMemo(() =>
    [...new Set(lignesPr.map((r: any) => r.annee as number))].sort((a, b) => a - b), [lignesPr]);
  useEffect(() => {
    if (anneeSelPr != null && !anneesPr.includes(anneeSelPr)) setAnneeSelPr(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneesPr.join(",")]);

  // ── Les zones géographiques (troisième module, en vert) ──
  const [zone, setZone] = useState<"continent" | "region">("continent");
  const [zoneChoisie, setZoneChoisie] = useState<string | null>(null);
  const [anneeSelZg, setAnneeSelZg] = useState<number | null>(null);
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
    return (source?.donnees?.[sensPr] || [])
      .map((r: any) => ({ nom: r[cle] as string, annee: r.annee as number, valeur: (r.valeur ?? null) as number | null }));
  }, [co.data, rg.data, zone, sensPr]);
  const lignesZg = useMemo(() => brutZg.filter(r => r.valeur != null), [brutZg]);
  const anneesZg = useMemo(() =>
    [...new Set(lignesZg.map(r => r.annee))].sort((a, b) => a - b), [lignesZg]);
  useEffect(() => {
    if (anneeSelZg != null && !anneesZg.includes(anneeSelZg)) setAnneeSelZg(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneesZg.join(",")]);

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

  if (gu.isLoading) return <SqueletteDonnees />;
  if (gu.isError) return <EtatErreur onRetry={() => gu.refetch()} />;
  if (!gu.data?.disponible || series.exports.length === 0) return (
    <EtatVide texte="Commerce extérieur du Sénégal"
      sousTexte="Les indicateurs NACE seront disponibles après l'import des rapports annuels dans l'administration." />
  );

  const jusqu = (sx: Point[]) => anneeSel == null ? sx : sx.filter(pt => pt.annee <= anneeSel);
  const serie = jusqu(series[actif]);
  const dernier = serie.at(-1) ?? null;
  const precedent = serie.length > 1 ? serie[serie.length - 2] : null;
  const delta = dernier && precedent && precedent.valeur !== 0
    ? ((dernier.valeur - precedent.valeur) / Math.abs(precedent.valeur)) * 100 : null;
  const hausse = (delta ?? 0) >= 0;
  const reperes = ORDRE.filter(c => c !== actif);

  // ── Le second module : la vedette produit et son classement ──
  const anneeRefPr = anneeSelPr ?? anneesPr[anneesPr.length - 1] ?? null;
  const seriePrDe = (produit: string): Point[] => {
    const sx = lignesPr
      .filter((r: any) => r.produit === produit)
      .map((r: any) => ({ annee: r.annee, valeur: r.valeur }))
      .sort((a: Point, b: Point) => a.annee - b.annee);
    return anneeSelPr == null ? sx : sx.filter(pt => pt.annee <= anneeSelPr);
  };
  // Le classement COMPLET de l'année de référence, par valeur décroissante —
  // TOUS les postes du rapport, y compris ceux sans valeur cette année-là
  // (affichés « — », relégués en fin). Le fourre-tout « Autres produits »
  // sort du classement et FERME la liste, comme sur le site : ce n'est pas
  // une modalité, mais il reste lisible en dernier. Plafond à 60 postes,
  // par précaution (31 à l'export, 56 à l'import).
  const lignesAnnee = brutPr
    .filter((r: any) => r.annee === anneeRefPr)
    .map((r: any) => ({ produit: r.produit as string, valeur: (r.valeur ?? null) as number | null }));
  const classement: { produit: string; valeur: number | null }[] = [
    ...lignesAnnee.filter(x => x.produit !== "Autres produits")
      .sort((a, b) => (b.valeur ?? -Infinity) - (a.valeur ?? -Infinity)),
    ...lignesAnnee.filter(x => x.produit === "Autres produits"),
  ].slice(0, 60);
  const produitActif = produitChoisi && classement.some(x => x.produit === produitChoisi)
    ? produitChoisi : classement[0]?.produit ?? null;
  const seriePr = produitActif ? seriePrDe(produitActif) : [];
  const dernierPr = seriePr.at(-1) ?? null;
  const precPr = seriePr.length > 1 ? seriePr[seriePr.length - 2] : null;
  const deltaPr = dernierPr && precPr && precPr.valeur !== 0
    ? ((dernierPr.valeur - precPr.valeur) / Math.abs(precPr.valeur)) * 100 : null;
  const haussePr = (deltaPr ?? 0) >= 0;

  // ── Le troisième module : la zone géographique en vedette ──
  const anneeRefZg = anneeSelZg ?? anneesZg[anneesZg.length - 1] ?? null;
  const serieZgDe = (nom: string): Point[] => {
    const sx = lignesZg.filter(r => r.nom === nom)
      .map(r => ({ annee: r.annee, valeur: r.valeur! }))
      .sort((a, b) => a.annee - b.annee);
    return anneeSelZg == null ? sx : sx.filter(pt => pt.annee <= anneeSelZg);
  };
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
  const paysZone: any[] = (py.data?.donnees?.[sensPr] || [])
    .filter((r: any) => r.annee === anneeRefZg && r.valeur != null && r.pays !== "Autres pays" &&
      (zone === "continent" ? versContinent[r.region] === zoneActive : r.region === zoneActive))
    .sort((a: any, b: any) => b.valeur - a.valeur)
    .slice(0, 10);
  // La part se lit sur le TOTAL de la zone (« Autres pays » compris)
  const totalZone = classementZg.find(x => x.nom === zoneActive)?.valeur ?? null;

  return (
    <View style={s.rangee}>
      {/* Le curseur d'années — le doigt remonte le temps */}
      <CurseurAnnees annees={anneesSerie}
        valeur={anneeSel ?? anneesSerie[anneesSerie.length - 1]}
        onChange={a => setAnneeSel(a === anneesSerie[anneesSerie.length - 1] ? null : a)} />
      <View style={s.vedette}>
        <View style={s.vedetteEnTete}>
          <Text style={s.etiquette} numberOfLines={1}>
            {LABELS[actif]}{dernier ? ` · ${dernier.annee}` : ""}
          </Text>
          {/* Module Sénégal uniquement — badge bleu sans point */}
          <View style={s.badgePays}>
            <Text style={s.badgePaysTexte}>Sénégal</Text>
          </View>
        </View>

        {/* Le mesureur reste monté ; la Permutation rejoue à chaque bascule */}
        <View onLayout={e => setLargeurTendance(e.nativeEvent.layout.width)}>
        <Permutation cle={actif}>
        {dernier ? (
          <View style={s.nombreLigne}>
            <ChiffreAnime texte={fmtMFCFA(dernier.valeur)} style={s.nombre} />
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
            <MiniTendance valeurs={serie.map(x => x.valeur)} largeur={largeurTendance} couleur={T.bleu as string} />
          )}
        </View>
        {serie.length > 1 && (
          <View style={s.bornes}>
            <Text style={s.borne}>{serie[0].annee}</Text>
            <Text style={s.borne}>{dernier!.annee}</Text>
          </View>
        )}
        </Permutation>
        </View>

        {/* Les repères, un par ligne — ils glissent quand l'un monte en vedette */}
        <View style={s.pied}>
          {reperes.map((cle, i) => {
            const sx = jusqu(series[cle]);
            const d = sx.at(-1) ?? null;
            const p = sx.length > 1 ? sx[sx.length - 2] : null;
            const dpc = d && p && p.valeur !== 0 ? ((d.valeur - p.valeur) / Math.abs(p.valeur)) * 100 : null;
            return (
              <RangeeMouvante key={cle}>
                <Tapable echelle={0.98}
                  onPress={() => { tick(); setActif(cle); }}
                  style={[s.repere, i > 0 && s.repereBord]}>
                  <Text style={s.repereLabel} numberOfLines={1}>{LABELS[cle]}</Text>
                  <Text style={s.repereValeur} numberOfLines={1}>
                    {d ? fmtMFCFA(d.valeur) : "—"}
                  </Text>
                  <IconeTendance delta={dpc} />
                </Tapable>
              </RangeeMouvante>
            );
          })}
        </View>
      </View>

      {/* ── Les produits regroupés du sens en vedette — en orange ── */}
      {actif !== "balance" && produitActif != null && (
        <>
          {/* Son propre curseur, en orange : le calendrier des produits */}
          <View style={{ marginTop: 18 }}>
            <CurseurAnnees annees={anneesPr}
              valeur={anneeRefPr ?? 0}
              couleur={T.orange as string} voile={T.orangeVoile as string}
              onChange={a => setAnneeSelPr(a === anneesPr[anneesPr.length - 1] ? null : a)} />
          </View>
          <View style={s.vedette}>
            <View style={s.vedetteEnTete}>
              <Text style={s.etiquette} numberOfLines={1}>
                {produitActif.toUpperCase()}{dernierPr ? ` · ${dernierPr.annee}` : ""}
              </Text>
              <View style={s.badgeProduit}>
                <Text style={s.badgeProduitTexte} numberOfLines={1}>
                  {sensPr === "export" ? "Exportations" : "Importations"}
                </Text>
              </View>
            </View>

            {dernierPr ? (
              <View style={s.nombreLigne}>
                <ChiffreAnime texte={fmtMFCFA(dernierPr.valeur)} style={[s.nombre, { color: T.orange }]} />
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
                <MiniTendance valeurs={seriePr.map(x => x.valeur)} largeur={largeurTendance} couleur={T.orange as string} />
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
                        <Tapable key={x.produit} echelle={0.98}
                          onPress={() => { tick(); setProduitChoisi(x.produit); }}
                          style={[s.repere, i > 0 && s.repereBord]}>
                          <Text style={s.repereLabel} numberOfLines={1}>{x.produit.toUpperCase()}</Text>
                          <Text style={s.repereValeur} numberOfLines={1}>
                            {x.valeur != null ? fmtMFCFA(x.valeur) : "—"}
                          </Text>
                          <IconeTendance delta={dpc} />
                        </Tapable>
                      );
                    })}
                    {autres.length > 5 && (
                      <Tapable echelle={0.98}
                        onPress={() => { tick(); setListeDepliee(v => !v); }}
                        style={[s.repere, s.repereBord, s.deplier]}>
                        <Text style={s.deplierTexte}>
                          {listeDepliee ? "Réduire la liste" : `Voir les ${autres.length - 5} autres produits`}
                        </Text>
                        <Icone sf={listeDepliee ? "chevron.up" : "chevron.down"}
                          materiel={listeDepliee ? "expand_less" : "expand_more"}
                          taille={14} couleur={T.orange} />
                      </Tapable>
                    )}
                  </>
                );
              })()}
            </View>
          </View>
        </>
      )}

      {/* ── Les zones géographiques du sens en vedette — en vert ── */}
      {actif !== "balance" && zoneActive != null && (
        <>
          {/* Son propre curseur, en vert */}
          <View style={{ marginTop: 18 }}>
            <CurseurAnnees annees={anneesZg}
              valeur={anneeRefZg ?? 0}
              couleur={T.vert as string} voile={T.vertVoile as string}
              onChange={a => setAnneeSelZg(a === anneesZg[anneesZg.length - 1] ? null : a)} />
          </View>

          {/* Le découpage : continent ou région */}
          <View style={s.chipsZone}>
            {(["continent", "region"] as const).map(z => {
              const actifZ = zone === z;
              return (
                <Tapable key={z} echelle={0.96}
                  onPress={() => { tick(); setZone(z); setZoneChoisie(null); }}
                  style={[s.chipZone, actifZ && s.chipZoneActif]}>
                  <Text style={[s.chipZoneTexte, actifZ && { color: T.vert }]}>
                    {z === "continent" ? "Continent" : "Région"}
                  </Text>
                </Tapable>
              );
            })}
          </View>

          <View style={s.vedette}>
            <View style={s.vedetteEnTete}>
              <Text style={s.etiquette} numberOfLines={1}>
                {zoneActive.toUpperCase()}{dernierZg ? ` · ${dernierZg.annee}` : ""}
              </Text>
              <View style={s.badgeZone}>
                <Text style={s.badgeZoneTexte} numberOfLines={1}>
                  {sensPr === "export" ? "Exportations" : "Importations"}
                </Text>
              </View>
            </View>

            {dernierZg ? (
              <View style={s.nombreLigne}>
                <ChiffreAnime texte={fmtMFCFA(dernierZg.valeur)} style={[s.nombre, { color: T.vert }]} />
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
                <MiniTendance valeurs={serieZg.map(x => x.valeur)} largeur={largeurTendance} couleur={T.vert as string} />
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
                  <Tapable key={x.nom} echelle={0.98}
                    onPress={() => { tick(); setZoneChoisie(x.nom); }}
                    style={[s.repere, i > 0 && s.repereBord]}>
                    <Text style={s.repereLabel} numberOfLines={1}>{x.nom.toUpperCase()}</Text>
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
                  {sensPr === "export" ? "CLIENTS" : "FOURNISSEURS"}
                  <Text style={s.paysTitreZone}>  ·  {zoneActive.toUpperCase()}</Text>
                </Text>
                {totalZone != null && <Text style={s.paysTotal}>{fmtMFCFA(totalZone)}</Text>}
              </View>
              {paysZone.map((r: any, i: number) => {
                const part = totalZone ? (r.valeur / totalZone) * 100 : null;
                const drapeau = drapeauEmoji(r.code_iso2);
                return (
                  <View key={r.pays} style={[s.paysLigne, i > 0 && s.repereBord]}>
                    <View style={[s.paysRang, i < 3 && s.paysRangTop]}>
                      <Text style={[s.paysRangTexte, i < 3 && s.paysRangTexteTop]}>{i + 1}</Text>
                    </View>
                    {drapeau ? <Text style={s.paysDrapeau}>{drapeau}</Text> : null}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.paysNom} numberOfLines={1}>{r.pays}</Text>
                      {zone === "continent" && (
                        <Text style={s.paysRegion} numberOfLines={1}>{r.region}</Text>
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

const s = StyleSheet.create({
  rangee: { paddingHorizontal: 16, marginTop: 14 },

  // La carte vedette — les styles exacts de l'accueil
  vedette: {
    backgroundColor: T.carte, borderRadius: 18, borderCurve: "continuous",
    paddingHorizontal: 18, paddingVertical: 16, overflow: "hidden",
    borderWidth: 1, borderColor: T.carteBord,
  },
  vedetteEnTete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  etiquette: { ...TYPO.micro, color: T.gris, flexShrink: 1 },
  badgePays: {
    backgroundColor: T.carte, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3.5,
    borderWidth: 1, borderColor: "rgba(0,79,145,0.22)",
  },
  badgePaysTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.bleu },
  badgeProduit: {
    backgroundColor: T.carte, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3.5,
    borderWidth: 1, borderColor: "rgba(202,99,31,0.28)",
  },
  badgeProduitTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.orange },
  deplier: { justifyContent: "center" },
  deplierTexte: { fontSize: 12, fontFamily: POLICE.gras, color: T.orange },
  badgeZone: {
    backgroundColor: T.carte, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3.5,
    borderWidth: 1, borderColor: "rgba(24,128,56,0.30)",
  },
  badgeZoneTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.vert },
  chipsZone: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 10 },
  chipZone: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure,
  },
  chipZoneActif: { backgroundColor: T.vertVoile, borderColor: "rgba(24,128,56,0.40)" },
  chipZoneTexte: { fontSize: 12.5, fontFamily: POLICE.gras, color: T.gris },

  // Le top 10 des pays de la zone
  cartePays: {
    backgroundColor: T.carte, borderRadius: 18, borderCurve: "continuous",
    paddingHorizontal: 18, paddingVertical: 14, overflow: "hidden",
    borderWidth: 1, borderColor: T.carteBord, marginTop: 12,
  },
  paysEnTete: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 10, paddingBottom: 8,
  },
  paysTitre: { ...TYPO.micro, color: T.gris, flexShrink: 1 },
  paysTitreZone: { color: T.grisClair },
  paysTotal: { fontSize: 13, fontFamily: POLICE.gras, color: T.vert, fontVariant: ["tabular-nums"] },
  paysLigne: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  paysRang: {
    width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center",
    backgroundColor: T.voile,
  },
  paysRangTop: { backgroundColor: T.vert },
  paysRangTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.gris, fontVariant: ["tabular-nums"] },
  paysRangTexteTop: { color: "#fff" },
  paysDrapeau: { fontSize: 16 },
  paysNom: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre },
  paysRegion: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 1 },
  paysValeur: { fontSize: 13, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
  paysPart: { fontSize: 10.5, fontFamily: POLICE.demi, color: T.gris, marginTop: 1, fontVariant: ["tabular-nums"] },
  nombreLigne: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  nombre: { fontSize: 38, lineHeight: 44, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -1, marginTop: 8, fontVariant: ["tabular-nums"] },
  deltaLigne: { flexDirection: "row", alignItems: "center", gap: 4 },
  deltaTexte: { fontSize: 13, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  deltaContexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.gris, marginLeft: 2 },
  indispo: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 10 },
  bornes: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  borne: { fontSize: 10, fontFamily: POLICE.demi, color: T.gris, fontVariant: ["tabular-nums"] },

  // Les repères, un par ligne — le label à gauche, la valeur et sa tendance à droite
  pied: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  repere: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10.5 },
  repereBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  repereLabel: { flex: 1, minWidth: 0, fontSize: 9.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 0.8 },
  repereValeur: { ...TYPO.sousTitre, color: T.encre, flexShrink: 1, fontVariant: ["tabular-nums"] },
});
