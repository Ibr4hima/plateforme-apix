"use client";

// Investor signals — consultation du relevé et COMPLÉTION.
//
// CE QUE CET ÉCRAN FAIT ET QUE CELUI DES PROJETS NE FAIT PAS. Le tableau de fDi
// n'affiche qu'une destination, un secteur, une activité et une nature par
// signal, et cache les autres derrière un bouton — sans signaler de façon
// fiable qu'il en cache. Le relevé porte donc ce qui était visible, et c'est
// ici qu'on ajoute le reste.
//
// D'où le geste central de l'écran : sur chaque case multiple, un « + » qui
// ouvre la liste du référentiel. Ce geste sera répété des milliers de fois — la
// page 1 annonce dix lignes sur quinze à compléter — il doit donc tenir en deux
// clics, sans quitter la ligne ni ouvrir de fiche.
//
// CE QUE L'ÉCRAN NE LAISSE PAS FAIRE : retirer une valeur du relevé. Elle dit
// ce que la source affichait ; l'effacer ferait mentir le relevé. Seul ce qui a
// été ajouté à la main se retire.

import { Fragment, useCallback, useEffect, useState } from "react";
import { Check, FileText, Loader2, Plus, X } from "lucide-react";

import { API_BASE } from "@/lib/api";
import { authHeaders } from "@/lib/authHeaders";
import { Avis, Carte, ChampRecherche, Compteur, LigneVide, btnPrincipal,
         btnSecondaire, IS, TD, TH } from "@/components/admin/UIAdmin";

type Valeur = {
  id: number; rang: number; brut: string | null; libelle: string | null;
  origine: "import" | "saisie"; resolu: boolean;
  nature?: "pays" | "region" | null;
};
type Signal = {
  id: number; periode: string; lot: string;
  entreprise: string | null; entreprise_brut: string | null; parent: string | null;
  statut_entreprise: string;
  source: string | null; source_resolue: boolean;
  capex_musd: number | null; capex_estime: boolean | null;
  funding_musd: number | null; funding_estime: boolean | null;
  destinations: Valeur[]; secteurs: Valeur[]; activites: Valeur[]; natures: Valeur[];
  vise_afrique: boolean;
  description_en: string | null; description_fr: string | null;
};
/** Un poste du référentiel. « libelle » est le français — celui qu'on lira
    partout ensuite — et « libelle_en » l'anglais, celui qu'on cherche pendant
    la complétion parce que c'est l'écran de fDi qu'on a sous les yeux. */
type Poste = { id: number; libelle: string; libelle_en?: string;
               nature?: "pays" | "region" };
type Referentiels = { destinations: Poste[]; secteurs: Poste[];
                      activites: Poste[]; natures: Poste[] };

const PAR_PAGE = 15;

/** Les quatre familles, dans l'ordre des colonnes de fDi. Le nom de famille est
    celui que l'API attend : une famille de plus se déclare ici et là-bas. */
const FAMILLES = [
  { cle: "destination" as const, champ: "destinations" as const, titre: "Destinations", ref: "destinations" as const },
  { cle: "secteur"     as const, champ: "secteurs"     as const, titre: "Secteurs",     ref: "secteurs" as const },
  { cle: "activite"    as const, champ: "activites"    as const, titre: "Activités",    ref: "activites" as const },
  { cle: "nature"      as const, champ: "natures"      as const, titre: "Nature",       ref: "natures" as const },
];

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** Un montant, avec la marque d'estimation. « ≈ » dit sans bruit qu'il vient de
    l'algorithme du Financial Times et non d'une déclaration. */
const Montant = ({ v, estime }: { v: number | null; estime: boolean | null }) =>
  v == null ? <span style={{ color: "var(--gris)" }}>—</span> : (
    <span title={estime ? "Valeur estimée par l'algorithme du Financial Times" : "Valeur déclarée"}
      style={{ fontVariantNumeric: "tabular-nums" }}>
      {estime ? "≈ " : ""}{nf.format(v)} <span style={{ fontSize: 10, color: "var(--gris)" }}>M$</span>
    </span>
  );

/** Une valeur d'une case multiple.

    Celles du relevé et celles ajoutées à la main ne se ressemblent pas, et
    c'est voulu : on doit voir d'un coup d'œil ce que la source disait et ce
    qu'on a complété soi-même. Seules les secondes portent une croix. */
