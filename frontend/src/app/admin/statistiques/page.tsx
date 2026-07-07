"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle, ChevronDown, Link2, Loader2, Search, Trash2, UploadCloud, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const SEC: any = { fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #E8E5E3" };
const IS: any  = { background: "#F8F7F6", border: "1px solid #E8E5E3", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" };
const TH: any  = { padding: "10px 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const };
const TD: any  = { padding: "9px 14px", verticalAlign: "middle" as const };
const PGBTN: any = { background: "#F8F7F6", border: "1px solid #E8E5E3", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, color: "#2d3540", fontFamily: "var(--font-google-sans)" };

type Indicateur = { code: string; libelle: string; unite: string; derive: boolean };
type RefPays    = { id: number; nom_fr: string; code_iso3: string | null };
type Couverture = { pays_id: number; pays: string; code_iso3: string | null; series: Record<string, { min: number; max: number; nb: number }> };
type ImportRes  = { pays: { pays: string; pays_id: number; insere: number; mis_a_jour: number }[]; erreurs: string[]; non_resolus: { label: string; nb_lignes: number }[] };

function AssociatePicker({ paysList, onSelect }: { paysList: RefPays[]; onSelect: (id: number, nom: string) => void }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const filtered = paysList.filter(p => p.nom_fr.toLowerCase().includes(search.toLowerCase())).slice(0, 30);
  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <input value={chosen || search} onChange={e => { setSearch(e.target.value); setChosen(""); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="Rechercher un pays du référentiel…" style={{ ...IS, borderColor: chosen ? "#004f91" : undefined }} />
      {open && filtered.length > 0 && !chosen && (
        <div style={{ position: "absolute", zIndex: 200, top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E4E1DE", borderRadius: 8, boxShadow: "0 12px 32px rgba(0,30,60,0.14)", maxHeight: 220, overflowY: "auto", marginTop: 2 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => { setChosen(p.nom_fr); setSearch(""); setOpen(false); onSelect(p.id, p.nom_fr); }}
              style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F8F7F6")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              {p.nom_fr}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FileZone({ files, onChange, hint }: { files: File[]; onChange: (f: File[]) => void; hint: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const addFiles = (nf: FileList | null) => { if (nf) onChange([...files, ...Array.from(nf).filter(f => !files.some(e => e.name === f.name))]); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        style={{ border: `2px dashed ${drag || files.length ? "#004f91" : "#C5BFBB"}`, borderRadius: 12, padding: "26px 16px", textAlign: "center", cursor: "pointer", background: drag ? "#EEF4FB" : files.length ? "#F5F9FE" : "#FAFAF9", transition: "all .15s" }}>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" multiple style={{ display: "none" }} onChange={e => addFiles(e.target.files)} />
        <UploadCloud size={22} color={files.length ? "#004f91" : "#9aa5b4"} style={{ marginBottom: 6 }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: files.length ? "#004f91" : "#4a5568" }}>Déposez le ou les fichiers Excel / CSV</div>
        <div style={{ fontSize: 11.5, color: "#9aa5b4", marginTop: 2 }}>{hint}</div>
      </div>
      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {files.map((f, i) => (
            <div key={f.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F5F9FE", borderRadius: 8, padding: "6px 11px", fontSize: 12.5 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <CheckCircle size={13} color="#004f91" />
                <span style={{ color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                <span style={{ color: "#9aa5b4", flexShrink: 0 }}>({(f.size / 1024).toFixed(0)} Ko)</span>
              </span>
              <button onClick={() => onChange(files.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9aa5b4", padding: 0 }}><X size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminStatistiquesPage() {
  const { data: session } = useSession();
  const [indicateurs, setIndicateurs] = useState<Indicateur[]>([]);
  const [indicateur, setIndicateur] = useState("");
  const [paysList, setPaysList] = useState<RefPays[]>([]);
  const [couverture, setCouverture] = useState<Couverture[]>([]);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [res, setRes] = useState<ImportRes | null>(null);
  const [assoc, setAssoc] = useState<Record<string, { id: number; nom: string }>>({});
  const [associating, setAssociating] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [viding, setViding] = useState(false);
  const [tab, setTab] = useState<"indicateurs"|"transactions">("indicateurs");

  const headers = () => {
    const h: Record<string, string> = {};
    if (session?.accessToken) h["Authorization"] = `Bearer ${session.accessToken}`;
    return h;
  };

  const importables = indicateurs.filter(i => !i.derive);

  const load = async () => {
    setLoading(true);
    try {
      const [inds, pref, cov] = await Promise.all([
        fetch(`${API}/statistiques/indicateurs`).then(r => r.json()),
        fetch(`${API}/statistiques/pays-ref`).then(r => r.json()),
        fetch(`${API}/statistiques/admin/couverture`, { headers: headers() }).then(r => r.ok ? r.json() : []),
      ]);
      setIndicateurs(inds || []); setPaysList(pref || []); setCouverture(cov || []);
      if (!indicateur && inds?.length) setIndicateur(inds.find((i: Indicateur) => !i.derive)?.code || "");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [session?.accessToken]);

  const indActuel = indicateurs.find(i => i.code === indicateur);

  async function handleImport() {
    if (!files.length || !indicateur) return;
    setImporting(true); setRes(null); setAssoc({});
    try {
      const fd = new FormData();
      fd.append("indicateur", indicateur);
      files.forEach(f => fd.append("fichiers", f));
      const r = await fetch(`${API}/statistiques/importer`, { method: "POST", headers: headers(), body: fd });
      const data = await r.json();
      if (r.ok) {
        setRes(data);
        if (!data.non_resolus?.length) setFiles([]);
        await load();
      } else setRes({ pays: [], erreurs: [data.detail || "Erreur inconnue"], non_resolus: [] });
    } catch (e: any) { setRes({ pays: [], erreurs: ["Erreur réseau : " + e.message], non_resolus: [] }); }
    setImporting(false);
  }

  async function handleAssocier() {
    const toDo = Object.entries(assoc).filter(([, v]) => v.id);
    if (!toDo.length) return;
    setAssociating(true);
    for (const [label, { id }] of toDo) {
      await fetch(`${API}/statistiques/associer-pays`, { method: "POST", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify({ label, ref_pays_id: id }) });
    }
    setAssociating(false);
    await handleImport();
  }

  async function handleVider() {
    if (!indicateur) return;
    if (!confirm(`Vider TOUTES les données de « ${indActuel?.libelle} » pour tous les pays ?\n\nCette action est irréversible.`)) return;
    setViding(true);
    try { const r = await fetch(`${API}/statistiques/indicateur/${indicateur}`, { method: "DELETE", headers: headers() }); if (r.ok) await load(); } catch {}
    setViding(false);
  }

  async function handleDelete(pid: number, pays: string) {
    if (!confirm(`Supprimer toutes les données statistiques de ${pays} ?`)) return;
    setDeleting(pid);
    try { const r = await fetch(`${API}/statistiques/pays/${pid}`, { method: "DELETE", headers: headers() }); if (r.ok) await load(); } catch {}
    setDeleting(null);
  }

  return (
    <div style={{ padding: "36px 40px 80px", maxWidth: 1100, fontFamily: "var(--font-google-sans)" }}>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontWeight: 800, fontSize: "1.75rem", color: "#1a1a2e" }}>Données Statistiques</h1>
        <p style={{ color: "#9aa5b4", fontSize: 13, marginTop: 4 }}>
          Importez les données de la page Statistiques : indicateurs macro par pays, ou données transactionnelles bilatérales par ressource.
        </p>
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", borderBottom: "1px solid #E8E5E3", marginBottom: 24, marginTop: 12 }}>
        {([["indicateurs","Indicateurs par pays"],["transactions","Données transactionnelles"]] as const).map(([k,l]) => {
          const actif = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding: "12px 20px", border: "none", borderBottom: `2px solid ${actif?"#004f91":"transparent"}`, background: "transparent", color: actif?"#004f91":"#9aa5b4", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "var(--font-google-sans)" }}>
              {l}
            </button>
          );
        })}
      </div>

      {tab === "transactions" ? <TransactionsPanel headers={headers} paysList={paysList} /> : (<>

      {/* ── Import ── */}
      <div className="ro-w" style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "24px 28px", marginTop: 20, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        <div style={SEC}>Importer des données</div>

        {/* Sélecteur d'indicateur */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 260px" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.08em" }}>Indicateur à importer</label>
            <div style={{ position: "relative" }}>
              <select value={indicateur} onChange={e => { setIndicateur(e.target.value); setRes(null); }} style={{ ...IS, appearance: "none", cursor: "pointer", paddingRight: 34, fontWeight: 600 }}>
                {importables.map(i => <option key={i.code} value={i.code}>{i.libelle} ({i.unite})</option>)}
              </select>
              <ChevronDown size={15} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4", pointerEvents: "none" }} />
            </div>
          </div>
          {indActuel && (
            <div style={{ fontSize: 12, color: "#9aa5b4", paddingBottom: 10 }}>
              Unité attendue : <strong style={{ color: "#004f91" }}>{indActuel.code === "population" ? "milliers d'habitants" : ["pib","importations_marchandises","exportations_marchandises","importations_services","exportations_services"].includes(indActuel.code) ? "millions de $ US" : indActuel.unite}</strong>
            </div>
          )}
          <button onClick={handleVider} disabled={viding} title={`Vider toutes les données de « ${indActuel?.libelle} »`}
            style={{ marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", color: "#dc2626", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: viding ? "default" : "pointer", fontFamily: "var(--font-google-sans)" }}>
            {viding ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={14} />}
            Vider l&apos;indicateur
          </button>
        </div>

        <FileZone files={files} onChange={setFiles}
          hint={indicateur === "superficie"
            ? "Colonnes : ID · Pays · Superficie (sans année) · un fichier peut contenir plusieurs pays"
            : "Colonnes Pays, Année et Valeur (ordre libre, en-têtes détectés automatiquement) · un fichier peut contenir plusieurs pays"} />

        {res && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {res.pays.length > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(24,128,56,0.06)", border: "1px solid rgba(24,128,56,0.2)" }}>
                {res.pays.map(p => <div key={p.pays} style={{ fontSize: 13, color: "#188038" }}>✓ <strong>{p.pays}</strong> — {p.insere} insérées, {p.mis_a_jour} mises à jour</div>)}
              </div>
            )}
            {res.erreurs.length > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}>
                {res.erreurs.map((e, i) => <div key={i} style={{ fontSize: 13, color: "#dc2626" }}>⚠ {e}</div>)}
              </div>
            )}
          </div>
        )}

        <button onClick={handleImport} disabled={importing || !files.length}
          style={{ marginTop: 16, background: importing || !files.length ? "#C5BFBB" : "#004f91", color: "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 13, fontWeight: 700, cursor: importing || !files.length ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-google-sans)", boxShadow: importing || !files.length ? "none" : "0 3px 12px rgba(0,79,145,0.25)" }}>
          {importing ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <UploadCloud size={15} />}
          {importing ? "Import en cours…" : "Importer"}
        </button>
      </div>

      {/* ── Pays non reconnus ── */}
      {res?.non_resolus?.length ? (
        <div className="ro-w" style={{ background: "#fff", borderRadius: 14, border: "2px solid rgba(202,99,31,0.5)", padding: "24px 28px", marginBottom: 20 }}>
          <div style={{ ...SEC, color: "#ca631f", borderBottomColor: "rgba(202,99,31,0.25)" }}>{res.non_resolus.length} pays non reconnus — association manuelle</div>
          <p style={{ fontSize: 12, color: "#9aa5b4", marginBottom: 16 }}>Associez-les une fois — ils seront reconnus automatiquement lors des prochains imports.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {res.non_resolus.map(nr => (
              <div key={nr.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(202,99,31,0.04)", borderRadius: 10, border: "1px solid rgba(202,99,31,0.18)" }}>
                <div style={{ flex: "0 0 260px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#ca631f" }}>{nr.label}</div>
                  <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 2 }}>{nr.nb_lignes} lignes non importées</div>
                </div>
                <AssociatePicker paysList={paysList} onSelect={(id, nom) => setAssoc(p => ({ ...p, [nr.label]: { id, nom } }))} />
                {assoc[nr.label] && <CheckCircle size={18} color="#188038" style={{ flexShrink: 0 }} />}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={handleAssocier} disabled={associating || !Object.values(assoc).some(v => v.id)}
              style={{ background: associating || !Object.values(assoc).some(v => v.id) ? "#C5BFBB" : "#ca631f", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-google-sans)" }}>
              {associating ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Link2 size={15} />}
              {associating ? "Association…" : "Associer et réimporter"}
            </button>
            <span style={{ fontSize: 12, color: "#9aa5b4" }}>{Object.values(assoc).filter(v => v.id).length}/{res.non_resolus.length} associés</span>
          </div>
        </div>
      ) : null}

      {/* ── Couverture ── */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "24px 28px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #E8E5E3" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.12em", textTransform: "uppercase" }}>Données importées par pays</span>
          {!loading && <span style={{ background: "rgba(0,79,145,0.07)", color: "#004f91", borderRadius: 999, padding: "2px 11px", fontSize: 12, fontWeight: 700 }}>{couverture.length} pays</span>}
        </div>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={24} color="#004f91" style={{ animation: "spin 1s linear infinite" }} /></div>
        ) : couverture.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9aa5b4", fontSize: 13 }}>Aucune donnée importée pour l&apos;instant.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ECEAE7" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pays</th>
                  {importables.map(i => <th key={i.code} style={{ padding: "10px 12px", textAlign: "center", fontSize: 10, fontWeight: 800, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{i.libelle}</th>)}
                  <th style={{ padding: "10px 12px", width: 60 }} className="ro-w"></th>
                </tr>
              </thead>
              <tbody>
                {couverture.map(c => (
                  <tr key={c.pays_id} style={{ borderBottom: "1px solid #F5F4F3" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontWeight: 600, color: "#1a1a2e" }}>{c.pays}</span>
                    </td>
                    {importables.map(i => {
                      const s = c.series[i.code];
                      return (
                        <td key={i.code} style={{ padding: "10px 12px", textAlign: "center" }}>
                          {s ? <span style={{ background: "rgba(0,79,145,0.07)", padding: "3px 10px", borderRadius: 999, fontSize: 11.5, color: "#004f91", whiteSpace: "nowrap" }}>{i.code === "superficie" || s.max === 0 ? "✓" : `${s.min}–${s.max}`} <span style={{ color: "#9aa5b4" }}>({s.nb})</span></span> : <span style={{ color: "#DDD" }}>–</span>}
                        </td>
                      );
                    })}
                    <td style={{ padding: "10px 12px", textAlign: "center" }} className="ro-w">
                      <button onClick={() => handleDelete(c.pays_id, c.pays)} disabled={deleting === c.pays_id} title="Supprimer toutes ses données"
                        style={{ background: "rgba(220,38,38,0.07)", border: "none", cursor: "pointer", borderRadius: 999, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        {deleting === c.pays_id ? <Loader2 size={13} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} /> : <Trash2 size={13} style={{ color: "#dc2626" }} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>)}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// Panneau « Données transactionnelles » (resourcetrade.earth)
// ══════════════════════════════════════════════════════════════════════════════
function TransactionsPanel({ headers, paysList }: { headers: () => Record<string,string>; paysList: RefPays[] }) {
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [couv, setCouv] = useState<{ annee: number; nb_lignes: number }[]>([]);
  const [ressources, setRessources] = useState<{ nom_en: string; libelle: string }[]>([]);
  const [partenaires, setPartenaires] = useState<{ id: number; nom_fr: string; code_iso3: string | null }[]>([]);
  const [qPart, setQPart] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  // Tableau des données importées
  const [lignes, setLignes] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fAnnee, setFAnnee] = useState<string>("");
  const [fRessource, setFRessource] = useState<string>("");
  const [q, setQ] = useState("");
  const [qDebounce, setQDebounce] = useState("");
  const [loadingTable, setLoadingTable] = useState(false);
  const TAILLE = 50;

  const load = async () => {
    const [c, r, pa] = await Promise.all([
      fetch(`${API}/statistiques/transactions/couverture`, { headers: headers() }).then(x => x.ok ? x.json() : []),
      fetch(`${API}/statistiques/ressources`, { headers: headers() }).then(x => x.ok ? x.json() : []),
      fetch(`${API}/statistiques/partenaires`, { headers: headers() }).then(x => x.ok ? x.json() : []),
    ]);
    setCouv(c || []); setRessources(r || []); setPartenaires(pa || []);
  };
  useEffect(() => { load(); }, []);

  // Débounce de la recherche texte
  useEffect(() => { const t = setTimeout(() => { setQDebounce(q); setPage(1); }, 350); return () => clearTimeout(t); }, [q]);

  const loadTable = async () => {
    setLoadingTable(true);
    try {
      const p = new URLSearchParams({ page: String(page), taille: String(TAILLE) });
      if (fAnnee) p.set("annee", fAnnee);
      if (fRessource) p.set("ressource", fRessource);
      if (qDebounce.trim()) p.set("recherche", qDebounce.trim());
      const r = await fetch(`${API}/statistiques/transactions?${p.toString()}`, { headers: headers() });
      if (r.ok) { const d = await r.json(); setLignes(d.lignes || []); setTotal(d.total || 0); }
      else { setLignes([]); setTotal(0); }
    } catch { setLignes([]); setTotal(0); }
    setLoadingTable(false);
  };
  useEffect(() => { loadTable(); }, [page, fAnnee, fRessource, qDebounce, couv.length]);
  useEffect(() => { setPage(1); }, [fAnnee, fRessource]);

  const fmtVal = (v: number | null) => {
    if (v == null) return "—";
    if (v >= 1e9) return (v / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " Md$";
    if (v >= 1e6) return (v / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " M$";
    if (v >= 1e3) return (v / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " k$";
    return v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " $";
  };
  const nbPages = Math.max(1, Math.ceil(total / TAILLE));

  async function handleImport() {
    if (!files.length) return;
    setImporting(true); setRes(null);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append("fichiers", f));
      const r = await fetch(`${API}/statistiques/transactions/importer`, { method: "POST", headers: headers(), body: fd });
      const data = await r.json();
      if (r.ok) { setRes(data); setFiles([]); await load(); }
      else setRes({ non_resolus: [], erreur: data.detail || "Erreur" });
    } catch (e: any) { setRes({ non_resolus: [], erreur: "Erreur réseau : " + e.message }); }
    setImporting(false);
  }
  async function delAnnee(a: number) {
    if (!confirm(`Supprimer toutes les transactions de ${a} ?`)) return;
    setDeleting(a);
    try { const r = await fetch(`${API}/statistiques/transactions/${a}`, { method: "DELETE", headers: headers() }); if (r.ok) await load(); } catch {}
    setDeleting(null);
  }
  async function savePartenaire(id: number, nom_fr: string) {
    await fetch(`${API}/statistiques/partenaires/${id}`, { method: "PATCH", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify({ nom_fr }) });
  }
  async function saveRessource(nom_en: string, libelle: string) {
    await fetch(`${API}/statistiques/ressources/${encodeURIComponent(nom_en)}`, { method: "PATCH", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify({ libelle }) });
  }

  return (
    <>
      {/* Import */}
      <div className="ro-w" style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "24px 28px", marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        <div style={SEC}>Importer un fichier de transactions</div>
        <p style={{ fontSize: 12, color: "#9aa5b4", marginBottom: 14 }}>
          Fichier resourcetrade.earth (colonnes Exporter ISO3, Importer ISO3, Resource, Year, Value 1000USD). Les pays sont résolus par code ISO3, la valeur convertie en dollars, les ressources enregistrées pour édition. Réimporter une année remplace ses données.
        </p>
        <FileZone files={files} onChange={setFiles} hint="Fichier Excel (.xlsx) ou CSV · un fichier par année" />
        {res?.lignes !== undefined && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(24,128,56,0.06)", border: "1px solid rgba(24,128,56,0.2)", fontSize: 13, color: "#188038" }}>
            ✓ {res.lignes.toLocaleString("fr-FR")} lignes importées · années {(res.annees || []).join(", ")} · {res.ressources_vues} ressources{res.partenaires_crees?.length ? ` · ${res.partenaires_crees.length} partenaire(s) ajouté(s) automatiquement` : ""}
          </div>
        )}
        {res?.erreur && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", fontSize: 13, color: "#dc2626" }}>⚠ {res.erreur}</div>}
        <button onClick={handleImport} disabled={importing || !files.length}
          style={{ marginTop: 16, background: importing || !files.length ? "#C5BFBB" : "#004f91", color: "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 13, fontWeight: 700, cursor: importing || !files.length ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-google-sans)" }}>
          {importing ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <UploadCloud size={15} />}
          {importing ? "Import en cours (peut être long)…" : "Importer"}
        </button>
      </div>

      {/* Partenaires ajoutés automatiquement */}
      {res?.partenaires_crees?.length ? (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "22px 28px", marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ ...SEC, marginBottom: 10 }}>{res.partenaires_crees.length} partenaires ajoutés automatiquement</div>
          <p style={{ fontSize: 12, color: "#9aa5b4", marginBottom: 12 }}>Ces exportateurs/importateurs étaient absents du référentiel (territoires, agrégats…). Ils ont été créés pour ne perdre aucune donnée et n&apos;apparaissent pas dans la liste des pays macro.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {res.partenaires_crees.map((pc: any) => (
              <span key={pc.nom} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "#4a5568", background: "#F5F4F3", padding: "4px 11px", borderRadius: 999 }}>
                {pc.nom}{pc.code ? <span style={{ color: "#9aa5b4" }}>· {pc.code}</span> : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Années couvertes */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "22px 28px", marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        <div style={{ ...SEC, marginBottom: 12 }}>Années importées</div>
        {couv.length === 0 ? <div style={{ fontSize: 13, color: "#9aa5b4" }}>Aucune transaction importée.</div> : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {couv.map(cc => (
              <span key={cc.annee} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,79,145,0.06)", borderRadius: 999, padding: "5px 6px 5px 13px", fontSize: 12.5, fontWeight: 600, color: "#004f91" }}>
                {cc.annee} <span style={{ color: "#9aa5b4", fontWeight: 500 }}>· {cc.nb_lignes.toLocaleString("fr-FR")} lignes</span>
                <button onClick={() => delAnnee(cc.annee)} className="ro-w" title="Supprimer cette année"
                  style={{ background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer", borderRadius: 999, width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {deleting === cc.annee ? <Loader2 size={11} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} /> : <Trash2 size={11} style={{ color: "#dc2626" }} />}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tableau des données importées */}
      {couv.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "22px 28px", marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ ...SEC, marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>Données transactionnelles importées</div>
            <span style={{ fontSize: 12, color: "#9aa5b4", fontWeight: 600 }}>{total.toLocaleString("fr-FR")} ligne{total > 1 ? "s" : ""}</span>
          </div>

          {/* Filtres */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ position: "relative", flex: "1 1 260px", minWidth: 200 }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un pays ou une ressource…" style={{ ...IS, paddingLeft: 30 }} />
            </div>
            <select value={fAnnee} onChange={e => setFAnnee(e.target.value)} style={{ ...IS, flex: "0 0 auto", cursor: "pointer" }}>
              <option value="">Toutes les années</option>
              {couv.map(cc => <option key={cc.annee} value={cc.annee}>{cc.annee}</option>)}
            </select>
            <select value={fRessource} onChange={e => setFRessource(e.target.value)} style={{ ...IS, flex: "0 0 auto", cursor: "pointer", maxWidth: 260 }}>
              <option value="">Toutes les ressources</option>
              {ressources.map(rr => <option key={rr.nom_en} value={rr.nom_en}>{rr.libelle || rr.nom_en}</option>)}
            </select>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid #F0EEEC", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#FAF9F8", textAlign: "left", color: "#6b7684" }}>
                  <th style={TH}>Exportateur</th>
                  <th style={TH}>Importateur</th>
                  <th style={{ ...TH, width: 70 }}>Année</th>
                  <th style={TH}>Ressource</th>
                  <th style={{ ...TH, textAlign: "right" }}>Valeur</th>
                </tr>
              </thead>
              <tbody>
                {loadingTable ? (
                  <tr><td colSpan={5} style={{ ...TD, textAlign: "center", color: "#9aa5b4", padding: "28px" }}><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /></td></tr>
                ) : lignes.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...TD, textAlign: "center", color: "#9aa5b4", padding: "28px" }}>Aucune ligne ne correspond.</td></tr>
                ) : lignes.map(l => (
                  <tr key={l.id} style={{ borderTop: "1px solid #F4F2F0" }}>
                    <td style={{ ...TD, fontWeight: 600, color: "#2d3540" }}>{l.exportateur}</td>
                    <td style={{ ...TD, fontWeight: 600, color: "#2d3540" }}>{l.importateur}</td>
                    <td style={TD}>{l.annee}</td>
                    <td style={{ ...TD, color: "#4a5568" }}>{l.ressource}</td>
                    <td style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#004f91" }} title={l.valeur != null ? l.valeur.toLocaleString("fr-FR") + " $" : ""}>{fmtVal(l.valeur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > TAILLE && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14 }}>
              <span style={{ fontSize: 12, color: "#9aa5b4" }}>Page {page} / {nbPages}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  style={{ ...PGBTN, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? "not-allowed" : "pointer" }}>Précédent</button>
                <button onClick={() => setPage(p => Math.min(nbPages, p + 1))} disabled={page >= nbPages}
                  style={{ ...PGBTN, opacity: page >= nbPages ? 0.4 : 1, cursor: page >= nbPages ? "not-allowed" : "pointer" }}>Suivant</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Partenaires hors référentiel (noms éditables) */}
      {partenaires.length > 0 && (() => {
        const filt = partenaires.filter(pa => !qPart || pa.nom_fr.toLowerCase().includes(qPart.toLowerCase()) || (pa.code_iso3 || "").toLowerCase().includes(qPart.toLowerCase()));
        return (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "22px 28px", marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
            <div style={{ ...SEC, marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>Partenaires hors référentiel — noms éditables</div>
            <span style={{ fontSize: 12, color: "#9aa5b4" }}>{partenaires.length}</span>
          </div>
          <p style={{ fontSize: 12, color: "#9aa5b4", marginBottom: 12 }}>Territoires et agrégats ajoutés à l&apos;import. Renommez-les en français (ex : Western Sahara → Sahara occidental) ; le nom d&apos;origine reste reconnu aux imports suivants.</p>
          <div style={{ position: "relative", marginBottom: 12, maxWidth: 340 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
            <input value={qPart} onChange={e => setQPart(e.target.value)} placeholder="Rechercher un partenaire…" style={{ ...IS, paddingLeft: 30 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 10 }}>
            {filt.map(pa => (
              <div key={pa.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {pa.code_iso3 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.07)", padding: "3px 8px", borderRadius: 999, flexShrink: 0 }}>{pa.code_iso3}</span>}
                <input defaultValue={pa.nom_fr || ""} onBlur={e => savePartenaire(pa.id, e.target.value)} style={IS} />
              </div>
            ))}
          </div>
        </div>
        );
      })()}

      {/* Ressources (éditables) */}
      {ressources.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "22px 28px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ ...SEC, marginBottom: 12 }}>Ressources — libellés éditables</div>
          <p style={{ fontSize: 12, color: "#9aa5b4", marginBottom: 12 }}>Traduisez ou renommez ; le libellé s&apos;applique partout où la ressource apparaît.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 10 }}>
            {ressources.map(rr => (
              <div key={rr.nom_en} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#9aa5b4", flex: "0 0 auto", minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={rr.nom_en}>{rr.nom_en}</span>
                <input defaultValue={rr.libelle || ""} onBlur={e => saveRessource(rr.nom_en, e.target.value)} style={IS} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
