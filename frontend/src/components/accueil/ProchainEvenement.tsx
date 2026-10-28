"use client";

// Le prochain événement — la carte bleue de l'accueil, comme dans l'app, à
// droite de la vedette, au-dessus des signaux d'investissement : l'événement
// phare seul (dates, lieu, édition) ; sa fiche s'ouvre au clic.
//
// Un événement EN COURS passe devant le prochain : c'est lui qui occupe
// l'APIX aujourd'hui. Sinon, le plus proche à venir — date fixée ou, pour un
// rendez-vous récurrent, sa prochaine occurrence annoncée. La même règle que
// le bandeau de la page Événements.

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useTous, VIDE } from "@/lib/donnees";
import { fmtDate, fmtPlageDates } from "@/lib/format";
import { computeStatutEvenement } from "@/lib/statuts";
import { Skeleton } from "@/components/shared/Skeleton";

type Evenement = { id: number; nom_event: string; edition?: number | null; date_debut?: string | null; date_fin?: string | null;
  prochain_annee?: number | null; prochain_mois?: number | null; prochain_jour?: number | null;
  ville?: string | null; pays_hote_nom?: string | null };

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_COURTS = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."];

function dateDe(e: Evenement): Date | null {
  if (e.date_debut) return new Date(e.date_debut + "T00:00:00");
  if (e.prochain_annee) return new Date(e.prochain_annee, (e.prochain_mois || 1) - 1, e.prochain_jour || 1);
  return null;
}
/** Les événements à venir, du plus proche au plus lointain. */
function aVenir(tous: readonly Evenement[]): Evenement[] {
  const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
  return tous.filter(e => { const d = dateDe(e); return d != null && d > aujourdhui; })
    .sort((a, b) => dateDe(a)!.getTime() - dateDe(b)!.getTime());
}
function evenementPhare(tous: readonly Evenement[]): { ev: Evenement; enCours: boolean } | null {
  const enCours = tous.find(e => computeStatutEvenement(e) === "en_cours");
  if (enCours) return { ev: enCours, enCours: true };
  const prochain = aVenir(tous)[0];
  return prochain ? { ev: prochain, enCours: false } : null;
}
/** La date en clair : « 12 mai 2027 », ou « mai 2027 » pour un rendez-vous
    dont seul le mois est annoncé. */
function dateEnClair(e: Evenement): string {
  if (e.date_debut) return fmtDate(e.date_debut);
  const d = dateDe(e);
  if (!d) return "";
  return e.prochain_jour ? `${d.getDate()} ${MOIS_LONGS[d.getMonth()]} ${d.getFullYear()}` : `${MOIS_LONGS[d.getMonth()]} ${d.getFullYear()}`;
}
const ordinal = (n: number) => (n === 1 ? "1ère édition" : `${n}ème édition`);
/** « Dans 5 mois », « Dans 12 jours » — l'échéance, comme sur les cartes. */
function dansCombien(d: Date): string | null {
  const now = new Date();
  const jours = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  if (jours <= 0) return null;
  let mois = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
  if (d.getDate() < now.getDate()) mois -= 1;
  const ans = Math.floor(mois / 12);
  if (ans >= 1) return `Dans ${ans} an${ans > 1 ? "s" : ""}`;
  if (mois >= 1) return `Dans ${mois} mois`;
  return `Dans ${jours} jour${jours > 1 ? "s" : ""}`;
}

export default function ProchainEvenement() {
  const q = useTous<Evenement>(`${API}/evenements`);
  const tous = (q.data ?? VIDE) as readonly Evenement[];
  const phare = useMemo(() => evenementPhare(tous), [tous]);

  if (q.isPending) return <div className="acc-evenement"><Skeleton h={160} r={8} style={{ opacity: 0.25 }} /></div>;
  if (!phare) return (
    <div className="acc-evenement">
      <span className="acc-evenement-etiquette">Agenda</span>
      {/* Une panne ne se fait pas passer pour un agenda vide */}
      <p style={{ fontSize: 18, fontWeight: 700, margin: "14px 0 0" }}>
        {q.isError ? "L'agenda n'a pas pu être chargé" : "Aucun événement annoncé pour le moment"}
      </p>
      <Link href="/evenements" className="acc-evenement-lien" style={{ marginTop: "auto" }}>Voir l&apos;agenda <ArrowRight size={14} /></Link>
    </div>
  );

  const { ev, enCours } = phare;
  const d = dateDe(ev)!;
  const jourConnu = !!ev.date_debut || !!ev.prochain_jour;
  const lieu = [ev.ville, ev.pays_hote_nom].filter(Boolean).join(", ");
  const echeance = enCours ? "En ce moment" : dansCombien(d);
  const quand = [ev.date_debut ? fmtPlageDates(ev.date_debut, ev.date_fin) : dateEnClair(ev),
    ev.edition != null ? ordinal(ev.edition) : null].filter(Boolean).join(" · ");
  return (
    <div className="acc-evenement">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span className="acc-evenement-etiquette">{enCours ? "Événement en cours" : "Prochain événement"}</span>
        {echeance && <span className="acc-evenement-echeance">{echeance}</span>}
      </div>
      {/* L'événement : sa fiche s'ouvre au clic, sur la page de l'agenda */}
      <Link href={`/evenements?fiche=${ev.id}`} className="acc-evenement-phare" aria-label={`${ev.nom_event} — ouvrir la fiche`}>
        {/* La date en tuile de verre clair sur le bleu, comme dans l'app */}
        <div className="acc-evenement-date">
          <span style={{ fontSize: jourConnu ? 28 : 15, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {jourConnu ? d.getDate() : MOIS_COURTS[d.getMonth()]}
          </span>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", marginTop: 5, opacity: 0.85 }}>
            {jourConnu ? MOIS_COURTS[d.getMonth()] : d.getFullYear()}
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.01em", margin: 0 }}>{ev.nom_event}</p>
          {lieu && (
            <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "rgba(255,255,255,0.85)", margin: "6px 0 0" }}>
              <MapPin size={13} style={{ flexShrink: 0 }} /> {lieu}
            </p>
          )}
          {quand && <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.72)", margin: "3px 0 0" }}>{quand}</p>}
        </div>
      </Link>
    </div>
  );
}
