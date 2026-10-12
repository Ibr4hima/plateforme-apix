// Le rapport d'une vue des Investissements projetés — projets annoncés,
// signaux d'investissement, investisseurs.
//
// CHAQUE VUE A LE SIEN, comme sur le site : les projets annoncés et les
// signaux ne se lisent pas de la même façon — un fait contre une intention —
// et celui des investisseurs compte des ENTREPRISES, non des projets. Un
// rapport unique aurait menti sur l'un des trois.
//
// IL PORTE LA SÉLECTION DE L'ÉCRAN D'OÙ ON L'OUVRE. Celui des projets lit la
// destination (le pays ou la région) ; ceux des signaux et des investisseurs,
// tous les filtres de leur vue. Un document qui démentirait l'écran d'où on
// l'a demandé ne servirait à rien.
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import EnTetePage from "@/components/EnTetePage";
import { Os, SqueletteKpis } from "@/components/Squelette";
import { EtatErreur } from "@/components/ui";
import {
  ARetenir, BasculeZones, CarteAnnees, CarteRapport, ClassementCompte, ClassementTrie, type Colonne,
  FENETRE, Gras, Kpis, LigneRang,
} from "@/components/fdi/RapportFdi";
import { Segments } from "@/components/fdi/FiltresFdi";
import { enPanne } from "@/lib/api";
import { creerStyles } from "@/lib/apparence";
import {
  FILTRES_ENTREPRISES_VIDES, FILTRES_SIGNAUX_VIDES, type FiltresEntreprises, type FiltresProjets,
  type FiltresSignaux, PAYS_REFERENCE, PERIMETRE_AFRIQUE, type ReponseProjets,
  type TriInvestissements, type TriInvestisseurs, type Vue, accorder, filtresProjetsInitiaux, fmtEntier,
  fmtMontant, fmtPart, moisEnClair, periodeEnClair, useRapportEntreprises, useRapportProjets,
  useRapportSignaux,
} from "@/lib/fdi";
import { useMargeBas } from "@/lib/marges";
import { ECHELLE, POLICE, T, TYPO } from "@/theme";
import { useGrille } from "@/lib/grille";

const NOTE_SOMMES = "Montants et emplois comprennent des valeurs estimées par l'algorithme du Financial Times, non déclarées par l'entreprise.";
// Les classements d'investisseurs n'ont pas de colonne d'emplois : la note ne
// parle que de ce que le tableau montre
const NOTE_MONTANTS = "Les montants comprennent des valeurs estimées par l'algorithme du Financial Times, non déclarées par l'entreprise.";

/** Les colonnes des classements de projets : le montant d'abord — c'est la
    première question d'un comité, où va l'argent —, le nombre ensuite. */
const COL_MONTANT: Colonne = {
  cle: "capex", label: "Montant", fmt: fmtMontant,
  phrase: v => (v == null ? "montant non communiqué" : `${fmtMontant(v)} investis`),
};
const colNombre = (cle: string, label: string, mot: string): Colonne => ({
  cle, label, fmt: fmtEntier,
  phrase: v => (v == null ? `${mot}s non communiqués` : `${fmtEntier(v)} ${accorder(v, mot)}`),
});
const COL_PROJETS = colNombre("nb", "Projets", "projet");
const COL_EMPLOIS = colNombre("emplois", "Emplois", "emploi");

function lireFiltres<F>(brut: string | string[] | undefined, defaut: F): F {
  try {
    const v = JSON.parse(Array.isArray(brut) ? brut[0] : brut ?? "");
    return v && typeof v === "object" ? { ...defaut, ...v } : defaut;
  } catch {
    return defaut;
  }
}

const dateDuJour = () =>
  new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function RapportFdi() {
  const params = useLocalSearchParams<{ vue?: string; f?: string }>();
  const vue: Vue = params.vue === "signaux" || params.vue === "entreprises" ? params.vue : "projets";
  const titre = vue === "projets" ? "Projets annoncés" : vue === "signaux" ? "Signaux d'investissement" : "Investisseurs";
  return (
    <View style={{ flex: 1, backgroundColor: T.fond }}>
      <EnTetePage titre={titre} />
      {vue === "projets" ? <RapportProjets brut={params.f} />
        : vue === "signaux" ? <RapportSignaux brut={params.f} />
        : <RapportEntreprises brut={params.f} />}
    </View>
  );
}

// ── La page ──────────────────────────────────────────────────────────────────

