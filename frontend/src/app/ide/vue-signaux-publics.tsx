"use client";

// Signaux d'investissement — la lecture publique.
//
// CE QUE CETTE VUE SERT. Un projet annoncé est un fait ; un signal est une
// INTENTION — une entreprise qui étudie un site, lève des fonds, nomme un
// responsable régional. On ne vient pas ici mesurer un flux, on vient trouver
// qui approcher et à quel stade.
//
// ELLE SE LIT COMME CELLE DES PROJETS, et ce n'est pas une paresse : les deux
// vues sont voisines dans le même écran, et l'on passe de l'une à l'autre. Même
// colonne de filtres, même en-tête, même carte — période en haut, nom en
// grand, pied en deux colonnes. Ce qui change, ce sont les champs, pas la
// grammaire.
//
// CE QUE LA CARTE MONTRE, ET CE QU'ELLE LAISSE À LA FICHE. Trois champs et
// rien de plus : l'entreprise, d'où part l'intention, où elle va. Le stade et
// les montants sont dans la fiche — les montants sont rarement renseignés à ce
// stade, et une carte qui dit tout ne se parcourt plus, elle se lit.
//
// LES AUTRES DESTINATIONS NE DISPARAISSENT PAS POUR AUTANT : la carte n'a la
// place que d'une, mais taire les suivantes ferait croire à une cible unique.
// Le compte est donc lisible à côté, et l'infobulle les donne toutes.

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import DrapeauPays from "@/components/shared/DrapeauPays";
import FicheModal, { FicheFait, FicheFaits, FichePuces, FicheRubrique } from "@/components/shared/FicheModal";
import { creerMagasinFiche, useFicheOuverte, type MagasinFiche } from "@/lib/magasinFiche";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonChartGrid } from "@/components/shared/Skeleton";
import { useDebounced } from "@/lib/useDebounced";
import { useDonnees } from "@/lib/donnees";
import { CurseurPlageNace } from "@/components/shared/CurseurNace";
import { API, BadgePeriode, CARTE_CLIQUABLE, ETIQ, FacetteUnique, Filet,
         moisEnClair, moisEnPhrase, montantFdi, Pagination, PaysFdi, survolCarte,
         TITRE_FACETTE } from "./partage";

/** Ce que le lecteur peut restreindre.

    L'ORDRE DES FACETTES SUIT LE TRAJET. D'OÙ part l'intention, OÙ elle va —
    les deux questions géographiques se lisent ensemble, comme sur la carte où
    origine et destination se font face — puis dans quoi, et pour y faire quoi.

    AUCUNE FACETTE N'EST COCHÉE AU DÉPART : la colonne vide montre tout. Il n'y
    a donc pas de ligne « Tous les pays », qui ferait croire à un filtre là où
    il n'y en a pas ; recliquer sur la valeur retenue la retire.

    LA NATURE DU SIGNAL FERME LA COLONNE, et c'est la facette qui décide du
    geste commercial : un projet à l'étude s'approche aujourd'hui, une levée de
    fonds se suit, une nomination régionale s'observe. Elle vient en dernier
    parce qu'on la lit après avoir cerné qui, où et dans quoi — mais c'est
    souvent sur elle qu'on repart. */
export type FiltresSignaux = {
  origine: string; destination: string; secteur: string; activite: string;
  /** Les bornes d'années retenues. NULLES quand toute la période est prise :
      la colonne ne compte alors pas ce filtre comme actif, et une remise à
      zéro les remet à null plutôt qu'aux bornes du relevé. */
  anneeMin: number | null; anneeMax: number | null;
  recherche: string;
};
export const FILTRES_SIGNAUX_VIDES: FiltresSignaux = {
  origine: "", destination: "", secteur: "", activite: "",
  anneeMin: null, anneeMax: null, recherche: "",
};

export type Valeur = { id: number; libelle: string | null; court?: string | null;
                /** La définition publiée par fDi, pour les STADES seulement.
                    Nulle quand la ligne n'a pas été rapprochée du référentiel. */
                definition?: string | null;
                nature?: "pays" | "region" | null };
export type Signal = {
  id: number; periode: string;
  entreprise: string | null; parent: string | null;
  origine: string | null; origine_iso: string | null;
  capex_musd: number | null; capex_estime: boolean | null;
  funding_musd: number | null; funding_estime: boolean | null;
  description_fr: string | null;
  destinations: Valeur[]; secteurs: Valeur[]; activites: Valeur[]; natures: Valeur[];
};
type Compte = { nom: string; nb: number; nature?: "pays" | "region" };
type Perimetre = {
  annees: [number | null, number | null]; total_signaux: number;
  origines: Compte[]; destinations: Compte[];
  secteurs: Compte[]; activites: Compte[];
};
type Reponse = {
  kpis: { signaux: number; annees: [number | null, number | null];
          a_completer: number; plancher: boolean };
  page: number; pages: number; signaux: Signal[];
};

