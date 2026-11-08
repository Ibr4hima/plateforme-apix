"use client";

// ── Fiche modale des pages publiques — une seule coquille pour toutes les
// fiches (entreprise, événement, accord, projet, potentialité, avantage,
// zone, prospect) : voile, panneau centré dans l'écran, en-tête (surtitre,
// titre, ligne de repères), corps qui défile, pied pour les actions de
// l'administration.
//
// STABLE ET FLUIDE QUEL QUE SOIT SON CONTENU : voir la rubrique « Fiche » de
// globals.css — voile sans flou, panneau centré qui s'ouvre complet
// (lib/ouvertureFiche), aucune balise <style> insérée à l'ouverture.
//
// Le contenu se compose de deux familles de pièces : le nouveau dessin
// (FicheRubrique, FicheFaits, FicheTexte, FichePuces, FicheArborescence,
// FicheDocuments, FicheAttente — classes .fiche-* de globals.css), et les
// pièces d'avant (FicheSection, FicheBloc…), que les fiches quittent une à une.

import { FileText, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { estAuSommet, useDialogue } from "@/lib/dialogue";
import { LienDocument } from "@/components/shared/Visionneuse";
import { badge_bleu, badge_vert } from "@/lib/couleurs";
import { fmtPhone } from "@/lib/telephone";

// ── Coquille ──────────────────────────────────────────────────────────────────
export default function FicheModal({ titre, surtitre, meta, onClose, zIndex = 400, maxWidth = 680, actions, children }: {
  titre: React.ReactNode;
  surtitre?: React.ReactNode;    // au-dessus du titre : statut, édition…
  meta?: React.ReactNode;        // sous le titre : repères (date, lieu…), chacun dans un <span>
  onClose: () => void;
  zIndex?: number;
  maxWidth?: number;
  actions?: React.ReactNode;     // boutons du pied (ex. « Modifier » en admin) ; sans eux, pas de pied
  children: React.ReactNode;
}) {
  // Fermer seulement si le clic a COMMENCÉ sur le voile : une sélection de
  // texte qui déborde du panneau ne doit pas fermer la fiche.
  const downSurFond = useRef(false);
  // Le voile, pour reconnaître un clic qui tombe dessus : depuis qu'il est un
  // FRÈRE du panneau et non plus son parent, il couvre le conteneur, et un clic
  // « à côté de la fiche » atteint le voile plutôt que le conteneur.
  const voile = useRef<HTMLDivElement>(null);
  // Contrat clavier des modales : piège de Tab, focus pris puis restitué.
  const dial = useDialogue(true);

  // Échap ferme la fiche — sauf si une autre fenêtre est ouverte par-dessus
  // (la visionneuse d'un de ses documents) : c'est elle qui se ferme
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && estAuSommet(dial.ref.current)) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dial.ref]);

  return (
    <div className="fiche-cadre" style={{ zIndex }}
      onMouseDown={e => { downSurFond.current = e.target === e.currentTarget || e.target === voile.current; }}
      onClick={e => { if (downSurFond.current
                       && (e.target === e.currentTarget || e.target === voile.current)) onClose(); }}>

      {/* Le voile est un FRÈRE du panneau, pas son parent, et un simple
          aplat : le flou plein écran d'avant (backdrop-filter) était la couche
          la plus chère de la page, recalculée à l'ouverture comme au
          défilement de la fiche. */}
      <div ref={voile} data-voile aria-hidden className="fiche-voile" />

      <div {...dial} aria-labelledby="fiche-modal-titre" onClick={e => e.stopPropagation()}
        className="fiche-panneau" style={{ maxWidth }}>

        {/* En-tête : il ne défile pas. Surtitre (statut…), titre, repères. */}
        <header className="fiche-entete">
          <div style={{ minWidth: 0, flex: 1 }}>
            {surtitre && <div className="fiche-surtitre">{surtitre}</div>}
            <h2 id="fiche-modal-titre" className="fiche-titre">{titre}</h2>
            {meta && <div className="fiche-meta"><div className="fiche-meta-lignes">{meta}</div></div>}
          </div>
          <button onClick={onClose} aria-label="Fermer" className="fiche-fermer">
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        {/* Corps — la seule zone qui défile (classe .fiche-corps : composée à
            part, sans enchaîner sur la page, gouttière réservée). */}
        <div data-corps className="fiche-corps">
          {children}
        </div>

        {/* Pied — seulement pour des actions (l'administration) : pour lire,
            la croix et Échap ferment la fiche */}
        {actions && (
          <footer className="fiche-pied">
            <button onClick={onClose} className="ds-bouton ds-bouton--secondaire" style={{ height: 36, padding: "0 16px", fontSize: 13 }}>
              Fermer
            </button>
            {actions}
          </footer>
        )}
      </div>
    </div>
  );
}

// ══ Le contenu des fiches — nouveau dessin ═══════════════════════════════════

