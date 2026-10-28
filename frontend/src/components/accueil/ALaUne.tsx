"use client";

// À la une — ce qui arrive et ce qui vient d'être annoncé : le prochain
// événement de l'agenda, en bleu comme dans l'app, et les derniers projets
// d'investissement annoncés au Sénégal (fDi Markets).

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useDonnees, useTous, VIDE } from "@/lib/donnees";
import { fmtDate, fmtMillionsUSD, fmtPlageDates } from "@/lib/format";
import { computeStatutEvenement } from "@/lib/statuts";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { Skeleton } from "@/components/shared/Skeleton";

type Evenement = { id: number; nom_event: string; edition?: number | null; date_debut?: string | null; date_fin?: string | null;
  prochain_annee?: number | null; prochain_mois?: number | null; prochain_jour?: number | null;
  ville?: string | null; pays_hote_nom?: string | null };
type ProjetFdi = { id: number; periode: string; entreprise: string | null; partenaire: string | null;
  partenaire_iso: string | null; capex_musd: number | null; capex_estime: boolean | null };
export type ReponseProjets = { kpis?: { projets: number; annees?: [number | null, number | null] }; projets?: ProjetFdi[] };

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_COURTS = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."];

/** « 2026-08 » → « Août 2026 », comme sur les cartes des projets. */
const moisEnClair = (periode: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(periode ?? "");
  const nom = m ? MOIS_LONGS[Number(m[2]) - 1] : null;
  return nom ? `${nom[0].toUpperCase()}${nom.slice(1)} ${m![1]}` : periode;
};

/** Le projet annoncé : les mêmes paramètres que la vue Projets, Sénégal en
    destination. La réponse arrive triée du plus récent au plus ancien, avec
    les agrégats du périmètre (repris par la carte « Investissements
    privés »). Exporté pour que les deux composants partagent la requête. */
export const URL_PROJETS_SENEGAL = `${API}/fdi/public/projets?${new URLSearchParams({ pays: "Sénégal", page: "1", par_page: "5" })}`;

// ── Le prochain événement ─────────────────────────────────────────────────────
// Un événement EN COURS passe devant le prochain : c'est lui qui occupe
// l'APIX aujourd'hui. Sinon, le plus proche à venir — date fixée ou, pour un
// rendez-vous récurrent, sa prochaine occurrence annoncée. La même règle que
// le bandeau de la page Événements.
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

function ProchainEvenement() {
  const q = useTous<Evenement>(`${API}/evenements`);
  const tous = (q.data ?? VIDE) as readonly Evenement[];
  const phare = useMemo(() => evenementPhare(tous), [tous]);
  // Ensuite : les deux rendez-vous suivants, pour que la carte dise l'agenda
  // et pas seulement sa première ligne
  const suivants = useMemo(() => phare ? aVenir(tous).filter(e => e.id !== phare.ev.id).slice(0, 2) : [], [tous, phare]);

  if (q.isPending) return <div className="acc-evenement"><Skeleton h={150} r={8} style={{ opacity: 0.25 }} /></div>;
  if (!phare) return (
    <Link href="/evenements" className="acc-evenement" style={{ textDecoration: "none" }}>
      <span className="acc-evenement-etiquette">Agenda</span>
      {/* Une panne ne se fait pas passer pour un agenda vide */}
      <p style={{ fontSize: 18, fontWeight: 700, margin: "14px 0 0" }}>
        {q.isError ? "L'agenda n'a pas pu être chargé" : "Aucun événement annoncé pour le moment"}
      </p>
      <span className="acc-evenement-lien" style={{ marginTop: "auto" }}>Voir l&apos;agenda <ArrowRight size={14} /></span>
    </Link>
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
        {echeance && <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.78)" }}>{echeance}</span>}
      </div>
      {/* L'événement : sa fiche s'ouvre au clic, sur la page de l'agenda */}
      <Link href={`/evenements?fiche=${ev.id}`} className="acc-evenement-phare" aria-label={`${ev.nom_event} — ouvrir la fiche`}>
        {/* La date en tuile de verre clair sur le bleu, comme dans l'app */}
        <div className="acc-evenement-date">
          <span style={{ fontSize: jourConnu ? 26 : 15, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {jourConnu ? d.getDate() : MOIS_COURTS[d.getMonth()]}
          </span>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", marginTop: 4, opacity: 0.85 }}>
            {jourConnu ? MOIS_COURTS[d.getMonth()] : d.getFullYear()}
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.01em", margin: 0 }}>{ev.nom_event}</p>
          {lieu && (
            <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "rgba(255,255,255,0.85)", margin: "6px 0 0" }}>
              <MapPin size={13} style={{ flexShrink: 0 }} /> {lieu}
            </p>
          )}
          {quand && <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.72)", margin: "3px 0 0" }}>{quand}</p>}
        </div>
      </Link>
      {suivants.length > 0 && (
        <div className="acc-evenement-suite">
          <span className="acc-evenement-etiquette" style={{ color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>Ensuite</span>
          {suivants.map(e => (
            <Link key={e.id} href={`/evenements?fiche=${e.id}`} className="acc-evenement-suivant">
              <span style={{ color: "rgba(255,255,255,0.72)", fontVariantNumeric: "tabular-nums" }}>{dateEnClair(e)}</span>
              <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nom_event}</span>
            </Link>
          ))}
        </div>
      )}
      <Link href="/evenements" className="acc-evenement-lien" style={{ marginTop: "auto" }}>Tout l&apos;agenda <ArrowRight size={14} /></Link>
    </div>
  );
}

// ── Les derniers projets annoncés ─────────────────────────────────────────────
function DerniersProjets() {
  const q = useDonnees<ReponseProjets>(URL_PROJETS_SENEGAL);
  const projets = q.data?.projets ?? [];
  const k = q.data?.kpis;
  return (
    <div className="ds-carte" style={{ padding: 0, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "20px 22px 14px" }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--encre)", margin: 0, letterSpacing: "-0.01em" }}>Derniers projets annoncés au Sénégal</h3>
          <p style={{ fontSize: 12.5, color: "var(--gris-fort)", margin: "4px 0 0" }}>
            {k ? `${k.projets.toLocaleString("fr-FR")} projets relevés${k.annees?.[0] ? ` depuis ${k.annees[0]}` : ""} · source fDi Markets` : "Source fDi Markets"}
          </p>
        </div>
        <Link href="/ide?section=projetes" className="acc-lien" style={{ flexShrink: 0 }}>Tous les projets <ArrowRight size={14} /></Link>
      </div>
      <div style={{ borderTop: "1px solid var(--filet)" }}>
        {q.isPending ? (
          <div style={{ padding: "6px 22px 12px" }}>
            {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} h={18} r={4} style={{ margin: "12px 0" }} />)}
          </div>
        ) : projets.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--gris-fort)", padding: "18px 22px" }}>
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
  );
}

export default function ALaUne() {
  return (
    <section className="acc-cadre acc-section">
      <div className="acc-section-tete">
        <h2 className="acc-h2">À la une</h2>
        <p className="acc-section-sous">Ce qui arrive, et ce qui vient d&apos;être annoncé.</p>
      </div>
      <div className="acc-une">
        <ProchainEvenement />
        <DerniersProjets />
      </div>
    </section>
  );
}
