"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { d3 } from "@/lib/d3lazy";
import { fmtMillionsUSD } from "@/lib/format";
import { SkeletonRows } from "@/components/shared/Skeleton";
import { PALETTE_COMPARAISON } from "@/lib/couleurs";

// ── Barres horizontales Top 10 (vue Monde, page IDE) ──────────────────────────
// Le dessin commun des barres : une seule couleur (une seule série), des
// barres fines arrondies à leur bout et carrées à la base, la valeur écrite à
// l'encre au bout de chaque barre, le nom du pays à gauche.
//
// L'échelle est LINÉAIRE : la longueur d'une barre est proportionnelle à sa
// valeur. L'ancienne échelle en racine carrée faisait paraître le dixième pays
// à moitié du premier quand il n'en pesait qu'un dixième.

/** Une barre horizontale, arrondie à son bout droit, carrée sur la base. */
function cheminBarreH(x0: number, y: number, w: number, h: number, rayon = 4): string {
  if (w < 0.5) return "";
  const r = Math.min(rayon, h / 2, w);
  return `M${x0},${y}H${x0 + w - r}A${r},${r} 0 0 1 ${x0 + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x0 + w - r},${y + h}H${x0}Z`;
}

export function HBarChart({ donnees, mini = false }: { donnees: any[]; mini?: boolean }) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [annee, setAnnee] = useState<number | null>(null);
  const [ind,   setInd]   = useState("flux");
  const [dir,   setDir]   = useState("entrant");

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current) return;
    const el = svgRef.current;
    d3.select(el).selectAll("*").remove();
    if (!donnees.length) return;

    const curInd = mini ? "flux"    : ind;
    const curDir = mini ? "entrant" : dir;
    const annees = [...new Set(donnees.map((d: any) => d.annee as number))].sort((a, b) => b - a);
    const curAnnee = mini ? annees[0] : (annee ?? annees[0]);
    const data = donnees
      .filter((d: any) => d.annee === curAnnee && d.indicateur === curInd && d.direction === curDir && d.valeur !== null)
      .sort((a: any, b: any) => b.valeur - a.valeur)
      .slice(0, 10);
    if (!data.length) return;

    const W = wrapRef.current.clientWidth || 600;
    const taille = mini ? 8.5 : 11.5;
    const police = getComputedStyle(el).fontFamily || "sans-serif";
    const ctx = document.createElement("canvas").getContext("2d");
    const largeur = (t: string, graisse: number) => { if (!ctx) return t.length * taille * 0.56; ctx.font = `${graisse} ${taille}px ${police}`; return ctx.measureText(t).width; };
    const nom = (d: any) => mini ? ((d.code_iso3 as string | null) ?? (d.pays as string).slice(0, 3).toUpperCase()) : (d.pays as string);
    const valeur = (v: number) => fmtMillionsUSD(v);

    const rowH = mini ? 16 : 34;
    const barH = mini ? 9 : 18;
    const M = {
      top: 2, bottom: 2,
      left: Math.ceil(Math.max(...data.map((d: any) => largeur(nom(d), 500)))) + (mini ? 6 : 12),
      right: Math.ceil(Math.max(...data.map((d: any) => largeur(valeur(d.valeur), 600)))) + (mini ? 6 : 10),
    };
    const H = data.length * rowH + M.top + M.bottom;
    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");

    const maxVal = Math.max(1e-9, d3.max(data, (d: any) => d.valeur as number) as number);
    const x = d3.scaleLinear().domain([0, maxVal]).range([M.left, W - M.right]);
    const yCentre = (i: number) => M.top + i * rowH + rowH / 2;

    data.forEach((d: any, i: number) => {
      const yc = yCentre(i);
      const w = Math.max(0, x(Math.max(0, d.valeur)) - M.left);
      svg.append("path").attr("d", cheminBarreH(M.left, yc - barH / 2, w, barH)).style("fill", PALETTE_COMPARAISON[0]);
      svg.append("text").attr("x", M.left + w + (mini ? 4 : 7)).attr("y", yc).attr("dy", "0.34em")
        .attr("font-size", taille).attr("font-weight", 600).style("fill", "var(--encre)").style("font-variant-numeric", "tabular-nums")
        .text(valeur(d.valeur));
      svg.append("text").attr("x", M.left - (mini ? 5 : 10)).attr("y", yc).attr("dy", "0.34em").attr("text-anchor", "end")
        .attr("font-size", taille).attr("font-weight", 500).style("fill", "var(--texte)")
        .text(nom(d));
    });
  }, [donnees, annee, ind, dir, mini]);

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
          <Pill label="Flux"    active={ind === "flux"}    onClick={() => setInd("flux")} />
          <Pill label="Stock"   active={ind === "stock"}   onClick={() => setInd("stock")} />
          <div style={{ width: 1, background: "var(--fond-creux2)", margin: "0 2px" }} />
          <Pill label="Entrant" active={dir === "entrant"} onClick={() => setDir("entrant")} />
          <Pill label="Sortant" active={dir === "sortant"} onClick={() => setDir("sortant")} />
        </div>
      )}
      <div ref={wrapRef} style={{ width: "100%", overflow: "hidden" }}>
        <svg ref={svgRef} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>
      {donnees.length === 0 && !mini && <div style={{ marginTop: 16 }}><SkeletonRows n={10} h={36} /></div>}
    </div>
  );
}
