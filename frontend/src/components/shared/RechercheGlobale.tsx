"use client";

// Recherche globale ⌘K / Ctrl+K — palette de commande sur toute la plateforme.
// Cherche dans les pages, pays (fiche pays), entreprises, accords, événements,
// zones et prospects. L'index est chargé à la première ouverture puis gardé en
// mémoire pour la session. Sélectionner un résultat navigue vers la page avec
// « ?fiche=<id> » (voir lib/ficheUrl) ou ouvre la fiche pays via la navbar.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Fuse from "@/lib/fuse";
import { fetchTous } from "@/lib/fetchTous";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type Resultat = {
  type: string;        // clé de groupe
  nom: string;         // texte affiché + indexé
  sous?: string;       // sous-titre grisé
  href?: string;       // navigation (pages, zones)
  paysId?: number;     // fiche pays via l'événement navbar
  item?: any;          // objet complet — la fiche s'ouvre sur place
  onglet?: string;     // onglet d'origine (prospects)
};

const GROUPES: Record<string, { label: string }> = {
  page:         { label: "Pages" },
  pays:         { label: "Fiches pays" },
  entreprise:   { label: "Entreprises" },
  accord:       { label: "Accords" },
  evenement:    { label: "Événements" },
  zone:         { label: "Zones" },
  projet:       { label: "Banque de projets" },
  potentialite: { label: "Potentialités" },
  avantage:     { label: "Avantages & incitations" },
  prospect:     { label: "Prospects" },
};

// Même nettoyage de titre que la page Opportunités
const potTitle = (t: string) => (t || "")
  .replace(/^[Pp]otentialités?\s+(de\s+l[''’]|de\s+la\s+|de\s+le\s+|du\s+|de\s+)/i, "")
  .replace(/^(.)/, (_: string, c: string) => c.toUpperCase());
const geoNom = (x: any) => x.pole_nom || x.region_nom || x.departement_nom || x.arrondissement_nom || undefined;
const ORDRE_GROUPES = Object.keys(GROUPES);
const MAX_PAR_GROUPE = 5;

const PAGES: Resultat[] = [
  { type: "page", nom: "Accueil",                sous: "Page d'accueil",            href: "/" },
  { type: "page", nom: "Entreprises",            sous: "Entreprises installées",    href: "/entreprises" },
  { type: "page", nom: "Accords & Traités",      sous: "Accords internationaux",    href: "/accords" },
  { type: "page", nom: "Événements",             sous: "Agenda & frise",            href: "/evenements" },
  { type: "page", nom: "Zones d'investissement", sous: "Zones & pôles territoires", href: "/zones" },
  { type: "page", nom: "Opportunités",           sous: "Projets & potentialités",   href: "/opportunites" },
  { type: "page", nom: "Prospects",              sous: "Investisseurs suivis",      href: "/prospects" },
  { type: "page", nom: "IDE",                    sous: "Investissements directs étrangers", href: "/ide" },
  { type: "page", nom: "Statistiques",           sous: "Commerce & macroéconomie",  href: "/statistiques" },
  { type: "page", nom: "Tableau de bord",        sous: "Vue d'ensemble",            href: "/tableau-de-bord" },
];

// Index chargé une seule fois par session (relancé si un chargement a échoué)
let indexCache: Resultat[] | null = null;
let indexEnCours: Promise<Resultat[]> | null = null;

