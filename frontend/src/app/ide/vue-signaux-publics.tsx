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
// colonne de filtres, même en-tête, même carte — période en haut à gauche,
// étiquette en haut à droite, nom en grand, pied en deux colonnes. Ce qui
// change, ce sont les champs, pas la grammaire.
//
// CE QUE LA CARTE MONTRE, ET CE QU'ELLE LAISSE À LA FICHE. Quatre champs et
// rien de plus : le stade, l'entreprise, d'où part l'intention, où elle va.
// Les montants n'y figurent pas — ils sont rarement renseignés à ce stade, et
// une carte qui dit tout ne se parcourt plus, elle se lit.
//
// LES AUTRES DESTINATIONS NE DISPARAISSENT PAS POUR AUTANT : la carte n'a la
// place que d'une, mais taire les suivantes ferait croire à une cible unique.
// Le compte est donc lisible à côté, et l'infobulle les donne toutes.

import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";

import DrapeauPays from "@/components/shared/DrapeauPays";
import FicheModal from "@/components/shared/FicheModal";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonChartGrid } from "@/components/shared/Skeleton";
import { useDebounced } from "@/lib/useDebounced";
import { useDonnees } from "@/lib/donnees";
import { badge_ambre, badge_bleu, badge_gris, badge_orange, badge_vert,
         badge_violet } from "@/lib/couleurs";
import { CurseurPlageNace } from "@/components/shared/CurseurNace";
import { API, BadgePeriode, CARTE_CLIQUABLE, ETIQ, FacetteUnique, Filet, fmtNombre,
         LigneFiche, ListeJetons, moisEnClair, Pagination, survolCarte, TEXTE_DESC,
         TITRE_FACETTE, TitreFiche } from "./partage";

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

type Valeur = { id: number; libelle: string | null; court?: string | null;
                /** La définition publiée par fDi, pour les STADES seulement.
                    Nulle quand la ligne n'a pas été rapprochée du référentiel. */
                definition?: string | null;
                nature?: "pays" | "region" | null };
type Signal = {
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
      <div style={{ height: 1, background: "var(--fond)", marginBottom: 18 }} />
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
  // Le signal dont la fiche est ouverte. Elle est montée hors de la grille :
  // une modale enfant d'une carte hériterait de son curseur et de son clic.
  const [ouvert, setOuvert] = useState<number | null>(null);
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
            style={{ width: "100%", padding: "8px 10px 8px 34px", borderRadius: 999,
              border: "1px solid var(--bordure-forte)", background: "var(--carte)",
              fontSize: 12.5, color: "var(--encre)", outline: "none",
              fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const }} />
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
            <CarteSignal key={s.id} s={s} onOuvrir={() => setOuvert(s.id)} />
          ))}
        </div>
      )}

      {ouvert != null && (() => {
        const s = d.signaux.find(x => x.id === ouvert);
        return s ? <FicheSignal s={s} onClose={() => setOuvert(null)} /> : null;
      })()}

      <Pagination courante={d.page} pages={d.pages} onPage={setPage} nom="signaux" />
    </div>
  );
}

/** L'étiquette du stade, dans les badges de la plateforme — les mêmes que
    ceux des cartes de projet. Le stade n'est pas décoratif : il décide si l'on
    décroche le téléphone aujourd'hui ou dans six mois, et c'est la première
    chose que l'œil doit trouver sur la carte.

    La correspondance porte sur le libellé COURT, qui est celui de la
    nomenclature : un stade ajouté un jour sans teinte déclarée prendra le gris,
    ce qui se voit et se corrige, plutôt que de casser l'affichage. */
/** UNE COULEUR PAR STADE, ET AUCUNE PARTAGÉE. C'est la seule règle qui rend la
    teinte utile : deux stades de même couleur, et la pastille ne distingue plus
    rien — l'œil devrait relire le mot, ce que la couleur était censée épargner.

    Les cinq stades ont donc chacun la leur. « Contrat de fourniture » tombait
    jusqu'ici sur le gris du défaut, faute d'une cinquième teinte déclarée ; la
    charte en porte une, l'ambre, « distincte des quatre mais assortie ».

    Le gris reste le repli, et c'est voulu : un stade que fDi ajouterait demain
    s'afficherait en gris — ce qui se voit et se corrige — plutôt que d'emprunter
    la couleur d'un autre et de mentir en silence. */
