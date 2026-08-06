// Opportunités d'investissement — trois lentilles sur le même sujet, en chips
// colorées (le pattern des types de zones) : Banque de projets, Potentialités
// par zone, Avantages & incitations. Chaque chip porte son compteur — la
// recherche montre immédiatement où se trouvent les résultats.
//
// Banque de projets en cartes au gabarit de la plateforme (contour fin, rangée
// Région | Département sous filet) ; potentialités par niveau territorial
// (4 cartes compteur puis fiches groupées par rattachement) ; avantages &
// incitations par secteur économique (3 cartes compteur puis activités
// groupées par branche).
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useNaemaArbre } from "@/components/ArbreNaema";
import { ListeRapide } from "@/components/ListeRapide";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, ChipFiltre, EtatErreur, EtatVide, Tapable } from "@/components/ui";
import AvantageSheet from "@/components/AvantageSheet";
import EnTetePage from "@/components/EnTetePage";
import PotentialiteSheet, { NIVEAU_COULEURS } from "@/components/PotentialiteSheet";
import ProjetSheet from "@/components/ProjetSheet";
import { fetchTous, getJson } from "@/lib/api";
import { tick } from "@/lib/haptique";
import { useMargeBas } from "@/lib/marges";
import { POLICE, T } from "@/theme";
import { creerStyles } from "@/lib/apparence";
import { useTeinte } from "@/lib/couleurs";
import TexteDefilant from "@/components/TexteDefilant";

// Les trois lentilles — chips colorées comme les types de zones
const LENTILLES = [
  { cle: "projets",       label: "Banque de projets",       couleur: "bleu" },
  { cle: "potentialites", label: "Potentialités par zone",   couleur: "bleu" },
  { cle: "avantages",     label: "Avantages & incitations",  couleur: "bleu" },
] as const;

// Niveaux de découpage territorial des potentialités (libellés du site)
const NIVEAUX = [
  { cle: "pole",           label: "Pôles territoires", unite: "pôle",           rattachement: "Pôle" },
  { cle: "region",         label: "Régions",           unite: "région",         rattachement: "Pôle" },
  { cle: "departement",    label: "Départements",      unite: "département",    rattachement: "Région" },
  { cle: "arrondissement", label: "Arrondissements",   unite: "arrondissement", rattachement: "Département" },
] as const;

// Secteurs économiques des avantages & incitations (couleurs du site)
const SECTEURS_AVGS = [
  { cle: "primaire",   label: "Secteur Primaire",   couleur: "#004f91" },
  { cle: "secondaire", label: "Secteur Secondaire", couleur: "#ca631f" },
  { cle: "tertiaire",  label: "Secteur Tertiaire",  couleur: "#188038" },
] as const;