async function chargerIndex(): Promise<Resultat[]> {
  if (indexCache) return indexCache;
  if (indexEnCours) return indexEnCours;
  indexEnCours = (async () => {
    const [entreprises, accords, evenements, prospects1, prospects2, prospects3, zones, pays, projets, potentialites, avantages] =
      await Promise.allSettled([
        fetchTous(`${API}/entreprises`),
        fetchTous(`${API}/accords`),
        fetchTous(`${API}/evenements`),
        fetchTous(`${API}/prospects?conclu=false&contactes=false`),
        fetchTous(`${API}/prospects?conclu=false&contactes=true`),
        fetchTous(`${API}/prospects?conclu=true`),
        fetch(`${API}/zones`).then(r => r.json()),
        fetch(`${API}/statistiques/pays`).then(r => r.json()),
        fetchTous(`${API}/projets`),
        fetchTous(`${API}/opportunites/potentialites`),
        fetchTous(`${API}/opportunites/avantages`),
      ]);
    const ok = (r: PromiseSettledResult<any>): any[] => r.status === "fulfilled" && Array.isArray(r.value) ? r.value : [];
    const index: Resultat[] = [
      ...PAGES,
      ...ok(pays).map((p: any) => ({ type: "pays", nom: p.nom, sous: p.continent || undefined, paysId: p.id })),
      ...ok(entreprises).map((e: any) => ({ type: "entreprise", nom: e.nom, sous: e.sigle || undefined, item: e })),
      ...ok(accords).map((a: any) => ({ type: "accord", nom: a.titre, item: a })),
      ...ok(evenements).map((e: any) => ({ type: "evenement", nom: e.nom_event, sous: e.pays_nom || undefined, item: e })),
      ...ok(prospects1).map((p: any) => ({ type: "prospect", nom: p.nom, sous: p.pays || undefined, item: p, onglet: "cibles" })),
      ...ok(prospects2).map((p: any) => ({ type: "prospect", nom: p.nom, sous: p.pays || undefined, item: p, onglet: "historique" })),
      ...ok(prospects3).map((p: any) => ({ type: "prospect", nom: p.nom, sous: p.pays || undefined, item: p, onglet: "termines" })),
      ...ok(zones).map((z: any) => ({ type: "zone", nom: z.denomination || z.nom, sous: z.type_zone || undefined, item: z })),
      ...ok(projets).map((p: any) => ({ type: "projet", nom: p.titre_projet, sous: p.pole_nom || p.pole_territoire || undefined, item: p })),
      ...ok(potentialites).map((p: any) => ({ type: "potentialite", nom: potTitle(p.titre), sous: geoNom(p), item: p })),
      ...ok(avantages).map((a: any) => ({ type: "avantage", nom: a.activite_nom, sous: geoNom(a), item: a })),
    ].filter(r => r.nom);
    // Ne mettre en cache que si l'essentiel a répondu
    if (index.length > PAGES.length) indexCache = index;
    indexEnCours = null;
    return index;
  })();
  return indexEnCours;
}

