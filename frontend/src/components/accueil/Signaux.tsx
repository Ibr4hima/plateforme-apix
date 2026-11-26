"use client";

// Les signaux d'investissement vers l'Afrique occidentale — sous le prochain
// événement, à droite de la vedette : les cinq intentions les plus récentes
// relevées par fDi Markets (une entreprise qui étudie un site, lève des
// fonds, nomme un responsable régional). La même requête que la vue Signaux,
// restreinte à la zone « Afrique de l'Ouest » du référentiel des groupements :
// un signal y entre dès qu'il vise au moins un de ses pays.
//
// LA DESTINATION S'AFFICHE, puisque la zone en compte seize : le pays visé
// en premier dans la zone — le Sénégal quand il en est —, suivi du nombre des
// autres destinations, après le pays d'origine : « Italie → Nigeria ». Une
// ligne par signal, comme avant : la carte garde sa hauteur à côté de la
// vedette.
//
// UN CLIC OUVRE LA FICHE, SUR PLACE. Chaque ligne menait à la page des
// signaux, où il fallait retrouver celui qu'on venait de lire. Elle ouvre
// désormais sa fiche par-dessus l'accueil — la même que dans la vue Signaux
// et la fiche pays : la liste porte déjà toutes ses valeurs, rien n'est
// retéléchargé. « Tous », lui, mène toujours à la page.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useDonnees } from "@/lib/donnees";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { Skeleton } from "@/components/shared/Skeleton";
import { FicheSignal, type Signal } from "@/app/ide/vue-signaux-publics";

/** Une destination telle que la liste la rend : avec le code ISO du pays,
    pour le drapeau. */
type Destination = Signal["destinations"][number] & { iso?: string | null };
type Reponse = { signaux?: Signal[] };

const URL_SIGNAUX_OUEST = `${API}/fdi/public/signaux?${new URLSearchParams({ zone: "AFRIQUE_DE_L_OUEST", page: "1", par_page: "5" })}`;

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** « 2026-08 » → « Août 2026 », comme sur les cartes des signaux. */
const moisEnClair = (periode: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(periode ?? "");
  const nom = m ? MOIS_LONGS[Number(m[2]) - 1] : null;
  return nom ? `${nom[0].toUpperCase()}${nom.slice(1)} ${m![1]}` : periode;
};

export default function DerniersSignaux() {
  const q = useDonnees<Reponse>(URL_SIGNAUX_OUEST);
  const signaux = q.data?.signaux ?? [];
  // Le signal dont la fiche est ouverte, par-dessus l'accueil.
  const [ouvert, setOuvert] = useState<Signal | null>(null);
  return (
    <div className="ds-carte" style={{ padding: 0, minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 22px 14px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--encre)", margin: 0, letterSpacing: "-0.01em", minWidth: 0 }}>
          Signaux d&apos;investissement vers l&apos;Afrique occidentale
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
        ) : signaux.map((s, i) => {
          // Les destinations arrivent rangées par proximité — le Sénégal, puis
          // l'Afrique de l'Ouest, puis le reste de l'Afrique : la première est
          // donc celle de la zone qui intéresse le lecteur.
          const dest = s.destinations?.[0] as Destination | undefined;
          const autres = Math.max(0, (s.destinations?.length ?? 0) - 1);
          return (
            <button key={s.id} type="button" className="acc-signal" onClick={() => setOuvert(s)}
              aria-label={`Ouvrir la fiche du signal ${s.entreprise ?? ""}`.trim()}
              // La remise à zéro du bouton D'ABORD, le filet ensuite : posé après
              // `borderTop`, le raccourci `border` effacerait le filet.
              style={{ border: "none", borderTop: i ? "1px solid var(--filet)" : "none", width: "100%",
                background: "none", textAlign: "left", font: "inherit",
                cursor: "pointer", color: "inherit" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gris)", fontVariantNumeric: "tabular-nums" }}>{moisEnClair(s.periode)}</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--encre)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.entreprise ?? "—"}
              </span>
              {/* LE TRAJET, SUR UNE LIGNE : d'où part l'intention, où elle va.
                  Le nom d'origine cède la place le premier quand la colonne
                  manque de largeur — son drapeau reste —, jamais celui de la
                  destination, qui est ce que la carte annonce. */}
              <span title={`${s.origine ?? "—"} → ${(s.destinations ?? []).map(d => d.libelle).join(", ") || "—"}`}
                style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, fontSize: 13, color: "var(--texte)" }}>
                {s.origine && (
                  <>
                    <DrapeauPays iso={s.origine_iso} nom={s.origine} taille={13} sansIso="rien" />
                    <span className="acc-signal-origine" style={{ minWidth: 0, color: "var(--gris)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.origine}</span>
                  </>
                )}
                <span aria-hidden style={{ flexShrink: 0, color: "var(--gris)" }}>→</span>
                {dest ? (
                  <>
                    <DrapeauPays iso={dest.iso ?? null} nom={dest.libelle ?? ""} taille={13} sansIso="rien" />
                    <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}>{dest.libelle}</span>
                    {autres > 0 && <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: "var(--gris)" }}>+{autres}</span>}
                  </>
                ) : <span>—</span>}
              </span>
            </button>
          );
        })}
      </div>
      {ouvert && <FicheSignal s={ouvert} onClose={() => setOuvert(null)} />}
    </div>
  );
}
