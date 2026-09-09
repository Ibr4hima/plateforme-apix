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

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";

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
};
type Poste = { id: number; libelle: string; nature?: "pays" | "region" };
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

/** Une case multiple : ses valeurs, et de quoi en ajouter une.

    La liste du référentiel s'ouvre SOUS la case, pas dans une fenêtre : on
    complète en restant sur la ligne qu'on lit, parce qu'il faut la relire pour
    savoir quoi ajouter. */
function Case({ valeurs, options, onAjouter, onRetirer, occupe }: {
  valeurs: Valeur[]; options: Poste[]; occupe: boolean;
  onAjouter: (choix: Poste) => void; onRetirer: (v: Valeur) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [choix, setChoix] = useState("");
  const dejaLa = new Set(valeurs.map(v => `${v.nature ?? ""}${v.libelle}`));

  return (
    <div>
      {valeurs.map(v => (
        <Puce key={v.id} v={v}
          onRetirer={v.origine === "saisie" ? () => onRetirer(v) : undefined} />
      ))}
      {!ouvert ? (
        <button onClick={() => setOuvert(true)} disabled={occupe}
          title="Ajouter une valeur que le tableau de fDi ne montrait pas"
          style={{ ...btnSecondaire, padding: "1px 6px", fontSize: 11, lineHeight: 1.4,
            gap: 3, opacity: occupe ? 0.4 : 1 }}>
          <Plus size={10} />
        </button>
      ) : (
        <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
          <select value={choix} onChange={e => setChoix(e.target.value)} autoFocus
            style={{ ...IS, padding: "4px 6px", fontSize: 11, minWidth: 150 }}>
            <option value="">Choisir…</option>
            {/* Les régions du monde d'abord : elles sont sept, les pays deux
                cents, et c'est la région qu'on cherche le plus souvent ici. */}
            {["region", "pays", undefined].map(nat => {
              const groupe = options.filter(o => o.nature === nat);
              if (!groupe.length) return null;
              const etiquette = nat === "region" ? "Régions du monde"
                              : nat === "pays" ? "Pays" : null;
              const items = groupe.map(o => (
                <option key={`${nat}-${o.id}`} value={`${o.nature ?? ""}|${o.id}`}
                  disabled={dejaLa.has(`${o.nature ?? ""}${o.libelle}`)}>{o.libelle}</option>
              ));
              return etiquette
                ? <optgroup key={String(nat)} label={etiquette}>{items}</optgroup>
                : <optgroup key="autres" label="">{items}</optgroup>;
            })}
          </select>
          <button disabled={!choix} onClick={() => {
              const [nature, id] = choix.split("|");
              const poste = options.find(o => o.id === Number(id) && (o.nature ?? "") === nature);
              if (poste) onAjouter(poste);
              setChoix(""); setOuvert(false);
            }}
            style={{ ...btnSecondaire, padding: "3px 7px", fontSize: 11, gap: 3 }}>
            <Check size={11} />
          </button>
          <button onClick={() => { setChoix(""); setOuvert(false); }}
            style={{ ...btnSecondaire, padding: "3px 7px", fontSize: 11, gap: 3 }}>
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function VueSignaux() {
  const [signaux, setSignaux] = useState<Signal[]>([]);
  const [ref, setRef] = useState<Referentiels | null>(null);
  const [totaux, setTotaux] = useState({ total: 0, a_completer: 0, a_arbitrer: 0 });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [retenues, setRetenues] = useState(0);
  const [recherche, setRecherche] = useState("");
  const [envoyee, setEnvoyee] = useState("");
  const [aCompleter, setACompleter] = useState(false);
  const [aArbitrer, setAArbitrer] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  // Sans délai, taper « Oracle » lancerait six requêtes dont cinq pour rien.
  useEffect(() => {
    const t = setTimeout(() => setEnvoyee(recherche.trim()), 250);
    return () => clearTimeout(t);
  }, [recherche]);
  const [vue, setVue] = useState("");
  const clef = `${envoyee}|${aCompleter}|${aArbitrer}`;
  if (clef !== vue) { setVue(clef); setPage(1); }

  const charger = useCallback(async () => {
    const u = new URL(`${API_BASE}/fdi/signaux-investisseurs`, window.location.origin);
    u.searchParams.set("page", String(page));
    u.searchParams.set("par_page", String(PAR_PAGE));
    if (envoyee) u.searchParams.set("q", envoyee);
    if (aCompleter) u.searchParams.set("a_completer", "true");
    if (aArbitrer) u.searchParams.set("a_arbitrer", "true");
    const r = await fetch(u.toString());
    if (!r.ok) throw new Error();
    const d = await r.json();
    setSignaux(d.signaux); setTotaux(d.totaux);
    setPages(d.pages); setRetenues(d.retenues);
  }, [page, envoyee, aCompleter, aArbitrer]);

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

  const ajouter = (s: Signal, famille: string, poste: Poste) => agir(async () =>
    fetch(`${API_BASE}/fdi/signaux-investisseurs/${s.id}/valeurs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(famille === "destination"
        ? { famille, ...(poste.nature === "region" ? { region_id: poste.id } : { pays_id: poste.id }) }
        : { famille, poste_id: poste.id }),
    }));

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
      aide={
        <>
          Les intentions déclarées par les investisseurs, en amont de tout projet annoncé.
          {" "}
          <strong style={{ color: "var(--gris-fort)" }}>
            Le tableau de fDi ne montre qu’une valeur par case et cache les autres.
          </strong>{" "}
          Le relevé porte ce qui était visible ; les valeurs manquantes s’ajoutent ici, et
          survivent aux réimports. Tant que la complétion n’est pas faite, un décompte par
          pays est un plancher, pas un total.
        </>
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
              </tr>
            </thead>
            <tbody>
              {signaux.length === 0 && (
                <LigneVide colSpan={9} texte={
                  envoyee || aCompleter || aArbitrer
                    ? "Aucun signal ne correspond à ce filtre."
                    : "Aucun signal importé."} />
              )}
              {signaux.map(s => (
                <tr key={s.id} style={{ background: s.vise_afrique ? undefined
                  : "rgb(var(--orange-rgb) / 0.03)" }}>
                  <td style={{ ...TD, whiteSpace: "nowrap" }}>{s.periode}</td>
                  <td style={TD}>
                    <div style={{ fontWeight: 600 }}>{s.entreprise ?? "—"}</div>
                    {s.parent && s.parent !== s.entreprise && (
                      <div style={{ fontSize: 11, color: "var(--gris)" }}>{s.parent}</div>
                    )}
                  </td>
                  <td style={{ ...TD, whiteSpace: "nowrap",
                    color: s.source_resolue ? undefined : "var(--orange)" }}>{s.source ?? "—"}</td>
                  {FAMILLES.map(f => (
                    <td key={f.cle} style={{ ...TD, minWidth: 170 }}>
                      <Case valeurs={s[f.champ]} options={ref?.[f.ref] ?? []} occupe={occupe}
                        onAjouter={p => ajouter(s, f.cle, p)}
                        onRetirer={v => retirer(s, f.cle, v)} />
                    </td>
                  ))}
                  <td style={{ ...TD, textAlign: "right" }}>
                    <Montant v={s.funding_musd} estime={s.funding_estime} />
                  </td>
                  <td style={{ ...TD, textAlign: "right" }}>
                    <Montant v={s.capex_musd} estime={s.capex_estime} />
                  </td>
                </tr>
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
