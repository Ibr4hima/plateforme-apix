"use client";

// Investissements annoncés — ce que le relevé fDi Markets dit du Sénégal :
// les derniers projets annoncés, et d'où viennent les investisseurs (les
// premiers pays d'origine, en nombre de projets). Une seule requête nourrit
// les deux cartes, et la carte « Investissements privés » d'Explorer.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useDonnees } from "@/lib/donnees";
import { fmtMillionsUSD } from "@/lib/format";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { Skeleton } from "@/components/shared/Skeleton";

type ProjetFdi = { id: number; periode: string; entreprise: string | null; partenaire: string | null;
  partenaire_iso: string | null; capex_musd: number | null; capex_estime: boolean | null };
type Rang = { nom: string; nb: number; capex_musd: number | null; iso?: string | null };
export type ReponseProjets = {
  kpis?: { projets: number; capex_musd?: number | null; annees?: [number | null, number | null] };
  projets?: ProjetFdi[];
  tops?: { partenaires?: Rang[] };
};

/** Les projets annoncés au Sénégal : les paramètres de la vue Projets,
    Sénégal en destination. La réponse arrive triée du plus récent au plus
    ancien, avec les agrégats et les classements du périmètre. */
export const URL_PROJETS_SENEGAL = `${API}/fdi/public/projets?${new URLSearchParams({ pays: "Sénégal", page: "1", par_page: "5" })}`;

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** « 2026-08 » → « Août 2026 », comme sur les cartes des projets. */
const moisEnClair = (periode: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(periode ?? "");
  const nom = m ? MOIS_LONGS[Number(m[2]) - 1] : null;
  return nom ? `${nom[0].toUpperCase()}${nom.slice(1)} ${m![1]}` : periode;
};

function EnteteCarte({ titre, sous }: { titre: string; sous: string }) {
  return (
    <div style={{ padding: "18px 22px 14px" }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--encre)", margin: 0, letterSpacing: "-0.01em" }}>{titre}</h3>
      <p style={{ fontSize: 12.5, color: "var(--gris-fort)", margin: "4px 0 0" }}>{sous}</p>
    </div>
  );
}

export default function Annonces() {
  const q = useDonnees<ReponseProjets>(URL_PROJETS_SENEGAL);
  const projets = q.data?.projets ?? [];
  const k = q.data?.kpis;
  const depuis = k?.annees?.[0] ? ` depuis ${k.annees[0]}` : "";
  const pays = (q.data?.tops?.partenaires ?? []).slice(0, 6);
  const plusGrand = Math.max(1, ...pays.map(p => p.nb));

  return (
    <section className="acc-cadre acc-section">
      <div className="acc-section-tete">
        <h2 className="acc-h2">Investissements annoncés</h2>
        <Link href="/ide?section=projetes" className="acc-lien">Tous les projets <ArrowRight size={14} /></Link>
      </div>
      <div className="acc-annonces">
        {/* Les derniers projets */}
        <div className="ds-carte" style={{ padding: 0, minWidth: 0 }}>
          <EnteteCarte titre="Derniers projets annoncés au Sénégal"
            sous={k ? `${k.projets.toLocaleString("fr-FR")} projets relevés${depuis} · source fDi Markets` : "Source fDi Markets"} />
          <div style={{ borderTop: "1px solid var(--filet)" }}>
            {q.isPending ? (
              <div style={{ padding: "6px 22px 12px" }}>
                {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} h={18} r={4} style={{ margin: "12px 0" }} />)}
              </div>
            ) : projets.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--gris-fort)", padding: "18px 22px", margin: 0 }}>
                {q.isError ? "Les projets n'ont pas pu être chargés." : "Aucun projet relevé pour le moment."}
              </p>
            ) : projets.map((p, i) => (
              <Link key={p.id} href="/ide?section=projetes" className="acc-projet"
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

        {/* D'où viennent les investisseurs */}
        <div className="ds-carte" style={{ padding: 0, minWidth: 0 }}>
          <EnteteCarte titre="D'où viennent les investisseurs" sous={`Pays d'origine des projets${depuis}, en nombre de projets`} />
          <div style={{ borderTop: "1px solid var(--filet)", padding: "8px 22px 14px" }}>
            {q.isPending ? (
              [0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} h={16} r={4} style={{ margin: "14px 0" }} />)
            ) : pays.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--gris-fort)", padding: "10px 0", margin: 0 }}>
                {q.isError ? "Le classement n'a pas pu être chargé." : "Aucun pays relevé pour le moment."}
              </p>
            ) : pays.map(p => (
              <div key={p.nom} className="acc-pays">
                <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, fontSize: 13, fontWeight: 650, color: "var(--encre)" }}>
                  <DrapeauPays iso={p.iso} nom={p.nom} taille={13} sansIso="rien" />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
                </span>
                <span className="acc-pays-barre" aria-hidden>
                  <span style={{ width: `${Math.max(3, (p.nb / plusGrand) * 100)}%` }} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--encre)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {p.nb.toLocaleString("fr-FR")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
