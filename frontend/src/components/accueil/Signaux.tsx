"use client";

// Les signaux d'investissement vers le Sénégal — sous le prochain
// événement, à droite de la vedette : les cinq intentions les plus récentes
// relevées par fDi Markets (une entreprise qui étudie un site, lève des
// fonds, nomme un responsable régional), avec leur pays d'origine. La même
// requête que la vue Signaux, Sénégal en destination.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useDonnees } from "@/lib/donnees";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { Skeleton } from "@/components/shared/Skeleton";

type Signal = { id: number; periode: string; entreprise: string | null; origine: string | null; origine_iso: string | null };
type Reponse = { signaux?: Signal[] };

const URL_SIGNAUX_SENEGAL = `${API}/fdi/public/signaux?${new URLSearchParams({ destination: "Sénégal", page: "1", par_page: "5" })}`;

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** « 2026-08 » → « Août 2026 », comme sur les cartes des signaux. */
const moisEnClair = (periode: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(periode ?? "");
  const nom = m ? MOIS_LONGS[Number(m[2]) - 1] : null;
  return nom ? `${nom[0].toUpperCase()}${nom.slice(1)} ${m![1]}` : periode;
};

export default function DerniersSignaux() {
  const q = useDonnees<Reponse>(URL_SIGNAUX_SENEGAL);
  const signaux = q.data?.signaux ?? [];
  return (
    <div className="ds-carte" style={{ padding: 0, minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 22px 14px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--encre)", margin: 0, letterSpacing: "-0.01em", minWidth: 0 }}>
          Signaux d&apos;investissement vers le Sénégal
        </h3>
        <Link href="/ide?section=projetes&vue=signaux" className="acc-lien" style={{ flexShrink: 0 }}>Tous <ArrowRight size={14} /></Link>
      </div>
      <div style={{ borderTop: "1px solid var(--filet)" }}>
        {q.isPending ? (
          <div style={{ padding: "4px 22px 10px" }}>
            {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} h={16} r={4} style={{ margin: "12px 0" }} />)}
          </div>
        ) : signaux.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--gris-fort)", padding: "16px 22px", margin: 0 }}>
            {q.isError ? "Les signaux n'ont pas pu être chargés." : "Aucun signal relevé pour le moment."}
          </p>
        ) : signaux.map((s, i) => (
          <Link key={s.id} href="/ide?section=projetes&vue=signaux" className="acc-signal"
            style={{ borderTop: i ? "1px solid var(--filet)" : "none" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gris)", fontVariantNumeric: "tabular-nums" }}>{moisEnClair(s.periode)}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--encre)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.entreprise ?? "—"}
            </span>
            <span className="acc-signal-origine" style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, fontSize: 13, color: "var(--texte)" }}>
              <DrapeauPays iso={s.origine_iso} nom={s.origine ?? ""} taille={13} sansIso="rien" />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.origine ?? "—"}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
