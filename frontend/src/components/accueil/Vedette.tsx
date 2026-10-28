"use client";

// La vedette de l'accueil — la situation du Sénégal en un chiffre, comme sur
// l'app (mobile/src/components/VedetteIde.tsx) : un grand nombre, sa
// variation, sa courbe, et quatre repères en pied de carte. Cliquer un repère
// l'installe en vedette ; la série d'avant redescend parmi les repères.
// L'en-tête mène au module de la série. Au survol, la courbe donne l'année et
// la valeur du point visé.
//
// LES ADRESSES SONT CELLES DU TABLEAU DE BORD. La clé de cache de React Query
// est l'URL : l'accueil et le tableau de bord partagent leurs téléchargements,
// et ouvrir l'un après l'autre trouve les séries déjà là.

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, RotateCw } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useDonnees } from "@/lib/donnees";
import { fmtMFCFA, fmtMillionsUSD, fmtUnite } from "@/lib/format";
import Variation from "@/components/shared/Variation";
import { Skeleton } from "@/components/shared/Skeleton";

export type Point = { annee: number; valeur: number };
type Cle = "entrants" | "sortants" | "pib" | "exports" | "imports";
/** Une ligne de série telle que l'API la sert (CNUCED, NACE, indicateurs). */
type Ligne = { annee: number | string; valeur: number | string | null; indicateur?: string };
type Nace = { disponible?: boolean; donnees?: { export?: Ligne[]; import?: Ligne[] } };
type PaysStat = { id: number; code_iso3: string };
type Indicateur = { code: string; unite?: string | null };

const ORDRE: Cle[] = ["entrants", "sortants", "pib", "exports", "imports"];
const SERIES: Record<Cle, { titre: string; href: string }> = {
  entrants: { titre: "Flux d'IDE entrants", href: "/ide" },
  sortants: { titre: "Flux d'IDE sortants", href: "/ide" },
  pib:      { titre: "PIB", href: "/statistiques" },
  exports:  { titre: "Exportations", href: "/statistiques?mode=exterieur" },
  imports:  { titre: "Importations", href: "/statistiques?mode=exterieur" },
};

const tableau = <T,>(v: unknown) => (Array.isArray(v) ? v : []) as T[];
const enSerie = (rows: Ligne[]): Point[] => rows
  .filter(r => r.valeur != null && Number(r.annee) > 0)
  .map(r => ({ annee: Number(r.annee), valeur: Number(r.valeur) }))
  .sort((a, b) => a.annee - b.annee);

/** Le commerce extérieur (NACE) d'une année : la somme des groupes
    d'utilisation, tolérante aux trous — un groupe absent ne compte pas zéro,
    il ne compte pas. */
function useCommerceExterieur() {
  const q = useDonnees<Nace>(`${API}/nace/groupes-utilisation`);
  const series = useMemo(() => {
    const parSens = (sens: "export" | "import"): Point[] => {
      const m = new Map<number, number>();
      for (const r of tableau<Ligne>(q.data?.donnees?.[sens])) {
        if (r.valeur == null) continue;
        m.set(Number(r.annee), (m.get(Number(r.annee)) ?? 0) + Number(r.valeur));
      }
      return [...m.entries()].map(([annee, valeur]) => ({ annee, valeur })).sort((a, b) => a.annee - b.annee);
    };
    return { exports: parSens("export"), imports: parSens("import") };
  }, [q.data]);
  return { ...series, chargement: q.isPending, erreur: q.isError };
}

/** La courbe : les vingt dernières années, sans axe ni graduation — elle dit
    la tendance, le chiffre dit la valeur, et le survol donne le reste. Elle
    PREND LA HAUTEUR QU'ON LUI LAISSE : la vedette s'aligne sur la colonne
    voisine, et la place gagnée revient au dessin plutôt qu'à un vide sous le
    chiffre. Le trait garde son épaisseur quelle que soit la taille
    (non-scaling-stroke) ; les points sont des ronds HTML posés en
    pourcentages par-dessus, qu'un SVG étiré aurait ovalisés. */
