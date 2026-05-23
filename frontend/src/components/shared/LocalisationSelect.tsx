"use client";

/**
 * LocalisationSelect — sélecteur de localisation en cascade
 * Travaille avec des IDs (integers).
 *
 * Props :
 *   regionId / departementId / arrondissementId + setters correspondants
 */

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface GeoItem { id: number; nom: string; region_id?: number; departement_id?: number; }

interface Props {
  regionId:           number | null;
  departementId:      number | null;
  arrondissementId:   number | null;
  onChangeRegion:     (id: number | null) => void;
  onChangeDepartement:(id: number | null) => void;
  onChangeArrondissement:(id: number | null) => void;
}

function GeoSelect({ label, options, value, onChange, disabled, color }: {
  label:string; options:GeoItem[]; value:number|null;
  onChange:(id:number|null)=>void; disabled?:boolean; color:string;
}) {
  const IS: React.CSSProperties = {
    width:"100%", background:disabled?"#E8E5E3":"#F2F0EF",
    border:`1px solid ${value?color+"50":"#C5BFBB"}`,
    borderRadius:8, padding:"9px 32px 9px 12px", fontSize:13,
    color:value?"#1a1a2e":"#9aa5b4", outline:"none",
    fontFamily:"var(--font-google-sans)", cursor:disabled?"not-allowed":"pointer",
    appearance:"none" as const, WebkitAppearance:"none" as const,
    boxSizing:"border-box" as const,
  };
  return (
    <div style={{ flex:1, minWidth:0 }}>
      <label style={{ fontSize:12, fontWeight:600, color:value?color:"#4a5568", marginBottom:4, display:"block" }}>{label}</label>
      <div style={{ position:"relative" as const }}>
        <select value={value??""} disabled={disabled} onChange={e=>onChange(e.target.value?Number(e.target.value):null)} style={IS}>
          <option value="">{disabled?`Choisir ${label.split(" ")[0].toLowerCase()} d'abord`:`— ${label} —`}</option>
          {options.map(o=><option key={o.id} value={o.id}>{o.nom}</option>)}
        </select>
        <ChevronDown size={13} style={{ position:"absolute" as const, right:10, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4", pointerEvents:"none" }}/>
      </div>
      {value && (
        <button onClick={()=>onChange(null)} style={{ fontSize:10, color:"#dc2626", background:"none", border:"none", cursor:"pointer", padding:"2px 0", marginTop:2 }}>
          Effacer
        </button>
      )}
    </div>
  );
}

export default function LocalisationSelect({ regionId, departementId, arrondissementId, onChangeRegion, onChangeDepartement, onChangeArrondissement }: Props) {
  const [regions,       setRegions]       = useState<GeoItem[]>([]);
  const [departements,  setDepartements]  = useState<GeoItem[]>([]);
  const [arrondissements, setArrondissements] = useState<GeoItem[]>([]);

  // Charger les régions une fois
  useEffect(() => {
    fetch(`${API_BASE}/entreprises/ref/regions`).then(r=>r.json()).then(setRegions).catch(()=>{});
  }, []);

  // Charger les départements quand la région change
  useEffect(() => {
    setDepartements([]); setArrondissements([]);
    if (!regionId) return;
    fetch(`${API_BASE}/entreprises/ref/departements?region_id=${regionId}`).then(r=>r.json()).then(setDepartements).catch(()=>{});
  }, [regionId]);

  // Charger les arrondissements quand le département change
  useEffect(() => {
    setArrondissements([]);
    if (!departementId) return;
    fetch(`${API_BASE}/entreprises/ref/arrondissements?departement_id=${departementId}`).then(r=>r.json()).then(setArrondissements).catch(()=>{});
  }, [departementId]);

  const handleRegion = (id: number|null) => {
    onChangeRegion(id);
    onChangeDepartement(null);
    onChangeArrondissement(null);
  };
  const handleDept = (id: number|null) => {
    onChangeDepartement(id);
    onChangeArrondissement(null);
  };

  return (
    <div style={{ display:"flex", gap:12 }}>
      <GeoSelect label="Région" options={regions} value={regionId} onChange={handleRegion} color="#004f91"/>
      <GeoSelect label="Département" options={departements} value={departementId} onChange={handleDept} disabled={!regionId} color="#ca631f"/>
      <GeoSelect label="Arrondissement" options={arrondissements} value={arrondissementId} onChange={onChangeArrondissement} disabled={!departementId} color="#188038"/>
    </div>
  );
}
