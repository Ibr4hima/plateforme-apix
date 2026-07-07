"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle, ChevronDown, Link2, Loader2, Search, Trash2, UploadCloud, X } from "lucide-react";

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
          Importez les données de la page Statistiques : indicateurs macro par pays, ou données transactionnelles bilatérales par produit.
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
// Panneau « Données transactionnelles »
// ══════════════════════════════════════════════════════════════════════════════
function TransactionsPanel({ headers, paysList }: { headers: () => Record<string,string>; paysList: RefPays[] }) {
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [assoc, setAssoc] = useState<Record<string, { id: number; nom: string }>>({});
  const [associating, setAssociating] = useState(false);
  const [couv, setCouv] = useState<{ annee: number; nb_lignes: number }[]>([]);
  const [unites, setUnites] = useState<{ code: string; libelle: string; abbr: string }[]>([]);
  const [prod, setProd] = useState<{ total: number; produits: { hs_code: string; libelle: string; nom_en: string }[] }>({ total: 0, produits: [] });
  const [qProd, setQProd] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = async () => {
    const [c, u, pr] = await Promise.all([
      fetch(`${API}/statistiques/transactions/couverture`, { headers: headers() }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/statistiques/unites`, { headers: headers() }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/statistiques/produits?limit=100&q=${encodeURIComponent(qProd)}`, { headers: headers() }).then(r => r.ok ? r.json() : { total: 0, produits: [] }),
    ]);
    setCouv(c || []); setUnites(u || []); setProd(pr || { total: 0, produits: [] });
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(() => {
    fetch(`${API}/statistiques/produits?limit=100&q=${encodeURIComponent(qProd)}`, { headers: headers() }).then(r => r.json()).then(setProd).catch(() => {});
  }, 250); return () => clearTimeout(t); }, [qProd]);

  async function handleImport() {
    if (!files.length) return;
    setImporting(true); setRes(null); setAssoc({});
    try {
      const fd = new FormData();
      files.forEach(f => fd.append("fichiers", f));
      const r = await fetch(`${API}/statistiques/transactions/importer`, { method: "POST", headers: headers(), body: fd });
      const data = await r.json();
      if (r.ok) { setRes(data); if (!data.non_resolus?.length) setFiles([]); await load(); }
      else setRes({ non_resolus: [], erreur: data.detail || "Erreur" });
    } catch (e: any) { setRes({ non_resolus: [], erreur: "Erreur réseau : " + e.message }); }
    setImporting(false);
  }
  async function handleAssocier() {
    const toDo = Object.entries(assoc).filter(([, v]) => v.id);
    if (!toDo.length) return;
    setAssociating(true);
    for (const [label, { id }] of toDo)
      await fetch(`${API}/statistiques/associer-pays`, { method: "POST", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify({ label, ref_pays_id: id }) });
    setAssociating(false); await handleImport();
  }
  async function delAnnee(a: number) {
    if (!confirm(`Supprimer toutes les transactions de ${a} ?`)) return;
    setDeleting(a);
    try { const r = await fetch(`${API}/statistiques/transactions/${a}`, { method: "DELETE", headers: headers() }); if (r.ok) await load(); } catch {}
    setDeleting(null);
  }
  async function editProduit(hs: string, libelle: string) {
    setProd(pr => ({ ...pr, produits: pr.produits.map(x => x.hs_code === hs ? { ...x, libelle } : x) }));
  }
  async function saveProduit(hs: string, libelle: string) {
    await fetch(`${API}/statistiques/produits/${hs}`, { method: "PATCH", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify({ libelle }) });
  }
  async function editUnite(code: string, libelle: string) { setUnites(us => us.map(x => x.code === code ? { ...x, libelle } : x)); }
  async function saveUnite(code: string, libelle: string) {
    await fetch(`${API}/statistiques/unites/${encodeURIComponent(code)}`, { method: "PATCH", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify({ libelle }) });
  }

  return (
    <>
      {/* Import */}
      <div className="ro-w" style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "24px 28px", marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        <div style={SEC}>Importer un fichier de transactions</div>
        <p style={{ fontSize: 12, color: "#9aa5b4", marginBottom: 14 }}>
          Fichier CSV BACI/OEC (year, exporter_id/name, importer_id/name, hs_code, product_name, value, quantity, unit_name). Les pays sont résolus par code ISO3, les libellés produits et unités sont enregistrés pour édition. Réimporter une année remplace ses données.
        </p>
        <FileZone files={files} onChange={setFiles} hint="Fichier volumineux accepté · un fichier par année · CSV recommandé" />
        {res?.lignes !== undefined && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(24,128,56,0.06)", border: "1px solid rgba(24,128,56,0.2)", fontSize: 13, color: "#188038" }}>
            ✓ {res.lignes.toLocaleString("fr-FR")} lignes importées · années {(res.annees || []).join(", ")} · {res.produits_vus} produits, {res.unites_vues} unités
          </div>
        )}
        {res?.erreur && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", fontSize: 13, color: "#dc2626" }}>⚠ {res.erreur}</div>}
        <button onClick={handleImport} disabled={importing || !files.length}
          style={{ marginTop: 16, background: importing || !files.length ? "#C5BFBB" : "#004f91", color: "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 13, fontWeight: 700, cursor: importing || !files.length ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-google-sans)" }}>
          {importing ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <UploadCloud size={15} />}
          {importing ? "Import en cours (peut être long)…" : "Importer"}
        </button>
      </div>

      {/* Pays non reconnus */}
      {res?.non_resolus?.length ? (
        <div className="ro-w" style={{ background: "#fff", borderRadius: 14, border: "2px solid rgba(202,99,31,0.5)", padding: "24px 28px", marginBottom: 20 }}>
          <div style={{ ...SEC, color: "#ca631f", borderBottomColor: "rgba(202,99,31,0.25)" }}>{res.non_resolus.length} pays non reconnus — association manuelle</div>
          <p style={{ fontSize: 12, color: "#9aa5b4", marginBottom: 16 }}>L&apos;association vaut à la fois pour l&apos;exportateur et l&apos;importateur, et pour tous les imports futurs.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {res.non_resolus.map((nr: any) => (
              <div key={nr.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(202,99,31,0.04)", borderRadius: 10, border: "1px solid rgba(202,99,31,0.18)" }}>
                <div style={{ flex: "0 0 240px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#ca631f" }}>{nr.label}</div>
                  <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 2 }}>{nr.nb_lignes.toLocaleString("fr-FR")} lignes concernées</div>
                </div>
                <AssociatePicker paysList={paysList} onSelect={(id, nom) => setAssoc(p => ({ ...p, [nr.label]: { id, nom } }))} />
                {assoc[nr.label] && <CheckCircle size={18} color="#188038" style={{ flexShrink: 0 }} />}
              </div>
            ))}
          </div>
          <button onClick={handleAssocier} disabled={associating || !Object.values(assoc).some(v => v.id)}
            style={{ marginTop: 16, background: associating || !Object.values(assoc).some(v => v.id) ? "#C5BFBB" : "#ca631f", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-google-sans)" }}>
            {associating ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Link2 size={15} />}
            {associating ? "Association…" : "Associer et réimporter"}
          </button>
        </div>
      ) : null}

      {/* Années couvertes */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "22px 28px", marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        <div style={{ ...SEC, marginBottom: 12 }}>Années importées</div>
        {couv.length === 0 ? <div style={{ fontSize: 13, color: "#9aa5b4" }}>Aucune transaction importée.</div> : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {couv.map(c => (
              <span key={c.annee} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,79,145,0.06)", borderRadius: 999, padding: "5px 6px 5px 13px", fontSize: 12.5, fontWeight: 600, color: "#004f91" }}>
                {c.annee} <span style={{ color: "#9aa5b4", fontWeight: 500 }}>· {c.nb_lignes.toLocaleString("fr-FR")} lignes</span>
                <button onClick={() => delAnnee(c.annee)} className="ro-w" title="Supprimer cette année"
                  style={{ background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer", borderRadius: 999, width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {deleting === c.annee ? <Loader2 size={11} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} /> : <Trash2 size={11} style={{ color: "#dc2626" }} />}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Unités (éditables) */}
      {unites.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "22px 28px", marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ ...SEC, marginBottom: 12 }}>Unités — libellés éditables</div>
          <p style={{ fontSize: 12, color: "#9aa5b4", marginBottom: 12 }}>Modifier un libellé s&apos;applique partout où l&apos;unité apparaît.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
            {unites.map(u => (
              <div key={u.code} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#9aa5b4", flex: "0 0 auto", minWidth: 90 }}>{u.code}{u.abbr ? ` (${u.abbr})` : ""}</span>
                <input value={u.libelle || ""} onChange={e => editUnite(u.code, e.target.value)} onBlur={e => saveUnite(u.code, e.target.value)} style={IS} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Produits (éditables, recherche) */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "22px 28px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div style={{ ...SEC, marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>Produits (codes HS) — libellés éditables</div>
          <span style={{ fontSize: 12, color: "#9aa5b4" }}>{prod.total.toLocaleString("fr-FR")} codes</span>
        </div>
        <p style={{ fontSize: 12, color: "#9aa5b4", marginBottom: 12 }}>Modifier le libellé d&apos;un code s&apos;applique partout où ce code apparaît.</p>
        <div style={{ position: "relative", marginBottom: 12, maxWidth: 340 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
          <input value={qProd} onChange={e => setQProd(e.target.value)} placeholder="Rechercher un code ou un libellé…" style={{ ...IS, paddingLeft: 30 }} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ECEAE7" }}>
                <th style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em", width: 90 }}>Code HS</th>
                <th style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em" }}>Libellé (éditable)</th>
                <th style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.08em" }}>Nom d&apos;origine (EN)</th>
              </tr>
            </thead>
            <tbody>
              {prod.produits.map(pr => (
                <tr key={pr.hs_code} style={{ borderBottom: "1px solid #F5F4F3" }}>
                  <td style={{ padding: "7px 12px", fontFamily: "monospace", fontWeight: 700, color: "#004f91" }}>{pr.hs_code}</td>
                  <td style={{ padding: "7px 12px" }}>
                    <input value={pr.libelle || ""} onChange={e => editProduit(pr.hs_code, e.target.value)} onBlur={e => saveProduit(pr.hs_code, e.target.value)} style={{ ...IS, padding: "6px 10px" }} />
                  </td>
                  <td style={{ padding: "7px 12px", fontSize: 12, color: "#9aa5b4", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr.nom_en}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {prod.produits.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#9aa5b4", fontSize: 13 }}>Aucun produit — importez d&apos;abord un fichier.</div>}
          {prod.total > prod.produits.length && <p style={{ fontSize: 11.5, color: "#9aa5b4", marginTop: 10 }}>Affichage des 100 premiers résultats — affinez la recherche pour trouver un code précis.</p>}
        </div>
      </div>
    </>
  );
}