const PAR_PAGE = 30;

/** Le périmètre du relevé, tel qu'il a été interrogé chez fDi : « Dest =
    Africa ». Il qualifie la page comme « Projets reçus » qualifie celle des
    projets — il ne se déduit pas des lignes affichées, il dit ce que la
    plateforme a cherché à couvrir.

    Écrit ici et nulle part ailleurs : le jour où un second périmètre sera
    relevé, c'est de la base qu'il devra venir, et cette constante sera le seul
    endroit à reprendre. */
const PERIMETRE = "Afrique";

/** L'adresse du périmètre. Elle est construite ici et employée par LES DEUX
    composants — la colonne de filtres et la liste : la clé de cache étant
    l'URL, ils partagent le même téléchargement sans se connaître. */
function urlPerimetre(f: FiltresSignaux, recherche: string,
                      a0: number | null, a1: number | null): string {
  const p = new URLSearchParams();
  // LES ANNÉES ARRIVENT DÉJÀ AMORTIES. Un curseur qu'on fait glisser passe par
  // toutes les valeurs intermédiaires ; sans le délai, chaque pixel parcouru
  // vaudrait une requête de périmètre et une de liste.
  if (a0 != null) p.set("annee_min", String(a0));
  if (a1 != null) p.set("annee_max", String(a1));
  if (f.origine) p.set("origine", f.origine);
  if (f.secteur) p.set("secteurs", f.secteur);
  if (f.activite) p.set("activites", f.activite);
  if (f.destination) p.set("destination", f.destination);
  if (recherche.trim()) p.set("recherche", recherche.trim());
  return `${API}/fdi/public/signaux/perimetre?${p}`;
}

/** La colonne de filtres, montée dans la barre latérale de la page — celle des
    projets, la même. Mettre ces filtres dans le contenu aurait laissé une
    colonne vide à gauche et poussé les cartes vers le bas. */
export function FiltresSignauxPanneau({ filtres, onChange }: {
  filtres: FiltresSignaux; onChange: (f: FiltresSignaux) => void;
}) {
  const recherche = useDebounced(filtres.recherche, 300);
  const a0 = useDebounced(filtres.anneeMin, 300);
  const a1 = useDebounced(filtres.anneeMax, 300);
  const per = useDonnees<Perimetre>(urlPerimetre(filtres, recherche, a0, a1), { garder: true }).data;
  if (!per) return null;
  const set = (k: keyof FiltresSignaux) => (v: string) => onChange({ ...filtres, [k]: v });
  const [b0, b1] = per.annees;
  return (
    <>
      <div style={{ height: 1, background: "var(--filet)", marginBottom: 18 }} />
      {/* QUAND. La période ouvre la colonne, avant même le pays d'origine :
          c'est le cadre dans lequel tout le reste se lit. « Les intentions
          américaines » ne veut rien dire sans dire de quand — un signal de 2011
          et un de 2026 ne se démarchent pas de la même façon.

          LES BORNES VIENNENT DU RELEVÉ ENTIER, non du périmètre filtré : le
          service les calcule hors de toute condition. Sans cela, réduire la
          plage rétrécirait le curseur à la sélection qu'on vient de faire, et
          l'on ne pourrait plus l'élargir.

          TOUTE LA PÉRIODE VAUT « PAS DE FILTRE » : les bornes retombent alors à
          null, le filtre ne se compte pas parmi les actifs, et l'adresse de la
          page n'en porte pas la trace. */}
      {b0 != null && b1 != null && b1 > b0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={TITRE_FACETTE}>Période</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--bleu)",
              fontVariantNumeric: "tabular-nums" as const }}>
              {filtres.anneeMin ?? b0} – {filtres.anneeMax ?? b1}
            </span>
          </div>
          <CurseurPlageNace min={b0} max={b1}
            debut={filtres.anneeMin ?? b0} fin={filtres.anneeMax ?? b1}
            onChange={(a, b) => onChange({ ...filtres,
              anneeMin: a === b0 && b === b1 ? null : a,
              anneeMax: a === b0 && b === b1 ? null : b })} />
          <div style={{ height: 18 }} />
          <Filet />
        </div>
      )}
      {/* D'OÙ PART L'INTENTION. C'est la première question d'une agence de
          promotion : quels pays regardent l'Afrique, et lesquels regardent le
          Sénégal. Un signal a UNE origine — contrairement à ses destinations,
          qui peuvent être plusieurs. */}
      <FacetteUnique titre="Pays d'origine" options={per.origines} valeur={filtres.origine}
        onChange={set("origine")} chercher="Rechercher un pays…" />
      {/* OÙ ELLE VA. Pays et régions du monde dans une seule liste : ce sont
          deux référentiels, mais une seule question pour qui lit. « Afrique »
          n'est pas un pays, et le ranger à part obligerait à choisir deux fois
          — alors qu'un signal continental est exactement ce qu'on cherche
          quand on démarche. */}
      {/* Le filet sépare les régions des pays : le groupe porte la nature, que
          le serveur trie régions d'abord.

          LA RECHERCHE NE PORTE QUE SUR LES PAYS. Les régions sont sept, en tête
          de liste, et se prennent du regard ; les faire répondre à la frappe
          remonterait « Afrique » sur « afr » au-dessus des pays africains. */}
      <FacetteUnique titre="Destination" valeur={filtres.destination}
        options={per.destinations.map(d => ({ ...d, groupe: d.nature,
          cherchable: d.nature === "pays" }))}
        onChange={set("destination")} chercher="Rechercher un pays…" />
      <FacetteUnique titre="Secteurs économiques" options={per.secteurs} valeur={filtres.secteur}
        onChange={set("secteur")} />
      {/* L'activité dit ce que l'entreprise vient FAIRE — usine, siège,
          logistique — indépendamment de son secteur. Les deux se croisent :
          « Software & IT services » en R&D n'est pas le même prospect qu'en
          centre d'appels. */}
      <FacetteUnique titre="Activités économiques" options={per.activites} valeur={filtres.activite}
        onChange={set("activite")} />
      {/* PLUS DE FILTRE SUR LA NATURE DU SIGNAL. Les cinq stades — financement
          levé, stratégie d'investissement, projet à l'étude, nomination
          régionale, contrat de fourniture — restent lisibles sur la pastille de
          chaque carte et sur la fiche ; ils ne servent plus à trancher la
          liste. */}
    </>
  );
}

