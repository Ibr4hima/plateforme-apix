"use client";

// Investissements annoncés — ce que le relevé fDi Markets dit du Sénégal : à
// gauche, plus étroite, l'origine des investisseurs (les dix premiers pays,
// en nombre de projets ou en montant investi), à droite l'historique des
// investissements annoncés (les dix plus récents). Une seule requête nourrit
// les deux cartes ; en-têtes et lignes y ont la même hauteur, si bien que les
// deux tableaux finissent à la même ligne.

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useDonnees } from "@/lib/donnees";
import { fmtMillionsUSD } from "@/lib/format";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { Skeleton } from "@/components/shared/Skeleton";

type ProjetFdi = { id: number; periode: string; entreprise: string | null; partenaire: string | null;
  partenaire_iso: string | null; capex_musd: number | null; capex_estime: boolean | null };
type Rang = { nom: string; nb: number; capex_musd: number | null; iso?: string | null };
type ReponseProjets = {
  projets?: ProjetFdi[];
  tops?: { partenaires?: Rang[] };
};
type Mesure = "nb" | "capex";

/** Dix lignes de chaque côté. */
const NB = 10;

/** Les projets annoncés au Sénégal : les paramètres de la vue Projets,
    Sénégal en destination. La réponse arrive triée du plus récent au plus
    ancien, avec les agrégats et le classement COMPLET des pays d'origine. */
const URL_PROJETS_SENEGAL = `${API}/fdi/public/projets?${new URLSearchParams({ pays: "Sénégal", page: "1", par_page: String(NB) })}`;

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** « 2026-08 » → « Août 2026 », comme sur les cartes des projets. */
const moisEnClair = (periode: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(periode ?? "");
  const nom = m ? MOIS_LONGS[Number(m[2]) - 1] : null;
  return nom ? `${nom[0].toUpperCase()}${nom.slice(1)} ${m![1]}` : periode;
};

/** L'en-tête des deux cartes, à hauteur fixe : le titre, et la bascule à sa
    droite. */
function EnteteCarte({ titre, action }: { titre: string; action?: ReactNode }) {
  return (
    <div className="acc-annonces-tete">
      <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--encre)", margin: 0, letterSpacing: "-0.01em",
        minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titre}</h3>
      {action}
    </div>
  );
}

/** Le corps d'une carte avant ses données : dix lignes fantômes à la hauteur
    des vraies, ou le message d'une liste vide ou en panne. */
function EtatListe({ chargement, message }: { chargement: boolean; message: string }) {
  if (!chargement) return <p style={{ fontSize: 13, color: "var(--gris-fort)", padding: "18px 22px", margin: 0 }}>{message}</p>;
  return (
    <>
      {Array.from({ length: NB }, (_, i) => (
        <div key={i} className="acc-annonces-ligne" style={{ borderTop: i ? "1px solid var(--filet)" : "none", display: "flex" }}>
          <Skeleton h={14} r={4} style={{ width: `${72 - (i % 3) * 14}%` }} />
        </div>
      ))}
    </>
  );
}

/** L'origine des investisseurs : les dix premiers pays, en nombre de projets
    ou en montant investi. */
