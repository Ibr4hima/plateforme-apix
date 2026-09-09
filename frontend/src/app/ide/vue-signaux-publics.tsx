"use client";

// Signaux d'investissement — la lecture publique.
//
// CE QUE CETTE VUE SERT, ET POURQUOI ELLE NE RESSEMBLE PAS À CELLE DES PROJETS.
// Un projet annoncé est un fait qu'on mesure : montants, emplois, séries
// annuelles. Un signal est une INTENTION qu'on repère — l'entreprise étudie un
// site, lève des fonds, nomme un responsable régional. On ne vient pas ici
// mesurer un flux, on vient trouver qui approcher et à quel stade.
//
// D'où la forme : une LISTE DE CARTES, pas un tableau de bord. Chaque carte
// répond à quatre questions dans l'ordre où on se les pose — à quel stade en
// est l'entreprise, qui est-elle, d'où vient-elle, et où veut-elle aller.
//
// CE QUE L'ÉCRAN DOIT DIRE ET NE PEUT PAS TAIRE : le décompte est un PLANCHER.
// Le tableau de fDi n'affiche qu'une destination par signal et cache les
// autres ; tant que la complétion n'est pas faite, « signaux visant le
// Sénégal » est un minimum. Le dire coûte une phrase ; ne pas le dire
// exposerait à défendre en réunion un total qui n'en est pas un.

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import DrapeauPays from "@/components/shared/DrapeauPays";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonChartGrid } from "@/components/shared/Skeleton";
import { useDebounced } from "@/lib/useDebounced";
import { useDonnees } from "@/lib/donnees";
import { API, fmtNombre } from "./partage";

type Valeur = { id: number; libelle: string | null; nature?: "pays" | "region" | null };
type Signal = {
  id: number; periode: string;
  entreprise: string | null; parent: string | null;
  origine: string | null; origine_iso: string | null;
  capex_musd: number | null; capex_estime: boolean | null;
  funding_musd: number | null; funding_estime: boolean | null;
  description_fr: string | null; description_en: string | null;
  destinations: Valeur[]; secteurs: Valeur[]; activites: Valeur[]; natures: Valeur[];
};
type Compte = { nom: string; nb: number; nature?: "pays" | "region" };
type Perimetre = {
  annees: [number | null, number | null]; total_signaux: number;
  destinations: Compte[]; secteurs: Compte[]; activites: Compte[]; natures: Compte[];
};
type Reponse = {
  kpis: { signaux: number; funding_musd: number | null; capex_musd: number | null;
          entreprises: number; origines: number; annees: [number | null, number | null];
          a_completer: number; plancher: boolean };
  page: number; pages: number;
  signaux: Signal[];
};

const PAR_PAGE = 24;

const TITRE_SS = { fontSize: 10.5, fontWeight: 800, color: "var(--gris)",
  textTransform: "uppercase" as const, letterSpacing: "0.12em" };

/** La teinte d'un stade d'intention. Ce n'est pas de l'ornement : le stade est
    la première chose qu'on lit sur une carte, parce qu'il décide si l'on
    décroche le téléphone aujourd'hui ou dans six mois. */
const TEINTE_NATURE: Record<string, string> = {
  "Projet à l'étude (nouveau ou extension)": "var(--vert)",
  "Nouvelle stratégie d'investissement": "var(--bleu)",
  "Nouvelles nominations": "var(--violet)",
};
const teinte = (n: string | null) =>
  (n && TEINTE_NATURE[n]) || "var(--orange)";

/** Une valeur d'une liste — destination, secteur, activité. Une région du monde
    se distingue d'un pays : « Afrique » et « Sénégal » ne se lisent pas de la
    même façon, et les confondre ferait croire à une cible précise là où
    l'entreprise n'a encore désigné qu'un continent. */
