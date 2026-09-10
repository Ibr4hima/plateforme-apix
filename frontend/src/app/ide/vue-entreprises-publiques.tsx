"use client";

// Entreprises — les investisseurs, vus depuis les projets annoncés.
//
// D'OÙ VIENNENT CES FICHES. Des SEULS projets annoncés. Les signaux
// d'investisseur parlent des mêmes entreprises, mais ils décrivent des
// INTENTIONS : les mêler ici ferait compter comme investissement ce qui n'est
// encore qu'une étude.
//
// LE GROUPEMENT SE FAIT SUR LE COUPLE (NOM, PAYS D'ORIGINE), et le second
// terme n'est pas décoratif : une même raison sociale peut désigner deux
// entités distinctes selon le pays d'où part l'investissement — les filiales
// nationales des grands groupes portent souvent le nom du groupe. Grouper sur
// le seul nom les confondrait, et l'écran annoncerait un investisseur unique
// là où il y en a deux.
//
// CE QUE LA CARTE COMPTE, ET CE QU'ELLE NE COMPTE PAS. Le nombre de projets et
// le nombre de PAYS DISTINCTS où l'entreprise a annoncé : deux nombres qui se
// vérifient ligne à ligne dans la vue Projets. Pas de montant total — il
// mêlerait des projets déclarés et des projets estimés par l'algorithme du
// Financial Times, et l'écran ne pourrait plus dire lequel il montre.

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import DrapeauPays from "@/components/shared/DrapeauPays";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonChartGrid } from "@/components/shared/Skeleton";
import { useDebounced } from "@/lib/useDebounced";
import { useDonnees } from "@/lib/donnees";
import { API, boutonPage, ETIQ, fmtNombre } from "./partage";

type Entreprise = {
  nom: string; origine: string | null; origine_iso: string | null;
  projets: number; pays: number;
};
type Reponse = {
  entreprises: Entreprise[]; page: number; pages: number; total: number;
};

const PAR_PAGE = 24;

/** Le périmètre du relevé dont ces entreprises sont tirées. Il qualifie la page
    comme « Projets reçus » qualifie celle des projets. */
const PERIMETRE = "Afrique";

export default function VueEntreprisesPubliques() {
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const cherche = useDebounced(recherche, 300);

  // Une nouvelle recherche ramène au premier écran : rester en page 12 d'un
  // résultat qui n'en compte plus qu'une n'aurait aucun sens.
  const [vue, setVue] = useState(cherche);
  if (cherche !== vue) { setVue(cherche); setPage(1); }

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (cherche.trim()) p.set("recherche", cherche.trim());
    p.set("page", String(page));
    p.set("par_page", String(PAR_PAGE));
    return `${API}/fdi/public/entreprises?${p}`;
  }, [cherche, page]);

  const q = useDonnees<Reponse>(url, { garder: true });
  if (q.isError) return <ErreurChargement onRetry={() => q.refetch()} />;
  if (!q.data) return <SkeletonChartGrid />;
  const d = q.data;

  return (
    <div>
      {/* Le même en-tête que les deux autres vues, jetons compris. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const,
        marginBottom: 20 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%",
          background: "var(--bleu-action)", flexShrink: 0 }} />
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--encre)", lineHeight: 1.1 }}>
          Entreprises
        </h2>
        <Jeton>{PERIMETRE}</Jeton>
        <Jeton>{fmtNombre(d.total)} investisseurs</Jeton>
        <div style={{ marginLeft: "auto", position: "relative" as const, minWidth: 200,
          flex: "0 1 300px" }}>
          <Search size={13} style={{ position: "absolute" as const, left: 12, top: "50%",
            transform: "translateY(-50%)", color: "var(--gris)" }} />
          <input value={recherche} onChange={e => setRecherche(e.target.value)}
            placeholder="Rechercher"
            style={{ width: "100%", padding: "8px 10px 8px 34px", borderRadius: 999,
              border: "1px solid var(--bordure-forte)", background: "var(--carte)",
              fontSize: 12.5, color: "var(--encre)", outline: "none",
              fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const }} />
        </div>
      </div>

      {d.entreprises.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "70px 0" }}>
          Aucune entreprise ne correspond à cette recherche.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 14,
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {d.entreprises.map(e => (
            <CarteEntreprise key={`${e.nom}|${e.origine ?? ""}`} e={e} />
          ))}
        </div>
      )}

      {d.pages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
          gap: 12, marginTop: 28 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            style={boutonPage(page > 1)}>Précédentes</button>
          <span style={{ fontSize: 12.5, color: "var(--gris)" }}>
            Page {d.page} sur {d.pages}
          </span>
          <button disabled={page >= d.pages} onClick={() => setPage(p => p + 1)}
            style={boutonPage(page < d.pages)}>Suivantes</button>
        </div>
      )}
    </div>
  );
}

/** Le jeton de qualification de l'en-tête — celui des deux autres vues. */
const Jeton = ({ children }: { children: React.ReactNode }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 7px",
    borderRadius: 5, background: "var(--fond)", border: "1px solid var(--bordure-forte)",
    fontSize: 9, fontWeight: 700, color: "var(--gris)", textTransform: "uppercase" as const,
    letterSpacing: "0.05em", flexShrink: 0 }}>{children}</span>
);

/** Une entreprise, en tuile — le gabarit des cartes de la plateforme : la
    qualification en haut, le nom en grand, le pied en deux colonnes séparées
    d'un filet.

    Ici le pays d'origine tient la ligne du haut : il fait partie de l'identité
    de la fiche, puisque c'est lui qui, avec le nom, la distingue d'une autre. */
function CarteEntreprise({ e }: { e: Entreprise }) {
  return (
    <article style={{ display: "flex", flexDirection: "column", background: "var(--carte)",
      border: "1px solid rgb(var(--encre-rgb) / 0.12)", borderRadius: 16,
      padding: "15px 17px 13px" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <DrapeauPays iso={e.origine_iso} nom={e.origine ?? ""} taille={14} sansIso="rien" />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gris)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {e.origine ?? "Origine inconnue"}
        </span>
      </div>

      <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "var(--encre)", lineHeight: 1.25,
        letterSpacing: "-0.01em", margin: 0 }}>{e.nom}</h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14,
        paddingTop: 13, borderTop: "1px solid var(--bordure)" }}>
        <Compte n={e.projets} mot="projet" etiquette="Projets annoncés" />
        <Compte n={e.pays} mot="pays" etiquette="Pays d'implantation" filet />
      </div>
    </article>
  );
}

/** Un compte : le nombre en grand, son unité petite à côté. « pays » est
    invariable — l'écrire au pluriel serait une faute que la Présidence lira. */
function Compte({ n, mot, etiquette, filet }: {
  n: number; mot: string; etiquette: string; filet?: boolean;
}) {
  return (
    <div style={{ minWidth: 0, ...(filet
      ? { paddingLeft: 14, borderLeft: "1px solid var(--bordure)" } : {}) }}>
      <span style={{ ...ETIQ, display: "block", marginBottom: 4 }}>{etiquette}</span>
      <span style={{ fontSize: 18, fontWeight: 800, color: "var(--encre)",
        letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
        {fmtNombre(n)}
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--gris)" }}>
          {" "}{mot}{n > 1 && !mot.endsWith("s") ? "s" : ""}
        </span>
      </span>
    </div>
  );
}