// « Potentialités de la région de… » → « Région de… » (règle du site)
const potTitre = (p: any) => (p.titre || "")
  .replace(/^[Pp]otentialités?\s+(de\s+l['’]|de\s+la\s+|de\s+le\s+|du\s+|de\s+)/i, "")
  .replace(/^(.)/, (_: string, c: string) => c.toUpperCase());

// ── La carte de projet — le gabarit de la plateforme ─────────────────────────
function CarteProjet({ p, onPress }: { p: any; onPress: () => void }) {
  return (
    <Tapable onPress={onPress} echelle={0.985} style={s.carte}>
      <View style={s.carteCorps}>
        <Text style={s.titre} numberOfLines={2}>{p.titre_projet}</Text>
        {p.pole_nom ? <TexteDefilant style={s.sousTitre} texte={p.pole_nom} /> : null}
        <View style={s.faits}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.faitLabel}>RÉGION</Text>
            <TexteDefilant style={[s.faitVal, !p.region_nom && { color: T.grisClair }]} texte={p.region_nom || "—"} />
          </View>
          <View style={s.faitSep} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.faitLabel}>DÉPARTEMENT</Text>
            <TexteDefilant style={[s.faitVal, !p.departement_nom && { color: T.grisClair }]} texte={p.departement_nom || "—"} />
          </View>
        </View>
      </View>
    </Tapable>
  );
}

// Card compteur (niveau territorial ou secteur économique)
function CarteCompteur({ couleur, label, valeur, unite, sousLigne, pct, actif, onPress, largeur }: {
  couleur: string; label: string; valeur: number; unite: string; sousLigne: string; pct: number;
  actif: boolean; onPress?: () => void; largeur?: any;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [s.compteur, largeur, actif && { borderColor: `${couleur}88`, borderWidth: 1.5 }, pressed && { transform: [{ scale: 0.99 }] }, !onPress && { opacity: 0.55 }]}>
      <View style={s.compteurEntete}>
        <View style={[s.compteurPoint, { backgroundColor: couleur }]} />
        {/* Un simple Text : depuis que les cartes tiennent toute la largeur,
            ces intitulés ne se coupent plus — rien à faire défiler ici */}
        <Text style={[s.compteurLabel, { color: couleur }]} numberOfLines={1}>{label.toUpperCase()}</Text>
      </View>
      {/* « 126 arrondissements » : sans plancher de rétraction, l'unité
          poussait le nombre et sortait de la carte. Le nombre garde sa place
          (il porte l'information), l'unité se rétracte et se coupe. */}
      <View style={s.compteurValeurs}>
        <Text style={[s.compteurValeur, { color: valeur > 0 ? T.encre : T.grisClair }]}
          numberOfLines={1}>{valeur || "—"}</Text>
        <Text style={s.compteurUnite} numberOfLines={1}>{unite}{valeur > 1 ? "s" : ""}</Text>
      </View>
      <View style={s.compteurBarFond}>
        <View style={[s.compteurBar, { width: `${Math.max(pct > 0 ? 4 : 0, pct)}%`, backgroundColor: couleur }]} />
      </View>
      <Text style={s.compteurSous} numberOfLines={1}>{sousLigne}</Text>
    </Pressable>
  );
}

// Bandeau de rattachement (pôle / région / branche…) au-dessus d'un groupe
function Bandeau({ couleur, surtitre, titre, count }: { couleur: string; surtitre: string; titre: string; count: number }) {
  return (
    <View style={[s.bandeau, { borderColor: `${couleur}22`, backgroundColor: `${couleur}0A` }]}>
      <View style={[s.bandeauTuile, { borderColor: `${couleur}33` }]}>
        <Text style={[s.bandeauCompte, { color: couleur }]}>{count}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.bandeauSur, { color: couleur }]}>{surtitre.toUpperCase()}</Text>
        <TexteDefilant style={s.bandeauTitre} texte={titre} />
      </View>
    </View>
  );
}

// Tuile d'une fiche (potentialité ou activité) dans un groupe
function Tuile({ couleur, titre, droite, onPress, dernier }: { couleur: string; titre: string; droite?: string | null; onPress: () => void; dernier: boolean }) {
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => [s.tuile, !dernier && s.tuileBord, pressed && { backgroundColor: T.blocFond }]}>
      <View style={[s.tuilePoint, { backgroundColor: couleur }]} />
      <TexteDefilant style={s.tuileTitre} texte={titre} />
      {droite ? <Text style={s.tuileDroite}>{droite}</Text> : null}
    </Pressable>
  );
}

