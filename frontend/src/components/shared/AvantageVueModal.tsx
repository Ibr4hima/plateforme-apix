"use client";

// Fiche avantages & incitations d'une activité — page Opportunités et
// recherche globale (⌘K). Bâtie sur la fiche modale commune (FicheModal).

import { useEffect, useState } from "react";
import FicheModal, { FicheBloc, FicheCarteNeutre, FicheDocs, FicheGrille, FicheSection, FicheTexteRiche, FicheValeur } from "@/components/shared/FicheModal";

import { API_BASE as API } from "@/lib/api";

export default function AvantageVueModal({ avg: a, onClose }: { avg:any; onClose:()=>void }) {
  const [data, setData] = useState<any>(a);

  useEffect(() => {
    fetch(`${API}/opportunites/avantages/${a.id}`)
      .then(r => r.json()).then(setData).catch(() => {});
  }, [a.id]);

  return (
    <FicheModal titre={data.activite_nom} onClose={onClose}>

      {/* Rattachement — secteur et branche, anciennes pastilles du titre */}
      {(data.secteur_nom || data.branche_nom) && (
        <FicheSection titre="Rattachement">
          <FicheGrille>
            {data.secteur_nom && <FicheBloc label="Secteur"><FicheValeur>{data.secteur_nom}</FicheValeur></FicheBloc>}
            {data.branche_nom && <FicheBloc label="Branche"><FicheValeur>{data.branche_nom}</FicheValeur></FicheBloc>}
          </FicheGrille>
        </FicheSection>
      )}

      {/* Avantages sélectionnés */}
      {(data.selections || []).length > 0 && (
        <FicheSection titre="Avantages & incitations">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(data.selections || []).map((s: any, i: number) => (
              <FicheCarteNeutre key={s.id ?? i}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: s.commentaire ? 6 : 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--vert-action)", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--vert)" }}>{s.type_libelle}</span>
                </div>
                {s.commentaire && <p style={{ fontSize: 13, color: "var(--texte)", lineHeight: 1.7, marginLeft: 14, whiteSpace: "pre-wrap" }}>{s.commentaire}</p>}
              </FicheCarteNeutre>
            ))}
          </div>
        </FicheSection>
      )}

      {/* Description */}
      {data.avantages && (
        <FicheSection titre="Description">
          <FicheTexteRiche html={data.avantages} />
        </FicheSection>
      )}

      {/* Documents */}
      <FicheDocs fichiers={data.fichiers || []} hrefDe={f => `${API}/opportunites/avantages/${data.id}/fichiers/${f.id}/download`} />
    </FicheModal>
  );
}
