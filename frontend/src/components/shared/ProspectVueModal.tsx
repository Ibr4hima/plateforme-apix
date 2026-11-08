"use client";

// Fiche prospect + aides du cycle de prospection — partagées entre la page
// Prospects, l'administration et la recherche globale. Bâtie sur la fiche
// modale commune (FicheModal), dans le dessin des autres fiches :
//   en-tête   — le statut en surtitre (sur l'aplat de sa couleur) avec
//               l'étape de la prospection ; le nom ; le pays du siège et
//               depuis quand ;
//   faits     — selon la vue, dans un aplat ;
//   rubriques — la vue « investisseur » (onglet ciblés, ou « Infos
//               investisseur ») : coordonnées, activités, points focaux ;
//               la vue « échanges » (onglet en contact) : échanges,
//               contraintes, cycles précédents ; la vue « conclusion »
//               (onglet transformés) : conclusion, échanges, contraintes,
//               cycles précédents.

import { Mail, MapPin, MessageCircle, MessageSquare, Phone, Send, User, Video } from "lucide-react";
import { useState } from "react";
import { useNaema } from "@/lib/referentiels";
import { fmtPhone } from "@/lib/telephone";
import { fmtDateLong, premierDuMois } from "@/lib/format";
import FicheModal, { arbreNaema, FicheArborescence, FicheAttente, FicheFait, FicheFaits, FicheListeDocuments, FicheRubrique, FicheTexte } from "@/components/shared/FicheModal";

import { API_BASE } from "@/lib/api";

// Ancienneté relative : « Il y a 3 jours / 2 mois / 1 an », « Aujourd'hui »
export function ilYa(dstr: string | null): string | null {
  if (!dstr) return null;
  const d = new Date(dstr.slice(0, 10) + "T00:00:00"), now = new Date();
  const jours = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (jours < 0) return null;
  if (jours === 0) return "Aujourd'hui";
  let mois = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) mois -= 1;
  const ans = Math.floor(mois / 12);
  if (ans >= 1) return `Il y a ${ans} an${ans > 1 ? "s" : ""}`;
  if (mois >= 1) return `Il y a ${mois} mois`;
  return `Il y a ${jours} jour${jours > 1 ? "s" : ""}`;
}

export function badgeProspect(p: any) {
  if (p?.issue === "installe") return { label: "Installation à venir", color: "var(--vert)", bg: "rgb(var(--vert-rgb) / 0.08)" };
  if (p?.issue === "decline")  return { label: "Décliné",  color: "var(--gris-fort)", bg: "var(--fond)" };
  // Après un re-contact, seule l'activité du cycle courant compte (même logique que l'admin).
  const debut = cycleCourantDebut(p);
  let dateDernierEchange = p?.date_dernier_echange;
  if (debut) {
    const echangesCycle = (p?.echanges||[]).filter((e:any)=>e.date_echange >= debut);
    if (!echangesCycle.length) return { label: "À recontacter", color: "var(--bleu)", bg: "rgb(var(--bleu-rgb) / 0.07)" };
    dateDernierEchange = echangesCycle.map((e:any)=>e.date_echange).sort().at(-1);
  }
  if (!dateDernierEchange) return null;
  const jours = Math.floor((Date.now() - new Date(dateDernierEchange).getTime()) / 86400000);
  if (jours <= 90)  return { label: "En cours",   color: "var(--vert)", bg: "rgb(var(--vert-rgb) / 0.08)" };
  if (jours <= 120) return { label: "En attente", color: "var(--gris-fort)", bg: "var(--fond)" };
  return                   { label: "Inactif",    color: "var(--danger)", bg: "rgb(var(--danger-rgb) / 0.07)" };
}

// Début du cycle de prospection courant : date du dernier re-contact.
export function cycleCourantDebut(p:any): string|null {
  const dates = (p?.cycles||[]).map((c:any)=>c.recontacte_le).filter(Boolean).map((d:string)=>d.slice(0,10));
  return dates.length ? dates.sort().at(-1) : null;
}

