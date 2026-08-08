"use client";

// ── Fiche modale des pages publiques — une seule coquille pour toutes les
// fiches (entreprise, événement, accord, projet, potentialité, avantage,
// zone, prospect) : voile flouté, liseré bleu, en-tête titre + pastilles,
// corps en sections, pied « Fermer » (+ actions optionnelles en admin).
//
// Jetons : pastilles = badge_bleu/orange/vert/violet… (lib/couleurs),
// blocs libellés = voile bleu (fond_bleu).

import { FileText, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { fond_bleu, badge_bleu, badge_vert } from "@/lib/couleurs";
import { fmtPhone } from "@/lib/telephone";

// ── Coquille ──────────────────────────────────────────────────────────────────
export default function FicheModal({ titre, badges, onClose, zIndex = 400, maxWidth = 640, actions, children }: {
  titre: React.ReactNode;
  badges?: React.ReactNode;      // rangée de pastilles sous le titre (badge_* de lib/couleurs)
  onClose: () => void;
  zIndex?: number;
  maxWidth?: number;
  actions?: React.ReactNode;     // boutons additionnels dans le pied (ex. « Modifier » en admin)
  children: React.ReactNode;
}) {
  // Fermer seulement si le clic a COMMENCÉ sur le voile : une sélection de
  // texte qui déborde du panneau ne doit pas fermer la fiche.
  const downSurFond = useRef(false);

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
      <div onClick={e => e.stopPropagation()}
        style={{ background: "var(--carte)", borderRadius: 20, width: "100%", maxWidth, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--ombre-2)", animation: "vueIn 0.22s ease" }}>
        {/* Liseré d'accent */}
        <div style={{ height: 4, background: "var(--bleu-action)", flexShrink: 0 }} />

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "18px 28px 16px", borderBottom: "1px solid var(--bordure)", flexShrink: 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--encre)", lineHeight: 1.3, margin: 0 }}>{titre}</h2>
            {badges && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, minWidth: 0 }}>{badges}</div>}
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
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{children}</div>;
}

// ── Bloc libellé sur voile bleu ───────────────────────────────────────────────
export function FicheBloc({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ ...fond_bleu, borderRadius: 12, padding: "9px 12px", minWidth: 0, gridColumn: full ? "1/-1" : undefined }}>
      <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "var(--bleu)", textTransform: "uppercase", marginBottom: 3 }}>{label}</p>
      {children}
    </div>
  );
}
export function FicheValeur({ children, vide, fort }: { children?: React.ReactNode; vide?: boolean; fort?: boolean }) {
  return <p style={{ fontSize: fort ? 13 : 12.5, fontWeight: fort ? 700 : 600, color: vide ? "var(--gris)" : "var(--encre)" }}>{children}</p>;
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
            style={{ ...fond_bleu, display: "flex", alignItems: "center", gap: 8, borderRadius: 12, padding: "9px 12px", textDecoration: "none", transition: "border-color 0.15s" }}
            onMouseEnter={ev => (ev.currentTarget.style.borderColor = "rgb(var(--bleu-rgb) / 0.35)")}
            onMouseLeave={ev => (ev.currentTarget.style.borderColor = "rgb(var(--bleu-rgb) / 0.16)")}>
            <FileText size={13} style={{ color: "var(--bleu)", flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "var(--bleu)", fontWeight: 600 }}>{f.titre || f.fichier_nom || f.nom || "Document"}</span>
          </a>
        ))}
      </div>
    </FicheSection>
  );
}

// ── Cascade thématique à 3 niveaux (secteur bleu → branche orange → activité vert)
type Niveau = { cle: React.Key; nom: string; enfants?: Niveau[] };

export function FicheArbre({ data }: { data: Niveau[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map(sec => (
        <div key={sec.cle}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: sec.enfants?.length ? 5 : 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--bleu-action)", flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--bleu)" }}>{sec.nom}</span>
          </div>
          {!!sec.enfants?.length && (
            <div style={{ paddingLeft: 20, borderLeft: "2px solid rgb(var(--bleu-rgb) / 0.15)", display: "flex", flexDirection: "column", gap: 5 }}>
              {sec.enfants.map(bra => (
                <div key={bra.cle}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: bra.enfants?.length ? 4 : 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--orange-action)", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--orange)" }}>{bra.nom}</span>
                  </div>
                  {!!bra.enfants?.length && (
                    <div style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
                      {bra.enfants.map(act => (
                        <div key={act.cle} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--vert-action)", flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: "var(--vert)", fontWeight: 500 }}>{act.nom}</span>
                        </div>
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
