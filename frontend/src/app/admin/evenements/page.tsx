"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2, X, Check, Calendar } from "lucide-react";
import Badge, { BadgeVariant } from "@/components/shared/Badge";
import { api } from "@/lib/api";
import NaemaSelect from "@/components/shared/NaemaSelect";
import RichTextEditor from "@/components/shared/RichTextEditor";
import PaysSelect from "@/components/shared/PaysSelect";
import PaysMultiSelect from "@/components/shared/PaysMultiSelect";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function formatDate(dateStr: string, opts?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("fr-FR", opts ?? { day: "numeric", month: "short", year: "numeric" });
}

function ordinalEdition(n: number): string {
  return n === 1 ? "1ère édition" : `${n}ème édition`;
}

const ROLES_APIX = [
  { value: "Organisateur",    label: "Organisateur"    },
  { value: "Co-organisateur", label: "Co-organisateur" },
  { value: "Participant",     label: "Participant"      },
  { value: "Partenaire",      label: "Partenaire"       },
  { value: "Sponsor",         label: "Sponsor"          },
  { value: "Invité",          label: "Invité"           },
];

const MOIS_VIEW = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const ROLES_APIX_LABELS: Record<string,string> = { "Organisateur":"Organisateur","Co-organisateur":"Co-organisateur","Participant":"Participant","Partenaire":"Partenaire","Sponsor":"Sponsor","Invité":"Invité" };
const ROLE_VARIANT: Record<string, BadgeVariant> = { "Organisateur":"green","Co-organisateur":"yellow","Participant":"orange","Partenaire":"teal","Sponsor":"lavender","Invité":"gray" };

function computeStatut(e: any): "a_venir"|"en_cours"|"termine"|null {
  if (!e.date_debut) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const debut = new Date(e.date_debut+"T00:00:00");
  const fin   = e.date_fin ? new Date(e.date_fin+"T00:00:00") : debut;
  if (debut > today) return "a_venir";
  if (fin   < today) return "termine";
  return "en_cours";
}

function fmtDateFR(d: string) {
  if (!d) return "";
  const [y,m,j] = d.split("-").map(Number);
  return new Date(y,m-1,j).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});
}

const LBL = ({children}:{children:string}) => (
  <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
);

const EMPTY_FORM = {
  nom_event: "", edition: "" as string,
  organisateur: "", role_apix: "", description: "",
  date_unique: true, date_debut: "", date_fin: "",
  pays_hote_id: "" as string | number, pays_hote_nom: "", ville: "",
  secteur_ids: [] as number[], branche_ids: [] as number[], activite_ids: [] as number[],
  pays_invites_ids: [] as number[], pays_invites_noms: "", entreprises_invitees: "",
  est_publie: true,
  est_recurrent: false, frequence_type: "ans", frequence_valeur: "" as string,
  prochain_jour: "", prochain_mois: "", prochain_annee: "", duree_jours: "",
};