// Contraintes rattachées à un cycle donné (null = cycle courant).
export function contraintesDuCycle(p:any, cy:any): any[] {
  const nbCycles = (p?.cycles || []).length;
  return (p?.contraintes || []).filter((c:any)=>{
    return cy ? (c.cycle_num === cy.cycle_num - 1) : (c.cycle_num === nbCycles);
  });
}
export function contraintesCycleCourant(p:any): any[] { return contraintesDuCycle(p, null); }

// Échanges rattachés à un cycle donné (null = cycle courant).
export function echangesDuCycle(p:any, cy:any): any[] {
  const cyclesAsc = [...(p?.cycles||[])].sort((a:any,b:any)=>(a.conclu_le||"").localeCompare(b.conclu_le||""));
  const cycleDe = (iso:string) => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return cyclesAsc.find((c:any)=>c.conclu_le && t <= new Date(c.conclu_le).getTime()) || null;
  };
  return (p?.echanges||[]).filter((e:any)=>{
    const found = cycleDe(e.enregistre_le);
    return cy ? (found && found.id===cy.id) : !found;
  });
}

const PHONE_CANAUX = ["Appel téléphonique", "SMS", "WhatsApp", "Signal", "Telegram"];

export function canalIcon(canal: string): any {
  switch (canal) {
    case "Mail":               return Mail;
    case "Appel téléphonique": return Phone;
    case "SMS":                return MessageSquare;
    case "WhatsApp":           return MessageCircle;
    case "Signal":             return MessageCircle;
    case "Telegram":           return Send;
    case "Visioconférence":    return Video;
    case "Réunion physique":   return MapPin;
    case "LinkedIn":           return User;
    case "Courrier postal":    return Send;
    default:                   return MessageSquare;
  }
}

export function canalContactDisplay(canal: string, contact: string): string {
  if (!contact) return "";
  if (PHONE_CANAUX.includes(canal)) return fmtPhone(contact);
  return contact;
}

// ── Fiche prospect ────────────────────────────────────────────────────────────

// Le statut en surtitre : un mot sur l'aplat de sa couleur (.fiche-statut)
const TON_STATUT: Record<string, string> = {
  "En cours": "vert", "À recontacter": "bleu", "Installation à venir": "vert",
  "Inactif": "rouge", "Décliné": "gris", "En attente": "gris",
};

