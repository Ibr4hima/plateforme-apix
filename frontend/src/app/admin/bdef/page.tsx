"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { CheckCircle, Link2, Loader2, UploadCloud, X, FileSpreadsheet, ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react";
import { authHeaders } from "@/lib/authHeaders";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const SEC: any = { fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #E8E5E3" };
const IS: any  = { background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#1a1a2e", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" };

function fmtAdmin(v: number | null | undefined, unite: string): string {
  if (v == null) return "–";
  if (unite === "%")     return `${v.toFixed(2)} %`;
  if (unite === "ratio") return v.toFixed(4);
  if (unite === "jours") return `${v.toFixed(0)} j`;
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)} Md`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)} M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)} k`;
  return v.toFixed(0);
}

const NIVEAU_LABEL: Record<string, string> = {
  macro_secteur: "Macro-secteur", groupe: "Groupe", secteur: "Secteur", global: "Global",
};

type Secteur   = { id: number; code: string; libelle: string };
type Secteurs   = { macro_secteur: Secteur[]; groupe: Secteur[]; secteur: Secteur[] };
type Candidat   = { cible_id: number; libelle: string; score: number };
type RevueItem  = { niveau: string; code_bdef: string; libelle_brut: string; score: number | null; candidats: Candidat[] };
type Fidelite   = { total: number; identiques: number; taux: number; divergences: { indicateur: string; niveau: string; cible_id: number | null; annee: number; attendu: number; trouve: number | null }[] };
type ImportRes  = { import_id: number; statut: string; annees: number[]; nb_secteurs?: number; nb_valeurs?: number; nb_secteurs_ok?: number; fidelite?: Fidelite; revue: RevueItem[]; erreur?: string };
type ImportHist = { id: number; fichier: string; statut: string; annees: number[] | null; nb_valeurs: number; nb_revue: number; cree_le: string | null; termine_le: string | null };
type Indic      = { code: string; libelle: string; unite: string; categorie: string; valeurs: Record<string, number | null>; initiales?: Record<string, number | null> };
type Valeurs    = { niveau: string; cible_id: number | null; annees: number[]; indicateurs: Indic[] };
type Couv       = { code: string; libelle: string; annees_couvertes: number; nb_present: number; nb_attendu: number; taux: number };
type Anom       = { severite: string; categorie: string; indicateur: string; indicateur_libelle?: string; niveau: string; cible_id: number | null; libelle_cible: string; annee: number | null; message: string; valeur: number | null; attendu: number | null; rejetee_id: number | null };
type Rapport    = { score: number; nb_secteurs: number; nb_valeurs: number; annees: number[]; nb_erreurs: number; nb_avertissements: number; couverture: Couv[]; anomalies: Anom[] };

