"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, FileText, Loader2, Upload, X, Check, Calendar } from "lucide-react";
import Badge, { BadgeVariant } from "@/components/shared/Badge";
import { api } from "@/lib/api";
import NaemaSelect from "@/components/shared/NaemaSelect";
import RichTextEditor from "@/components/shared/RichTextEditor";
import PaysSelect from "@/components/shared/PaysSelect";
import PaysMultiSelect from "@/components/shared/PaysMultiSelect";
import { FModal, FSection, FGrid, FPanel, FLabel, FInput, FSelect, FSegmented, FToggle, FButton, FButtonGhost, FError, FInfo } from "@/components/shared/FormUI";

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
const MOIS_ABR  = ["JANV","FÉVR","MARS","AVR","MAI","JUIN","JUIL","AOÛT","SEPT","OCT","NOV","DÉC"];
const ROLES_APIX_LABELS: Record<string,string> = { "Organisateur":"Organisateur","Co-organisateur":"Co-organisateur","Participant":"Participant","Partenaire":"Partenaire","Sponsor":"Sponsor","Invité":"Invité" };
const ROLE_VARIANT: Record<string, BadgeVariant> = { "Organisateur":"green","Co-organisateur":"yellow","Participant":"orange","Partenaire":"teal","Sponsor":"lavender","Invité":"gray" };
// Pilules teintées des rôles APIX sur les cards (palette du site)
const ROLE_PILL: Record<string,{c:string;bg:string}> = {
  "Organisateur":    { c:"#188038", bg:"rgba(24,128,56,0.08)"  },
  "Co-organisateur": { c:"#188038", bg:"rgba(24,128,56,0.08)"  },
  "Participant":     { c:"#004f91", bg:"rgba(0,79,145,0.07)"   },
  "Partenaire":      { c:"#6A1B9A", bg:"rgba(106,27,154,0.07)" },
  "Sponsor":         { c:"#ca631f", bg:"rgba(202,99,31,0.08)"  },
  "Invité":          { c:"#6b7280", bg:"#F2F0EF"               },
};

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
  const [fichiers, setFichiers] = useState<any[]>([]);
  const [pdfQueue, setPdfQueue] = useState<{ file: File; titre: string }[]>([]);

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
    setFichiers(editItem?.fichiers || []);
    setPdfQueue([]);
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
      let evtId: number | null = editItem?.id ?? null;
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
        const d = await res.json(); evtId = d.id;
      }
      // Téléverser les documents en attente
      if (evtId) {
        for (const pq of pdfQueue) {
          const fd = new FormData();
          fd.append("titre", pq.titre);
          fd.append("fichier", pq.file);
          await fetch(`${API_BASE}/evenements/${evtId}/fichiers`, { method: "POST", body: fd });
        }
      }
      setSaveOk(true);
      setTimeout(() => { onClose(); onSaved(); }, 700);
    } catch (e: any) {
      const msg = e?.detail ? (Array.isArray(e.detail) ? e.detail.map((d:any)=>d.msg||d).join(", ") : String(e.detail)) : (e?.message || "Erreur lors de la sauvegarde");
      setError(msg);
    } finally { setSaving(false); }
  };

  const supprimerFichier = async (fid: number) => {
    if (!editItem) return;
    await fetch(`${API_BASE}/evenements/${editItem.id}/fichiers/${fid}`, { method: "DELETE" });
    setFichiers(prev => prev.filter(f => f.id !== fid));
  };

  const MOIS_FORM = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

  return (
    <FModal open={open} onClose={onClose}
      title={editItem ? "Modifier l'événement" : "Nouvel événement"}
      footer={<>
        <FButtonGhost onClick={onClose}>Annuler</FButtonGhost>
        <FButton onClick={handleSave} disabled={saving || saveOk} loading={saving} success={saveOk}>
          {saveOk ? "Enregistré !" : saving ? "Sauvegarde…" : editItem ? "Modifier" : "Créer l'événement"}
        </FButton>
      </>}>

      {/* Identification */}
      <FSection title="Identification">
        <FGrid cols="2fr 1fr">
          <div>
            <FLabel>Nom de l'événement *</FLabel>
            <FInput value={form.nom_event} onChange={e=>update("nom_event",e.target.value)} placeholder="Intitulé de l'événement" />
          </div>
          <div>
            <FLabel>Édition</FLabel>
            <FInput type="number" min={1} step={1} value={form.edition}
              onChange={e=>{ const v=e.target.value; if(v===""||/^[1-9][0-9]*$/.test(v)) update("edition",v); }}
              onKeyDown={e=>{ if(["e","E","+","-",".",","].includes(e.key)) e.preventDefault(); }}
              placeholder="Ex : 5"
              style={form.edition&&(isNaN(parseInt(form.edition))||parseInt(form.edition)<=0)?{ borderColor:"#dc2626" }:undefined} />
            {form.edition&&parseInt(form.edition)>0&&<span style={{ fontSize:11, color:"#188038", marginTop:3, display:"block" }}>{ordinalEdition(parseInt(form.edition))}</span>}
          </div>
        </FGrid>
      </FSection>

      {/* Récurrence */}
      <FSection title="Récurrence" extra={<FToggle checked={form.est_recurrent} onChange={()=>update("est_recurrent",!form.est_recurrent)} label="Événement récurrent" />}>
        {form.est_recurrent ? (() => {
          const prochainsComplet = form.prochain_jour && form.prochain_mois && form.prochain_annee;
          return (
            <FPanel>
              <FGrid cols={2} style={{ marginBottom:12 }}>
                <div>
                  <FLabel>Récurrence</FLabel>
                  <FSelect value={form.frequence_type} onChange={e=>update("frequence_type",e.target.value)}>
                    <option value="mois">Tous les mois</option>
                    <option value="ans">Tous les ans</option>
                  </FSelect>
                </div>
                <div>
                  <FLabel>Chaque</FLabel>
                  <FInput type="number" min={1} step={1} value={form.frequence_valeur}
                    onChange={e=>{ const v=e.target.value; if(v===""||/^[1-9][0-9]*$/.test(v)) update("frequence_valeur",v); }}
                    onKeyDown={e=>{ if(["e","E","+","-",".",","].includes(e.key)) e.preventDefault(); }}
                    placeholder="Ex : 4" />
                </div>
              </FGrid>

              <div style={{ marginBottom:12 }}>
                <FLabel hint="(Jour optionnel)">Prochain événement</FLabel>
                <FGrid cols="80px 1fr 1fr" gap={8}>
                  <FInput type="number" min={1} max={31} value={form.prochain_jour}
                    onChange={e=>{ update("prochain_jour",e.target.value); if(e.target.value && form.prochain_mois && form.prochain_annee){ update("date_debut",""); update("date_fin",""); } }}
                    placeholder="Jour" style={{ textAlign:"center" as const }} />
                  <FSelect value={form.prochain_mois} onChange={e=>{ update("prochain_mois",e.target.value); if(form.prochain_jour && e.target.value && form.prochain_annee){ update("date_debut",""); update("date_fin",""); } }}>
                    <option value="">— Mois —</option>
                    {MOIS_FORM.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                  </FSelect>
                  <FInput type="number" min={2024} max={2099} value={form.prochain_annee}
                    onChange={e=>{ update("prochain_annee",e.target.value); if(form.prochain_jour && form.prochain_mois && e.target.value){ update("date_debut",""); update("date_fin",""); } }}
                    placeholder="Année" />
                </FGrid>
              </div>

              {prochainsComplet && (
                <div style={{ marginBottom:12 }}>
                  <FLabel hint="(en jours)">Durée</FLabel>
                  <FInput type="number" min={1} step={1} value={form.duree_jours}
                    onChange={e=>{ const v=e.target.value; if(v===""||/^[1-9][0-9]*$/.test(v)) update("duree_jours",v); }}
                    onKeyDown={e=>{ if(["e","E","+","-",".",","].includes(e.key)) e.preventDefault(); }}
                    placeholder="Ex : 3" style={{ maxWidth:120 }} />
                </div>
              )}

              {form.frequence_valeur && parseInt(form.frequence_valeur) > 0 && (
                <FInfo>
                  Tous les <strong>{form.frequence_valeur} {form.frequence_type==="mois"?"mois":`an${parseInt(form.frequence_valeur)>1?"s":""}`}</strong>
                  {form.prochain_mois && form.prochain_annee && (
                    <span> — Prochain : <strong>
                      {form.prochain_jour && `${form.prochain_jour} `}
                      {MOIS_FORM[parseInt(form.prochain_mois)-1]} {form.prochain_annee}
                    </strong></span>
                  )}
                  {prochainsComplet && form.duree_jours && <span> · <strong>{form.duree_jours} jour{parseInt(form.duree_jours)>1?"s":""}</strong></span>}
                </FInfo>
              )}
            </FPanel>
          );
        })() : null}
      </FSection>

      {/* Dates */}
      {(() => {
        const grise = form.est_recurrent && form.prochain_jour && form.prochain_mois && form.prochain_annee;
        const obligatoire = !form.est_recurrent;
        return (
          <div style={{ opacity: grise ? 0.4 : 1, pointerEvents: grise ? "none" : "auto", transition:"opacity 0.2s" }}>
            <FSection title="Dates"
              extra={grise ? <span style={{ fontSize:11, color:"#9aa5b4" }}>calculées depuis le prochain événement</span> : undefined}>
              <div style={{ marginBottom:12 }}>
                <FSegmented options={[{value:true,label:"Date unique"},{value:false,label:"Sur plusieurs jours"}]}
                  value={form.date_unique} onChange={v=>{ update("date_unique",v); if(v) update("date_fin",""); }} />
              </div>
              {form.date_unique ? (
                <div>
                  <FLabel>Date {obligatoire?"*":""}</FLabel>
                  <FInput type="date" value={form.date_debut} min={new Date().toISOString().split("T")[0]} onChange={e=>update("date_debut",e.target.value)} style={{ maxWidth:200 }} />
                </div>
              ) : (
                <FGrid cols={2}>
                  <div>
                    <FLabel>Date de début {obligatoire?"*":""}</FLabel>
                    <FInput type="date" value={form.date_debut} min={new Date().toISOString().split("T")[0]} onChange={e=>update("date_debut",e.target.value)} />
                  </div>
                  <div>
                    <FLabel>Date de fin {obligatoire?"*":""}</FLabel>
                    <FInput type="date" value={form.date_fin} min={form.date_debut||undefined}
                      onChange={e=>update("date_fin",e.target.value)}
                      style={form.date_fin&&form.date_fin<=form.date_debut?{ borderColor:"#dc2626" }:undefined} />
                    {form.date_fin&&form.date_fin<=form.date_debut&&<span style={{ fontSize:11, color:"#dc2626", marginTop:3, display:"block" }}>La date de fin doit être après la date de début</span>}
                  </div>
                </FGrid>
              )}
            </FSection>
          </div>
        );
      })()}

      {/* Lieu */}
      <FSection title="Lieu">
        <FGrid cols={2}>
          <div>
            <FLabel>Pays hôte</FLabel>
            <PaysSelect value={form.pays_hote_nom} onChange={nom=>update("pays_hote_nom",nom)} onChangeId={id=>update("pays_hote_id",id||"")} />
          </div>
          <div>
            <FLabel>Ville</FLabel>
            <FInput value={form.ville} onChange={e=>update("ville",e.target.value)} placeholder="Ex : Dakar" />
          </div>
        </FGrid>
      </FSection>

      {/* Organisation */}
      <FSection title="Organisation">
        <FGrid cols={2}>
          <div>
            <FLabel>Organisateur</FLabel>
            <FInput value={form.organisateur} onChange={e=>update("organisateur",e.target.value)} placeholder="Nom de l'organisateur" />
          </div>
          <div>
            <FLabel>Rôle de l&apos;APIX</FLabel>
            <FSelect value={form.role_apix} onChange={e=>update("role_apix",e.target.value)}>
              <option value="">— Sélectionner —</option>
              {ROLES_APIX.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
            </FSelect>
          </div>
        </FGrid>
      </FSection>

      {/* Thématiques */}
      <FSection title="Thématiques">
        <NaemaSelect
          secteurIds={form.secteur_ids||[]}
          brancheIds={form.branche_ids||[]}
          activiteIds={form.activite_ids||[]}
          onChangeSecteurs={ids=>update("secteur_ids",ids)}
          onChangeBranches={ids=>update("branche_ids",ids)}
          onChangeActivites={ids=>update("activite_ids",ids)}
        />
      </FSection>

      {/* Participants */}
      <FSection title="Participants">
        <FGrid cols={2}>
          <div>
            <FLabel>Pays invités</FLabel>
            <PaysMultiSelect
              value={form.pays_invites_noms || ""}
              onChange={(noms: string) => update("pays_invites_noms", noms)}
              placeholder="Sélectionner les pays invités"
            />
          </div>
          <div>
            <FLabel>Entreprises invitées</FLabel>
            <FInput value={form.entreprises_invitees} onChange={e=>update("entreprises_invitees",e.target.value)} placeholder="TotalEnergies, Orange…" />
          </div>
        </FGrid>
      </FSection>

      {/* Description */}
      <FSection title="Description">
        <RichTextEditor value={form.description} onChange={v=>update("description",v)}/>
      </FSection>

      {/* Documents */}
      <FSection title="Documents">
        {fichiers.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:8 }}>
            {fichiers.map((fi: any) => (
              <div key={fi.id} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(0,79,145,0.05)", border:"1px solid rgba(0,79,145,0.15)", borderRadius:10, padding:"8px 12px" }}>
                <FileText size={13} style={{ color:"#004f91" }} />
                <a href={`${API_BASE}/evenements/${editItem?.id}/fichiers/${fi.id}/download`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:13, flex:1, color:"#1a1a2e", fontWeight:500, textDecoration:"none" }}>{fi.titre}</a>
                <button onClick={()=>supprimerFichier(fi.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={13} style={{ color:"#dc2626" }} /></button>
              </div>
            ))}
          </div>
        )}
        <label style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderRadius:10, cursor:"pointer", border:"2px dashed #E4E1DE", background:"#FAFAF9", transition:"border-color 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#004f91"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="#E4E1DE"}>
          <Upload size={14} color="#9aa5b4" />
          <span style={{ fontSize:13, color:"#9aa5b4" }}>Ajouter un ou plusieurs PDF</span>
          <input type="file" accept=".pdf" multiple style={{ display:"none" }}
            onChange={e=>{ const files=Array.from(e.target.files||[]); setPdfQueue(prev=>[...prev, ...files.map(f=>({ file:f, titre:f.name.replace(/\.pdf$/i,"") }))]); e.target.value=""; }} />
        </label>
        {pdfQueue.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:5, marginTop:8 }}>
            {pdfQueue.map((pq, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(106,27,154,0.05)", border:"1px solid rgba(106,27,154,0.2)", borderRadius:10, padding:"8px 12px" }}>
                <FileText size={13} style={{ color:"#6A1B9A" }} />
                <input value={pq.titre} onChange={e=>setPdfQueue(prev=>prev.map((x,j)=>j===i?{ ...x, titre:e.target.value }:x))} placeholder="Titre du document"
                  style={{ flex:1, background:"transparent", border:"none", borderBottom:"1px solid rgba(106,27,154,0.3)", outline:"none", fontSize:12.5, padding:"2px 0", fontFamily:"var(--font-google-sans)" }} />
                <button onClick={()=>setPdfQueue(prev=>prev.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={13} style={{ color:"#dc2626" }} /></button>
              </div>
            ))}
            <p style={{ fontSize:11, color:"#9aa5b4" }}>Les fichiers seront téléversés à l&apos;enregistrement.</p>
          </div>
        )}
      </FSection>

      {error && <FError>{error}</FError>}
    </FModal>
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
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(290px, 1fr))", gap:14 }}>
          {evenements.map(e => {
            const dateStr = e.date_debut
              ? (e.date_debut===e.date_fin||!e.date_fin ? fmtDateFR(e.date_debut) : `${fmtDateFR(e.date_debut)} → ${fmtDateFR(e.date_fin)}`)
              : e.prochain_mois ? `${e.prochain_jour?e.prochain_jour+" ":""}${MOIS_VIEW[(e.prochain_mois||1)-1]} ${e.prochain_annee||""}` : null;
            const lieu = [e.ville, e.pays_hote_nom].filter(Boolean).join(", ");
            const statut = computeStatut(e);
            // Récurrents sans date fixe : la prochaine occurrence est à venir
            const statutAff = statut ?? ((e.prochain_annee || e.prochain_mois) ? "a_venir" : null);
            const ST: any = {
              a_venir:  { label:"À venir",  c:"#004f91", bg:"rgba(0,79,145,0.07)"  },
              en_cours: { label:"En cours", c:"#188038", bg:"rgba(24,128,56,0.08)" },
              termine:  { label:"Terminé",  c:"#6b7280", bg:"#F2F0EF"              },
            };
            const st = statutAff ? ST[statutAff] : null;
            // Tuile calendrier : mois / jour(s) / année
            let tuile: { mois:string; jour:string; annee:string } | null = null;
            if (e.date_debut) {
              const d1 = e.date_debut, d2 = e.date_fin;
              const jour = d2 && d2!==d1 && d2.slice(5,7)===d1.slice(5,7) && d2.slice(0,4)===d1.slice(0,4)
                ? `${parseInt(d1.slice(8,10))}–${parseInt(d2.slice(8,10))}`
                : `${parseInt(d1.slice(8,10))}`;
              tuile = { mois:MOIS_ABR[parseInt(d1.slice(5,7))-1], jour, annee:d1.slice(0,4) };
            } else if (e.prochain_mois) {
              tuile = { mois:MOIS_ABR[(e.prochain_mois||1)-1], jour:e.prochain_jour?String(e.prochain_jour):"·", annee:e.prochain_annee?String(e.prochain_annee):"" };
            }
            // La tuile ne montre que le début : afficher la période complète si elle déborde du mois
            const moisDiff = !!(e.date_debut && e.date_fin && e.date_fin!==e.date_debut && (e.date_fin.slice(5,7)!==e.date_debut.slice(5,7) || e.date_fin.slice(0,4)!==e.date_debut.slice(0,4)));
            return (
              <div key={e.id} onClick={()=>setVue(e)}
                style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:14,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",display:"flex",flexDirection:"column" as const,overflow:"hidden"}}
                onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor="rgba(0,79,145,0.25)";}}
                onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";}}>

                <div style={{padding:"14px 16px 14px",flex:1}}>
                  {/* Statut + état de publication */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    {st ? (
                      <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:10.5,fontWeight:700,color:st.c,background:st.bg,padding:"3px 10px",borderRadius:999}}>{st.label}</span>
                    ) : <span/>}
                    {e.role_apix ? (
                      <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:(ROLE_PILL[e.role_apix]||ROLE_PILL["Invité"]).c,background:(ROLE_PILL[e.role_apix]||ROLE_PILL["Invité"]).bg,padding:"3px 10px",borderRadius:999}}>
                        {ROLES_APIX_LABELS[e.role_apix]||e.role_apix}
                      </span>
                    ) : <span/>}
                  </div>

                  {/* Tuile calendrier + infos */}
                  <div style={{display:"flex",gap:13,alignItems:"flex-start"}}>
                    <div style={{width:52,flexShrink:0,borderRadius:12,border:"1px solid rgba(0,79,145,0.14)",background:"rgba(0,79,145,0.05)",display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:"7px 4px 6px",minHeight:56}}>
                      {tuile ? <>
                        <span style={{fontSize:9,fontWeight:800,letterSpacing:"0.08em",color:"#004f91"}}>{tuile.mois}</span>
                        <span style={{fontSize:16,fontWeight:800,color:"#1a1a2e",lineHeight:1.25}}>{tuile.jour}</span>
                        {tuile.annee && <span style={{fontSize:9.5,fontWeight:600,color:"#9aa5b4"}}>{tuile.annee}</span>}
                      </> : <Calendar size={18} style={{color:"#004f91"}}/>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13.5,color:"#1a1a2e",lineHeight:1.35}}>{e.nom_event}</div>
                      {e.edition!=null&&<div style={{fontSize:11,fontWeight:500,color:"#9aa5b4",marginTop:2}}>{ordinalEdition(e.edition)}</div>}
                      <div style={{display:"flex",flexDirection:"column" as const,gap:3,marginTop:7}}>
                        {moisDiff&&dateStr&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                          <span style={{color:"#4a5568",fontWeight:400}}>{dateStr}</span>
                        </div>}
                        {lieu&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                          <span style={{color:"#4a5568",fontWeight:400}}>{lieu}</span>
                        </div>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{display:"flex",alignItems:"stretch",borderTop:"1px solid #F2F0EF"}} onClick={ev=>ev.stopPropagation()}>
                  <button onClick={()=>openEdit(e)}
                    style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"none",border:"none",cursor:"pointer",padding:"10px 0",fontSize:11.5,color:"#004f91",fontWeight:600,fontFamily:"var(--font-google-sans)",transition:"background 0.15s"}}
                    onMouseEnter={ev=>ev.currentTarget.style.background="rgba(0,79,145,0.05)"}
                    onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                    <Pencil size={12}/> Modifier
                  </button>
                  <div style={{width:1,background:"#F2F0EF"}}/>
                  <button onClick={()=>handleTogglePublie(e)} disabled={togglingId===e.id}
                    style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"none",border:"none",cursor:"pointer",padding:"10px 0",fontSize:11.5,color:e.est_publie?"#188038":"#6b7280",fontWeight:600,fontFamily:"var(--font-google-sans)",transition:"background 0.15s"}}
                    onMouseEnter={ev=>ev.currentTarget.style.background=e.est_publie?"rgba(24,128,56,0.05)":"rgba(156,163,175,0.07)"}
                    onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                    {togglingId===e.id?<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>:e.est_publie?<><EyeOff size={12}/> Public</>:<><Eye size={12}/> Publier</>}
                  </button>
                  <div style={{width:1,background:"#F2F0EF"}}/>
                  <button onClick={()=>handleDelete(e.id)} disabled={deleting===e.id}
                    style={{width:46,display:"flex",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",transition:"background 0.15s"}}
                    onMouseEnter={ev=>ev.currentTarget.style.background="rgba(220,38,38,0.05)"}
                    onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
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