const TEINTES: Record<string, string> = {
  "Projet à l'étude": "vert",
  "Stratégie d'investissement": "orange",
  "Financement levé": "violet",
  "Nomination régionale": "bleu",
  "Contrat de fourniture": "ambre",
};
const BADGES: Record<string, React.CSSProperties> = {
  vert: badge_vert, bleu: badge_bleu, violet: badge_violet,
  orange: badge_orange, ambre: badge_ambre,
};

/** La teinte d'un signal — celle de son stade, et donc celle de son survol. Un
    stade ajouté un jour sans teinte déclarée prend le gris, ce qui se voit et
    se corrige, plutôt que de casser l'affichage. */
const teinteDe = (s: Signal) => TEINTES[s.natures[0]?.court ?? ""] ?? "gris";

function PastilleStade({ v }: { v: Valeur }) {
  const court = v.court ?? v.libelle ?? "";
  return (
    <span title={v.libelle ?? undefined}
      style={{ ...(BADGES[TEINTES[court]] ?? badge_gris),
        whiteSpace: "nowrap", flexShrink: 0 }}>
      {court}
    </span>
  );
}

/** Une carte : le MÊME gabarit que celle des projets annoncés — période en haut
    à gauche, étiquette en haut à droite, nom en grand, pied en deux colonnes.
    Seuls les champs changent : d'où vient l'intention, où elle va. */
function CarteSignal({ s, onOuvrir }: { s: Signal; onOuvrir: () => void }) {
  const stade = s.natures[0];
  return (
    <article onClick={onOuvrir} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOuvrir(); } }}
      style={CARTE_CLIQUABLE} {...survolCarte(teinteDe(s))}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gris)" }}>
          {moisEnClair(s.periode)}
        </span>
        {stade && <PastilleStade v={stade} />}
      </div>

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


/** La fiche d'un signal : TOUT ce que la base en sait.

    La carte répond à quatre questions et s'arrête là ; la fiche répond aux
    autres. Elle est construite comme une page, pas comme un formulaire : les
    deux montants ouvrent, le trajet suit sur une ligne, le détail vient en
    liste séparée de filets, la description ferme. Aucun encadré gris — les
    fonds empilés font une fiche lourde.

    Rien n'est retéléchargé : la liste porte déjà toutes ces valeurs. Ouvrir une
    fiche ne doit pas faire attendre. */
