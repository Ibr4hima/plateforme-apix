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
import { ListeRapide } from "@/components/ListeRapide";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, EtatErreur, EtatVide, Tapable } from "@/components/ui";
import { useNaemaArbre } from "@/components/ArbreNaema";
import AvantageSheet from "@/components/AvantageSheet";
import { CascadeGeo, CascadeThema, FeuilleFiltres, SectionCoches, basculer, construireArbreGeo } from "@/components/FiltresListe";
import EnTetePage from "@/components/EnTetePage";
import PotentialiteSheet, { NIVEAU_COULEURS } from "@/components/PotentialiteSheet";
import ProjetSheet from "@/components/ProjetSheet";
import { fetchTous, getJson } from "@/lib/api";
import { tick } from "@/lib/haptique";
import { useMargeBas } from "@/lib/marges";
import { POLICE, T } from "@/theme";

// Les trois lentilles — chips colorées comme les types de zones
const LENTILLES = [
  { cle: "projets",       label: "Banque de projets",       couleur: "#004f91" },
  { cle: "potentialites", label: "Potentialités par zone",   couleur: "#ca631f" },
  { cle: "avantages",     label: "Avantages & incitations",  couleur: "#188038" },
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

// Libellés de la feuille de filtres pour le niveau territorial des potentialités
const NIVEAU_LIBELLES = [
  { label: "Pôle",           valeur: "pole" },
  { label: "Région",         valeur: "region" },
  { label: "Département",    valeur: "departement" },
  { label: "Arrondissement", valeur: "arrondissement" },
] as const;

// Conversion noms sélectionnés → ids d'un référentiel (comme le site)
const idsDe = (noms: string[], ref: any[]) =>
  noms.map(n => ref.find((x: any) => x.nom === n)?.id).filter(Boolean) as number[];

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
        {p.pole_nom ? <Text style={s.sousTitre} numberOfLines={1}>{p.pole_nom}</Text> : null}
        <View style={s.faits}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.faitLabel}>RÉGION</Text>
            <Text style={[s.faitVal, !p.region_nom && { color: T.grisClair }]} numberOfLines={1}>{p.region_nom || "—"}</Text>
          </View>
          <View style={s.faitSep} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.faitLabel}>DÉPARTEMENT</Text>
            <Text style={[s.faitVal, !p.departement_nom && { color: T.grisClair }]} numberOfLines={1}>{p.departement_nom || "—"}</Text>
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

  // Feuille de filtres — mêmes filtres que la barre latérale du site, par vue
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  // Projets
  const [projPoles, setProjPoles] = useState<string[]>([]);
  const [projSects, setProjSects] = useState<string[]>([]);
  const [projBranches, setProjBranches] = useState<string[]>([]);
  const [projActivites, setProjActivites] = useState<string[]>([]);
  const [projRegions, setProjRegions] = useState<string[]>([]);
  const [projDepts, setProjDepts] = useState<string[]>([]);
  const [projArrs, setProjArrs] = useState<string[]>([]);
  // Potentialités
  const [potsNiveaux, setPotsNiveaux] = useState<string[]>([]);
  const [potsPoles, setPotsPoles] = useState<string[]>([]);
  const [potsSects, setPotsSects] = useState<string[]>([]);
  const [potsBranches, setPotsBranches] = useState<string[]>([]);
  const [potsActivites, setPotsActivites] = useState<string[]>([]);
  const [potsAtouts, setPotsAtouts] = useState<string[]>([]);
  // Avantages
  const [avgSects, setAvgSects] = useState<string[]>([]);
  const [avgBranches, setAvgBranches] = useState<string[]>([]);
  const [avgActivites, setAvgActivites] = useState<string[]>([]);
  const [avgTypes, setAvgTypes] = useState<string[]>([]);

  const projetsQ = useQuery({ queryKey: ["projets"], queryFn: () => fetchTous("/projets") });
  const potsQ    = useQuery({ queryKey: ["potentialites"], queryFn: () => fetchTous("/opportunites/potentialites") });
  const avgsQ    = useQuery({ queryKey: ["avantages"], queryFn: () => fetchTous("/opportunites/avantages") });
  const { data: refAvantages } = useQuery({ queryKey: ["ref-atouts"], queryFn: () => getJson<any[]>("/ref-potentialites/flat"), staleTime: Infinity });
  const { data: poles }  = useQuery({ queryKey: ["zones-poles"], queryFn: () => getJson<any[]>("/zones-types/poles"), staleTime: Infinity });
  const { data: regions } = useQuery({ queryKey: ["ref", "regions"], queryFn: () => getJson<any[]>("/entreprises/ref/regions"), staleTime: Infinity });
  const { data: departements } = useQuery({ queryKey: ["ref", "departements"], queryFn: () => getJson<any[]>("/entreprises/ref/departements"), staleTime: Infinity });
  const { data: arrondissements } = useQuery({ queryKey: ["ref", "arrondissements"], queryFn: () => getJson<any[]>("/entreprises/ref/arrondissements"), staleTime: Infinity });
  const { data: refAvgTypes } = useQuery({ queryKey: ["ref-avg-types"], queryFn: () => getJson<any[]>("/ref-avantages"), staleTime: Infinity });
  const { secteurs, branches, activites, arbre } = useNaemaArbre();

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
    if (projPoles.length) liste = liste.filter((p: any) => projPoles.includes(p.pole_nom || ""));
    if (projSects.length) { const ids = idsDe(projSects, secteurs); liste = liste.filter((p: any) => ids.some(id => (p.secteur_ids || []).includes(id))); }
    if (projBranches.length) { const ids = idsDe(projBranches, branches); liste = liste.filter((p: any) => ids.some(id => (p.branche_ids || []).includes(id))); }
    if (projActivites.length) { const ids = idsDe(projActivites, activites); liste = liste.filter((p: any) => ids.some(id => (p.activite_ids || []).includes(id))); }
    if (projRegions.length) liste = liste.filter((p: any) => projRegions.includes(p.region_nom || ""));
    if (projDepts.length) liste = liste.filter((p: any) => projDepts.includes(p.departement_nom || ""));
    if (projArrs.length) liste = liste.filter((p: any) => projArrs.includes(p.arrondissement_nom || ""));
    return liste;
  }, [projets, requete, projPoles, projSects, projBranches, projActivites, projRegions, projDepts, projArrs, secteurs, branches, activites]);

  // ── Potentialités filtrées (titre, zone, description + barre latérale) ──
  const potsFiltres = useMemo(() => {
    let liste = pots;
    if (requete) liste = liste.filter((p: any) =>
      [p.titre, p.description, p.pole_nom, p.region_nom, p.departement_nom, p.arrondissement_nom]
        .some(x => (x || "").toLowerCase().includes(requete)));
    if (potsNiveaux.length) {
      const vals = NIVEAU_LIBELLES.filter(n => potsNiveaux.includes(n.label)).map(n => n.valeur as string);
      liste = liste.filter((p: any) => vals.includes(p.niveau));
    }
    if (potsPoles.length) liste = liste.filter((p: any) => potsPoles.includes(p.pole_nom || ""));
    if (potsSects.length) { const ids = idsDe(potsSects, secteurs); liste = liste.filter((p: any) => ids.some(id => (p.secteur_ids || []).includes(id))); }
    if (potsBranches.length) { const ids = idsDe(potsBranches, branches); liste = liste.filter((p: any) => ids.some(id => (p.branche_ids || []).includes(id))); }
    if (potsActivites.length) { const ids = idsDe(potsActivites, activites); liste = liste.filter((p: any) => ids.some(id => (p.activite_ids || []).includes(id))); }
    if (potsAtouts.length) {
      const ids = (refAvantages || []).filter((a: any) => potsAtouts.includes(a.libelle)).map((a: any) => a.id);
      liste = liste.filter((p: any) => ids.some((id: number) => (p.avantage_ids || []).includes(id)));
    }
    return liste;
  }, [pots, requete, potsNiveaux, potsPoles, potsSects, potsBranches, potsActivites, potsAtouts, secteurs, branches, activites, refAvantages]);

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
    if (avgSects.length) { const ids = idsDe(avgSects, secteurs); liste = liste.filter((a: any) => ids.includes(a.secteur_id)); }
    if (avgBranches.length) { const ids = idsDe(avgBranches, branches); liste = liste.filter((a: any) => ids.includes(a.branche_id)); }
    if (avgActivites.length) { const ids = idsDe(avgActivites, activites); liste = liste.filter((a: any) => ids.includes(a.activite_id)); }
    if (avgTypes.length) liste = liste.filter((a: any) => (a.selections || []).some((x: any) => avgTypes.includes(x.type_libelle)));
    return liste;
  }, [avgs, requete, avgSects, avgBranches, avgActivites, avgTypes, secteurs, branches, activites]);

  // ── Options des feuilles de filtres (depuis les données) ──
  const triFr = (a: string, b: string) => a.localeCompare(b, "fr");
  const projPolesOptions = useMemo(() =>
    ([...new Set(projets.map((p: any) => p.pole_nom).filter(Boolean))] as string[]).sort(triFr), [projets]);
  const projGeoArbre = useMemo(() => construireArbreGeo(projets), [projets]);
  const potsPolesOptions = useMemo(() =>
    ([...new Set(pots.map((p: any) => p.pole_nom).filter(Boolean))] as string[]).sort(triFr), [pots]);
  // Atouts proposés : libellés du référentiel réellement portés par une fiche
  const atoutsOptions = useMemo(() => {
    const utilises = new Set<number>();
    pots.forEach((p: any) => (p.avantage_ids || []).forEach((id: number) => utilises.add(id)));
    return [...new Set((refAvantages || []).filter((a: any) => utilises.has(a.id)).map((a: any) => a.libelle))] as string[];
  }, [pots, refAvantages]);
  // Types d'avantage proposés : libellés du référentiel réellement utilisés
  const typesOptions = useMemo(() => {
    const utilises = new Set(avgs.flatMap((a: any) => (a.selections || []).map((x: any) => x.type_libelle)));
    return (refAvgTypes || []).map((t: any) => t.libelle as string).filter(l => utilises.has(l));
  }, [avgs, refAvgTypes]);

  const nbFiltres = vue === "projets"
    ? projPoles.length + projSects.length + projBranches.length + projActivites.length + projRegions.length + projDepts.length + projArrs.length
    : vue === "potentialites"
    ? potsNiveaux.length + potsPoles.length + potsSects.length + potsBranches.length + potsActivites.length + potsAtouts.length
    : avgSects.length + avgBranches.length + avgActivites.length + avgTypes.length;
  const reinitFiltres = () => {
    if (vue === "projets") { setProjPoles([]); setProjSects([]); setProjBranches([]); setProjActivites([]); setProjRegions([]); setProjDepts([]); setProjArrs([]); }
    else if (vue === "potentialites") { setPotsNiveaux([]); setPotsPoles([]); setPotsSects([]); setPotsBranches([]); setPotsActivites([]); setPotsAtouts([]); }
    else { setAvgSects([]); setAvgBranches([]); setAvgActivites([]); setAvgTypes([]); }
  };
  const boutonFiltres = { icone: "filter_list", onPress: () => setFiltresOuverts(true), badge: nbFiltres || undefined };

  const feuille = filtresOuverts && (
    <FeuilleFiltres onClose={() => setFiltresOuverts(false)} onReinitialiser={reinitFiltres}>
      {vue === "projets" ? (
        <>
          <SectionCoches titre="Pôle territoire" options={projPolesOptions} sel={projPoles}
            onBascule={v => setProjPoles(p => basculer(p, v))} />
          {/* Toggles en cascade du site : secteur remet branches + activités, région remet depts + arrs… */}
          <CascadeThema secteurs={arbre}
            secteursSel={projSects} branchesSel={projBranches} activitesSel={projActivites}
            onSecteur={v => { setProjSects(p => basculer(p, v)); setProjBranches([]); setProjActivites([]); }}
            onBranche={v => { setProjBranches(p => basculer(p, v)); setProjActivites([]); }}
            onActivite={v => setProjActivites(p => basculer(p, v))} />
          <CascadeGeo regions={projGeoArbre}
            regionsSel={projRegions} deptsSel={projDepts} arrsSel={projArrs}
            onRegion={v => { setProjRegions(p => basculer(p, v)); setProjDepts([]); setProjArrs([]); }}
            onDept={v => { setProjDepts(p => basculer(p, v)); setProjArrs([]); }}
            onArr={v => setProjArrs(p => basculer(p, v))} />
        </>
      ) : vue === "potentialites" ? (
        <>
          <SectionCoches titre="Niveau" options={NIVEAU_LIBELLES.map(n => n.label)} sel={potsNiveaux}
            onBascule={v => setPotsNiveaux(p => basculer(p, v))} />
          <SectionCoches titre="Pôle territoire" options={potsPolesOptions} sel={potsPoles}
            onBascule={v => setPotsPoles(p => basculer(p, v))} />
          <CascadeThema secteurs={arbre}
            secteursSel={potsSects} branchesSel={potsBranches} activitesSel={potsActivites}
            onSecteur={v => setPotsSects(p => basculer(p, v))}
            onBranche={v => setPotsBranches(p => basculer(p, v))}
            onActivite={v => setPotsActivites(p => basculer(p, v))} />
          <SectionCoches titre="Atouts" options={atoutsOptions} sel={potsAtouts}
            onBascule={v => setPotsAtouts(p => basculer(p, v))} />
        </>
      ) : (
        <>
          <CascadeThema secteurs={arbre}
            secteursSel={avgSects} branchesSel={avgBranches} activitesSel={avgActivites}
            onSecteur={v => setAvgSects(p => basculer(p, v))}
            onBranche={v => setAvgBranches(p => basculer(p, v))}
            onActivite={v => setAvgActivites(p => basculer(p, v))} />
          {typesOptions.length > 0 && (
            <SectionCoches titre="Type d'avantage" options={typesOptions} sel={avgTypes}
              onBascule={v => setAvgTypes(p => basculer(p, v))} />
          )}
        </>
      )}
    </FeuilleFiltres>
  );

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

  const hero = (
    <>
      <EnTetePage titre="Opportunités d'investissement"
        recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
        bouton={boutonFiltres} />
      {/* Les trois lentilles en chips colorées, compteur en pastille */}
      <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }} contentContainerStyle={[s.chipsRangee, cap]}>
        {LENTILLES.map(l => {
          const actif = vue === l.cle;
          return (
            <Pressable key={l.cle}
              onLayout={ev => { const { x, width: la } = ev.nativeEvent.layout; chipsPos.current[l.cle] = { x, largeur: la }; }}
              onPress={() => {
                tick();
                setVue(l.cle); setNiveauSel(null); setSecteurSel(null);
                // Centre la chip choisie : les voisines restent visibles des deux côtés
                const p = chipsPos.current[l.cle];
                if (p) chipsRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
              }}
              style={[s.chipFiltre, actif && { backgroundColor: `${l.couleur}14`, borderColor: `${l.couleur}66` }]}>
              <Text style={[s.chipFiltreTexte, { color: l.couleur }, actif && { fontFamily: POLICE.gras }]}>{l.label}</Text>
              {pret && (
                <View style={[s.chipCompte, actif && { backgroundColor: `${l.couleur}18` }]}>
                  <Text style={[s.chipCompteTexte, { color: l.couleur }]}>{comptes[l.cle]}</Text>
                </View>
              )}
            </Pressable>
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
      <>
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
        {feuille}
      </>
    );
  }

  // ── Potentialités par zone : cards de niveau + fiches groupées ──
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
                    <CarteCompteur key={n.cle} couleur={NIVEAU_COULEURS[n.cle]} label={n.label}
                      valeur={total} unite={n.unite} pct={pct}
                      sousLigne={count > 0 ? `${count} fiche${count > 1 ? "s" : ""} définie${count > 1 ? "s" : ""} · ${pct} %` : "Aucune fiche définie"}
                      actif={niveauSel === n.cle} largeur={s.compteurDemi}
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
        {feuille}
      </>
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
    <>
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
                  <CarteCompteur key={sec.cle} couleur={sec.couleur} label={sec.label}
                    valeur={nbActs} unite="activité" pct={pct}
                    sousLigne={count > 0 ? `${count} avantage${count > 1 ? "s" : ""} défini${count > 1 ? "s" : ""} · ${pct} %` : "Aucun avantage défini"}
                    actif={secteurSel === sec.cle}
                    onPress={count > 0 ? () => { tick(); setSecteurSel(secteurSel === sec.cle ? null : sec.cle); } : undefined} />
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
              <EtatVide texte="Aucun avantage ne correspond." />
            )}
          </View>
        )}
      </Animated.ScrollView>
      {avgOuvert && <AvantageSheet avantage={avgOuvert} onClose={() => setAvgOuvert(null)} />}
      {feuille}
    </>
  );
}

