"use client";

/**
 * GeoCascadeSelect — localisation Région → Département → Arrondissement.
 * Même présentation que NaemaSelect (colonnes repliables, chips de résumé),
 * mais en sélection SIMPLE à chaque niveau.
 * Couleurs cascade du site : Région #004f91 · Département #ca631f · Arrondissement #188038.
 *
 * Même contrat de props que LocalisationSelect (swap direct).
 */

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import { voile } from "@/lib/couleurs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface GeoItem { id: number; nom: string; region_id?: number; departement_id?: number; }

interface Props {
  /** Restreint la liste des régions (ex : régions du pôle sélectionné) */
  filterRegionIds?:       number[];
  regionId:               number | null;
  departementId:          number | null;
  arrondissementId:       number | null;
  onChangeRegion:         (id: number | null) => void;
  onChangeDepartement:    (id: number | null) => void;
  onChangeArrondissement: (id: number | null) => void;
}

function RadioItem({ label, selected, onToggle, color }: { label: string; selected: boolean; onToggle: () => void; color: string }) {
  return (
    <button type="button" onClick={onToggle}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 7, border: "none", cursor: "pointer", background: selected ? voile(color, 7) : "transparent", width: "100%", textAlign: "left" as const, transition: "background 0.12s" }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "var(--carte-douce)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = selected ? voile(color, 7) : "transparent"; }}>
      <div style={{ width: 13, height: 13, borderRadius: "50%", border: `2px solid ${selected ? color : "var(--gris)"}`, background: selected ? color : "transparent", flexShrink: 0, transition: "all 0.12s" }} />
      <span style={{ fontSize: 12, color: selected ? "var(--encre)" : "var(--texte)", fontWeight: selected ? 600 : 400 }}>{label}</span>
    </button>
  );
}