function FicheSignal({ s, onClose }: { s: Signal; onClose: () => void }) {
  const liste = (v: Valeur[]) => v.length === 0 ? "—" : v.map(x => x.libelle).join(" · ");
  return (
    <FicheModal maxWidth={620} onClose={onClose}
      titre={
        <span style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" as const }}>
          <span>{s.entreprise ?? "Signal"}</span>
          {s.natures.map(n => <PastilleStade key={n.id} v={n} />)}
        </span>
      }>

      {/* Les deux montants, sans cadre. Ils sont souvent absents à ce stade —
          un tiret le dit, plutôt que de faire disparaître la ligne et laisser
          croire qu'on ne les suit pas. */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 34, flexWrap: "wrap" as const }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12.5, color: "var(--gris)", marginBottom: 6 }}>Fonds levés</p>
          <GrandMontant v={s.funding_musd} estime={s.funding_estime} />
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: "var(--bordure)" }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12.5, color: "var(--gris)", marginBottom: 6 }}>Investissement prévu</p>
          <GrandMontant v={s.capex_musd} estime={s.capex_estime} />
        </div>
      </div>

      {/* Le trajet. À la différence d'un projet, l'arrivée peut être MULTIPLE
          et mêler pays et régions : toutes sont montrées, aucune n'est
          résumée. */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" as const,
        paddingTop: 18, borderTop: "1px solid var(--bordure)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <DrapeauPays iso={s.origine_iso} nom={s.origine ?? ""} taille={17} sansIso="rien" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--encre)" }}>
            {s.origine ?? "—"}
          </span>
        </span>
        <ArrowRight size={15} style={{ color: "var(--gris)", flexShrink: 0, marginTop: 3 }} />
        <span style={{ display: "flex", flexWrap: "wrap", gap: 5, flex: 1, minWidth: 0 }}>
          <ListeJetons valeurs={s.destinations.map(v => v.libelle ?? "—")} />
        </span>
      </div>

      {/* ── CE QUE LE STADE VEUT DIRE ────────────────────────────────────
          « NOUVELLE STRATÉGIE D'INVESTISSEMENT » NE SE DEVINE PAS. Le libellé
          nomme le stade, il ne le définit pas : qui n'a pas le glossaire de
          fDi sous les yeux ne peut pas savoir qu'il s'agit d'une intention
          générale, sans pays encore arrêté, quand « projet à l'étude » désigne
          au contraire un projet dont les pays visés sont connus. La différence
          décide pourtant de ce qu'on fait du signal — on démarche l'un, on
          surveille l'autre.

          UN CADRE À PART, ET NON LA VALEUR D'UNE LIGNE. Les « Détails du
          signal » sont un tableau de champs courts, lus en diagonale ; un
          paragraphe de cinq lignes au milieu en casse la lecture. Le cadre le
          précède, dans le dessin des descriptions de la plateforme — fond
          doux, filet, coins arrondis.

          SANS TITRE : la pastille de l'en-tête nomme déjà le stade, à deux
          centimètres au-dessus, et le premier mot du texte dit de quoi il
          parle. Un intertitre qui reprend une étiquette encore à l'écran fait
          lire deux fois la même chose.

          LE TEXTE VIENT DU RÉFÉRENTIEL, jamais du code : c'est celui de fDi,
          celui qui fait foi, et l'administration peut le reprendre sans qu'on
          redéploie. Absent, le cadre ne s'affiche pas du tout — un encadré
          vide vaut moins que pas d'encadré. */}
      {s.natures.some(n => n.definition) && (
        <div>
          <div style={{ background: "var(--carte-douce)",
            border: "1px solid var(--bordure)", borderRadius: 12, padding: "13px 15px",
            display: "flex", flexDirection: "column" as const, gap: 10 }}>
            {s.natures.filter(n => n.definition).map(n => (
              <p key={n.id} style={{ fontSize: 13, color: "var(--texte)", lineHeight: 1.7 }}>
                {/* Le nom du stade n'est répété DEVANT SA DÉFINITION que
                    lorsqu'il y en a plusieurs : sans lui, on ne saurait plus
                    laquelle explique laquelle. */}
                {s.natures.filter(x => x.definition).length > 1 && (
                  <strong style={{ color: "var(--encre)" }}>{n.libelle} — </strong>
                )}
                {n.definition}
              </p>
            ))}
          </div>
        </div>
      )}

      <div>
        <TitreFiche>Détails du signal</TitreFiche>
        <LigneFiche label="Repéré en">{moisEnClair(s.periode)}</LigneFiche>
        <LigneFiche label={"Stade de l'intention"}>{liste(s.natures)}</LigneFiche>
        <LigneFiche label="Secteur">{liste(s.secteurs)}</LigneFiche>
        <LigneFiche label="Activité prévue">{liste(s.activites)}</LigneFiche>
      </div>

      {/* La page publique est en français : seule la description française est
          affichée. L'anglais de la source reste en base et sert la recherche. */}
      <div>
        <TitreFiche>Description</TitreFiche>
        <p style={s.description_fr ? TEXTE_DESC : { ...TEXTE_DESC, color: "var(--gris)" }}>
          {s.description_fr ?? "—"}
        </p>
      </div>
    </FicheModal>
  );
}

/** Un montant en tête de fiche : la valeur grande, l'unité petite, et
    l'estimation signalée sans occuper la ligne. */
function GrandMontant({ v, estime }: { v: number | null; estime: boolean | null }) {
  if (v == null) return <span style={{ fontSize: 30, fontWeight: 800, color: "var(--gris)" }}>—</span>;
  return (
    <span title={estime ? "Valeur estimée par l'algorithme du Financial Times, non déclarée"
                        : "Valeur déclarée"}
      style={{ fontSize: 30, fontWeight: 800, color: "var(--encre)", letterSpacing: "-0.02em",
        fontVariantNumeric: "tabular-nums" }}>
      {estime ? "≈ " : ""}{fmtNombre(v)}
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gris)" }}> M$</span>
    </span>
  );
}