const dateLongue = (iso?: string | null) => (iso ? fmtDateLong(iso.slice(0, 10)) : null);
// « il y a 3 mois », « aujourd'hui » — pour suivre un verbe
const depuis = (iso?: string | null) => {
  const r = ilYa(iso ?? null);
  return r ? r.charAt(0).toLowerCase() + r.slice(1) : null;
};
// Chaque valeur une fois, dans l'ordre saisi
const uniques = (xs?: (string | null)[]) => [...new Set((xs || []).map(x => (x || "").trim()).filter(Boolean))];
const sansBalises = (html?: string | null) => (html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
// Un libellé de colonne : au pluriel, sauf pour un seul (« Échanges : Aucun »)
const libelle = (n: number, mot: string) => (n === 1 ? mot : `${mot}s`);
const lienSite = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);
const texteSite = (s: string) => s.replace(/^https?:\/\//i, "").replace(/\/+$/, "");

// Un échange : la date, le canal ; les personnes ; le compte rendu ; ses
// documents ; quand il a été saisi
function Echange({ e }: { e: any }) {
  const coord = e.canal ? canalContactDisplay(e.canal, e.canal_contact) : "";
  const personnes = [e.interlocuteur, e.contact_par].filter(Boolean).join(" · ");
  const saisie = e.enregistre_le
    ? `Enregistré le ${premierDuMois(new Date(e.enregistre_le).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }))} · ${e.retard_jours ? `saisi ${e.retard_jours} j après` : "saisi le jour même"}`
    : null;
  return (
    <div className="fiche-echange">
      <div className="fiche-echange-tete">
        <span className="fiche-echange-date">{dateLongue(e.date_echange)}</span>
        {e.canal && <span className="fiche-echange-canal">{e.canal}{coord ? ` · ${coord}` : ""}</span>}
      </div>
      {personnes && <div className="fiche-echange-personnes">{personnes}</div>}
      {e.commentaire && <FicheTexte html={e.commentaire} />}
      {e.fichiers?.length > 0 && (
        <FicheListeDocuments fichiers={e.fichiers} contexte={`Échange du ${dateLongue(e.date_echange)}`}
          hrefDe={f => `${API_BASE}/prospects/echanges/${e.id}/fichiers/${f.id}/download`} />
      )}
      {saisie && <div className="fiche-echange-saisie">{saisie}</div>}
    </div>
  );
}

// Les échanges, dans l'ordre où ils ont eu lieu
function ListeEchanges({ echanges }: { echanges: any[] }) {
  const tries = [...echanges].sort((a, b) => (a.date_echange || "").localeCompare(b.date_echange || ""));
  return <div className="fiche-echanges">{tries.map(e => <Echange key={e.id} e={e} />)}</div>;
}

// Les contraintes exprimées par l'investisseur, une ligne chacune
function ListeContraintes({ items }: { items: any[] }) {
  return (
    <div className="fiche-lignes">
      {items.map(c => <div key={c.id} className="fiche-ligne"><span className="fiche-ligne-paragraphe">{sansBalises(c.description)}</span></div>)}
    </div>
  );
}

// Un cycle de prospection passé : son issue en tête, son détail sur demande
function CyclePasse({ num, issue, concluLe, commentaire, echanges, contraintes }: {
  num: number; issue: string; concluLe?: string | null; commentaire?: string | null; echanges: any[]; contraintes: any[];
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="fiche-cycle">
      <button type="button" className="fiche-cycle-tete" aria-expanded={ouvert} onClick={() => setOuvert(o => !o)}>
        <span className="fiche-cycle-titre">
          Cycle {num} — {issue === "installe" ? "Installation au Sénégal" : "Possibilité écartée"}
          {concluLe && <span> · conclu le {dateLongue(concluLe)}</span>}
        </span>
        <span className="fiche-cycle-action">{ouvert ? "Masquer" : "Afficher"}</span>
      </button>
      {ouvert && (
        <div className="fiche-cycle-corps">
          {commentaire && <FicheTexte html={commentaire} />}
          {echanges.length > 0 && (
            <div>
              <p className="fiche-sous-titre">{echanges.length > 1 ? `Échanges · ${echanges.length}` : "Échange"}</p>
              <ListeEchanges echanges={echanges} />
            </div>
          )}
          {contraintes.length > 0 && (
            <div>
              <p className="fiche-sous-titre">{contraintes.length > 1 ? "Contraintes exprimées" : "Contrainte exprimée"}</p>
              <ListeContraintes items={contraintes} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// `onglet` : la vue — « cibles » (l'investisseur), « historique » (les
// échanges), « termines » (la conclusion).
// `complet` : faux tant que la fiche n'a que les champs de sa carte — ce qui
// manque arrive ensuite, à sa place. Non fourni, il se lit sur la fiche : la
// fiche entière porte ses échanges, la carte non.
export default function ProspectVueModal({ p, onglet, onClose, complet: completDonne }: {
  p: any; onglet: "cibles" | "historique" | "termines"; onClose: () => void; complet?: boolean;
}) {
  // Référentiels NAEMA servis par le cache partagé
  const { secteurs, branches, activites } = useNaema();
  const complet = completDonne ?? Array.isArray(p.echanges);

  // Le statut : calculé sur la fiche entière, celui du serveur sur la carte
  // (la même règle)
  const statut: string | null = complet ? (badgeProspect(p)?.label ?? null) : (p.statut ?? null);
  const nbEchanges: number = p.nb_echanges ?? (p.echanges || []).length;
  const etape = p.issue ? "Prospection conclue" : (nbEchanges > 0 || p.date_dernier_echange) ? "Investisseur en contact" : "Investisseur ciblé";
  const quand = p.issue && p.issue_conclu_le ? `${p.issue === "decline" ? "Décliné" : "Conclu"} ${depuis(p.issue_conclu_le)}`
    : p.date_dernier_echange ? `Dernier échange ${depuis(p.date_dernier_echange)}`
    : p.created_at ? `Ciblé ${depuis(p.created_at)}` : null;

  const echsCourant = complet ? echangesDuCycle(p, null) : [];
  const contrCourant = complet ? contraintesCycleCourant(p) : [];
  const cyclesTries = [...(p.cycles || [])].sort((a: any, b: any) => b.cycle_num - a.cycle_num);
  const recontacte = cycleCourantDebut(p);

  const tels = uniques(p.telephones), mails = uniques(p.mails);
  const aDesCoordonnees = tels.length > 0 || mails.length > 0 || !!p.siteweb || !!p.linkedin;
  const secIds: number[] = p.secteur_ids || [];
  const arbre = arbreNaema({ secteurs, branches, activites, secIds, braIds: p.branche_ids || [], actIds: p.activite_ids || [] });
  const points = [...(p.points_focaux || [])].sort((x: any, y: any) => Number(!!y.est_principal) - Number(!!x.est_principal));

  const cyclesPasses = cyclesTries.length > 0 && (
    <FicheRubrique titre="Cycles précédents" compte={cyclesTries.length} arrivee>
      <div className="fiche-cycles">
        {cyclesTries.map((cy: any) => (
          <CyclePasse key={cy.id} num={cy.cycle_num} issue={cy.issue} concluLe={cy.conclu_le} commentaire={cy.issue_commentaire}
            echanges={echangesDuCycle(p, cy)} contraintes={contraintesDuCycle(p, cy)} />
        ))}
      </div>
    </FicheRubrique>
  );
  const contraintes = contrCourant.length > 0 && (
    <FicheRubrique titre={contrCourant.length > 1 ? "Contraintes exprimées" : "Contrainte exprimée"} compte={contrCourant.length > 1 ? contrCourant.length : undefined} arrivee>
      <ListeContraintes items={contrCourant} />
    </FicheRubrique>
  );

  return (
    <FicheModal titre={p.nom} onClose={onClose} zIndex={500} maxWidth={760}
      surtitre={<>
        {statut && etape !== "Investisseur ciblé" && <span className="fiche-statut" data-ton={TON_STATUT[statut] || "gris"}>{statut}</span>}
        <span className="fiche-surtitre-texte">{etape}</span>
      </>}
      meta={(p.siege_nom || quand) && (
        <>
          {p.siege_nom && <span>{p.siege_nom}</span>}
          {quand && <span>{quand}</span>}
        </>
      )}>

      {/* ── Vue investisseur ── */}
      {onglet === "cibles" && <>
        <FicheFaits>
          <FicheFait libelle="Pays du siège" vide={!p.siege_nom}>{p.siege_nom || "Non renseigné"}</FicheFait>
          <FicheFait libelle="Ciblé le" vide={!p.created_at}>{dateLongue(p.created_at) || "Non renseigné"}</FicheFait>
          <FicheFait libelle={libelle(nbEchanges, "Échange")} attente={!complet} vide={nbEchanges === 0}>{nbEchanges || "Aucun"}</FicheFait>
        </FicheFaits>

        {!complet ? (
          <FicheRubrique titre="Coordonnées"><FicheAttente lignes={3} /></FicheRubrique>
        ) : aDesCoordonnees ? (
          <FicheRubrique titre="Coordonnées" arrivee>
            <dl className="fiche-liste">
              {tels.length > 0 && <><dt>{tels.length > 1 ? "Téléphones" : "Téléphone"}</dt><dd>{tels.map(t => <span key={t}>{fmtPhone(t)}</span>)}</dd></>}
              {mails.length > 0 && <><dt>{mails.length > 1 ? "Emails" : "Email"}</dt><dd>{mails.map(m => <span key={m}><a className="fiche-lien" href={`mailto:${m}`}>{m}</a></span>)}</dd></>}
              {p.siteweb && <><dt>Site web</dt><dd><a className="fiche-lien" href={lienSite(p.siteweb)} target="_blank" rel="noopener noreferrer">{texteSite(p.siteweb)}</a></dd></>}
              {p.linkedin && <><dt>LinkedIn</dt><dd><a className="fiche-lien" href={lienSite(p.linkedin)} target="_blank" rel="noopener noreferrer">{texteSite(p.linkedin)}</a></dd></>}
            </dl>
          </FicheRubrique>
        ) : null}

        {/* Activités : en attente des référentiels à la première fiche de la session */}
        {secIds.length > 0 && !secteurs.length ? (
          <FicheRubrique titre="Activités spécialisées"><FicheAttente lignes={2} /></FicheRubrique>
        ) : complet && arbre.length > 0 ? (
          <FicheRubrique titre="Activités spécialisées" arrivee><FicheArborescence data={arbre} /></FicheRubrique>
        ) : null}

        {complet && points.length > 0 && (
          <FicheRubrique titre={points.length > 1 ? "Points focaux" : "Point focal"} compte={points.length > 1 ? points.length : undefined} arrivee>
            <div className="fiche-personnes">
              {points.map((pf: any, i: number) => {
                const t = uniques(pf.telephones), m = uniques(pf.mails);
                return (
                  <div key={pf.id ?? i} className="fiche-personne">
                    <div style={{ minWidth: 0 }}>
                      <p className="fiche-personne-nom">{[pf.prenom, pf.nom].filter(Boolean).join(" ")}</p>
                      {pf.est_principal && <p className="fiche-personne-role">Contact principal</p>}
                    </div>
                    {(t.length > 0 || m.length > 0) && (
                      <div className="fiche-personne-contacts">
                        {t.map(x => <span key={x}>{fmtPhone(x)}</span>)}
                        {m.map(x => <a key={x} className="fiche-lien" href={`mailto:${x}`}>{x}</a>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </FicheRubrique>
        )}
      </>}

      {/* ── Vue échanges ── */}
      {onglet === "historique" && <>
        <FicheFaits>
          <FicheFait libelle={libelle(echsCourant.length, "Échange")} attente={!complet} vide={echsCourant.length === 0}>{echsCourant.length || "Aucun"}</FicheFait>
          <FicheFait libelle="Dernier échange" vide={!p.date_dernier_echange} note={depuis(p.date_dernier_echange) ?? undefined}>
            {dateLongue(p.date_dernier_echange) || "Aucun"}
          </FicheFait>
          {recontacte
            ? <FicheFait libelle="Cycle en cours" note={`recontacté le ${dateLongue(recontacte)}`}>{`Cycle ${cyclesTries.length + 1}`}</FicheFait>
            : <FicheFait libelle="Premier échange" attente={!complet} vide={!p.date_premier_echange}>{dateLongue(p.date_premier_echange) || "Aucun"}</FicheFait>}
        </FicheFaits>

        {!complet ? (
          <FicheRubrique titre="Échanges"><FicheAttente lignes={5} /></FicheRubrique>
        ) : (
          <FicheRubrique titre={echsCourant.length > 1 ? "Échanges" : "Échange"} compte={echsCourant.length > 1 ? echsCourant.length : undefined} arrivee>
            {echsCourant.length > 0
              ? <ListeEchanges echanges={echsCourant} />
              : <p className="fiche-note-rubrique" style={{ margin: 0 }}>Aucun échange dans le cycle en cours.</p>}
          </FicheRubrique>
        )}
        {contraintes}
        {cyclesPasses}
      </>}

      {/* ── Vue conclusion ── */}
      {onglet === "termines" && <>
        <FicheFaits>
          <FicheFait libelle={p.issue === "decline" ? "Décliné le" : "Conclu le"} vide={!p.issue_conclu_le}>{dateLongue(p.issue_conclu_le) || "Non renseigné"}</FicheFait>
          <FicheFait libelle={libelle(echsCourant.length, "Échange")} attente={!complet} vide={echsCourant.length === 0}>{echsCourant.length || "Aucun"}</FicheFait>
          <FicheFait libelle="Cycles de prospection" attente={!complet}>{cyclesTries.length + 1}</FicheFait>
        </FicheFaits>

        {!complet ? (
          <FicheRubrique titre="Conclusion"><FicheAttente lignes={4} /></FicheRubrique>
        ) : p.issue_commentaire ? (
          <FicheRubrique titre="Conclusion" arrivee><FicheTexte html={p.issue_commentaire} /></FicheRubrique>
        ) : null}
        {complet && echsCourant.length > 0 && (
          <FicheRubrique titre={echsCourant.length > 1 ? "Échanges" : "Échange"} compte={echsCourant.length > 1 ? echsCourant.length : undefined} arrivee>
            <ListeEchanges echanges={echsCourant} />
          </FicheRubrique>
        )}
        {contraintes}
        {cyclesPasses}
      </>}
    </FicheModal>
  );
}