// Une rubrique : son titre en petites capitales grises, puis son contenu.
// `arrivee` : elle vient d'arriver avec la fiche complète — elle apparaît en
// fondu, à sa place.
export function FicheRubrique({ titre, compte, arrivee, children }: {
  titre: React.ReactNode; compte?: number; arrivee?: boolean; children: React.ReactNode;
}) {
  return (
    <section className={`fiche-rubrique${arrivee ? " fiche-arrivee" : ""}`}>
      <h3>{titre}{typeof compte === "number" ? <span className="fiche-compte">{compte}</span> : null}</h3>
      {children}
    </section>
  );
}

// Les faits clés, en grille dans un aplat gris : un libellé, une valeur.
// `attente` : la valeur n'est pas encore là (la fiche n'a que les champs de sa
// carte) — une ligne qui scintille tient sa place, à sa hauteur.
export function FicheFaits({ children }: { children: React.ReactNode }) {
  return <div className="fiche-faits">{children}</div>;
}
export function FicheFait({ libelle, note, vide, attente, children }: {
  libelle: string; note?: React.ReactNode; vide?: boolean; attente?: boolean; children?: React.ReactNode;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <p className="fiche-fait-libelle">{libelle}</p>
      {attente
        ? <div className="fiche-attente fiche-fait-attente" aria-hidden />
        : <p className={`fiche-fait-valeur${vide ? " est-vide" : ""}`}>{children}</p>}
      {note && !attente && <p className="fiche-fait-note">{note}</p>}
    </div>
  );
}

// Un texte riche (description), en colonne de lecture
export function FicheTexte({ html }: { html: string }) {
  return <div className="fiche-texte" dangerouslySetInnerHTML={{ __html: html }} />;
}

// Une liste de noms en pastilles, sous un intitulé facultatif
export function FichePuces({ titre, items }: { titre?: string; items: React.ReactNode[] }) {
  if (!items.length) return null;
  return (
    <div className="fiche-groupe">
      {titre && <p className="fiche-sous-titre">{titre}</p>}
      <div className="fiche-puces">{items.map((x, i) => <span key={i} className="fiche-puce">{x}</span>)}</div>
    </div>
  );
}

