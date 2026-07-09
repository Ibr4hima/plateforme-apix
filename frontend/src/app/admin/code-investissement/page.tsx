"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Check, Upload, FileText, ChevronRight, ChevronDown, BookOpen } from "lucide-react";
import RichTextEditor from "@/components/shared/RichTextEditor";
import { authHeaders } from "@/lib/authHeaders";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const IS: any  = { background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any  = { fontSize:12, fontWeight:600, color:"#4a5568", marginBottom:5, display:"block" };

// ── Numérotation ordinale ─────────────────────────────────────────────────────
const ROMANS = ["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX"];
const toRoman = (n: number) => ROMANS[n] || String(n);
const numChap = (n: number) => n === 1 ? "premier" : toRoman(n);
const numSec  = (n: number) => n === 1 ? "première" : toRoman(n);
const numArt  = (n: number) => n === 1 ? "premier" : String(n);

// ── Formulaire inline générique ───────────────────────────────────────────────
function InlineForm({ label, initial, onSave, onCancel, saving, placeholder = "Intitulé…" }: any) {
  const [val, setVal] = useState(initial || "");
  return (
    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
      <input value={val} onChange={e=>setVal(e.target.value)} placeholder={placeholder}
        style={{...IS, flex:1}} onKeyDown={e=>{ if(e.key==="Enter") onSave(val); if(e.key==="Escape") onCancel(); }} autoFocus />
      <button onClick={()=>onSave(val)} disabled={saving||!val.trim()} style={{ background:"#ca631f", border:"none", color:"#fff", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontWeight:700, fontSize:13, display:"flex", alignItems:"center", gap:5 }}>
        {saving ? <Loader2 size={13} style={{animation:"spin 1s linear infinite"}} /> : <Check size={13} />} {label}
      </button>
      <button onClick={onCancel} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:"8px 10px" }}><X size={14} color="#4a5568" /></button>
    </div>
  );
}

// ── Formulaire titre + contenu optionnel (pour sections et chapitres) ─────────
function TitreContenuForm({ label, initialTitre, initialContenu, onSave, onCancel, saving, placeholder = "Intitulé…" }: any) {
  const [titre,   setTitre]   = useState(initialTitre   || "");
  const [contenu, setContenu] = useState(initialContenu || "");
  return (
    <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <input value={titre} onChange={e=>setTitre(e.target.value)} placeholder={placeholder}
          style={{...IS, flex:1}} onKeyDown={e=>{ if(e.key==="Escape") onCancel(); }} autoFocus />
        <button onClick={()=>onSave({titre, contenu})} disabled={saving||!titre.trim()}
          style={{ background:"#ca631f", border:"none", color:"#fff", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontWeight:700, fontSize:13, display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" as const }}>
          {saving ? <Loader2 size={13} style={{animation:"spin 1s linear infinite"}} /> : <Check size={13} />} {label}
        </button>
        <button onClick={onCancel} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:"8px 10px" }}><X size={14} color="#4a5568" /></button>
      </div>
      <RichTextEditor value={contenu} onChange={setContenu} />
    </div>
  );
}