export default function VueSignauxPublics({ filtres, onChange }: {
  filtres: FiltresSignaux; onChange: (f: FiltresSignaux) => void;
}) {
  const [page, setPage] = useState(1);
  // Le signal dont la fiche est ouverte. Il vit dans un petit magasin
  // (lib/magasinFiche) : seul l'hôte de la fiche s'y abonne, et l'ouvrir ou la
  // fermer ne réaffiche pas la vue et ses trente cartes. La fiche est montée
  // hors de la grille : une modale enfant d'une carte hériterait de son
  // curseur et de son clic.
  const [ficheSignal] = useState(() => creerMagasinFiche<Signal>());
  const recherche = useDebounced(filtres.recherche, 300);
  const a0 = useDebounced(filtres.anneeMin, 300);
  const a1 = useDebounced(filtres.anneeMax, 300);

  // Un changement de filtre ramène au premier écran : rester en page 6 d'un
  // résultat qui n'en compte plus qu'une n'aurait aucun sens.
  const clef = urlPerimetre(filtres, recherche, a0, a1);
  const [vue, setVue] = useState(clef);
  if (clef !== vue) { setVue(clef); setPage(1); }

  const url = useMemo(() => {
    const p = new URLSearchParams(urlPerimetre(filtres, recherche, a0, a1).split("?")[1]);
    p.set("page", String(page));
    p.set("par_page", String(PAR_PAGE));
    return `${API}/fdi/public/signaux?${p}`;
  }, [filtres, recherche, a0, a1, page]);

  const q = useDonnees<Reponse>(url, { garder: true });
  if (q.isError) return <ErreurChargement onRetry={() => q.refetch()} />;
  if (!q.data) return <SkeletonChartGrid />;

  const d = q.data;
  const k = d.kpis;
  const periode = k.annees[0] == null ? null
    : k.annees[0] === k.annees[1] ? `${k.annees[0]}` : `${k.annees[0]} — ${k.annees[1]}`;

  return (
    <div>
      {/* En-tête : la destination, sa qualification, la période couverte — et
          la recherche sur la même ligne, alignée à droite. C'est EXACTEMENT
          celui de la vue Projets, jetons compris : la petite étiquette
          rectangulaire qualifie, la pastille de période date. Les deux vues
          sont voisines dans le même écran ; deux en-têtes différents pour la
          même page donneraient l'impression de deux produits. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const,
        marginBottom: 20 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%",
          background: "var(--bleu-action)", flexShrink: 0 }} />
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--encre)", lineHeight: 1.1 }}>
          Signaux d&apos;investissement
        </h2>
        <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 7px",
          borderRadius: 5, background: "var(--fond)", border: "1px solid var(--bordure-forte)",
          fontSize: 9, fontWeight: 700, color: "var(--gris)", textTransform: "uppercase" as const,
          letterSpacing: "0.05em", flexShrink: 0 }}>
          {PERIMETRE}
        </span>
        {periode && <BadgePeriode>{periode}</BadgePeriode>}
        <div style={{ marginLeft: "auto", position: "relative" as const, minWidth: 200,
          flex: "0 1 300px" }}>
          <Search size={13} style={{ position: "absolute" as const, left: 12, top: "50%",
            transform: "translateY(-50%)", color: "var(--gris)" }} />
          <input value={filtres.recherche}
            onChange={e => onChange({ ...filtres, recherche: e.target.value })}
            placeholder="Rechercher"
            className="ds-champ" style={{ height: 36, padding: "0 10px 0 34px", fontSize: 12.5 }} />
        </div>
      </div>

      {d.signaux.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "70px 0" }}>
          Aucun signal ne correspond à cette recherche.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 14,
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {d.signaux.map(s => (
            <CarteSignal key={s.id} s={s} onOuvrir={() => ficheSignal.ouvrir(s)} />
          ))}
        </div>
      )}

      <HoteFicheSignal magasin={ficheSignal} />

      <Pagination courante={d.page} pages={d.pages} onPage={setPage} nom="signaux" />
    </div>
  );
}

/** Une carte : le MÊME gabarit que celle des projets annoncés — période en
    haut, nom en grand, pied en deux colonnes, survol bleu. Seuls les champs
    changent : d'où vient l'intention, où elle va. Le stade est dans la
    fiche. */
function CarteSignal({ s, onOuvrir }: { s: Signal; onOuvrir: () => void }) {
  return (
    <article onClick={onOuvrir} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOuvrir(); } }}
      style={CARTE_CLIQUABLE} {...survolCarte("bleu")}>

      <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--gris)",
        marginBottom: 10 }}>
        {moisEnClair(s.periode)}
      </span>

      <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "var(--encre)", lineHeight: 1.25,
        letterSpacing: "-0.01em", margin: 0 }}>{s.entreprise ?? "—"}</h3>

      {/* Le pied, en deux colonnes séparées d'un filet — la forme des cartes de
          la plateforme. D'OÙ part l'intention, OÙ elle va. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14,
        paddingTop: 13, borderTop: "1px solid var(--bordure)" }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ ...ETIQ, display: "block", marginBottom: 4 }}>Origine</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5,
            fontWeight: 700, color: "var(--encre)", overflow: "hidden" }}>
            <DrapeauPays iso={s.origine_iso} nom={s.origine ?? ""} taille={14} sansIso="rien" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.origine ?? "—"}
            </span>
          </span>
        </div>
        <div style={{ minWidth: 0, paddingLeft: 14, borderLeft: "1px solid var(--bordure)" }}>
          <span style={{ ...ETIQ, display: "block", marginBottom: 4 }}>Destination</span>
          {s.destinations.length === 0 ? (
            <span style={{ fontSize: 13.5, color: "var(--gris)" }}>—</span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}
              title={s.destinations.map(v => v.libelle).join(" · ")}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--encre)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.destinations[0].libelle}
              </span>
              {/* LES AUTRES DESTINATIONS NE DISPARAISSENT PAS. Une carte n'a la
                  place que d'une, mais taire les suivantes ferait croire à une
                  cible unique. Le compte est donc lisible, et l'infobulle les
                  donne toutes. */}
              {s.destinations.length > 1 && (
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--bleu)",
                  background: "rgb(var(--bleu-rgb) / 0.10)", borderRadius: 999,
                  padding: "2px 8px", flexShrink: 0, whiteSpace: "nowrap" }}>
                  +{s.destinations.length - 1}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

    </article>
  );
}


