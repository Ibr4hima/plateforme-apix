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
import { Search } from "lucide-react";

import DrapeauPays from "@/components/shared/DrapeauPays";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonChartGrid } from "@/components/shared/Skeleton";
import { useDebounced } from "@/lib/useDebounced";
import { useDonnees } from "@/lib/donnees";
import { badge_bleu, badge_gris, badge_orange, badge_vert, badge_violet } from "@/lib/couleurs";
import { API, ETIQ, fmtNombre, LIGNE_FACETTE, moisEnClair, Pastille,
         TITRE_FACETTE } from "./partage";

export type FiltresSignaux = {
  destination: string; nature: string; secteur: string; recherche: string;
};
export const FILTRES_SIGNAUX_VIDES: FiltresSignaux = {
  destination: "", nature: "", secteur: "", recherche: "",
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

/** L'adresse du périmètre. Elle est construite ici et employée par LES DEUX
    composants — la colonne de filtres et la liste : la clé de cache étant
    l'URL, ils partagent le même téléchargement sans se connaître. */
function urlPerimetre(f: FiltresSignaux, recherche: string): string {
  const p = new URLSearchParams();
  if (f.destination) p.set("destination", f.destination);
  if (f.nature) p.set("natures", f.nature);
  if (f.secteur) p.set("secteurs", f.secteur);
  if (recherche.trim()) p.set("recherche", recherche.trim());
  return `${API}/fdi/public/signaux/perimetre?${p}`;
}

/** Une facette à choix unique, dans la colonne de filtres.

    Même forme que celles des projets : titre en petites capitales, pastille,
    libellé, compte à droite. La ligne « Toutes » n'est pas une option de plus
    mais le retour à l'absence de filtre, d'où sa place en tête. */
function Facette({ titre, options, valeur, onChange, vide, grouper = false }: {
  titre: string; options: Compte[]; valeur: string; vide: string;
  onChange: (v: string) => void; grouper?: boolean;
}) {
  if (options.length === 0) return null;
  const groupes: [string | null, Compte[]][] = grouper
    ? [["Régions du monde", options.filter(o => o.nature === "region")],
       ["Pays", options.filter(o => o.nature !== "region")]]
    : [[null, options]];

  const ligne = (o: Compte | null) => {
    const nom = o?.nom ?? "";
    const sel = valeur === nom;
    return (
      <button key={nom || "__tous"} onClick={() => onChange(nom)} style={LIGNE_FACETTE}
        onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "var(--carte-douce)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
        <Pastille coche={sel} />
        <span style={{ fontSize: 12, color: "var(--texte)", fontWeight: sel ? 700 : 400,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {o ? o.nom : vide}
        </span>
        {o && (
          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--gris)",
            fontVariantNumeric: "tabular-nums" }}>{o.nb}</span>
        )}
      </button>
    );
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <span style={{ ...TITRE_FACETTE, display: "block", marginBottom: 8 }}>{titre}</span>
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        {ligne(null)}
        {groupes.map(([etiquette, liste]) => liste.length === 0 ? null : (
          <div key={etiquette ?? "tout"}>
            {etiquette && (
              <p style={{ fontSize: 9, fontWeight: 600, color: "var(--gris)",
                textTransform: "uppercase", letterSpacing: "0.1em",
                padding: "6px 8px 2px", margin: 0 }}>{etiquette}</p>
            )}
            {liste.map(o => ligne(o))}
          </div>
        ))}
      </div>
    </div>
  );
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
      <Facette titre="Destination" options={per.destinations} valeur={filtres.destination}
        onChange={set("destination")} vide="Toutes destinations" grouper />
      <Facette titre="Stade de l'intention" options={per.natures} valeur={filtres.nature}
        onChange={set("nature")} vide="Tous les stades" />
      <Facette titre="Secteur" options={per.secteurs} valeur={filtres.secteur}
        onChange={set("secteur")} vide="Tous les secteurs" />
    </>
  );
}

export default function VueSignauxPublics({ filtres, onChange }: {
  filtres: FiltresSignaux; onChange: (f: FiltresSignaux) => void;
}) {
  const [page, setPage] = useState(1);
  const recherche = useDebounced(filtres.recherche, 300);

  // Un changement de filtre ramène au premier écran : rester en page 6 d'un
  // résultat qui n'en compte plus qu'une n'aurait aucun sens.
  const clef = `${filtres.destination}|${filtres.nature}|${filtres.secteur}|${recherche}`;
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
      {/* ── L'en-tête, dans la forme de celui des projets ────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--bleu)" }} />
          <h2 style={{ fontSize: "1.55rem", fontWeight: 800, color: "var(--encre)", margin: 0,
            letterSpacing: "-0.01em" }}>
            {filtres.destination || "Toutes destinations"}
          </h2>
          <Etiquette>{fmtNombre(k.signaux)} signaux</Etiquette>
          {periode && <Etiquette>{periode}</Etiquette>}
        </div>
        <span style={{ position: "relative", minWidth: 240, flex: "0 1 320px" }}>
          <Search size={14} style={{ position: "absolute", left: 14, top: "50%",
            transform: "translateY(-50%)", color: "var(--gris)" }} />
          <input value={filtres.recherche}
            onChange={e => onChange({ ...filtres, recherche: e.target.value })}
            placeholder="Rechercher"
            style={{ width: "100%", boxSizing: "border-box", background: "var(--carte)",
              border: "1px solid var(--bordure-forte)", borderRadius: 999,
              padding: "10px 16px 10px 36px", fontSize: 13, color: "var(--encre)",
              outline: "none", fontFamily: "var(--font-google-sans)" }} />
        </span>
      </div>

      {d.signaux.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "70px 0" }}>
          Aucun signal ne correspond à cette recherche.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 14,
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {d.signaux.map(s => <CarteSignal key={s.id} s={s} />)}
        </div>
      )}

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

const Etiquette = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
    textTransform: "uppercase", color: "var(--gris)", background: "var(--carte-douce)",
    border: "1px solid var(--filet)", borderRadius: 999, padding: "4px 11px",
    whiteSpace: "nowrap" }}>{children}</span>
);

const boutonPage = (actif: boolean): React.CSSProperties => ({
  border: "1px solid var(--bordure-forte)", background: "var(--carte)",
  borderRadius: 999, padding: "8px 16px", fontSize: 12.5, color: "var(--encre)",
  cursor: actif ? "pointer" : "default", opacity: actif ? 1 : 0.4,
  fontFamily: "var(--font-google-sans)",
});

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
function CarteSignal({ s }: { s: Signal }) {
  const stade = s.natures[0];
  return (
    <article style={{ display: "flex", flexDirection: "column", background: "var(--carte)",
      border: "1px solid rgb(var(--encre-rgb) / 0.12)", borderRadius: 16,
      padding: "15px 17px 13px" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gris)" }}>
          {moisEnClair(s.periode)}
        </span>
        {stade && <PastilleStade v={stade} />}
      </div>

      <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "var(--encre)", lineHeight: 1.25,
        letterSpacing: "-0.01em", margin: 0 }}>{s.entreprise ?? "—"}</h3>
      {s.parent && s.parent !== s.entreprise && (
        <span style={{ fontSize: 11.5, color: "var(--gris)", marginTop: 2 }}>
          groupe {s.parent}
        </span>
      )}

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