// ── Éditeur article ───────────────────────────────────────────────────────────
function ArticleEditor({ art, sections, onSave, onCancel, saving }: any) {
  const [titre,   setTitre]   = useState(art?.titre   || "");
  const [contenu, setContenu] = useState(art?.contenu || "");
  const [secId,   setSecId]   = useState(art?.section_id || "");

  return (
    <div style={{ background:"#F8F7F6", border:"1px solid #E8E5E3", borderRadius:12, padding:"16px 18px" }}>
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10, marginBottom:10 }}>
        <div>
          <label style={LS}>Titre de l'article</label>
          <input value={titre} onChange={e=>setTitre(e.target.value)} placeholder="Ex : Égalité de traitement" style={IS} />
        </div>
        <div>
          <label style={LS}>Section (optionnel)</label>
          <select value={secId} onChange={e=>setSecId(e.target.value)} style={IS}>
            <option value="">— Directement sous le chapitre —</option>
            {sections.map((s:any)=><option key={s.id} value={s.id}>Section {s.num_display} — {s.titre}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom:10 }}>
        <label style={LS}>Contenu de l'article</label>
        <RichTextEditor value={contenu} onChange={setContenu} />
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <button onClick={onCancel} style={{ padding:"8px 16px", borderRadius:9, border:"1px solid #C5BFBB", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13, fontFamily:"var(--font-google-sans)" }}>Annuler</button>
        <button onClick={()=>onSave({titre:titre||null, contenu, section_id:secId||null})} disabled={saving}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 18px", borderRadius:9, border:"none", background:"#ca631f", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"var(--font-google-sans)" }}>
          {saving ? <Loader2 size={13} style={{animation:"spin 1s linear infinite"}} /> : <Check size={13} />}
          {art ? "Modifier" : "Créer l'article"}
        </button>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function CodeInvestissementPage() {
  const [onglet, setOnglet] = useState<"code"|"modalites">("code");
  const base = onglet === "code"
    ? `${API}/code-investissement`
    : `${API}/modalites-application`;

  const [chapitres,   setChapitres]   = useState<any[]>([]);
  const [pdfInfo,     setPdfInfo]     = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);

  // États UI
  const [expandedChap, setExpandedChap] = useState<string|null>(null);
  const [newChapForm,  setNewChapForm]  = useState(false);
  const [editChap,     setEditChap]     = useState<string|null>(null);
  const [newSecForm,   setNewSecForm]   = useState<string|null>(null);  // chapitre_id
  const [editSec,      setEditSec]      = useState<string|null>(null);
  const [newArtChap,   setNewArtChap]   = useState<string|null>(null);  // chapitre_id
  const [editArt,      setEditArt]      = useState<string|null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [code, pdf] = await Promise.all([
        fetch(`${base}`).then(r=>r.json()),
        fetch(`${base}/pdf/info`).then(r=>r.json()),
      ]);
      setChapitres(Array.isArray(code) ? code : []);
      setPdfInfo(pdf);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [base]);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    setExpandedChap(null);
    setNewChapForm(false);
    setEditChap(null);
    setNewSecForm(null);
    setEditSec(null);
    setNewArtChap(null);
    setEditArt(null);
    setPdfTitreEdit(false);
  }, [onglet]);

  // Prochain numéro auto
  const nextChapNum = () => Math.max(0, ...chapitres.map(c=>c.numero)) + 1;
  const nextSecNum  = (chapId:string) => {
    const chap = chapitres.find(c=>c.id===chapId);
    return Math.max(0, ...(chap?.sections||[]).map((s:any)=>s.numero)) + 1;
  };
  const nextArtNum  = () => Math.max(0, ...chapitres.flatMap(c=>(c.articles||[]).concat(c.sections?.flatMap((s:any)=>s.articles||[])||[])).map((a:any)=>a.numero)) + 1;

  // CRUD
  const saveChap = async (data: {titre:string; contenu?:string} | string, chapId?:string) => {
    const titre   = typeof data === "string" ? data : data.titre;
    const contenu = typeof data === "string" ? undefined : data.contenu;
    if (!titre.trim()) return;
    setSaving(true);
    try {
      if (chapId) {
        await fetch(`${base}/chapitres/${chapId}`, { method:"PATCH", headers:{"Content-Type":"application/json", ...(await authHeaders())}, body:JSON.stringify({titre, contenu}) });
        setEditChap(null);
      } else {
        await fetch(`${base}/chapitres`, { method:"POST", headers:{"Content-Type":"application/json", ...(await authHeaders())}, body:JSON.stringify({numero:nextChapNum(), titre, contenu}) });
        setNewChapForm(false);
      }
      charger();
    } finally { setSaving(false); }
  };

  const delChap = async (chapId:string) => {
    if (!confirm("Supprimer ce chapitre et tous ses contenus ?")) return;
    await fetch(`${base}/chapitres/${chapId}`, {method:"DELETE", headers:await authHeaders()});
    charger();
  };

  const saveSec = async (data: {titre:string; contenu?:string} | string, chapId:string, secId?:string) => {
    const titre   = typeof data === "string" ? data : data.titre;
    const contenu = typeof data === "string" ? undefined : data.contenu;
    if (!titre.trim()) return;
    setSaving(true);
    try {
      if (secId) {
        await fetch(`${base}/sections/${secId}`, { method:"PATCH", headers:{"Content-Type":"application/json", ...(await authHeaders())}, body:JSON.stringify({titre, contenu}) });
        setEditSec(null);
      } else {
        await fetch(`${base}/chapitres/${chapId}/sections`, { method:"POST", headers:{"Content-Type":"application/json", ...(await authHeaders())}, body:JSON.stringify({numero:nextSecNum(chapId), titre, contenu}) });
        setNewSecForm(null);
      }
      charger();
    } finally { setSaving(false); }
  };

  const delSec = async (secId:string) => {
    if (!confirm("Supprimer cette section ?")) return;
    await fetch(`${base}/sections/${secId}`, {method:"DELETE", headers:await authHeaders()});
    charger();
  };

  const saveArt = async (data:any, chapId:string, artId?:string) => {
    setSaving(true);
    try {
      if (artId) {
        await fetch(`${base}/articles/${artId}`, { method:"PATCH", headers:{"Content-Type":"application/json", ...(await authHeaders())}, body:JSON.stringify(data) });
        setEditArt(null);
      } else {
        await fetch(`${base}/articles`, { method:"POST", headers:{"Content-Type":"application/json", ...(await authHeaders())}, body:JSON.stringify({...data, chapitre_id:chapId, numero:nextArtNum()}) });
        setNewArtChap(null);
      }
      charger();
    } finally { setSaving(false); }
  };

  const delArt = async (artId:string) => {
    if (!confirm("Supprimer cet article ?")) return;
    await fetch(`${base}/articles/${artId}`, {method:"DELETE", headers:await authHeaders()});
    charger();
  };


  const [pdfTitreEdit, setPdfTitreEdit] = useState(false);
  const [pdfTitreVal,  setPdfTitreVal]  = useState("");

  // Upload PDF
  const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData();
    fd.append("fichier", file);
    fd.append("titre", pdfInfo?.titre || (onglet === "code" ? "Code des investissements du Sénégal" : "Modalités d'application du code des investissements"));
    fd.append("version", pdfInfo?.version || "");
    try {
      const res = await fetch(`${base}/pdf`, {method:"POST", headers:await authHeaders(), body:fd});
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        alert(`Échec du téléversement du PDF (HTTP ${res.status}).\n${txt.slice(0, 300)}`);
        return;
      }
    } catch (err: any) {
      alert(`Échec du téléversement du PDF : ${err?.message || err}`);
      return;
    } finally {
      e.target.value = "";
    }
    charger();
  };

  const savePdfTitre = async () => {
    if (!pdfTitreVal.trim() || !pdfInfo) return;
    setSaving(true);
    try {
      await fetch(`${base}/pdf/${pdfInfo.id}`, {
        method: "PATCH",
        headers: {"Content-Type":"application/json", ...(await authHeaders())},
        body: JSON.stringify({titre: pdfTitreVal}),
      });
      setPdfTitreEdit(false);
      charger();
    } finally { setSaving(false); }
  };

  // Rendu article
  const renderArticle = (a:any, sections:any[]) => (
    <div key={a.id} style={{ marginBottom:6 }}>
      {editArt === a.id ? (
        <ArticleEditor art={a} sections={sections}
          onSave={(data:any)=>saveArt(data, a.chapitre_id, a.id)}
          onCancel={()=>setEditArt(null)} saving={saving} />
      ) : (
        <div style={{ background:"#fff", borderRadius:9, border:"1px solid #E8E5E3", padding:"10px 14px", display:"flex", alignItems:"flex-start", gap:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#1a1a2e", marginBottom:a.contenu?4:0 }}>
              <span style={{ color:"#ca631f" }}>Article {a.num_display}</span>
              {a.titre && <span> — {a.titre}</span>}
            </div>
            {a.contenu && (
              <div data-rte style={{ fontSize:12, color:"#4a5568", lineHeight:1.6 }}
                dangerouslySetInnerHTML={{ __html: a.contenu }} />
            )}
          </div>
          <div style={{ display:"flex", gap:4, flexShrink:0 }}>
            <button onClick={()=>setEditArt(a.id)} style={{ background:"rgba(202,99,31,0.08)", border:"none", cursor:"pointer", borderRadius:6, padding:"4px 7px" }}><Pencil size={11} style={{color:"#ca631f"}} /></button>
            <button onClick={()=>delArt(a.id)} style={{ background:"rgba(220,38,38,0.08)", border:"none", cursor:"pointer", borderRadius:6, padding:"4px 7px" }}><Trash2 size={11} style={{color:"#dc2626"}} /></button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding:"36px 40px 80px", fontFamily:"var(--font-google-sans)" }}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        [data-rte] ul{padding-left:20px;list-style-type:disc}
        [data-rte] ul.dash-list{list-style-type:"— ";padding-left:22px}
        [data-rte] ol{padding-left:20px;list-style-type:decimal}
        [data-rte] li{margin-bottom:2px}
        [data-rte] p{margin:2px 0}
        [data-rte] *{font-family:var(--font-google-sans)!important;font-size:12px!important}
      `}</style>

      {/* Onglets */}
      <div style={{ display:"flex", gap:4, marginBottom:28, borderBottom:"2px solid #E8E5E3", paddingBottom:0 }}>
        {(["code","modalites"] as const).map(o => {
          const label = o === "code" ? "Code des investissements" : "Modalités d'application";
          const active = onglet === o;
          return (
            <button key={o} onClick={()=>setOnglet(o)}
              style={{ padding:"10px 22px", border:"none", background:"none", cursor:"pointer", fontSize:13, fontWeight:active?700:500,
                color: active?"#ca631f":"#9aa5b4", borderBottom: active?"2px solid #ca631f":"2px solid transparent",
                marginBottom:-2, borderRadius:"6px 6px 0 0", fontFamily:"var(--font-google-sans)", transition:"color 0.15s" }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:4 }}>Administration</p>
          <h1 style={{ fontWeight:800, fontSize:"1.75rem", color:"#1a1a2e" }}>
            {onglet === "code" ? "Code des investissements" : "Modalités d'application"}
          </h1>
          <p style={{ color:"#9aa5b4", fontSize:13, marginTop:4 }}>
            {chapitres.length} chapitre{chapitres.length>1?"s":""} ·{" "}
            {chapitres.reduce((a,c)=>(a + (c.articles?.length||0) + c.sections?.reduce((b:number,s:any)=>b+(s.articles?.length||0),0)),0)} articles
          </p>
        </div>
        {/* PDF */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
          {pdfInfo && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {pdfTitreEdit ? (
                <>
                  <input value={pdfTitreVal} onChange={e=>setPdfTitreVal(e.target.value)}
                    style={{...IS, width:260, fontSize:12}} autoFocus
                    onKeyDown={e=>{ if(e.key==="Enter") savePdfTitre(); if(e.key==="Escape") setPdfTitreEdit(false); }} />
                  <button onClick={savePdfTitre} disabled={saving} style={{ background:"#ca631f", border:"none", color:"#fff", borderRadius:7, padding:"7px 12px", cursor:"pointer", fontSize:12, fontWeight:700 }}>
                    {saving ? <Loader2 size={12} style={{animation:"spin 1s linear infinite"}} /> : <Check size={12} />}
                  </button>
                  <button onClick={()=>setPdfTitreEdit(false)} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:7, padding:"7px 9px" }}><X size={12} color="#4a5568" /></button>
                </>
              ) : (
                <button onClick={()=>{ setPdfTitreVal(pdfInfo.titre||""); setPdfTitreEdit(true); }}
                  style={{ display:"flex", alignItems:"center", gap:5, background:"none", border:"1px dashed #C5BFBB", cursor:"pointer", borderRadius:7, padding:"5px 10px", fontSize:12, color:"#9aa5b4" }}>
                  <Pencil size={11} /> {pdfInfo.titre || "Code des investissements"}
                </button>
              )}
              <a href={`${base}/pdf/download?v=${pdfInfo.id}`} target="_blank" rel="noopener noreferrer"
                style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(202,99,31,0.08)", border:"1px solid rgba(202,99,31,0.2)", borderRadius:9, padding:"8px 14px", fontSize:12, color:"#ca631f", fontWeight:600, textDecoration:"none" }}>
                <FileText size={13} /> Télécharger
              </a>
            </div>
          )}
          <label style={{ display:"flex", alignItems:"center", gap:6, background:"#ca631f", border:"none", cursor:"pointer", borderRadius:10, padding:"10px 18px", fontSize:13, fontWeight:700, color:"#fff" }}>
            <Upload size={14} /> {pdfInfo ? "Remplacer le PDF" : "Uploader le PDF"}
            <input type="file" accept=".pdf" style={{display:"none"}} onChange={handlePdf} />
          </label>
        </div>
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}>
          <Loader2 size={28} style={{ color:"#9aa5b4", animation:"spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {chapitres.map(c => {
            const isOpen = expandedChap === c.id;
            const allArts = [
              ...c.articles,
              ...c.sections.flatMap((s:any)=>s.articles),
            ].sort((a:any,b:any)=>a.numero-b.numero);

            return (
              <div key={c.id} style={{ background:"#fff", border:"1px solid #C5BFBB", borderLeft:"4px solid #ca631f", borderRadius:14, overflow:"hidden" }}>
                {/* Header chapitre */}
                <div onClick={()=>setExpandedChap(isOpen?null:c.id)}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 20px", cursor:"pointer", background:isOpen?"rgba(202,99,31,0.03)":"#fff" }}>
                  <div style={{ width:36, height:36, borderRadius:9, background:"rgba(202,99,31,0.1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <BookOpen size={16} style={{color:"#ca631f"}} />
                  </div>
                  {editChap === c.id ? (
                    <div style={{flex:1}} onClick={e=>e.stopPropagation()}>
                      <TitreContenuForm initialTitre={c.titre} initialContenu={c.contenu} label="Modifier" saving={saving}
                        onSave={(data:any)=>saveChap(data,c.id)} onCancel={()=>setEditChap(null)} />
                    </div>
                  ) : (
                    <div style={{flex:1}}>
                      <div style={{ fontWeight:700, fontSize:14, color:"#1a1a2e" }}>
                        Chapitre {c.num_display} — {c.titre}
                      </div>
                      <div style={{ fontSize:12, color:"#9aa5b4", marginTop:2 }}>
                        {c.sections.length} section{c.sections.length>1?"s":""} · {allArts.length} article{allArts.length>1?"s":""}
                      </div>
                    </div>
                  )}
                  {editChap !== c.id && (
                    <div style={{display:"flex",gap:5,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>setEditChap(c.id)} style={{background:"rgba(202,99,31,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"5px 8px"}}><Pencil size={12} style={{color:"#ca631f"}} /></button>
                      <button onClick={()=>delChap(c.id)} style={{background:"rgba(220,38,38,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"5px 8px"}}><Trash2 size={12} style={{color:"#dc2626"}} /></button>
                    </div>
                  )}
                  {isOpen ? <ChevronDown size={16} style={{color:"#9aa5b4",flexShrink:0}} /> : <ChevronRight size={16} style={{color:"#9aa5b4",flexShrink:0}} />}
                </div>

                {/* Contenu chapitre */}
                {isOpen && (
                  <div style={{ padding:"0 20px 16px", borderTop:"1px solid #F2F0EF" }}>

                    {/* Sections + leurs articles */}
                    {c.sections.map((s:any) => (
                      <div key={s.id} style={{ marginTop:14 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                          {editSec === s.id ? (
                            <div style={{flex:1}}>
                              <TitreContenuForm initialTitre={s.titre} initialContenu={s.contenu} label="Modifier" saving={saving}
                                onSave={(data:any)=>saveSec(data,c.id,s.id)} onCancel={()=>setEditSec(null)} />
                            </div>
                          ) : (
                            <>
                              <div style={{ flex:1, fontSize:13, fontWeight:700, color:"#004f91" }}>
                                Section {s.num_display} — {s.titre}
                              </div>
                              <button onClick={()=>setEditSec(s.id)} style={{background:"rgba(0,79,145,0.08)",border:"none",cursor:"pointer",borderRadius:6,padding:"4px 7px"}}><Pencil size={11} style={{color:"#004f91"}} /></button>
                              <button onClick={()=>delSec(s.id)} style={{background:"rgba(220,38,38,0.08)",border:"none",cursor:"pointer",borderRadius:6,padding:"4px 7px"}}><Trash2 size={11} style={{color:"#dc2626"}} /></button>
                            </>
                          )}
                        </div>
                        {/* Texte introductif de la section */}
                        {s.contenu && (
                          <div data-rte style={{ fontSize:12, color:"#4a5568", lineHeight:1.7, marginBottom:8, padding:"8px 12px", background:"rgba(0,79,145,0.03)", borderLeft:"3px solid rgba(0,79,145,0.2)", borderRadius:"0 6px 6px 0" }}
                            dangerouslySetInnerHTML={{ __html: s.contenu }} />
                        )}
                        {s.articles.map((a:any) => renderArticle(a, c.sections))}
                      </div>
                    ))}

                    {/* Articles directs (sans section) */}
                    {c.articles.length > 0 && (
                      <div style={{ marginTop:14 }}>
                        {c.sections.length > 0 && <div style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>Articles directs</div>}
                        {c.articles.map((a:any) => renderArticle(a, c.sections))}
                      </div>
                    )}

                    {/* Formulaire nouvel article */}
                    {newArtChap === c.id && (
                      <div style={{ marginTop:12 }}>
                        <ArticleEditor sections={c.sections}
                          onSave={(data:any)=>saveArt(data,c.id)} onCancel={()=>setNewArtChap(null)} saving={saving} />
                      </div>
                    )}

                    {/* Formulaire nouvelle section */}
                    {newSecForm === c.id && (
                      <div style={{ marginTop:12 }}>
                        <TitreContenuForm label="Créer" saving={saving} placeholder="Titre de la section…"
                          onSave={(data:any)=>saveSec(data,c.id)} onCancel={()=>setNewSecForm(null)} />
                      </div>
                    )}

                    {/* Boutons ajout */}
                    <div style={{ display:"flex", gap:8, marginTop:14 }}>
                      {newArtChap !== c.id && (
                        <button onClick={()=>{ setNewArtChap(c.id); setNewSecForm(null); }}
                          style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:8, border:"2px dashed #C5BFBB", background:"transparent", color:"#9aa5b4", fontSize:12, fontWeight:600, cursor:"pointer" }}
                          onMouseEnter={e=>{ e.currentTarget.style.borderColor="#ca631f"; e.currentTarget.style.color="#ca631f"; }}
                          onMouseLeave={e=>{ e.currentTarget.style.borderColor="#C5BFBB"; e.currentTarget.style.color="#9aa5b4"; }}>
                          <Plus size={12} /> Article
                        </button>
                      )}
                      {newSecForm !== c.id && (
                        <button onClick={()=>{ setNewSecForm(c.id); setNewArtChap(null); }}
                          style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:8, border:"2px dashed #C5BFBB", background:"transparent", color:"#9aa5b4", fontSize:12, fontWeight:600, cursor:"pointer" }}
                          onMouseEnter={e=>{ e.currentTarget.style.borderColor="#004f91"; e.currentTarget.style.color="#004f91"; }}
                          onMouseLeave={e=>{ e.currentTarget.style.borderColor="#C5BFBB"; e.currentTarget.style.color="#9aa5b4"; }}>
                          <Plus size={12} /> Section
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Nouveau chapitre */}
          {newChapForm ? (
            <div style={{ background:"#fff", border:"1px solid rgba(202,99,31,0.3)", borderRadius:14, padding:"16px 20px" }}>
              <p style={{ fontSize:12, fontWeight:700, color:"#ca631f", marginBottom:10 }}>Nouveau Chapitre {toRoman(nextChapNum())}</p>
              <TitreContenuForm label="Créer" saving={saving} placeholder="Titre du chapitre…"
                onSave={(data:any)=>saveChap(data)} onCancel={()=>setNewChapForm(false)} />
            </div>
          ) : (
            <button onClick={()=>setNewChapForm(true)}
              style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"14px 20px", borderRadius:14, border:"2px dashed #C5BFBB", background:"transparent", color:"#9aa5b4", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor="#ca631f"; e.currentTarget.style.color="#ca631f"; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor="#C5BFBB"; e.currentTarget.style.color="#9aa5b4"; }}>
              <Plus size={15} /> Ajouter un chapitre
            </button>
          )}
        </div>
      )}
    </div>
  );
}
