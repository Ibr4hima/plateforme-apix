"use client";

import Navbar from "@/components/layout/Navbar";
import { useEffect, useState } from "react";
import { ChevronRight, X, CheckCircle2, Circle, Clock, AlertTriangle, Loader2, Plus, Pencil, Check, Trash2, CalendarDays, Timer } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const IS: any = { background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any = { fontSize:12, fontWeight:600, color:"#4a5568", marginBottom:5, display:"block" };

const STATUTS: Record<string,{label:string; color:string; bg:string}> = {
  non_demarre: { label:"Non démarré",  color:"#9aa5b4", bg:"rgba(154,165,180,0.1)" },
  attribue:    { label:"Attribué",     color:"#ca631f", bg:"rgba(202,99,31,0.1)" },
  en_cours:    { label:"En cours",     color:"#188038", bg:"rgba(24,128,56,0.1)" },
  en_retard:   { label:"En retard",    color:"#dc2626", bg:"rgba(220,38,38,0.1)" },
  livre:       { label:"Livré",        color:"#188038", bg:"rgba(24,128,56,0.1)" },
};

function fmtDate(d: string|null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("fr-FR", { day:"numeric", month:"short", year:"numeric" });
}

function JoursRestants({ jours, retard }: { jours:number|null; retard:boolean }) {
  if (jours === null) return null;
  const abs = Math.abs(jours);
  const color = retard ? "#dc2626" : jours < 30 ? "#ca631f" : "#188038";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:10, background:color+"10", border:`1px solid ${color}22` }}>
      <Timer size={14} style={{ color, flexShrink:0 }} />
      <span style={{ fontSize:13, fontWeight:700, color }}>
        {retard ? `${abs} jour${abs>1?"s":""} de retard` : `${abs} jour${abs>1?"s":""} restant${abs>1?"s":""}`}
      </span>
    </div>
  );
}