function Page({ perimetre, periode, filtres, note, children }: {
  perimetre: string; periode: string | null; filtres?: string[];
  /** La note de bas de page — UNE seule, au lieu d'une sous chaque tableau. */
  note?: string;
  children: React.ReactNode;
}) {
  const margeBas = useMargeBas();
  const { cap } = useGrille();
  return (
    <ScrollView style={{ backgroundColor: T.fond }}
      contentContainerStyle={[s.page, { paddingBottom: margeBas }, cap]}>
      {/* AUCUN CHIFFRE SANS SA PÉRIODE : un rapport se cite, et un chiffre
          sorti de son millésime devient faux l'année suivante */}
      <View style={s.entete}>
        <Text style={s.surtitre}>RAPPORT · FDI MARKETS</Text>
        <Text style={s.perimetre} accessibilityRole="header">{perimetre}</Text>
        {/* Deux lignes voulues : d'un seul tenant, le téléphone coupait la
            date en deux (« édité le 12 / octobre 2026 ») */}
        <Text style={s.source}>
          {"Source : fDi Markets (Financial Times)\n"}
          {[periode, `édité le ${dateDuJour()}`].filter(Boolean).join(" · ")}
        </Text>
        {filtres && filtres.length > 0 && (
          <Text style={s.filtres}>Sélection : {filtres.join(" · ")}</Text>
        )}
      </View>
      {children}
      {note ? <Text style={s.notePage}>{note}</Text> : null}
    </ScrollView>
  );
}

/** Deux cartes côte à côte sur tablette, l'une sous l'autre au téléphone. */
function Paire({ children }: { children: React.ReactNode }) {
  const { colonnes } = useGrille();
  if (colonnes < 2) return <>{children}</>;
  return <View style={s.paire}>{children}</View>;
}
const Moitie = ({ children }: { children: React.ReactNode }) => {
  const { colonnes } = useGrille();
  return colonnes < 2 ? <>{children}</> : <View style={{ flex: 1, minWidth: 0 }}>{children}</View>;
};

function Attente() {
  const { colonnes } = useGrille();
  return (
    <View style={{ gap: 14 }}>
      <View style={{ marginHorizontal: -16 }}><SqueletteKpis /></View>
      {colonnes > 1 && <View style={{ marginHorizontal: -16 }}><SqueletteKpis /></View>}
      <Os style={{ height: 260, borderRadius: 18 }} />
      <Os style={{ height: 320, borderRadius: 18 }} />
    </View>
  );
}

// ── Les projets annoncés ─────────────────────────────────────────────────────

const TRIS_PROJETS: { cle: TriInvestissements; label: string }[] = [
  { cle: "capex", label: "Montant" }, { cle: "emplois", label: "Emplois" }, { cle: "periode", label: "Période" },
];