// ── Dropdown de secteur recherchable ──────────────────────────────────────────
function SecteurPicker({ options, value, onSelect }: { options: Secteur[]; value: number | null; onSelect: (id: number) => void }) {
  const [search, setSearch] = useState("");
  const [open, setOpen]     = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const chosen   = options.find(o => o.id === value);
  const filtered = options.filter(o => o.libelle.toLowerCase().includes(search.toLowerCase()) || o.code.includes(search)).slice(0, 40);
  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <input
        value={open ? search : (chosen ? `${chosen.code} — ${chosen.libelle}` : search)}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setSearch(""); setOpen(true); }}
        placeholder="Rechercher un secteur…"
        style={{ ...IS, borderColor: chosen ? "#004f91" : undefined }}
      />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", zIndex: 200, top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #C5BFBB", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.1)", maxHeight: 240, overflowY: "auto", marginTop: 2 }}>
          {filtered.map(o => (
            <div key={o.id} onClick={() => { onSelect(o.id); setOpen(false); }}
              style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", background: o.id === value ? "#EEF4FB" : "" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F0F4FF")}
              onMouseLeave={e => (e.currentTarget.style.background = o.id === value ? "#EEF4FB" : "")}>
              <span style={{ color: "#888", marginRight: 6 }}>{o.code}</span>{o.libelle}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Badge de score ────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const color = score >= 90 ? "#1a7a3c" : score >= 80 ? "#B7661B" : "#c0392b";
  const bg    = score >= 90 ? "#EDFBF1" : score >= 80 ? "#FFF9F0" : "#FFF2F2";
  return <span style={{ background: bg, color, border: `1px solid ${color}33`, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{score.toFixed(0)} %</span>;
}

// ── Jauge de score de qualité ─────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const color = score >= 95 ? "#1a7a3c" : score >= 80 ? "#B7661B" : "#c0392b";
  const bg    = score >= 95 ? "#EDFBF1" : score >= 80 ? "#FFF9F0" : "#FFF2F2";
  return (
    <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 12, background: bg, border: `1px solid ${color}33`, borderRadius: 10, padding: "12px 18px" }}>
      <ShieldCheck size={26} color={color} />
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{score.toFixed(1)} %</div>
        <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Valeurs sans erreur</div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ flex: "0 0 auto", border: "1px solid #E8E5E3", borderRadius: 10, padding: "12px 18px", minWidth: 110 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "#1a1a2e", lineHeight: 1 }}>{value.toLocaleString("fr-FR")}</div>
      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{label}</div>
    </div>
  );
}

const SEV_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  erreur:        { color: "#c0392b", bg: "#FFF2F2", label: "Erreur" },
  avertissement: { color: "#B7661B", bg: "#FFF9F0", label: "Avertissement" },
  info:          { color: "#666",    bg: "#F2F0EF", label: "Info" },
};
const CAT_LABEL: Record<string, string> = {
  recalcul: "Recalcul", borne: "Borne", outlier: "Valeur atypique", coherence: "Cohérence",
};