// ── Modal suivi projet ────────────────────────────────────────────────────────
function ProjetSuiviModal({ projet, suivi, onClose, onRefresh, isAdmin }: any) {
  const [addForm,  setAddForm]  = useState<any>(null);
  const [editId,   setEditId]   = useState<number|null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving,   setSaving]   = useState(false);

  const statut = STATUTS[suivi?.statut || "non_demarre"] || STATUTS.non_demarre;
  const phases: any[] = suivi?.phases || [];
  const dernierePhase = phases[phases.length - 1];

  const addPhase = async () => {
    if (!addForm?.titre?.trim() || !addForm?.date_debut) return;
    setSaving(true);
    try {
      await fetch(`${API}/suivi-projets/${projet.id}/phases`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify(addForm)
      });
      setAddForm(null); onRefresh();
    } finally { setSaving(false); }
  };

  const updatePhase = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/suivi-projets/phases/${editId}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ note: editForm.note })
      });
      setEditId(null); onRefresh();
    } finally { setSaving(false); }
  };

  const deletePhase = async (id:number) => {
    if (!confirm("Supprimer cette phase ? (Seule la dernière phase peut être supprimée)")) return;
    const res = await fetch(`${API}/suivi-projets/phases/${id}`, { method:"DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(()=>({}));
      alert(d.detail || "Suppression impossible");
      return;
    }
    onRefresh();
  };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(8px)", zIndex:400, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"40px 24px", overflowY:"auto" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:760, border:"1px solid #E8E5E3", boxShadow:"0 32px 80px rgba(0,0,0,0.25)", overflow:"hidden", marginBottom:40 }}>
        <div style={{ height:5, background:"linear-gradient(90deg,#ca631f,#FFB0A1,#004f91)" }} />
        <div style={{ padding:"24px 28px 28px", overflowY:"auto" as const, maxHeight:"calc(90vh - 5px)" }}>

          {/* Header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div style={{ flex:1, paddingRight:16 }}>
              <h2 style={{ fontWeight:800, fontSize:"1.2rem", color:"#1a1a2e", lineHeight:1.3, marginBottom:8 }}>{projet.titre_projet}</h2>
              <div style={{ display:"flex", gap:7, flexWrap:"wrap" as const }}>
                <span style={{ fontSize:11, fontWeight:700, color:statut.color, background:statut.bg, border:`1px solid ${statut.color}33`, padding:"2px 9px", borderRadius:999 }}>{statut.label}</span>
                {suivi?.est_en_retard && <span style={{ fontSize:11, fontWeight:700, color:"#dc2626", background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.2)", padding:"2px 9px", borderRadius:999, display:"flex", alignItems:"center", gap:4 }}><AlertTriangle size={10}/> En retard</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7, flexShrink:0 }}><X size={14} color="#4a5568" /></button>
          </div>

          {/* Cards infos temporelles */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            {suivi?.date_attribution && (
              <div style={{ background:"rgba(202,99,31,0.05)", borderRadius:10, padding:"12px 14px" }}>
                <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:5 }}>Date d'attribution</p>
                <p style={{ fontSize:13, fontWeight:600, color:"#1a1a2e" }}>{fmtDate(suivi.date_attribution)}</p>
              </div>
            )}
            {suivi?.date_fin_prevue && (
              <div style={{ background:"rgba(0,79,145,0.05)", borderRadius:10, padding:"12px 14px" }}>
                <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:5 }}>Échéance</p>
                <p style={{ fontSize:13, fontWeight:600, color:"#1a1a2e" }}>{fmtDate(suivi.date_fin_prevue)}</p>
              </div>
            )}
            {projet.region_nom && (
              <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}>
                <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:5 }}>Région</p>
                <p style={{ fontSize:13, fontWeight:600, color:"#1a1a2e" }}>Région de {projet.region_nom}</p>
              </div>
            )}
            {suivi?.jours_restants !== null && (
              <div style={{ background: suivi.est_en_retard ? "rgba(220,38,38,0.05)" : Math.abs(suivi.jours_restants)<30 ? "rgba(202,99,31,0.05)" : "rgba(24,128,56,0.05)", borderRadius:10, padding:"12px 14px" }}>
                <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:5 }}>Délai</p>
                <p style={{ fontSize:13, fontWeight:700, color: suivi.est_en_retard ? "#dc2626" : Math.abs(suivi.jours_restants)<30 ? "#ca631f" : "#188038" }}>
                  {suivi.est_en_retard
                    ? `${Math.abs(suivi.jours_restants)} jour${Math.abs(suivi.jours_restants)>1?"s":""} de retard`
                    : `${suivi.jours_restants} jour${suivi.jours_restants>1?"s":""} restants`}
                </p>
              </div>
            )}
          </div>

          {projet.description && (
            <div style={{ background:"rgba(202,99,31,0.04)", border:"1px solid rgba(202,99,31,0.1)", borderRadius:10, padding:"12px 14px", marginBottom:20 }}>
              <p style={{ fontSize:13, color:"#4a5568", lineHeight:1.7 }}>{projet.description}</p>
            </div>
          )}

          {/* Timeline phases */}
          <div style={{ marginBottom:20 }}>
            <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:16 }}>
              Phases du projet ({phases.length})
            </p>

            {phases.length === 0 && (
              <div style={{ textAlign:"center" as const, padding:"32px 0", color:"#C5BFBB", border:"2px dashed #E8E5E3", borderRadius:12 }}>
                <p style={{ fontSize:13 }}>Aucune phase renseignée</p>
                {isAdmin && <p style={{ fontSize:12, marginTop:4 }}>Ajoutez la première phase ci-dessous</p>}
              </div>
            )}

            <div style={{ position:"relative" as const }}>
              {/* Ligne verticale */}
              {phases.length > 0 && (
                <div style={{ position:"absolute" as const, left:15, top:20, bottom:20, width:2, background:"linear-gradient(180deg,#ca631f,#004f91)", opacity:0.2, zIndex:0 }} />
              )}

              {phases.map((ph:any, i:number) => {
                const isLast    = i === phases.length - 1;
                const isDone    = !!ph.date_fin;
                const isEditing = editId === ph.id;
                const color     = isDone ? "#188038" : isLast ? "#004f91" : "#9aa5b4";

                return (
                  <div key={ph.id} style={{ display:"flex", gap:16, marginBottom:16, position:"relative" as const, zIndex:1 }}>
                    {/* Icône */}
                    <div style={{ flexShrink:0, width:32, height:32, borderRadius:"50%", background:color+"18", border:`2px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", marginTop:4 }}>
                      {isDone ? <CheckCircle2 size={14} style={{color}} /> : isLast ? <Clock size={14} style={{color}} /> : <Circle size={14} style={{color}} />}
                    </div>

                    <div style={{ flex:1 }}>
                      {isEditing && isAdmin ? (
                        <div style={{ background:"#F8F7F6", borderRadius:12, padding:"14px 16px", border:"1px solid #E8E5E3" }}>
                          <div style={{ marginBottom:10 }}>
                            <label style={LS}>Note / Observation</label>
                            <textarea value={editForm.note||""} onChange={e=>setEditForm((f:any)=>({...f,note:e.target.value}))} rows={3} style={{...IS,resize:"vertical" as const}} placeholder="Observations, points d'attention…" autoFocus />
                            <p style={{ fontSize:11, color:"#9aa5b4", marginTop:4 }}>Seule la note peut être modifiée après création d'une phase.</p>
                          </div>
                          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                            <button onClick={()=>setEditId(null)} style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #C5BFBB", background:"transparent", color:"#4a5568", cursor:"pointer", fontSize:12 }}>Annuler</button>
                            <button onClick={updatePhase} disabled={saving} style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 14px", borderRadius:8, border:"none", background:"#004f91", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>
                              {saving ? <Loader2 size={12} style={{animation:"spin 1s linear infinite"}} /> : <Check size={12} />} Enregistrer
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ background:"#fff", borderRadius:12, padding:"14px 16px", border:`1px solid ${color}22`, borderLeft:`3px solid ${color}` }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:14, fontWeight:700, color:"#1a1a2e", marginBottom:6 }}>
                                <span style={{ fontSize:11, fontWeight:600, color, marginRight:8 }}>Phase {ph.ordre}</span>
                                {ph.titre}
                              </div>
                              <div style={{ display:"flex", gap:16, flexWrap:"wrap" as const }}>
                                <span style={{ fontSize:12, color:"#9aa5b4", display:"flex", alignItems:"center", gap:4 }}>
                                  <CalendarDays size={11}/> Début : <strong style={{color:"#4a5568"}}>{fmtDate(ph.date_debut)}</strong>
                                </span>
                                {ph.date_fin && (
                                  <span style={{ fontSize:12, color:"#188038", display:"flex", alignItems:"center", gap:4 }}>
                                    <CheckCircle2 size={11}/> Fin : <strong>{fmtDate(ph.date_fin)}</strong>
                                  </span>
                                )}
                                {!ph.date_fin && isLast && (
                                  <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:999 }}>En cours</span>
                                )}
                              </div>
                              {ph.note && <p style={{ fontSize:12, color:"#4a5568", marginTop:8, lineHeight:1.6, fontStyle:"italic" }}>💬 {ph.note}</p>}
                            </div>
                            {isAdmin && (
                              <div style={{ display:"flex", gap:5, flexShrink:0, marginLeft:10 }}>
                                <button onClick={()=>{ setEditId(ph.id); setEditForm({note:ph.note||""}); }}
                                  title="Modifier la note"
                                  style={{ background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:7, padding:"5px 8px" }}><Pencil size={12} style={{color:"#004f91"}} /></button>
                                {isLast && (
                                  <button onClick={()=>deletePhase(ph.id)}
                                    title="Supprimer (dernière phase uniquement)"
                                    style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:7, padding:"5px 8px" }}><Trash2 size={12} style={{color:"#dc2626"}} /></button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Formulaire nouvelle phase */}
              {isAdmin && (
                <div style={{ display:"flex", gap:16, position:"relative" as const, zIndex:1 }}>
                  <div style={{ flexShrink:0, width:32, height:32, borderRadius:"50%", background:"rgba(202,99,31,0.08)", border:"2px dashed #C5BFBB", display:"flex", alignItems:"center", justifyContent:"center", marginTop:4 }}>
                    <Plus size={14} style={{color:"#C5BFBB"}} />
                  </div>
                  <div style={{ flex:1 }}>
                    {addForm ? (
                      <div style={{ background:"#F8F7F6", borderRadius:12, padding:"14px 16px", border:"1px solid rgba(202,99,31,0.2)" }}>
                        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10, marginBottom:10 }}>
                          <div><label style={LS}>Titre de la phase *</label><input value={addForm.titre} onChange={e=>setAddForm((f:any)=>({...f,titre:e.target.value}))} placeholder="Ex : Démarrage des travaux" style={IS} autoFocus /></div>
                          <div>
                            <label style={LS}>Date de début *</label>
                            <input type="date" value={addForm.date_debut}
                              onChange={e=>setAddForm((f:any)=>({...f,date_debut:e.target.value}))}
                              style={IS}
                              defaultValue={dernierePhase?.date_fin || ""}
                            />
                          </div>
                        </div>
                        <div style={{ marginBottom:10 }}><label style={LS}>Note (optionnel)</label><textarea value={addForm.note||""} onChange={e=>setAddForm((f:any)=>({...f,note:e.target.value}))} rows={2} style={{...IS,resize:"vertical" as const}} placeholder="Contexte, observations…" /></div>
                        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                          <button onClick={()=>setAddForm(null)} style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #C5BFBB", background:"transparent", color:"#4a5568", cursor:"pointer", fontSize:12 }}>Annuler</button>
                          <button onClick={addPhase} disabled={saving||!addForm.titre?.trim()||!addForm.date_debut}
                            style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 14px", borderRadius:8, border:"none", background:"#ca631f", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700, opacity:(!addForm.titre?.trim()||!addForm.date_debut)?0.5:1 }}>
                            {saving ? <Loader2 size={12} style={{animation:"spin 1s linear infinite"}} /> : <Check size={12} />} Ajouter la phase
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={()=>setAddForm({ titre:"", date_debut: dernierePhase?.date_fin || new Date().toISOString().slice(0,10), note:"" })}
                        style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:10, border:"1.5px dashed #C5BFBB", background:"transparent", color:"#9aa5b4", fontSize:12, fontWeight:600, cursor:"pointer", marginTop:4 }}
                        onMouseEnter={e=>{ e.currentTarget.style.borderColor="#ca631f"; e.currentTarget.style.color="#ca631f"; }}
                        onMouseLeave={e=>{ e.currentTarget.style.borderColor="#C5BFBB"; e.currentTarget.style.color="#9aa5b4"; }}>
                        <Plus size={13} /> Nouvelle phase
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"flex-end", paddingTop:20, borderTop:"1px solid #F2F0EF" }}>
            <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid #C5BFBB", background:"transparent", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13 }}>Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function SuiviProjetsPage() {
  const [projets,  setProjets]  = useState<any[]>([]);
  const [suivis,   setSuivis]   = useState<Record<number,any>>({});
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [suiviSel, setSuiviSel] = useState<any>(null);
  const [isAdmin,  setIsAdmin]  = useState(false);

  const charger = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/projets?per_page=100&publies=true`);
      const data = await res.json();
      const ps   = data.data || [];
      setProjets(ps);
      const results = await Promise.allSettled(
        ps.map((p:any) => fetch(`${API}/suivi-projets/${p.id}`).then(r=>r.json()))
      );
      const map: Record<number,any> = {};
      results.forEach((r,i) => { if (r.status==="fulfilled") map[ps[i].id] = r.value; });
      setSuivis(map);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ charger(); },[]);

  const openProjet = async (p:any) => {
    setSelected(p);
    const res = await fetch(`${API}/suivi-projets/${p.id}`);
    setSuiviSel(await res.json());
  };

  const refreshSuivi = async () => {
    if (!selected) return;
    const res = await fetch(`${API}/suivi-projets/${selected.id}`);
    const data = await res.json();
    setSuiviSel(data);
    setSuivis(prev=>({...prev,[selected.id]:data}));
  };

  const stats = {
    total:     projets.length,
    en_cours:  Object.values(suivis).filter((s:any)=>s?.statut==="en_cours").length,
    livre:     Object.values(suivis).filter((s:any)=>s?.statut==="livre").length,
    en_retard: Object.values(suivis).filter((s:any)=>s?.est_en_retard).length,
    attribue:  Object.values(suivis).filter((s:any)=>s?.statut==="attribue").length,
  };

  return (
    <main style={{ minHeight:"100vh", background:"#F2F0EF", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Navbar />

      {/* Hero */}
      <section style={{ padding:"100px 40px 40px", background:"linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", position:"relative" as const, overflow:"hidden" }}>
        <div style={{ position:"absolute" as const, inset:0, pointerEvents:"none" }}>
          <div style={{ position:"absolute" as const, bottom:"-20%", left:"-5%", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle,rgba(255,255,255,0.05) 0%,transparent 65%)" }} />
        </div>
        <div style={{ maxWidth:1280, margin:"0 auto", position:"relative" as const, zIndex:1 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(202,99,31,0.1)", border:"1px solid rgba(202,99,31,0.25)", borderRadius:999, padding:"6px 14px", marginBottom:17 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#D96D3B", letterSpacing:"0.15em", textTransform:"uppercase" as const }}>Plateforme de Gestion des Investissements et des Investisseurs</span>
          </div>
          <h1 style={{ fontWeight:800, fontSize:"clamp(2.2rem,4vw,3.2rem)", color:"#fff", lineHeight:1.1, marginBottom:16 }}>Suivi des Projets</h1>
          <p style={{ color:"rgba(255,255,255,0.45)", fontSize:15, maxWidth:540, lineHeight:1.7, marginBottom:24 }}>État d'avancement des projets d'investissement — phases, délais et alertes en temps réel.</p>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" as const }}>
            {stats.total>0     && <span style={{ fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",padding:"6px 14px",borderRadius:999,backdropFilter:"blur(10px)" }}>{stats.total} projet{stats.total>1?"s":""}</span>}
            {stats.en_cours>0  && <span style={{ fontSize:13,fontWeight:700,color:"#fff",background:"rgba(24,128,56,0.18)",border:"1px solid rgba(24,128,56,0.35)",padding:"6px 14px",borderRadius:999,backdropFilter:"blur(10px)" }}>{stats.en_cours} en cours</span>}
            {stats.attribue>0  && <span style={{ fontSize:13,fontWeight:700,color:"#fff",background:"rgba(202,99,31,0.18)",border:"1px solid rgba(202,99,31,0.35)",padding:"6px 14px",borderRadius:999,backdropFilter:"blur(10px)" }}>{stats.attribue} attribué{stats.attribue>1?"s":""}</span>}
            {stats.livre>0     && <span style={{ fontSize:13,fontWeight:700,color:"#fff",background:"rgba(0,79,145,0.25)",border:"1px solid rgba(0,79,145,0.4)",padding:"6px 14px",borderRadius:999,backdropFilter:"blur(10px)" }}>{stats.livre} livré{stats.livre>1?"s":""}</span>}
            {stats.en_retard>0 && <span style={{ fontSize:13,fontWeight:700,color:"#fff",background:"rgba(220,38,38,0.25)",border:"1px solid rgba(220,38,38,0.4)",padding:"6px 14px",borderRadius:999,backdropFilter:"blur(10px)" }}>{stats.en_retard} en retard</span>}
          </div>
        </div>
      </section>

      <section style={{ padding:"36px 40px 80px", maxWidth:1280, margin:"0 auto" }}>
        {/* Toggle mode coordinateur */}
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:20 }}>
          <button onClick={()=>setIsAdmin(o=>!o)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:10, border:`1.5px solid ${isAdmin?"#ca631f":"#C5BFBB"}`, background:isAdmin?"rgba(202,99,31,0.08)":"transparent", color:isAdmin?"#ca631f":"#9aa5b4", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>
            ✏️ {isAdmin ? "Mode coordinateur actif — Cliquer pour désactiver" : "Accès coordinateur"}
          </button>
        </div>

        {loading ? (
          <div style={{ display:"flex", justifyContent:"center", padding:80 }}>
            <Loader2 size={28} style={{ color:"#9aa5b4", animation:"spin 1s linear infinite" }} />
          </div>
        ) : projets.length===0 ? (
          <div style={{ textAlign:"center" as const, padding:"80px 0", color:"#9aa5b4" }}>
            <p style={{ fontSize:16, fontWeight:600 }}>Aucun projet disponible</p>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:14 }}>
            {projets.map(p => {
              const suivi  = suivis[p.id];
              const statut = STATUTS[suivi?.statut || "non_demarre"];
              const retard = suivi?.est_en_retard;
              const phases: any[] = suivi?.phases || [];
              const jours  = suivi?.jours_restants;

              return (
                <div key={p.id} onClick={()=>openProjet(p)}
                  style={{ background:"#fff", borderRadius:14, border:"1px solid #E8E5E3", borderLeft:`4px solid ${retard?"#dc2626":statut.color}`, padding:"18px 20px", cursor:"pointer", transition:"all 0.15s", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}
                  onMouseEnter={ev=>{ ev.currentTarget.style.boxShadow=`0 6px 20px ${statut.color}22`; ev.currentTarget.style.transform="translateY(-2px)"; }}
                  onMouseLeave={ev=>{ ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)"; ev.currentTarget.style.transform="translateY(0)"; }}>

                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                    <div style={{ flex:1, paddingRight:10 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:"#1a1a2e", lineHeight:1.35, marginBottom:4, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as const }}>{p.titre_projet}</div>
                      {p.region_nom && <div style={{ fontSize:11, color:"#9aa5b4" }}>Région de {p.region_nom}</div>}
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, color:retard?"#dc2626":statut.color, background:retard?"rgba(220,38,38,0.1)":statut.bg, border:`1px solid ${retard?"#dc262633":statut.color+"33"}`, padding:"3px 8px", borderRadius:999, flexShrink:0, whiteSpace:"nowrap" as const }}>
                      {retard ? "⚠ En retard" : statut.label}
                    </span>
                  </div>

                  {/* Timeline mini */}
                  {phases.length > 0 ? (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ display:"flex", gap:3, alignItems:"center", marginBottom:6 }}>
                        {phases.map((ph:any, i:number) => (
                          <div key={ph.id} style={{ flex:1, display:"flex", flexDirection:"column" as const, alignItems:"center", gap:3 }}>
                            <div style={{ width:"100%", height:4, borderRadius:999, background: ph.date_fin ? "#188038" : i===phases.length-1 ? "#004f91" : "#E8E5E3" }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize:11, color:"#9aa5b4" }}>
                        En cours : <strong style={{color:"#188038"}}>{phases[phases.length-1]?.titre}</strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize:11, color:"#C5BFBB", marginBottom:10 }}>Aucune phase renseignée</div>
                  )}

                  {/* Délai */}
                  {jours !== null && (
                    <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, marginBottom:10 }}>
                      <Timer size={11} style={{color: retard?"#dc2626": jours<30?"#ca631f":"#188038"}} />
                      <span style={{ fontWeight:600, color: retard?"#dc2626": jours<30?"#ca631f":"#188038" }}>
                        {retard ? `${Math.abs(jours)} jour${Math.abs(jours)>1?"s":""} de retard` : `${jours} jour${jours>1?"s":""} restants`}
                      </span>
                      {suivi?.date_fin_prevue && <span style={{color:"#9aa5b4"}}>· Échéance {fmtDate(suivi.date_fin_prevue)}</span>}
                    </div>
                  )}

                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", borderTop:"1px solid #F2F0EF", paddingTop:10 }}>
                    <span style={{ fontSize:11, color:"#9aa5b4" }}>{phases.length} phase{phases.length>1?"s":""}</span>
                    <span style={{ fontSize:11, color:"#004f91", fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>Voir le suivi <ChevronRight size={11}/></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {selected && suiviSel && (
        <ProjetSuiviModal
          projet={selected} suivi={suiviSel}
          onClose={()=>{ setSelected(null); setSuiviSel(null); }}
          onRefresh={refreshSuivi}
          isAdmin={isAdmin}
        />
      )}
    </main>
  );
}
