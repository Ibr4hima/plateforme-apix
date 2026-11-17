"use client";

// ── Verser une capture ────────────────────────────────────────────────────────
//
// Mettre le relevé fDi à jour passait par une session de transcription, un
// fichier dans le dépôt, un commit et un déploiement. Ici : on capture une page
// de fDi, on la colle (Ctrl+V), le serveur la lit (API Claude) et la compare au
// relevé, on vérifie, on verse. Puis la page suivante, jusqu'à ce que l'écran
// dise que tout est déjà relevé.
//
// La capture reste affichée au-dessus du tableau : c'est elle qui fait foi, et
// chaque case lue se corrige sur place. Le serveur refait son verdict après
// chaque correction, et le refait encore au moment de verser — une ligne
// illisible ou déjà relevée ne part jamais, quoi que l'écran ait coché.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { API_BASE } from "@/lib/api";
import { authHeaders } from "@/lib/authHeaders";
import { Avis, Carte, btnPrincipal, btnSecondaire, IS, TH } from "@/components/admin/UIAdmin";

type Base = "projets" | "signaux";
type Statut = "nouvelle" | "deja" | "ressemble" | "illisible";
type Probleme = { colonne: string; bloquant: boolean; message: string };
type Verdict = {
  rang: number; statut: Statut; senegal: boolean; tronquee: boolean;
  problemes: Probleme[];
  trouvee: { id: number; lot: string; ligne: number } | null;
  /** Signaux : la destination laissée visible par fDi est-elle africaine ? */
  destination_afrique?: boolean | null;
  /** Signal déjà relevé : ses destinations en base, et s'il vise l'Afrique. */
  en_base?: { destinations: string[]; vise_afrique: boolean };
  ecarts: { colonne: string; message: string }[];
  inclure: boolean;
  /** Pour un nom coupé : les noms complets déjà connus qui le prolongent. */
  connus?: Record<string, { nom: string; origine: "connu" | "proposition"; confiance: string | null }[]>;
};
type Analyse = { lignes: Verdict[]; alertes: string[]; compte: Record<string, number>;
                 afrique?: { pays: number[]; regions: number[] } };
/** Une destination du référentiel : un pays ou une région du monde de fDi. */
type PosteDest = { id: number; libelle: string; libelle_en?: string; alias?: string[]; nature?: "pays" | "region" };
type ChoixDest = { pays_id?: number; region_id?: number; libelle: string };
type Ligne = { rang: number; cases: Record<string, string> };
type Serie = { pages: { page: number; lignes: number }[]; suivante: number; lecture_active: boolean };

// Les colonnes dans l'ordre de l'écran de fDi : l'œil passe de la capture au
// tableau sans changer de sens de lecture. [clé, intitulé, largeur minimale]
const COLONNES: Record<Base, [string, string, number][]> = {
  projets: [
    ["date", "Date", 78], ["parent", "Société mère", 150], ["entreprise", "Entreprise", 150],
    ["source", "Origine", 108], ["dest", "Destination", 108], ["secteur", "Secteur", 136],
    ["sous_secteur", "Sous-secteur", 156], ["activite", "Activité", 144],
    ["capex", "Montant", 96], ["emplois", "Emplois", 66], ["type", "Type", 86],
  ],
  signaux: [
    ["date", "Date", 78], ["parent", "Société mère", 150], ["entreprise", "Entreprise", 150],
    ["source", "Origine", 108], ["destination", "Destination", 116], ["secteur", "Secteur", 136],
    ["activite", "Activité", 136], ["signal", "Signal", 156],
    ["funding", "Fonds levés", 92], ["capex", "Investissement", 104],
  ],
};

// « Verser », « Rang » et « Statut » restent à gauche quand le tableau défile
// vers la droite : onze colonnes de textes fDi ne tiennent pas dans l'écran,
// et l'on ne doit jamais perdre de vue ce qu'on s'apprête à verser.
const FIGEES = [{ l: "Verser", w: 52 }, { l: "Rang", w: 40 }, { l: "Statut", w: 96 }];
const GAUCHE = [0, 52, 92];
const LARGEUR_FIGEE = 188;

const STATUT: Record<Statut, { mot: string; couleur: string }> = {
  nouvelle:  { mot: "Nouvelle",     couleur: "var(--vert)" },
  deja:      { mot: "Déjà relevée", couleur: "var(--gris)" },
  ressemble: { mot: "À vérifier",   couleur: "var(--orange)" },
  illisible: { mot: "Illisible",    couleur: "var(--danger)" },
};

const LISTE: Record<Base, string> = {
  projets: "la liste des projets « Dest = Africa »",
  signaux: "la liste des Investor signals « Dest = Africa »",
};

// L'API refuse une image de plus de cinq méga-octets une fois encodée ; on
// réduit dans le navigateur, avant l'envoi, ce qui dépasse.
const POIDS_CIBLE = 3_500_000;
const COTE_MAX = 3200;
const MEDIAS = ["image/png", "image/jpeg", "image/webp", "image/gif"];

async function preparer(fichier: Blob): Promise<Blob> {
  if (fichier.size <= POIDS_CIBLE && MEDIAS.includes(fichier.type)) return fichier;
  const img = await createImageBitmap(fichier);
  const k = Math.min(1, COTE_MAX / Math.max(img.width, img.height));
  const toile = document.createElement("canvas");
  toile.width = Math.round(img.width * k);
  toile.height = Math.round(img.height * k);
  toile.getContext("2d")?.drawImage(img, 0, 0, toile.width, toile.height);
  for (const q of [0.92, 0.85, 0.75]) {
    const b = await new Promise<Blob | null>(r => toile.toBlob(r, "image/jpeg", q));
    if (b && b.size <= POIDS_CIBLE) return b;
  }
  throw new Error("Capture trop lourde, même réduite : la recadrer sur le tableau.");
}

