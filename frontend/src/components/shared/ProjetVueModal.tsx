"use client";

// Fiche projet d'investissement — page Opportunités et recherche globale (⌘K).
// Bâtie sur la fiche modale commune (FicheModal).

import { badge_bleu, badge_orange, badge_vert, badge_violet } from "@/lib/couleurs";
import FicheModal, { FicheArbreNaema, FicheBloc, FicheCarteNeutre, FicheContacts, FicheDocs, FicheGrille, FicheSection, FicheTexteRiche, FicheValeur } from "@/components/shared/FicheModal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const devSymbole = (code?:string, sym?:string) => sym || (code ? ({XOF:"FCFA",USD:"$",EUR:"€"}[code]||code) : "");

export default function ProjetVueModal({ projet: p, secteurs, branches, activites, onClose }: {
  projet:any; secteurs:any[]; branches:any[]; activites:any[]; onClose:()=>void;
}) {
  const fmtInvest = () => {
    const sym = devSymbole(p.devise_code, p.devise_symbole);
    if (!p.investissement_est_intervalle)
      return p.investissement ? `${Number(p.investissement).toLocaleString("fr-FR")} ${sym}` : null;
    if (!p.investissement_min) return null;
    const min = Number(p.investissement_min).toLocaleString("fr-FR");
    const max = p.investissement_max ? Number(p.investissement_max).toLocaleString("fr-FR") : "…";
    return `${min} — ${max} ${sym}`;
  };
  const invest = fmtInvest();

  // Carte d'une personne (porteur ou point focal) : nom + pastilles de contact
  const CartePersonne = ({ nom, tels, mails }: { nom: string; tels: string[]; mails: string[] }) => (
    <FicheCarteNeutre style={{ padding: "11px 14px" }}>
      {nom && <p style={{ fontWeight: 700, fontSize: 13, color: "var(--encre)" }}>{nom}</p>}
      <FicheContacts tels={tels} mails={mails} />
    </FicheCarteNeutre>
  );

  return (
    <FicheModal titre={p.titre_projet} onClose={onClose} maxWidth={680}
      badges={<>
        {p.pole_nom && <span style={badge_bleu}>{p.pole_nom}</span>}
        {p.region_nom && <span style={badge_orange}>Région de {p.region_nom}</span>}
        {p.departement_nom && <span style={badge_vert}>Département de {p.departement_nom}</span>}
        {p.arrondissement_nom && <span style={badge_violet}>Arrondissement de {p.arrondissement_nom}</span>}
      </>}>

      {/* Investissement / Date */}
      {(invest || p.date_debut) && (
        <FicheSection titre="Informations">
          <FicheGrille>
            {invest && <FicheBloc label="Investissement"><FicheValeur fort>{invest}</FicheValeur></FicheBloc>}
            {p.date_debut && <FicheBloc label="Date de début"><FicheValeur>{new Date(p.date_debut + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</FicheValeur></FicheBloc>}
          </FicheGrille>
        </FicheSection>
      )}

      {/* Description */}
      {p.description && (
        <FicheSection titre="Description">
          <FicheTexteRiche html={p.description} />
        </FicheSection>
      )}

      {/* Thématiques */}
      {(p.secteur_ids?.length > 0 || p.branche_ids?.length > 0) && (
        <FicheSection titre="Thématiques du projet">
          <FicheArbreNaema secteurs={secteurs} branches={branches} activites={activites}
            secIds={p.secteur_ids || []} braIds={p.branche_ids || []} actIds={p.activite_ids || []} />
        </FicheSection>
      )}

      {/* Porteurs */}
      {p.porteurs?.length > 0 && (
        <FicheSection titre={p.porteurs.length > 1 ? "Porteurs du projet" : "Porteur du projet"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {p.porteurs.map((por: any, pi: number) => (
              <CartePersonne key={pi} nom={por.nom} tels={(por.telephones || []).filter(Boolean)} mails={(por.mails || []).filter(Boolean)} />
            ))}
          </div>
        </FicheSection>
      )}

      {/* Points focaux */}
      {p.points_focaux?.length > 0 && (
        <FicheSection titre="Points focaux">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {p.points_focaux.map((pf: any, fi: number) => (
              <CartePersonne key={fi} nom={[pf.civilite, pf.prenom, pf.nom].filter(Boolean).join(" ")}
                tels={(pf.telephones || []).filter(Boolean)} mails={(pf.mails || []).filter(Boolean)} />
            ))}
          </div>
        </FicheSection>
      )}

      {/* Documents */}
      <FicheDocs fichiers={p.fichiers || []} hrefDe={f => `${API}/projets/${p.id}/fichiers/${f.id}/download`} />
    </FicheModal>
  );
}
