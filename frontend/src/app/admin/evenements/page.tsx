"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, FileText, Loader2, Upload, X, CalendarDays, Search, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { authHeaders } from "@/lib/authHeaders";
import BarreTitre from "@/components/shared/BarreTitre";
import AdminMenu from "@/components/admin/AdminMenu";
import EvenementVueModal from "@/components/shared/EvenementVueModal";
import { SkeletonCards } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SideFilter, ThematiquesCascadeFilter, BoutonEffacerFiltres } from "@/components/shared/FiltresLateraux";
import { useNaemaArbre } from "@/lib/referentiels";
import { demarrerRedimension } from "@/lib/redimension";
import { badge_vert, badge_orange, badge_bleu, badge_violet, badge_ambre, badge_gris } from "@/lib/couleurs";
import NaemaSelect from "@/components/shared/NaemaSelect";
import RichTextEditor from "@/components/shared/RichTextEditor";
import PaysSelect from "@/components/shared/PaysSelect";
import PaysMultiSelect from "@/components/shared/PaysMultiSelect";
import { FModal, FSection, FGrid, FPanel, FLabel, FInput, FSelect, FSegmented, FToggle, FButton, FButtonGhost, FError, FInfo } from "@/components/shared/FormUI";
import { confirmer } from "@/components/shared/Confirmation";
import { fmtDate } from "@/lib/format";
import { computeStatutEvenement as computeStatut } from "@/lib/statuts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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