const deuxChiffres = (n: number) => String(n).padStart(2, "0");

// ── Les noms coupés par fDi ───────────────────────────────────────────────────
// Société mère et entreprise se complètent ici, à la place de l'arbitrage. La
// case garde le texte de fDi ; le nom complet désigne l'entreprise. Les règles
// sont celles du serveur (fdi_projets.normaliser, fdi_propositions.valider),
// qui les revérifie au versement.
const COLONNES_NOMS = ["parent", "entreprise"] as const;
const FIN_TRONQUEE = /\s*(?:…|\.\.\.)\s*$/;
const estTronque = (v?: string | null) => !!v && FIN_TRONQUEE.test(v);
const prefixeAffiche = (v: string) => v.replace(FIN_TRONQUEE, "").trim();
const normaliser = (v: string) => v.normalize("NFKD").replace(/[^\x00-\x7F]/g, "").toLowerCase()
  .replace(/&/g, " and ").replace(FIN_TRONQUEE, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
/** Le nom donné correspond-il au texte coupé ? Il peut le prolonger, l'égaler
    ou le raccourcir — « Aya Gold & Silver » pour « Aya Gold & Silver (… », la
    parenthèse entamée tombe —, pas en différer ni être coupé lui-même. La
    règle du serveur (fdi_captures.accepter_nom), qui la revérifie. */
const accepte = (brut: string, nom: string) => {
  const p = normaliser(prefixeAffiche(brut)), n = normaliser(nom);
  return !estTronque(nom) && n.length >= 2 && (n.startsWith(p) || p.startsWith(n));
};

// Le raccourci de collage tel qu'il se tape sur la machine : « ⌘V » sur Mac,
// où Ctrl+V ne colle rien. Lu après l'hydratation — le serveur ne connaît pas
// la machine, il écrit « Ctrl+V », et l'écran se corrige sans désaccord.
const sansAbonnement = () => () => {};
function useRaccourciColler(): string {
  return useSyncExternalStore(sansAbonnement,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘V" : "Ctrl+V"),
    () => "Ctrl+V");
}
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`;
};

/** Le choix d'une destination : on tape le pays en français ou en anglais —
    c'est l'écran de fDi qu'on a sous les yeux —, Entrée l'ajoute et le champ
    reste ouvert pour la suivante ; Échap ou un clic ailleurs le referme. */
function ChoixDestination({ options, onChoisir, onFermer }: {
  options: PosteDest[]; onChoisir: (p: PosteDest) => void; onFermer: () => void;
}) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const n = normaliser(q);
  const liste = (n ? options.filter(o => [o.libelle, o.libelle_en ?? "", ...(o.alias ?? [])]
    .some(x => normaliser(x).includes(n))) : [])
    .slice(0, 7);
  const choisir = (o: PosteDest) => { onChoisir(o); setQ(""); setI(0); };
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
      <input autoFocus value={q} placeholder="Pays ou région, en français ou en anglais…"
        aria-label="Ajouter une destination"
        onChange={e => { setQ(e.target.value); setI(0); }}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setI(x => Math.min(x + 1, Math.max(liste.length - 1, 0))); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setI(x => Math.max(x - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); if (liste[i]) choisir(liste[i]); }
          else if (e.key === "Escape") { e.preventDefault(); onFermer(); }
        }}
        onBlur={onFermer}
        style={{ ...IS, width: 280, padding: "5px 9px", fontSize: 12 }} />
      {liste.length > 0 && (
        <span role="listbox" style={{ display: "flex", flexDirection: "column", border: "1px solid var(--bordure)",
          borderRadius: 6, background: "var(--carte)", overflow: "hidden", width: 280 }}>
          {liste.map((o, k) => (
            <button key={`${o.nature}-${o.id}`} type="button" role="option" aria-selected={k === i}
              // mousedown et non click : le champ ne perd pas le focus, donc ne se referme pas
              onMouseDown={e => { e.preventDefault(); choisir(o); }}
              style={{ textAlign: "left", border: "none", padding: "5px 9px", fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                background: k === i ? "rgb(var(--bleu-rgb) / 0.08)" : "transparent", color: "var(--encre)" }}>
              {o.libelle}
              <span style={{ color: "var(--gris)" }}>
                {o.libelle_en && o.libelle_en !== o.libelle ? ` · ${o.libelle_en}` : ""}{o.nature === "region" ? " · région du monde" : ""}
              </span>
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

async function erreurDe(r: Response, defaut: string): Promise<string> {
  const d = await r.json().catch(() => ({}));
  return typeof d.detail === "string" ? d.detail : defaut;
}

export default function VerserCapture({ base, onVerse }: {
  base: Base;
  /** Après un versement : les écrans qui comptent projets et libellés à
      trancher ont à se rafraîchir. */
  onVerse?: () => void;
}) {
  const [etat, setEtat] = useState<"attente" | "lecture" | "apercu" | "envoi">("attente");
  const [jour, setJour] = useState(aujourdhui);
  const [page, setPage] = useState(1);
  const [serie, setSerie] = useState<Serie | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [tailleReelle, setTailleReelle] = useState(false);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [pageAffichee, setPageAffichee] = useState<number | null>(null);
  // Les cases retouchées depuis le dernier verdict : on ne redemande le
  // verdict qu'en quittant une case réellement modifiée.
  const [aRevoir, setARevoir] = useState(false);
  // Le choix de l'humain sur « verser cette ligne », retenu AVEC le statut
  // auquel il répondait : si une correction change le verdict, le choix
  // retombe sur la valeur par défaut du nouveau verdict.
  const [choix, setChoix] = useState<Record<number, { inclure: boolean; statut: Statut }>>({});
  // Les noms complétés à l'écran, par rang et par colonne (« parent »,
  // « entreprise »).
  const [noms, setNoms] = useState<Record<number, Partial<Record<string, string>>>>({});
  // Signaux : les destinations que fDi cachait, ajoutées ligne par ligne, et
  // le référentiel où on les choisit (français, recherche en anglais aussi).
  const [ajouts, setAjouts] = useState<Record<number, ChoixDest[]>>({});
  const [refDest, setRefDest] = useState<PosteDest[]>([]);
  const [selecteur, setSelecteur] = useState<number | null>(null);
  const [chrono, setChrono] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const fichierRef = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);

  const colonnes = COLONNES[base];
  const raccourci = useRaccourciColler();

  // ── La série du jour : ce qui est déjà versé, et la page suivante ──────────
  // La page proposée ne suit la série qu'en attente : pendant qu'une page est
  // à l'écran, son numéro est celui qu'on a choisi.
  const etatRef = useRef(etat);
  useEffect(() => { etatRef.current = etat; }, [etat]);
  useEffect(() => {
    let vivant = true;
    fetch(`${API_BASE}/fdi/captures/serie?base=${base}&jour=${jour}`)
      .then(r => (r.ok ? r.json() : null))
      .then((s: Serie | null) => {
        if (!vivant || !s) return;
        setSerie(s);
        if (etatRef.current === "attente") setPage(s.suivante);
      })
      .catch(() => {});
    return () => { vivant = false; };
  }, [base, jour]);

  useEffect(() => {
    if (base !== "signaux") return;
    let vivant = true;
    fetch(`${API_BASE}/fdi/signaux-investisseurs/referentiels`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (vivant && d) setRefDest(d.destinations ?? []); })
      .catch(() => {});
    return () => { vivant = false; };
  }, [base]);

  // Le chronomètre de la lecture : vingt secondes sans signe de vie, c'est
  // long, et l'on se demande si quelque chose s'est bloqué.
  useEffect(() => {
    if (etat !== "lecture") return;
    const debut = Date.now();
    const t = setInterval(() => setChrono(Math.round((Date.now() - debut) / 1000)), 500);
    return () => { clearInterval(t); setChrono(0); };
  }, [etat]);

  // L'URL locale de l'image se libère quand l'image change.
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);

  const inclus = (v: Verdict) => {
    if (v.statut === "deja" || v.statut === "illisible") return false;
    const c = choix[v.rang];
    return c && c.statut === v.statut ? c.inclure : v.inclure;
  };

  // ── Lire une capture ────────────────────────────────────────────────────────
  const lire = useCallback(async (f: Blob) => {
    setErreur(null); setSucces(null);
    let blob: Blob;
    try { blob = await preparer(f); }
    catch (e: unknown) { setErreur(e instanceof Error ? e.message : "Image illisible."); return; }
    setImage(URL.createObjectURL(blob)); setTailleReelle(false);
    setEtat("lecture"); setAnalyse(null); setLignes([]); setChoix({}); setNoms({}); setAjouts({}); setARevoir(false);
    try {
      const fd = new FormData();
      fd.append("fichier", blob, blob.type === "image/jpeg" ? "capture.jpg" : "capture.png");
      fd.append("base", base); fd.append("jour", jour); fd.append("page", String(page));
      const r = await fetch(`${API_BASE}/fdi/captures/lire`, {
        method: "POST", headers: await authHeaders(), body: fd,
      });
      if (!r.ok) throw new Error(await erreurDe(r, `Lecture refusée (HTTP ${r.status}).`));
      const d = await r.json();
      setLignes(d.lignes); setAnalyse(d.analyse); setPage(d.page);
      setPageAffichee(d.page_affichee ?? null);
      setEtat("apercu");
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : "Lecture impossible.");
      setImage(null); setEtat("attente");
    }
  }, [base, jour, page]);

  // Ctrl+V n'importe où sur l'écran. Pendant qu'une page attend d'être versée,
  // une nouvelle capture la remplacerait sans prévenir : on refuse, et on dit
  // pourquoi.
  useEffect(() => {
    const coller = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find(x => x.type.startsWith("image/"));
      if (!f) return;
      e.preventDefault();
      if (etat === "attente") lire(f);
      else setErreur("Une page est déjà à l'écran : la verser ou l'abandonner avant d'en coller une autre.");
    };
    window.addEventListener("paste", coller);
    return () => window.removeEventListener("paste", coller);
  }, [etat, lire]);

  // ── Corriger, et redemander le verdict ─────────────────────────────────────
  const reverifier = useCallback(async (ls: Ligne[], p = page, j = jour) => {
    const r = await fetch(`${API_BASE}/fdi/captures/verifier`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ base, jour: j, page: p, lignes: ls.map(l => ({ rang: l.rang, cases: l.cases })) }),
    });
    if (!r.ok) { setErreur(await erreurDe(r, "Vérification impossible.")); return; }
    setAnalyse(await r.json()); setARevoir(false);
  }, [base, jour, page]);

  const verdicts = new Map((analyse?.lignes ?? []).map(v => [v.rang, v]));

  const corriger = (rang: number, col: string, v: string) => {
    setLignes(ls => ls.map(l => (l.rang === rang ? { ...l, cases: { ...l.cases, [col]: v } } : l)));
    setARevoir(true);
  };

  const poserNom = (rang: number, col: string, valeur: string | undefined) =>
    setNoms(n => {
      const ligne = { ...(n[rang] ?? {}) };
      if (valeur === undefined) delete ligne[col]; else ligne[col] = valeur;
      return { ...n, [rang]: ligne };
    });

  // Un nom complété vaut pour toutes les cases de la page qui portent le même
  // texte coupé et que personne n'a encore complétées — la société mère de la
  // même ligne, et les autres lignes du même groupe.
  const propager = (brut: string, nom: string, sauf?: { rang: number; col: string }) =>
    setNoms(n => {
      const suite = { ...n };
      for (const l of lignes) for (const col of COLONNES_NOMS) {
        if (sauf && sauf.rang === l.rang && sauf.col === col) continue;
        const deja = suite[l.rang]?.[col];
        if ((l.cases[col] ?? "") === brut && !(deja && accepte(brut, deja))) {
          suite[l.rang] = { ...(suite[l.rang] ?? {}), [col]: nom };
        }
      }
      return suite;
    });

  // Un nom vaut pour les lignes versées ET pour les lignes déjà relevées :
  // c'est sur elles que les points de suspension restaient.
  const nomsActifs = (v?: Verdict) => !!v && (inclus(v) || v.statut === "deja");
  // Les cases qu'on a réellement retouchées : un simple clic qui pose le début
  // affiché ne vaut pas décision ; une saisie, ou Entrée, si.
  const retouchees = useRef(new Set<string>());
  // Le clic qui donne le focus à un nom : son relâchement placerait le curseur
  // et déferait la sélection du nom entier posée au focus.
  const clicFocus = useRef(false);

  const nomValide = (l: Ligne, col: string) => {
    const nom = noms[l.rang]?.[col];
    return nom && estTronque(l.cases[col]) && accepte(l.cases[col] ?? "", nom) ? nom.trim() : null;
  };
  const nomsDe = (l: Ligne) => Object.fromEntries(
    COLONNES_NOMS.map(col => [col, nomValide(l, col)]).filter(([, nom]) => nom));

  // ── Les destinations cachées (signaux) ──────────────────────────────────────
  const estAfricaine = (d: ChoixDest) => !!analyse?.afrique && (d.pays_id != null
    ? analyse.afrique.pays.includes(d.pays_id) : analyse.afrique.regions.includes(d.region_id ?? -1));
  // Une ligne reçoit des destinations si elle est versée, ou si elle est un
  // signal déjà relevé : on le complète alors sans rien doubler.
  const peutCompleter = (v: Verdict) => base === "signaux" && (inclus(v) || v.statut === "deja");
  const viseAfrique = (v: Verdict) => !!v.destination_afrique || !!v.en_base?.vise_afrique
    || (ajouts[v.rang] ?? []).some(estAfricaine);
  const ajouter = (rang: number, p: PosteDest) => setAjouts(a => {
    const liste = a[rang] ?? [];
    const choix: ChoixDest = p.nature === "region" ? { region_id: p.id, libelle: p.libelle } : { pays_id: p.id, libelle: p.libelle };
    if (liste.some(x => x.pays_id === choix.pays_id && x.region_id === choix.region_id)) return a;
    return { ...a, [rang]: [...liste, choix] };
  });
  const retirer = (rang: number, d: ChoixDest) =>
    setAjouts(a => ({ ...a, [rang]: (a[rang] ?? []).filter(x => x !== d) }));
  const destinationsDe = (l: Ligne) => {
    const v = verdicts.get(l.rang);
    if (!v || !peutCompleter(v)) return [];
    return (ajouts[l.rang] ?? []).map(d => (d.pays_id != null ? { pays_id: d.pays_id } : { region_id: d.region_id }));
  };
  const senegal = refDest.find(p => p.nature === "pays" && (p.libelle_en === "Senegal" || p.libelle === "Sénégal"));

  // ── Verser ──────────────────────────────────────────────────────────────────
  const aVerser = lignes.filter(l => { const v = verdicts.get(l.rang); return v ? inclus(v) : false; });
  // Les signaux déjà relevés qu'on complète au passage, sans rien verser.
  const aCompleterDeja = lignes.filter(l => verdicts.get(l.rang)?.statut === "deja"
    && (destinationsDe(l).length > 0 || Object.keys(nomsDe(l)).length > 0));
  const unite = (n: number) => (base === "signaux" ? `signal${n > 1 ? "aux" : ""}` : `ligne${n > 1 ? "s" : ""}`);

  const verser = async () => {
    setEtat("envoi"); setErreur(null);
    try {
      const r = await fetch(`${API_BASE}/fdi/captures/verser`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ base, jour, page, lignes: lignes.map(l => ({
          rang: l.rang, cases: l.cases, noms: nomsActifs(verdicts.get(l.rang)) ? nomsDe(l) : {},
          destinations: destinationsDe(l),
          inclure: aVerser.some(x => x.rang === l.rang),
        })) }),
      });
      if (!r.ok) throw new Error(await erreurDe(r, `Versement refusé (HTTP ${r.status}).`));
      const d = await r.json();
      const sen = base === "projets"
        ? (d.lots as { libelle: string; lignes: number }[]).find(l => l.libelle.startsWith("Sénégal"))?.lignes ?? 0
        : 0;
      const n = d.lignes as number;
      const dest = d.destinations_ajoutees
        ? ` — ${d.destinations_ajoutees} destination${d.destinations_ajoutees > 1 ? "s" : ""} ajoutée${d.destinations_ajoutees > 1 ? "s" : ""}`
          + (d.signaux_deja_completes ? `, dont ${d.signaux_deja_completes} signal${d.signaux_deja_completes > 1 ? "aux" : ""} déjà relevé${d.signaux_deja_completes > 1 ? "s" : ""}` : "")
        : "";
      const nomsTxt = d.noms_completes
        ? ` — ${d.noms_completes} nom${d.noms_completes > 1 ? "s" : ""} complété${d.noms_completes > 1 ? "s" : ""}`
          + (d.lignes_renommees ? ` (${d.lignes_renommees} ligne${d.lignes_renommees > 1 ? "s" : ""} complétée${d.lignes_renommees > 1 ? "s" : ""} dans toute la base)` : "")
        : "";
      if (n === 0) {
        setSucces(`Aucune ligne nouvelle sur cette page${nomsTxt}${dest}. Collez la page suivante.`);
        setImage(null); setLignes([]); setAnalyse(null); setChoix({}); setNoms({}); setAjouts({}); setEtat("attente");
        onVerse?.();
        return;
      }
      setSucces(`Page ${deuxChiffres(page)} versée : ${n} ligne${n > 1 ? "s" : ""}` + dest
        + (sen ? `, dont ${sen} au relevé du Sénégal` : "")
        + nomsTxt
        + (d.a_arbitrer ? ` — ${d.a_arbitrer} entreprise${d.a_arbitrer > 1 ? "s" : ""} au nom tronqué à arbitrer` : "")
        + (d.non_rattaches ? ` — ${d.non_rattaches} case${d.non_rattaches > 1 ? "s" : ""} non rattachée${d.non_rattaches > 1 ? "s" : ""} à reprendre dans la fiche de la ligne` : "")
        + `. Collez la page ${deuxChiffres(d.serie.suivante)}.`);
      setSerie(d.serie); setPage(d.serie.suivante);
      setImage(null); setLignes([]); setAnalyse(null); setChoix({}); setNoms({}); setAjouts({}); setEtat("attente");
      onVerse?.();
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : "Versement impossible.");
      setEtat("apercu");
      // La base a pu changer entre-temps (une autre page versée) : le verdict
      // affiché est peut-être périmé, on le refait.
      reverifier(lignes).catch(() => {});
    }
  };

  const abandonner = () => {
    setImage(null); setLignes([]); setAnalyse(null); setChoix({}); setNoms({}); setAjouts({}); setErreur(null); setEtat("attente");
    if (serie) setPage(serie.suivante);
  };

  const compte = analyse?.compte ?? {};
  const enCours = etat === "lecture" || etat === "envoi";

  return (
    <Carte titre="Verser une capture">
      {erreur && <div style={{ marginBottom: 14 }}><Avis ton="erreur">{erreur}</Avis></div>}
      {succes && <div style={{ marginBottom: 14 }}><Avis ton="ok">{succes}</Avis></div>}
      {serie && !serie.lecture_active && (
        <div style={{ marginBottom: 14 }}>
          <Avis ton="info">Lecture des captures indisponible : l&apos;assistant IA n&apos;est pas configuré sur ce serveur (clé API absente).</Avis>
        </div>
      )}

      <p style={{ fontSize: 12.5, color: "var(--gris-fort)", lineHeight: 1.65, margin: "0 0 14px", maxWidth: 860 }}>
        Dans fDi, ouvrir {LISTE[base]}, triée par date, la plus récente en tête. Capturer une page
        entière — ses quinze lignes et toutes ses colonnes — puis la coller ici. La plateforme la lit,
        la compare au relevé et ne propose que ce qui manque ; on continue page après page jusqu&apos;à
        ce qu&apos;elle annonce que tout est déjà relevé.
      </p>

      {/* La série : la date de la capture et le numéro de la page. Ils font le
          nom du lot, et reverser la même page la remplace. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16, fontSize: 12.5, color: "var(--gris-fort)" }}>
        <span>Capture du</span>
        <input type="date" value={jour} max={aujourdhui()} disabled={enCours}
          onChange={e => {
            const j = e.target.value; if (!j) return;
            setJour(j);
            if (etat === "apercu") reverifier(lignes, page, j);
          }}
          aria-label="Date de la capture"
          style={{ ...IS, width: 150, padding: "6px 10px", fontSize: 12.5 }} />
        <span>page</span>
        <input type="number" min={1} max={9999} value={page} disabled={enCours}
          onChange={e => {
            const p = Math.max(1, Math.min(9999, Number(e.target.value) || 1));
            setPage(p);
            if (etat === "apercu") reverifier(lignes, p);
          }}
          aria-label="Numéro de page"
          style={{ ...IS, width: 76, padding: "6px 10px", fontSize: 12.5 }} />
        {pageAffichee != null && pageAffichee !== page && etat === "apercu" && (
          <span style={{ color: "var(--orange)", fontWeight: 600 }}>
            La capture montre la page {pageAffichee}.
          </span>
        )}
        {serie && serie.pages.length > 0 && (
          <span style={{ color: "var(--gris)" }}>
            Déjà versées ce jour : {serie.pages.map(p => `page ${deuxChiffres(p.page)} (${p.lignes})`).join(", ")}.
          </span>
        )}
      </div>

      {etat === "attente" && (
        <div
          role="button" tabIndex={0}
          onClick={() => fichierRef.current?.click()}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fichierRef.current?.click(); } }}
          onDragOver={e => { e.preventDefault(); setSurvol(true); }}
          onDragLeave={() => setSurvol(false)}
          onDrop={e => {
            e.preventDefault(); setSurvol(false);
            const f = Array.from(e.dataTransfer.files).find(x => x.type.startsWith("image/"));
            if (f) lire(f);
          }}
          style={{ border: `1.5px dashed ${survol ? "var(--bleu)" : "var(--bordure-forte)"}`, borderRadius: 8,
            padding: "38px 16px", textAlign: "center", cursor: "pointer",
            background: survol ? "rgb(var(--bleu-rgb) / 0.05)" : "var(--carte)", transition: "background-color .15s, border-color .15s" }}>
          <input ref={fichierRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) lire(f); e.target.value = ""; }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--encre)" }}>
            Coller la capture de la page {deuxChiffres(page)} ({raccourci})
          </div>
          <div style={{ fontSize: 12, color: "var(--gris)", marginTop: 5 }}>
            ou déposer l&apos;image ici, ou cliquer pour la choisir
          </div>
        </div>
      )}

      {image && (
        <div style={{ border: "1px solid var(--bordure)", borderRadius: 8, overflow: "auto",
          maxHeight: tailleReelle ? 640 : 440, background: "var(--carte-douce)", marginBottom: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Capture de la page fDi" onClick={() => setTailleReelle(t => !t)}
            title={tailleReelle ? "Ajuster à la largeur" : "Voir en taille réelle"}
            style={{ display: "block", width: tailleReelle ? "auto" : "100%", maxWidth: tailleReelle ? "none" : "100%",
              cursor: tailleReelle ? "zoom-out" : "zoom-in" }} />
        </div>
      )}

      {etat === "lecture" && (
        <p role="status" style={{ fontSize: 13, color: "var(--gris-fort)", margin: "4px 0 0" }}>
          Lecture de la capture… {chrono > 0 ? `${chrono} s` : ""}
          <span style={{ color: "var(--gris)" }}> — une page de quinze lignes se lit en une vingtaine de secondes.</span>
        </p>
      )}

      {analyse && (etat === "apercu" || etat === "envoi") && (
        <>
          {analyse.alertes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Avis ton="info">
                {analyse.alertes.map(a => <div key={a}>{a}</div>)}
              </Avis>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontSize: 12.5, marginBottom: 10 }}>
            {(["nouvelle", "deja", "ressemble", "illisible"] as Statut[]).filter(s => compte[s]).map(s => (
              <span key={s} style={{ color: STATUT[s].couleur, fontWeight: 700 }}>
                {compte[s]} {s === "nouvelle" ? `nouvelle${compte[s] > 1 ? "s" : ""}`
                  : s === "deja" ? `déjà relevée${compte[s] > 1 ? "s" : ""}`
                  : s === "ressemble" ? "à vérifier" : `illisible${compte[s] > 1 ? "s" : ""}`}
              </span>
            ))}
            {base === "projets" && compte.senegal > 0 && (
              <span style={{ color: "var(--bleu)", fontWeight: 700 }}>
                {compte.senegal} pour le relevé du Sénégal
              </span>
            )}
            {(() => {
              const cases = lignes.filter(l => nomsActifs(verdicts.get(l.rang)))
                .flatMap(l => COLONNES_NOMS.filter(col => estTronque(l.cases[col])).map(col => nomValide(l, col)));
              const restent = cases.filter(x => !x).length, faits = cases.length - restent;
              return (
                <>
                  {restent > 0 && (
                    <span style={{ color: "var(--orange)", fontWeight: 700 }}
                      title="Cliquer sur une case orange pour taper la fin du nom. Sans quoi, le nom passera par l'onglet « Entreprises ».">
                      {restent} nom{restent > 1 ? "s" : ""} coupé{restent > 1 ? "s" : ""} à compléter
                    </span>
                  )}
                  {faits > 0 && <span style={{ color: "var(--vert)", fontWeight: 700 }}>{faits} complété{faits > 1 ? "s" : ""}</span>}
                  {base === "signaux" && (() => {
                    const caches = (analyse?.lignes ?? []).filter(v => peutCompleter(v) && !viseAfrique(v)).length;
                    return caches > 0 ? (
                      <span style={{ color: "var(--orange)", fontWeight: 700 }}
                        title="Ouvrir la case Destination dans fDi, puis ajouter ici les pays cachés">
                        {caches} sans destination africaine visible
                      </span>
                    ) : null;
                  })()}
                </>
              );
            })()}
            {aRevoir && <span style={{ color: "var(--gris)" }}>Cases modifiées : le verdict se refait en quittant la case.</span>}
          </div>

          <div style={{ border: "1px solid rgb(var(--encre-rgb) / 0.10)", borderRadius: 8, overflow: "auto", maxHeight: 620 }}>
            {/* Disposition fixe et bordures séparées : c'est ce qui permet aux
                colonnes figées de garder leur largeur et leurs filets en défilant. */}
            <table style={{ tableLayout: "fixed", borderCollapse: "separate", borderSpacing: 0,
              width: colonnes.reduce((s, c) => s + c[2], LARGEUR_FIGEE), minWidth: "100%" }}>
              <thead>
                <tr>
                  {FIGEES.map((f, i) => (
                    <th key={f.l} style={{ ...TH, padding: "10px 8px", width: f.w, left: GAUCHE[i], zIndex: 3,
                      boxShadow: i === 2 ? "inset -1px 0 0 var(--bordure)" : undefined }}>{f.l}</th>
                  ))}
                  {colonnes.map(([c, l, w]) => (
                    <th key={c} style={{ ...TH, padding: "10px 8px", width: w }}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map(l => {
                  const v = verdicts.get(l.rang);
                  if (!v) return null;
                  const pris = inclus(v);
                  const verrouillee = v.statut === "deja" || v.statut === "illisible";
                  const fondLigne = v.statut === "deja" ? "var(--carte-douce)" : "var(--carte)";
                  const fige = (i: number): React.CSSProperties => ({
                    position: "sticky", left: GAUCHE[i], zIndex: 1, background: fondLigne,
                    borderTop: "1px solid var(--filet)",
                    boxShadow: i === 2 ? "inset -1px 0 0 var(--bordure)" : undefined,
                  });
                  const parCase = new Map(v.problemes.map(p => [p.colonne, p]));
                  const completable = peutCompleter(v);
                  const cachee = completable && !viseAfrique(v);
                  const ecart = new Set(v.ecarts.map(e => e.colonne));
                  const notes = [
                    ...(v.statut === "deja" && v.trouvee ? [`Déjà relevée : ${v.trouvee.lot}, rang ${v.trouvee.ligne}.`] : []),
                    ...(v.statut === "ressemble" && v.trouvee ? [`Ressemble à ${v.trouvee.lot}, rang ${v.trouvee.ligne} — ${v.ecarts.map(e => e.message).join(" ")}`] : []),
                    ...v.problemes.map(p => p.message),
                    ...(v.senegal && v.statut !== "deja" ? ["Ira au relevé du Sénégal, pas à celui de l'Afrique."] : []),
                  ];
                  // Les noms coupés encore à compléter, et ce que la base en
                  // connaît déjà — une seule fois quand société mère et
                  // entreprise portent le même texte.
                  const suggestions = !nomsActifs(v) ? [] : COLONNES_NOMS
                    .filter(col => estTronque(l.cases[col]) && !nomValide(l, col) && (v.connus?.[col]?.length ?? 0) > 0)
                    .map(col => ({ brut: l.cases[col] ?? "", liste: v.connus?.[col] ?? [] }))
                    .filter((sg, i, t) => t.findIndex(x => x.brut === sg.brut) === i);
                  return [
                    <tr key={l.rang} style={{ background: fondLigne }}>
                      <td style={{ ...fige(0), padding: "6px 8px", textAlign: "center" }}>
                        <input type="checkbox" checked={pris} disabled={verrouillee || etat === "envoi"}
                          aria-label={`Verser la ligne ${l.rang}`}
                          onChange={e => setChoix(c => ({ ...c, [l.rang]: { inclure: e.target.checked, statut: v.statut } }))} />
                      </td>
                      <td style={{ ...fige(1), padding: "6px 8px", fontSize: 12, color: "var(--gris)", fontVariantNumeric: "tabular-nums" }}>{l.rang}</td>
                      <td style={{ ...fige(2), padding: "6px 8px", fontSize: 11.5, fontWeight: 700, color: STATUT[v.statut].couleur, whiteSpace: "nowrap" }}>
                        {STATUT[v.statut].mot}
                      </td>
                      {colonnes.map(([c]) => {
                        const p = parCase.get(c);
                        const brut = l.cases[c] ?? "";
                        // Un nom se complète sur une ligne qui sera versée, ou déjà
                        // relevée — il ira alors à la ligne en base. Sur une ligne
                        // écartée, l'orange inviterait à un geste sans effet.
                        const estNom = (COLONNES_NOMS as readonly string[]).includes(c);
                        const coupe = nomsActifs(v) && estNom && estTronque(brut);
                        const saisi = coupe ? noms[l.rang]?.[c] : undefined;
                        const complete = saisi !== undefined && accepte(brut, saisi);
                        const fond = p?.bloquant ? "rgb(220 38 38 / 0.08)"
                          : p || ecart.has(c) ? "var(--orange-voile)"
                          : coupe && !complete ? "var(--orange-voile)"
                          : c === "destination" && cachee ? "var(--orange-voile)"
                          : complete ? "var(--vert-voile)" : "transparent";
                        return (
                          <td key={c} style={{ padding: "3px 4px", borderTop: "1px solid var(--filet)", background: fond }}
                            title={p?.message ?? (c === "destination" && cachee
                              ? "La destination africaine est cachée chez fDi : l'ajouter sous la ligne" : coupe
                              ? complete ? `Texte de fDi : « ${brut} » — nom complété` : "Nom coupé par fDi : cliquer pour le compléter"
                              : undefined)}>
                            <input value={saisi ?? brut} disabled={etat === "envoi"}
                              onChange={e => {
                                if (coupe) { retouchees.current.add(`${l.rang}:${c}`); poserNom(l.rang, c, e.target.value); }
                                else corriger(l.rang, c, e.target.value);
                              }}
                              onKeyDown={e => {
                                // Entrée confirme le nom tel qu'il est — y compris
                                // la seule partie visible, quand on la juge suffisante.
                                if (coupe && e.key === "Enter") {
                                  e.preventDefault();
                                  retouchees.current.add(`${l.rang}:${c}`);
                                  e.currentTarget.blur();
                                }
                              }}
                              onMouseDown={e => {
                                if (estNom && document.activeElement !== e.currentTarget) clicFocus.current = true;
                              }}
                              onMouseUp={e => {
                                if (clicFocus.current) { clicFocus.current = false; e.preventDefault(); }
                              }}
                              onFocus={e => {
                                e.currentTarget.style.borderColor = "var(--bleu)"; e.currentTarget.style.background = "var(--carte)";
                                const champ = e.currentTarget;
                                // Un nom coupé part du début affiché par fDi, sans « … ».
                                if (coupe && saisi === undefined) poserNom(l.rang, c, prefixeAffiche(brut));
                                // Le NOM ENTIER SÉLECTIONNÉ, comme dans les tableaux :
                                // taper remplace, → complète, un second clic place
                                // le curseur.
                                if (estNom) requestAnimationFrame(() => champ.select());
                              }}
                              onBlur={e => {
                                e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent";
                                if (coupe) {
                                  const tape = (saisi ?? "").trim();
                                  const cle = `${l.rang}:${c}`;
                                  const touchee = retouchees.current.has(cle);
                                  retouchees.current.delete(cle);
                                  if (!tape || (!touchee && normaliser(tape) === normaliser(prefixeAffiche(brut)))) {
                                    // Vidée, ou seulement cliquée : retour au texte de fDi.
                                    poserNom(l.rang, c, undefined);
                                  } else if (accepte(brut, tape)) {
                                    propager(brut, tape, { rang: l.rang, col: c });
                                  } else {
                                    // Un autre début que celui affiché : c'est
                                    // la lecture qui était fausse. La case est
                                    // corrigée, et le verdict refait.
                                    poserNom(l.rang, c, undefined);
                                    const maj = lignes.map(x => (x.rang === l.rang ? { ...x, cases: { ...x.cases, [c]: tape } } : x));
                                    setLignes(maj);
                                    reverifier(maj);
                                  }
                                  return;
                                }
                                if (aRevoir) reverifier(lignes);
                              }}
                              aria-label={`Rang ${l.rang}, ${c}`}
                              style={{ width: "100%", boxSizing: "border-box", border: "1px solid transparent", borderRadius: 6,
                                background: "transparent", padding: "5px 6px", fontSize: 12, fontFamily: "inherit",
                                color: v.statut === "deja" ? "var(--gris)" : coupe && !complete ? "var(--orange-fonce)" : "var(--encre)",
                                outline: "none" }} />
                          </td>
                        );
                      })}
                    </tr>,
                    (notes.length > 0 || suggestions.length > 0 || completable) && (
                      <tr key={`${l.rang}-note`} style={{ background: fondLigne }}>
                        <td style={{ position: "sticky", left: 0, background: fondLigne, zIndex: 1 }} />
                        <td colSpan={colonnes.length + 2} style={{ padding: "0 8px 7px", fontSize: 11.5, lineHeight: 1.5,
                          color: v.statut === "illisible" ? "var(--danger)" : v.statut === "ressemble" ? "var(--orange-fonce)" : "var(--gris)" }}>
                          {/* La note reste sous les yeux quand le tableau défile
                              vers la droite : elle explique le statut, figé à
                              gauche lui aussi. */}
                          <div style={{ position: "sticky", left: 60, width: "max-content", maxWidth: "min(900px, 70vw)", whiteSpace: "normal" }}>
                            {notes.join(" ")}
                            {suggestions.map(sg => (
                              <div key={sg.brut} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: notes.length ? 4 : 0, color: "var(--gris)" }}>
                                <span>« {sg.brut} » :</span>
                                {sg.liste.map(x => (
                                  <button key={x.nom} type="button" tabIndex={-1}
                                    onClick={() => propager(sg.brut, x.nom)}
                                    title={x.origine === "connu" ? "Entreprise déjà en base sous ce nom complet" : "Nom proposé pour l'arbitrage"}
                                    style={{ fontFamily: "inherit", fontSize: 11.5, cursor: "pointer", borderRadius: 6, padding: "2px 8px",
                                      border: "1px solid var(--bordure-forte)", background: "var(--carte)", color: "var(--encre)" }}>
                                    {x.nom}
                                    <span style={{ color: "var(--gris)" }}>
                                      {x.origine === "connu" ? " · déjà en base" : x.confiance === "haute" ? " · proposition sûre" : " · proposition à vérifier"}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ))}
                            {completable && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
                                marginTop: notes.length || suggestions.length ? 4 : 0, color: "var(--gris)" }}>
                                <span style={{ color: cachee ? "var(--orange-fonce)" : "var(--gris)", fontWeight: cachee ? 600 : 400 }}>
                                  {cachee ? "Destination africaine cachée :" : "Autres destinations :"}
                                </span>
                                {v.en_base && v.en_base.destinations.length > 0 && (
                                  <span>en base {v.en_base.destinations.join(", ")}{(ajouts[l.rang] ?? []).length ? " ·" : ""}</span>
                                )}
                                {(ajouts[l.rang] ?? []).map(d => (
                                  <span key={`${d.pays_id ?? "r" + d.region_id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4,
                                    fontSize: 11.5, padding: "2px 4px 2px 8px", borderRadius: 6,
                                    background: estAfricaine(d) ? "var(--vert-voile)" : "var(--carte-douce)", color: "var(--encre)" }}>
                                    {d.libelle}
                                    <button type="button" tabIndex={-1} onClick={() => retirer(l.rang, d)} aria-label={`Retirer ${d.libelle}`}
                                      style={{ border: "none", background: "none", cursor: "pointer", color: "var(--gris)", fontSize: 12, padding: "0 4px", fontFamily: "inherit" }}>×</button>
                                  </span>
                                ))}
                                {senegal && !(ajouts[l.rang] ?? []).some(d => d.pays_id === senegal.id)
                                  && !(v.en_base?.destinations ?? []).includes(senegal.libelle)
                                  && normaliser(l.cases.destination ?? "") !== "senegal" && (
                                  <button type="button" tabIndex={-1} onClick={() => ajouter(l.rang, senegal)}
                                    style={{ fontFamily: "inherit", fontSize: 11.5, cursor: "pointer", borderRadius: 6, padding: "2px 8px",
                                      border: "1px solid rgb(var(--bleu-rgb) / 0.35)", background: "var(--carte)", color: "var(--bleu)", fontWeight: 600 }}>
                                    + Sénégal
                                  </button>
                                )}
                                {selecteur === l.rang ? (
                                  <ChoixDestination options={refDest} onChoisir={p => ajouter(l.rang, p)} onFermer={() => setSelecteur(null)} />
                                ) : (
                                  <button type="button" onClick={() => setSelecteur(l.rang)}
                                    style={{ fontFamily: "inherit", fontSize: 11.5, cursor: "pointer", borderRadius: 6, padding: "2px 8px",
                                      border: "1px solid var(--bordure-forte)", background: "var(--carte)", color: "var(--encre)" }}>
                                    + autre destination
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button onClick={abandonner} disabled={etat === "envoi"}
              style={{ ...btnSecondaire, padding: "8px 14px", borderColor: "var(--bordure-forte)", color: "var(--encre)" }}>
              Abandonner cette page
            </button>
            <button onClick={verser} disabled={etat === "envoi" || (aVerser.length === 0 && aCompleterDeja.length === 0) || aRevoir}
              title={aRevoir ? "Quitter la case modifiée pour refaire le verdict" : undefined}
              style={{ ...btnPrincipal(true), opacity: etat === "envoi" || (aVerser.length === 0 && aCompleterDeja.length === 0) || aRevoir ? 0.5 : 1 }}>
              {etat === "envoi" ? "Versement…"
                : aVerser.length > 0
                  ? `Verser ${aVerser.length} ligne${aVerser.length > 1 ? "s" : ""} — page ${deuxChiffres(page)}`
                    + (aCompleterDeja.length ? ` · compléter ${aCompleterDeja.length} ${unite(aCompleterDeja.length)}` : "")
                : aCompleterDeja.length > 0
                  ? `Compléter ${aCompleterDeja.length} ${unite(aCompleterDeja.length)} déjà relevé${base === "signaux" ? "" : "e"}${aCompleterDeja.length > 1 ? "s" : ""}`
                : "Rien à verser"}
            </button>
          </div>
        </>
      )}
    </Carte>
  );
}
