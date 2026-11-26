"use client";

// Les signaux d'investissement vers l'Afrique occidentale — à droite de la
// vedette, sur toute sa hauteur : les intentions les plus récentes relevées
// par fDi Markets (une entreprise qui étudie un site, lève des fonds, nomme un
// responsable régional). La même requête que la vue Signaux, restreinte à la
// zone « Afrique de l'Ouest » du référentiel des groupements : un signal y
// entre dès qu'il vise au moins un de ses pays.
//
// AUTANT DE LIGNES QUE LA HAUTEUR EN TIENT. La carte occupe la colonne
// entière, à la hauteur de la vedette : elle montre donc ce qui y entre,
// mesuré sur place — ni vide en bas, ni vedette étirée pour lui faire de la
// place. Cinq au moins, douze au plus ; empilée sous la vedette (écran
// étroit), elle garde ses cinq.
//
// UNE LIGNE PAR SIGNAL : le mois, l'entreprise précédée du drapeau de son
// pays d'origine (le nom au survol), puis la destination — le pays visé en
// premier dans la zone, le Sénégal quand il en est —, suivie du nombre des
// autres : « Octobre 2026 · 🇨🇦 Bell · Nigeria +3 ».
//
// UN CLIC OUVRE LA FICHE, SUR PLACE. Chaque ligne menait à la page des
// signaux, où il fallait retrouver celui qu'on venait de lire. Elle ouvre
// désormais sa fiche par-dessus l'accueil — la même que dans la vue Signaux
// et la fiche pays : la liste porte déjà toutes ses valeurs, rien n'est
// retéléchargé. « Tous », lui, mène toujours à la page. La fiche est montée
// dans le <body> : sous un bloc animé de l'accueil, une position fixe se
// rapporte à ce bloc, et la fiche s'y trouvait enfermée, sous l'en-tête.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useDonnees } from "@/lib/donnees";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { Skeleton } from "@/components/shared/Skeleton";
import { FicheSignal, type Signal } from "@/app/ide/vue-signaux-publics";

type Reponse = { signaux?: Signal[] };

/** Le nombre de lignes : au moins, et au plus — la requête prend le plus. */
const AU_MOINS = 5, AU_PLUS = 12;

const URL_SIGNAUX_OUEST = `${API}/fdi/public/signaux?${new URLSearchParams({ zone: "AFRIQUE_DE_L_OUEST", page: "1", par_page: String(AU_PLUS) })}`;

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

  // La hauteur offerte à la liste, mesurée : la carte s'étire à celle de la
  // vedette, et l'on y montre autant de lignes qu'il en entre. La mesure porte
  // sur la place DONNÉE, non sur le contenu : n lignes affichées tiennent
  // dedans, la carte ne grandit pas, et la mesure ne bouge plus.
  const liste = useRef<HTMLDivElement>(null);
  const observateur = useRef<ResizeObserver | null>(null);
  const [lignes, setLignes] = useState(AU_MOINS);
  useEffect(() => {
    const el = liste.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const ligne = el.querySelector<HTMLElement>(".acc-signal");
      // Une ligne et son filet ; avant que la première ne soit là, la hauteur
      // qu'elles ont toutes.
      const h = (ligne?.offsetHeight ?? 38) + 1;
      setLignes(Math.max(AU_MOINS, Math.min(AU_PLUS, Math.floor(el.clientHeight / h))));
    });
    ro.observe(el);
    observateur.current = ro;
    return () => { ro.disconnect(); observateur.current = null; };
  }, []);
  // La première ligne arrivée, la mesure se refait sur sa hauteur réelle :
  // l'estimée d'avant pouvait faire afficher une ligne de trop.
  useEffect(() => {
    const premiere = liste.current?.querySelector<HTMLElement>(".acc-signal");
    if (premiere && observateur.current) observateur.current.observe(premiere);
  }, [signaux.length]);

  return (
    <div className="ds-carte" style={{ padding: 0, minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 22px 14px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--encre)", margin: 0, letterSpacing: "-0.01em", minWidth: 0 }}>
          Signaux d&apos;investissement vers l&apos;Afrique occidentale
        </h3>
        <Link href="/ide?section=projetes&volet=signaux" className="acc-lien" style={{ flexShrink: 0 }}>Tous <ArrowRight size={14} /></Link>
      </div>
      <div ref={liste} style={{ borderTop: "1px solid var(--filet)", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {q.isPending ? (
          <div style={{ padding: "4px 22px 10px" }}>
            {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} h={16} r={4} style={{ margin: "12px 0" }} />)}
          </div>
        ) : signaux.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--gris-fort)", padding: "16px 22px", margin: 0 }}>
            {q.isError ? "Les signaux n'ont pas pu être chargés." : "Aucun signal relevé pour le moment."}
          </p>
        ) : signaux.slice(0, lignes).map((s, i) => {
          // Les destinations arrivent rangées par proximité — le Sénégal, puis
          // l'Afrique de l'Ouest, puis le reste de l'Afrique : la première est
          // donc celle de la zone qui intéresse le lecteur.
          const dest = s.destinations?.[0];
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
              {/* L'entreprise, précédée du drapeau de son pays d'origine — une
                  place réservée, que les noms restent alignés même sans drapeau. */}
              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 18, flexShrink: 0, display: "inline-flex", justifyContent: "center" }}>
                  <DrapeauPays iso={s.origine_iso} nom={s.origine ? `Origine : ${s.origine}` : ""} taille={14} sansIso="rien" />
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--encre)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.entreprise ?? "—"}
                </span>
              </span>
              {/* La destination, sans drapeau, et le nombre des autres ; toutes
                  au survol. */}
              <span title={(s.destinations ?? []).map(d => d.libelle).join(", ") || undefined}
                style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, fontSize: 13, color: "var(--texte)" }}>
                {dest ? (
                  <>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dest.libelle}</span>
                    {autres > 0 && <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: "var(--gris)" }}>+{autres}</span>}
                  </>
                ) : <span>—</span>}
              </span>
            </button>
          );
        })}
      </div>
      {ouvert && createPortal(<FicheSignal s={ouvert} onClose={() => setOuvert(null)} />, document.body)}
    </div>
  );
}
