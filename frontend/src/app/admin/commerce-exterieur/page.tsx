"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, FileText, Loader2, ShieldCheck, UploadCloud, X } from "lucide-react";
import { authHeaders } from "@/lib/authHeaders";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const SEC: any = { fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #E8E5E3" };

type ImportRes = {
  bulletin: string; mois_couverts: string[]; valeurs: number; revisions: number;
  rapport: string; avertissements: string[];
};
type BulletinHist = {
  periode: string; fichier_nom: string; importe_le: string | null;
  mois_couverts: string[] | null; nb_valeurs: number; nb_revisions: number; rapport: string | null;
};

// Formate une date ISO « 2025-04-01 » en « avril 2025 ».
function fmtMois(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export default function AdminCommerceExterieurPage() {
  const [file, setFile]           = useState<File | null>(null);
  const [drag, setDrag]           = useState(false);
  const [importing, setImporting] = useState(false);
  const [res, setRes]             = useState<ImportRes | null>(null);
  const [erreur, setErreur]       = useState<string | null>(null);
  const [bulletins, setBulletins] = useState<BulletinHist[]>([]);
  const [ouvert, setOuvert]       = useState<string | null>(null);   // periode de la ligne dépliée
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadBulletins() {
    try {
      const data = await fetch(`${API}/bmce/bulletins`).then(r => r.json());
      setBulletins(Array.isArray(data) ? data : []);
    } catch { setBulletins([]); }
  }
  useEffect(() => { loadBulletins(); }, []);

  function pickFile(f: FileList | null) {
    if (f && f[0]) { setFile(f[0]); setRes(null); setErreur(null); }
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true); setRes(null); setErreur(null);
    try {
      const fd = new FormData();
      fd.append("fichier", file);
      const r = await fetch(`${API}/bmce/importer`, { method: "POST", headers: await authHeaders(), body: fd });
      const data = await r.json();
      if (!r.ok) setErreur(data.detail || "Erreur inconnue lors de l'import.");
      else { setRes(data); await loadBulletins(); }
    } catch (e: any) {
      setErreur("Erreur réseau : " + e.message);
    }
    setImporting(false);
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1180, margin: "0 auto", fontFamily: "var(--font-google-sans)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>Commerce extérieur</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 32 }}>
        Importez le Bulletin Mensuel des Statistiques du Commerce Extérieur (ANSD). Les flux mensuels bruts sont
        extraits du PDF ; les cumuls, variations et parts sont recalculés à la volée selon les règles ANSD.
      </p>

      {/* ── Import d'un bulletin ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E5E3", padding: "24px 28px", marginBottom: 8 }}>
        <div style={SEC}>Importer un bulletin ANSD</div>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files); }}
          style={{ border: `2px dashed ${drag || file ? "#004f91" : "#C5BFBB"}`, borderRadius: 10, padding: "24px", textAlign: "center", cursor: "pointer", background: drag ? "#E8F0FB" : file ? "#EEF4FB" : "#F9F8F7", transition: "all .15s" }}>
          <input ref={inputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => pickFile(e.target.files)} />
          {file ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <FileText size={18} color="#004f91" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#004f91" }}>{file.name}</span>
              <span style={{ fontSize: 12, color: "#888" }}>({(file.size / 1024).toFixed(0)} Ko)</span>
              <button onClick={e => { e.stopPropagation(); setFile(null); setRes(null); setErreur(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}><X size={14} /></button>
            </div>
          ) : (
            <>
              <UploadCloud size={22} color="#AAA" style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "#666" }}>Déposez le bulletin PDF ou cliquez pour parcourir</div>
              <div style={{ fontSize: 11, color: "#AAA", marginTop: 2 }}>Bulletin Mensuel des Statistiques du Commerce Extérieur (ANSD)</div>
            </>
          )}
        </div>

        {res && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "#EDFBF1", border: "1px solid #B2EAC5", fontSize: 13, color: "#1a7a3c" }}>
            ✓ Bulletin de <strong>{fmtMois(res.bulletin)}</strong> importé — mois couverts : {res.mois_couverts.map(fmtMois).join(", ")}.
            <div style={{ marginTop: 6 }}>
              <strong>{res.valeurs.toLocaleString("fr-FR")}</strong> valeurs écrites,{" "}
              <strong>{res.revisions.toLocaleString("fr-FR")}</strong> révision(s) de mois antérieurs.
            </div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
              <ShieldCheck size={15} /> {res.rapport}
            </div>
            {res.avertissements.length > 0 && (
              <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "#FFF9F0", border: "1px solid #FAD7A0", color: "#B7661B" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 4 }}>
                  <AlertTriangle size={14} /> Incohérences internes du bulletin
                </div>
                {res.avertissements.map((a, i) => (
                  <div key={i} style={{ fontSize: 12.5, padding: "2px 0" }}>{a}</div>
                ))}
              </div>
            )}
          </div>
        )}
        {erreur && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "#FFF2F2", border: "1px solid #F5C6CB", fontSize: 13, color: "#c0392b", whiteSpace: "pre-wrap" }}>⚠ {erreur}</div>
        )}

        <button onClick={handleImport} disabled={importing || !file}
          style={{ marginTop: 16, background: importing || !file ? "#ccc" : "#004f91", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: importing || !file ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
          {importing ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
          {importing ? "Import en cours…" : "Importer"}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#888", margin: "0 4px 20px", display: "flex", alignItems: "center", gap: 6 }}>
        <ShieldCheck size={14} color="#1a7a3c" style={{ flexShrink: 0 }} />
        L'extraction est auto-vérifiée (≈ 4 000 contrôles croisés avec les tableaux dérivés du bulletin).
        Les 3 mois précédents sont automatiquement révisés à chaque import.
      </p>

      {/* ── Bulletins importés ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E5E3", padding: "24px 28px" }}>
        <div style={SEC}>Bulletins importés</div>
        {bulletins.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: "#888", fontSize: 13 }}>Aucun bulletin importé pour le moment.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E8E5E3" }}>
                {["", "Mois du bulletin", "Fichier", "Importé le", "Mois couverts", "Valeurs", "Révisions"].map((h, i) => (
                  <th key={i} style={{ padding: "10px 12px", textAlign: ["Valeurs", "Révisions"].includes(h) ? "right" as const : "left" as const, fontSize: 10, fontWeight: 800, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bulletins.map(b => {
                const estOuvert = ouvert === b.periode;
                return (
                  <Fragment key={b.periode}>
                    <tr onClick={() => setOuvert(estOuvert ? null : b.periode)}
                      style={{ borderBottom: estOuvert ? "none" : "1px solid #F0EEEC", cursor: "pointer", background: estOuvert ? "#F5F8FD" : "transparent", transition: "background 0.12s" }}
                      onMouseEnter={e => { if (!estOuvert) e.currentTarget.style.background = "#FAFAF9"; }}
                      onMouseLeave={e => { if (!estOuvert) e.currentTarget.style.background = "transparent"; }}>
                      <td style={{ padding: "8px 4px 8px 12px", width: 22, color: "#888" }}>
                        {estOuvert ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td style={{ padding: "8px 12px", color: "#1a1a2e", fontWeight: 600, whiteSpace: "nowrap" }}>{fmtMois(b.periode)}</td>
                      <td style={{ padding: "8px 12px", color: "#555" }}>{b.fichier_nom}</td>
                      <td style={{ padding: "8px 12px", color: "#888", fontSize: 12, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        {b.importe_le ? new Date(b.importe_le).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–"}
                      </td>
                      <td style={{ padding: "8px 12px", color: "#666", fontSize: 12 }}>
                        {b.mois_couverts?.length ? `${fmtMois(b.mois_couverts[0])} – ${fmtMois(b.mois_couverts[b.mois_couverts.length - 1])}` : "–"}
                      </td>
                      <td style={{ padding: "8px 12px", color: "#666", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.nb_valeurs ? b.nb_valeurs.toLocaleString("fr-FR") : "–"}</td>
                      <td style={{ padding: "8px 12px", color: "#666", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.nb_revisions ? b.nb_revisions.toLocaleString("fr-FR") : "–"}</td>
                    </tr>
                    {estOuvert && (
                      <tr style={{ borderBottom: "1px solid #F0EEEC", background: "#F5F8FD" }}>
                        <td colSpan={7} style={{ padding: "0 12px 12px" }}>
                          <pre style={{ margin: 0, padding: "12px 14px", background: "#FAF9F8", border: "1px solid #E8E5E3", borderRadius: 8, fontSize: 11.5, lineHeight: 1.6, color: "#555", whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", maxHeight: 320, overflowY: "auto" }}>
                            {b.rapport || "Rapport de vérification indisponible."}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
