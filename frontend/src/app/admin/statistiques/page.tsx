"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle, ChevronDown, Database, Link2, Loader2, Trash2, UploadCloud, X } from "lucide-react";
import { confirmer } from "@/components/shared/Confirmation";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import { SkeletonRows } from "@/components/shared/Skeleton";
import {
  Avis, Carte, ChampRecherche, Compteur, FileZone, Ligne, LigneVide, Tableau,
  IS, NUM, TD, TH, btnDanger, btnPrincipal,
} from "@/components/admin/UIAdmin";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type Indicateur = { code: string; libelle: string; unite: string; derive: boolean };
type RefPays    = { id: number; nom_fr: string; code_iso3: string | null };
type Couverture = { pays_id: number; pays: string; code_iso3: string | null; series: Record<string, { min: number; max: number; nb: number }> };
type ImportRes  = { pays: { pays: string; pays_id: number; insere: number; mis_a_jour: number }[]; erreurs: string[]; non_resolus: { label: string; nb_lignes: number }[] };

// ── Sélecteur de pays du référentiel (association manuelle) ───────────────────
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
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input value={chosen || search} onChange={e => { setSearch(e.target.value); setChosen(""); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="Rechercher un pays du référentiel…" style={{ ...IS, borderColor: chosen ? "var(--bleu)" : "var(--bordure-forte)" }} />
      {open && filtered.length > 0 && !chosen && (
        <div style={{ position: "absolute", zIndex: 200, top: "100%", left: 0, right: 0, background: "var(--carte)", border: "1px solid var(--bordure-forte)", borderRadius: 12, boxShadow: "var(--ombre-2)", maxHeight: 220, overflowY: "auto", marginTop: 4 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => { setChosen(p.nom_fr); setSearch(""); setOpen(false); onSelect(p.id, p.nom_fr); }}
              style={{ padding: "8px 13px", fontSize: 12.5, cursor: "pointer", borderBottom: "1px solid var(--filet)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.05)")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              {p.nom_fr}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
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
  const [tab, setTab] = useState<"indicateurs" | "transactions">("indicateurs");
  const [qPays, setQPays] = useState("");

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
    if (!(await confirmer(`Vider TOUTES les données de « ${indActuel?.libelle} » pour tous les pays ?\n\nCette action est irréversible.`))) return;
    setViding(true);
    try { const r = await fetch(`${API}/statistiques/indicateur/${indicateur}`, { method: "DELETE", headers: headers() }); if (r.ok) await load(); } catch {}
    setViding(false);
  }

  async function handleDelete(pid: number, pays: string) {
    if (!(await confirmer(`Supprimer toutes les données statistiques de ${pays} ?`))) return;
    setDeleting(pid);
    try { const r = await fetch(`${API}/statistiques/pays/${pid}`, { method: "DELETE", headers: headers() }); if (r.ok) await load(); } catch {}
    setDeleting(null);
  }

  // Unité attendue à l'import, selon l'indicateur choisi
  const uniteAttendue = indActuel
    ? indActuel.code === "population" ? "milliers d'habitants"
      : ["pib", "importations_marchandises", "exportations_marchandises", "importations_services", "exportations_services"].includes(indActuel.code)
        ? "millions de $ US" : indActuel.unite
    : "";

  const couvFiltree = useMemo(
    () => couverture.filter(c => !qPays || c.pays.toLowerCase().includes(qPays.toLowerCase()) || (c.code_iso3 || "").toLowerCase().includes(qPays.toLowerCase())),
    [couverture, qPays]);

  return (
    <div style={{ fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}`}</style>

      {/* ── Bandeau orange (espace d'administration) ── */}
      <BarreTitre titre="Données Statistiques" compact ton="orange" pleineLargeur>
        <BarreTitreSegment
          options={[
            { v: "indicateurs",   l: "Indicateurs par pays" },
            { v: "transactions",  l: "Données transactionnelles" },
          ]}
          value={tab} onChange={v => setTab(v)} />
      </BarreTitre>

      <div style={{ padding: "28px 40px 80px", maxWidth: 1400 }}>
        {tab === "transactions" ? <TransactionsPanel headers={headers} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* ── Import ── */}
          <Carte titre="Importer des données"
            aide="Un fichier peut contenir plusieurs pays. Les en-têtes sont détectés automatiquement ; les valeurs existantes sont mises à jour.">
            <div className="ro-w">
              <div style={{ display: "flex", gap: 14, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                  <label style={{ fontSize: 10.5, fontWeight: 800, color: "var(--gris)", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.12em" }}>Indicateur à importer</label>
                  <div style={{ position: "relative" }}>
                    <select value={indicateur} onChange={e => { setIndicateur(e.target.value); setRes(null); }}
                      style={{ ...IS, appearance: "none", cursor: "pointer", paddingRight: 34, fontWeight: 600 }}>
                      {importables.map(i => <option key={i.code} value={i.code}>{i.libelle} ({i.unite})</option>)}
                    </select>
                    <ChevronDown size={15} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--gris)", pointerEvents: "none" }} />
                  </div>
                </div>
                {indActuel && (
                  <div style={{ paddingBottom: 10 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--gris)", textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: 6 }}>Unité attendue</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--bleu)", background: "rgb(var(--bleu-rgb) / 0.07)", padding: "6px 13px", borderRadius: 999, display: "inline-block" }}>{uniteAttendue}</span>
                  </div>
                )}
                <button onClick={handleVider} disabled={viding} title={`Vider toutes les données de « ${indActuel?.libelle} »`}
                  style={{ ...btnDanger, marginLeft: "auto", marginBottom: 4, cursor: viding ? "default" : "pointer" }}>
                  {viding ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={14} />}
                  Vider l&apos;indicateur
                </button>
              </div>

              <FileZone files={files} onChange={setFiles}
                hint={indicateur === "superficie"
                  ? "Colonnes : ID · Pays · Superficie (sans année)"
                  : "Colonnes Pays, Année et Valeur — ordre libre"} />

              {res && (res.pays.length > 0 || res.erreurs.length > 0) && (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  {res.pays.length > 0 && (
                    <Avis ton="ok">
                      {res.pays.map(p => <div key={p.pays}>✓ <strong>{p.pays}</strong> — {p.insere} insérées, {p.mis_a_jour} mises à jour</div>)}
                    </Avis>
                  )}
                  {res.erreurs.length > 0 && (
                    <Avis ton="erreur">{res.erreurs.map((e, i) => <div key={i}>⚠ {e}</div>)}</Avis>
                  )}
                </div>
              )}

              <button onClick={handleImport} disabled={importing || !files.length} style={{ ...btnPrincipal(!importing && files.length > 0), marginTop: 16 }}>
                {importing ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <UploadCloud size={15} />}
                {importing ? "Import en cours…" : "Importer"}
              </button>
            </div>
          </Carte>

          {/* ── Pays non reconnus ── */}
          {res?.non_resolus?.length ? (
            <Carte accent="var(--orange)"
              titre={`${res.non_resolus.length} pays non reconnus — association manuelle`}
              aide="Associez-les une fois : ils seront reconnus automatiquement lors des prochains imports."
              extra={<Compteur n={Object.values(assoc).filter(v => v.id).length} mot="associé" couleur="var(--orange)" />}>
              <div className="ro-w" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {res.non_resolus.map(nr => (
                  <div key={nr.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgb(var(--orange-rgb) / 0.04)", borderRadius: 12, border: "1px solid rgb(var(--orange-rgb) / 0.18)" }}>
                    <div style={{ flex: "0 0 240px", minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--orange)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nr.label}</div>
                      <div style={{ fontSize: 11, color: "var(--gris)", marginTop: 2 }}>{nr.nb_lignes} lignes non importées</div>
                    </div>
                    <AssociatePicker paysList={paysList} onSelect={(id, nom) => setAssoc(p => ({ ...p, [nr.label]: { id, nom } }))} />
                    {assoc[nr.label] && <CheckCircle size={18} color="var(--vert)" style={{ flexShrink: 0 }} />}
                  </div>
                ))}
                <button onClick={handleAssocier} disabled={associating || !Object.values(assoc).some(v => v.id)}
                  style={{ ...btnPrincipal(!associating && Object.values(assoc).some(v => v.id)), background: associating || !Object.values(assoc).some(v => v.id) ? "var(--bordure-forte)" : "var(--orange-action)", boxShadow: "none", marginTop: 6, alignSelf: "flex-start" }}>
                  {associating ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Link2 size={15} />}
                  {associating ? "Association…" : "Associer et réimporter"}
                </button>
              </div>
            </Carte>
          ) : null}

          {/* ── Couverture par pays ── */}
          <Carte titre="Données importées par pays"
            extra={
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <ChampRecherche value={qPays} onChange={setQPays} placeholder="Rechercher un pays…" style={{ width: 240 }} />
                {!loading && <Compteur n={couvFiltree.length} mot="pays" />}
              </div>
            }>
            {loading ? <SkeletonRows n={8} /> : couverture.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 24px", color: "var(--gris)" }}>
                <Database size={44} style={{ marginBottom: 14, opacity: 0.3 }} />
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--texte)" }}>Aucune donnée importée</p>
                <p style={{ fontSize: 13, marginTop: 5 }}>Utilisez la zone d&apos;import ci-dessus pour commencer.</p>
              </div>
            ) : (
              <Tableau hauteurMax={560}>
                <thead>
                  <tr>
                    <th style={{ ...TH, position: "sticky", left: 0, zIndex: 2 }}>Pays</th>
                    {importables.map(i => <th key={i.code} style={{ ...TH, textAlign: "center" }}>{i.libelle}</th>)}
                    <th style={{ ...TH, width: 56 }} className="ro-w" />
                  </tr>
                </thead>
                <tbody>
                  {couvFiltree.length === 0 ? <LigneVide colSpan={importables.length + 2} texte="Aucun pays ne correspond à cette recherche." /> :
                  couvFiltree.map(c => (
                    <Ligne key={c.pays_id}>
                      <td style={{ ...TD, borderTop: "1px solid var(--bordure)", position: "sticky", left: 0, background: "var(--carte)", fontWeight: 700, color: "var(--encre)", whiteSpace: "nowrap" }}>
                        {c.pays}
                        {c.code_iso3 && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "var(--gris)" }}>{c.code_iso3}</span>}
                      </td>
                      {importables.map(i => {
                        const s = c.series[i.code];
                        return (
                          <td key={i.code} style={{ ...TD, borderTop: "1px solid var(--bordure)", textAlign: "center" }}>
                            {s ? (
                              <span style={{ ...NUM, background: "rgb(var(--bleu-rgb) / 0.06)", padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: "var(--bleu)", whiteSpace: "nowrap" }}>
                                {i.code === "superficie" || s.max === 0 ? "✓" : `${s.min}–${s.max}`}
                                <span style={{ color: "var(--gris)", fontWeight: 500 }}> ({s.nb})</span>
                              </span>
                            ) : <span style={{ color: "var(--sur-bleu)" }}>–</span>}
                          </td>
                        );
                      })}
                      <td style={{ ...TD, borderTop: "1px solid var(--bordure)", textAlign: "center" }} className="ro-w">
                        <button onClick={() => handleDelete(c.pays_id, c.pays)} disabled={deleting === c.pays_id} title="Supprimer toutes ses données"
                          style={{ background: "rgb(var(--danger-rgb) / 0.07)", border: "none", cursor: "pointer", borderRadius: 999, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgb(var(--danger-rgb) / 0.15)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "rgb(var(--danger-rgb) / 0.07)")}>
                          {deleting === c.pays_id ? <Loader2 size={13} style={{ color: "var(--danger)", animation: "spin 1s linear infinite" }} /> : <Trash2 size={13} style={{ color: "var(--danger)" }} />}
                        </button>
                      </td>
                    </Ligne>
                  ))}
                </tbody>
              </Tableau>
            )}
          </Carte>
        </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Panneau « Données transactionnelles » (resourcetrade.earth)
// ══════════════════════════════════════════════════════════════════════════════
function TransactionsPanel({ headers }: { headers: () => Record<string, string> }) {
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [couv, setCouv] = useState<{ annee: number; nb_lignes: number }[]>([]);
  const [ressources, setRessources] = useState<{ nom_en: string; libelle: string }[]>([]);
  const [partenaires, setPartenaires] = useState<{ id: number; nom_fr: string; code_iso3: string | null }[]>([]);
  const [qPart, setQPart] = useState("");
  const [qRess, setQRess] = useState("");
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
    if (!(await confirmer(`Supprimer toutes les transactions de ${a} ?`))) return;
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

  const partFiltres = partenaires.filter(pa => !qPart || pa.nom_fr.toLowerCase().includes(qPart.toLowerCase()) || (pa.code_iso3 || "").toLowerCase().includes(qPart.toLowerCase()));
  const ressFiltrees = ressources.filter(rr => !qRess || (rr.libelle || "").toLowerCase().includes(qRess.toLowerCase()) || rr.nom_en.toLowerCase().includes(qRess.toLowerCase()));
  const btnPage: React.CSSProperties = { background: "var(--carte)", border: "1px solid var(--bordure-forte)", borderRadius: 999, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, color: "var(--encre)", fontFamily: "var(--font-google-sans)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── Import ── */}
      <Carte titre="Importer un fichier de transactions"
        aide="Fichier resourcetrade.earth (colonnes Exporter ISO3, Importer ISO3, Resource, Year, Value 1000USD). Les pays sont résolus par code ISO3, la valeur convertie en dollars et les ressources enregistrées pour édition. Réimporter une année remplace ses données.">
        <div className="ro-w">
          <FileZone files={files} onChange={setFiles} hint="Fichier Excel (.xlsx) ou CSV · un fichier par année" />
          {res?.lignes !== undefined && (
            <div style={{ marginTop: 14 }}>
              <Avis ton="ok">
                ✓ {res.lignes.toLocaleString("fr-FR")} lignes importées · années {(res.annees || []).join(", ")} · {res.ressources_vues} ressources
                {res.partenaires_crees?.length ? ` · ${res.partenaires_crees.length} partenaire(s) ajouté(s) automatiquement` : ""}
              </Avis>
            </div>
          )}
          {res?.erreur && <div style={{ marginTop: 14 }}><Avis ton="erreur">⚠ {res.erreur}</Avis></div>}
          <button onClick={handleImport} disabled={importing || !files.length} style={{ ...btnPrincipal(!importing && files.length > 0), marginTop: 16 }}>
            {importing ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <UploadCloud size={15} />}
            {importing ? "Import en cours (peut être long)…" : "Importer"}
          </button>
        </div>
      </Carte>

      {/* ── Partenaires ajoutés automatiquement ── */}
      {res?.partenaires_crees?.length ? (
        <Carte titre={`${res.partenaires_crees.length} partenaires ajoutés automatiquement`}
          aide="Ces exportateurs / importateurs étaient absents du référentiel (territoires, agrégats…). Ils ont été créés pour ne perdre aucune donnée et n'apparaissent pas dans la liste des pays macro.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {res.partenaires_crees.map((pc: any) => (
              <span key={pc.nom} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--texte)", background: "var(--champ)", padding: "4px 11px", borderRadius: 999 }}>
                {pc.nom}{pc.code ? <span style={{ color: "var(--gris)" }}>· {pc.code}</span> : null}
              </span>
            ))}
          </div>
        </Carte>
      ) : null}

      {/* ── Années importées ── */}
      <Carte titre="Années importées" extra={couv.length > 0 ? <Compteur n={couv.reduce((s, c) => s + c.nb_lignes, 0)} mot="ligne" /> : undefined}>
        {couv.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--gris)" }}>Aucune transaction importée.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {couv.map(cc => (
              <span key={cc.annee} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgb(var(--bleu-rgb) / 0.06)", border: "1px solid rgb(var(--bleu-rgb) / 0.14)", borderRadius: 999, padding: "5px 6px 5px 14px", fontSize: 12.5, fontWeight: 700, color: "var(--bleu)", ...NUM }}>
                {cc.annee} <span style={{ color: "var(--gris)", fontWeight: 500 }}>· {cc.nb_lignes.toLocaleString("fr-FR")} lignes</span>
                <button onClick={() => delAnnee(cc.annee)} className="ro-w" title="Supprimer cette année"
                  style={{ background: "rgb(var(--danger-rgb) / 0.08)", border: "none", cursor: "pointer", borderRadius: 999, width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {deleting === cc.annee ? <Loader2 size={11} style={{ color: "var(--danger)", animation: "spin 1s linear infinite" }} /> : <Trash2 size={11} style={{ color: "var(--danger)" }} />}
                </button>
              </span>
            ))}
          </div>
        )}
      </Carte>

      {/* ── Tableau des transactions ── */}
      {couv.length > 0 && (
        <Carte titre="Données transactionnelles importées" extra={<Compteur n={total} mot="ligne" />}>
          {/* Filtres */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <ChampRecherche value={q} onChange={setQ} placeholder="Rechercher un pays ou une ressource…" style={{ flex: "1 1 280px", minWidth: 220 }} />
            <select value={fAnnee} onChange={e => setFAnnee(e.target.value)} style={{ ...IS, width: "auto", cursor: "pointer", fontWeight: 600 }}>
              <option value="">Toutes les années</option>
              {couv.map(cc => <option key={cc.annee} value={cc.annee}>{cc.annee}</option>)}
            </select>
            <select value={fRessource} onChange={e => setFRessource(e.target.value)} style={{ ...IS, width: "auto", maxWidth: 280, cursor: "pointer", fontWeight: 600 }}>
              <option value="">Toutes les ressources</option>
              {ressources.map(rr => <option key={rr.nom_en} value={rr.nom_en}>{rr.libelle || rr.nom_en}</option>)}
            </select>
          </div>

          <Tableau hauteurMax={620}>
            <thead>
              <tr>
                <th style={TH}>Exportateur</th>
                <th style={TH}>Importateur</th>
                <th style={{ ...TH, width: 80 }}>Année</th>
                <th style={TH}>Ressource</th>
                <th style={{ ...TH, textAlign: "right" }}>Valeur</th>
              </tr>
            </thead>
            <tbody>
              {loadingTable ? (
                <tr><td colSpan={5} style={{ padding: 16 }}><SkeletonRows n={6} h={30} /></td></tr>
              ) : lignes.length === 0 ? (
                <LigneVide colSpan={5} texte="Aucune ligne ne correspond à ces filtres." />
              ) : lignes.map(l => (
                <Ligne key={l.id}>
                  <td style={{ ...TD, borderTop: "1px solid var(--bordure)", fontWeight: 600, color: "var(--encre)" }}>{l.exportateur}</td>
                  <td style={{ ...TD, borderTop: "1px solid var(--bordure)", fontWeight: 600, color: "var(--encre)" }}>{l.importateur}</td>
                  <td style={{ ...TD, borderTop: "1px solid var(--bordure)", ...NUM, color: "var(--texte)" }}>{l.annee}</td>
                  <td style={{ ...TD, borderTop: "1px solid var(--bordure)", color: "var(--texte)" }}>{l.ressource}</td>
                  <td style={{ ...TD, borderTop: "1px solid var(--bordure)", textAlign: "right", ...NUM, fontWeight: 700, color: "var(--bleu)" }}
                    title={l.valeur != null ? l.valeur.toLocaleString("fr-FR") + " $" : ""}>{fmtVal(l.valeur)}</td>
                </Ligne>
              ))}
            </tbody>
          </Tableau>

          {/* Pagination */}
          {total > TAILLE && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14 }}>
              <span style={{ fontSize: 12, color: "var(--gris)", ...NUM }}>Page {page} sur {nbPages}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  style={{ ...btnPage, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? "not-allowed" : "pointer" }}>Précédent</button>
                <button onClick={() => setPage(p => Math.min(nbPages, p + 1))} disabled={page >= nbPages}
                  style={{ ...btnPage, opacity: page >= nbPages ? 0.4 : 1, cursor: page >= nbPages ? "not-allowed" : "pointer" }}>Suivant</button>
              </div>
            </div>
          )}
        </Carte>
      )}

      {/* ── Partenaires hors référentiel ── */}
      {partenaires.length > 0 && (
        <Carte titre="Partenaires hors référentiel — noms éditables"
          aide="Territoires et agrégats ajoutés à l'import. Renommez-les en français (ex : Western Sahara → Sahara occidental) ; le nom d'origine reste reconnu aux imports suivants."
          extra={
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <ChampRecherche value={qPart} onChange={setQPart} placeholder="Rechercher un partenaire…" style={{ width: 240 }} />
              <Compteur n={partFiltres.length} mot="partenaire" />
            </div>
          }>
          <Tableau hauteurMax={420}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 90 }}>Code</th>
                <th style={TH}>Nom affiché</th>
              </tr>
            </thead>
            <tbody>
              {partFiltres.length === 0 ? <LigneVide colSpan={2} texte="Aucun partenaire ne correspond." /> :
              partFiltres.map(pa => (
                <Ligne key={pa.id}>
                  <td style={{ ...TD, borderTop: "1px solid var(--bordure)" }}>
                    {pa.code_iso3
                      ? <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--bleu)", background: "rgb(var(--bleu-rgb) / 0.07)", padding: "3px 9px", borderRadius: 999 }}>{pa.code_iso3}</span>
                      : <span style={{ color: "var(--sur-bleu)" }}>–</span>}
                  </td>
                  <td style={{ ...TD, borderTop: "1px solid var(--bordure)", padding: "7px 14px" }}>
                    <input defaultValue={pa.nom_fr || ""} onBlur={e => savePartenaire(pa.id, e.target.value)} style={IS} />
                  </td>
                </Ligne>
              ))}
            </tbody>
          </Tableau>
        </Carte>
      )}

      {/* ── Ressources ── */}
      {ressources.length > 0 && (
        <Carte titre="Ressources — libellés éditables"
          aide="Traduisez ou renommez ; le libellé s'applique partout où la ressource apparaît."
          extra={
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <ChampRecherche value={qRess} onChange={setQRess} placeholder="Rechercher une ressource…" style={{ width: 240 }} />
              <Compteur n={ressFiltrees.length} mot="ressource" />
            </div>
          }>
          <Tableau hauteurMax={420}>
            <thead>
              <tr>
                <th style={{ ...TH, width: "40%" }}>Nom d&apos;origine</th>
                <th style={TH}>Libellé affiché</th>
              </tr>
            </thead>
            <tbody>
              {ressFiltrees.length === 0 ? <LigneVide colSpan={2} texte="Aucune ressource ne correspond." /> :
              ressFiltrees.map(rr => (
                <Ligne key={rr.nom_en}>
                  <td style={{ ...TD, borderTop: "1px solid var(--bordure)", color: "var(--gris)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 0 }} title={rr.nom_en}>{rr.nom_en}</td>
                  <td style={{ ...TD, borderTop: "1px solid var(--bordure)", padding: "7px 14px" }}>
                    <input defaultValue={rr.libelle || ""} onBlur={e => saveRessource(rr.nom_en, e.target.value)} style={IS} />
                  </td>
                </Ligne>
              ))}
            </tbody>
          </Tableau>
        </Carte>
      )}
    </div>
  );
}