// Secteur → branches → activités : le secteur en tête, ses branches dessous,
// leurs activités à la suite, en gris
export function FicheArborescence({ data }: { data: Niveau[] }) {
  if (!data.length) return null;
  return (
    <div className="fiche-arbre">
      {data.map(sec => (
        <div key={sec.cle}>
          <div className="fiche-arbre-secteur">{sec.nom}</div>
          {!!sec.enfants?.length && (
            <div className="fiche-arbre-branches">
              {sec.enfants.map(bra => (
                <div key={bra.cle} className="fiche-arbre-branche">
                  {bra.nom}
                  {!!bra.enfants?.length && <span className="fiche-arbre-activites"> — {bra.enfants.map(a => a.nom).join(", ")}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Un document tel que les API le servent — le nom du fichier n'a pas le même
// champ d'une entité à l'autre
export type FicheFichier = {
  id: number | string; titre?: string | null; fichier_nom?: string | null; nom?: string | null; type_fichier?: string | null;
};

// Les documents téléchargeables — sans icône : le format en toutes lettres,
// le nom, l'action écrite
export function FicheDocuments({ fichiers, hrefDe, arrivee, contexte }: { fichiers: FicheFichier[]; hrefDe: (f: FicheFichier) => string; arrivee?: boolean; contexte?: string }) {
  if (!fichiers?.length) return null;
  return (
    <FicheRubrique titre={fichiers.length > 1 ? "Documents" : "Document"} compte={fichiers.length > 1 ? fichiers.length : undefined} arrivee={arrivee}>
      <FicheListeDocuments fichiers={fichiers} hrefDe={hrefDe} contexte={contexte} />
    </FicheRubrique>
  );
}

// La liste seule, sans rubrique — pour les documents d'un échange, d'un cycle…
export function FicheListeDocuments({ fichiers, hrefDe, contexte }: { fichiers: FicheFichier[]; hrefDe: (f: FicheFichier) => string; contexte?: string }) {
  if (!fichiers?.length) return null;
  // Le format : celui que l'API donne, sinon l'extension du nom ; les fichiers
  // déposés sur la plateforme sont des PDF
  const format = (f: FicheFichier) => String(f.type_fichier
    || String(f.fichier_nom || f.nom || f.titre || "").match(/\.([a-z0-9]{2,5})$/i)?.[1] || "pdf").toUpperCase();
  return (
    <div className="fiche-docs">
      {fichiers.map(f => (
        <LienDocument key={f.id} href={hrefDe(f)} titre={f.titre || f.fichier_nom || f.nom || "Document"} contexte={contexte} className="fiche-doc">
          <span className="fiche-doc-format">{format(f)}</span>
          <span className="fiche-doc-nom">{f.titre || f.fichier_nom || f.nom || "Document"}</span>
          <span className="fiche-doc-action">Ouvrir</span>
        </LienDocument>
      ))}
    </div>
  );
}

// Des personnes à joindre (porteurs, points focaux…) : une rangée chacune —
// le nom et la fonction à gauche, les coordonnées à droite
export type FichePersonne = {
  cle?: React.Key; nom: string; role?: string | null; tels?: (string | null)[] | null; mails?: (string | null)[] | null;
};
const uniques = (xs?: (string | null)[] | null) => [...new Set((xs || []).map(x => (x || "").trim()).filter(Boolean))];
export function FichePersonnes({ personnes }: { personnes: FichePersonne[] }) {
  if (!personnes.length) return null;
  return (
    <div className="fiche-personnes">
      {personnes.map((pe, i) => {
        const tels = uniques(pe.tels), mails = uniques(pe.mails);
        return (
          <div key={pe.cle ?? i} className="fiche-personne">
            <div style={{ minWidth: 0 }}>
              <p className="fiche-personne-nom">{pe.nom}</p>
              {pe.role && <p className="fiche-personne-role">{pe.role}</p>}
            </div>
            {(tels.length > 0 || mails.length > 0) && (
              <div className="fiche-personne-contacts">
                {tels.map(t => <span key={t}>{fmtPhone(t)}</span>)}
                {mails.map(m => <a key={m} className="fiche-lien" href={`mailto:${m}`}>{m}</a>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Des parts d'un tout, en barres fines : le libellé et la part, puis une barre
// de sa couleur. `compact` : la version des infobulles, sans animation.
export function FicheBarres({ lignes, compact }: {
  lignes: { libelle: string; valeur: number; couleur: string }[]; compact?: boolean;
}) {
  const total = lignes.reduce((somme, l) => somme + l.valeur, 0);
  return (
    <div className={`fiche-barres${compact ? " est-compact" : ""}`}>
      {lignes.map(l => {
        const part = total ? l.valeur / total : 0;
        return (
          <div key={l.libelle}>
            <div className="fiche-barre-tete">
              <span className="fiche-barre-libelle">{l.libelle}</span>
              <span className="fiche-barre-part">{Math.round(part * 100)}{" "}%</span>
            </div>
            <div className="fiche-barre-piste">
              <div className="fiche-barre-plein" style={{ width: `${part * 100}%`, background: l.couleur }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// En attente de la fiche complète : des lignes qui scintillent, à la place
// du texte qui vient
export function FicheAttente({ lignes = 4 }: { lignes?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-hidden>
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} className="fiche-attente" style={{ width: i === lignes - 1 ? "55%" : `${96 - (i % 3) * 7}%` }} />
      ))}
    </div>
  );
}

// ══ Les pièces d'avant ════════════════════════════════════════════════════════

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
  borderRadius: 8,
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
  return <div style={{ background: "var(--carte-douce)", border: "1px solid var(--bordure)", borderRadius: 8, padding: "12px 14px", ...style }}>{children}</div>;
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
          <LienDocument key={f.id} href={hrefDe(f)} titre={f.titre || f.fichier_nom || f.nom || "Document"}
            style={{ ...FICHE_BLOC, display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", textDecoration: "none", transition: "background 0.15s" }}
            onMouseEnter={ev => (ev.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.10)")}
            onMouseLeave={ev => (ev.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.04)")}>
            <FileText size={13} style={{ color: "var(--bleu)", flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "var(--bleu)", fontWeight: 600 }}>{f.titre || f.fichier_nom || f.nom || "Document"}</span>
          </LienDocument>
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
export type Niveau = { cle: React.Key; nom: string; enfants?: Niveau[] };

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

// Cascade NAEMA depuis les référentiels + ids sélectionnés (forme la plus
// courante) : les niveaux, que dessinent FicheArborescence (nouveau dessin)
// comme FicheArbre (celui d'avant)
type RefNaema = { id: number; nom: string };
type SourceNaema = {
  secteurs: RefNaema[];
  branches: (RefNaema & { secteur_id: number })[];
  activites: (RefNaema & { branche_id: number })[];
  secIds: number[]; braIds: number[]; actIds: number[];
};

export function arbreNaema({ secteurs, branches, activites, secIds, braIds, actIds }: SourceNaema): Niveau[] {
  return secIds.flatMap(secId => {
    const sec = secteurs.find(s => s.id === secId);
    if (!sec) return [];
    return [{
      cle: secId, nom: sec.nom,
      enfants: branches.filter(b => b.secteur_id === secId && braIds.includes(b.id)).map(bra => ({
        cle: bra.id, nom: bra.nom,
        enfants: activites.filter(a => a.branche_id === bra.id && actIds.includes(a.id)).map(act => ({ cle: act.id, nom: act.nom })),
      })),
    }];
  });
}

export function FicheArbreNaema(source: SourceNaema) {
  const data = arbreNaema(source);
  if (!data.length) return null;
  return <FicheArbre data={data} />;
}
