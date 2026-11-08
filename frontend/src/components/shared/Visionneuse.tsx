"use client";

/**
 * La visionneuse de documents : un document s'ouvre en aperçu sur la
 * plateforme, et se télécharge ensuite si on le veut. Avant elle, chaque lien
 * téléchargeait le fichier ; il fallait l'ouvrir hors de la plateforme pour le
 * lire.
 *
 *   <LienDocument href={url} titre="Programme officiel" contexte="Maghrib Invest">…</LienDocument>
 *
 * LienDocument reste un vrai lien : le clic ouvre la visionneuse, le clic du
 * milieu ou Ctrl/⌘-clic ouvrent le fichier dans un onglet, comme avant.
 *
 * STABLE ET FLUIDE, MÊME POUR UN DOCUMENT ÉNORME.
 * - pdf.js (Mozilla), version « legacy » pour les navigateurs plus anciens,
 *   chargé à la première ouverture seulement ; ses ressources sont servies
 *   depuis /pdfjs (outils/copier-pdfjs.mjs).
 * - Le document se lit par morceaux : l'API sert les plages demandées
 *   (FichierPartiel), pdf.js ne demande que ce qu'il affiche — la première
 *   page d'un document de 50 Mo paraît sans attendre les 50 Mo.
 * - La place de chaque page est réservée dès l'ouverture : rien ne saute.
 * - Une page se dessine quand elle approche de l'écran (un seul observateur
 *   pour toutes) et se libère quand elle s'en éloigne ; sa toile est
 *   plafonnée à 8 millions de pixels, même au plus fort zoom.
 * - Les pages se dessinent UNE À UNE, et seulement quand le défilement marque
 *   une pause (l'Ordonnanceur) : dessiner une page occupe le fil principal ;
 *   pendant le geste, il reste tout entier au défilement. La plus proche de
 *   la page lue passe d'abord.
 * - Au zoom, l'ancienne image reste jusqu'à la nouvelle, sans éclair blanc, et
 *   la lecture reste où elle en était.
 * - La page courante se calcule une fois par image, par dichotomie ; les pages
 *   ne se redessinent pas quand elle change.
 * Pas de couche de texte : le document se lit ; pour le reste, il se
 * télécharge — avec les octets déjà reçus, sans les redemander.
 */

import { X } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { estAuSommet, useDialogue } from "@/lib/dialogue";

export type DocumentAOuvrir = { url: string; titre: string; contexte?: string };

// ── Le document ouvert : un état unique pour toute la plateforme ─────────────
let ouvert: DocumentAOuvrir | null = null;
const abonnes = new Set<() => void>();
const publier = () => abonnes.forEach(f => f());
export function ouvrirDocument(d: DocumentAOuvrir) { ouvert = d; publier(); }
function fermerDocument() { ouvert = null; publier(); }
const sAbonner = (f: () => void) => { abonnes.add(f); return () => { abonnes.delete(f); }; };

// ── Le lien d'un document ─────────────────────────────────────────────────────
type PropsLien = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; titre?: string; contexte?: string };

export function LienDocument({ href, titre, contexte, onClick, children, ...reste }: PropsLien) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...reste}
      onClick={e => {
        onClick?.(e);
        // Clic du milieu, avec Ctrl, ⌘, Maj ou Alt : le navigateur fait comme avant
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        ouvrirDocument({ url: href, titre: titre || e.currentTarget.textContent?.trim() || "Document", contexte });
      }}>
      {children}
    </a>
  );
}

// ── Montée une fois, dans Providers ───────────────────────────────────────────
export default function VisionneuseGlobale() {
  const doc = useSyncExternalStore(sAbonner, () => ouvert, () => null);
  return doc ? <Visionneuse key={doc.url} doc={doc} onClose={fermerDocument} /> : null;
}

// ── La visionneuse ────────────────────────────────────────────────────────────
const MARGE = 24;                 // autour des pages (.visionneuse-pages)
const ECART = 16;                 // entre deux pages
const ECHELLE_AJUSTEE_MAX = 1.5;  // ajustée à la largeur, une page A4 ne dépasse pas ~ 900 px
const ZOOM_MIN = 0.5, ZOOM_MAX = 3, PAS = 0.25;
const PIXELS_MAX = 8_000_000;     // par toile : ~ 32 Mo, sous les plafonds des navigateurs
const PAUSE = 120;                // ms sans défilement avant de dessiner

