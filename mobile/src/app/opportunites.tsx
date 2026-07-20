// Opportunités d'investissement — adaptation fidèle de la page web :
// vues Projets / Potentialités / Avantages dans le hero. Banque de
// projets en cards (titre, pôle, Région | Département), potentialités
// par niveau territorial (4 cards compteur puis fiches groupées par
// rattachement), avantages & incitations par secteur économique
// (3 cards compteur puis activités groupées par branche).
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNaema } from "@/components/ArbreNaema";
import AvantageSheet from "@/components/AvantageSheet";
import HeroModule from "@/components/HeroModule";
import PotentialiteSheet, { NIVEAU_COULEURS } from "@/components/PotentialiteSheet";
import ProjetSheet from "@/components/ProjetSheet";
import { fetchTous, getJson } from "@/lib/api";
import { POLICE, T } from "@/theme";

const VUES = [
  { cle: "projets",       label: "Projets" },
  { cle: "potentialites", label: "Potentialités" },
  { cle: "avantages",     label: "Avantages" },
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
  { cle: "primaire",   label: "Secteur Primaire",   couleur: "#188038" },
  { cle: "secondaire", label: "Secteur Secondaire", couleur: "#ca631f" },
  { cle: "tertiaire",  label: "Secteur Tertiaire",  couleur: "#004f91" },
] as const;

// « Potentialités de la région de… » → « Région de… » (règle du site)
const potTitre = (p: any) => (p.titre || "")
  .replace(/^[Pp]otentialités?\s+(de\s+l['’]|de\s+la\s+|de\s+le\s+|du\s+|de\s+)/i, "")
  .replace(/^(.)/, (_: string, c: string) => c.toUpperCase());

function CarteProjet({ p, onPress }: { p: any; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => [s.carte, pressed && { transform: [{ scale: 0.99 }], borderColor: "rgba(0,79,145,0.33)" }]}>
      <View style={{ minWidth: 0 }}>
        <Text style={s.titre} numberOfLines={2}>{p.titre_projet}</Text>
        {p.pole_nom ? <Text style={s.sousTitre} numberOfLines={1}>{p.pole_nom}</Text> : null}
      </View>
      <View style={s.bas}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.basLabel}>RÉGION</Text>
          <Text style={[s.basVal, { color: p.region_nom ? T.encre : T.grisClair }]} numberOfLines={1}>{p.region_nom || "—"}</Text>
        </View>
        <View style={s.basSep} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.basLabel}>DÉPARTEMENT</Text>
          <Text style={[s.basVal, { color: p.departement_nom ? T.encre : T.grisClair }]} numberOfLines={1}>{p.departement_nom || "—"}</Text>
        </View>
      </View>
    </Pressable>
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
        <Text style={[s.compteurLabel, { color: couleur }]} numberOfLines={1}>{label.toUpperCase()}</Text>
      </View>
      <View style={s.compteurValeurs}>
        <Text style={[s.compteurValeur, { color: valeur > 0 ? T.encre : T.grisClair }]}>{valeur || "—"}</Text>
        <Text style={s.compteurUnite}>{unite}{valeur > 1 ? "s" : ""}</Text>
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
        <Text style={s.bandeauTitre} numberOfLines={1}>{titre}</Text>
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
      <Text style={s.tuileTitre} numberOfLines={1}>{titre}</Text>
      {droite ? <Text style={s.tuileDroite}>{droite}</Text> : null}
    </Pressable>
  );
}