function Puce({ v, onRetirer }: { v: Valeur; onRetirer?: () => void }) {
  const saisie = v.origine === "saisie";
  return (
    <span title={saisie ? "Ajoutée à la main" : `Relevé : « ${v.brut ?? ""} »`}
      style={{ display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 11, lineHeight: 1.4, whiteSpace: "nowrap",
        padding: "2px 7px", borderRadius: 7, marginRight: 4, marginBottom: 3,
        color: v.resolu ? "var(--encre)" : "var(--orange)",
        background: saisie ? "rgb(var(--bleu-rgb) / 0.08)" : "var(--carte-douce)",
        border: `1px solid ${saisie ? "rgb(var(--bleu-rgb) / 0.30)" : "var(--filet)"}` }}>
      {v.libelle ?? v.brut ?? "—"}
      {v.nature === "region" && (
        <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em",
          textTransform: "uppercase", color: "var(--gris)" }}>région</span>
      )}
      {onRetirer && (
        <button onClick={onRetirer} aria-label="Retirer cette valeur"
          style={{ border: "none", background: "none", padding: 0, cursor: "pointer",
            display: "inline-flex", color: "var(--gris)" }}>
          <X size={10} />
        </button>
      )}
    </span>
  );
}

/** Une case multiple : ses valeurs, et de quoi en ajouter PLUSIEURS.

    DEUX CHOIX QUI DÉCIDENT DE LA TENABILITÉ DE L'OUTIL, sur des milliers de
    lignes à compléter :

    · ON PROPOSE EN ANGLAIS. C'est l'écran de fDi qu'on a sous les yeux en
      complétant ; chercher « Middle East » dans une liste française obligerait
      à traduire de tête à chaque ligne. Une fois choisie, la valeur se lit en
      français partout ailleurs — la correspondance est en base.

    · ON EN COCHE PLUSIEURS D'UN COUP. Compléter un signal, c'est presque
      toujours ajouter quatre destinations ou deux secteurs. Rouvrir la liste
      entre chaque aurait fait de la complétion une corvée.

    La liste s'ouvre SOUS la case, jamais dans une fenêtre : il faut relire la
    ligne pour savoir quoi ajouter. */
