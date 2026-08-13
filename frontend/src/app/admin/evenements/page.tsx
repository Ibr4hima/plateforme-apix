"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, FileText, Loader2, Upload, X, CalendarDays, Search } from "lucide-react";
import { api } from "@/lib/api";
import { authHeaders } from "@/lib/authHeaders";
import BarreTitre from "@/components/shared/BarreTitre";
import EvenementVueModal from "@/components/shared/EvenementVueModal";
import { SkeletonCards } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { fetchTous } from "@/lib/fetchTous";
import { badge_vert, badge_orange, badge_bleu, badge_violet, badge_ambre, badge_gris } from "@/lib/couleurs";
import NaemaSelect from "@/components/shared/NaemaSelect";
import RichTextEditor from "@/components/shared/RichTextEditor";
import PaysSelect from "@/components/shared/PaysSelect";
import PaysMultiSelect from "@/components/shared/PaysMultiSelect";
import { FModal, FSection, FGrid, FPanel, FLabel, FInput, FSelect, FSegmented, FToggle, FButton, FButtonGhost, FError, FInfo } from "@/components/shared/FormUI";
import { confirmer } from "@/components/shared/Confirmation";
import { carteCliquable } from "@/components/shared/PanneauFiltres";
import { ChampRecherche, Segments } from "@/components/admin/UIAdmin";
import { fmtPlageDates } from "@/lib/format";
import { computeStatutEvenement as computeStatut } from "@/lib/statuts";

import { API_BASE } from "@/lib/api";

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

// Date de référence d'un événement : sa date de début, ou le prochain rendez-vous
// annoncé pour les récurrents qui n'ont pas encore de date ferme.
function dateDebutDe(e: any): Date | null {
  if (e.date_debut) return new Date(e.date_debut + "T00:00:00");
  if (e.prochain_annee) return new Date(e.prochain_annee, (e.prochain_mois || 1) - 1, e.prochain_jour || 1);
  return null;
}

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
              style={form.edition&&(isNaN(parseInt(form.edition))||parseInt(form.edition)<=0)?{ borderColor:"var(--danger)" }:undefined} />
            {form.edition&&parseInt(form.edition)>0&&<span style={{ fontSize: "var(--t-11)", color:"var(--vert)", marginTop:3, display:"block" }}>{ordinalEdition(parseInt(form.edition))}</span>}
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
                {grise && <span style={{ fontSize: "var(--t-11)", color:"var(--gris)" }}>Dates calculées depuis le prochain événement</span>}
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
                      style={form.date_fin&&form.date_fin<=form.date_debut?{ borderColor:"var(--danger)" }:undefined} />
                    {form.date_fin&&form.date_fin<=form.date_debut&&<span style={{ fontSize: "var(--t-11)", color:"var(--danger)", marginTop:3, display:"block" }}>La date de fin doit être après la date de début</span>}
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
              <div key={fi.id} style={{ display:"flex", alignItems:"center", gap:8, background:"rgb(var(--bleu-rgb) / 0.05)", border:"1px solid rgb(var(--bleu-rgb) / 0.15)", borderRadius:10, padding:"8px 12px" }}>
                <FileText size={13} style={{ color:"var(--bleu)" }} />
                <a href={`${API_BASE}/evenements/${editItem?.id}/fichiers/${fi.id}/download`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: "var(--t-13)", flex:1, color:"var(--encre)", fontWeight:500, textDecoration:"none" }}>{fi.titre}</a>
                <button onClick={()=>supprimerFichier(fi.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={13} style={{ color:"var(--danger)" }} /></button>
              </div>
            ))}
          </div>
        )}
        <label style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderRadius:10, cursor:"pointer", border:"2px dashed var(--bordure-forte)", background:"var(--carte-douce)", transition:"border-color 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="var(--bleu)"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bordure-forte)"}>
          <Upload size={14} color="var(--gris)" />
          <span style={{ fontSize: "var(--t-13)", color:"var(--gris)" }}>Ajouter un ou plusieurs PDF</span>
          <input type="file" accept=".pdf" multiple style={{ display:"none" }}
            onChange={e=>{ const files=Array.from(e.target.files||[]); setPdfQueue(prev=>[...prev, ...files.map(f=>({ file:f, titre:f.name.replace(/\.pdf$/i,"") }))]); e.target.value=""; }} />
        </label>
        {pdfQueue.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:5, marginTop:8 }}>
            {pdfQueue.map((pq, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:"rgb(var(--violet-rgb) / 0.05)", border:"1px solid rgb(var(--violet-rgb) / 0.2)", borderRadius:10, padding:"8px 12px" }}>
                <FileText size={13} style={{ color:"var(--violet)" }} />
                <input value={pq.titre} onChange={e=>setPdfQueue(prev=>prev.map((x,j)=>j===i?{ ...x, titre:e.target.value }:x))} placeholder="Titre du document"
                  style={{ flex:1, background:"transparent", border:"none", borderBottom:"1px solid rgb(var(--violet-rgb) / 0.3)", outline:"none", fontSize: "var(--t-125)", padding:"2px 0", fontFamily:"var(--font-google-sans)" }} />
                <button onClick={()=>setPdfQueue(prev=>prev.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={13} style={{ color:"var(--danger)" }} /></button>
              </div>
            ))}
            <p style={{ fontSize: "var(--t-11)", color:"var(--gris)" }}>Les fichiers seront téléversés à l&apos;enregistrement.</p>
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
  "Organisateur": "var(--vert)", "Co-organisateur": "var(--vert)",
  "Participant": "var(--orange)", "Partenaire": "var(--bleu)",
  "Invité": "var(--violet)", "Sponsor": "var(--ambre)",
};
const accentRole = (role?: string | null) => (role && ROLE_ACCENT[role]) || "var(--bleu)";

