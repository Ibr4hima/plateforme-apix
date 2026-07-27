"use client";

// Fiche accord — partagée entre la page Accords (publique et admin) et la
// Fiche Pays. Bâtie sur la fiche modale commune (FicheModal).

import { useEffect, useState } from "react";
import { useNaema, useRefPays } from "@/lib/referentiels";
import { fmtDate } from "@/lib/format";
import { computeStatutAccord as computeStatut } from "@/lib/statuts";
import { badge_bleu, badge_gris, badge_vert } from "@/lib/couleurs";
import FicheModal, { FicheArbreNaema, FicheBloc, FicheDocs, FicheGrille, FicheSection, FicheTexteRiche, FicheValeur } from "@/components/shared/FicheModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// fmtDate : centralisé dans lib/format (ré-exporté pour les imports existants)
export { fmtDate } from "@/lib/format";
export { computeStatutAccord as computeStatut } from "@/lib/statuts";

// Statuts sur les jetons du design system — alignés sur les cards :
// en vigueur vert, signé bleu, expiré gris.
const STATUT_BADGE: Record<string, { label: string; style: React.CSSProperties }> = {
  en_vigueur: { label: "En vigueur",           style: badge_vert },
  signe:      { label: "Signé non en vigueur", style: badge_bleu },
  expire:     { label: "Expiré",               style: badge_gris },
};

// ── Fiche accord ──────────────────────────────────────────────────────────────
// `actions` : boutons additionnels dans le pied (ex. « Modifier » en admin).
export default function AccordVueModal({ accord:a, onClose, zIndex = 400, actions }: { accord:any; onClose:()=>void; zIndex?:number; actions?:React.ReactNode }) {
  const [fichiers, setFichiers] = useState<any[]>([]);
  // Référentiels servis par le cache partagé ; seuls les fichiers dépendent de l'accord
  const { secteurs, branches, activites } = useNaema();
  const { data: paysData } = useRefPays();
  const allPays: any[] = (paysData as any[]) || [];

  useEffect(() => {
    fetch(`${API_BASE}/accords/${a.id}/fichiers`).then(r => r.json()).then(setFichiers).catch(() => {});
  }, [a.id]);

  const statut = computeStatut(a);
  const stV = statut ? STATUT_BADGE[statut] : null;
  const secIds: number[] = a.secteur_ids  || [];
  const braIds: number[] = a.branche_ids  || [];
  const actIds: number[] = a.activite_ids || [];
  const hasNaema = secIds.length > 0 || braIds.length > 0 || actIds.length > 0;

  return (
    <FicheModal titre={a.titre} onClose={onClose} zIndex={zIndex} actions={actions}
      badges={<>
        {stV && <span style={stV.style}>{stV.label}</span>}
        {a.reference && <span style={badge_gris}>{a.reference}</span>}
      </>}>

      {/* Dates */}
      <FicheSection titre="Dates">
        <FicheGrille>
          <FicheBloc label="Signature"><FicheValeur vide={!a.date_signature}>{a.date_signature ? fmtDate(a.date_signature) : "—"}</FicheValeur></FicheBloc>
          {a.date_entree_vigueur && <FicheBloc label="Entrée en vigueur"><FicheValeur>{fmtDate(a.date_entree_vigueur)}</FicheValeur></FicheBloc>}
          <FicheBloc label="Expiration"><FicheValeur vide={!a.date_expiration}>{a.date_expiration ? fmtDate(a.date_expiration) : "Non définie"}</FicheValeur></FicheBloc>
        </FicheGrille>
      </FicheSection>

      {/* Résumé */}
      {a.commentaires && (
        <FicheSection titre="Résumé">
          <FicheTexteRiche html={a.commentaires} />
        </FicheSection>
      )}

      {/* Parties signataires — inutile pour un TBI : déjà dans le titre */}
      {a.type_accord !== "tbi" && (a.parties_pays_ids?.length > 0 || a.parties_signataires) && (
        <FicheSection titre="Parties signataires">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {(a.parties_pays_ids || []).map((id: number) => {
              const p = allPays.find((r: any) => r.id === id);
              return <span key={id} style={badge_bleu}>{p?.nom_fr || `#${id}`}</span>;
            })}
            {a.parties_signataires && a.parties_signataires.split(", ").filter(Boolean).map((p: string) => (
              <span key={p} style={badge_bleu}>{p}</span>
            ))}
          </div>
        </FicheSection>
      )}

      {/* Thématiques */}
      {hasNaema && (
        <FicheSection titre="Thématiques">
          <FicheArbreNaema secteurs={secteurs} branches={branches} activites={activites} secIds={secIds} braIds={braIds} actIds={actIds} />
        </FicheSection>
      )}

      {/* Documents */}
      <FicheDocs fichiers={fichiers} hrefDe={f => `${API_BASE}/accords/${a.id}/fichiers/${f.id}/download`} />
    </FicheModal>
  );
}