const fmtDateFR = fmtDate;

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
          method: "PATCH", headers: {"Content-Type":"application/json", ...(await authHeaders())}, body: JSON.stringify(payload)
        });
        if (!res.ok) { const d = await res.json(); throw d; }
      } else {
        const res = await fetch(`${API_BASE}/evenements`, {
          method: "POST", headers: {"Content-Type":"application/json", ...(await authHeaders())}, body: JSON.stringify(payload)
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
          await fetch(`${API_BASE}/evenements/${evtId}/fichiers`, { method: "POST", headers: await authHeaders(), body: fd });
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
    await fetch(`${API_BASE}/evenements/${editItem.id}/fichiers/${fid}`, { method: "DELETE", headers: await authHeaders() });
    setFichiers(prev => prev.filter(f => f.id !== fid));
  };

  const MOIS_FORM = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

  const prochainsComplet = form.prochain_jour && form.prochain_mois && form.prochain_annee;

  return (
    <FModal open={open} onClose={onClose}
      title={editItem ? "Modifier l'événement" : "Nouvel événement"}
      subtitle={editItem ? editItem.nom_event : "Les champs marqués * sont obligatoires"}
      footer={<>
        {error && <FError style={{ flex:1, minWidth:0 }}>{error}</FError>}
        <FButtonGhost onClick={onClose}>Annuler</FButtonGhost>
        <FButton onClick={handleSave} disabled={saving || saveOk} loading={saving} success={saveOk}>
          {saveOk ? "Enregistré !" : saving ? "Sauvegarde…" : editItem ? "Modifier" : "Créer l'événement"}
        </FButton>
      </>}>

      {/* Informations générales : identité + organisation */}
      <FSection title="Informations générales">
        <FGrid cols="2fr 1fr" style={{ marginBottom:14 }}>
          <div>
            <FLabel>Nom de l&apos;événement *</FLabel>
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

      {/* Calendrier : récurrence + dates réunies (plus de section vide) */}
      <FSection title="Calendrier" extra={<FToggle checked={form.est_recurrent} onChange={()=>update("est_recurrent",!form.est_recurrent)} label="Événement récurrent" />}>
        {form.est_recurrent && (
          <FPanel style={{ marginBottom:14 }}>
            <FGrid cols="1fr 1fr 100px" style={{ marginBottom:12 }}>
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
              <div style={{ opacity: prochainsComplet ? 1 : 0.45, transition:"opacity 0.2s" }}>
                <FLabel hint="(jours)">Durée</FLabel>
                <FInput type="number" min={1} step={1} value={form.duree_jours} disabled={!prochainsComplet}
                  onChange={e=>{ const v=e.target.value; if(v===""||/^[1-9][0-9]*$/.test(v)) update("duree_jours",v); }}
                  onKeyDown={e=>{ if(["e","E","+","-",".",","].includes(e.key)) e.preventDefault(); }}
                  placeholder="Ex : 3" />
              </div>
            </FGrid>

            <div>
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

            {form.frequence_valeur && parseInt(form.frequence_valeur) > 0 && (
              <FInfo>
                <span style={{ display:"block", marginTop:0 }}>
                  Tous les <strong>{form.frequence_valeur} {form.frequence_type==="mois"?"mois":`an${parseInt(form.frequence_valeur)>1?"s":""}`}</strong>
                  {form.prochain_mois && form.prochain_annee && (
                    <span> — Prochain : <strong>
                      {form.prochain_jour && `${form.prochain_jour} `}
                      {MOIS_FORM[parseInt(form.prochain_mois)-1]} {form.prochain_annee}
                    </strong></span>
                  )}
                  {prochainsComplet && form.duree_jours && <span> · <strong>{form.duree_jours} jour{parseInt(form.duree_jours)>1?"s":""}</strong></span>}
                </span>
              </FInfo>
            )}
          </FPanel>
        )}

        {(() => {
          const grise = form.est_recurrent && prochainsComplet;
          const obligatoire = !form.est_recurrent;
          return (
            <div style={{ opacity: grise ? 0.4 : 1, pointerEvents: grise ? "none" : "auto", transition:"opacity 0.2s" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" as const, marginBottom:12 }}>
                <FSegmented options={[{value:true,label:"Date unique"},{value:false,label:"Sur plusieurs jours"}]}
                  value={form.date_unique} onChange={v=>{ update("date_unique",v); if(v) update("date_fin",""); }} />
                {grise && <span style={{ fontSize:11, color:"#9aa5b4" }}>Dates calculées depuis le prochain événement</span>}
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
            </div>
          );
        })()}
      </FSection>

      {/* Lieu & participants */}
      <FSection title="Lieu & participants">
        <FGrid cols={2} style={{ marginBottom:14 }}>
          <div>
            <FLabel>Pays hôte</FLabel>
            <PaysSelect value={form.pays_hote_nom} onChange={nom=>{
              update("pays_hote_nom",nom);
              // retirer le pays hôte de la liste des invités s'il y figurait
              if (nom) {
                const invites = (form.pays_invites_noms||"").split(",").map((s:string)=>s.trim()).filter(Boolean).filter((x:string)=>x!==nom);
                update("pays_invites_noms", invites.join(", "));
                update("pays_invites_ids", []);
              }
            }} onChangeId={id=>update("pays_hote_id",id||"")} />
          </div>
          <div>
            <FLabel>Ville</FLabel>
            <FInput value={form.ville} onChange={e=>update("ville",e.target.value)} placeholder="Ex : Dakar" />
          </div>
        </FGrid>
        <FGrid cols={2}>
          <div>
            <FLabel>Pays invités</FLabel>
            <PaysMultiSelect
              value={form.pays_invites_noms || ""}
              onChange={(noms: string) => { update("pays_invites_noms", noms); update("pays_invites_ids", []); }}
              placeholder="Sélectionner les pays invités"
              excludeNom={form.pays_hote_nom}
              disabled={!form.pays_hote_nom}
              disabledHint="Choisissez d'abord le pays hôte"
            />
          </div>
          <div>
            <FLabel>Entreprises invitées</FLabel>
            <FInput value={form.entreprises_invitees} onChange={e=>update("entreprises_invitees",e.target.value)} placeholder="TotalEnergies, Orange…" />
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
    </FModal>
  );
}

// ── Cartes & filtres (mêmes jetons que la page publique) ──────────────────────

// Badges de rôle APIX : organisation vert, participant orange, partenaire bleu,
// invité violet, sponsor ambre — identiques à la page publique.
const ROLE_BADGE: Record<string, React.CSSProperties> = {
  "Organisateur":    badge_vert,
  "Co-organisateur": badge_vert,
  "Participant":     badge_orange,
  "Partenaire":      badge_bleu,
  "Invité":          badge_violet,
  "Sponsor":         badge_ambre,
};
const ROLE_ACCENT: Record<string, string> = {
  "Organisateur": "#188038", "Co-organisateur": "#188038",
  "Participant": "#ca631f", "Partenaire": "#004f91",
  "Invité": "#6A1B9A", "Sponsor": "#a16207",
};
const accentRole = (role?: string | null) => (role && ROLE_ACCENT[role]) || "#004f91";

// Échéance d'un événement à venir : « Dans 2 ans », « Dans 3 mois », « Dans 12 jours »
function dansCombien(e: any): string | null {
  const d = e.date_debut ? new Date(e.date_debut + "T00:00:00")
    : e.prochain_annee ? new Date(e.prochain_annee, (e.prochain_mois || 1) - 1, e.prochain_jour || 1) : null;
  if (!d) return null;
  const now = new Date();
  const jours = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  if (jours <= 0) return null;
  let mois = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
  if (d.getDate() < now.getDate()) mois -= 1;
  const ans = Math.floor(mois / 12);
  if (ans >= 1) return `Dans ${ans} an${ans > 1 ? "s" : ""}`;
  if (mois >= 1) return `Dans ${mois} mois`;
  return `Dans ${jours} jour${jours > 1 ? "s" : ""}`;
}

const STATUT_OPTS = [
  { value: "",         label: "Tous",     c: "#4a5568" },
  { value: "a_venir",  label: "À venir",  c: "#004f91" },
  { value: "en_cours", label: "En cours", c: "#188038" },
  { value: "termine",  label: "Terminés", c: "#6b7280" },
];
const PUB_OPTS = [
  { value: "",          label: "Tous",        c: "#4a5568" },
  { value: "publie",    label: "Publiés",     c: "#188038" },
  { value: "brouillon", label: "Non publiés", c: "#ca631f" },
];

// Groupe de choix exclusifs de la barre de filtre (statut, publication)
function FiltreRadio({ label, options, value, onChange }: {
  label: string; options: { value: string; label: string; c: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: value ? "#004f91" : "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 8 }}>{label}</p>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
        {options.map(o => {
          const actif = value === o.value;
          return (
            <button key={o.value} onClick={() => onChange(o.value)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" as const, fontSize: 12, fontWeight: actif ? 700 : 400, color: actif ? o.c : "#4a5568", fontFamily: "var(--font-google-sans)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F8F7F6"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: o.c, opacity: actif ? 1 : 0.3, flexShrink: 0 }} />{o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Carte événement (gabarit public + barre d'actions d'administration) ────────
function CarteEvenement({ e, estProchain, onVoir, onEditer, onPublier, onSupprimer, publiant, supprimant }: {
  e: any; estProchain: boolean;
  onVoir: () => void; onEditer: () => void; onPublier: () => void; onSupprimer: () => void;
  publiant: boolean; supprimant: boolean;
}) {
  const statut = computeStatut(e) ?? ((e.prochain_annee || e.prochain_mois) ? "a_venir" : null);
  const estEnCours = statut === "en_cours";
  const estPasse   = statut === "termine";
  const accent = estProchain
    ? { c: "#004f91", grad: "linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", label: "Prochain événement", b: "rgba(0,79,145,0.45)", b2: "rgba(0,79,145,0.6)", sh: "0 4px 18px rgba(0,79,145,0.15)" }
    : estEnCours
    ? { c: "#188038", grad: "linear-gradient(90deg,#0d5c26 0%,#188038 60%,#2aa14e 100%)", label: "Événement en cours", b: "rgba(24,128,56,0.45)", b2: "rgba(24,128,56,0.6)", sh: "0 4px 18px rgba(24,128,56,0.15)" }
    : null;
  const dateStr = e.date_debut
    ? (e.date_debut === e.date_fin || !e.date_fin ? fmtDateFR(e.date_debut) : `${fmtDateFR(e.date_debut)} → ${fmtDateFR(e.date_fin)}`)
    : e.prochain_mois ? `${e.prochain_jour ? e.prochain_jour + " " : ""}${MOIS_VIEW[(e.prochain_mois || 1) - 1]} ${e.prochain_annee || ""}`.trim() : null;
  const lieu = [e.ville, e.pays_hote_nom].filter(Boolean).join(", ");
  const txtC = estPasse ? "#4a5568" : "#1a1a2e";
  const hoverC = accent ? accent.c : accentRole(e.role_apix);
  const sousTitre = statut === "a_venir"
    ? (dansCombien(e) ?? (e.edition != null ? ordinalEdition(e.edition) : null))
    : (e.edition != null ? ordinalEdition(e.edition) : null);

  const marquee = (ev: React.MouseEvent, reset: boolean) => {
    ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box => {
      const span = box.firstElementChild as HTMLElement | null;
      if (!span) return;
      if (reset) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; return; }
      const d = span.scrollWidth - (box as HTMLElement).clientWidth;
      if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; }
    });
  };

  return (
    <div onClick={onVoir}
      style={{ background: estPasse ? "#FBFAF9" : "#fff", border: accent ? `1.5px solid ${accent.b}` : "1px solid rgba(16,26,46,0.12)", borderRadius: 16, cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow: accent ? accent.sh : "none", display: "flex", flexDirection: "column" as const, overflow: "hidden", opacity: e.est_publie === false ? 0.85 : 1 }}
      onMouseEnter={ev => { ev.currentTarget.style.boxShadow = "var(--ombre-1)"; ev.currentTarget.style.transform = "translateY(-2px)"; ev.currentTarget.style.borderColor = accent ? accent.b2 : `${hoverC}55`; marquee(ev, false); }}
      onMouseLeave={ev => { ev.currentTarget.style.boxShadow = accent ? accent.sh : "none"; ev.currentTarget.style.transform = "none"; ev.currentTarget.style.borderColor = accent ? accent.b : "rgba(16,26,46,0.12)"; marquee(ev, true); }}>

      {/* Bande d'accent : prochain événement (bleu) / en cours (vert) */}
      {accent && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: accent.grad, padding: "6px 16px", flexShrink: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", animation: "pulseDot 1.6s ease-out infinite", flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>{accent.label}</span>
        </div>
      )}

      <div style={{ padding: "18px 20px 16px", flex: 1, display: "flex", flexDirection: "column" as const, gap: 13 }}>
        {/* Titre + échéance | publication & rôle APIX */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15.5, color: txtC, lineHeight: 1.35, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{e.nom_event}</div>
            {sousTitre && <div style={{ fontSize: 11, fontWeight: 500, color: "#9aa5b4", marginTop: 3 }}>{sousTitre}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {e.est_publie === false && <span style={{ ...badge_gris, whiteSpace: "nowrap" as const, flexShrink: 0 }}>Non publié</span>}
            {e.role_apix && <span style={{ ...(ROLE_BADGE[e.role_apix] || badge_gris), whiteSpace: "nowrap" as const, flexShrink: 0 }}>{ROLES_APIX_LABELS[e.role_apix] || e.role_apix}</span>}
          </div>
        </div>

        {/* Date · Lieu en rangée épurée */}
        <div style={{ display: "flex", alignItems: "center", borderTop: "1px solid #F2F0EF", paddingTop: 13, marginTop: "auto" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#9aa5b4", textTransform: "uppercase" as const, marginBottom: 4 }}>Date</p>
            <p data-marquee style={{ fontSize: 12.5, fontWeight: 700, color: dateStr ? txtC : "#C5BFBB", fontVariantNumeric: "tabular-nums", overflow: "hidden", whiteSpace: "nowrap" as const }}>
              <span style={{ display: "inline-block" }}>{dateStr || "—"}</span>
            </p>
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: "#F2F0EF", margin: "0 18px" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#9aa5b4", textTransform: "uppercase" as const, marginBottom: 4 }}>Lieu</p>
            <p data-marquee style={{ fontSize: 12.5, fontWeight: 700, color: lieu ? txtC : "#C5BFBB", overflow: "hidden", whiteSpace: "nowrap" as const }}>
              <span style={{ display: "inline-block" }}>{lieu || "—"}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Actions d'administration */}
      <div className="ro-w" style={{ display: "flex", alignItems: "stretch", borderTop: "1px solid #F2F0EF" }} onClick={ev => ev.stopPropagation()}>
        <button onClick={onEditer}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "10px 0", fontSize: 11.5, color: "#004f91", fontWeight: 600, fontFamily: "var(--font-google-sans)", transition: "background 0.15s" }}
          onMouseEnter={ev => ev.currentTarget.style.background = "rgba(0,79,145,0.05)"}
          onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
          <Pencil size={12} /> Modifier
        </button>
        <div style={{ width: 1, background: "#F2F0EF" }} />
        <button onClick={onPublier} disabled={publiant}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "10px 0", fontSize: 11.5, color: e.est_publie ? "#188038" : "#ca631f", fontWeight: 600, fontFamily: "var(--font-google-sans)", transition: "background 0.15s" }}
          onMouseEnter={ev => ev.currentTarget.style.background = e.est_publie ? "rgba(24,128,56,0.05)" : "rgba(202,99,31,0.06)"}
          onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
          {publiant ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : e.est_publie ? <><EyeOff size={12} /> Retirer</> : <><Eye size={12} /> Publier</>}
        </button>
        <div style={{ width: 1, background: "#F2F0EF" }} />
        <button onClick={onSupprimer} disabled={supprimant} title="Supprimer"
          style={{ width: 46, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", transition: "background 0.15s" }}
          onMouseEnter={ev => ev.currentTarget.style.background = "rgba(220,38,38,0.05)"}
          onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
          {supprimant ? <Loader2 size={12} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} style={{ color: "#dc2626" }} />}
        </button>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function EvenementsAdminPage() {
  const [tous,       setTous]       = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [erreur,     setErreur]     = useState(false);
  const [modal,      setModal]      = useState(false);
  const [editItem,   setEditItem]   = useState<any>(null);
  const [vue,        setVue]        = useState<any>(null);
  const [deleting,   setDeleting]   = useState<any>(null);
  const [togglingId, setTogglingId] = useState<any>(null);

  // Filtres
  const [recherche,    setRecherche]    = useState("");
  const [statutFiltre, setStatutFiltre] = useState("");
  const [pubFiltre,    setPubFiltre]    = useState("");
  const [paysFiltres,  setPaysFiltres]  = useState<string[]>([]);
  const [secteursSel,  setSecteursSel]  = useState<string[]>([]);
  const [branchesSel,  setBranchesSel]  = useState<string[]>([]);
  const [activitesSel, setActivitesSel] = useState<string[]>([]);

  // Barre de filtre redimensionnable (comme les pages publiques)
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 200, 520);

  const { arbre: secteurs } = useNaemaArbre();

  const charger = useCallback(async () => {
    setLoading(true); setErreur(false);
    try {
      const data = await api.evenements.liste("per_page=1000&admin=true");
      setTous(data.data || []);
    } catch (e) { console.error(e); setErreur(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const openCreate = () => { setEditItem(null); setModal(true); };
  const openEdit   = (e: any) => { setEditItem(e); setModal(true); };

  const handleDelete = async (id: any) => {
    if (!(await confirmer("Supprimer cet événement ?"))) return;
    setDeleting(id);
    try { await api.evenements.supprimer(id); charger(); }
    finally { setDeleting(null); }
  };

  const handleTogglePublie = async (e: any) => {
    setTogglingId(e.id);
    try {
      await fetch(`${API_BASE}/evenements/${e.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ est_publie: !e.est_publie }) });
      charger();
    } finally { setTogglingId(null); }
  };

  // Pays hôtes présents dans les données (publiés ET brouillons)
  const paysHotes = useMemo(
    () => [...new Set(tous.map(e => e.pays_hote_nom).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "fr")) as string[],
    [tous]);

  const evenements = useMemo(() => tous.filter(e => {
    if (recherche) {
      const q = recherche.toLowerCase();
      if (!e.nom_event?.toLowerCase().includes(q) && !e.organisateur?.toLowerCase().includes(q)
        && !e.ville?.toLowerCase().includes(q) && !e.pays_hote_nom?.toLowerCase().includes(q)) return false;
    }
    if (pubFiltre === "publie"    && e.est_publie === false) return false;
    if (pubFiltre === "brouillon" && e.est_publie !== false) return false;
    if (statutFiltre) {
      const statut = computeStatut(e) ?? ((e.prochain_annee || e.prochain_mois) ? "a_venir" : null);
      if (statut !== statutFiltre) return false;
    }
    if (paysFiltres.length > 0 && !paysFiltres.includes(e.pays_hote_nom || "")) return false;
    if (secteursSel.length  > 0 && !secteursSel.some(s => (e.secteur_noms  || []).includes(s))) return false;
    if (branchesSel.length  > 0 && !branchesSel.some(b => (e.branche_noms  || []).includes(b))) return false;
    if (activitesSel.length > 0 && !activitesSel.some(a => (e.activite_noms || []).includes(a))) return false;
    return true;
  }), [tous, recherche, pubFiltre, statutFiltre, paysFiltres, secteursSel, branchesSel, activitesSel]);

  // Prochain événement à venir (date la plus proche dans le futur)
  const prochainId = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let best: any = null, bestD: Date | null = null;
    evenements.forEach(e => {
      const d = e.date_debut ? new Date(e.date_debut + "T00:00:00")
        : e.prochain_annee ? new Date(e.prochain_annee, (e.prochain_mois || 1) - 1, e.prochain_jour || 1) : null;
      if (d && d > today && (!bestD || d < bestD)) { bestD = d; best = e; }
    });
    return best?.id ?? null;
  }, [evenements]);

  const nbFiltres = (recherche ? 1 : 0) + (statutFiltre ? 1 : 0) + (pubFiltre ? 1 : 0)
    + paysFiltres.length + secteursSel.length + branchesSel.length + activitesSel.length;
  const hasFilter = nbFiltres > 0;
  const reinit = () => { setRecherche(""); setStatutFiltre(""); setPubFiltre(""); setPaysFiltres([]); setSecteursSel([]); setBranchesSel([]); setActivitesSel([]); };

  const togglePays     = (v: string) => setPaysFiltres(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleSecteur  = (v: string) => { setSecteursSel(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]); setBranchesSel([]); setActivitesSel([]); };
  const toggleBranche  = (v: string) => { setBranchesSel(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]); setActivitesSel([]); };
  const toggleActivite = (v: string) => setActivitesSel(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  return (
    <div style={{ fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
@keyframes pulseDotC{0%{box-shadow:0 0 0 0 var(--pc)}70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}`}</style>

      {/* ── Bandeau ── */}
      <BarreTitre titre="Événements" compact actions={<AdminMenu />}>
        <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 12px", borderRadius: 999, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{tous.length}</span>
      </BarreTitre>

      {/* ── Corps : barre de filtre + grille ── */}
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <aside style={{ width: sidebarOpen ? sidebarWidth : 52, flexShrink: 0, transition: isResizing.current ? "none" : "width 0.25s", background: "#fff", borderRight: "1px solid #E8E5E3", height: "100vh", overflowY: "auto" as const, position: "sticky" as const, top: 0, display: "flex", flexDirection: "column" as const }}>
          <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
          {sidebarOpen && <div onMouseDown={startResize} style={{ position: "absolute" as const, right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 10, background: "transparent", transition: "background 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.5)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }} />}
          <div style={{ padding: sidebarOpen ? "14px 16px 10px" : "12px 8px", borderBottom: "1px solid #F2F0EF", display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "space-between" : "center", flexShrink: 0 }}>
            {sidebarOpen && <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Filtres</span>}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setSidebarOpen(o => !o)} aria-label={sidebarOpen ? "Réduire les filtres" : "Afficher les filtres"} style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px", display: "flex", alignItems: "center", gap: 5 }}>
                <SlidersHorizontal size={14} style={{ color: "#004f91" }} />
                {sidebarOpen && nbFiltres > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.15)", borderRadius: 999, padding: "1px 5px" }}>{nbFiltres}</span>}
              </button>
              {sidebarOpen && hasFilter && <button onClick={reinit} title="Tout réinitialiser"
                style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.20)", cursor: "pointer", borderRadius: 999, padding: "5px", display: "flex", alignItems: "center", transition: "background 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(220,38,38,0.08)"; }}>
                <X size={13} style={{ color: "#dc2626" }} />
              </button>}
            </div>
          </div>
          {sidebarOpen && <div style={{ padding: "16px", overflowY: "auto" as const, flex: 1 }}>
            <div style={{ position: "relative" as const, marginBottom: 18 }}>
              <Search size={13} style={{ position: "absolute" as const, left: 9, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
              <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher…"
                style={{ width: "100%", paddingLeft: 30, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 12, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const }} />
              {recherche && <button onClick={() => setRecherche("")} aria-label="Effacer la recherche" style={{ position: "absolute" as const, right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "#9aa5b4" }} /></button>}
            </div>
            <FiltreRadio label="Statut" options={STATUT_OPTS} value={statutFiltre} onChange={setStatutFiltre} />
            <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
            <FiltreRadio label="Publication" options={PUB_OPTS} value={pubFiltre} onChange={setPubFiltre} />
            {paysHotes.length > 0 && <>
              <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
              <SideFilter label="Pays hôte" color="#004f91" marginBottom={20} items={paysHotes} selected={paysFiltres} onToggle={togglePays} listMaxHeight={200} />
            </>}
            {secteurs.length > 0 && <>
              <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
              <ThematiquesCascadeFilter secteurs={secteurs} secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel}
                onSecteur={toggleSecteur} onBranche={toggleBranche} onActivite={toggleActivite} />
            </>}
          </div>}
        </aside>

        {/* Grille */}
        <div style={{ flex: 1, minWidth: 0, padding: "28px 40px 80px" }}>
          {/* Barre d'action */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" as const }}>
            <span style={{ fontSize: 12.5, color: "#9aa5b4", fontWeight: 600 }}>
              {hasFilter ? `${evenements.length} sur ${tous.length} événement${tous.length > 1 ? "s" : ""}` : `${tous.length} événement${tous.length > 1 ? "s" : ""}`}
            </span>
            <button className="ro-w" onClick={openCreate}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#004f91", color: "#fff", fontWeight: 700, fontSize: 13, padding: "10px 20px", borderRadius: 999, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(0,79,145,0.30)", fontFamily: "var(--font-google-sans)", transition: "background 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#013e73"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#004f91"; }}>
              <Plus size={15} /> Ajouter un événement
            </button>
          </div>

          {loading ? (
            <SkeletonCards n={6} cols={2} height={220} />
          ) : erreur ? (
            <ErreurChargement onRetry={() => charger()} />
          ) : evenements.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
              <CalendarDays size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Aucun événement {hasFilter ? "trouvé" : "enregistré"}</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>{hasFilter ? "Modifiez vos filtres pour affiner la recherche." : "Cliquez sur « Ajouter un événement » pour commencer."}</p>
              {hasFilter && <BoutonEffacerFiltres onClick={reinit} />}
            </div>
          ) : (
            <div className="charge-in" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
              {evenements.map(e => (
                <CarteEvenement key={e.id} e={e} estProchain={prochainId != null && e.id === prochainId}
                  onVoir={() => setVue(e)} onEditer={() => openEdit(e)}
                  onPublier={() => handleTogglePublie(e)} onSupprimer={() => handleDelete(e.id)}
                  publiant={togglingId === e.id} supprimant={deleting === e.id} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fiche (même modal que la page publique) + raccourci de modification */}
      <EvenementVueModal ev={vue} onClose={() => setVue(null)} actions={vue ? (
        <button className="ro-w" onClick={() => { const v = vue; setVue(null); openEdit(v); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 10, border: "none", background: "#004f91", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "var(--font-google-sans)", boxShadow: "0 3px 12px rgba(0,79,145,0.25)" }}>
          <Pencil size={13} /> Modifier
        </button>
      ) : null} />

      <EvenementModal open={modal} onClose={() => setModal(false)} editItem={editItem} onSaved={charger} />
    </div>
  );
}