const Puce = ({ v }: { v: Valeur }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
    fontSize: 11.5, padding: "3px 9px", borderRadius: 8, whiteSpace: "nowrap",
    background: "var(--carte-douce)", border: "1px solid var(--filet)",
    color: "var(--gris-fort)" }}>
    {v.libelle}
    {v.nature === "region" && (
      <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em",
        textTransform: "uppercase", color: "var(--gris)" }}>région</span>
    )}
  </span>
);

const Montant = ({ v, estime, mot }: { v: number | null; estime: boolean | null; mot: string }) => {
  if (v == null) return null;
  return (
    <span title={estime ? "Valeur estimée par l'algorithme du Financial Times, non déclarée"
                        : "Valeur déclarée"}
      style={{ fontSize: 12, color: "var(--gris-fort)" }}>
      <span style={{ ...TITRE_SS, fontSize: 9.5, marginRight: 5 }}>{mot}</span>
      <strong style={{ color: "var(--encre)", fontVariantNumeric: "tabular-nums" }}>
        {estime ? "≈ " : ""}{fmtNombre(v)}
      </strong>
      <span style={{ fontSize: 10, color: "var(--gris)" }}> M$</span>
    </span>
  );
};

/** Un filtre à choix unique, replié dans une liste déroulante.

    Les facettes des signaux sont courtes — sept régions, trois stades, une
    quarantaine de secteurs — et l'écran est une liste de cartes, non un
    tableau de bord : une colonne de filtres permanente prendrait la place de
    ce qu'on vient lire. */
function Choix({ titre, options, valeur, onChange, vide }: {
  titre: string; options: Compte[]; valeur: string; onChange: (v: string) => void; vide: string;
}) {
  if (options.length === 0) return null;
  return (
    <label style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <span style={TITRE_SS}>{titre}</span>
      <select value={valeur} onChange={e => onChange(e.target.value)}
        style={{ background: "var(--carte)", border: "1px solid var(--bordure-forte)",
          borderRadius: 9, padding: "7px 10px", fontSize: 12.5, color: "var(--encre)",
          outline: "none", fontFamily: "var(--font-google-sans)", minWidth: 170 }}>
        <option value="">{vide}</option>
        {["region", "pays", undefined].map(nat => {
          const groupe = options.filter(o => o.nature === nat);
          if (!groupe.length) return null;
          const items = groupe.map(o => (
            <option key={`${nat}-${o.nom}`} value={o.nom}>{o.nom} ({o.nb})</option>
          ));
          const label = nat === "region" ? "Régions du monde" : nat === "pays" ? "Pays" : null;
          return label
            ? <optgroup key={String(nat)} label={label}>{items}</optgroup>
            : <optgroup key="autres" label="">{items}</optgroup>;
        })}
      </select>
    </label>
  );
}