function RapportProjets({ brut }: { brut?: string }) {
  const { colonnes } = useGrille();
  const f = useMemo(() => lireFiltres<FiltresProjets>(brut, filtresProjetsInitiaux()), [brut]);
  const [tri, setTri] = useState<TriInvestissements>("capex");
  const q = useRapportProjets(f, tri);
  const d = q.data;
  const perimetre = (f.echelle === "regions" ? f.region : f.pays) ?? PAYS_REFERENCE;
  const periode = periodeEnClair(d?.kpis.annees);

  if (!d) {
    return (
      <Page perimetre={perimetre} periode={null}>
        {enPanne(q) ? <EtatErreur onRetry={() => q.refetch()} /> : <Attente />}
      </Page>
    );
  }
  const k = d.kpis;
  const anneeForte = [...d.par_annee].filter(a => a.capex_musd)
    .sort((a, b) => (b.capex_musd ?? 0) - (a.capex_musd ?? 0))[0];

  return (
    <Page perimetre={perimetre} periode={periode} note={`${NOTE_SOMMES} ≈ : valeur estimée.`}>
      <Kpis colonnes={colonnes} items={[
        { label: "Projets annoncés", valeur: fmtEntier(k.projets),
          // Espaces insécables : « 46 pays d'origine » et « le FT » ne se
          // coupent pas en fin de ligne
          note: `${fmtEntier(k.entreprises)} entreprises · ${fmtEntier(k.partenaires)} pays d'origine` },
        { label: "Investissement annoncé", valeur: fmtMontant(k.capex_musd),
          note: k.part_estimee != null
            ? `dont ${k.part_estimee.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % estimés par le FT` : null },
        { label: "Emplois annoncés", valeur: fmtEntier(k.emplois), note: "à la création des projets" },
        { label: "Taille moyenne", valeur: fmtMontant(k.capex_moyen), note: "par projet annoncé" },
      ]} />

      <CarteAnnees titre="Évolution par année" mesures={[
        { cle: "capex", label: "Montant", couleur: T.bleu as unknown as string, fmt: fmtMontant,
          points: d.par_annee.map(a => ({ annee: a.annee, valeur: a.capex_musd })) },
        { cle: "nb", label: "Projets", couleur: T.orange as unknown as string, fmt: fmtEntier,
          points: d.par_annee.map(a => ({ annee: a.annee, valeur: a.nb })) },
        { cle: "emplois", label: "Emplois", couleur: T.vert as unknown as string, fmt: fmtEntier,
          points: d.par_annee.map(a => ({ annee: a.annee, valeur: a.emplois })) },
      ]} />

      {/* OÙ SE SITUE LE PAYS PARMI LES SIENS — pour un pays membre d'au
          moins une des trois zones ouest-africaines, et pour elles seules. */}
      <ZonesOuest zones={d.zones_ouest} pays={f.echelle === "pays" ? f.pays : null} />

      <Paire>
        <Moitie>
          <ClassementTrie titre="Pays d'origine des projets" drapeaux
            colonnes={[COL_MONTANT, COL_PROJETS, COL_EMPLOIS]}
            lignes={(d.tops.partenaires ?? []).map(r => ({ nom: r.nom, iso: r.iso,
              valeurs: { capex: r.capex_musd, nb: r.nb, emplois: r.emplois } }))} />
        </Moitie>
        <Moitie>
          <ClassementTrie titre="Secteurs des projets"
            colonnes={[COL_MONTANT, COL_PROJETS, COL_EMPLOIS]}
            lignes={(d.tops.secteurs ?? []).map(r => ({ nom: r.nom,
              valeurs: { capex: r.capex_musd, nb: r.nb, emplois: r.emplois } }))} />
        </Moitie>
      </Paire>
      <ClassementTrie titre="Activités menées"
        colonnes={[COL_MONTANT, COL_PROJETS, COL_EMPLOIS]}
        lignes={(d.tops.activites ?? []).map(r => ({ nom: r.nom,
          valeurs: { capex: r.capex_musd, nb: r.nb, emplois: r.emplois } }))} />

      <Investissements d={d} tri={tri} onTri={setTri} chargement={q.isPlaceholderData} />

      <ARetenir>
        {d.tops.partenaires?.[0] && d.tops.secteurs?.[0] ? (
          <>
            Sur {periode}, <Gras>{fmtEntier(k.projets)} projets</Gras> ont été annoncés par{" "}
            <Gras>{fmtEntier(k.entreprises)} entreprises</Gras> venues de <Gras>{fmtEntier(k.partenaires)} pays</Gras>.
            Le premier pays d'origine est <Gras>{d.tops.partenaires[0].nom}</Gras> ({fmtEntier(d.tops.partenaires[0].nb)} projets),
            le premier secteur visé <Gras>{d.tops.secteurs[0].nom}</Gras> ({fmtEntier(d.tops.secteurs[0].nb)}).
            {anneeForte && <> L'année la plus riche en annonces est <Gras>{anneeForte.annee}</Gras> ({fmtMontant(anneeForte.capex_musd)}).</>}
            {k.part_estimee != null && k.part_estimee > 50 && (
              <> Ces montants sont à manier avec précaution : <Gras>
                {k.part_estimee.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</Gras> d'entre eux sont
                estimés par le Financial Times, l'entreprise ne les ayant pas déclarés.</>
            )}
          </>
        ) : "Aucun projet n'a encore été importé pour ce périmètre."}
      </ARetenir>
    </Page>
  );
}

/** Le classement ouest-africain : la zone se choisit, le tableau se retrie,
    et le pays lu reste mis en évidence quel que soit son rang. */
function ZonesOuest({ zones, pays }: { zones: ReponseProjets["zones_ouest"]; pays: string | null }) {
  const [i, setI] = useState(0);
  const [cle, setCle] = useState<"capex" | "projets" | "emplois">("capex");
  const z = zones[Math.min(i, zones.length - 1)];
  const lignes = useMemo(() => [...(z?.lignes ?? [])].sort((a, b) => {
    const x = cle === "capex" ? a.capex_musd : a[cle], y = cle === "capex" ? b.capex_musd : b[cle];
    if (x == null && y == null) return a.nom.localeCompare(b.nom, "fr");
    if (x == null) return 1;
    if (y == null) return -1;
    return y !== x ? y - x : a.nom.localeCompare(b.nom, "fr");
  }), [z, cle]);
  if (!zones.length || !z) return null;
  return (
    <CarteRapport titre="Classement ouest-africain des projets reçus">
      <BasculeZones zones={zones} valeur={i} onChange={setI} />
      <Text style={s.zoneNom}>{z.nom}</Text>
      <Segments valeur={cle} onChange={c => setCle(c as typeof cle)}
        options={[{ cle: "capex", label: "Invest. reçus" }, { cle: "projets", label: "Projets" }, { cle: "emplois", label: "Emplois" }]} />
      <View>
        {lignes.map((l, k) => (
          <LigneRang key={l.nom} rang={k + 1} premiere={k === 0} nom={l.nom} iso={l.iso}
            surligne={l.nom === pays}
            sous={[cle !== "capex" && COL_MONTANT.phrase(l.capex_musd), cle !== "projets" && COL_PROJETS.phrase(l.projets),
              cle !== "emplois" && COL_EMPLOIS.phrase(l.emplois)].filter(Boolean).join(" · ")}
            valeur={cle === "capex" ? fmtMontant(l.capex_musd) : fmtEntier(cle === "projets" ? l.projets : l.emplois)} />
        ))}
      </View>
    </CarteRapport>
  );
}

/** LE CLASSEMENT DES INVESTISSEMENTS ANNONCÉS — des projets, non des agrégats.
    Le serveur rend les cent premiers sur la colonne choisie : retrier à
    l'écran les cent premiers par montant pour lire « les plus créateurs
    d'emplois » donnerait un faux classement. */
function Investissements({ d, tri, onTri, chargement }: {
  d: ReponseProjets; tri: TriInvestissements; onTri: (t: TriInvestissements) => void; chargement: boolean;
}) {
  const [nb, setNb] = useState(FENETRE);
  const lignes = d.investissements ?? [];
  if (!lignes.length) return null;
  const total = d.kpis.projets;
  const visibles = lignes.slice(0, nb);
  const valeur = (p: (typeof lignes)[number]) =>
    tri === "periode" ? moisEnClair(p.periode)
    : tri === "emplois" ? (p.emplois == null ? "—" : `${p.emplois_estime ? "≈ " : ""}${fmtEntier(p.emplois)}`)
    : (p.capex_musd == null ? "—" : `${p.capex_estime ? "≈ " : ""}${fmtMontant(p.capex_musd)}`);
  return (
    <CarteRapport titre="Classement des investissements annoncés">
      <Segments valeur={tri} onChange={c => { onTri(c as TriInvestissements); setNb(FENETRE); }}
        options={TRIS_PROJETS.map(t => ({ cle: t.cle, label: t.label }))} />
      <View style={chargement ? { opacity: 0.5 } : null}>
        {visibles.map((p, i) => (
          <LigneRang key={p.id} rang={i + 1} premiere={i === 0} nom={p.entreprise ?? "—"}
            sous={[p.partenaire ? `${p.partenaire}` : null, p.secteur,
              tri !== "periode" ? moisEnClair(p.periode) : (p.capex_musd != null ? fmtMontant(p.capex_musd) : null)]
              .filter(Boolean).join(" · ")}
            valeur={valeur(p)} />
        ))}
      </View>
      {nb < lignes.length && (
        <Suite reste={lignes.length - nb} onPress={() => setNb(n => Math.min(lignes.length, n + 20))} />
      )}
      {total > lignes.length && (
        <Text style={s.note}>Les {fmtEntier(lignes.length)} premiers sur {fmtEntier(total)} projets.</Text>
      )}
    </CarteRapport>
  );
}

function Suite({ reste, onPress }: { reste: number; onPress: () => void }) {
  return (
    <Text onPress={onPress} style={s.suite} accessibilityRole="button" suppressHighlighting
      maxFontSizeMultiplier={ECHELLE.compact}>
      Afficher {Math.min(20, reste)} de plus ({fmtEntier(reste)} restants)
    </Text>
  );
}

// ── Les signaux d'investissement ─────────────────────────────────────────────

function resumeSignaux(f: FiltresSignaux): string[] {
  return [
    f.anneeMin != null || f.anneeMax != null ? `${f.anneeMin ?? "…"} – ${f.anneeMax ?? "…"}` : null,
    f.origine ? `de ${f.origine}` : null, f.destination ? `vers ${f.destination}` : null,
    f.secteur || null, f.activite || null, f.recherche ? `« ${f.recherche} »` : null,
  ].filter((x): x is string => !!x);
}

function RapportSignaux({ brut }: { brut?: string }) {
  const { colonnes } = useGrille();
  const f = useMemo(() => lireFiltres<FiltresSignaux>(brut, FILTRES_SIGNAUX_VIDES), [brut]);
  const q = useRapportSignaux(f);
  const d = q.data;
  const [zone, setZone] = useState(0);
  const periode = periodeEnClair(d?.kpis.annees);
  const filtres = resumeSignaux(f);

  if (!d) {
    return (
      <Page perimetre={PERIMETRE_AFRIQUE} periode={null} filtres={filtres}>
        {enPanne(q) ? <EtatErreur onRetry={() => q.refetch()} /> : <Attente />}
      </Page>
    );
  }
  const k = d.kpis;
  const anneeDense = [...d.par_annee].sort((a, b) => b.nb - a.nb)[0];
  const z = d.zones?.length ? d.zones[Math.min(zone, d.zones.length - 1)] : null;

  return (
    <Page perimetre={PERIMETRE_AFRIQUE} periode={periode} filtres={filtres}
      note="Les montants comprennent des valeurs estimées par le Financial Times (≈), non déclarées par l'entreprise. Les classements comptent des signaux.">
      {/* Combien d'intentions, ce qu'elles ont levé, ce qu'elles annoncent
          dépenser, et d'où elles partent. Les deux montants ne s'additionnent
          jamais : des fonds levés ne sont pas un investissement prévu. */}
      <Kpis colonnes={colonnes} items={[
        { label: "Nb de projets annoncés", valeur: fmtEntier(k.signaux), note: "Intentions d'invest. exprimées" },
        { label: "Fonds levés", valeur: fmtMontant(k.funding_musd), note: "cumul des levées annoncées" },
        { label: "Investissement prévu", valeur: fmtMontant(k.capex_musd), note: "cumul des montants annoncés" },
        { label: "Nb pays source", valeur: fmtEntier(k.origines), note: "pays d'origine des entreprises" },
      ]} />

      <CarteAnnees titre="Signaux relevés par année" mesures={[
        { cle: "nb", label: "Signaux", couleur: T.bleu as unknown as string, fmt: fmtEntier,
          points: d.par_annee.map(a => ({ annee: a.annee, valeur: a.nb })) },
      ]} />

      <Paire>
        <Moitie>
          <ClassementCompte titre="Pays d'origine" lignes={d.tops.origines ?? []} drapeaux accent={T.bleu as unknown as string} />
        </Moitie>
        <Moitie>
          {/* LE SÉNÉGAL Y FIGURE TOUJOURS : le rapport se lit depuis Dakar */}
          <ClassementCompte titre="Destinations visées" tag="pays d'Afrique" lignes={d.tops.destinations ?? []}
            drapeaux epingle={PAYS_REFERENCE} accent={T.vert as unknown as string} />
        </Moitie>
      </Paire>
      <Paire>
        <Moitie>
          <ClassementCompte titre="Secteurs visés" lignes={d.tops.secteurs ?? []} accent="#6A1B9A" />
        </Moitie>
        <Moitie>
          <ClassementCompte titre="Activités prévues" lignes={d.tops.activites ?? []} accent={T.bleu as unknown as string} />
        </Moitie>
      </Paire>

      {/* L'AFRIQUE DE L'OUEST, LUE DE TROIS FAÇONS — sous une bascule */}
      {z && (
        <View style={{ gap: 12 }}>
          <View style={s.titreSection}>
            <Text style={s.titreSectionTexte} accessibilityRole="header">Bilan ouest-africain des investissements</Text>
          </View>
          <BasculeZones zones={d.zones} valeur={zone} onChange={setZone} />
          <Paire>
            <Moitie>
              <ClassementCompte titre="Secteurs les plus visés" tag={z.court} lignes={z.secteurs} accent="#6A1B9A" />
            </Moitie>
            <Moitie>
              <ClassementCompte titre="Pays les plus visés" tag={z.court} lignes={z.destinations}
                drapeaux epingle={PAYS_REFERENCE} accent={T.orange as unknown as string} />
            </Moitie>
          </Paire>
        </View>
      )}

      {/* L'investissement prévu passe devant les fonds levés : c'est le montant
          qui intéresse une agence de promotion — ce qu'une entreprise compte
          dépenser sur place. */}
      <Remarquables titre="Classement des signaux d'investissement annoncés" lignes={d.remarquables.capex} />
      <Remarquables titre="Classement des levées de fonds" lignes={d.remarquables.funding} />

      <ARetenir>
        {d.tops.natures?.[0] && d.tops.origines?.[0] ? (
          <>
            Sur {periode}, <Gras>{fmtEntier(k.signaux)} signaux</Gras> ont été relevés, portés par{" "}
            <Gras>{fmtEntier(k.entreprises)} entreprises</Gras> venues de <Gras>{fmtEntier(k.origines)} pays</Gras>.
            Le stade le plus fréquent est <Gras>{d.tops.natures[0].nom.toLowerCase()}</Gras> ({fmtEntier(d.tops.natures[0].nb)} signaux),
            et le premier pays d'origine <Gras>{d.tops.origines[0].nom}</Gras> ({fmtEntier(d.tops.origines[0].nb)}).
            {d.tops.secteurs?.[0] && <> Le secteur le plus visé est <Gras>{d.tops.secteurs[0].nom}</Gras> ({fmtEntier(d.tops.secteurs[0].nb)} signaux).</>}
            {anneeDense && <> L'année la plus dense est <Gras>{anneeDense.annee}</Gras> ({fmtEntier(anneeDense.nb)} signaux).</>}
          </>
        ) : "Aucun signal n'a encore été importé pour ce périmètre."}
      </ARetenir>
    </Page>
  );
}

/** Les signaux les plus lourds, sur TOUT le périmètre : le classement est
    complet — le serveur rend tous ceux qui portent ce montant —, le tri du
    lecteur porte donc sur l'ensemble. */
function Remarquables({ titre, lignes }: {
  titre: string; lignes: { id: number; periode: string; entreprise: string | null; origine: string | null;
    montant: number | null; estime: boolean | null; nature: string | null; destination: string | null }[];
}) {
  const [cle, setCle] = useState<"montant" | "periode">("montant");
  const [nb, setNb] = useState(FENETRE);
  const triees = useMemo(() => [...lignes].sort((a, b) => cle === "periode"
    ? b.periode.localeCompare(a.periode) || (b.montant ?? -1) - (a.montant ?? -1)
    : (b.montant ?? -Infinity) - (a.montant ?? -Infinity)), [lignes, cle]);
  if (!lignes.length) return null;
  return (
    <CarteRapport titre={titre}>
      <Segments valeur={cle} onChange={c => { setCle(c as typeof cle); setNb(FENETRE); }}
        options={[{ cle: "montant", label: "Montant" }, { cle: "periode", label: "Période" }]} />
      <View>
        {triees.slice(0, nb).map((l, i) => (
          <LigneRang key={l.id} rang={i + 1} premiere={i === 0} nom={l.entreprise ?? "—"}
            sous={[l.origine && l.destination ? `${l.origine} → ${l.destination}` : l.origine ?? l.destination,
              l.nature, cle === "montant" ? moisEnClair(l.periode) : null].filter(Boolean).join(" · ")}
            valeur={cle === "periode" ? moisEnClair(l.periode)
              : l.montant == null ? "—" : `${l.estime ? "≈ " : ""}${fmtMontant(l.montant)}`} />
        ))}
      </View>
      {nb < triees.length && <Suite reste={triees.length - nb} onPress={() => setNb(n => n + 20)} />}
    </CarteRapport>
  );
}

// ── Les investisseurs ────────────────────────────────────────────────────────

function resumeEntreprises(f: FiltresEntreprises): string[] {
  return [
    ...f.origines.map(x => `de ${x}`), ...f.destinations.map(x => `vers ${x}`),
    ...f.secteurs, ...f.sousSecteurs.map(x => x.nom), ...f.activites,
    ...(f.recherche ? [`« ${f.recherche} »`] : []),
  ];
}

const TRIS_INVESTISSEURS: { cle: TriInvestisseurs; label: string }[] = [
  { cle: "capex", label: "Montant" }, { cle: "projets", label: "Projets" }, { cle: "pays", label: "Pays" },
];

function RapportEntreprises({ brut }: { brut?: string }) {
  const { colonnes } = useGrille();
  const f = useMemo(() => lireFiltres<FiltresEntreprises>(brut, FILTRES_ENTREPRISES_VIDES), [brut]);
  const [tri, setTri] = useState<TriInvestisseurs>("capex");
  const [nb, setNb] = useState(FENETRE);
  const q = useRapportEntreprises(f, tri);
  const d = q.data;
  const periode = periodeEnClair(d?.kpis.annees);
  const filtres = resumeEntreprises(f);

  if (!d) {
    return (
      <Page perimetre={PERIMETRE_AFRIQUE} periode={null} filtres={filtres}>
        {enPanne(q) ? <EtatErreur onRetry={() => q.refetch()} /> : <Attente />}
      </Page>
    );
  }
  const k = d.kpis;
  const colInvestisseurs = colNombre("investisseurs", "Investisseurs", "investisseur");
  const colProjets = colNombre("projets", "Projets", "projet");
  const valeurTri = (l: (typeof d.actifs)[number]) =>
    tri === "capex" ? fmtMontant(l.capex) : tri === "projets" ? fmtEntier(l.projets) : `${fmtEntier(l.pays)} pays`;

  return (
    <Page perimetre={PERIMETRE_AFRIQUE} periode={periode} filtres={filtres} note={NOTE_MONTANTS}>
      {/* LES COMPTEURS COMPTENT DES ENTREPRISES, pas des projets — sauf le
          deuxième, qui donne le volume qu'elles portent. La part du Sénégal
          est une FRACTION : « 200 » ne dit rien sans son dénominateur. */}
      <Kpis colonnes={colonnes} items={[
        { label: "Investisseurs", valeur: fmtEntier(k.investisseurs),
          note: `${fmtPart(k.un_seul_projet, k.investisseurs)} n'ont annoncé qu'un seul projet` },
        { label: "Projets annoncés", valeur: fmtEntier(k.projets),
          note: k.projets_par_investisseur != null
            ? `${k.projets_par_investisseur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} par investisseur` : null },
        { label: "Pays d'origine", valeur: fmtEntier(k.origines),
          note: d.origines?.[0] ? `${d.origines[0].nom} en tête, ${fmtEntier(d.origines[0].investisseurs)} investisseurs` : null },
        { label: `Part du ${PAYS_REFERENCE}`, valeur: fmtPart(k.au_senegal, k.investisseurs),
          note: `${fmtEntier(k.au_senegal)} investisseurs sur ${fmtEntier(k.investisseurs)}` },
      ]} />

      <ClassementTrie titre="Pays d'origine des investisseurs" drapeaux
        colonnes={[COL_MONTANT, colInvestisseurs, colProjets]}
        lignes={(d.origines ?? []).map(o => ({ nom: o.nom, iso: o.iso,
          valeurs: { capex: o.capex, investisseurs: o.investisseurs, projets: o.projets } }))} />

      <Paire>
        <Moitie>
          <ClassementTrie titre="Secteurs les plus investis"
            colonnes={[COL_MONTANT, colProjets]}
            lignes={(d.secteurs ?? []).map(x => ({ nom: x.nom, valeurs: { capex: x.capex, projets: x.projets } }))} />
        </Moitie>
        <Moitie>
          <ClassementTrie titre="Activités menées"
            colonnes={[COL_MONTANT, colProjets]}
            lignes={(d.activites ?? []).map(x => ({ nom: x.nom, valeurs: { capex: x.capex, projets: x.projets } }))} />
        </Moitie>
      </Paire>

      {/* LE SOUS-SECTEUR NE SE LIT PAS SEUL : « Other » vit sous vingt-quatre
          secteurs chez fDi. Son secteur l'accompagne, sur la ligne d'en dessous. */}
      <ClassementTrie titre="Sous-secteurs les plus investis"
        colonnes={[COL_MONTANT, colProjets]}
        lignes={(d.sous_secteurs ?? []).map(x => ({ nom: x.nom, detail: x.parent,
          valeurs: { capex: x.capex, projets: x.projets } }))} />

      {/* LE CLASSEMENT NOMMÉ, et une marque qui répond sur la ligne même :
          « celui-là est-il déjà venu au Sénégal ? ». Un grand investisseur qui
          n'y est jamais venu est une cible de prospection. */}
      <CarteRapport titre="Classement des investisseurs">
        <Segments valeur={tri} onChange={c => { setTri(c as TriInvestisseurs); setNb(FENETRE); }}
          options={TRIS_INVESTISSEURS.map(t => ({ cle: t.cle, label: t.label }))} />
        <View style={q.isPlaceholderData ? { opacity: 0.5 } : null}>
          {d.actifs.slice(0, nb).map((l, i) => (
            <LigneRang key={`${l.nom}|${l.origine ?? ""}`} rang={i + 1} premiere={i === 0} nom={l.nom}
              sous={[l.origine, tri !== "projets" ? `${fmtEntier(l.projets)} ${accorder(l.projets, "projet")}` : null,
                tri !== "pays" ? `${fmtEntier(l.pays)} pays` : null,
                tri !== "capex" && l.capex != null ? `${fmtMontant(l.capex)} investis` : null,
                l.a0 != null ? (l.a0 === l.a1 ? `${l.a0}` : `${l.a0}–${l.a1}`) : null].filter(Boolean).join(" · ")}
              marque={l.au_senegal ? `Présent au ${PAYS_REFERENCE}` : null}
              valeur={valeurTri(l)} />
          ))}
        </View>
        {nb < d.actifs.length && <Suite reste={d.actifs.length - nb} onPress={() => setNb(n => n + 20)} />}
        {k.investisseurs > d.actifs.length && (
          <Text style={s.note}>Les {fmtEntier(d.actifs.length)} premiers sur {fmtEntier(k.investisseurs)} investisseurs.</Text>
        )}
      </CarteRapport>

      {/* LE MÊME CLASSEMENT, RAMENÉ AU SÉNÉGAL : le compte et le montant ne
          retiennent que les projets annoncés ICI. */}
      <ClassementTrie titre={`Investisseurs au ${PAYS_REFERENCE}`} drapeaux
        colonnes={[COL_MONTANT, colProjets]}
        lignes={(d.senegal ?? []).map(x => ({ nom: x.nom, iso: x.iso, detail: x.origine,
          valeurs: { capex: x.capex, projets: x.projets } }))} />

      <ARetenir>
        {k.investisseurs > 0 ? (
          <>
            Sur {periode}, <Gras>{fmtEntier(k.investisseurs)} investisseurs</Gras> venus de{" "}
            <Gras>{fmtEntier(k.origines)} pays</Gras> ont annoncé <Gras>{fmtEntier(k.projets)} projets</Gras> en{" "}
            {PERIMETRE_AFRIQUE}, soit{" "}
            <Gras>{k.projets_par_investisseur?.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</Gras> projets par
            investisseur — <Gras>{fmtPart(k.un_seul_projet, k.investisseurs)}</Gras> n'en ont annoncé qu'un seul.
            Enfin, <Gras>{fmtEntier(k.au_senegal)}</Gras> ont déjà annoncé un projet au {PAYS_REFERENCE} —{" "}
            <Gras>{fmtPart(k.au_senegal, k.investisseurs)}</Gras> du relevé : les{" "}
            <Gras>{fmtEntier(k.investisseurs - k.au_senegal)}</Gras> autres n'y sont jamais venus.
          </>
        ) : "Aucun investisseur ne correspond à ce périmètre."}
      </ARetenir>
    </Page>
  );
}

const s = creerStyles(() => ({
  page: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  entete: { gap: 3, marginBottom: 2 },
  surtitre: { ...TYPO.micro, color: T.bleu },
  perimetre: { fontSize: 27, lineHeight: 33, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.6 },
  source: { fontSize: 12, lineHeight: 17, fontFamily: POLICE.normal, color: T.gris },
  filtres: { fontSize: 12, lineHeight: 17, fontFamily: POLICE.demi, color: T.texte, marginTop: 3 },
  paire: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  zoneNom: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.gris, marginTop: -4 },
  note: { fontSize: 11, lineHeight: 16, fontFamily: POLICE.normal, color: T.gris },
  notePage: { fontSize: 11, lineHeight: 16, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", paddingHorizontal: 12, marginTop: 4 },
  suite: { alignSelf: "center", fontSize: 12.5, fontFamily: POLICE.gras, color: T.bleu, paddingVertical: 6, paddingHorizontal: 12 },
  titreSection: { marginTop: 6 },
  titreSectionTexte: { fontSize: 18, lineHeight: 24, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.3 },
}));
