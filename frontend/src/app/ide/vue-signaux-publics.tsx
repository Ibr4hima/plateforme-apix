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
import { badge_bleu, badge_gris, badge_orange, badge_vert, badge_violet } from "@/lib/couleurs";
import { API, BadgePeriode, boutonPage, ETIQ, FacetteUnique, fmtNombre, LigneFiche,
         moisEnClair, TEXTE_DESC, TitreFiche } from "./partage";

/** Ce que le lecteur peut restreindre. L'API sait aussi filtrer par
    destination et par stade — la colonne ne les propose plus, mais les routes
    les gardent : le jour où on les remettra, il n'y aura qu'un composant à
    ajouter. Les porter dans cet état sans que rien ne les pilote aurait fait
    croire à des filtres actifs. */
export type FiltresSignaux = { secteur: string; activite: string; recherche: string };
export const FILTRES_SIGNAUX_VIDES: FiltresSignaux = {
  secteur: "", activite: "", recherche: "",
};

type Valeur = { id: number; libelle: string | null; court?: string | null;
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
  destinations: Compte[]; secteurs: Compte[]; activites: Compte[]; natures: Compte[];
};
type Reponse = {
  kpis: { signaux: number; annees: [number | null, number | null];
          a_completer: number; plancher: boolean };
  page: number; pages: number; signaux: Signal[];
};

const PAR_PAGE = 24;

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
function urlPerimetre(f: FiltresSignaux, recherche: string): string {
  const p = new URLSearchParams();
  if (f.secteur) p.set("secteurs", f.secteur);
  if (f.activite) p.set("activites", f.activite);
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
  const per = useDonnees<Perimetre>(urlPerimetre(filtres, recherche), { garder: true }).data;
  if (!per) return null;
  const set = (k: keyof FiltresSignaux) => (v: string) => onChange({ ...filtres, [k]: v });
  return (
    <>
      <div style={{ height: 1, background: "var(--fond)", marginBottom: 18 }} />
      <FacetteUnique titre="Secteur" options={per.secteurs} valeur={filtres.secteur}
        onChange={set("secteur")} vide="Tous les secteurs" />
      {/* L'activité dit ce que l'entreprise vient FAIRE — usine, siège,
          logistique — indépendamment de son secteur. Les deux se croisent :
          « Software & IT services » en R&D n'est pas le même prospect qu'en
          centre d'appels. */}
      <FacetteUnique titre="Activité prévue" options={per.activites} valeur={filtres.activite}
        onChange={set("activite")} vide="Toutes les activités" />
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

  // Un changement de filtre ramène au premier écran : rester en page 6 d'un
  // résultat qui n'en compte plus qu'une n'aurait aucun sens.
  const clef = `${filtres.secteur}|${filtres.activite}|${recherche}`;
  const [vue, setVue] = useState(clef);
  if (clef !== vue) { setVue(clef); setPage(1); }

  const url = useMemo(() => {
    const p = new URLSearchParams(urlPerimetre(filtres, recherche).split("?")[1]);
    p.set("page", String(page));
    p.set("par_page", String(PAR_PAGE));
    return `${API}/fdi/public/signaux?${p}`;
  }, [filtres, recherche, page]);

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

      {d.pages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
          gap: 12, marginTop: 28 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            style={boutonPage(page > 1)}>Précédents</button>
          <span style={{ fontSize: 12.5, color: "var(--gris)" }}>
            Page {d.page} sur {d.pages}
          </span>
          <button disabled={page >= d.pages} onClick={() => setPage(p => p + 1)}
            style={boutonPage(page < d.pages)}>Suivants</button>
        </div>
      )}
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
const BADGES: Record<string, React.CSSProperties> = {
  "Projet à l'étude": badge_vert,
  "Stratégie d'investissement": badge_bleu,
  "Financement levé": badge_violet,
  "Nomination régionale": badge_orange,
};

function PastilleStade({ v }: { v: Valeur }) {
  const court = v.court ?? v.libelle ?? "";
  return (
    <span title={v.libelle ?? undefined}
      style={{ ...(BADGES[court] ?? badge_gris), whiteSpace: "nowrap", flexShrink: 0 }}>
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
      style={{ display: "flex", flexDirection: "column", background: "var(--carte)",
        border: "1px solid rgb(var(--encre-rgb) / 0.12)", borderRadius: 16,
        padding: "15px 17px 13px", cursor: "pointer",
        transition: "border-color 0.18s, box-shadow 0.18s, transform 0.18s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgb(var(--bleu-rgb) / 0.38)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgb(var(--ombre-rgb) / 0.10)";
        e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgb(var(--encre-rgb) / 0.12)";
        e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>

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
          {s.destinations.length === 0
            ? <span style={{ fontSize: 14, color: "var(--gris)" }}>—</span>
            : s.destinations.map(v => (
                <span key={v.id} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--encre)",
                  background: "var(--carte-douce)", border: "1px solid var(--filet)",
                  borderRadius: 8, padding: "3px 10px", whiteSpace: "nowrap" }}>
                  {v.libelle}
                </span>
              ))}
        </span>
      </div>

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
