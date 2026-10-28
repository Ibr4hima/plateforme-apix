"use client";

// La vedette de l'accueil — la situation du Sénégal en un chiffre, comme sur
// l'app (mobile/src/components/VedetteIde.tsx) : un grand nombre, sa
// variation, sa courbe, et quatre repères en pied de carte. Cliquer un repère
// l'installe en vedette ; la série d'avant redescend parmi les repères.
// L'en-tête mène au module de la série.
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

export const tableau = <T,>(v: unknown) => (Array.isArray(v) ? v : []) as T[];
const enSerie = (rows: Ligne[]): Point[] => rows
  .filter(r => r.valeur != null && Number(r.annee) > 0)
  .map(r => ({ annee: Number(r.annee), valeur: Number(r.valeur) }))
  .sort((a, b) => a.annee - b.annee);

/** Le commerce extérieur (NACE) d'une année : la somme des groupes
    d'utilisation, tolérante aux trous — un groupe absent ne compte pas zéro,
    il ne compte pas. Exporté pour la carte « Échanges commerciaux ». */
export function useCommerceExterieur() {
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
    la tendance, le chiffre dit la valeur. Le trait garde son épaisseur quelle
    que soit la largeur de la carte (non-scaling-stroke) ; le dernier point est
    un rond HTML posé par-dessus, qu'un SVG étiré aurait ovalisé. */
function Courbe({ points }: { points: Point[] }) {
  const W = 600, H = 96, PY = 8;
  const pts = points.slice(-20);
  if (pts.length < 2) return <div style={{ height: H }} />;
  const vals = pts.map(p => p.valeur);
  const min = Math.min(...vals), max = Math.max(...vals);
  const etendue = max - min || 1;
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => PY + (1 - (v - min) / etendue) * (H - 2 * PY);
  const ligne = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.valeur).toFixed(1)}`).join("");
  const aire = `${ligne}L${W},${H}L0,${H}Z`;
  const fin = pts[pts.length - 1];
  return (
    <div>
      <div style={{ position: "relative", height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden
          style={{ width: "100%", height: H, display: "block", overflow: "visible" }}>
          <path d={aire} fill="rgb(var(--bleu-rgb) / 0.07)" />
          <path d={ligne} fill="none" stroke="var(--bleu)" strokeWidth={2} vectorEffect="non-scaling-stroke"
            strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <span aria-hidden style={{ position: "absolute", right: -4, top: y(fin.valeur) - 4, width: 8, height: 8,
          borderRadius: "50%", background: "var(--bleu)", boxShadow: "0 0 0 3px var(--carte)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, fontWeight: 600,
        color: "var(--gris)", fontVariantNumeric: "tabular-nums" }}>
        <span>{pts[0].annee}</span><span>{fin.annee}</span>
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
  const fmt = (cle: Cle, v: number) =>
    cle === "pib" ? fmtUnite(v, unitePib) : cle === "exports" || cle === "imports" ? fmtMFCFA(v) : fmtMillionsUSD(v);

  const serie = series[actif];
  const dernier = serie.at(-1) ?? null;
  const precedent = serie.length > 1 ? serie[serie.length - 2] : null;
  const delta = dernier && precedent && precedent.valeur !== 0
    ? ((dernier.valeur - precedent.valeur) / Math.abs(precedent.valeur)) * 100 : null;
  const enPanne = actif === "entrants" ? qEnt.isError && !dernier : false;

  return (
    <div className="ds-carte acc-vedette" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "22px 24px 18px" }}>
        {/* L'en-tête mène au module de la série */}
        <Link href={SERIES[actif].href} className="acc-vedette-tete"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, textDecoration: "none" }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bleu)" }}>
            {SERIES[actif].titre}{dernier ? <span style={{ color: "var(--gris)" }}> · {dernier.annee}</span> : null}
          </span>
          <ArrowUpRight size={16} className="acc-fleche" />
        </Link>

        {/* Le nombre et sa variation ; la clé relance l'apparition à chaque
            changement de vedette */}
        <div key={actif} className="acc-apparition" style={{ marginTop: 10, minHeight: 78 }}>
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
              <div className="acc-vedette-nombre">{fmt(actif, dernier.valeur)}</div>
              <div style={{ marginTop: 8, minHeight: 16 }}><Variation valeur={delta} annee={precedent?.annee} taille={12} /></div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: "var(--gris-fort)", marginTop: 8 }}>Données non importées pour cette série.</p>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          {chargement[actif] ? <Skeleton h={96} r={8} /> : <Courbe points={serie} />}
        </div>
      </div>

      {/* Les quatre repères : un clic les installe en vedette */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", borderTop: "1px solid var(--filet)" }}>
        {ORDRE.filter(c => c !== actif).map((cle, i) => {
          const s = series[cle], d = s.at(-1);
          return (
            <button key={cle} onClick={() => setActif(cle)} disabled={!d && !chargement[cle]} className="acc-repere"
              aria-label={`Mettre en vedette : ${SERIES[cle].titre}`}
              style={{ borderRight: i % 2 === 0 ? "1px solid var(--filet)" : "none",
                borderBottom: i < 2 ? "1px solid var(--filet)" : "none" }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--gris)" }}>
                {SERIES[cle].titre}{d ? ` · ${d.annee}` : ""}
              </span>
              {chargement[cle] ? <Skeleton w={90} h={16} r={4} style={{ marginTop: 6 }} />
                : <span className="acc-repere-valeur">{d ? fmt(cle, d.valeur) : "—"}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