function Case({ valeurs, options, onAjouter, onRetirer, occupe }: {
  valeurs: Valeur[]; options: Poste[]; occupe: boolean;
  onAjouter: (choix: Poste[]) => void; onRetirer: (v: Valeur) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [cherche, setCherche] = useState("");
  const [coches, setCoches] = useState<Poste[]>([]);

  const dejaLa = new Set(valeurs.map(v => `${v.nature ?? ""}|${v.libelle}`));
  const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const q = norm(cherche.trim());
  // La recherche porte sur les DEUX langues : on tape ce qu'on lit chez fDi,
  // mais on doit aussi pouvoir retrouver un poste dont on ne sait que le
  // français.
  const visibles = !q ? options : options.filter(o =>
    norm(o.libelle_en ?? "").includes(q) || norm(o.libelle).includes(q));

  const fermer = () => { setOuvert(false); setCherche(""); setCoches([]); };

  return (
    <div>
      {valeurs.map(v => (
        <Puce key={v.id} v={v}
          onRetirer={v.origine === "saisie" ? () => onRetirer(v) : undefined} />
      ))}
      {!ouvert ? (
        <button onClick={() => setOuvert(true)} disabled={occupe}
          title="Ajouter des valeurs que le tableau de fDi ne montrait pas"
          style={{ ...btnSecondaire, padding: "1px 6px", fontSize: 11, lineHeight: 1.4,
            gap: 3, opacity: occupe ? 0.4 : 1 }}>
          <Plus size={10} />
        </button>
      ) : (
        <div style={{ marginTop: 4, border: "1px solid var(--bordure-forte)",
          borderRadius: 9, background: "var(--carte)", width: 240 }}>
          <input value={cherche} onChange={e => setCherche(e.target.value)} autoFocus
            placeholder="Rechercher…"
            style={{ ...IS, border: "none", borderBottom: "1px solid var(--filet)",
              borderRadius: 0, padding: "6px 9px", fontSize: 11.5 }} />
          <div style={{ maxHeight: 190, overflowY: "auto" }}>
            {visibles.length === 0 && (
              <p style={{ fontSize: 11, color: "var(--gris)", textAlign: "center",
                padding: "10px 0", margin: 0 }}>Aucun résultat</p>
            )}
            {visibles.map(o => {
              const clef = `${o.nature ?? ""}|${o.libelle}`;
              const porte = dejaLa.has(clef);
              const coche = coches.some(x => x.id === o.id && x.nature === o.nature);
              return (
                <button key={`${o.nature ?? ""}-${o.id}`} disabled={porte}
                  onClick={() => setCoches(l => coche
                    ? l.filter(x => !(x.id === o.id && x.nature === o.nature))
                    : [...l, o])}
                  style={{ display: "flex", alignItems: "center", gap: 7, width: "100%",
                    padding: "4px 9px", border: "none", cursor: porte ? "default" : "pointer",
                    background: coche ? "rgb(var(--bleu-rgb) / 0.08)" : "transparent",
                    textAlign: "left", fontFamily: "inherit", fontSize: 11.5,
                    color: porte ? "var(--gris)" : "var(--encre)", opacity: porte ? 0.5 : 1 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, flexShrink: 0,
                    border: `1.5px solid ${coche ? "var(--bleu)" : "var(--bordure-forte)"}`,
                    background: coche ? "var(--bleu)" : "transparent" }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap" }}>{o.libelle_en ?? o.libelle}</span>
                  {o.nature === "region" && (
                    <span style={{ marginLeft: "auto", fontSize: 8.5, fontWeight: 800,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                      color: "var(--gris)" }}>région</span>
                  )}
                  {porte && <span style={{ marginLeft: "auto", fontSize: 9,
                    color: "var(--gris)" }}>déjà là</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 5, padding: "6px 8px",
            borderTop: "1px solid var(--filet)" }}>
            <button disabled={coches.length === 0}
              onClick={() => { onAjouter(coches); fermer(); }}
              style={{ ...btnSecondaire, padding: "3px 9px", fontSize: 11, gap: 4,
                opacity: coches.length === 0 ? 0.4 : 1 }}>
              <Check size={11} /> Ajouter{coches.length > 0 ? ` (${coches.length})` : ""}
            </button>
            <button onClick={fermer}
              style={{ ...btnSecondaire, padding: "3px 9px", fontSize: 11, gap: 4 }}>
              <X size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Les deux descriptions d'un signal.

    POURQUOI DEUX LANGUES. L'anglais est celui de la source, le français celui
    de la restitution : garder les deux permet de retrouver la phrase d'origine
    le jour où la traduction fait douter.

    L'éditeur s'ouvre SOUS la ligne, sur toute la largeur : une description est
    une phrase, pas une case de tableau, et l'écrire dans une colonne étroite
    obligerait à la relire dans un couloir. */
function EditeurDescription({ signal, occupe, onEnregistrer, onFermer }: {
  signal: Signal; occupe: boolean;
  onEnregistrer: (en: string, fr: string) => void; onFermer: () => void;
}) {
  const [en, setEn] = useState(signal.description_en ?? "");
  const [fr, setFr] = useState(signal.description_fr ?? "");
  const zone = { ...IS, minHeight: 74, resize: "vertical" as const, lineHeight: 1.55 };
  return (
    <div style={{ padding: "12px 14px", background: "var(--carte-douce)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "block" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--gris)",
            letterSpacing: "0.1em", textTransform: "uppercase" }}>Description (anglais)</span>
          <textarea value={en} onChange={e => setEn(e.target.value)}
            style={{ ...zone, marginTop: 5 }} />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--gris)",
            letterSpacing: "0.1em", textTransform: "uppercase" }}>Description (français)</span>
          <textarea value={fr} onChange={e => setFr(e.target.value)}
            style={{ ...zone, marginTop: 5 }} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
        <button disabled={occupe} onClick={() => onEnregistrer(en, fr)}
          style={{ ...btnSecondaire, padding: "5px 12px", fontSize: 12, gap: 6,
            opacity: occupe ? 0.5 : 1 }}>
          <Check size={12} /> Enregistrer
        </button>
        <button onClick={onFermer}
          style={{ ...btnSecondaire, padding: "5px 12px", fontSize: 12 }}>Annuler</button>
      </div>
    </div>
  );
}

/** Le nom complet d'une entreprise que la source a coupée.

    UN GESTE, PAS UNE FICHE. On clique sur le nom tronqué, on complète, Entrée.
    Le champ est PRÉREMPLI du texte de la source sans ses points de suspension :
    « PT Telekomunika… » devient « PT Telekomunika », et il ne reste qu'à finir
    le mot. Sur des milliers de noms coupés, c'est ce qui sépare un outil d'une
    corvée.

    LA DÉCISION NE VAUT QUE POUR CETTE LIGNE. On a le signal sous les yeux — sa
    date, son pays, son secteur — et c'est ce contexte qui dit de quelle
    entreprise il s'agit. L'étendre aux autres lignes portant le même texte
    coupé, sans les avoir regardées, est l'erreur qui a fait confondre
    « Standard Chartered Bank » et « Standard Chartered Kenya Bank » côté
    projets. */
function ChampNom({ depart, occupe, onValider, onFermer }: {
  depart: string; occupe: boolean;
  onValider: (nom: string) => void; onFermer: () => void;
}) {
  const [nom, setNom] = useState(depart);
  return (
    <input value={nom} autoFocus disabled={occupe}
      onChange={e => setNom(e.target.value)}
      onKeyDown={e => {
        if (e.key === "Enter" && nom.trim()) onValider(nom.trim());
        if (e.key === "Escape") onFermer();
      }}
      onBlur={onFermer}
      placeholder="Nom complet, puis Entrée"
      style={{ ...IS, padding: "4px 8px", fontSize: 12, minWidth: 210 }} />
  );
}


/** Les champs d'une saisie, dans l'ordre des colonnes de fDi. Le nom de chaque
    clé est celui que l'API attend, et l'étiquette celle que la source affiche :
    on remplit ce formulaire en LISANT l'écran de fDi, pas en traduisant. */
const CHAMPS = [
  { cle: "date",        titre: "Date",           exemple: "Sep 2026",              large: false },
  { cle: "parent",      titre: "Parent company", exemple: "Zeal Rewards",          large: true },
  { cle: "entreprise",  titre: "Company",        exemple: "Zeal Rewards",          large: true },
  { cle: "source",      titre: "Source",         exemple: "United Kingdom",        large: true, liste: "destinations" },
  { cle: "destination", titre: "Destination",    exemple: "Middle East",           large: true, liste: "destinations" },
  { cle: "secteur",     titre: "Sector",         exemple: "Software & IT services", large: true, liste: "secteurs" },
  { cle: "activite",    titre: "Activity",       exemple: "n/a",                   large: true, liste: "activites" },
  { cle: "signal",      titre: "Signal",         exemple: "New Funding/Resources", large: true, liste: "natures" },
  { cle: "funding",     titre: "Funding",        exemple: "$10.00m",               large: false },
  { cle: "capex",       titre: "Capex",          exemple: "-",                     large: false },
] as const;

type Saisie = Record<(typeof CHAMPS)[number]["cle"], string>;
const SAISIE_VIDE = Object.fromEntries(CHAMPS.map(c => [c.cle, ""])) as Saisie;

/** Saisir un signal que fDi vient de publier, sans passer par un import.

    POURQUOI CE FORMULAIRE RESSEMBLE AU TABLEAU DE LA SOURCE et non à une fiche
    de la plateforme : on le remplit en recopiant l'écran de fDi, colonne par
    colonne, dans l'ordre où elles s'y présentent. Les étiquettes sont donc
    celles de fDi, en anglais. Toute autre disposition obligerait à chercher où
    va quoi, quinze fois de suite.

    ON RECOPIE VERBATIM, TRONCATURES COMPRISES. C'est le préfixe qui retrouve
    l'entrée de nomenclature ; « compléter » un libellé coupé de son propre chef
    le rendrait introuvable. Les listes proposées donnent les libellés ANGLAIS
    du référentiel, qui sont ceux de la source — les choisir évite la faute de
    frappe sans rien inventer.

    UNE CASE VIDE ET UN TIRET NE DISENT PAS LA MÊME CHOSE. La source écrit « - »
    quand elle n'a pas de valeur et « n/a » quand la colonne ne s'applique pas ;
    les deux se recopient tels quels. */
function FormulaireSignal({ ref, occupe, onEnregistrer, onFermer }: {
  ref: Referentiels | null; occupe: boolean;
  onEnregistrer: (s: Saisie) => void; onFermer: () => void;
}) {
  const [s, setS] = useState<Saisie>(SAISIE_VIDE);
  const pret = s.date.trim() !== "" && s.entreprise.trim() !== "";

  return (
    <div style={{ border: "1px solid rgb(var(--bleu-rgb) / 0.25)", borderRadius: 14,
      background: "rgb(var(--bleu-rgb) / 0.03)", padding: "16px 18px", marginBottom: 14 }}>

      {/* Les listes de suggestions, une par famille. Elles ne contraignent
          rien : un libellé que le référentiel ignore encore reste saisissable,
          et l'écran le signalera comme non rattaché plutôt que de le refuser. */}
      {(["destinations", "secteurs", "activites", "natures"] as const).map(f => (
        <datalist key={f} id={`liste-${f}`}>
          {(ref?.[f] ?? []).map(p => (
            <option key={`${f}-${p.id}`} value={p.libelle_en || p.libelle}>{p.libelle}</option>
          ))}
        </datalist>
      ))}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--encre)" }}>
          Nouveau signal — recopier la ligne de fDi, colonne par colonne
        </span>
        <button onClick={onFermer} style={{ ...btnSecondaire, padding: "5px 9px" }}>
          <X size={13} />
        </button>
      </div>

      <div style={{ display: "grid", gap: 10,
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {CHAMPS.map(c => (
          <label key={c.cle} style={{ display: "block", minWidth: 0,
            gridColumn: c.large ? undefined : "span 1" }}>
            <span style={{ display: "block", fontSize: 9.5, fontWeight: 800,
              letterSpacing: "0.11em", textTransform: "uppercase", color: "var(--gris)",
              marginBottom: 4 }}>
              {c.titre}
              {(c.cle === "date" || c.cle === "entreprise") && (
                <span style={{ color: "var(--danger)" }}> *</span>
              )}
            </span>
            <input name={c.cle} value={s[c.cle]} disabled={occupe}
              list={"liste" in c && c.liste ? `liste-${c.liste}` : undefined}
              onChange={e => setS(v => ({ ...v, [c.cle]: e.target.value }))}
              onKeyDown={e => {
                if (e.key === "Enter" && pret && !occupe) onEnregistrer(s);
                if (e.key === "Escape") onFermer();
              }}
              placeholder={c.exemple} style={IS} />
          </label>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
        <button onClick={() => onEnregistrer(s)} disabled={!pret || occupe}
          style={btnPrincipal(pret && !occupe)}>
          {occupe ? "Enregistrement…" : "Enregistrer le signal"}
        </button>
        <span style={{ fontSize: 11.5, color: "var(--gris)" }}>
          Recopier tel quel, troncatures comprises — c&apos;est le début du libellé
          qui retrouve la nomenclature.
        </span>
      </div>
    </div>
  );
}


export default function VueSignaux() {
  const [signaux, setSignaux] = useState<Signal[]>([]);
  const [ref, setRef] = useState<Referentiels | null>(null);
  const [totaux, setTotaux] = useState(
    { total: 0, a_completer: 0, a_arbitrer: 0, sans_description: 0 });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [retenues, setRetenues] = useState(0);
  const [recherche, setRecherche] = useState("");
  const [envoyee, setEnvoyee] = useState("");
  const [aCompleter, setACompleter] = useState(false);
  const [aArbitrer, setAArbitrer] = useState(false);
  const [sansDesc, setSansDesc] = useState(false);
  // Le signal dont on écrit la description. Une seule fiche ouverte à la fois :
  // deux éditeurs ouverts inviteraient à en abandonner un sans l'enregistrer.
  const [decrit, setDecrit] = useState<number | null>(null);
  // Le signal dont on complète le nom d'entreprise.
  const [nomme, setNomme] = useState<number | null>(null);
  // Le panneau de saisie d'un signal nouveau, et ce que la dernière saisie a
  // laissé sans rattachement — à dire, sinon la ligne entre avec des cases
  // vides que personne ne saura devoir reprendre.
  const [ajout, setAjout] = useState(false);
  const [apresSaisie, setApresSaisie] = useState<string[] | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  // Sans délai, taper « Oracle » lancerait six requêtes dont cinq pour rien.
  useEffect(() => {
    const t = setTimeout(() => setEnvoyee(recherche.trim()), 250);
    return () => clearTimeout(t);
  }, [recherche]);
  const [vue, setVue] = useState("");
  const clef = `${envoyee}|${aCompleter}|${aArbitrer}|${sansDesc}`;
  if (clef !== vue) { setVue(clef); setPage(1); }

  const charger = useCallback(async () => {
    const u = new URL(`${API_BASE}/fdi/signaux-investisseurs`, window.location.origin);
    u.searchParams.set("page", String(page));
    u.searchParams.set("par_page", String(PAR_PAGE));
    if (envoyee) u.searchParams.set("q", envoyee);
    if (aCompleter) u.searchParams.set("a_completer", "true");
    if (aArbitrer) u.searchParams.set("a_arbitrer", "true");
    if (sansDesc) u.searchParams.set("sans_description", "true");
    const r = await fetch(u.toString());
    if (!r.ok) throw new Error();
    const d = await r.json();
    setSignaux(d.signaux); setTotaux(d.totaux);
    setPages(d.pages); setRetenues(d.retenues);
  }, [page, envoyee, aCompleter, aArbitrer, sansDesc]);

  useEffect(() => {
    let vivant = true;
    charger().catch(() => { if (vivant) setErreur("Signaux indisponibles. Vérifier que la migration 147 est appliquée et qu'un lot a été importé."); })
      .finally(() => { if (vivant) setChargement(false); });
    return () => { vivant = false; };
  }, [charger]);

  useEffect(() => {
    fetch(`${API_BASE}/fdi/signaux-investisseurs/referentiels`)
      .then(r => (r.ok ? r.json() : null)).then(d => { if (d) setRef(d); }).catch(() => {});
  }, []);

  const agir = async (faire: () => Promise<Response>) => {
    setOccupe(true); setErreur(null);
    try {
      const r = await faire();
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || "Enregistrement impossible.");
      }
      // La page est rappelée : un ajout change le compteur de complétion et
      // peut faire sortir la ligne du filtre en cours. Quinze lignes, c'est
      // sans coût, et l'écran reste vrai.
      await charger();
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally { setOccupe(false); }
  };

  const ajouter = (s: Signal, famille: string, postes: Poste[]) => agir(async () =>
    fetch(`${API_BASE}/fdi/signaux-investisseurs/${s.id}/valeurs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        famille,
        valeurs: postes.map(p => famille === "destination"
          ? (p.nature === "region" ? { region_id: p.id } : { pays_id: p.id })
          : { poste_id: p.id }),
      }),
    }));

  const enregistrerDescription = (s: Signal, en: string, fr: string) => agir(async () => {
    const r = await fetch(`${API_BASE}/fdi/signaux-investisseurs/${s.id}/description`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ description_en: en, description_fr: fr }),
    });
    if (r.ok) setDecrit(null);
    return r;
  });

  const nommer = (s: Signal, nom: string) => agir(async () => {
    const r = await fetch(`${API_BASE}/fdi/signaux-investisseurs/${s.id}/entreprise`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ nom }),
    });
    if (r.ok) setNomme(null);
    return r;
  });

  const creer = (saisie: Saisie) => agir(async () => {
    const r = await fetch(`${API_BASE}/fdi/signaux-investisseurs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(saisie),
    });
    if (r.ok) {
      // Le panneau se referme, et ce qui n'a pas pu être rattaché s'affiche :
      // un secteur mal recopié entre quand même, mais il faudra y revenir.
      const d = await r.clone().json().catch(() => ({ manques: [] }));
      setAjout(false);
      setApresSaisie(d.manques ?? []);
      // La saisie va en tête de liste : on la retrouve sans la chercher.
      setPage(1); setRecherche("");
    }
    return r;
  });

  const retirer = (s: Signal, famille: string, v: Valeur) => agir(async () =>
    fetch(`${API_BASE}/fdi/signaux-investisseurs/${s.id}/valeurs/${famille}/${v.id}`, {
      method: "DELETE", headers: await authHeaders(),
    }));

  if (chargement) {
    return (
      <Carte titre="Investor signals">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, padding: "34px 0", color: "var(--gris)" }}>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13 }}>Chargement…</span>
        </div>
      </Carte>
    );
  }

  return (
    <Carte
      titre="Investor signals"
      extra={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <Compteur n={retenues} mot="signal" couleur="var(--bleu)" />
          {/* fDi publie quelques signaux par semaine. Les faire entrer par un
              réimport — réexporter, découper, redéployer — pour trois lignes
              n'avait pas de sens ; on les saisit ici. */}
          <button onClick={() => { setAjout(v => !v); setApresSaisie(null); }}
            style={{ ...btnSecondaire, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={13} /> Ajouter un signal
          </button>
        </span>
      }
    >
      {erreur && <div style={{ marginBottom: 14 }}><Avis ton="erreur">{erreur}</Avis></div>}

      {apresSaisie && (
        <div style={{ marginBottom: 14 }}>
          <Avis ton={apresSaisie.length ? "info" : "ok"}>
            {apresSaisie.length
              ? `Signal enregistré, mais ${apresSaisie.length} valeur(s) n'ont pas été
                 rattachées : ${apresSaisie.join(" · ")}. La ligne est en base ; il reste
                 à corriger la graphie ou à compléter depuis le tableau.`
              : "Signal enregistré, toutes ses valeurs rattachées."}
          </Avis>
        </div>
      )}

      {ajout && (
        <FormulaireSignal ref={ref} occupe={occupe} onEnregistrer={creer}
          onFermer={() => setAjout(false)} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <ChampRecherche value={recherche} onChange={setRecherche}
            placeholder="Rechercher une entreprise ou une maison mère…" />
        </div>
        <Filtre actif={aCompleter} onBascule={() => setACompleter(v => !v)}
          couleur="var(--orange)" n={totaux.a_completer}>sans destination africaine</Filtre>
        <Filtre actif={aArbitrer} onBascule={() => setAArbitrer(v => !v)}
          couleur="var(--violet)" n={totaux.a_arbitrer}>entreprise à arbitrer</Filtre>
        <Filtre actif={sansDesc} onBascule={() => setSansDesc(v => !v)}
          couleur="var(--gris-fort)" n={totaux.sans_description}>sans description</Filtre>
      </div>

      <Navigation courante={page} pages={pages} onPage={setPage} />

      <div style={{ border: "1px solid rgb(var(--encre-rgb) / 0.10)", borderRadius: 14,
        overflow: "hidden", marginTop: 12 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={TH}>Période</th>
                <th style={TH}>Entreprise</th>
                <th style={TH}>Origine</th>
                {FAMILLES.map(f => <th key={f.cle} style={TH}>{f.titre}</th>)}
                <th style={{ ...TH, textAlign: "right" }}>Fonds levés</th>
                <th style={{ ...TH, textAlign: "right" }}>Capex</th>
                <th style={{ ...TH, width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {signaux.length === 0 && (
                <LigneVide colSpan={10} texte={
                  envoyee || aCompleter || aArbitrer || sansDesc
                    ? "Aucun signal ne correspond à ce filtre."
                    : "Aucun signal importé."} />
              )}
              {signaux.map(s => (
                <Fragment key={s.id}>
                <tr style={{ background: s.vise_afrique ? undefined
                  : "rgb(var(--orange-rgb) / 0.03)" }}>
                  <td style={{ ...TD, whiteSpace: "nowrap" }}>{s.periode}</td>
                  <td style={TD}>
                    {nomme === s.id ? (
                      // Le texte de départ n'est pas le même selon le cas. Un nom
                      // COUPÉ part du relevé sans ses points de suspension — il ne
                      // reste qu'à finir le mot. Un nom DÉJÀ TRANCHÉ part de sa
                      // valeur actuelle, puisqu'on vient le corriger, pas le
                      // ressaisir.
                      <ChampNom occupe={occupe}
                        depart={s.statut_entreprise === "resolu"
                          ? (s.entreprise ?? "")
                          : (s.entreprise_brut ?? s.entreprise ?? "")
                              .replace(/\s*(?:…|\.{2,})\s*$/, "")}
                        onValider={nom => nommer(s, nom)} onFermer={() => setNomme(null)} />
                    ) : (
                      // TOUJOURS MODIFIABLE, y compris une fois tranché : on se
                      // trompe, et une décision qu'on ne peut plus reprendre est
                      // une décision qu'on hésite à prendre. Un nom coupé s'annonce
                      // en orange — il reste à faire ; un nom tranché se lit
                      // normalement et ne se souligne qu'au survol.
                      <button onClick={() => setNomme(s.id)} disabled={occupe}
                        title={s.statut_entreprise === "resolu"
                          ? "Modifier ce nom" : "Compléter ce nom tronqué"}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.textDecoration =
                            s.statut_entreprise === "resolu" ? "none" : "underline"; }}
                        style={{ border: "none", background: "none", padding: 0,
                          cursor: "pointer", fontFamily: "inherit", fontSize: 12.5,
                          fontWeight: 600, textAlign: "left",
                          color: s.statut_entreprise === "resolu"
                            ? "var(--encre)" : "var(--orange)",
                          textDecoration: s.statut_entreprise === "resolu" ? "none" : "underline",
                          textUnderlineOffset: 3, textDecorationStyle: "dotted" }}>
                        {s.entreprise ?? "—"}
                      </button>
                    )}
                    {s.parent && s.parent !== s.entreprise && (
                      <div style={{ fontSize: 11, color: "var(--gris)" }}>{s.parent}</div>
                    )}
                  </td>
                  <td style={{ ...TD, whiteSpace: "nowrap",
                    color: s.source_resolue ? undefined : "var(--orange)" }}>{s.source ?? "—"}</td>
                  {FAMILLES.map(f => (
                    <td key={f.cle} style={{ ...TD, minWidth: 170 }}>
                      <Case valeurs={s[f.champ]} options={ref?.[f.ref] ?? []} occupe={occupe}
                        onAjouter={ps => ajouter(s, f.cle, ps)}
                        onRetirer={v => retirer(s, f.cle, v)} />
                    </td>
                  ))}
                  <td style={{ ...TD, textAlign: "right" }}>
                    <Montant v={s.funding_musd} estime={s.funding_estime} />
                  </td>
                  <td style={{ ...TD, textAlign: "right" }}>
                    <Montant v={s.capex_musd} estime={s.capex_estime} />
                  </td>
                  <td style={{ ...TD, textAlign: "right", whiteSpace: "nowrap" }}>
                    {/* Le bouton dit d'un coup d'œil si la ligne est décrite :
                        sur quatre mille cinq cents signaux, c'est ce qui permet
                        de repérer le travail restant sans ouvrir chaque fiche. */}
                    <button onClick={() => setDecrit(v => v === s.id ? null : s.id)}
                      title={s.description_fr ? "Modifier la description" : "Décrire ce signal"}
                      style={{ ...btnSecondaire, padding: "4px 9px", fontSize: 11, gap: 5,
                        color: s.description_fr ? undefined : "var(--gris)" }}>
                      <FileText size={12} />
                      {s.description_fr ? "Décrit" : "Décrire"}
                    </button>
                  </td>
                </tr>
                {decrit === s.id && (
                  <tr>
                    <td colSpan={10} style={{ padding: 0, borderTop: "1px solid var(--bordure)" }}>
                      <EditeurDescription signal={s} occupe={occupe}
                        onEnregistrer={(en, fr) => enregistrerDescription(s, en, fr)}
                        onFermer={() => setDecrit(null)} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Navigation courante={page} pages={pages} onPage={setPage} marge={14} />
    </Carte>
  );
}

/** Un filtre qui porte son propre compte : il dit ce qu'il montrera avant
    qu'on l'active, et sert donc aussi de tableau de bord du reste à faire. */
function Filtre({ actif, onBascule, couleur, n, children }: {
  actif: boolean; onBascule: () => void; couleur: string; n: number;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onBascule} aria-pressed={actif}
      style={{ ...btnSecondaire, padding: "6px 12px", fontSize: 12, gap: 7,
        borderColor: actif ? couleur : undefined,
        color: actif ? couleur : undefined, fontWeight: actif ? 700 : undefined }}>
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: couleur }}>
        {n.toLocaleString("fr-FR")}
      </span>
      {children}
    </button>
  );
}

/** La navigation entre pages. Sur trois cents pages, la case de saut est
    l'outil principal : atteindre la 200 de proche en proche n'est pas une
    navigation, c'est un renoncement. */
function Navigation({ courante, pages, onPage, marge = 0 }: {
  courante: number; pages: number; onPage: (n: number) => void; marge?: number;
}) {
  const [saut, setSaut] = useState("");
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 10, flexWrap: "wrap", marginTop: marge }}>
      <span style={{ fontSize: 12, color: "var(--gris)" }}>
        Page {courante} sur {pages}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button disabled={courante <= 1} onClick={() => onPage(courante - 1)}
          style={{ ...btnSecondaire, padding: "5px 11px", fontSize: 12,
            opacity: courante <= 1 ? 0.4 : 1 }}>Précédente</button>
        <button disabled={courante >= pages} onClick={() => onPage(courante + 1)}
          style={{ ...btnSecondaire, padding: "5px 11px", fontSize: 12,
            opacity: courante >= pages ? 0.4 : 1 }}>Suivante</button>
        <form onSubmit={e => {
            e.preventDefault();
            const n = Number(saut);
            if (n >= 1 && n <= pages) { onPage(n); setSaut(""); }
          }}
          style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 6 }}>
          <input value={saut} onChange={e => setSaut(e.target.value.replace(/\D/g, ""))}
            placeholder="Aller à…" inputMode="numeric"
            style={{ ...IS, width: 88, padding: "5px 9px", fontSize: 12 }} />
        </form>
      </div>
    </div>
  );
}