export default function Opportunites() {
  // Les couleurs de secteur et de niveau sont écrites en dur : la nuit, elles
  // passent par leur équivalent clair, sans quoi le bleu profond disparaît
  const teinte = useTeinte();
  const margeBas = useMargeBas();
  const { width } = useWindowDimensions();
  const [vue, setVue] = useState("projets");
  const [q, setQ] = useState("");
  const [niveauSel, setNiveauSel] = useState<string | null>(null);
  const [secteurSel, setSecteurSel] = useState<string | null>(null);
  const [projetOuvert, setProjetOuvert] = useState<any>(null);
  const [potOuverte, setPotOuverte] = useState<any>(null);
  const [avgOuvert, setAvgOuvert] = useState<any>(null);
  const chipsRef = useRef<ScrollView>(null);
  const chipsPos = useRef<Record<string, { x: number; largeur: number }>>({});
  // Le référentiel NAEMA nourrit les compteurs d'activités des avantages
  const { secteurs, branches, activites } = useNaemaArbre();


  const projetsQ = useQuery({ queryKey: ["projets"], queryFn: () => fetchTous("/projets") });
  const potsQ    = useQuery({ queryKey: ["potentialites"], queryFn: () => fetchTous("/opportunites/potentialites") });
  const avgsQ    = useQuery({ queryKey: ["avantages"], queryFn: () => fetchTous("/opportunites/avantages") });
  const { data: refAvantages } = useQuery({ queryKey: ["ref-atouts"], queryFn: () => getJson<any[]>("/ref-potentialites/flat"), staleTime: Infinity });
  const { data: poles }  = useQuery({ queryKey: ["zones-poles"], queryFn: () => getJson<any[]>("/zones-types/poles"), staleTime: Infinity });
  const { data: regions } = useQuery({ queryKey: ["ref", "regions"], queryFn: () => getJson<any[]>("/entreprises/ref/regions"), staleTime: Infinity });
  const { data: departements } = useQuery({ queryKey: ["ref", "departements"], queryFn: () => getJson<any[]>("/entreprises/ref/departements"), staleTime: Infinity });
  const { data: arrondissements } = useQuery({ queryKey: ["ref", "arrondissements"], queryFn: () => getJson<any[]>("/entreprises/ref/arrondissements"), staleTime: Infinity });
  const { data: refAvgTypes } = useQuery({ queryKey: ["ref-avg-types"], queryFn: () => getJson<any[]>("/ref-avantages"), staleTime: Infinity });

  const projets: any[] = projetsQ.data || [];
  const pots: any[]    = potsQ.data || [];
  const avgs: any[]    = avgsQ.data || [];
  const requete = q.trim().toLowerCase();

  // ── Projets filtrés (règle du site : titre ou porteur + barre latérale) ──
  const projetsFiltres = useMemo(() => {
    let liste = projets;
    if (requete) liste = liste.filter((p: any) =>
      (p.titre_projet || "").toLowerCase().includes(requete) ||
      (p.porteur_projet || "").toLowerCase().includes(requete));
    return liste;
  }, [projets, requete]);

  // ── Potentialités filtrées (titre, zone, description + barre latérale) ──
  const potsFiltres = useMemo(() => {
    let liste = pots;
    if (requete) liste = liste.filter((p: any) =>
      [p.titre, p.description, p.pole_nom, p.region_nom, p.departement_nom, p.arrondissement_nom]
        .some(x => (x || "").toLowerCase().includes(requete)));
    return liste;
  }, [pots, requete]);

  // ── Avantages filtrés (règle du site : tous les mots + barre latérale) ──
  const avgsFiltres = useMemo(() => {
    let liste = avgs;
    if (requete) {
      const mots = requete.split(/\s+/).filter(m => m.length > 1);
      liste = liste.filter((a: any) => {
        const texte = [a.activite_nom, a.secteur_nom, a.branche_nom, ...(a.selections || []).map((x: any) => x.type_libelle)]
          .filter(Boolean).join(" ").toLowerCase();
        return mots.every(m => texte.includes(m));
      });
    }
    // Matching par ids au singulier (a.secteur_id / branche_id / activite_id), règle du site
    return liste;
  }, [avgs, requete]);

  // Totaux territoriaux des cards de niveau
  const totauxNiveaux: Record<string, number> = {
    pole: (poles || []).length, region: (regions || []).length,
    departement: (departements || []).length, arrondissement: (arrondissements || []).length,
  };

  // Rattachement territorial d'une fiche de potentialité (règles du site)
  const groupeDe = (p: any, niveau: string): string => {
    if (niveau === "region") {
      return (poles || []).find((x: any) => (x.localisation || "").includes(p.region_nom || ""))?.pole_territoire || "Autres";
    }
    if (niveau === "departement") {
      if (p.region_nom) return p.region_nom;
      const dep = (departements || []).find((d: any) => d.nom === p.departement_nom);
      return (regions || []).find((r: any) => r.id === dep?.region_id)?.nom || "Autres";
    }
    if (p.departement_nom) return p.departement_nom;
    const arr = (arrondissements || []).find((x: any) => x.nom === p.arrondissement_nom);
    return (departements || []).find((d: any) => d.id === arr?.departement_id)?.nom || "Autres";
  };

  const chargement = vue === "projets" ? projetsQ.isLoading : vue === "potentialites" ? potsQ.isLoading : avgsQ.isLoading;
  const enErreur = vue === "projets" ? projetsQ.isError : vue === "potentialites" ? potsQ.isError : avgsQ.isError;
  const recharger = vue === "projets" ? projetsQ.refetch : vue === "potentialites" ? potsQ.refetch : avgsQ.refetch;
  const pret = !chargement && !enErreur;
  const cap = width >= 700 ? { width: "100%" as const, maxWidth: 680, alignSelf: "center" as const } : null;

  const comptes: Record<string, number> = {
    projets: projetsFiltres.length, potentialites: potsFiltres.length, avantages: avgsFiltres.length,
  };

  // L'en-tête est ancré hors du défilement ; les chips suivent le contenu
  const entete = (
    <EnTetePage titre="Opportunités d'investissement"
      recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }} />
  );

  const hero = (
    <>
      {/* Les trois lentilles en chips colorées, compteur en pastille */}
      <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }} contentContainerStyle={[s.chipsRangee, cap]}>
        {LENTILLES.map(l => {
          const actif = vue === l.cle;
          return (
            // Potentialités et Avantages portent déjà leurs totaux dans les
            // cartes de la vue : le répéter dans l'onglet n'apprend rien
            <ChipFiltre key={l.cle} label={l.label} actif={actif}
              compte={pret && l.cle === "projets" ? comptes[l.cle] : null}
              onLayout={ev => { const { x, width: la } = ev.nativeEvent.layout; chipsPos.current[l.cle] = { x, largeur: la }; }}
              onPress={() => {
                setVue(l.cle); setNiveauSel(null); setSecteurSel(null);
                // Centre la chip choisie : les voisines restent visibles des deux côtés
                const p = chipsPos.current[l.cle];
                if (p) chipsRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
              }} />
          );
        })}
      </ScrollView>
    </>
  );

  const vide = chargement ? <SqueletteListe />
    : enErreur ? <EtatErreur onRetry={() => recharger()} />
    : <EtatVide texte="Aucun résultat ne correspond." />;

  // ── Banque de projets : liste de cartes ──
  if (vue === "projets") {
    return (
      <View style={{ flex: 1, backgroundColor: T.fond }}>
        {entete}
        <ListeRapide
          style={{ backgroundColor: T.fond }}
          data={chargement || enErreur ? [] : projetsFiltres}
          keyExtractor={(p: any) => String(p.id)}
          renderItem={({ item, index }: any) => (
            <Apparition index={Math.min(index, 8)} style={[s.rangee, cap]}>
              <CarteProjet p={item} onPress={() => setProjetOuvert(item)} />
            </Apparition>
          )}
          contentContainerStyle={{ paddingBottom: margeBas }}
          ListHeaderComponentStyle={{ marginBottom: 14 }}
          refreshing={projetsQ.isRefetching} onRefresh={projetsQ.refetch}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={hero}
          ListEmptyComponent={vide}
        />
        {projetOuvert && <ProjetSheet projet={projetOuvert} onClose={() => setProjetOuvert(null)} />}
      </View>
    );
  }

  // ── Potentialités par zone : cards de niveau + fiches groupées ──
  if (vue === "potentialites") {
    const fichesNiveau = niveauSel ? potsFiltres.filter((p: any) => p.niveau === niveauSel) : [];
    const meta = NIVEAUX.find(n => n.cle === niveauSel);
    const couleur = niveauSel ? teinte(NIVEAU_COULEURS[niveauSel]) : T.bleu;
    // Groupes par rattachement (les pôles restent en un seul bloc)
    const groupes: { cle: string; fiches: any[] }[] = [];
    if (niveauSel === "pole") {
      if (fichesNiveau.length) groupes.push({ cle: "Pôles territoires", fiches: fichesNiveau });
    } else if (niveauSel) {
      for (const p of fichesNiveau) {
        const cle = groupeDe(p, niveauSel);
        let g = groupes.find(x => x.cle === cle);
        if (!g) { g = { cle, fiches: [] }; groupes.push(g); }
        g.fiches.push(p);
      }
      groupes.sort((a, b) => a.cle.localeCompare(b.cle, "fr"));
    }
    return (
      <View style={{ flex: 1, backgroundColor: T.fond }}>
        {entete}
        <Animated.ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: margeBas }} keyboardShouldPersistTaps="handled">
          {hero}
          {chargement || enErreur ? vide : (
            <View style={[{ paddingHorizontal: 16, marginTop: 14 }, cap]}>
              <View style={s.grilleCompteurs}>
                {NIVEAUX.map(n => {
                  const count = pots.filter((p: any) => p.niveau === n.cle).length;
                  const total = totauxNiveaux[n.cle] || 0;
                  const pct = total > 0 ? Math.round(count / total * 100) : 0;
                  return (
                    <CarteCompteur key={n.cle} couleur={teinte(NIVEAU_COULEURS[n.cle])} label={n.label}
                      valeur={total} unite={n.unite} pct={pct}
                      sousLigne={count > 0 ? `${count} fiche${count > 1 ? "s" : ""} définie${count > 1 ? "s" : ""} · ${pct} %` : "Aucune fiche définie"}
                      actif={niveauSel === n.cle}
                      onPress={count > 0 ? () => { tick(); setNiveauSel(niveauSel === n.cle ? null : n.cle); } : undefined} />
                  );
                })}
              </View>
              {niveauSel && meta && groupes.map(g => (
                <View key={g.cle} style={{ marginTop: 18 }}>
                  <Bandeau couleur={couleur} count={g.fiches.length}
                    surtitre={niveauSel === "pole" ? "Niveau territorial" : meta.rattachement} titre={g.cle} />
                  <View style={s.groupe}>
                    {g.fiches.map((p: any, i: number) => {
                      const nbActs = (p.activite_ids || []).length;
                      return (
                        <Tuile key={p.id} couleur={couleur} titre={potTitre(p)}
                          droite={nbActs > 0 ? `${nbActs} activité${nbActs > 1 ? "s" : ""}` : null}
                          onPress={() => setPotOuverte(p)} dernier={i === g.fiches.length - 1} />
                      );
                    })}
                  </View>
                </View>
              ))}
              {niveauSel && groupes.length === 0 && (
                <EtatVide texte="Aucune fiche ne correspond." />
              )}
            </View>
          )}
        </Animated.ScrollView>
        {potOuverte && <PotentialiteSheet pot={potOuverte} refAvantages={refAvantages || []} onClose={() => setPotOuverte(null)} />}
      </View>
    );
  }

  // ── Avantages & incitations : cards de secteur + activités groupées par branche ──
  const metaSect = SECTEURS_AVGS.find(x => x.cle === secteurSel);
  const itemsSect = secteurSel ? avgsFiltres.filter((a: any) => (a.secteur_nom || "").toLowerCase().includes(secteurSel)) : [];
  const branchesGroupes: { id: number; nom: string; items: any[] }[] = [];
  for (const a of itemsSect) {
    const bid = a.branche_id || 0;
    let g = branchesGroupes.find(x => x.id === bid);
    if (!g) { g = { id: bid, nom: a.branche_nom || "Sans branche", items: [] }; branchesGroupes.push(g); }
    g.items.push(a);
  }
  branchesGroupes.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return (
    <View style={{ flex: 1, backgroundColor: T.fond }}>
      {entete}
      <Animated.ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: margeBas }} keyboardShouldPersistTaps="handled">
        {hero}
        {chargement || enErreur ? vide : (
          <View style={[{ paddingHorizontal: 16, marginTop: 14 }, cap]}>
            <View style={{ gap: 10 }}>
              {SECTEURS_AVGS.map(sec => {
                const count = avgs.filter((a: any) => (a.secteur_nom || "").toLowerCase().includes(sec.cle)).length;
                const secRef = secteurs.find((x: any) => (x.nom || "").toLowerCase().includes(sec.cle));
                const braIds = new Set(branches.filter((b: any) => b.secteur_id === secRef?.id).map((b: any) => b.id));
                const nbActs = activites.filter((a: any) => braIds.has(a.branche_id)).length;
                const pct = nbActs > 0 ? Math.round(count / nbActs * 100) : 0;
                return (
                  <CarteCompteur key={sec.cle} couleur={teinte(sec.couleur)} label={sec.label}
                    valeur={nbActs} unite="activité" pct={pct}
                    sousLigne={count > 0 ? `${count} avantage${count > 1 ? "s" : ""} défini${count > 1 ? "s" : ""} · ${pct} %` : "Aucun avantage défini"}
                    actif={secteurSel === sec.cle}
                    onPress={count > 0 ? () => { tick(); setSecteurSel(secteurSel === sec.cle ? null : sec.cle); } : undefined} />
                );
              })}
            </View>
            {secteurSel && metaSect && branchesGroupes.map(bra => (
              <View key={bra.id} style={{ marginTop: 18 }}>
                <Bandeau couleur={teinte(metaSect.couleur)} count={bra.items.length} surtitre="Branche" titre={bra.nom} />
                <View style={s.groupe}>
                  {bra.items.map((a: any, i: number) => (
                    <Tuile key={a.id} couleur={teinte(metaSect.couleur)} titre={a.activite_nom}
                      onPress={() => setAvgOuvert(a)} dernier={i === bra.items.length - 1} />
                  ))}
                </View>
              </View>
            ))}
            {secteurSel && branchesGroupes.length === 0 && (
              <EtatVide texte="Aucun avantage ne correspond." />
            )}
          </View>
        )}
      </Animated.ScrollView>
      {avgOuvert && <AvantageSheet avantage={avgOuvert} onClose={() => setAvgOuvert(null)} />}
    </View>
  );
}