function Origines({ tous, chargement, erreur }: { tous?: Rang[]; chargement: boolean; erreur: boolean }) {
  const [mesure, setMesure] = useState<Mesure>("nb");
  // Le classement arrive COMPLET, trié par nombre de projets : en montant, on
  // le retrie sur toute la liste, et pas sur les dix premiers en nombre — un
  // pays de deux gros projets y entre. Les pays sans montant connu ferment la
  // marche.
  const pays = useMemo(() => {
    const liste = tous ?? [];
    const triee = mesure === "nb" ? liste : [...liste].sort((a, b) => (b.capex_musd ?? -1) - (a.capex_musd ?? -1));
    return triee.slice(0, NB);
  }, [tous, mesure]);
  const valeur = (p: Rang) => (mesure === "nb" ? p.nb : p.capex_musd);
  const plusGrand = Math.max(1e-9, ...pays.map(p => valeur(p) ?? 0));

  return (
    <div className="ds-carte" style={{ padding: 0, minWidth: 0 }}>
      <EnteteCarte titre="Origine des investisseurs"
        action={
          <div className="ds-segments" style={{ padding: 3, gap: 2, flexShrink: 0 }}>
            {/* Sans légende sous le titre, la mise en garde sur les montants
                passe dans l'infobulle de la bascule */}
            {([["nb", "Nombre", "Nombre de projets"],
               ["capex", "Montant", "Montant investi, en partie estimé par le Financial Times"]] as const).map(([v, l, aide]) => (
              <button key={v} onClick={() => setMesure(v)} aria-pressed={mesure === v} className="ds-segment" title={aide}
                style={{ padding: "5px 14px", fontSize: 12 }}>{l}</button>
            ))}
          </div>
        } />
      <div>
        {pays.length === 0 ? (
          <EtatListe chargement={chargement}
            message={erreur ? "Le classement n'a pas pu être chargé." : "Aucun pays relevé pour le moment."} />
        ) : pays.map((p, i) => {
          const v = valeur(p);
          return (
            <div key={p.nom} className="acc-annonces-ligne acc-pays" style={{ borderTop: i ? "1px solid var(--filet)" : "none" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gris)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: "var(--encre)" }}>
                <DrapeauPays iso={p.iso} nom={p.nom} taille={13} sansIso="rien" />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
              </span>
              <span className="acc-pays-barre" aria-hidden>
                {v != null && <span style={{ width: `${Math.max(3, (v / plusGrand) * 100)}%` }} />}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--encre)", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {mesure === "nb" ? p.nb.toLocaleString("fr-FR") : v == null ? "—" : fmtMillionsUSD(v)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** L'historique des investissements annoncés au Sénégal : les dix plus
    récents. */
function DerniersProjets({ projets = [], chargement, erreur }: { projets?: ProjetFdi[]; chargement: boolean; erreur: boolean }) {
  return (
    <div className="ds-carte" style={{ padding: 0, minWidth: 0 }}>
      <EnteteCarte titre="Historique des investissements annoncés" />
      <div>
        {projets.length === 0 ? (
          <EtatListe chargement={chargement}
            message={erreur ? "Les projets n'ont pas pu être chargés." : "Aucun projet relevé pour le moment."} />
        ) : projets.slice(0, NB).map((p, i) => (
          <Link key={p.id} href="/ide?section=projetes" className="acc-annonces-ligne acc-projet"
            style={{ borderTop: i ? "1px solid var(--filet)" : "none" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gris)", fontVariantNumeric: "tabular-nums" }}>{moisEnClair(p.periode)}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--encre)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.entreprise ?? "—"}
            </span>
            <span className="acc-projet-origine" style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, fontSize: 13, color: "var(--texte)" }}>
              <DrapeauPays iso={p.partenaire_iso} nom={p.partenaire ?? ""} taille={13} sansIso="rien" />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.partenaire ?? "—"}</span>
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--encre)", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {p.capex_musd == null ? "—" : `${p.capex_estime ? "≈ " : ""}${fmtMillionsUSD(p.capex_musd)}`}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Annonces() {
  const q = useDonnees<ReponseProjets>(URL_PROJETS_SENEGAL);
  const etat = { chargement: q.isPending, erreur: q.isError };

  return (
    <section className="acc-cadre acc-section">
      <div className="acc-section-tete">
        <h2 className="acc-h2">Investissements annoncés</h2>
        <Link href="/ide?section=projetes" className="acc-lien">Tous les projets <ArrowRight size={14} /></Link>
      </div>
      <div className="acc-annonces">
        <Origines tous={q.data?.tops?.partenaires} {...etat} />
        <DerniersProjets projets={q.data?.projets} {...etat} />
      </div>
    </section>
  );
}
