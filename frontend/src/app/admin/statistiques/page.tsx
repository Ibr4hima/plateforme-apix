"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle, ChevronDown, Link2, Loader2, Trash2, UploadCloud, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const SEC: any = { fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #E8E5E3" };
const IS: any  = { background: "#F8F7F6", border: "1px solid #E8E5E3", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" };

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

function FileZone({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
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
        <div style={{ fontSize: 11.5, color: "#9aa5b4", marginTop: 2 }}>Colonne A : pays · B : année · C : valeur · un fichier peut contenir plusieurs pays</div>
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
          Importez les données macro par pays. Choisissez l&apos;indicateur, déposez le fichier ; le pays est détecté automatiquement et alimente la page Statistiques.
        </p>
      </div>

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
              Unité attendue : <strong style={{ color: "#004f91" }}>{indActuel.code === "population" ? "milliers d'habitants" : indActuel.unite}</strong>
            </div>
          )}
          <button onClick={handleVider} disabled={viding} title={`Vider toutes les données de « ${indActuel?.libelle} »`}
            style={{ marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", color: "#dc2626", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: viding ? "default" : "pointer", fontFamily: "var(--font-google-sans)" }}>
            {viding ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={14} />}
            Vider l&apos;indicateur
          </button>
        </div>

        <FileZone files={files} onChange={setFiles} />

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
                          {s ? <span style={{ background: "rgba(0,79,145,0.07)", padding: "3px 10px", borderRadius: 999, fontSize: 11.5, color: "#004f91", whiteSpace: "nowrap" }}>{s.min}–{s.max} <span style={{ color: "#9aa5b4" }}>({s.nb})</span></span> : <span style={{ color: "#DDD" }}>–</span>}
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
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