const s = creerStyles(() => ({
  rangee: { paddingHorizontal: 16, marginBottom: 10 },
  chipsRangee: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },

  carte: {
    backgroundColor: T.carte, borderRadius: 18,
    borderWidth: 1, borderColor: T.carteBord,
  },
  carteCorps: { flex: 1, minWidth: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 3 },
  titre: { fontSize: 15.5, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2, lineHeight: 20 },
  sousTitre: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris },
  faits: { flexDirection: "row", alignItems: "center", marginTop: 11, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  faitSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure, marginHorizontal: 16 },
  faitLabel: { fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 1, color: T.gris, marginBottom: 3 },
  faitVal: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre },

  // Les niveaux territoriaux s'emboîtent — pôle, région, département,
  // arrondissement : les empiler dit cette hiérarchie, une grille 2×2 la perd
  grilleCompteurs: { gap: 10 },
  compteur: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 15, paddingTop: 14, paddingBottom: 13, gap: 10,
  },
  compteurEntete: { flexDirection: "row", alignItems: "center", gap: 7 },
  compteurPoint: { width: 7, height: 7, borderRadius: 4 },
  compteurLabel: { flex: 1, fontSize: 10, fontFamily: POLICE.gras, letterSpacing: 0.8 },
  compteurValeurs: { flexDirection: "row", alignItems: "baseline", gap: 7 },
  compteurValeur: { fontSize: 27, fontFamily: POLICE.gras, lineHeight: 31, letterSpacing: -0.5, fontVariant: ["tabular-nums"], flexShrink: 0 },
  compteurUnite: { fontSize: 12, fontFamily: POLICE.demi, color: T.gris, flexShrink: 1, minWidth: 0 },
  compteurBarFond: { height: 5, backgroundColor: T.filet, borderRadius: 99, overflow: "hidden" },
  compteurBar: { height: "100%", borderRadius: 99 },
  compteurSous: { fontSize: 10.5, fontFamily: POLICE.demi, color: T.texte },

  bandeau: {
    flexDirection: "row", alignItems: "center", gap: 13,
    borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 10,
  },
  bandeauTuile: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: T.carte, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  bandeauCompte: { fontSize: 14, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  bandeauSur: { fontSize: 9, fontFamily: POLICE.gras, letterSpacing: 1.2, marginBottom: 3 },
  bandeauTitre: { fontSize: 15, fontFamily: POLICE.gras, color: T.encre },
  groupe: { backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord, overflow: "hidden" },
  tuile: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, paddingVertical: 12 },
  tuileBord: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.bordure },
  tuilePoint: { width: 6, height: 6, borderRadius: 3 },
  tuileTitre: { flex: 1, fontSize: 13, fontFamily: POLICE.demi, color: T.encre },
  tuileDroite: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.gris },
}));
