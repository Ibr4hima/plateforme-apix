"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { d3 } from "@/lib/d3lazy";
import { fmtMillionsUSD } from "@/lib/format";
import { PALETTE_COMPARAISON } from "@/lib/couleurs";

// ── Barres divergentes — flux net (entrant − sortant) (vue Monde, page IDE) ──
// Le dessin commun des barres, de part et d'autre d'une ligne de zéro :
//  - UNE échelle linéaire pour les deux côtés. Les deux échelles en racine
//    carrée d'avant, indépendantes, donnaient la même longueur à un solde de
//    +5 Md $ et à un solde de −50 M $ ;
//  - deux teintes qui se lisent comme opposées sans juger : bleu au-dessus de
//    zéro, orange en dessous (le vert et le rouge disaient « bien » et « mal »,
//    ce qu'un solde d'investissement n'est pas) ;
//  - les noms en colonne à gauche, la valeur signée au bout de chaque barre,
//    à l'encre.

const COULEUR_POS = PALETTE_COMPARAISON[0];
const COULEUR_NEG = PALETTE_COMPARAISON[1];

/** Une barre horizontale depuis x0 (la ligne de zéro) jusqu'à x1, arrondie au bout. */
function cheminBarreH(x0: number, x1: number, y: number, h: number, rayon = 4): string {
  const w = Math.abs(x1 - x0);
  if (w < 0.5) return "";
  const r = Math.min(rayon, h / 2, w);
  return x1 > x0
    ? `M${x0},${y}H${x1 - r}A${r},${r} 0 0 1 ${x1},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x1 - r},${y + h}H${x0}Z`
    : `M${x0},${y}H${x1 + r}A${r},${r} 0 0 0 ${x1},${y + r}V${y + h - r}A${r},${r} 0 0 0 ${x1 + r},${y + h}H${x0}Z`;
}

