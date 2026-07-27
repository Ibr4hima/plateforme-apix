"use client";

// Fiche événement — partagée entre la page Événements (publique et admin) et
// la recherche globale (⌘K). Bâtie sur la fiche modale commune (FicheModal).

import { fmtDate } from "@/lib/format";
import { computeStatutEvenement } from "@/lib/statuts";
import { badge_ambre, badge_bleu, badge_gris, badge_orange, badge_vert, badge_violet } from "@/lib/couleurs";
import FicheModal, { FicheArbre, FicheBloc, FicheDocs, FicheGrille, FicheSection, FicheTexteRiche, FicheValeur } from "@/components/shared/FicheModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

// Rôles APIX sur les jetons du design system — alignés sur les cards :
// organisation vert, participant orange, partenaire bleu, invité violet,
// sponsor ambre. (ROLE_PILL conservé pour les imports historiques.)
export const ROLE_BADGE: Record<string, React.CSSProperties> = {
  "Organisateur":    badge_vert,
  "Co-organisateur": badge_vert,
  "Participant":     badge_orange,
  "Partenaire":      badge_bleu,
  "Invité":          badge_violet,
  "Sponsor":         badge_ambre,
};
export const ROLE_PILL: Record<string,{c:string;bg:string}> = {
  "Organisateur":    { c:"#188038", bg:"rgba(24,128,56,0.08)"  },
  "Co-organisateur": { c:"#188038", bg:"rgba(24,128,56,0.08)"  },
  "Participant":     { c:"#ca631f", bg:"rgba(202,99,31,0.08)"  },
  "Partenaire":      { c:"#004f91", bg:"rgba(0,79,145,0.07)"   },
  "Sponsor":         { c:"#a16207", bg:"rgba(161,98,7,0.08)"   },
  "Invité":          { c:"#6A1B9A", bg:"rgba(106,27,154,0.07)" },
};
export const ROLES_APIX: Record<string,string> = { "Organisateur":"Organisateur","Co-organisateur":"Co-organisateur","Participant":"Participant","Partenaire":"Partenaire","Sponsor":"Sponsor","Invité":"Invité" };

export function ordinal(n: number) { return n === 1 ? "1ère édition" : `${n}ème édition`; }

// Statuts sur les jetons du design system
const STATUT_BADGE: Record<string, { label: string; style: React.CSSProperties }> = {
  a_venir:  { label: "À venir",  style: badge_bleu },
  en_cours: { label: "En cours", style: badge_vert },
  termine:  { label: "Terminé",  style: badge_gris },
};

// ── Fiche événement ───────────────────────────────────────────────────────────
// `actions` : boutons additionnels dans le pied (ex. « Modifier » en admin).
export default function EvenementVueModal({ ev:e, onClose, actions }: { ev:any; onClose:()=>void; actions?:React.ReactNode }) {
  if (!e) return null;
  const dateStr = e.date_debut
    ? (e.date_debut===e.date_fin||!e.date_fin ? fmtDate(e.date_debut) : `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}`)
    : e.prochain_mois ? `${e.prochain_jour?e.prochain_jour+" ":""}${MOIS[(e.prochain_mois||1)-1]} ${e.prochain_annee||""}` : null;
  const statutV = computeStatutEvenement(e) ?? ((e.prochain_annee || e.prochain_mois) ? "a_venir" : null);
  const stV = statutV ? STATUT_BADGE[statutV] : null;

  // Thématiques : l'API livre l'arborescence déjà résolue
  const arbre = e.thematiques_tree
    ? Object.entries(e.thematiques_tree).map(([sec, branches]: any) => ({
        cle: sec, nom: sec,
        enfants: Object.entries(branches).map(([bra, acts]: any) => ({
          cle: bra, nom: bra,
          enfants: (acts as string[]).map((act: string) => ({ cle: act, nom: act })),
        })),
      }))
    : [];

  const paysInvites: string[] = (e.pays_invites_noms || "").split(",").map((p: string) => p.trim()).filter(Boolean);
  const entInvitees: string[] = (e.entreprises_invitees || "").split(",").map((s: string) => s.trim()).filter(Boolean);

  return (
    <FicheModal titre={e.nom_event} onClose={onClose} actions={actions}
      badges={<>
        {stV && <span style={stV.style}>{stV.label}</span>}
        {e.edition != null && <span style={badge_gris}>{ordinal(e.edition)}</span>}
        {e.role_apix && <span style={ROLE_BADGE[e.role_apix] || badge_gris}>{ROLES_APIX[e.role_apix] || e.role_apix}</span>}
      </>}>

      {/* Informations */}
      <FicheSection titre="Informations">
        <FicheGrille>
          {dateStr && (
            <FicheBloc label="Date">
              <FicheValeur>{dateStr}</FicheValeur>
              {e.duree_jours && <p style={{ fontSize: 10.5, color: "#9aa5b4", marginTop: 2 }}>{e.duree_jours} jour{e.duree_jours > 1 ? "s" : ""}</p>}
            </FicheBloc>
          )}
          {(e.ville || e.pays_hote_nom) && <FicheBloc label="Lieu"><FicheValeur>{[e.ville, e.pays_hote_nom].filter(Boolean).join(", ")}</FicheValeur></FicheBloc>}
          {e.organisateur && <FicheBloc label="Organisateur"><FicheValeur>{e.organisateur}</FicheValeur></FicheBloc>}
          {e.est_recurrent && <FicheBloc label="Récurrence"><FicheValeur>Tous les {e.frequence_valeur} {e.frequence_type === "mois" ? "mois" : `an${e.frequence_valeur > 1 ? "s" : ""}`}</FicheValeur></FicheBloc>}
        </FicheGrille>
      </FicheSection>

      {/* Description */}
      {e.description && (
        <FicheSection titre="Description">
          <FicheTexteRiche html={e.description} />
        </FicheSection>
      )}

      {/* Thématiques */}
      {arbre.length > 0 && (
        <FicheSection titre="Thématiques">
          <FicheArbre data={arbre} />
        </FicheSection>
      )}

      {/* Participants */}
      {(paysInvites.length > 0 || entInvitees.length > 0) && (
        <FicheSection titre="Participants">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {paysInvites.length > 0 && (
              <div>
                <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "#9aa5b4", textTransform: "uppercase", marginBottom: 5 }}>Pays invités</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {paysInvites.map(p => <span key={p} style={badge_bleu}>{p}</span>)}
                </div>
              </div>
            )}
            {entInvitees.length > 0 && (
              <div>
                <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "#9aa5b4", textTransform: "uppercase", marginBottom: 5 }}>Entreprises invitées</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {entInvitees.map(ent => <span key={ent} style={badge_bleu}>{ent}</span>)}
                </div>
              </div>
            )}
          </div>
        </FicheSection>
      )}

      {/* Documents */}
      <FicheDocs fichiers={e.fichiers || []} hrefDe={f => `${API_BASE}/evenements/${e.id}/fichiers/${f.id}/download`} />
    </FicheModal>
  );
}