type Taille = { l: number; h: number };
// Ce que la visionneuse emploie de pdf.js
type Vue = { width: number; height: number };
type PagePdfJs = {
  getViewport: (o: { scale: number }) => Vue;
  render: (o: { canvas: HTMLCanvasElement; viewport: Vue }) => { promise: Promise<void>; cancel: () => void };
};
type Pdf = { numPages: number; getPage: (n: number) => Promise<PagePdfJs>; getData: () => Promise<Uint8Array>; destroy: () => Promise<void> };
type Inscription = (el: Element, rappel: (proche: boolean) => void) => () => void;

// ── L'ordonnanceur des rendus ─────────────────────────────────────────────────
// Une file des pages à dessiner ; une seule à la fois, et seulement quand le
// défilement s'est arrêté depuis PAUSE ms. La page la plus proche de la page
// courante passe d'abord ; une page qui s'éloigne retire sa demande.
type Rendu = (estAnnule: () => boolean) => Promise<void>;
class Ordonnanceur {
  private file = new Map<number, Rendu>();
  private enCours = false;
  private dernierDefilement = 0;
  private reveil: ReturnType<typeof setTimeout> | null = null;
  private ferme = false;
  courante = 1;
  demander(numero: number, rendu: Rendu): () => void {
    this.file.set(numero, rendu);
    this.planifier();
    return () => { if (this.file.get(numero) === rendu) this.file.delete(numero); };
  }
  defilement() { this.dernierDefilement = performance.now(); this.planifier(); }
  fermer() { this.ferme = true; this.file.clear(); if (this.reveil) clearTimeout(this.reveil); }
  private planifier() {
    if (this.enCours || this.reveil || this.ferme || !this.file.size) return;
    const attente = Math.max(0, PAUSE - (performance.now() - this.dernierDefilement));
    this.reveil = setTimeout(() => { this.reveil = null; this.suivant(); }, attente);
  }
  private async suivant() {
    if (this.ferme || !this.file.size) return;
    if (performance.now() - this.dernierDefilement < PAUSE) { this.planifier(); return; }
    let choisi = -1;
    for (const n of this.file.keys()) if (choisi < 0 || Math.abs(n - this.courante) < Math.abs(choisi - this.courante)) choisi = n;
    const rendu = this.file.get(choisi)!;
    this.file.delete(choisi);
    this.enCours = true;
    try { await rendu(() => this.ferme); } catch { /* rendu annulé */ }
    this.enCours = false;
    this.planifier();
  }
}