// Échéance d'un événement à venir : « Dans 2 ans », « Dans 3 mois », « Dans 12 jours »
function dansCombien(e: any): string | null {
  const d = dateDebutDe(e);
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
    ? { c: "var(--bleu)", grad: "linear-gradient(90deg,var(--bleu-nuit) 0%,var(--bleu) 60%,var(--bleu-clair) 100%)", label: "Prochain événement", b: "rgb(var(--bleu-rgb) / 0.45)", b2: "rgb(var(--bleu-rgb) / 0.6)", sh: "0 4px 18px rgb(var(--bleu-rgb) / 0.15)" }
    : estEnCours
    ? { c: "var(--vert)", grad: "linear-gradient(90deg,var(--vert-fonce) 0%,var(--vert) 60%,var(--vert) 100%)", label: "Événement en cours", b: "rgb(var(--vert-rgb) / 0.45)", b2: "rgb(var(--vert-rgb) / 0.6)", sh: "0 4px 18px rgb(var(--vert-rgb) / 0.15)" }
    : null;
  // Plage compacte (« 6 → 10 juin 2026 ») : une plage écrite en entier des deux
  // côtés déborde de la colonne et se fait tronquer.
  const dateStr = e.date_debut
    ? fmtPlageDates(e.date_debut, e.date_fin)
    : e.prochain_mois ? `${e.prochain_jour ? e.prochain_jour + " " : ""}${MOIS_VIEW[(e.prochain_mois || 1) - 1]} ${e.prochain_annee || ""}`.trim() : null;
  const lieu = [e.ville, e.pays_hote_nom].filter(Boolean).join(", ");
  const txtC = estPasse ? "var(--texte)" : "var(--encre)";
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
    <div {...carteCliquable(onVoir, `Ouvrir la fiche : ${e.nom_event}`)}
      style={{ background: estPasse ? "var(--carte-douce)" : "var(--carte)", border: accent ? `1.5px solid ${accent.b}` : "1px solid rgb(var(--encre-rgb) / 0.12)", borderRadius: 16, cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow: accent ? accent.sh : "none", display: "flex", flexDirection: "column" as const, overflow: "hidden", opacity: e.est_publie === false ? 0.85 : 1 }}
      onMouseEnter={ev => { ev.currentTarget.style.boxShadow = "var(--ombre-1)"; ev.currentTarget.style.transform = "translateY(-2px)"; ev.currentTarget.style.borderColor = accent ? accent.b2 : `${hoverC}55`; marquee(ev, false); }}
      onMouseLeave={ev => { ev.currentTarget.style.boxShadow = accent ? accent.sh : "none"; ev.currentTarget.style.transform = "none"; ev.currentTarget.style.borderColor = accent ? accent.b : "rgb(var(--encre-rgb) / 0.12)"; marquee(ev, true); }}>

      {/* Bande d'accent : prochain événement (bleu) / en cours (vert) */}
      {accent && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: accent.grad, padding: "6px 16px", flexShrink: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--carte)", animation: "pulseDot 1.6s ease-out infinite", flexShrink: 0 }} />
          <span style={{ fontSize: "var(--t-10)", fontWeight: 800, color: "var(--sur-bleu)", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>{accent.label}</span>
        </div>
      )}

      <div style={{ padding: "18px 20px 16px", flex: 1, display: "flex", flexDirection: "column" as const, gap: 13 }}>
        {/* Titre + échéance | publication & rôle APIX */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "var(--t-15)", color: txtC, lineHeight: 1.35, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{e.nom_event}</div>
            {sousTitre && <div style={{ fontSize: "var(--t-11)", fontWeight: 500, color: "var(--gris)", marginTop: 3 }}>{sousTitre}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {e.est_publie === false && <span style={{ ...badge_gris, whiteSpace: "nowrap" as const, flexShrink: 0 }}>Non publié</span>}
            {e.role_apix && <span style={{ ...(ROLE_BADGE[e.role_apix] || badge_gris), whiteSpace: "nowrap" as const, flexShrink: 0 }}>{ROLES_APIX_LABELS[e.role_apix] || e.role_apix}</span>}
          </div>
        </div>

        {/* Date · Lieu en rangée épurée */}
        <div style={{ display: "flex", alignItems: "center", borderTop: "1px solid var(--bordure)", paddingTop: 13, marginTop: "auto" }}>
          {/* La date prend un peu plus de place que le lieu, et rétrécit d'un
              cran sur les plages à cheval sur deux années — la seule forme qui
              ne tient pas dans la colonne (« 28 déc. 2026 → 3 janv. 2027 »). */}
          <div style={{ flex: 1.15, minWidth: 0 }}>
            <p style={{ fontSize: "var(--t-9)", fontWeight: 800, letterSpacing: "0.12em", color: "var(--gris)", textTransform: "uppercase" as const, marginBottom: 4 }}>Date</p>
            <p data-marquee style={{ fontSize: (dateStr?.length ?? 0) > 22 ? 11 : 12.5, fontWeight: 700, color: dateStr ? txtC : "var(--gris)", fontVariantNumeric: "tabular-nums", overflow: "hidden", whiteSpace: "nowrap" as const }}>
              <span style={{ display: "inline-block" }}>{dateStr || "—"}</span>
            </p>
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: "var(--fond)", margin: "0 18px" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: "var(--t-9)", fontWeight: 800, letterSpacing: "0.12em", color: "var(--gris)", textTransform: "uppercase" as const, marginBottom: 4 }}>Lieu</p>
            <p data-marquee style={{ fontSize: "var(--t-125)", fontWeight: 700, color: lieu ? txtC : "var(--gris)", overflow: "hidden", whiteSpace: "nowrap" as const }}>
              <span style={{ display: "inline-block" }}>{lieu || "—"}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Actions d'administration — la barre retient clic ET clavier : sans quoi
          Entrée sur « Modifier » remonterait à la carte et ouvrirait la fiche. */}
      <div className="ro-w" style={{ display: "flex", alignItems: "stretch", borderTop: "1px solid var(--bordure)" }}
        onClick={ev => ev.stopPropagation()} onKeyDown={ev => ev.stopPropagation()}>
        <button onClick={onEditer}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "10px 0", fontSize: "var(--t-115)", color: "var(--bleu)", fontWeight: 600, fontFamily: "var(--font-google-sans)", transition: "background 0.15s" }}
          onMouseEnter={ev => ev.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.05)"}
          onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
          <Pencil size={12} /> Modifier
        </button>
        <div style={{ width: 1, background: "var(--fond)" }} />
        <button onClick={onPublier} disabled={publiant}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "10px 0", fontSize: "var(--t-115)", color: e.est_publie ? "var(--vert)" : "var(--orange)", fontWeight: 600, fontFamily: "var(--font-google-sans)", transition: "background 0.15s" }}
          onMouseEnter={ev => ev.currentTarget.style.background = e.est_publie ? "rgb(var(--vert-rgb) / 0.05)" : "rgb(var(--orange-rgb) / 0.06)"}
          onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
          {publiant ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : e.est_publie ? <><EyeOff size={12} /> Retirer</> : <><Eye size={12} /> Publier</>}
        </button>
        <div style={{ width: 1, background: "var(--fond)" }} />
        <button onClick={onSupprimer} disabled={supprimant} title="Supprimer"
          style={{ width: 46, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", transition: "background 0.15s" }}
          onMouseEnter={ev => ev.currentTarget.style.background = "rgb(var(--danger-rgb) / 0.05)"}
          onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
          {supprimant ? <Loader2 size={12} style={{ color: "var(--danger)", animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} style={{ color: "var(--danger)" }} />}
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
  // Filtres de la barre d'outils
  const [q,       setQ]       = useState("");
  const [statutF, setStatutF] = useState<"tous"|"a_venir"|"en_cours"|"termine">("tous");
  const [pubF,    setPubF]    = useState<"tous"|"publies"|"prives">("tous");

  const charger = useCallback(async () => {
    setLoading(true); setErreur(false);
    try {
      // Pagination complète : `per_page` est plafonné à 100 côté API, on suit
      // les pages pour ne rien tronquer au-delà de 100 événements.
      setTous(await fetchTous(`${API_BASE}/evenements?admin=true`));
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

  // Prochain événement à venir (date la plus proche dans le futur)
  const prochainId = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let best: any = null, bestD: Date | null = null;
    tous.forEach(e => {
      const d = dateDebutDe(e);
      if (d && d > today && (!bestD || d < bestD)) { bestD = d; best = e; }
    });
    return best?.id ?? null;
  }, [tous]);

  // Statut affiché : les récurrents sans date ferme comptent comme « à venir »,
  // c'est ce que dit leur carte.
  const statutDe = (e: any) => computeStatut(e) ?? ((e.prochain_annee || e.prochain_mois) ? "a_venir" : null);

  // Liste affichée : filtres de la barre d'outils puis ordre de travail —
  // en cours d'abord, puis les prochains par échéance, les sans-date, et enfin
  // les passés du plus récent au plus ancien. L'API rendait un ordre qui
  // renvoyait le prochain événement en fin de grille.
  const liste = useMemo(() => {
    const texte = q.trim().toLowerCase();
    const filtres = tous.filter(e => {
      if (pubF === "publies" && e.est_publie === false) return false;
      if (pubF === "prives"  && e.est_publie !== false) return false;
      if (statutF !== "tous" && statutDe(e) !== statutF) return false;
      if (!texte) return true;
      return [e.nom_event, e.organisateur, e.ville, e.pays_hote_nom, e.role_apix]
        .filter(Boolean).some((v: string) => v.toLowerCase().includes(texte));
    });
    const rang = (e: any) => { const s = statutDe(e); return s === "en_cours" ? 0 : s === "a_venir" ? 1 : s === null ? 2 : 3; };
    return filtres.sort((a, b) => {
      const ra = rang(a), rb = rang(b);
      if (ra !== rb) return ra - rb;
      const da = dateDebutDe(a)?.getTime() ?? 0, db = dateDebutDe(b)?.getTime() ?? 0;
      if (da !== db) return ra === 3 ? db - da : da - db;   // passés : du plus récent
      return (a.nom_event || "").localeCompare(b.nom_event || "", "fr");
    });
  }, [tous, q, statutF, pubF]);

  const nbFiltres = (q ? 1 : 0) + (statutF !== "tous" ? 1 : 0) + (pubF !== "tous" ? 1 : 0);
  const reinit = () => { setQ(""); setStatutF("tous"); setPubF("tous"); };
  // Compteurs des onglets de statut, calculés sur le seul filtre de publication
  // (sinon « À venir (3) » afficherait 3 alors que l'onglet est déjà actif).
  const parStatut = useMemo(() => {
    const base = tous.filter(e => pubF === "tous" || (pubF === "publies" ? e.est_publie !== false : e.est_publie === false));
    return {
      tous: base.length,
      a_venir:  base.filter(e => statutDe(e) === "a_venir").length,
      en_cours: base.filter(e => statutDe(e) === "en_cours").length,
      termine:  base.filter(e => statutDe(e) === "termine").length,
    };
  }, [tous, pubF]);

  return (
    <div style={{ fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
@keyframes pulseDotC{0%{box-shadow:0 0 0 0 var(--pc)}70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}`}</style>

      {/* ── Bandeau orange (espace d'administration) ── */}
      <BarreTitre titre="Événements" compact ton="orange" pleineLargeur
        droite={
          <button className="ro-w" onClick={openCreate}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--carte)", color: "var(--orange)", fontWeight: 700, fontSize: "var(--t-13)", padding: "9px 18px", borderRadius: 999, border: "none", cursor: "pointer", boxShadow: "0 3px 12px rgb(var(--ombre-rgb) / 0.16)", fontFamily: "var(--font-google-sans)", transition: "background 0.15s, transform 0.15s", flexShrink: 0, whiteSpace: "nowrap" as const }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--orange-voile)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--carte)"; e.currentTarget.style.transform = "none"; }}>
            <Plus size={15} /> Ajouter un événement
          </button>
        }>
        <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 12px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.24)", fontSize: "var(--t-12)", fontWeight: 700, color: "var(--sur-bleu)", flexShrink: 0 }}>{tous.length}</span>
      </BarreTitre>

      {/* ── Barre d'outils + grille ── */}
      <div style={{ padding: "22px 32px 80px" }}>
        {!loading && !erreur && tous.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const, background: "var(--carte)",
            border: "1px solid rgb(var(--encre-rgb) / 0.10)", borderRadius: 14, padding: "11px 14px", marginBottom: 16 }}>
            <ChampRecherche value={q} onChange={setQ} placeholder="Nom, organisateur, ville, pays…" style={{ width: 268 }} />
            <Segments value={statutF} onChange={setStatutF} accent="var(--orange)" options={[
              { v: "tous",     l: "Tous",     n: parStatut.tous },
              { v: "a_venir",  l: "À venir",  n: parStatut.a_venir },
              { v: "en_cours", l: "En cours", n: parStatut.en_cours },
              { v: "termine",  l: "Passés",   n: parStatut.termine },
            ] as const} />
            <span style={{ width: 1, height: 22, background: "var(--fond)" }} />
            <Segments value={pubF} onChange={setPubF} accent="var(--orange)" options={[
              { v: "tous",    l: "Tous" },
              { v: "publies", l: "Publiés" },
              { v: "prives",  l: "Non publiés" },
            ] as const} />
            {nbFiltres > 0 && (
              <button onClick={reinit} title="Tout réinitialiser"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgb(var(--danger-rgb) / 0.07)",
                  border: "1px solid rgb(var(--danger-rgb) / 0.20)", color: "var(--danger)", borderRadius: 999, padding: "6px 13px",
                  fontSize: "var(--t-115)", fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>
                <X size={12} /> Réinitialiser
              </button>
            )}
            <span style={{ marginLeft: "auto", fontSize: "var(--t-12)", fontWeight: 700, color: "var(--gris)", whiteSpace: "nowrap" as const }}>
              {liste.length === tous.length
                ? `${tous.length} événement${tous.length > 1 ? "s" : ""}`
                : `${liste.length} sur ${tous.length}`}
            </span>
          </div>
        )}

        {loading ? (
          <SkeletonCards n={6} cols={3} height={220} />
        ) : erreur ? (
          <ErreurChargement onRetry={() => charger()} />
        ) : tous.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--gris)" }}>
            <CalendarDays size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p style={{ fontSize: "var(--t-16)", fontWeight: 600, color: "var(--texte)" }}>Aucun événement enregistré</p>
            <p style={{ fontSize: "var(--t-14)", marginTop: 6 }}>Cliquez sur « Ajouter un événement » pour commencer.</p>
          </div>
        ) : liste.length === 0 ? (
          <div style={{ textAlign: "center", padding: "70px 24px", color: "var(--gris)" }}>
            <Search size={44} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p style={{ fontSize: "var(--t-16)", fontWeight: 600, color: "var(--texte)" }}>Aucun événement pour ces filtres</p>
            <button onClick={reinit}
              style={{ marginTop: 14, background: "none", border: "none", cursor: "pointer", fontSize: "var(--t-13)", fontWeight: 700,
                color: "var(--orange)", fontFamily: "var(--font-google-sans)", textDecoration: "underline" }}>
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="charge-in" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
            {liste.map(e => (
              <CarteEvenement key={e.id} e={e} estProchain={prochainId != null && e.id === prochainId}
                onVoir={() => setVue(e)} onEditer={() => openEdit(e)}
                onPublier={() => handleTogglePublie(e)} onSupprimer={() => handleDelete(e.id)}
                publiant={togglingId === e.id} supprimant={deleting === e.id} />
            ))}
          </div>
        )}
      </div>

      {/* Fiche (même modal que la page publique) + raccourci de modification */}
      <EvenementVueModal ev={vue} onClose={() => setVue(null)} actions={vue ? (
        <button className="ro-w" onClick={() => { const v = vue; setVue(null); openEdit(v); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 10, border: "none", background: "var(--bleu-action)", color: "var(--sur-bleu)", fontWeight: 700, cursor: "pointer", fontSize: "var(--t-13)", fontFamily: "var(--font-google-sans)", boxShadow: "0 3px 12px rgb(var(--ombre-rgb) / 0.25)" }}>
          <Pencil size={13} /> Modifier
        </button>
      ) : null} />

      <EvenementModal open={modal} onClose={() => setModal(false)} editItem={editItem} onSaved={charger} />
    </div>
  );
}