const s = StyleSheet.create({
  rangee: { paddingHorizontal: 16, marginBottom: 10 },
  chipsRangee: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  chipFiltre: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 14, paddingVertical: 7.5, borderRadius: 999,
    backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure,
  },
  chipFiltreTexte: { fontSize: 12.5, fontFamily: POLICE.demi },
  chipCompte: { backgroundColor: T.fond, borderRadius: 999, minWidth: 21, paddingHorizontal: 6, paddingVertical: 1.5, alignItems: "center" },
  chipCompteTexte: { fontSize: 11, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },

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

  grilleCompteurs: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  compteur: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 15, paddingTop: 14, paddingBottom: 13, gap: 10,
  },
  compteurDemi: { flexGrow: 1, flexBasis: "45%" },
  compteurEntete: { flexDirection: "row", alignItems: "center", gap: 7 },
  compteurPoint: { width: 7, height: 7, borderRadius: 4 },
  compteurLabel: { flex: 1, fontSize: 10, fontFamily: POLICE.gras, letterSpacing: 0.8 },
  compteurValeurs: { flexDirection: "row", alignItems: "baseline", gap: 7 },
  compteurValeur: { fontSize: 27, fontFamily: POLICE.gras, lineHeight: 31, letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  compteurUnite: { fontSize: 12, fontFamily: POLICE.demi, color: T.gris },
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
});