export default function VueSignauxPublics() {
  const [destination, setDestination] = useState("");
  const [nature, setNature] = useState("");
  const [secteur, setSecteur] = useState("");
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const rechercheD = useDebounced(recherche, 300);

  // Un changement de filtre ramène au premier écran : rester en page 6 d'un
  // résultat qui n'en compte plus qu'une n'aurait aucun sens.
  const clef = `${destination}|${nature}|${secteur}|${rechercheD}`;
  const [vue, setVue] = useState(clef);
  if (clef !== vue) { setVue(clef); setPage(1); }

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (destination) p.set("destination", destination);
    if (nature) p.set("natures", nature);
    if (secteur) p.set("secteurs", secteur);
    if (rechercheD.trim()) p.set("recherche", rechercheD.trim());
    return p;
  }, [destination, nature, secteur, rechercheD]);

  const qPer = useDonnees<Perimetre>(`${API}/fdi/public/signaux/perimetre?${params}`, { garder: true });
  const liste = new URLSearchParams(params);
  liste.set("page", String(page));
  liste.set("par_page", String(PAR_PAGE));
  const qSig = useDonnees<Reponse>(`${API}/fdi/public/signaux?${liste}`, { garder: true });

  const per = qPer.data;
  const d = qSig.data;

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [page]);

  if (qSig.isError) return <ErreurChargement onRetry={() => qSig.refetch()} />;
  if (!d || !per) return <SkeletonChartGrid />;

  const k = d.kpis;
  const filtre = Boolean(destination || nature || secteur || rechercheD.trim());

  return (
    <div>
      {/* ── Ce qu'on regarde, et ce que ce nombre vaut ─────────────────── */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap",
        marginBottom: 6 }}>
        <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--encre)", margin: 0 }}>
          {fmtNombre(k.signaux)} signal{k.signaux > 1 ? "aux" : ""} d&apos;investissement
        </h2>
        {k.annees[0] != null && (
          <span style={{ fontSize: 12, color: "var(--gris)" }}>
            {k.annees[0] === k.annees[1] ? k.annees[0] : `${k.annees[0]} — ${k.annees[1]}`}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: "var(--gris-fort)", lineHeight: 1.7, margin: "0 0 4px",
        maxWidth: 720 }}>
        Des intentions déclarées, en amont de tout projet annoncé : une entreprise qui étudie un
        site, lève des fonds ou nomme un responsable régional. C&apos;est le stade où la
        prospection a encore prise.
      </p>
      {/* LA MISE EN GARDE N'EST PAS FACULTATIVE. Sans elle, le nombre ci-dessus
          se lirait comme un total, et il ne l'est pas. */}
      {k.plancher && (
        <p style={{ fontSize: 12, color: "var(--gris)", lineHeight: 1.6, margin: "0 0 18px",
          maxWidth: 720 }}>
          La source n&apos;affiche qu&apos;une destination par signal et masque les autres :
          ce décompte est un <strong style={{ color: "var(--gris-fort)" }}>minimum</strong>.
          {" "}{fmtNombre(k.a_completer)} signal{k.a_completer > 1 ? "aux" : ""} de cette
          sélection {k.a_completer > 1 ? "attendent" : "attend"} encore d&apos;être complété
          {k.a_completer > 1 ? "s" : ""}.
        </p>
      )}

      {/* ── Les filtres ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap",
        marginBottom: 20 }}>
        <Choix titre="Destination" options={per.destinations} valeur={destination}
          onChange={setDestination} vide="Toutes" />
        <Choix titre="Stade" options={per.natures} valeur={nature}
          onChange={setNature} vide="Tous" />
        <Choix titre="Secteur" options={per.secteurs} valeur={secteur}
          onChange={setSecteur} vide="Tous" />
        <label style={{ display: "inline-flex", flexDirection: "column", gap: 4, flex: 1,
          minWidth: 200 }}>
          <span style={TITRE_SS}>Recherche</span>
          <span style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%",
              transform: "translateY(-50%)", color: "var(--gris)" }} />
            <input value={recherche} onChange={e => setRecherche(e.target.value)}
              placeholder="Entreprise, description…"
              style={{ width: "100%", background: "var(--carte)", boxSizing: "border-box",
                border: "1px solid var(--bordure-forte)", borderRadius: 9,
                padding: "7px 10px 7px 30px", fontSize: 12.5, color: "var(--encre)",
                outline: "none", fontFamily: "var(--font-google-sans)" }} />
          </span>
        </label>
        {filtre && (
          <button onClick={() => { setDestination(""); setNature(""); setSecteur(""); setRecherche(""); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none",
              background: "none", cursor: "pointer", fontSize: 12, color: "var(--gris)",
              fontFamily: "inherit", padding: "8px 0" }}>
            <X size={12} /> Tout effacer
          </button>
        )}
      </div>

      {/* ── Les cartes ─────────────────────────────────────────────────── */}
      {d.signaux.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "60px 0" }}>
          Aucun signal ne correspond à cette recherche.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 14,
          gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))" }}>
          {d.signaux.map(s => <CarteSignal key={s.id} s={s} />)}
        </div>
      )}

      {d.pages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
          gap: 10, marginTop: 26 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            style={boutonPage(page > 1)}>Précédents</button>
          <span style={{ fontSize: 12.5, color: "var(--gris)" }}>
            Page {d.page} sur {d.pages}
          </span>
          <button disabled={page >= d.pages} onClick={() => setPage(p => p + 1)}
            style={boutonPage(page < d.pages)}>Suivants</button>
        </div>
      )}
    </div>
  );
}