function nomDeFichier(titre: string): string {
  const propre = titre.replace(/[\\/:*?"<>|]+/g, " ").trim() || "document";
  return /\.pdf$/i.test(propre) ? propre : `${propre}.pdf`;
}

function Visionneuse({ doc, onClose }: { doc: DocumentAOuvrir; onClose: () => void }) {
  const dial = useDialogue(true);
  const voile = useRef<HTMLDivElement>(null);
  const downSurFond = useRef(false);
  // La zone qui défile : en état (les effets qui en dépendent repartent quand
  // elle paraît) et en référence (on la fait défiler)
  const [zone, setZone] = useState<HTMLDivElement | null>(null);
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const brancherZone = useCallback((el: HTMLDivElement | null) => { zoneRef.current = el; setZone(el); }, []);
  const [etat, setEtat] = useState<"chargement" | "pret" | "erreur">("chargement");
  const [progres, setProgres] = useState(0);
  const [pdf, setPdf] = useState<Pdf | null>(null);
  const [taille, setTaille] = useState<Taille | null>(null);   // la première page, à l'échelle 1
  const [largeur, setLargeur] = useState(0);                     // la largeur utile de la zone
  const [zoom, setZoom] = useState(1);                           // 1 : ajustée à la largeur
  const [pageCourante, setPageCourante] = useState(1);

  // Le document : pdf.js chargé à la première ouverture, puis le fichier, lu
  // par morceaux quand le serveur le permet
  useEffect(() => {
    let annule = false;
    let tache: { promise: Promise<Pdf>; destroy: () => Promise<void>; onProgress?: (p: { loaded: number; total: number }) => void } | null = null;
    let charge: Pdf | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        tache = pdfjs.getDocument({
          url: doc.url,
          // Seulement ce qui s'affiche : ni téléchargement de fond, ni flux entier
          disableAutoFetch: true, disableStream: true, rangeChunkSize: 256 * 1024,
          cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/",
          wasmUrl: "/pdfjs/wasm/", iccUrl: "/pdfjs/iccs/",
        }) as unknown as typeof tache;
        let dernier = -1;
        tache!.onProgress = ({ loaded, total }) => {
          const p = total ? Math.min(99, Math.floor(loaded / total * 100)) : 0;
          if (p !== dernier) { dernier = p; if (!annule) setProgres(p); }
        };
        charge = await tache!.promise;
        const premiere = await charge.getPage(1);
        const vp = premiere.getViewport({ scale: 1 });
        if (annule) return;
        setTaille({ l: vp.width, h: vp.height });
        setPdf(charge);
        setEtat("pret");
      } catch {
        if (!annule) setEtat("erreur");
      }
    })();
    return () => { annule = true; tache?.destroy().catch(() => {}); charge?.destroy().catch(() => {}); };
  }, [doc.url]);

  // La largeur utile, suivie quand la fenêtre change
  useEffect(() => {
    if (!zone) return;
    const mesurer = () => setLargeur(Math.max(200, zone.clientWidth - 2 * MARGE));
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(zone);
    return () => ro.disconnect();
  }, [zone]);

  // Les rendus, une page à la fois, aux pauses du défilement
  const ordonnanceur = useMemo(() => new Ordonnanceur(), []);
  useEffect(() => () => ordonnanceur.fermer(), [ordonnanceur]);

  // Un seul observateur pour toutes les pages : chacune s'y inscrit
  const inscription = useMemo(() => {
    if (!zone || typeof IntersectionObserver === "undefined") return null;
    const rappels = new Map<Element, (proche: boolean) => void>();
    const obs = new IntersectionObserver(
      entrees => { for (const e of entrees) rappels.get(e.target)?.(e.isIntersecting); },
      { root: zone, rootMargin: "120% 0px" });
    const inscrire: Inscription = (el, rappel) => {
      rappels.set(el, rappel); obs.observe(el);
      return () => { obs.unobserve(el); rappels.delete(el); };
    };
    return { inscrire, obs };
  }, [zone]);
  useEffect(() => () => inscription?.obs.disconnect(), [inscription]);

  const ajustee = taille && largeur ? Math.min(largeur / taille.l, ECHELLE_AJUSTEE_MAX) : 1;
  const echelle = ajustee * zoom;
  const pourcent = Math.round(echelle * 75);   // 100 % : la taille réelle (1 pt = 4/3 px)

  // Au zoom, la lecture reste où elle en était : même proportion du document
  const proportion = useRef(0);
  useLayoutEffect(() => {
    const z = zoneRef.current;
    if (z && z.scrollHeight > z.clientHeight) z.scrollTop = proportion.current * z.scrollHeight;
  }, [echelle, zone]);
  const changerZoom = (z: number) => {
    if (zone) proportion.current = zone.scrollTop / Math.max(1, zone.scrollHeight);
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100)));
  };

  // La page courante : celle qui occupe le tiers haut de la zone — une fois
  // par image au plus, par dichotomie sur les pages
  const image = useRef(0);
  const surDefilement = () => {
    ordonnanceur.defilement();
    if (image.current || !zone) return;
    image.current = requestAnimationFrame(() => {
      image.current = 0;
      const pages = zone.children;
      const repere = zone.scrollTop + zone.clientHeight / 3;
      let bas = 0, haut = pages.length - 1, n = 0;
      while (bas <= haut) {
        const m = (bas + haut) >> 1;
        if ((pages[m] as HTMLElement).offsetTop <= repere) { n = m; bas = m + 1; } else haut = m - 1;
      }
      const numero = Number((pages[n] as HTMLElement | undefined)?.dataset.page || 1);
      ordonnanceur.courante = numero;
      setPageCourante(p => (p === numero ? p : numero));
    });
  };
  useEffect(() => () => cancelAnimationFrame(image.current), []);
  const allerA = (n: number) => {
    const z = zoneRef.current;
    const cible = z?.querySelector<HTMLElement>(`[data-page="${n}"]`);
    if (z && cible) z.scrollTo({ top: cible.offsetTop - MARGE, behavior: "smooth" });
  };

  // Échap ferme la visionneuse — elle seule, même ouverte sur une fiche
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => { if (e.key === "Escape" && estAuSommet(dial.ref.current)) onClose(); };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onClose, dial.ref]);

  const telecharger = async () => {
    try {
      if (pdf) {
        const octets = await pdf.getData();
        const lien = URL.createObjectURL(new Blob([octets as BlobPart], { type: "application/pdf" }));
        const a = document.createElement("a");
        a.href = lien; a.download = nomDeFichier(doc.titre);
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(lien), 10_000);
        return;
      }
    } catch { /* repli : le fichier lui-même */ }
    window.open(doc.url, "_blank", "noopener");
  };

  // Les pages : mémorisées, elles ne se redessinent ni au défilement ni au
  // changement de page courante, seulement au zoom
  const nbPages = pdf?.numPages ?? 0;
  const pages = useMemo(() => (pdf && taille && inscription
    ? Array.from({ length: nbPages }, (_, i) => (
        <PagePdf key={i + 1} pdf={pdf} numero={i + 1} echelle={echelle} tailleDefaut={taille}
          inscrire={inscription.inscrire} ordonnanceur={ordonnanceur} />))
    : null), [pdf, taille, inscription, nbPages, echelle, ordonnanceur]);

  const pret = etat === "pret";
  return (
    <div className="fiche-cadre" style={{ zIndex: 700 }}
      onMouseDown={e => { downSurFond.current = e.target === e.currentTarget || e.target === voile.current; }}
      onClick={e => { if (downSurFond.current && (e.target === e.currentTarget || e.target === voile.current)) onClose(); }}>
      <div ref={voile} aria-hidden className="fiche-voile" />
      <div {...dial} aria-labelledby="visionneuse-titre" onClick={e => e.stopPropagation()} className="fiche-panneau visionneuse-panneau">

        <header className="fiche-entete">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id="visionneuse-titre" className="fiche-titre visionneuse-titre">{doc.titre}</h2>
            {doc.contexte && <p className="visionneuse-contexte">{doc.contexte}</p>}
          </div>
          <button onClick={onClose} aria-label="Fermer" className="fiche-fermer"><X size={18} strokeWidth={2} /></button>
        </header>

        <div className="visionneuse-barre">
          <div className="visionneuse-groupe" role="group" aria-label="Pages">
            <button type="button" className="visionneuse-commande" aria-label="Page précédente"
              disabled={!pret || pageCourante <= 1} onClick={() => allerA(pageCourante - 1)}>‹</button>
            <span className="visionneuse-valeur" aria-live="polite">
              {nbPages ? <>Page {pageCourante} <span className="visionneuse-sur">sur {nbPages}</span></> : "—"}
            </span>
            <button type="button" className="visionneuse-commande" aria-label="Page suivante"
              disabled={!pret || pageCourante >= nbPages} onClick={() => allerA(pageCourante + 1)}>›</button>
          </div>
          <div className="visionneuse-groupes">
            <div className="visionneuse-groupe" role="group" aria-label="Zoom">
              <button type="button" className="visionneuse-commande" aria-label="Réduire"
                disabled={!pret || zoom <= ZOOM_MIN} onClick={() => changerZoom(zoom - PAS)}>−</button>
              <span className="visionneuse-valeur">{pret ? `${pourcent} %` : "—"}</span>
              <button type="button" className="visionneuse-commande" aria-label="Agrandir"
                disabled={!pret || zoom >= ZOOM_MAX} onClick={() => changerZoom(zoom + PAS)}>+</button>
            </div>
            <button type="button" className="visionneuse-ajuster"
              disabled={!pret || zoom === 1} onClick={() => changerZoom(1)}>Ajuster à la largeur</button>
          </div>
        </div>

        <div className="visionneuse-zone">
          {etat === "chargement" && (
            <div className="visionneuse-progres" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progres}>
              <span style={{ transform: `scaleX(${Math.max(0.04, progres / 100)})` }} />
            </div>
          )}
          <div ref={brancherZone} className="visionneuse-pages" onScroll={surDefilement}>
            {pages}
          </div>
          {etat === "chargement" && <p className="visionneuse-etat">Chargement du document{progres > 0 ? ` · ${progres} %` : "…"}</p>}
          {etat === "erreur" && (
            <div className="visionneuse-etat">
              <strong>L&apos;aperçu de ce document n&apos;est pas disponible.</strong>
              Vous pouvez le télécharger pour l&apos;ouvrir sur votre poste.
            </div>
          )}
        </div>

        <footer className="fiche-pied">
          <button type="button" onClick={onClose} className="ds-bouton ds-bouton--secondaire" style={{ height: 38, padding: "0 18px", fontSize: 13.5 }}>Fermer</button>
          <button type="button" onClick={telecharger} className="ds-bouton ds-bouton--primaire" style={{ height: 38, padding: "0 18px", fontSize: 13.5 }}>Télécharger</button>
        </footer>
      </div>
    </div>
  );
}

