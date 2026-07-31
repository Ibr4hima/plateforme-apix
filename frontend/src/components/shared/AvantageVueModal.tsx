"use client";

// Fiche avantages & incitations d'une activité — page Opportunités et
// recherche globale (⌘K). Bâtie sur la fiche modale commune (FicheModal).

import { useEffect, useState } from "react";
import { badge_bleu, badge_orange } from "@/lib/couleurs";
import FicheModal, { FicheCarteNeutre, FicheDocs, FicheSection, FicheTexteRiche } from "@/components/shared/FicheModal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function AvantageVueModal({ avg: a, onClose }: { avg:any; onClose:()=>void }) {
  const [data, setData] = useState<any>(a);

  useEffect(() => {
    fetch(`${API}/opportunites/avantages/${a.id}`)
      .then(r => r.json()).then(setData).catch(() => {});
  }, [a.id]);

  return (
    <FicheModal titre={data.activite_nom} onClose={onClose}
      badges={<>
        {data.secteur_nom && <span style={badge_bleu}>{data.secteur_nom}</span>}
        {data.branche_nom && <span style={{ ...badge_orange, minWidth: 0 }} title={data.branche_nom}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.branche_nom}</span>
        </span>}
      </>}>

      {/* Avantages sélectionnés */}
      {(data.selections || []).length > 0 && (
        <FicheSection titre="Avantages & incitations">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(data.selections || []).map((s: any, i: number) => (
              <FicheCarteNeutre key={s.id ?? i}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: s.commentaire ? 6 : 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#188038", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#188038" }}>{s.type_libelle}</span>
                </div>
                {s.commentaire && <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.7, marginLeft: 14, whiteSpace: "pre-wrap" }}>{s.commentaire}</p>}
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