export default function Opportunites() {
  const [vue, setVue] = useState("projets");
  const [q, setQ] = useState("");
  const [niveauSel, setNiveauSel] = useState<string | null>(null);
  const [secteurSel, setSecteurSel] = useState<string | null>(null);
  const [projetOuvert, setProjetOuvert] = useState<any>(null);
  const [potOuverte, setPotOuverte] = useState<any>(null);
  const [avgOuvert, setAvgOuvert] = useState<any>(null);

  const projetsQ = useQuery({ queryKey: ["projets"], queryFn: () => fetchTous("/projets") });
  const potsQ    = useQuery({ queryKey: ["potentialites"], queryFn: () => fetchTous("/opportunites/potentialites") });
  const avgsQ    = useQuery({ queryKey: ["avantages"], queryFn: () => fetchTous("/opportunites/avantages") });
  const { data: refAvantages } = useQuery({ queryKey: ["ref-atouts"], queryFn: () => getJson<any[]>("/ref-potentialites/flat"), staleTime: Infinity });
  const { data: poles }  = useQuery({ queryKey: ["zones-poles"], queryFn: () => getJson<any[]>("/zones-types/poles"), staleTime: Infinity });
  const { data: regions } = useQuery({ queryKey: ["ref", "regions"], queryFn: () => getJson<any[]>("/entreprises/ref/regions"), staleTime: Infinity });
  const { data: departements } = useQuery({ queryKey: ["ref", "departements"], queryFn: () => getJson<any[]>("/entreprises/ref/departements"), staleTime: Infinity });
  const { data: arrondissements } = useQuery({ queryKey: ["ref", "arrondissements"], queryFn: () => getJson<any[]>("/entreprises/ref/arrondissements"), staleTime: Infinity });
  const { secteurs, branches, activites } = useNaema();

  const projets: any[] = projetsQ.data || [];
  const pots: any[]    = potsQ.data || [];
  const avgs: any[]    = avgsQ.data || [];
  const requete = q.trim().toLowerCase();

  // ── Projets filtrés (règle du site : titre ou porteur) ──
  const projetsFiltres = useMemo(() => {
    let liste = projets;
    if (requete) liste = liste.filter((p: any) =>
      (p.titre_projet || "").toLowerCase().includes(requete) ||
      (p.porteur_projet || "").toLowerCase().includes(requete));
    return liste;
  }, [projets, requete]);

  // ── Potentialités filtrées (titre, zone, description) ──
  const potsFiltres = useMemo(() => {
    if (!requete) return pots;
    return pots.filter((p: any) =>
      [p.titre, p.description, p.pole_nom, p.region_nom, p.departement_nom, p.arrondissement_nom]
        .some(x => (x || "").toLowerCase().includes(requete)));
  }, [pots, requete]);

  // ── Avantages filtrés (règle du site : tous les mots) ──
  const avgsFiltres = useMemo(() => {
    if (!requete) return avgs;
    const mots = requete.split(/\s+/).filter(m => m.length > 1);
    return avgs.filter((a: any) => {
      const texte = [a.activite_nom, a.secteur_nom, a.branche_nom, ...(a.selections || []).map((x: any) => x.type_libelle)]
        .filter(Boolean).join(" ").toLowerCase();
      return mots.every(m => texte.includes(m));
    });
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

  const hero = (
    <>
      <HeroModule titre={"Opportunités\nd'investissement"}
        recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
        segments={{ options: VUES, valeur: vue, onChange: v => { setVue(v); setNiveauSel(null); setSecteurSel(null); } }} />
      {!chargement && !enErreur && (
        <Text style={s.compte}>
          {vue === "projets" ? `${projetsFiltres.length} projet${projetsFiltres.length > 1 ? "s" : ""}`
            : vue === "potentialites" ? `${potsFiltres.length} fiche${potsFiltres.length > 1 ? "s" : ""} de potentialités`
            : `${avgsFiltres.length} avantage${avgsFiltres.length > 1 ? "s" : ""}`}
        </Text>
      )}
    </>
  );

  const vide = chargement ? <View style={s.centre}><ActivityIndicator color={T.bleu} size="large" /></View>
    : enErreur ? (
      <View style={s.centre}>
        <Text style={s.erreur}>Impossible de joindre la plateforme.</Text>
        <Pressable onPress={() => recharger()} style={s.bouton}><Text style={s.boutonTexte}>Réessayer</Text></Pressable>
      </View>
    ) : (
      <View style={s.centre}><Text style={s.erreurSous}>Aucun résultat ne correspond.</Text></View>
    );

  // ── Vue Projets : liste de cards ──
  if (vue === "projets") {
    return (
      <>
        <FlatList
          style={{ backgroundColor: T.fond }}
          data={chargement || enErreur ? [] : projetsFiltres}
          keyExtractor={(p: any) => String(p.id)}
          renderItem={({ item }) => <View style={s.rangee}><CarteProjet p={item} onPress={() => setProjetOuvert(item)} /></View>}
          contentContainerStyle={s.liste}
          refreshing={projetsQ.isRefetching} onRefresh={projetsQ.refetch}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={hero}
          ListEmptyComponent={vide}
        />
        {projetOuvert && <ProjetSheet projet={projetOuvert} onClose={() => setProjetOuvert(null)} />}
      </>
    );
  }

  // ── Vue Potentialités : cards de niveau + fiches groupées ──
  if (vue === "potentialites") {
    const fichesNiveau = niveauSel ? potsFiltres.filter((p: any) => p.niveau === niveauSel) : [];
    const meta = NIVEAUX.find(n => n.cle === niveauSel);
    const couleur = niveauSel ? NIVEAU_COULEURS[niveauSel] : T.bleu;
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
      <>
        <ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={s.liste} keyboardShouldPersistTaps="handled">
          {hero}
          {chargement || enErreur ? vide : (
            <View style={{ paddingHorizontal: 16 }}>
              <View style={s.grilleCompteurs}>
                {NIVEAUX.map(n => {
                  const count = pots.filter((p: any) => p.niveau === n.cle).length;
                  const total = totauxNiveaux[n.cle] || 0;
                  const pct = total > 0 ? Math.round(count / total * 100) : 0;
                  return (
                    <CarteCompteur key={n.cle} couleur={NIVEAU_COULEURS[n.cle]} label={n.label}
                      valeur={total} unite={n.unite} pct={pct}
                      sousLigne={count > 0 ? `${count} fiche${count > 1 ? "s" : ""} définie${count > 1 ? "s" : ""} · ${pct} %` : "Aucune fiche définie"}
                      actif={niveauSel === n.cle} largeur={s.compteurDemi}
                      onPress={count > 0 ? () => setNiveauSel(niveauSel === n.cle ? null : n.cle) : undefined} />
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
                <View style={s.centre}><Text style={s.erreurSous}>Aucune fiche ne correspond.</Text></View>
              )}
            </View>
          )}
        </ScrollView>
        {potOuverte && <PotentialiteSheet pot={potOuverte} refAvantages={refAvantages || []} onClose={() => setPotOuverte(null)} />}
      </>
    );
  }

  // ── Vue Avantages : cards de secteur + activités groupées par branche ──
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
    <>
      <ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={s.liste} keyboardShouldPersistTaps="handled">
        {hero}
        {chargement || enErreur ? vide : (
          <View style={{ paddingHorizontal: 16 }}>
            <View style={{ gap: 10 }}>
              {SECTEURS_AVGS.map(sec => {
                const count = avgs.filter((a: any) => (a.secteur_nom || "").toLowerCase().includes(sec.cle)).length;
                const secRef = secteurs.find((x: any) => (x.nom || "").toLowerCase().includes(sec.cle));
                const braIds = new Set(branches.filter((b: any) => b.secteur_id === secRef?.id).map((b: any) => b.id));
                const nbActs = activites.filter((a: any) => braIds.has(a.branche_id)).length;
                const pct = nbActs > 0 ? Math.round(count / nbActs * 100) : 0;
                return (
                  <CarteCompteur key={sec.cle} couleur={sec.couleur} label={sec.label}
                    valeur={nbActs} unite="activité" pct={pct}
                    sousLigne={count > 0 ? `${count} avantage${count > 1 ? "s" : ""} défini${count > 1 ? "s" : ""} · ${pct} %` : "Aucun avantage défini"}
                    actif={secteurSel === sec.cle}
                    onPress={count > 0 ? () => setSecteurSel(secteurSel === sec.cle ? null : sec.cle) : undefined} />
                );
              })}
            </View>
            {secteurSel && metaSect && branchesGroupes.map(bra => (
              <View key={bra.id} style={{ marginTop: 18 }}>
                <Bandeau couleur={metaSect.couleur} count={bra.items.length} surtitre="Branche" titre={bra.nom} />
                <View style={s.groupe}>
                  {bra.items.map((a: any, i: number) => (
                    <Tuile key={a.id} couleur={metaSect.couleur} titre={a.activite_nom}
                      onPress={() => setAvgOuvert(a)} dernier={i === bra.items.length - 1} />
                  ))}
                </View>
              </View>
            ))}
            {secteurSel && branchesGroupes.length === 0 && (
              <View style={s.centre}><Text style={s.erreurSous}>Aucun avantage ne correspond.</Text></View>
            )}
          </View>
        )}
      </ScrollView>
      {avgOuvert && <AvantageSheet avantage={avgOuvert} onClose={() => setAvgOuvert(null)} />}
    </>
  );
}

const s = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  erreur: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre, textAlign: "center" },
  erreurSous: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center" },
  bouton: { marginTop: 12, backgroundColor: T.bleuAction, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  boutonTexte: { color: "#fff", fontFamily: POLICE.gras, fontSize: 13 },
  liste: { paddingBottom: 40 },
  rangee: { paddingHorizontal: 16, marginBottom: 11 },
  compte: { fontSize: 11, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1, textTransform: "uppercase", marginTop: 14, marginBottom: 8, paddingHorizontal: 16 },
  carte: {
    backgroundColor: T.carte, borderRadius: 16, borderWidth: 1, borderColor: T.bordure,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, gap: 13,
  },
  titre: { fontSize: 15, fontFamily: POLICE.gras, color: T.encre, lineHeight: 20, letterSpacing: -0.2 },
  sousTitre: { fontSize: 11, fontFamily: POLICE.moyen, color: T.gris, marginTop: 3 },
  bas: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: T.filet, paddingTop: 12 },
  basSep: { width: 1, alignSelf: "stretch", backgroundColor: T.filet, marginHorizontal: 18 },
  basLabel: { fontSize: 9, fontFamily: POLICE.gras, letterSpacing: 1.1, color: T.gris, marginBottom: 4 },
  basVal: { fontSize: 12.5, fontFamily: POLICE.gras },
  grilleCompteurs: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  compteur: {
    backgroundColor: T.carte, borderRadius: 16, borderWidth: 1, borderColor: T.bordure,
    paddingHorizontal: 15, paddingTop: 14, paddingBottom: 13, gap: 10,
  },
  compteurDemi: { flexGrow: 1, flexBasis: "45%" },
  compteurEntete: { flexDirection: "row", alignItems: "center", gap: 7 },
  compteurPoint: { width: 7, height: 7, borderRadius: 4 },
  compteurLabel: { flex: 1, fontSize: 10, fontFamily: POLICE.gras, letterSpacing: 0.8 },
  compteurValeurs: { flexDirection: "row", alignItems: "baseline", gap: 7 },
  compteurValeur: { fontSize: 27, fontFamily: POLICE.gras, lineHeight: 31, letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  compteurUnite: { fontSize: 12, fontFamily: POLICE.demi, color: T.gris },
  compteurBarFond: { height: 6, backgroundColor: T.filet, borderRadius: 99, overflow: "hidden" },
  compteurBar: { height: "100%", borderRadius: 99 },
  compteurSous: { fontSize: 10.5, fontFamily: POLICE.demi, color: T.texte },
  bandeau: {
    flexDirection: "row", alignItems: "center", gap: 13,
    borderWidth: 1, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 10,
  },
  bandeauTuile: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: T.carte, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  bandeauCompte: { fontSize: 14, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  bandeauSur: { fontSize: 9, fontFamily: POLICE.gras, letterSpacing: 1.2, marginBottom: 3 },
  bandeauTitre: { fontSize: 15, fontFamily: POLICE.gras, color: T.encre },
  groupe: { backgroundColor: T.carte, borderRadius: 16, borderWidth: 1, borderColor: T.bordure, overflow: "hidden" },
  tuile: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, paddingVertical: 12 },
  tuileBord: { borderBottomWidth: 1, borderBottomColor: T.filet },
  tuilePoint: { width: 6, height: 6, borderRadius: 3 },
  tuileTitre: { flex: 1, fontSize: 13, fontFamily: POLICE.demi, color: T.encre },
  tuileDroite: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.gris },
});
