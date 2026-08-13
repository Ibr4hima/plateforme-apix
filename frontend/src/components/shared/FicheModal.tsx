"use client";

// ── Fiche modale des pages publiques — une seule coquille pour toutes les
// fiches (entreprise, événement, accord, projet, potentialité, avantage,
// zone, prospect) : voile flouté, panneau à filet fin, en-tête au titre seul,
// corps en sections, pied « Fermer » (+ actions en admin).
//
// Jetons : pastilles = badge_bleu/orange/vert/violet… (lib/couleurs),
// blocs libellés = FICHE_BLOC (bleu à 4 %, filet à 10 %).

import { FileText, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useDialogue } from "@/lib/dialogue";
import { badge_bleu, badge_vert } from "@/lib/couleurs";
import { fmtPhone } from "@/lib/telephone";

// ── Coquille ──────────────────────────────────────────────────────────────────
export default function FicheModal({ titre, onClose, zIndex = 400, maxWidth = 640, actions, children }: {
  titre: React.ReactNode;
  onClose: () => void;
  zIndex?: number;
  maxWidth?: number;
  actions?: React.ReactNode;     // boutons additionnels dans le pied (ex. « Modifier » en admin)
  children: React.ReactNode;
}) {
  // Fermer seulement si le clic a COMMENCÉ sur le voile : une sélection de
  // texte qui déborde du panneau ne doit pas fermer la fiche.
  const downSurFond = useRef(false);
  // Contrat clavier des modales : piège de Tab, focus pris puis restitué.
  const dial = useDialogue(true);

  // Échap ferme la fiche
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onMouseDown={e => { downSurFond.current = e.target === e.currentTarget; }}
      onClick={e => { if (downSurFond.current && e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgb(var(--encre-rgb) / 0.45)", backdropFilter: "blur(8px)", zIndex, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}
[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
      <div {...dial} aria-labelledby="fiche-modal-titre" onClick={e => e.stopPropagation()}
        style={{ background: "var(--carte)", borderRadius: 20, width: "100%", maxWidth, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--bordure)", boxShadow: "var(--ombre-2)", animation: "vueIn 0.22s ease" }}>

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "18px 28px 16px", borderBottom: "1px solid var(--bordure)", flexShrink: 0 }}>
          {/* Le titre, seul. La rangée de pastilles qui vivait ici — forme
              juridique, pôle, région, statut… — est descendue dans la section
              Informations, en blocs libellés : une pastille grise disait
              « Société Anonyme » sans dire de QUOI il s'agissait, et le lecteur
              devait deviner la nature de chaque jeton à sa couleur. */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id="fiche-modal-titre" style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--encre)", lineHeight: 1.3, margin: 0 }}>{titre}</h2>
          </div>
          <button onClick={onClose} aria-label="Fermer"
            style={{ background: "var(--champ)", border: "none", cursor: "pointer", borderRadius: 99, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
            onMouseEnter={ev => (ev.currentTarget.style.background = "var(--fond-creux2)")}
            onMouseLeave={ev => (ev.currentTarget.style.background = "var(--champ)")}>
            <X size={15} color="var(--texte)" />
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding: "22px 28px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 22 }}>
          {children}
        </div>

        {/* Pied */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "14px 28px", borderTop: "1px solid var(--bordure)", background: "var(--carte-douce)", flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--bordure-forte)", background: "var(--carte)", color: "var(--texte)", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "var(--font-google-sans)" }}>
            Fermer
          </button>
          {actions}
        </div>
      </div>
    </div>
  );
}

// ── Section titrée ────────────────────────────────────────────────────────────
export function FicheSection({ titre, count, children }: { titre: React.ReactNode; count?: number; children: React.ReactNode }) {
  return (
    <section>
      <p style={{ fontSize: 10.5, fontWeight: 700, color: "var(--bleu)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>
        {titre}{typeof count === "number" ? <span style={{ color: "var(--gris)", fontWeight: 700, marginLeft: 7 }}>{count}</span> : null}
      </p>
      {children}
    </section>
  );
}

// Grille 2 colonnes des blocs libellés
export function FicheGrille({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>{children}</div>;
}

// ── Bloc libellé ──────────────────────────────────────────────────────────────
// Le bleu des fiches KPI : un fond à 4 % et un filet à 10 %. Assez pour poser
// le champ, assez discret pour que la valeur reste le premier plan — et le
// MÊME bleu d'un bout à l'autre de la plateforme, fiches de données comme
// fiches d'entité.
export const FICHE_BLOC: React.CSSProperties = {
  background: "rgb(var(--bleu-rgb) / 0.04)",
  border: "1px solid rgb(var(--bleu-rgb) / 0.10)",
  borderRadius: 12,
};

export function FicheBloc({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ ...FICHE_BLOC, padding: "10px 13px", minWidth: 0, gridColumn: full ? "1/-1" : undefined }}>
      <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "var(--bleu)", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
      {children}
    </div>
  );
}
export function FicheValeur({ children, vide, fort }: { children?: React.ReactNode; vide?: boolean; fort?: boolean }) {
  return <p style={{ fontSize: fort ? 13 : 12.5, fontWeight: fort ? 700 : 600, color: vide ? "var(--gris)" : "var(--encre)", lineHeight: 1.45 }}>{children}</p>;
}
export function FicheLien({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href.startsWith("http") ? href : `https://${href}`} target="_blank" rel="noopener noreferrer"
      style={{ fontSize: 12.5, fontWeight: 600, color: "var(--bleu)", textDecoration: "none", wordBreak: "break-all" }}>
      {children}
    </a>
  );
}

// ── Carte neutre (texte libre, contacts…) ─────────────────────────────────────
export function FicheCarteNeutre({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "var(--carte-douce)", border: "1px solid var(--bordure)", borderRadius: 12, padding: "12px 14px", ...style }}>{children}</div>;
}

// Texte riche (description, résumé) dans une carte neutre
export function FicheTexteRiche({ html }: { html: string }) {
  return (
    <FicheCarteNeutre style={{ padding: "13px 15px" }}>
      <div data-rte dangerouslySetInnerHTML={{ __html: html }} style={{ fontSize: 13, color: "var(--texte)", lineHeight: 1.7 }} />
    </FicheCarteNeutre>
  );
}

// ── Pastilles téléphone (bleu) / email (vert) ─────────────────────────────────
export function FicheContacts({ tels = [], mails = [] }: { tels?: string[]; mails?: string[] }) {
  if (!tels.length && !mails.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
      {tels.map((t, i) => <span key={`t${i}`} style={badge_bleu}>{fmtPhone(t)}</span>)}
      {mails.map((m, i) => <span key={`m${i}`} style={{ ...badge_vert, wordBreak: "break-all" }}>{m.trim()}</span>)}
    </div>
  );
}

// ── Liste de documents téléchargeables ────────────────────────────────────────
export function FicheDocs({ fichiers, hrefDe }: { fichiers: any[]; hrefDe: (f: any) => string }) {
  if (!fichiers?.length) return null;
  return (
    <FicheSection titre={fichiers.length > 1 ? "Documents" : "Document"}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {fichiers.map((f: any) => (
          <a key={f.id} href={hrefDe(f)} target="_blank" rel="noopener noreferrer"
            style={{ ...FICHE_BLOC, display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", textDecoration: "none", transition: "background 0.15s" }}
            onMouseEnter={ev => (ev.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.10)")}
            onMouseLeave={ev => (ev.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.04)")}>
            <FileText size={13} style={{ color: "var(--bleu)", flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "var(--bleu)", fontWeight: 600 }}>{f.titre || f.fichier_nom || f.nom || "Document"}</span>
          </a>
        ))}
      </div>
    </FicheSection>
  );
}

// ── Cascade thématique à 3 niveaux ────────────────────────────────────────────
//
// La hiérarchie se lit à l'INDENTATION et à la graisse, comme dans
// l'application mobile — pas à la couleur. Le bleu / orange / vert d'avant
// faisait croire à trois familles alors qu'il s'agit d'un seul chemin :
// secteur → branche → activité. Trois couleurs vives sur cinq lignes, cela
// criait plus fort que le nom des activités.
//
// Reste : une pastille bleue sur le secteur (le point d'entrée), un filet
// vertical qui tient la descendance, la branche en encre grasse, l'activité
// en gris. Le lecteur suit une arborescence, pas un nuancier.
type Niveau = { cle: React.Key; nom: string; enfants?: Niveau[] };

export function FicheArbre({ data }: { data: Niveau[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {data.map(sec => (
        <div key={sec.cle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: sec.enfants?.length ? 8 : 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--bleu-action)", flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--encre)" }}>{sec.nom}</span>
          </div>
          {!!sec.enfants?.length && (
            <div style={{ marginLeft: 3, paddingLeft: 16, borderLeft: "1.5px solid rgb(var(--bleu-rgb) / 0.18)", display: "flex", flexDirection: "column", gap: 9 }}>
              {sec.enfants.map(bra => (
                <div key={bra.cle}>
                  <p style={{ fontSize: 12, fontWeight: 650, color: "var(--encre)", lineHeight: 1.45 }}>{bra.nom}</p>
                  {!!bra.enfants?.length && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                      {bra.enfants.map(act => (
                        <p key={act.cle} style={{ fontSize: 12, color: "var(--gris-fort)", lineHeight: 1.45 }}>{act.nom}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Cascade NAEMA depuis les référentiels + ids sélectionnés (forme la plus courante)
export function FicheArbreNaema({ secteurs, branches, activites, secIds, braIds, actIds }: {
  secteurs: any[]; branches: any[]; activites: any[]; secIds: number[]; braIds: number[]; actIds: number[];
}) {
  const data: Niveau[] = secIds
    .map(secId => {
      const sec = secteurs.find((s: any) => s.id === secId);
      if (!sec) return null;
      return {
        cle: secId, nom: sec.nom,
        enfants: branches.filter((b: any) => b.secteur_id === secId && braIds.includes(b.id)).map((bra: any) => ({
          cle: bra.id, nom: bra.nom,
          enfants: activites.filter((a: any) => a.branche_id === bra.id && actIds.includes(a.id)).map((act: any) => ({ cle: act.id, nom: act.nom })),
        })),
      };
    })
    .filter(Boolean) as Niveau[];
  if (!data.length) return null;
  return <FicheArbre data={data} />;
}