/** L'hôte de la fiche : le seul composant abonné au magasin. */
function HoteFicheSignal({ magasin }: { magasin: MagasinFiche<Signal> }) {
  const s = useFicheOuverte(magasin);
  return s ? <FicheSignal s={s} onClose={magasin.fermer} /> : null;
}

/** La fiche d'un signal — le dessin commun des fiches (FicheModal) : TOUT ce
    que la base en sait.

    En tête, ce qu'est la fiche ; le nom de l'entreprise ; le mois où le signal
    a été repéré et la source. Puis les faits : les fonds levés et
    l'investissement prévu — souvent absents à ce stade, ce que la fiche dit
    plutôt que de taire la ligne —, et le pays d'origine. Les destinations,
    qui peuvent être plusieurs et mêler pays et régions, toutes montrées. Le
    détail — le stade de l'intention (« Financement levé », « Projet à
    l'étude »…) en tête, écrit en texte et non en badge —, ce que ce stade
    veut dire dans les mots de fDi, la description pour finir.

    Rien n'est retéléchargé : la liste porte déjà toutes ces valeurs, la fiche
    s'ouvre donc complète. */
export function FicheSignal({ s, onClose }: { s: Signal; onClose: () => void }) {
  const fonds = montantFdi(s.funding_musd, s.funding_estime, "M$");
  const prevu = montantFdi(s.capex_musd, s.capex_estime, "M$");
  const noms = (v: Valeur[]) => v.map(x => x.libelle).filter((x): x is string => !!x);
  const destinations = noms(s.destinations), secteurs = noms(s.secteurs), activites = noms(s.activites);
  // Le stade sous son libellé COURT (« Financement levé ») — celui des
  // filtres ; l'intitulé complet de fDi est long, et la définition dit le reste
  const stades = s.natures.map(n => n.court ?? n.libelle).filter((x): x is string => !!x);
  // « NOUVELLE STRATÉGIE D'INVESTISSEMENT » NE SE DEVINE PAS : le libellé nomme
  // le stade, il ne le définit pas. La définition vient du référentiel de fDi,
  // jamais du code ; absente, la rubrique ne s'affiche pas.
  const definitions = s.natures.filter(n => n.definition);
  return (
    <FicheModal titre={s.entreprise ?? "Signal"} onClose={onClose} maxWidth={680}
      surtitre={<span className="fiche-surtitre-texte">Signal d&apos;investissement</span>}
      meta={<><span>Repéré en {moisEnPhrase(s.periode)}</span><span>Source : fDi Markets</span></>}>

      <FicheFaits>
        <FicheFait libelle="Fonds levés" vide={!fonds} note={fonds?.note}>{fonds?.valeur ?? "Non communiqués"}</FicheFait>
        <FicheFait libelle="Investissement prévu" vide={!prevu} note={prevu?.note}>{prevu?.valeur ?? "Non communiqué"}</FicheFait>
        <FicheFait libelle="Pays d'origine" vide={!s.origine}><PaysFdi nom={s.origine} iso={s.origine_iso} /></FicheFait>
      </FicheFaits>

      {destinations.length > 0 && (
        <FicheRubrique titre={destinations.length > 1 ? "Destinations" : "Destination"}
          compte={destinations.length > 1 ? destinations.length : undefined}>
          <FichePuces items={destinations} />
        </FicheRubrique>
      )}

      <FicheRubrique titre="Détails du signal">
        <dl className="fiche-liste">
          <dt>{stades.length > 1 ? "Stades de l'intention" : "Stade de l'intention"}</dt>
          <dd>{stades.length ? stades.join(" · ") : "Non renseigné"}</dd>
          <dt>{secteurs.length > 1 ? "Secteurs" : "Secteur"}</dt>
          <dd>{secteurs.length ? secteurs.join(" · ") : "Non renseigné"}</dd>
          <dt>{activites.length > 1 ? "Activités prévues" : "Activité prévue"}</dt>
          <dd>{activites.length ? activites.join(" · ") : "Non renseignée"}</dd>
        </dl>
      </FicheRubrique>

      {definitions.length > 0 && (
        <FicheRubrique titre={definitions.length > 1 ? "Ce que signifient ces stades" : "Ce que signifie ce stade"}>
          <div className="fiche-texte">
            {definitions.map(n => (
              <p key={n.id}>
                {/* Le nom du stade devant sa définition, seulement s'il y en a
                    plusieurs : sinon la ligne du dessus le dit déjà */}
                {definitions.length > 1 && <strong style={{ color: "var(--encre)" }}>{n.court ?? n.libelle} — </strong>}
                {n.definition}
              </p>
            ))}
          </div>
        </FicheRubrique>
      )}

      {/* La page publique est en français : seule la description française est
          affichée. L'anglais de la source reste en base et sert la recherche. */}
      {s.description_fr && (
        <FicheRubrique titre="Description">
          <p className="fiche-texte" style={{ margin: 0 }}>{s.description_fr}</p>
        </FicheRubrique>
      )}
    </FicheModal>
  );
}
