"use client";

// Fiche entreprise — partagée entre la page Entreprises, les zones et la
// recherche globale (⌘K). Bâtie sur la fiche modale commune (FicheModal).

import { useNaema } from "@/lib/referentiels";
import { fmtDateLong } from "@/lib/format";
import { fmtPhone } from "@/lib/telephone";
import { badge_bleu, badge_gris, badge_orange, badgePole } from "@/lib/couleurs";
import FicheModal, { FicheArbreNaema, FicheBloc, FicheCarteNeutre, FicheContacts, FicheGrille, FicheLien, FicheSection, FicheValeur } from "@/components/shared/FicheModal";

// `actions` : boutons additionnels dans le pied (ex. « Modifier » en admin).
interface Props { entreprise: any | null; onClose: () => void; zIndex?: number; actions?: React.ReactNode; }

export default function EntreprisePublicModal({ entreprise: e, onClose, zIndex = 500, actions }: Props) {
  // Référentiels NAEMA servis par le cache partagé (une seule requête par session)
  const { secteurs, branches, activites } = useNaema();

  if (!e) return null;

  const secIds: number[] = e.secteur_ids  || [];
  const braIds: number[] = e.branche_ids  || [];
  const actIds: number[] = e.activite_ids || [];
  const hasNaema = secIds.length > 0 || braIds.length > 0 || actIds.length > 0;
  const locStr = [e.arrondissement_nom, e.departement_nom, e.region_nom].filter(Boolean).join(", ");
  // L'API retourne `pays` comme libellé lisible, `siege_pays_nom` est souvent null
  const paysStr = e.siege_pays_nom || e.pays || null;

  return (
    <FicheModal titre={e.nom} onClose={onClose} zIndex={zIndex} actions={actions}
      badges={<>
        {e.forme_juridique && <span style={badge_gris}>{e.forme_juridique}</span>}
        {e.pole_territoire_nom && <span style={badgePole(e.pole_territoire_nom)}>{e.pole_territoire_nom}</span>}
        {e.region_nom && <span style={badge_bleu}>Région de {e.region_nom}</span>}
      </>}>

      {/* Informations */}
      <FicheSection titre="Informations">
        <FicheGrille>
          {e.date_creation && <FicheBloc label="Création"><FicheValeur>{fmtDateLong(e.date_creation)}</FicheValeur></FicheBloc>}
          {paysStr && <FicheBloc label="Pays du siège"><FicheValeur>{paysStr}</FicheValeur></FicheBloc>}
          {locStr && <FicheBloc label="Localisation"><FicheValeur>{locStr}</FicheValeur></FicheBloc>}
          {e.adresse && <FicheBloc label="Adresse"><FicheValeur>{e.adresse}</FicheValeur></FicheBloc>}
          {e.siteweb && <FicheBloc label="Site web" full><FicheLien href={e.siteweb}>{e.siteweb}</FicheLien></FicheBloc>}
        </FicheGrille>
      </FicheSection>

      {/* Contact */}
      {(e.telephone || e.mail) && (
        <FicheSection titre="Contact">
          <FicheGrille>
            {e.telephone && (
              <FicheBloc label={e.telephone.includes(",") ? "Téléphones" : "Téléphone"}>
                {e.telephone.split(",").map((t: string, i: number) => <FicheValeur key={i}>{fmtPhone(t.trim())}</FicheValeur>)}
              </FicheBloc>
            )}
            {e.mail && (
              <FicheBloc label={e.mail.includes(",") ? "Emails" : "Email"}>
                {e.mail.split(",").map((m: string, i: number) => (
                  <p key={i} style={{ fontSize: 12.5, fontWeight: 600, color: "#1a1a2e", wordBreak: "break-all" }}>{m.trim()}</p>
                ))}
              </FicheBloc>
            )}
          </FicheGrille>
        </FicheSection>
      )}

      {/* NAEMA */}
      {hasNaema && secteurs.length > 0 && (
        <FicheSection titre="Activités de l'entreprise">
          <FicheArbreNaema secteurs={secteurs} branches={branches} activites={activites} secIds={secIds} braIds={braIds} actIds={actIds} />
        </FicheSection>
      )}

      {/* Points focaux */}
      {e.points_focaux?.length > 0 && (
        <FicheSection titre="Points focaux">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {e.points_focaux.map((pf: any, i: number) => (
              <FicheCarteNeutre key={i} style={{ padding: "11px 14px", fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "#1a1a2e" }}>{[pf.civilite, pf.prenom, pf.nom].filter(Boolean).join(" ")}</span>
                  {pf.poste && <span style={{ color: "#9aa5b4" }}>{pf.poste}</span>}
                  {pf.est_principal && <span style={badge_orange}>Principal</span>}
                </div>
                <FicheContacts
                  tels={(pf.telephone || "").split(",").map((t: string) => t.trim()).filter(Boolean)}
                  mails={(pf.mail || "").split(",").map((m: string) => m.trim()).filter(Boolean)} />
              </FicheCarteNeutre>
            ))}
          </div>
        </FicheSection>
      )}
    </FicheModal>
  );
}
