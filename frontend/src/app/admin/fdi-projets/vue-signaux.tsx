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
import { Avis, Carte, ChampRecherche, Compteur, LigneVide, btnSecondaire,
         IS, TD, TH } from "@/components/admin/UIAdmin";

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
function ChampNom({ brut, occupe, onValider, onFermer }: {
  brut: string; occupe: boolean;
  onValider: (nom: string) => void; onFermer: () => void;
}) {
  const [nom, setNom] = useState(brut.replace(/\s*(?:…|\.{2,})\s*$/, ""));
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
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Compteur n={retenues} mot="signal" couleur="var(--bleu)" />
        </span>
      }
    >
      {erreur && <div style={{ marginBottom: 14 }}><Avis ton="erreur">{erreur}</Avis></div>}

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
                      <ChampNom brut={s.entreprise_brut ?? s.entreprise ?? ""} occupe={occupe}
                        onValider={nom => nommer(s, nom)} onFermer={() => setNomme(null)} />
                    ) : s.statut_entreprise !== "resolu" ? (
                      // Un nom coupé se clique : c'est là qu'on le complète, sans
                      // quitter la ligne qui dit de quelle entreprise il s'agit.
                      <button onClick={() => setNomme(s.id)} disabled={occupe}
                        title="Compléter ce nom tronqué"
                        style={{ border: "none", background: "none", padding: 0,
                          cursor: "pointer", fontFamily: "inherit", fontSize: 12.5,
                          fontWeight: 600, textAlign: "left", color: "var(--orange)",
                          textDecoration: "underline", textUnderlineOffset: 3,
                          textDecorationStyle: "dotted" }}>
                        {s.entreprise ?? "—"}
                      </button>
                    ) : (
                      <div style={{ fontWeight: 600 }}>{s.entreprise ?? "—"}</div>
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