function Courbe({ points, fmt }: { points: Point[]; fmt: (v: number) => string }) {
  const [vise, setVise] = useState<number | null>(null);
  const W = 600, H = 100, PY = 8;
  const pts = points.slice(-20);
  if (pts.length < 2) return <div style={{ flex: 1, minHeight: 96 }} />;
  const vals = pts.map(p => p.valeur);
  const min = Math.min(...vals), max = Math.max(...vals);
  const etendue = max - min || 1;
  const xPct = (i: number) => (i / (pts.length - 1)) * 100;
  const y = (v: number) => PY + (1 - (v - min) / etendue) * (H - 2 * PY);
  const yPct = (v: number) => (y(v) / H) * 100;
  const ligne = pts.map((p, i) => `${i ? "L" : "M"}${((xPct(i) / 100) * W).toFixed(1)},${y(p.valeur).toFixed(1)}`).join("");
  const aire = `${ligne}L${W},${H}L0,${H}Z`;
  const i = vise ?? pts.length - 1;
  const p = pts[i];
  const viser = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setVise(Math.max(0, Math.min(pts.length - 1, Math.round(((e.clientX - r.left) / r.width) * (pts.length - 1)))));
  };
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ position: "relative", flex: 1, minHeight: 96 }} onMouseMove={viser} onMouseLeave={() => setVise(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", overflow: "visible" }}>
          <path d={aire} fill="rgb(var(--bleu-rgb) / 0.07)" />
          <path d={ligne} fill="none" stroke="var(--bleu)" strokeWidth={2} vectorEffect="non-scaling-stroke"
            strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {vise != null && (
          <span aria-hidden style={{ position: "absolute", left: `${xPct(i)}%`, top: 0, bottom: 0, width: 1,
            background: "rgb(var(--bleu-rgb) / 0.25)" }} />
        )}
        <span aria-hidden style={{ position: "absolute", left: `calc(${xPct(i)}% - 4px)`, top: `calc(${yPct(p.valeur)}% - 4px)`, width: 8, height: 8,
          borderRadius: "50%", background: "var(--bleu)", boxShadow: "0 0 0 3px var(--carte)" }} />
        {vise != null && (
          <span className="acc-infobulle" style={{ left: `${xPct(i)}%`, top: `${yPct(p.valeur)}%`,
            transform: `translate(${xPct(i) > 80 ? "-100%" : xPct(i) < 20 ? "0" : "-50%"}, calc(-100% - 12px))` }}>
            <b>{p.annee}</b> · {fmt(p.valeur)}
          </span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, fontWeight: 600,
        color: "var(--gris)", fontVariantNumeric: "tabular-nums" }}>
        <span>{pts[0].annee}</span><span>{pts[pts.length - 1].annee}</span>
      </div>
    </div>
  );
}