function ColSection({ title, color, children, open, onToggle, count }: { title: string; color: string; children: React.ReactNode; open: boolean; onToggle: () => void; count: number }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <button type="button" onClick={onToggle}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "8px 10px", background: count > 0 ? voile(color, 3) : "var(--carte-douce)", border: `1px solid ${count > 0 ? voile(color, 19) : "var(--bordure-forte)"}`, borderRadius: 9, cursor: "pointer", marginBottom: open ? 4 : 0, transition: "all 0.15s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: count > 0 ? color : "var(--gris)", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{title}</span>
          {count > 0 && <span style={{ fontSize: 10, fontWeight: 700, color, background: voile(color, 8), padding: "1px 6px", borderRadius: 999 }}>{count}</span>}
        </div>
        {open ? <ChevronUp size={12} style={{ color: "var(--gris)" }} /> : <ChevronDown size={12} style={{ color: "var(--gris)" }} />}
      </button>
      {open && (
        <div style={{ border: `1px solid ${voile(color, 13)}`, borderRadius: 9, overflow: "hidden", maxHeight: 220, overflowY: "auto" as const }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function GeoCascadeSelect({ filterRegionIds, regionId, departementId, arrondissementId, onChangeRegion, onChangeDepartement, onChangeArrondissement }: Props) {
  const [regions,         setRegions]         = useState<GeoItem[]>([]);
  const [departements,    setDepartements]    = useState<GeoItem[]>([]);
  const [arrondissements, setArrondissements] = useState<GeoItem[]>([]);
  const [openReg, setOpenReg] = useState(true);
  const [openDep, setOpenDep] = useState(false);
  const [openArr, setOpenArr] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/entreprises/ref/regions`).then(r => r.json()).then(setRegions).catch(() => {});
  }, []);

  useEffect(() => {
    if (!regionId) { setDepartements([]); return; }
    fetch(`${API_BASE}/entreprises/ref/departements?region_id=${regionId}`).then(r => r.json()).then(setDepartements).catch(() => {});
    setOpenDep(true);
  }, [regionId]);

  useEffect(() => {
    if (!departementId) { setArrondissements([]); return; }
    fetch(`${API_BASE}/entreprises/ref/arrondissements?departement_id=${departementId}`).then(r => r.json()).then(setArrondissements).catch(() => {});
    setOpenArr(true);
  }, [departementId]);

  const regionsAffichees = filterRegionIds && filterRegionIds.length > 0
    ? regions.filter(r => filterRegionIds.includes(r.id))
    : regions;
  const regNom = regions.find(r => r.id === regionId)?.nom;
  const depNom = departements.find(d => d.id === departementId)?.nom;
  const arrNom = arrondissements.find(a => a.id === arrondissementId)?.nom;

  const chips = [
    regionId       && regNom ? { nom: regNom, color: "var(--bleu)", clear: () => onChangeRegion(null) } : null,
    departementId  && depNom ? { nom: depNom, color: "var(--orange)", clear: () => onChangeDepartement(null) } : null,
    arrondissementId && arrNom ? { nom: arrNom, color: "var(--vert)", clear: () => onChangeArrondissement(null) } : null,
  ].filter(Boolean) as { nom: string; color: string; clear: () => void }[];

  return (
    <div>
      {/* Résumé des sélections */}
      {chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5, marginBottom: 10 }}>
          {chips.map(c => (
            <span key={c.color} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: voile(c.color, 6), color: c.color, border: `1px solid ${voile(c.color, 15)}`, borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
              {c.nom}
              <button type="button" onClick={c.clear} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                <X size={10} style={{ color: c.color }} />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => onChangeRegion(null)}
            style={{ fontSize: 10, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}>
            Tout effacer
          </button>
        </div>
      )}

      {/* Colonnes cascade */}
      <div style={{ display: "flex", gap: 8 }}>
        <ColSection title="Région" color="var(--bleu)" open={openReg} onToggle={() => setOpenReg(o => !o)} count={regionId ? 1 : 0}>
          {regionsAffichees.map(r => (
            <RadioItem key={r.id} label={r.nom} selected={regionId === r.id} color="var(--bleu)"
              onToggle={() => onChangeRegion(regionId === r.id ? null : r.id)} />
          ))}
        </ColSection>
        <ColSection title="Département" color="var(--orange)" open={openDep} onToggle={() => setOpenDep(o => !o)} count={departementId ? 1 : 0}>
          {!regionId
            ? <p style={{ fontSize: 11, color: "var(--gris)", padding: "10px 12px" }}>Choisir une région d&apos;abord</p>
            : (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--bleu)", padding: "6px 10px 3px", background: "rgb(var(--bleu-rgb) / 0.05)", borderBottom: "1px solid rgb(var(--bleu-rgb) / 0.1)" }}>{regNom}</div>
                {departements.map(d => (
                  <RadioItem key={d.id} label={d.nom} selected={departementId === d.id} color="var(--orange)"
                    onToggle={() => onChangeDepartement(departementId === d.id ? null : d.id)} />
                ))}
              </div>
            )}
        </ColSection>
        <ColSection title="Arrondissement" color="var(--vert)" open={openArr} onToggle={() => setOpenArr(o => !o)} count={arrondissementId ? 1 : 0}>
          {!departementId
            ? <p style={{ fontSize: 11, color: "var(--gris)", padding: "10px 12px" }}>Choisir un département d&apos;abord</p>
            : (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--orange)", padding: "6px 10px 3px", background: "rgb(var(--orange-rgb) / 0.05)", borderBottom: "1px solid rgb(var(--orange-rgb) / 0.1)" }}>{depNom}</div>
                {arrondissements.map(a => (
                  <RadioItem key={a.id} label={a.nom} selected={arrondissementId === a.id} color="var(--vert)"
                    onToggle={() => onChangeArrondissement(arrondissementId === a.id ? null : a.id)} />
                ))}
              </div>
            )}
        </ColSection>
      </div>
    </div>
  );
}