export default function RechercheGlobale() {
  const [ouvert, setOuvert] = useState(false);
  const [monte, setMonte] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<Resultat[] | null>(null);
  const [actif, setActif] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => { setMonte(true); }, []);

  // ⌘K / Ctrl+K partout ; événement custom pour le bouton de la navbar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOuvert(o => !o);
      }
    };
    const onOuvrir = () => setOuvert(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("apix:recherche", onOuvrir);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("apix:recherche", onOuvrir); };
  }, []);

  // Chargement de l'index à la première ouverture
  useEffect(() => {
    if (!ouvert) return;
    setQ(""); setActif(0);
    chargerIndex().then(setIndex);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [ouvert]);

  const fuse = useMemo(() => index
    ? new (Fuse as any)(index, { keys: ["nom", "sous"], threshold: 0.34, ignoreLocation: true, minMatchCharLength: 2 })
    : null, [index]);

  // Résultats groupés dans l'ordre des GROUPES, plafonnés par groupe
  const resultats: Resultat[] = useMemo(() => {
    if (!q.trim()) return [];
    if (!fuse) return [];
    const bruts: Resultat[] = fuse.search(q.trim(), { limit: 60 }).map((r: any) => r.item);
    const parGroupe: Record<string, Resultat[]> = {};
    for (const r of bruts) {
      (parGroupe[r.type] ||= []);
      if (parGroupe[r.type].length < MAX_PAR_GROUPE) parGroupe[r.type].push(r);
    }
    return ORDRE_GROUPES.flatMap(t => parGroupe[t] || []);
  }, [q, fuse]);

  useEffect(() => { setActif(0); }, [q]);

  const fermer = useCallback(() => setOuvert(false), []);

  const choisir = useCallback((r: Resultat) => {
    fermer();
    if (r.type === "pays" && r.paysId != null) {
      window.dispatchEvent(new CustomEvent("apix:fiche-pays", { detail: { paysId: r.paysId } }));
      return;
    }
    if (r.item) {
      // Fiche ouverte sur place, où qu'on soit (voir FichesGlobales)
      window.dispatchEvent(new CustomEvent("apix:fiche-item", { detail: { type: r.type, item: r.item, onglet: r.onglet } }));
      return;
    }
    if (r.href) router.push(r.href);
  }, [fermer, router]);

  // Navigation clavier
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { fermer(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActif(a => Math.min(a + 1, resultats.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActif(a => Math.max(a - 1, 0)); }
    if (e.key === "Enter" && resultats[actif]) { e.preventDefault(); choisir(resultats[actif]); }
  };

  // Garder l'élément actif visible
  useEffect(() => {
    listeRef.current?.querySelector<HTMLElement>(`[data-idx="${actif}"]`)?.scrollIntoView({ block: "nearest" });
  }, [actif]);

  if (!monte || !ouvert) return null;

  let dernierGroupe = "";
  return createPortal(
    <div onClick={fermer}
      style={{ position: "fixed", inset: 0, background: "rgba(2,20,38,0.45)", backdropFilter: "blur(8px)", zIndex: 900, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "13vh 24px 24px" }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}
.rg-liste{scrollbar-width:thin;scrollbar-color:#D8D4D0 transparent;}
.rg-liste::-webkit-scrollbar{width:11px;}
.rg-liste::-webkit-scrollbar-track{background:transparent;margin:16px 0;}
.rg-liste::-webkit-scrollbar-thumb{background:#D8D4D0;border-radius:999px;border:3.5px solid #fff;background-clip:padding-box;}
.rg-liste::-webkit-scrollbar-thumb:hover{background:#C0BAB5;border:3.5px solid #fff;background-clip:padding-box;}`}</style>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" onKeyDown={onKeyDown}
        style={{ width: "100%", maxWidth: 510, display: "flex", flexDirection: "column" as const, maxHeight: "66vh", animation: "vueIn 0.16s ease" }}>
        {/* Barre de recherche — pilule flottante */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "0 19px", height: 47, background: "rgba(255,255,255,0.97)", borderRadius: 999, border: "1px solid rgba(255,255,255,0.55)", boxShadow: "0 22px 60px rgba(2,20,38,0.38), 0 2px 8px rgba(2,20,38,0.14), inset 0 1px 0 rgba(255,255,255,0.9)", flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 19, color: "#004f91", fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24", lineHeight: 1, flexShrink: 0 }}>search</span>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Rechercher"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontWeight: 500, color: "#1a1a2e", fontFamily: "var(--font-google-sans)", background: "transparent", letterSpacing: "-0.01em" }} />
        </div>

        {/* Résultats — carte détachée sous la barre */}
        {q.trim() && <div ref={listeRef} className="rg-liste"
          style={{ overflowY: "auto", padding: "8px 12px 12px", marginTop: 10, background: "#fff", borderRadius: 22, boxShadow: "0 28px 70px rgba(2,20,38,0.32)", animation: "vueIn 0.14s ease" }}>
          {index === null && q.trim() && (
            <p style={{ padding: "22px 16px", fontSize: 12.5, color: "#9aa5b4", textAlign: "center" as const }}>Chargement de l'index…</p>
          )}
          {resultats.length === 0 && q.trim() && index !== null && (
            <p style={{ padding: "22px 16px", fontSize: 12.5, color: "#9aa5b4", textAlign: "center" as const }}>
              Aucun résultat pour « {q.trim()} »
            </p>
          )}
          {resultats.map((r, i) => {
            const grp = GROUPES[r.type];
            const entete = r.type !== dernierGroupe;
            dernierGroupe = r.type;
            const estActif = i === actif;
            return (
              <div key={`${r.type}-${r.nom}-${i}`}>
                {entete && (
                  <p style={{ fontSize: 9.5, fontWeight: 800, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.12em", padding: "12px 14px 5px" }}>{grp.label}</p>
                )}
                <button data-idx={i} onClick={() => choisir(r)} onMouseMove={() => setActif(i)}
                  style={{ display: "flex", alignItems: "baseline", gap: 10, width: "100%", padding: "10px 14px", borderRadius: 12, border: "none", cursor: "pointer", textAlign: "left" as const, background: estActif ? "rgba(0,79,145,0.06)" : "transparent" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: estActif ? "#004f91" : "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color 0.1s" }}>{r.nom}</span>
                  {r.sous && <span style={{ fontSize: 11, color: "#9aa5b4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{r.sous}</span>}
                </button>
              </div>
            );
          })}
        </div>}

      </div>
    </div>,
    document.body,
  );
}