export default function Vedette() {
  const [actif, setActif] = useState<Cle>("entrants");

  const qEnt = useDonnees<Ligne[]>(`${API}/ide/cnuced?direction=entrant&indicateur=flux`);
  const qSort = useDonnees<Ligne[]>(`${API}/ide/cnuced?direction=sortant&indicateur=flux`);
  const commerce = useCommerceExterieur();
  // Le PIB : la ligne du Sénégal dans les indicateurs socio-économiques, et
  // son unité dans le référentiel des indicateurs
  const qPays = useDonnees<PaysStat[]>(`${API}/statistiques/pays`);
  const sen = useMemo(() => tableau<PaysStat>(qPays.data).find(p => p.code_iso3 === "SEN") ?? null, [qPays.data]);
  const qSocio = useDonnees<Ligne[]>(sen ? `${API}/statistiques/donnees?pays=${sen.id}&annee_min=1960&annee_max=2100` : null);
  const qInd = useDonnees<Indicateur[]>(`${API}/statistiques/indicateurs`);
  const unitePib = tableau<Indicateur>(qInd.data).find(i => i.code === "pib")?.unite || "USD";

  const series: Record<Cle, Point[]> = useMemo(() => ({
    entrants: enSerie(tableau<Ligne>(qEnt.data)),
    sortants: enSerie(tableau<Ligne>(qSort.data)),
    pib: enSerie(tableau<Ligne>(qSocio.data).filter(r => r.indicateur === "pib")),
    exports: commerce.exports,
    imports: commerce.imports,
  }), [qEnt.data, qSort.data, qSocio.data, commerce.exports, commerce.imports]);

  const chargement: Record<Cle, boolean> = {
    entrants: qEnt.isPending, sortants: qSort.isPending,
    pib: qPays.isPending || (sen != null && qSocio.isPending),
    exports: commerce.chargement, imports: commerce.chargement,
  };
  const fmt = (cle: Cle) => (v: number) =>
    cle === "pib" ? fmtUnite(v, unitePib) : cle === "exports" || cle === "imports" ? fmtMFCFA(v) : fmtMillionsUSD(v);

  const serie = series[actif];
  const dernier = serie.at(-1) ?? null;
  const precedent = serie.length > 1 ? serie[serie.length - 2] : null;
  const delta = dernier && precedent && precedent.valeur !== 0
    ? ((dernier.valeur - precedent.valeur) / Math.abs(precedent.valeur)) * 100 : null;
  const enPanne = actif === "entrants" ? qEnt.isError && !dernier : false;

  return (
    <div className="ds-carte acc-vedette" style={{ padding: 0, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ padding: "20px 24px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* L'en-tête mène au module de la série */}
        <Link href={SERIES[actif].href} className="acc-carte-tete">
          <span className="acc-etiquette">
            {SERIES[actif].titre}{dernier ? <span style={{ color: "var(--gris)" }}> · {dernier.annee}</span> : null}
          </span>
          <ArrowUpRight size={16} className="acc-fleche" />
        </Link>

        {/* Le nombre et sa variation ; la clé relance l'apparition à chaque
            changement de vedette */}
        <div key={actif} className="acc-apparition" style={{ marginTop: 10, minHeight: 74 }}>
          {chargement[actif] ? (
            <>
              <Skeleton w={210} h={44} r={8} />
              <Skeleton w={130} h={12} r={4} style={{ marginTop: 12 }} />
            </>
          ) : enPanne ? (
            <button onClick={() => qEnt.refetch()} className="ds-bouton ds-bouton--secondaire ds-bouton--petit" style={{ gap: 6, marginTop: 8 }}>
              <RotateCw size={13} /> Chiffres indisponibles — réessayer
            </button>
          ) : dernier ? (
            <>
              <div className="acc-vedette-nombre">{fmt(actif)(dernier.valeur)}</div>
              <div style={{ marginTop: 8, minHeight: 16 }}><Variation valeur={delta} annee={precedent?.annee} taille={12} /></div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: "var(--gris-fort)", marginTop: 8 }}>Données non importées pour cette série.</p>
          )}
        </div>

        {/* La courbe prend toute la hauteur restante de la carte */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 16, minHeight: 130 }}>
          {chargement[actif] ? <Skeleton h="100%" r={8} style={{ minHeight: 116 }} /> : <Courbe key={actif} points={serie} fmt={fmt(actif)} />}
        </div>
      </div>

      {/* Les quatre repères : un clic les installe en vedette */}
      <div className="acc-reperes">
        {ORDRE.filter(c => c !== actif).map(cle => {
          const s = series[cle], d = s.at(-1);
          return (
            <button key={cle} onClick={() => setActif(cle)} disabled={!d && !chargement[cle]} className="acc-repere"
              aria-label={`Mettre en vedette : ${SERIES[cle].titre}`}>
              <span className="acc-repere-titre">{SERIES[cle].titre}{d ? ` · ${d.annee}` : ""}</span>
              {chargement[cle] ? <Skeleton w={90} h={16} r={4} style={{ marginTop: 6 }} />
                : <span className="acc-repere-valeur">{d ? fmt(cle)(d.valeur) : "—"}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