// ── Une page ──────────────────────────────────────────────────────────────────
// Sa place est réservée d'emblée (la taille de la première page, puis la
// sienne une fois lue). Elle se dessine dans une toile hors champ, recopiée
// d'un coup quand elle est prête.
const PagePdf = memo(function PagePdf({ pdf, numero, echelle, tailleDefaut, inscrire, ordonnanceur }: {
  pdf: Pdf; numero: number; echelle: number; tailleDefaut: Taille; inscrire: Inscription; ordonnanceur: Ordonnanceur;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const toile = useRef<HTMLCanvasElement>(null);
  const [proche, setProche] = useState(false);
  const [taille, setTaille] = useState<Taille>(tailleDefaut);

  useEffect(() => {
    const el = boite.current;
    return el ? inscrire(el, setProche) : undefined;
  }, [inscrire]);

  useEffect(() => {
    const canvas = toile.current;
    if (!canvas) return;
    if (!proche) { canvas.width = 0; canvas.height = 0; return; }   // loin de l'écran : libérée
    let annule = false;
    let tache: { promise: Promise<void>; cancel: () => void } | null = null;
    const retirer = ordonnanceur.demander(numero, async (ferme) => {
      try {
        const page = await pdf.getPage(numero);
        if (annule || ferme()) return;
        const v1 = page.getViewport({ scale: 1 });
        if (Math.abs(v1.width - taille.l) > 0.5 || Math.abs(v1.height - taille.h) > 0.5) {
          setTaille({ l: v1.width, h: v1.height });   // la vraie taille : l'effet repart avec elle
          return;
        }
        const densite = Math.min(window.devicePixelRatio || 1, 2);
        let s = echelle * densite;
        if (v1.width * v1.height * s * s > PIXELS_MAX) s = Math.sqrt(PIXELS_MAX / (v1.width * v1.height));
        const vp = page.getViewport({ scale: s });
        const horsChamp = document.createElement("canvas");
        horsChamp.width = Math.floor(vp.width);
        horsChamp.height = Math.floor(vp.height);
        tache = page.render({ canvas: horsChamp, viewport: vp });
        await tache!.promise;
        if (annule || ferme()) return;
        canvas.width = horsChamp.width;
        canvas.height = horsChamp.height;
        canvas.getContext("2d")?.drawImage(horsChamp, 0, 0);
        horsChamp.width = 0;   // libérée tout de suite, sans attendre le ramasse-miettes
      } catch { /* rendu annulé ou page illisible : la place reste blanche */ }
    });
    return () => { annule = true; retirer(); tache?.cancel(); };
  }, [proche, pdf, numero, echelle, taille.l, taille.h, ordonnanceur]);

  return (
    <div ref={boite} data-page={numero} className="visionneuse-page"
      style={{ width: Math.round(taille.l * echelle), height: Math.round(taille.h * echelle), marginBottom: ECART }}>
      <canvas ref={toile} />
    </div>
  );
});
