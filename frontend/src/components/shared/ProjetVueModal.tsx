"use client";

// Fiche projet d'investissement — page Opportunités et recherche globale (⌘K).
// Bâtie sur la fiche modale commune (FicheModal).

import FicheModal, { FicheArbreNaema, FicheBloc, FicheCarteNeutre, FicheContacts, FicheDocs, FicheGrille, FicheSection, FicheTexteRiche, FicheValeur } from "@/components/shared/FicheModal";

import { API_BASE as API } from "@/lib/api";

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
>

      {/* Localisation — les quatre échelons portaient chacun leur couleur en
          pastille ; ils sont ici nommés, dans l'ordre du plus large au plus
          fin. */}
      {(p.pole_nom || p.region_nom || p.departement_nom || p.arrondissement_nom) && (
        <FicheSection titre="Localisation">
          <FicheGrille>
            {p.pole_nom && <FicheBloc label="Pôle territoire"><FicheValeur>{p.pole_nom}</FicheValeur></FicheBloc>}
            {p.region_nom && <FicheBloc label="Région"><FicheValeur>{p.region_nom}</FicheValeur></FicheBloc>}
            {p.departement_nom && <FicheBloc label="Département"><FicheValeur>{p.departement_nom}</FicheValeur></FicheBloc>}
            {p.arrondissement_nom && <FicheBloc label="Arrondissement"><FicheValeur>{p.arrondissement_nom}</FicheValeur></FicheBloc>}
          </FicheGrille>
        </FicheSection>
      )}

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