// ── Modal événement ───────────────────────────────────────────────────────────
function EvenementModal({ open, onClose, editItem, onSaved }: {
  open: boolean; onClose: () => void; editItem: any; onSaved: () => void;
}) {
  const [form,   setForm]   = useState<any>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [error,  setError]  = useState("");

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      const reconstruct = async () => {
        let pays_invites_noms = "";
        const needPays = editItem.pays_invites_ids?.length;
        if (needPays) {
          const allPays = await fetch(`${API_BASE}/entreprises/ref/pays`).then(r=>r.json()).catch(()=>[]);
          pays_invites_noms = (editItem.pays_invites_ids||[])
            .map((id:number) => allPays.find((p:any)=>p.id===id)?.nom_fr)
            .filter(Boolean).join(", ");
        }
        setForm({
          nom_event:            editItem.nom_event        || "",
          edition:              editItem.edition != null  ? String(editItem.edition) : "",
          organisateur:         editItem.organisateur     || "",
          role_apix:            editItem.role_apix        || "",
          description:          editItem.description      || "",
          date_unique:          editItem.date_debut === editItem.date_fin,
          date_debut:           editItem.date_debut       || "",
          date_fin:             editItem.date_fin         || "",
          pays_hote_id:         editItem.pays_hote_id     || "",
          pays_hote_nom:        editItem.pays_hote_nom    || "",
          ville:                editItem.ville            || "",
          secteur_ids:          editItem.secteur_ids      || [],
          branche_ids:          editItem.branche_ids      || [],
          activite_ids:         editItem.activite_ids     || [],
          pays_invites_ids:     editItem.pays_invites_ids  || [],
          pays_invites_noms,
          entreprises_invitees: editItem.entreprises_invitees || "",
          est_publie:           editItem.est_publie !== false,
          est_recurrent:        editItem.est_recurrent || false,
          frequence_type:       editItem.frequence_type || "ans",
          frequence_valeur:     editItem.frequence_valeur != null ? String(editItem.frequence_valeur) : "",
          prochain_jour:        editItem.prochain_jour  != null ? String(editItem.prochain_jour)  : "",
          prochain_mois:        editItem.prochain_mois  != null ? String(editItem.prochain_mois)  : "",
          prochain_annee:       editItem.prochain_annee != null ? String(editItem.prochain_annee) : "",
          duree_jours:          editItem.duree_jours    != null ? String(editItem.duree_jours)    : "",
        });
      };
      reconstruct().catch(console.error);
    } else {
      setForm({ ...EMPTY_FORM });
    }
    setError(""); setSaveOk(false);
  }, [open, editItem?.id]);

  const handleSave = async () => {
    if (!form.nom_event.trim()) { setError("Le nom est obligatoire"); return; }

    // ── Validation prochain événement ─────────────────────────────
    const today = new Date(); today.setHours(0,0,0,0);
    const pJ = form.prochain_jour   ? parseInt(form.prochain_jour)   : null;
    const pM = form.prochain_mois   ? parseInt(form.prochain_mois)   : null;
    const pA = form.prochain_annee  ? parseInt(form.prochain_annee)  : null;

    if (form.est_recurrent && (pJ || pM || pA)) {
      // Besoin minimum : l'année
      if (!pA) { setError("Veuillez au moins préciser l'année du prochain événement"); return; }

      if (pJ && pM && pA) {
        // Cas 1 : J+M+A complet → doit être >= aujourd'hui
        const prochaineDate = new Date(pA, pM-1, pJ);
        if (prochaineDate < today) { setError("La date du prochain événement doit être >= aujourd'hui"); return; }
      } else if (pM && pA) {
        // Cas 2 : M+A seulement → mois/année >= mois/année actuel
        const todayM = today.getMonth()+1, todayA = today.getFullYear();
        if (pA < todayA || (pA === todayA && pM < todayM)) {
          setError("Le mois/année du prochain événement ne peut pas être dans le passé"); return;
        }
      } else if (pA) {
        // Cas 3 : A seulement → année >= année actuelle
        if (pA < today.getFullYear()) { setError("L'année du prochain événement ne peut pas être dans le passé"); return; }
      }
    }

    // ── Validation dates de l'événement ───────────────────────────
    if (!form.est_recurrent) {
      if (!form.date_debut) { setError("La date est obligatoire"); return; }
      const debut = new Date(form.date_debut + "T00:00:00");
      if (debut < today) { setError("La date de début ne peut pas être dans le passé"); return; }
      if (!form.date_unique && !form.date_fin)                   { setError("La date de fin est obligatoire"); return; }
      if (!form.date_unique && form.date_fin <= form.date_debut) { setError("La date de fin doit être après le début"); return; }
    } else if (form.date_debut) {
      const debut = new Date(form.date_debut + "T00:00:00");
      if (debut < today) { setError("La date de début ne peut pas être dans le passé"); return; }
      if (form.date_fin && !form.date_unique && form.date_fin <= form.date_debut) {
        setError("La date de fin doit être après le début"); return;
      }
    }
    setSaving(true); setError("");
    try {
      // Les IDs sont déjà dans form.secteur_ids / branche_ids / activite_ids
      const secteur_ids  = form.secteur_ids  || [];
      const branche_ids  = form.branche_ids  || [];
      const activite_ids = form.activite_ids || [];
      // Résoudre pays_invites noms → IDs
      let pays_invites_ids: number[] = form.pays_invites_ids || [];
      if (form.pays_invites_noms && !pays_invites_ids.length) {
        const noms = form.pays_invites_noms.split(",").map((s: string) => s.trim()).filter(Boolean);
        const allPays = await fetch(`${API_BASE}/entreprises/ref/pays`).then(r => r.json());
        pays_invites_ids = allPays.filter((p: any) => noms.includes(p.nom_fr)).map((p: any) => p.id);
      }
      const payload: any = {
        nom_event:            form.nom_event,
        edition:              form.edition ? parseInt(form.edition) : null,
        organisateur:         form.organisateur  || null,
        role_apix:            form.role_apix     || null,
        description:          form.description   || null,
        date_debut:           (() => {
          // Si récurrent + prochain complet → date_debut = prochain événement
          if (form.est_recurrent && form.prochain_jour && form.prochain_mois && form.prochain_annee) {
            const d = new Date(parseInt(form.prochain_annee), parseInt(form.prochain_mois)-1, parseInt(form.prochain_jour));
            return d.toISOString().split("T")[0];
          }
          return form.date_debut || null;
        })(),
        date_fin:             (() => {
          // Si récurrent + prochain complet + durée → calculer date_fin
          if (form.est_recurrent && form.prochain_jour && form.prochain_mois && form.prochain_annee && form.duree_jours) {
            const d = new Date(parseInt(form.prochain_annee), parseInt(form.prochain_mois)-1, parseInt(form.prochain_jour));
            d.setDate(d.getDate() + parseInt(form.duree_jours) - 1);
            return d.toISOString().split("T")[0];
          }
          return form.date_unique ? (form.date_debut || null) : (form.date_fin || null);
        })(),
        pays_hote_id:         form.pays_hote_id ? parseInt(String(form.pays_hote_id)) : null,
        ville:                form.ville         || null,
        secteur_ids, branche_ids, activite_ids,
        pays_invites_ids,
        entreprises_invitees: form.entreprises_invitees || null,
        est_publie:           form.est_publie,
        est_recurrent:        form.est_recurrent,
        frequence_type:       form.est_recurrent ? form.frequence_type : null,
        frequence_valeur:     form.est_recurrent && form.frequence_valeur ? parseInt(form.frequence_valeur) : null,
        prochain_jour:    form.est_recurrent && form.prochain_jour   ? parseInt(form.prochain_jour)   : null,
        prochain_mois:    form.est_recurrent && form.prochain_mois   ? parseInt(form.prochain_mois)   : null,
        prochain_annee:   form.est_recurrent && form.prochain_annee  ? parseInt(form.prochain_annee)  : null,
        duree_jours:      (() => {
          // Récurrent + durée explicite
          if (form.est_recurrent && form.duree_jours) return parseInt(form.duree_jours);
          // Récurrent + prochain complet sans durée → null
          if (form.est_recurrent) return null;
          // Ponctuel avec deux dates différentes → calculer la durée
          const deb = form.date_debut?.trim();
          const fin = form.date_fin?.trim();
          if (deb && fin && fin !== deb) {
            const d1 = new Date(deb + "T00:00:00");
            const d2 = new Date(fin + "T00:00:00");
            const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
            return diff > 0 ? diff : 1;
          }
          // Date unique ou date_fin vide → 1 jour
          if (deb) return 1;
          return null;
        })(),
      };
      if (editItem) {
        const res = await fetch(`${API_BASE}/evenements/${editItem.id}`, {
          method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload)
        });
        if (!res.ok) { const d = await res.json(); throw d; }
      } else {
        const res = await fetch(`${API_BASE}/evenements`, {
          method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload)
        });
        if (!res.ok) { const d = await res.json(); throw d; }
      }
      setSaveOk(true);
      setTimeout(() => { onClose(); onSaved(); }, 700);
    } catch (e: any) {
      const msg = e?.detail ? (Array.isArray(e.detail) ? e.detail.map((d:any)=>d.msg||d).join(", ") : String(e.detail)) : (e?.message || "Erreur lors de la sauvegarde");
      setError(msg);
    } finally { setSaving(false); }
  };

  const IS: any = { width:"100%", background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", fontFamily:"var(--font-google-sans)", boxSizing:"border-box" as const };
  const LS: any = { fontSize:12, fontWeight:600, color:"#4a5568", marginBottom:4, display:"block" };
  const SS: any = { fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:12, paddingBottom:8, borderBottom:"1px solid rgba(202,99,31,0.15)" };

  if (!open) return null;
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:760, maxHeight:"92vh", overflowY:"auto", border:"1px solid #C5BFBB", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ height:5, background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)", borderRadius:"20px 20px 0 0" }} />
        <div style={{ padding:"24px 32px 32px" }}>

          {/* Header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
            <h2 style={{ fontWeight:800, fontSize:"1.15rem", color:"#1a1a2e" }}>
              {editItem ? "Modifier l'événement" : "Nouvel événement"}
            </h2>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={15} color="#4a5568" /></button>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

            {/* Nom + Édition */}
            <div>
              <p style={SS}>Identification</p>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12 }}>
                <div>
                  <label style={LS}>Nom de l'événement *</label>
                  <input value={form.nom_event} onChange={e=>update("nom_event",e.target.value)} placeholder="Intitulé de l'événement" style={IS} />
                </div>
                <div>
                  <label style={LS}>Édition <span style={{ fontWeight:400, color:"#9aa5b4" }}>(entier &gt; 0)</span></label>
                  <input type="number" min={1} step={1} value={form.edition}
                    onChange={e=>{ const v=e.target.value; if(v===""||/^[1-9][0-9]*$/.test(v)) update("edition",v); }}
                    onKeyDown={e=>{ if(["e","E","+","-",".",","].includes(e.key)) e.preventDefault(); }}
                    placeholder="Ex : 5"
                    style={{ ...IS, borderColor: form.edition&&(isNaN(parseInt(form.edition))||parseInt(form.edition)<=0)?"#dc2626":"#C5BFBB" }} />
                  {form.edition&&parseInt(form.edition)>0&&<span style={{ fontSize:11, color:"#15803d", marginTop:2, display:"block" }}>{ordinalEdition(parseInt(form.edition))}</span>}
                </div>
              </div>
            </div>

            {/* ── RÉCURRENCE ─────────────────────────────────────── */}
            <div>
              <p style={SS}>Récurrence</p>
              <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", fontSize:13, color:"#4a5568", marginBottom:12 }}>
                <div onClick={()=>update("est_recurrent",!form.est_recurrent)}
                  style={{ width:36, height:20, borderRadius:999, background:form.est_recurrent?"#ca631f":"#C5BFBB", position:"relative", cursor:"pointer", transition:"background 0.2s", flexShrink:0 }}>
                  <div style={{ position:"absolute", top:2, left:form.est_recurrent?18:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
                <span style={{ fontWeight:form.est_recurrent?600:400 }}>Événement récurrent</span>
              </label>

              {form.est_recurrent && (() => {
                // Prochain complet = J+M+A renseignés
                const prochainsComplet = form.prochain_jour && form.prochain_mois && form.prochain_annee;
                return (
                  <div style={{ background:"#F8F7F6", borderRadius:12, padding:"16px" }}>
                    {/* Ligne 1 : Récurrence + Chaque */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                      <div>
                        <label style={LS}>Récurrence</label>
                        <select value={form.frequence_type} onChange={e=>update("frequence_type",e.target.value)} style={{ ...IS, cursor:"pointer" }}>
                          <option value="mois">Tous les mois</option>
                          <option value="ans">Tous les ans</option>
                        </select>
                      </div>
                      <div>
                        <label style={LS}>Chaque</label>
                        <input type="number" min={1} step={1} value={form.frequence_valeur}
                          onChange={e=>{ const v=e.target.value; if(v===""||/^[1-9][0-9]*$/.test(v)) update("frequence_valeur",v); }}
                          onKeyDown={e=>{ if(["e","E","+","-",".",","].includes(e.key)) e.preventDefault(); }}
                          placeholder="Ex : 4" style={IS} />
                      </div>
                    </div>

                    {/* Ligne 2 : Prochain événement (J/M/A séparés) */}
                    <div style={{ marginBottom:12 }}>
                      <label style={LS}>Prochain événement <span style={{ fontWeight:400, color:"#9aa5b4" }}>(Jour optionnel)</span></label>
                      <div style={{ display:"grid", gridTemplateColumns:"80px 1fr 1fr", gap:8 }}>
                        <input type="number" min={1} max={31} value={form.prochain_jour}
                          onChange={e=>{ update("prochain_jour",e.target.value); if(e.target.value && form.prochain_mois && form.prochain_annee){ update("date_debut",""); update("date_fin",""); } }} placeholder="Jour"
                          style={{ ...IS, textAlign:"center" as const }} />
                        <select value={form.prochain_mois} onChange={e=>{ update("prochain_mois",e.target.value); if(form.prochain_jour && e.target.value && form.prochain_annee){ update("date_debut",""); update("date_fin",""); } }} style={{ ...IS, cursor:"pointer" }}>
                          <option value="">— Mois —</option>
                          {["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"].map((m,i)=>(
                            <option key={i+1} value={i+1}>{m}</option>
                          ))}
                        </select>
                        <input type="number" min={2024} max={2099} value={form.prochain_annee}
                          onChange={e=>{ update("prochain_annee",e.target.value); if(form.prochain_jour && form.prochain_mois && e.target.value){ update("date_debut",""); update("date_fin",""); } }} placeholder="Année"
                          style={IS} />
                      </div>
                    </div>

                    {/* Ligne 3 : Durée (seulement si prochain complet) */}
                    {prochainsComplet && (
                      <div style={{ marginBottom:12 }}>
                        <label style={LS}>Durée <span style={{ fontWeight:400, color:"#9aa5b4" }}>(en jours)</span></label>
                        <input type="number" min={1} step={1} value={form.duree_jours}
                          onChange={e=>{ const v=e.target.value; if(v===""||/^[1-9][0-9]*$/.test(v)) update("duree_jours",v); }}
                          onKeyDown={e=>{ if(["e","E","+","-",".",","].includes(e.key)) e.preventDefault(); }}
                          placeholder="Ex : 3" style={{ ...IS, maxWidth:120 }} />
                      </div>
                    )}

                    {/* Indicatif */}
                    {form.frequence_valeur && parseInt(form.frequence_valeur) > 0 && (
                      <div style={{ fontSize:12, color:"#ca631f", background:"rgba(202,99,31,0.06)", border:"1px solid rgba(202,99,31,0.15)", borderRadius:8, padding:"8px 12px" }}>
                        ℹ️ Tous les <strong>{form.frequence_valeur} {form.frequence_type==="mois"?"mois":`an${parseInt(form.frequence_valeur)>1?"s":""}`}</strong>
                        {form.prochain_mois && form.prochain_annee && (
                          <span> — Prochain : <strong>
                            {form.prochain_jour && `${form.prochain_jour} `}
                            {["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"][parseInt(form.prochain_mois)-1]} {form.prochain_annee}
                          </strong></span>
                        )}
                        {prochainsComplet && form.duree_jours && <span> · <strong>{form.duree_jours} jour{parseInt(form.duree_jours)>1?"s":""}</strong></span>}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* ── DATES ──────────────────────────────────────────── */}
            {(() => {
              // Grisé si récurrent ET prochain complet
              const grise = form.est_recurrent && form.prochain_jour && form.prochain_mois && form.prochain_annee;
              const obligatoire = !form.est_recurrent;
              return (
                <div style={{ opacity: grise ? 0.4 : 1, pointerEvents: grise ? "none" : "auto", transition:"opacity 0.2s" }}>
                  <p style={SS}>Dates {grise && <span style={{ fontSize:10, fontWeight:400, color:"#9aa5b4", marginLeft:8 }}>calculées depuis le prochain événement</span>}</p>
                  <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                    {[{val:true,label:"Date unique"},{val:false,label:"Sur plusieurs jours"}].map(opt=>(
                      <button key={String(opt.val)} onClick={()=>{ update("date_unique",opt.val); if(opt.val) update("date_fin",""); }}
                        style={{ padding:"7px 16px", borderRadius:8, fontSize:13, fontWeight:600, border:"none", cursor:"pointer",
                          background:form.date_unique===opt.val?"#ca631f":"#E8E5E3",
                          color:form.date_unique===opt.val?"#fff":"#4a5568" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {form.date_unique ? (
                    <div>
                      <label style={LS}>Date {obligatoire?"*":""}</label>
                      <input type="date" value={form.date_debut} min={new Date().toISOString().split("T")[0]} onChange={e=>update("date_debut",e.target.value)} style={{ ...IS, maxWidth:200 }} />
                    </div>
                  ) : (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      <div>
                        <label style={LS}>Date de début {obligatoire?"*":""}</label>
                        <input type="date" value={form.date_debut} min={new Date().toISOString().split("T")[0]} onChange={e=>update("date_debut",e.target.value)} style={IS} />
                      </div>
                      <div>
                        <label style={LS}>Date de fin {obligatoire?"*":""} <span style={{ fontWeight:400, color:"#9aa5b4" }}>(après le début)</span></label>
                        <input type="date" value={form.date_fin} min={form.date_debut||undefined}
                          onChange={e=>update("date_fin",e.target.value)}
                          style={{ ...IS, borderColor:form.date_fin&&form.date_fin<=form.date_debut?"#dc2626":"#C5BFBB" }} />
                        {form.date_fin&&form.date_fin<=form.date_debut&&<span style={{ fontSize:11, color:"#dc2626", marginTop:3, display:"block" }}>La date de fin doit être après la date de début</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Lieu */}
            <div>
              <p style={SS}>Lieu</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={LS}>Pays hôte</label>
                  <PaysSelect value={form.pays_hote_nom} onChange={nom=>update("pays_hote_nom",nom)} onChangeId={id=>update("pays_hote_id",id||"")} />
                </div>
                <div>
                  <label style={LS}>Ville</label>
                  <input value={form.ville} onChange={e=>update("ville",e.target.value)} placeholder="Ex: Dakar" style={IS} />
                </div>
              </div>
            </div>

            {/* Organisateur + Rôle APIX */}
            <div>
              <p style={SS}>Organisation</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={LS}>Organisateur</label>
                  <input value={form.organisateur} onChange={e=>update("organisateur",e.target.value)} placeholder="Nom de l'organisateur" style={IS} />
                </div>
                <div>
                  <label style={LS}>Rôle APIX</label>
                  <select value={form.role_apix} onChange={e=>update("role_apix",e.target.value)} style={{ ...IS, cursor:"pointer" }}>
                    <option value="">— Sélectionner —</option>
                    {ROLES_APIX.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Thématiques */}
            <div>
              <p style={SS}>Thématiques</p>
              <NaemaSelect
                secteurIds={form.secteur_ids||[]}
                brancheIds={form.branche_ids||[]}
                activiteIds={form.activite_ids||[]}
                onChangeSecteurs={ids=>update("secteur_ids",ids)}
                onChangeBranches={ids=>update("branche_ids",ids)}
                onChangeActivites={ids=>update("activite_ids",ids)}
              />
            </div>

            {/* Participants */}
            <div>
              <p style={SS}>Participants</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={LS}>Pays invités</label>
                  <PaysMultiSelect
                    value={form.pays_invites_noms || ""}
                    onChange={(noms: string) => update("pays_invites_noms", noms)}
                    placeholder="Sélectionner les pays invités"
                  />
                </div>
                <div>
                  <label style={LS}>Entreprises invitées</label>
                  <input value={form.entreprises_invitees} onChange={e=>update("entreprises_invitees",e.target.value)} placeholder="TotalEnergies, Orange..." style={IS} />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <p style={SS}>Description</p>
              <RichTextEditor value={form.description} onChange={v=>update("description",v)}/>
            </div>

            {error && <div style={{ background:"#fee2e2", color:"#dc2626", padding:"10px 14px", borderRadius:8, fontSize:13 }}>{error}</div>}

            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={onClose} style={{ padding:"10px 20px", borderRadius:10, border:"1px solid #C5BFBB", background:"transparent", color:"#4a5568", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving||saveOk}
                style={{ padding:"10px 24px", borderRadius:10, border:"none", background:saveOk?"#dcfce7":"linear-gradient(135deg,#ca631f,#a0521a)", color:saveOk?"#15803d":"#fff", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontFamily:"var(--font-google-sans)" }}>
                <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                {saveOk?<><Check size={14}/> Enregistré !</>:saving?<><Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/> Sauvegarde...</>:editItem?"Modifier":"Créer l'événement"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function EvenementsPage() {
  const [evenements, setEvenements] = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(false);
  const [editItem,   setEditItem]   = useState<any>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [vue,        setVue]        = useState<any>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.evenements.liste("per_page=100&admin=true");
      setEvenements(data.data || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const openCreate = () => { setEditItem(null); setModal(true); };
  const openEdit   = (e: any) => { setEditItem(e); setModal(true); };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cet événement ?")) return;
    setDeleting(id);
    try { await api.evenements.supprimer(id); charger(); }
    finally { setDeleting(null); }
  };

  const handleTogglePublie = async (e: any) => {
    setTogglingId(e.id);
    try {
      await fetch(`${API_BASE}/evenements/${e.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({est_publie:!e.est_publie}) });
      charger();
    } finally { setTogglingId(null); }
  };

  return (
    <div style={{ padding:"36px 40px 80px", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:32 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <h1 style={{ fontWeight:800, fontSize:"1.75rem", color:"#1a1a2e" }}>Événements</h1>
          <span style={{ fontSize:14, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.1)", padding:"3px 12px", borderRadius:999 }}>{total}</span>
        </div>
        <button onClick={openCreate} style={{ display:"flex", alignItems:"center", gap:8, background:"#004f91", color:"#fff", fontWeight:700, fontSize:13, padding:"11px 20px", borderRadius:12, border:"none", cursor:"pointer", boxShadow:"0 4px 14px rgba(0,79,145,0.3)" }}>
          <Plus size={15} /> Ajouter un événement
        </button>
      </div>

      {/* Cards */}
      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:200, gap:10, color:"#9aa5b4" }}>
          <Loader2 size={22} style={{ animation:"spin 1s linear infinite" }} />
        </div>
      ) : evenements.length===0 ? (
        <div style={{ textAlign:"center", padding:"80px 24px", color:"#9aa5b4" }}>
          <Calendar size={44} style={{ marginBottom:14, opacity:0.25 }} />
          <p style={{ fontSize:14 }}>Aucun événement — cliquez sur "+ Ajouter" pour commencer.</p>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:12 }}>
          {evenements.map(e => {
            const dateStr = e.date_debut
              ? (e.date_debut===e.date_fin||!e.date_fin ? fmtDateFR(e.date_debut) : `${fmtDateFR(e.date_debut)} → ${fmtDateFR(e.date_fin)}`)
              : e.prochain_mois ? `${e.prochain_jour?e.prochain_jour+" ":""}${MOIS_VIEW[(e.prochain_mois||1)-1]} ${e.prochain_annee||""}` : null;
            const lieu = [e.ville, e.pays_hote_nom].filter(Boolean).join(", ");
            const statut = computeStatut(e);
            // Récurrents sans date fixe : la prochaine occurrence est à venir
            const statutAff = statut ?? ((e.prochain_annee || e.prochain_mois) ? "a_venir" : null);
            return (
              <div key={e.id} onClick={()=>setVue(e)}
                style={{background:"#fff",border:"1px solid #E8E5E3",borderLeft:"3px solid #004f91",borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",position:"relative" as const}}
                onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 4px 16px rgba(0,79,145,0.12)";ev.currentTarget.style.borderColor="#004f91";}}
                onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";ev.currentTarget.style.borderColor="#E8E5E3";ev.currentTarget.style.borderLeftColor="#004f91";}}>

                <div style={{position:"absolute" as const,top:12,right:12}}>
                  {statutAff==="en_cours" ? <Badge variant="green" size="xs" style={{color:"#188038",background:"rgba(24,128,56,0.06)",borderColor:"rgba(24,128,56,0.12)"}}>En cours</Badge>
                  :statutAff==="termine"  ? <Badge variant="gray"  size="xs">Terminé</Badge>
                  :statutAff==="a_venir"  ? <Badge variant="blue"  size="xs" style={{color:"#004f91",background:"rgba(0,79,145,0.06)",borderColor:"rgba(0,79,145,0.12)"}}>À venir</Badge>
                  :null}
                </div>
                <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",lineHeight:1.35,marginBottom:e.edition!=null?2:8,paddingRight:statutAff?90:0}}>{e.nom_event}</div>
                {e.edition!=null&&<div style={{fontSize:11,fontWeight:500,color:"#9aa5b4",marginBottom:8}}>{ordinalEdition(e.edition)}</div>}
                <div style={{display:"flex",flexDirection:"column" as const,gap:3,marginBottom:12}}>
                  {dateStr&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                    <span style={{color:"#4a5568",fontWeight:400}}>{dateStr}</span>
                  </div>}
                  {lieu&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                    <span style={{color:"#4a5568",fontWeight:400}}>{lieu}</span>
                  </div>}
                </div>
                <div style={{display:"flex",gap:5,borderTop:"1px solid #F2F0EF",paddingTop:10}} onClick={ev=>ev.stopPropagation()}>
                  <button onClick={()=>openEdit(e)}
                    style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(0,79,145,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:"#004f91",fontWeight:600}}>
                    <Pencil size={12}/> Modifier
                  </button>
                  <button onClick={()=>handleTogglePublie(e)} disabled={togglingId===e.id}
                    style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:e.est_publie?"rgba(24,128,56,0.08)":"rgba(156,163,175,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:e.est_publie?"#188038":"#6b7280",fontWeight:600}}>
                    {togglingId===e.id?<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>:e.est_publie?<><EyeOff size={12}/> Public</>:<><Eye size={12}/> Publier</>}
                  </button>
                  <button onClick={()=>handleDelete(e.id)} disabled={deleting===e.id}
                    style={{display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(220,38,38,0.07)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 9px"}}>
                    {deleting===e.id?<Loader2 size={12} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/>:<Trash2 size={12} style={{color:"#dc2626"}}/>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vue&&(
        <div onClick={()=>setVue(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div onClick={ev=>ev.stopPropagation()} style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.25)",overflow:"hidden"}}>
            <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)"}}/>
            <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
                <div style={{flex:1,paddingRight:16}}>
                  <h2 style={{fontWeight:800,fontSize:"1.2rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:8}}>{vue.nom_event}</h2>
                  <div style={{display:"flex",gap:7,flexWrap:"wrap" as const}}>
                    {vue.edition!=null&&<span style={{fontSize:11,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.08)",border:"1px solid rgba(202,99,31,0.2)",padding:"2px 9px",borderRadius:999}}>{ordinalEdition(vue.edition)}</span>}
                    <span style={{fontSize:11,fontWeight:700,color:vue.est_publie?"#15803d":"#9aa5b4",background:vue.est_publie?"#dcfce7":"#F2F0EF",padding:"2px 9px",borderRadius:999}}>{vue.est_publie?"Publié":"Non publié"}</span>
                    {vue.role_apix&&<Badge variant={ROLE_VARIANT[vue.role_apix]||"gray"} size="xs">{ROLES_APIX_LABELS[vue.role_apix]||vue.role_apix}</Badge>}
                  </div>
                </div>
                <button onClick={()=>setVue(null)} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
              </div>
              {vue.description&&<div style={{background:"rgba(202,99,31,0.04)",border:"1px solid rgba(202,99,31,0.1)",borderRadius:10,padding:"12px 14px",marginBottom:18}}><style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style><div data-rte dangerouslySetInnerHTML={{__html:vue.description}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/></div>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                {(vue.date_debut||vue.prochain_mois)&&<div style={{background:"rgba(202,99,31,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Date</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{vue.date_debut?(vue.date_debut===vue.date_fin||!vue.date_fin?fmtDateFR(vue.date_debut):`${fmtDateFR(vue.date_debut)} → ${fmtDateFR(vue.date_fin)}`):(`${vue.prochain_jour?vue.prochain_jour+" ":""}${MOIS_VIEW[(vue.prochain_mois||1)-1]} ${vue.prochain_annee||""}`)}</p>{vue.duree_jours&&<p style={{fontSize:11,color:"#9aa5b4",marginTop:3}}>{vue.duree_jours} jour{vue.duree_jours>1?"s":""}</p>}</div>}
                {(vue.ville||vue.pays_hote_nom)&&<div style={{background:"rgba(0,79,145,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Lieu</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{[vue.ville,vue.pays_hote_nom].filter(Boolean).join(", ")}</p></div>}
                {vue.organisateur&&<div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}><LBL>Organisateur</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{vue.organisateur}</p></div>}
                {vue.est_recurrent&&<div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}><LBL>Récurrence</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>Tous les {vue.frequence_valeur} {vue.frequence_type==="mois"?"mois":`an${vue.frequence_valeur>1?"s":""}`}</p></div>}
              </div>
              {vue.thematiques_tree&&Object.keys(vue.thematiques_tree).length>0&&(
                <div style={{marginBottom:16}}>
                  <LBL>Thématiques</LBL>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                    {Object.entries(vue.thematiques_tree).map(([sec,branches]:any)=>(
                      <div key={sec}>
                        <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:Object.keys(branches).length?5:0}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:"#ca631f",flexShrink:0}}/>
                          <span style={{fontSize:12,fontWeight:700,color:"#ca631f"}}>{sec}</span>
                        </div>
                        {Object.entries(branches).map(([bra,acts]:any)=>(
                          <div key={bra} style={{paddingLeft:20,borderLeft:"2px solid rgba(202,99,31,0.15)"}}>
                            <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:acts.length?4:0}}>
                              <div style={{width:6,height:6,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                              <span style={{fontSize:11,fontWeight:600,color:"#004f91"}}>{bra}</span>
                            </div>
                            {acts.length>0&&<div style={{paddingLeft:18,display:"flex",flexDirection:"column" as const,gap:3}}>{acts.map((act:string)=>(
                              <div key={act} style={{display:"flex",alignItems:"center",gap:6}}>
                                <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                                <span style={{fontSize:11,color:"#188038",fontWeight:500}}>{act}</span>
                              </div>
                            ))}</div>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {vue.pays_invites_noms&&<div style={{marginBottom:14}}><LBL>Pays invités</LBL><div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>{vue.pays_invites_noms.split(",").map((p:string)=>p.trim()).filter(Boolean).map((p:string)=><span key={p} style={{fontSize:11,color:"#004f91",background:"rgba(0,79,145,0.07)",border:"1px solid rgba(0,79,145,0.15)",padding:"2px 10px",borderRadius:999,fontWeight:500}}>{p}</span>)}</div></div>}
              {vue.entreprises_invitees&&<div style={{marginBottom:14}}><LBL>Entreprises invitées</LBL><div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>{vue.entreprises_invitees.split(",").map((ent:string)=>ent.trim()).filter(Boolean).map((ent:string)=><span key={ent} style={{fontSize:11,color:"#ca631f",background:"rgba(202,99,31,0.06)",border:"1px solid rgba(202,99,31,0.15)",padding:"2px 10px",borderRadius:999,fontWeight:500}}>{ent}</span>)}</div></div>}
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20,borderTop:"1px solid #F2F0EF",paddingTop:18}}>
                <button onClick={()=>{setVue(null);openEdit(vue);}}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"9px 18px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#ca631f,#a0521a)",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13}}>
                  <Pencil size={13}/> Modifier
                </button>
                <button onClick={()=>setVue(null)} style={{padding:"9px 20px",borderRadius:9,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13}}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <EvenementModal open={modal} onClose={()=>setModal(false)} editItem={editItem} onSaved={charger} />
    </div>
  );
}