export default function AdminBdefPage() {
  const [file, setFile]         = useState<File | null>(null);
  const [drag, setDrag]         = useState(false);
  const [importing, setImporting] = useState(false);
  const [res, setRes]           = useState<ImportRes | null>(null);
  const [secteurs, setSecteurs] = useState<Secteurs | null>(null);
  const [choix, setChoix]       = useState<Record<string, number>>({});  // "niveau|libelle_brut" → cible_id
  const [associating, setAssociating] = useState(false);
  const [imports, setImports]   = useState<ImportHist[]>([]);
  const [viding, setViding]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Consultation
  const [vNiveau, setVNiveau]   = useState("global");
  const [vCible, setVCible]     = useState<number | null>(null);
  const [valeurs, setValeurs]   = useState<Valeurs | null>(null);
  const [loadingV, setLoadingV] = useState(false);
  // Édition directe d'une valeur en base
  const [editCell, setEditCell] = useState<{ ind: Indic; annee: number } | null>(null);
  const [editVal, setEditVal]   = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Vérification
  const [rapport, setRapport]   = useState<Rapport | null>(null);
  const [loadingR, setLoadingR] = useState(false);

  // Corrections en attente (valeurs en erreur de borne)
  const [corrections, setCorrections]   = useState<Record<string, string>>({});   // clé anomalie → valeur saisie
  const [correcting, setCorrecting]     = useState<Record<string, boolean>>({});

  async function viderDonnees() {
    if (!window.confirm("Supprimer TOUTES les données BDEF (valeurs, imports, corrections) ?\n\nCette action est irréversible.")) return;
    if (!window.confirm("Confirmez une seconde fois : vider définitivement toutes les données BDEF ?")) return;
    setViding(true);
    try {
      const r = await fetch(`${API}/bdef/vider`, { method: "DELETE", headers: authHeaders() });
      if (r.ok) {
        setRes(null); setRapport(null); setCorrections({}); setValeurs(null);
        await loadRefs();
        await loadVerification();
      } else {
        const d = await r.json();
        alert(d.detail || "Erreur lors de la suppression.");
      }
    } catch (e: any) { alert("Erreur réseau : " + e.message); }
    setViding(false);
  }

  async function loadRefs() {
    const [s, h] = await Promise.all([
      fetch(`${API}/bdef/secteurs`).then(r => r.json()),
      fetch(`${API}/bdef/imports`).then(r => r.json()),
    ]);
    setSecteurs(s);
    setImports(Array.isArray(h) ? h : []);
  }
  useEffect(() => { loadRefs(); loadVerification(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  function pickFile(f: FileList | null) {
    if (f && f[0]) setFile(f[0]);
  }

  async function handleImport(theFile?: File) {
    const f = theFile || file;
    if (!f) return;
    setImporting(true); setRes(null);
    try {
      const fd = new FormData();
      fd.append("fichier", f);
      const r = await fetch(`${API}/bdef/importer`, { method: "POST", headers: authHeaders(), body: fd });
      const data = await r.json();
      if (!r.ok) { setRes({ import_id: 0, statut: "erreur", annees: [], revue: [], erreur: data.detail || "Erreur inconnue" }); }
      else {
        setRes(data);
        // pré-remplir les choix avec le meilleur candidat
        const init: Record<string, number> = {};
        (data.revue || []).forEach((ri: RevueItem) => {
          if (ri.candidats?.[0]) init[`${ri.niveau}|${ri.libelle_brut}`] = ri.candidats[0].cible_id;
        });
        setChoix(init);
      }
      await loadRefs();
      if (r.ok && data.statut === "termine") { loadVerification(); setCorrections({}); }
    } catch (e: any) {
      setRes({ import_id: 0, statut: "erreur", annees: [], revue: [], erreur: "Erreur réseau : " + e.message });
    }
    setImporting(false);
  }

  async function loadVerification() {
    setLoadingR(true);
    try {
      const data = await fetch(`${API}/bdef/verification`).then(r => r.json());
      setRapport(data && !data.detail ? data : null);
    } catch { setRapport(null); }
    setLoadingR(false);
  }

  async function handleAssocierEtReimporter() {
    if (!res?.revue?.length || !file) return;
    setAssociating(true);
    for (const ri of res.revue) {
      const cible = choix[`${ri.niveau}|${ri.libelle_brut}`];
      if (!cible) continue;
      await fetch(`${API}/bdef/associer`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ niveau: ri.niveau, libelle_brut: ri.libelle_brut, cible_id: cible }),
      });
    }
    setAssociating(false);
    await handleImport();          // réimport : les alias résolvent les secteurs
  }

  function anomKey(a: Anom) {
    return a.rejetee_id != null ? `r${a.rejetee_id}` : `${a.indicateur}|${a.niveau}|${a.cible_id ?? ""}|${a.annee ?? ""}`;
  }

  async function corrigerValeur(a: Anom) {
    const key = anomKey(a);
    const val = corrections[key];
    if (val === undefined || val === "") return;
    setCorrecting(p => ({ ...p, [key]: true }));
    try {
      const body = a.rejetee_id != null
        ? { rejetee_id: a.rejetee_id, valeur_corrigee: parseFloat(val) }
        : { indicateur: a.indicateur, niveau: a.niveau, cible_id: a.cible_id, annee: a.annee, valeur_corrigee: parseFloat(val) };
      const r = await fetch(`${API}/bdef/corriger`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setCorrections(p => { const n = { ...p }; delete n[key]; return n; });
        loadVerification();
      } else {
        const data = await r.json();
        alert(data.detail || "Erreur lors de la correction.");
      }
    } catch (e: any) { alert("Erreur réseau : " + e.message); }
    setCorrecting(p => ({ ...p, [key]: false }));
  }

  async function loadValeurs(niveau: string, cible: number | null) {
    setLoadingV(true); setValeurs(null);
    const qs = niveau === "global" ? `niveau=global` : `niveau=${niveau}&cible_id=${cible}`;
    try {
      const data = await fetch(`${API}/bdef/valeurs?${qs}`).then(r => r.json());
      setValeurs(data);
    } catch { setValeurs(null); }
    setLoadingV(false);
  }
  useEffect(() => {
    if (vNiveau === "global") loadValeurs("global", null);
    else if (vCible != null)  loadValeurs(vNiveau, vCible);
    else setValeurs(null);
  }, [vNiveau, vCible]);

  function ouvrirEdition(ind: Indic, annee: number) {
    const v = ind.valeurs[annee];
    const isRatio = ind.unite === "ratio" || ind.unite === "%";
    setEditVal(v == null ? "" : isRatio ? String(v) : Math.round(v).toLocaleString("fr-FR"));
    setEditCell({ ind, annee });
  }

  async function enregistrerEdition(opts?: { reset?: boolean }) {
    if (!editCell) return;
    const { ind, annee } = editCell;
    const reset = opts?.reset === true;
    const parsedVal = parseFloat(editVal.replace(/\s/g, "").replace(",", "."));
    if (!reset && (editVal === "" || isNaN(parsedVal))) return;
    setSavingEdit(true);
    try {
      const body: any = {
        indicateur: ind.code, niveau: vNiveau,
        cible_id: vNiveau === "global" ? null : vCible, annee,
      };
      if (reset) body.reset = true; else body.valeur = parsedVal;
      const r = await fetch(`${API}/bdef/modifier`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (r.ok) {
        // mise à jour locale immédiate
        setValeurs(prev => {
          if (!prev) return prev;
          const inds = prev.indicateurs.map(i => i.code === ind.code
            ? { ...i, valeurs: { ...i.valeurs, [annee]: d.valeur }, initiales: { ...(i.initiales || {}), [annee]: d.valeur_initiale } }
            : i);
          return { ...prev, indicateurs: inds };
        });
        setEditCell(null);
        loadVerification();
      } else {
        alert(d.detail || "Erreur lors de la modification.");
      }
    } catch (e: any) { alert("Erreur réseau : " + e.message); }
    setSavingEdit(false);
  }

  const tousAssocies = res?.revue?.every(ri => choix[`${ri.niveau}|${ri.libelle_brut}`]) ?? false;
  const optionsConsult = secteurs && vNiveau !== "global" ? (secteurs as any)[vNiveau] as Secteur[] : [];

  // regrouper les indicateurs par catégorie pour l'affichage
  const parCategorie: Record<string, Indic[]> = {};
  (valeurs?.indicateurs || []).forEach(i => { (parCategorie[i.categorie] ||= []).push(i); });

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1180, margin: "0 auto", fontFamily: "var(--font-google-sans)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>Données BDEF</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 32 }}>
        Importez les fichiers Excel de la Base de Données Économiques et Financières (ANSD). Les secteurs sont reconnus automatiquement ;
        les cas incertains sont soumis à validation avant tout enregistrement.
      </p>

      {/* ── Import ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E5E3", padding: "24px 28px", marginBottom: 20 }}>
        <div style={SEC}>Importer un fichier BDEF</div>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files); }}
          style={{ border: `2px dashed ${drag || file ? "#004f91" : "#C5BFBB"}`, borderRadius: 10, padding: "24px", textAlign: "center", cursor: "pointer", background: drag ? "#E8F0FB" : file ? "#EEF4FB" : "#F9F8F7", transition: "all .15s" }}>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => pickFile(e.target.files)} />
          {file ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <FileSpreadsheet size={18} color="#004f91" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#004f91" }}>{file.name}</span>
              <span style={{ fontSize: 12, color: "#888" }}>({(file.size / 1024).toFixed(0)} Ko)</span>
              <button onClick={e => { e.stopPropagation(); setFile(null); setRes(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}><X size={14} /></button>
            </div>
          ) : (
            <>
              <UploadCloud size={22} color="#AAA" style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "#666" }}>Déposez le classeur .xlsx ou cliquez pour parcourir</div>
              <div style={{ fontSize: 11, color: "#AAA", marginTop: 2 }}>Feuilles attendues : EDITIONS COMPTES, EDITIONS RATIOS</div>
            </>
          )}
        </div>

        {res && res.statut === "termine" && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "#EDFBF1", border: "1px solid #B2EAC5", fontSize: 13, color: "#1a7a3c" }}>
            ✓ Import terminé — <strong>{res.nb_secteurs}</strong> secteurs, <strong>{res.nb_valeurs}</strong> valeurs écrites (années {res.annees?.[0]}–{res.annees?.[res.annees.length - 1]}).
            {res.fidelite && (
              res.fidelite.divergences.length === 0 ? (
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                  <ShieldCheck size={15} /> Fidélité confirmée : {res.fidelite.identiques}/{res.fidelite.total} valeurs relues identiques à la source.
                </div>
              ) : (
                <div style={{ marginTop: 6, color: "#c0392b", fontWeight: 600 }}>
                  ⚠ {res.fidelite.divergences.length} valeur(s) divergente(s) entre le fichier et la base — à examiner.
                </div>
              )
            )}
          </div>
        )}
        {res && res.statut === "erreur" && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "#FFF2F2", border: "1px solid #F5C6CB", fontSize: 13, color: "#c0392b" }}>⚠ {res.erreur}</div>
        )}

        <button onClick={() => handleImport()} disabled={importing || !file}
          style={{ marginTop: 16, background: importing || !file ? "#ccc" : "#004f91", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: importing || !file ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
          {importing ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
          {importing ? "Import en cours…" : "Importer"}
        </button>
      </div>

      {/* ── Revue (secteurs à valider) ── */}
      {res && res.statut === "en_revue" && res.revue.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, border: "2px solid #F5A623", padding: "24px 28px", marginBottom: 20 }}>
          <div style={{ ...SEC, color: "#B7661B", borderBottomColor: "#FAD7A0" }}>
            {res.revue.length} secteur(s) à valider — import bloqué
          </div>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
            Aucune valeur n'a été enregistrée. Confirmez la correspondance de chaque secteur douteux (le meilleur candidat est pré-sélectionné),
            puis relancez : la reconnaissance sera mémorisée pour les prochains imports.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {res.revue.map(ri => {
              const opts = (secteurs as any)?.[ri.niveau] as Secteur[] || [];
              const key  = `${ri.niveau}|${ri.libelle_brut}`;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#FFF9F0", borderRadius: 8, border: "1px solid #FAD7A0" }}>
                  <div style={{ flex: "0 0 300px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#B7661B" }}>{ri.libelle_brut}</span>
                      <ScoreBadge score={ri.score} />
                    </div>
                    <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{NIVEAU_LABEL[ri.niveau]} · code BDEF {ri.code_bdef}</div>
                  </div>
                  <SecteurPicker options={opts} value={choix[key] ?? null} onSelect={id => setChoix(p => ({ ...p, [key]: id }))} />
                  {choix[key] && <CheckCircle size={18} color="#27ae60" style={{ flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={handleAssocierEtReimporter} disabled={associating || !tousAssocies || !file}
              style={{ background: associating || !tousAssocies || !file ? "#ccc" : "#B7661B", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: associating || !tousAssocies ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
              {associating ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
              {associating ? "Validation en cours…" : "Valider et réimporter"}
            </button>
            {!file && <span style={{ fontSize: 12, color: "#c0392b" }}>Resélectionnez le fichier pour réimporter.</span>}
          </div>
        </div>
      )}

      {/* ── Rapport de vérification ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E5E3", padding: "24px 28px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={SEC}>Rapport de vérification</div>
          <button onClick={loadVerification} disabled={loadingR}
            style={{ background: "none", border: "1px solid #C5BFBB", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#555", cursor: loadingR ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={13} className={loadingR ? "animate-spin" : ""} /> Actualiser
          </button>
        </div>

        {loadingR ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 30 }}><Loader2 size={22} color="#004f91" className="animate-spin" /></div>
        ) : !rapport || rapport.nb_valeurs === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: "#888", fontSize: 13 }}>Aucune donnée à vérifier — importez d'abord un fichier.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
              <ScoreGauge score={rapport.score} />
              <Stat label="Erreurs" value={rapport.nb_erreurs} color={rapport.nb_erreurs ? "#c0392b" : "#1a7a3c"} />
            </div>

            {/* Erreurs uniquement (avertissements filtrés) */}
            {(() => {
              const erreurs = rapport.anomalies.filter(a => a.severite === "erreur");
              return erreurs.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: "#EDFBF1", border: "1px solid #B2EAC5", fontSize: 13, color: "#1a7a3c" }}>
                  <CheckCircle size={16} /> Aucune erreur détectée — toutes les valeurs passent les contrôles.
                </div>
              ) : (
                <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid #F0EEEC", borderRadius: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #E8E5E3", background: "#FAF9F8" }}>
                        {["", "Type", "Indicateur", "Secteur", "Année", "Détail", "Valeur source", "Corriger"].map((h, i) => (
                          <th key={i} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#4a5568", position: "sticky", top: 0, background: "#FAF9F8", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {erreurs.map((a, i) => {
                        const s = SEV_STYLE.erreur;
                        const key = anomKey(a);
                        const corrVal = corrections[key] ?? "";
                        const isCorrecting = correcting[key] ?? false;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #F4F2F0" }}>
                            <td style={{ padding: "7px 10px", verticalAlign: "top" }}>
                              <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 99, background: s.color }} />
                            </td>
                            <td style={{ padding: "7px 10px", verticalAlign: "top" }}>
                              <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{CAT_LABEL[a.categorie] || a.categorie}</span>
                            </td>
                            <td style={{ padding: "7px 10px", color: "#1a1a2e", fontWeight: 500, verticalAlign: "top" }}>{a.indicateur_libelle || a.indicateur}</td>
                            <td style={{ padding: "7px 10px", color: "#555", verticalAlign: "top" }}>{a.libelle_cible}</td>
                            <td style={{ padding: "7px 10px", color: "#888", fontVariantNumeric: "tabular-nums", verticalAlign: "top" }}>{a.annee ?? "–"}</td>
                            <td style={{ padding: "7px 10px", color: "#555", verticalAlign: "top" }}>{a.message}</td>
                            <td style={{ padding: "7px 10px", color: "#c0392b", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", verticalAlign: "top" }}>
                              {a.valeur != null ? a.valeur.toLocaleString("fr-FR") : "–"}
                            </td>
                            <td style={{ padding: "5px 10px", whiteSpace: "nowrap", verticalAlign: "top" }}>
                              {a.annee != null ? (
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <input
                                    type="number"
                                    value={corrVal}
                                    onChange={e => setCorrections(p => ({ ...p, [key]: e.target.value }))}
                                    placeholder="Valeur corrigée"
                                    style={{ width: 120, padding: "4px 8px", fontSize: 12, border: "1px solid #C5BFBB", borderRadius: 6, outline: "none" }}
                                  />
                                  <button
                                    onClick={() => corrigerValeur(a)}
                                    disabled={isCorrecting || corrVal === ""}
                                    style={{ background: isCorrecting || corrVal === "" ? "#ccc" : "#1a7a3c", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: isCorrecting || corrVal === "" ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    {isCorrecting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                    Valider
                                  </button>
                                </div>
                              ) : <span style={{ color: "#aaa", fontSize: 12 }}>–</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Couverture incomplète */}
            {rapport.couverture.some(c => c.taux < 1) && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#B7661B", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={13} /> Indicateurs à couverture incomplète
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {rapport.couverture.filter(c => c.taux < 1).map(c => (
                    <span key={c.code} title={`${c.nb_present}/${c.nb_attendu} valeurs`}
                      style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, border: `1px solid ${c.taux === 0 ? "#c0392b" : "#FAD7A0"}`, background: c.taux === 0 ? "#FFF2F2" : "#FFF9F0", color: c.taux === 0 ? "#c0392b" : "#B7661B" }}>
                      {c.libelle} · {(c.taux * 100).toFixed(0)} %
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Consultation des données ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E5E3", padding: "24px 28px", marginBottom: 20 }}>
        <div style={SEC}>Consulter les données</div>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <select value={vNiveau} onChange={e => { setVNiveau(e.target.value); setVCible(null); }} style={{ ...IS, flex: "0 0 200px" }}>
            <option value="global">Global des secteurs</option>
            <option value="macro_secteur">Macro-secteur</option>
            <option value="groupe">Groupe</option>
            <option value="secteur">Secteur</option>
          </select>
          {vNiveau !== "global" && (
            <SecteurPicker options={optionsConsult} value={vCible} onSelect={setVCible} />
          )}
        </div>

        {loadingV ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 30 }}><Loader2 size={22} color="#004f91" className="animate-spin" /></div>
        ) : !valeurs || valeurs.indicateurs.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#888", fontSize: 13 }}>
            {vNiveau !== "global" && vCible == null ? "Sélectionnez un secteur." : "Aucune donnée pour cette sélection."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E8E5E3" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#4a5568" }}>Indicateur</th>
                  <th style={{ padding: "8px 8px", textAlign: "left", fontWeight: 600, color: "#4a5568" }}>Unité</th>
                  {valeurs.annees.map(a => (
                    <th key={a} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "#4a5568" }}>{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(parCategorie).map(([cat, inds]) => (
                  <Fragment key={cat}>
                    <tr><td colSpan={valeurs.annees.length + 2} style={{ padding: "10px 12px 4px", fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.08em", textTransform: "uppercase" }}>{cat}</td></tr>
                    {inds.map(ind => (
                      <tr key={ind.code} style={{ borderBottom: "1px solid #F0EEEC" }}>
                        <td style={{ padding: "8px 12px", color: "#1a1a2e" }}>{ind.libelle}</td>
                        <td style={{ padding: "8px 8px", color: "#888", fontSize: 12 }}>{ind.unite}</td>
                        {valeurs.annees.map(a => {
                          const v = ind.valeurs[a];
                          const vi = ind.initiales?.[a];
                          const isRatio = ind.unite === "ratio" || ind.unite === "%";
                          const modifie = v != null && vi != null && Math.abs(v - vi) > 1e-9;
                          return (
                            <td key={a} onClick={() => ouvrirEdition(ind, a)}
                              title={modifie ? `Valeur initiale : ${fmtAdmin(vi, ind.unite)}` : "Cliquer pour modifier"}
                              style={{ padding: "8px 12px", textAlign: "right", color: v == null ? "#DDD" : modifie ? "#B7661B" : "#1a1a2e", fontVariantNumeric: "tabular-nums", cursor: "pointer", background: modifie ? "#FFF6E9" : undefined, fontWeight: modifie ? 700 : 400, position: "relative" }}
                              onMouseEnter={e => { if (!modifie) e.currentTarget.style.background = "#F5F8FD"; }}
                              onMouseLeave={e => { if (!modifie) e.currentTarget.style.background = ""; }}>
                              {fmtAdmin(v, ind.unite)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Historique des imports ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E5E3", padding: "24px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 0 }}>
          <div style={SEC}>Historique des imports</div>
          <button onClick={viderDonnees} disabled={viding || imports.length === 0}
            style={{ background: viding || imports.length === 0 ? "#F2F0EF" : "#FFF2F2", color: viding || imports.length === 0 ? "#aaa" : "#c0392b", border: `1px solid ${viding || imports.length === 0 ? "#E8E5E3" : "#F5C6CB"}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: viding || imports.length === 0 ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            {viding ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
            Vider toutes les données
          </button>
        </div>
        {imports.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: "#888", fontSize: 13 }}>Aucun import pour le moment.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E8E5E3" }}>
                {["Fichier", "Statut", "Années", "Valeurs", "En revue", "Date"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#4a5568" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {imports.map(im => {
                const c = im.statut === "termine" ? "#1a7a3c" : im.statut === "en_revue" ? "#B7661B" : "#888";
                const bg = im.statut === "termine" ? "#EDFBF1" : im.statut === "en_revue" ? "#FFF9F0" : "#F2F0EF";
                return (
                  <tr key={im.id} style={{ borderBottom: "1px solid #F0EEEC" }}>
                    <td style={{ padding: "8px 12px", color: "#1a1a2e" }}>{im.fichier}</td>
                    <td style={{ padding: "8px 12px" }}><span style={{ background: bg, color: c, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{im.statut}</span></td>
                    <td style={{ padding: "8px 12px", color: "#666" }}>{im.annees?.length ? `${im.annees[0]}–${im.annees[im.annees.length - 1]}` : "–"}</td>
                    <td style={{ padding: "8px 12px", color: "#666" }}>{im.nb_valeurs || "–"}</td>
                    <td style={{ padding: "8px 12px", color: "#666" }}>{im.nb_revue || "–"}</td>
                    <td style={{ padding: "8px 12px", color: "#888", fontSize: 12 }}>{im.cree_le ? new Date(im.cree_le).toLocaleString("fr-FR") : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Éditeur de valeur ── */}
      {editCell && (() => {
        const { ind, annee } = editCell;
        const v = ind.valeurs[annee];
        const vi = ind.initiales?.[annee];
        const fmt = (x: number | null | undefined) => fmtAdmin(x, ind.unite);
        const modifie = v != null && vi != null && Math.abs(v - vi) > 1e-9;
        return (
          <div onClick={() => !savingEdit && setEditCell(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.25)", overflow: "hidden" }}>
              <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #F0EEEC" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>{ind.libelle}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Année {annee} · {ind.unite}</div>
                  </div>
                  <button onClick={() => setEditCell(null)} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 7px", display: "flex" }}><X size={14} color="#4a5568" /></button>
                </div>
              </div>
              <div style={{ padding: "18px 22px 22px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.06em" }}>Valeur actuelle</label>
                  <div style={{ fontSize: 15, fontWeight: 700, color: modifie ? "#B7661B" : "#1a1a2e", background: "#F8F7F6", borderRadius: 8, padding: "9px 12px", fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#004f91", textTransform: "uppercase", letterSpacing: "0.06em" }}>Nouvelle valeur</label>
                  <input type="text" value={editVal} autoFocus
                    onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") enregistrerEdition(); }}
                    style={{ ...IS, borderColor: "#004f91" }} />
                </div>
                {modifie && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#FFF6E9", border: "1px solid #F2D9B0", borderRadius: 8, padding: "9px 12px", marginBottom: 16 }}>
                    <span style={{ fontSize: 12, color: "#8a5a1a" }}>Valeur initiale (import) : <strong>{fmt(vi)}</strong></span>
                    <button onClick={() => enregistrerEdition({ reset: true })} disabled={savingEdit}
                      style={{ background: "#fff", color: "#B7661B", border: "1px solid #E2B873", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: savingEdit ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                      <RefreshCw size={12} /> Réinitialiser
                    </button>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setEditCell(null)} disabled={savingEdit}
                    style={{ background: "#F2F0EF", color: "#4a5568", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                  <button onClick={() => enregistrerEdition()} disabled={savingEdit || editVal === "" || isNaN(parseFloat(editVal.replace(/\s/g, "").replace(",", ".")))}
                    style={{ background: savingEdit || editVal === "" || isNaN(parseFloat(editVal.replace(/\s/g, "").replace(",", "."))) ? "#9bb8d6" : "#004f91", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: savingEdit ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {savingEdit && <Loader2 size={13} className="animate-spin" />} Valider
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