export function DivergingBars({ donnees, mini = false }: { donnees: any[]; mini?: boolean }) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [annee, setAnnee] = useState<number | null>(null);
  const [ind,   setInd]   = useState("flux");

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current) return;
    const el = svgRef.current;
    d3.select(el).selectAll("*").remove();
    if (!donnees.length) return;

    const curInd = mini ? "flux" : ind;
    const annees = [...new Set(donnees.map((d: any) => d.annee as number))].sort((a, b) => b - a);
    const curAnnee = mini ? annees[0] : (annee ?? annees[0]);

    type Ligne = { pays: string; iso3: string | null; net: number };
    const paysList = [...new Set(donnees.map((d: any) => d.pays as string))];
    const data: Ligne[] = paysList.map(pays => {
      const ent = donnees.find((d: any) => d.pays === pays && d.annee === curAnnee && d.indicateur === curInd && d.direction === "entrant");
      const sor = donnees.find((d: any) => d.pays === pays && d.annee === curAnnee && d.indicateur === curInd && d.direction === "sortant");
      return { pays, iso3: ent?.code_iso3 ?? sor?.code_iso3 ?? null, net: (ent?.valeur ?? 0) - (sor?.valeur ?? 0) };
    })
      .filter(d => d.net !== 0)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).slice(0, 10)
      .sort((a, b) => b.net - a.net);   // positifs en haut, négatifs en bas
    if (!data.length) return;

    const W = wrapRef.current.clientWidth || 500;
    const taille = mini ? 8.5 : 11.5;
    const police = getComputedStyle(el).fontFamily || "sans-serif";
    const ctx = document.createElement("canvas").getContext("2d");
    const largeur = (t: string, graisse: number) => { if (!ctx) return t.length * taille * 0.56; ctx.font = `${graisse} ${taille}px ${police}`; return ctx.measureText(t).width; };
    const nom = (d: Ligne) => mini ? (d.iso3 ?? d.pays.slice(0, 3).toUpperCase()) : d.pays;
    // Valeurs en millions USD (CNUCED) : la règle commune des montants
    // (lib/format) les écrit « +1,2 Md $ », avec leur signe
    const montant = (v: number) => `${v > 0 ? "+" : ""}${fmtMillionsUSD(v)}`.replace("-", "−");

    const rowH = mini ? 16 : 32;
    const barH = mini ? 9 : 18;
    const MT = mini ? 2 : 22, MB = 2;
    const colNoms = Math.ceil(Math.max(...data.map(d => largeur(nom(d), 500)))) + (mini ? 6 : 14);
    const pos = data.filter(d => d.net > 0), neg = data.filter(d => d.net < 0);
    const lPos = pos.length ? Math.max(...pos.map(d => largeur(montant(d.net), 600))) + (mini ? 4 : 8) : 0;
    const lNeg = neg.length ? Math.max(...neg.map(d => largeur(montant(d.net), 600))) + (mini ? 4 : 8) : 0;
    const H = MT + data.length * rowH + MB;
    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");

    const mn = Math.min(0, d3.min(data, d => d.net) ?? 0), mx = Math.max(0, d3.max(data, d => d.net) ?? 0);
    const x = d3.scaleLinear().domain([mn, mx]).range([colNoms + lNeg, W - lPos - (mini ? 2 : 6)]);
    const x0 = x(0);

    // Graduations en haut et filets verticaux (pleine taille seulement)
    if (!mini) {
      const ticks = x.ticks(4);
      ticks.forEach(t => {
        const xx = Math.round(x(t)) + 0.5;
        svg.append("line").attr("x1", xx).attr("x2", xx).attr("y1", MT - 4).attr("y2", H - MB)
          .style("stroke", t === 0 ? "var(--bordure-forte)" : "var(--grille)").attr("stroke-width", 1);
        svg.append("text").attr("x", xx).attr("y", MT - 9).attr("text-anchor", "middle").attr("font-size", 10.5)
          .style("fill", "var(--gris)").style("font-variant-numeric", "tabular-nums")
          .text(t === 0 ? "0" : `${t > 0 ? "+" : "−"}${Math.abs(t).toLocaleString("fr-FR")}`);
      });
    } else {
      svg.append("line").attr("x1", Math.round(x0) + 0.5).attr("x2", Math.round(x0) + 0.5).attr("y1", MT).attr("y2", H - MB)
        .style("stroke", "var(--bordure-forte)").attr("stroke-width", 1);
    }

    data.forEach((d, i) => {
      const yc = MT + i * rowH + rowH / 2;
      const x1 = x(d.net);
      svg.append("path").attr("d", cheminBarreH(x0, x1, yc - barH / 2, barH)).style("fill", d.net >= 0 ? COULEUR_POS : COULEUR_NEG);
      svg.append("text").attr("x", colNoms - (mini ? 5 : 12)).attr("y", yc).attr("dy", "0.34em").attr("text-anchor", "end")
        .attr("font-size", taille).attr("font-weight", 500).style("fill", "var(--texte)").text(nom(d));
      svg.append("text").attr("x", d.net >= 0 ? x1 + (mini ? 3 : 6) : x1 - (mini ? 3 : 6)).attr("y", yc).attr("dy", "0.34em")
        .attr("text-anchor", d.net >= 0 ? "start" : "end")
        .attr("font-size", taille).attr("font-weight", 600).style("fill", "var(--encre)").style("font-variant-numeric", "tabular-nums")
        .text(montant(d.net));
    });
  }, [donnees, annee, ind, mini]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(() => draw());
    obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [draw]);

  const annees = [...new Set(donnees.map((d: any) => d.annee as number))].sort((a, b) => b - a);
  const Pill = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{ padding: "4px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: active ? "var(--bleu-action)" : "var(--fond)", color: active ? "var(--sur-bleu)" : "var(--gris)", transition: "all 0.15s" }}>{label}</button>
  );

  return (
    <div>
      {!mini && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" as const, alignItems: "center" }}>
          <select value={annee ?? annees[0]} onChange={e => setAnnee(Number(e.target.value))}
            style={{ fontSize: 11, padding: "3px 8px", borderRadius: 7, border: "1px solid var(--bordure-forte)", background: "var(--carte)", color: "var(--encre)", cursor: "pointer" }}>
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <div style={{ width: 1, background: "var(--fond-creux2)", margin: "0 2px" }} />
          <Pill label="Flux net"  active={ind === "flux"}  onClick={() => setInd("flux")} />
          <Pill label="Stock net" active={ind === "stock"} onClick={() => setInd("stock")} />
        </div>
      )}
      <div ref={wrapRef} style={{ width: "100%", overflow: "hidden" }}>
        <svg ref={svgRef} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>
    </div>
  );
}