const boutonPage = (actif: boolean): React.CSSProperties => ({
  border: "1px solid var(--bordure-forte)", background: "var(--carte)",
  borderRadius: 9, padding: "7px 14px", fontSize: 12.5, color: "var(--encre)",
  cursor: actif ? "pointer" : "default", opacity: actif ? 1 : 0.4,
  fontFamily: "var(--font-google-sans)",
});

/** Une carte répond à quatre questions dans l'ordre où on se les pose : à quel
    STADE en est l'entreprise, QUI est-elle, D'OÙ vient-elle, et OÙ veut-elle
    aller. Les montants viennent après — ils sont rarement renseignés à ce
    stade, et ce n'est pas ce qu'on vient chercher ici. */
function CarteSignal({ s }: { s: Signal }) {
  const stade = s.natures[0]?.libelle ?? null;
  const c = teinte(stade);
  return (
    <article style={{ background: "var(--carte)", borderRadius: 14,
      border: "1px solid rgb(var(--encre-rgb) / 0.10)", padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 9 }}>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {s.natures.map(n => (
          <span key={n.id} style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em",
            textTransform: "uppercase", padding: "3px 8px", borderRadius: 999,
            color: teinte(n.libelle),
            background: `color-mix(in srgb, ${teinte(n.libelle)} 10%, transparent)` }}>
            {n.libelle}
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--gris)" }}>{s.periode}</span>
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--encre)", lineHeight: 1.3 }}>
          {s.entreprise ?? "—"}
        </div>
        {s.parent && s.parent !== s.entreprise && (
          <div style={{ fontSize: 11.5, color: "var(--gris)", marginTop: 1 }}>
            groupe {s.parent}
          </div>
        )}
      </div>

      {/* D'OÙ, puis VERS OÙ. Une intention se lit comme un trajet. */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap",
        fontSize: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6,
          color: "var(--gris-fort)" }}>
          <DrapeauPays iso={s.origine_iso} nom={s.origine ?? ""} taille={14} sansIso="rien" />
          {s.origine ?? "—"}
        </span>
        <span style={{ color: "var(--gris)" }}>→</span>
        <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {s.destinations.length === 0
            ? <span style={{ color: "var(--gris)", fontSize: 11.5 }}>destination non précisée</span>
            : s.destinations.map(v => <Puce key={v.id} v={v} />)}
        </span>
      </div>

      {(s.secteurs.length > 0 || s.activites.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {s.secteurs.map(v => <Puce key={`s${v.id}`} v={v} />)}
          {s.activites.map(v => <Puce key={`a${v.id}`} v={v} />)}
        </div>
      )}

      {s.description_fr && (
        <p style={{ fontSize: 12.5, color: "var(--gris-fort)", lineHeight: 1.6, margin: 0 }}>
          {s.description_fr}
        </p>
      )}

      {(s.funding_musd != null || s.capex_musd != null) && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingTop: 8,
          borderTop: "1px solid var(--filet)" }}>
          <Montant v={s.funding_musd} estime={s.funding_estime} mot="Fonds levés" />
          <Montant v={s.capex_musd} estime={s.capex_estime} mot="Investissement prévu" />
        </div>
      )}
      <div style={{ height: 0, borderBottom: `2px solid ${c}`, opacity: 0.18 }} />
    </article>
  );
}
