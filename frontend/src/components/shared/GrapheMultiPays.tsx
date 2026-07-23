"use client";

// Graphe multi-séries signature — courbes avec glow et ombre portée
// (filtres SVG), aires en dégradé riche, curseur aimanté année par année
// (ligne + points + tooltip avec delta vs année précédente), annotation
// du pic historique en mono-série. Rendu STATIQUE : aucune animation
// d'entrée (elles rejouaient à chaque redimensionnement).
// Les règles du site sont inchangées : double axe quand les amplitudes
// divergent (ratio > 4), ticks aux couleurs des séries, barres groupées.
import { useCallback, useEffect, useRef } from "react";
import { d3, useD3Pret } from "@/lib/d3lazy";
import { fmtCompact, fmtAxe } from "@/lib/format";
import { showD3Tooltip as montrerTooltip, hideD3Tooltip as cacherTooltip } from "@/components/charts/outilsTooltip";

type Point = { annee: number; valeur: number | null };
export type SerieGraphe = {
  nom: string;
  couleur: string;
  data: Point[];
  /** Motif de tiret (ex. "6,4") — trace une courbe de référence en pointillés,
      sans aire ni halo (ligne secondaire épurée). */
  dash?: string;
  /** Forcer / retirer l'aire dégradée sous la courbe (défaut : pleine sauf en pointillés). */
  aire?: boolean;
};

export default function GrapheMultiPays({ series, height = 280, type = "line", fmt, fmtX, showDots = true, lineWidth, dualAxis }: {
  series: SerieGraphe[];
  height?: number;
  type?: "line" | "bar";
  titre?: string;
  fmt?: (v: number | null) => string;
  /** Libellé de l'axe X et des infobulles (défaut : l'année telle quelle) —
      permet un axe mensuel en passant x = numéro de mois. */
  fmtX?: (x: number) => string;
  showDots?: boolean;
  lineWidth?: number;
  /** false = jamais de double axe (séries de même unité, échelle partagée). */
  dualAxis?: boolean;
}) {
  const pret = useD3Pret();
  const ref = useRef<SVGSVGElement>(null);
  // Identifiant unique de l'instance : les defs SVG (filtres, dégradés)
  // sont résolus à l'échelle du document, il ne faut aucune collision
  const uid = useRef(`sig${Math.random().toString(36).slice(2, 8)}`).current;
  const wrapRef = useRef<HTMLDivElement>(null);
  const fmtV = fmt || fmtCompact;

  const draw = useCallback(() => {
    if (!pret || !ref.current) return;
    const el = ref.current;
    d3.select(el).selectAll("*").remove();
    if (!series.length) return;
    const W = el.parentElement?.clientWidth || el.clientWidth || 700;
    const H = height;

    const fmtXv = fmtX || ((x: number) => String(x));
    const allData = series.flatMap(s => s.data.filter(d => d.valeur !== null) as { annee: number; valeur: number }[]);
    if (!allData.length) return;

    // ── Détection double axe (magnitudes très différentes) ──
    const serieRanges = series.map(s => {
      const vals = s.data.filter(d => d.valeur !== null).map(d => d.valeur as number);
      const mn = d3.min(vals) ?? 0;
      const mx = d3.max(vals) ?? 1;
      return { mn, mx, span: mx - mn };
    });
    const spanRatio = Math.max(...serieRanges.map(r => r.span)) / Math.max(1, Math.min(...serieRanges.map(r => r.span)));
    const useDual = dualAxis === false ? false : (type === "line" && series.length >= 2 && spanRatio > 4);

    const M = { top: 12, right: useDual ? 58 : 20, bottom: 34, left: 64 };
    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");

    const allAnnees = [...new Set(allData.map(d => d.annee))].sort((a, b) => a - b);

    const buildScale = (mn: number, mx: number, forBar: boolean) => {
      const pad = (mx - mn) * 0.08;
      const lo = forBar ? Math.min(0, mn) : mn - pad;
      return d3.scaleLinear().domain([lo, mx * 1.08]).nice().range([H - M.bottom, M.top]);
    };
    const yScales = useDual
      ? series.map((_, i) => buildScale(serieRanges[i].mn, serieRanges[i].mx, false))
      : (() => {
          const rawMin = d3.min(allData, d => d.valeur)!;
          const maxVal = d3.max(allData, d => d.valeur)!;
          const shared = buildScale(rawMin, maxVal, type === "bar");
          return series.map(() => shared);
        })();
    const y = yScales[0];

    const xBand = d3.scaleBand().domain(allAnnees.map(String)).range([M.left, W - M.right]).padding(0.18);
    const xLin = d3.scaleLinear().domain([allAnnees[0], allAnnees[allAnnees.length - 1]]).range([M.left, W - M.right]);

    svg.append("g").selectAll("line").data(y.ticks(4)).enter().append("line")
      .attr("x1", M.left).attr("x2", W - M.right).attr("y1", d => y(d)).attr("y2", d => y(d))
      .attr("stroke", "#EBEBEB").attr("stroke-width", 1);

    if (y.domain()[0] < 0)
      svg.append("line").attr("x1", M.left).attr("x2", W - M.right).attr("y1", y(0)).attr("y2", y(0))
        .attr("stroke", "#C5BFBB").attr("stroke-width", 1.2).attr("stroke-dasharray", "4,3");

    const tooltip = d3.select("#d3-tooltip") as any;
    const fmtAxis = (v: d3.NumberValue) => fmtAxe(+v);
    const defs = svg.append("defs");

    // ── BARRES (comportement existant conservé, entrée en croissance) ──
    if (type === "bar") {
      const nbSeries = series.length;
      const xGroup = nbSeries > 1
        ? d3.scaleBand().domain(series.map(s => s.nom)).range([0, xBand.bandwidth()]).padding(0.06)
        : null;

      series.forEach((s, si) => {
        const ys = yScales[si];
        const valid = s.data.filter(d => d.valeur !== null) as { annee: number; valeur: number }[];
        if (!valid.length) return;
        const getX = (d: { annee: number }) => { const base = xBand(String(d.annee))!; return xGroup ? base + xGroup(s.nom)! : base; };
        const getW = () => xGroup ? xGroup.bandwidth() : xBand.bandwidth();
        const rects = svg.selectAll(`.b${s.nom.replace(/\W/g, "")}`)
          .data(valid).enter().append("rect")
          .attr("x", d => getX(d)).attr("width", getW())
          .attr("y", d => d.valeur >= 0 ? ys(d.valeur) : ys(0))
          .attr("height", d => Math.abs(ys(d.valeur) - ys(0)))
          .attr("fill", s.couleur).style("cursor", "pointer")
          .on("mouseover", (e, d) => {
            d3.select(e.currentTarget as SVGRectElement).attr("opacity", 0.75);
            montrerTooltip(tooltip, e, `<strong>${fmtXv(d.annee)}${nbSeries > 1 ? " — " + s.nom : ""}</strong><br/>${fmtV(d.valeur)}`);
          })
          .on("mousemove", (e) => montrerTooltip(tooltip, e))
          .on("mouseout", (e) => { d3.select(e.currentTarget as SVGRectElement).attr("opacity", 1); cacherTooltip(tooltip); });
        void rects;
      });

      const maxTicks = Math.floor((W - M.left - M.right) / 28);
      const step = Math.ceil(allAnnees.length / maxTicks);
      const tickVals = allAnnees.filter((_, i) => i % step === 0).map(String);
      svg.append("g").attr("transform", `translate(0,${H - M.bottom})`)
        .call(d3.axisBottom(xBand).tickValues(tickVals).tickFormat((t: any) => fmtXv(Number(t))).tickSizeOuter(0))
        .call(g => g.select(".domain").attr("stroke", "#E8E5E3"))
        .call(g => g.selectAll("line").remove())
        .call(g => g.selectAll("text").style("fill", "#9aa5b4").style("font-size", "10px"));

    // ── COURBES SIGNATURE ──
    } else {
      const epaisseur = lineWidth ?? (series.length === 1 ? 2.6 : 2.2);
      // Filtres partagés : ombre portée et glow
      const idOmbre = `${uid}-ombre`, idGlow = `${uid}-glow`;
      const fOmbre = defs.append("filter").attr("id", idOmbre).attr("x", "-40%").attr("y", "-40%").attr("width", "180%").attr("height", "220%");
      fOmbre.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", 4);
      const fGlow = defs.append("filter").attr("id", idGlow).attr("x", "-40%").attr("y", "-40%").attr("width", "180%").attr("height", "220%");
      fGlow.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", 3);

      series.forEach((s, si) => {
        const ys = yScales[si];
        const valid = s.data.filter(d => d.valeur !== null) as { annee: number; valeur: number }[];
        if (!valid.length) return;

        // Courbe en pointillés = ligne de référence épurée (ni aire, ni halo, ni glow)
        const pointille = !!s.dash;
        const montrerAire = s.aire ?? !pointille;

        const areaBase = ys(Math.max(ys.domain()[0], 0));
        const gid = `${uid}-a${si}`;
        const grad = defs.append("linearGradient").attr("id", gid).attr("x1", "0").attr("x2", "0").attr("y1", "0").attr("y2", "1");
        grad.append("stop").attr("offset", "0%").attr("stop-color", s.couleur).attr("stop-opacity", 0.28);
        grad.append("stop").attr("offset", "55%").attr("stop-color", s.couleur).attr("stop-opacity", 0.07);
        grad.append("stop").attr("offset", "100%").attr("stop-color", s.couleur).attr("stop-opacity", 0);

        const dAire = d3.area<{ annee: number; valeur: number }>()
          .x(d => xLin(d.annee)).y0(areaBase).y1(d => ys(d.valeur)).curve(d3.curveMonotoneX)(valid) || "";
        const dLigne = d3.line<{ annee: number; valeur: number }>()
          .x(d => xLin(d.annee)).y(d => ys(d.valeur)).curve(d3.curveMonotoneX)(valid) || "";
        // Aire en dégradé riche
        if (montrerAire) svg.append("path").attr("fill", `url(#${gid})`).attr("d", dAire);
        if (!pointille) {
          // Ombre portée de la ligne
          svg.append("path").attr("fill", "none")
            .attr("stroke", s.couleur).attr("stroke-width", epaisseur + 0.5)
            .attr("stroke-linejoin", "round").attr("stroke-linecap", "round")
            .attr("transform", "translate(0,6)").attr("filter", `url(#${idOmbre})`).attr("opacity", 0.22)
            .attr("d", dLigne);
          // Glow
          svg.append("path").attr("fill", "none")
            .attr("stroke", s.couleur).attr("stroke-width", epaisseur * 3.2)
            .attr("stroke-linejoin", "round").attr("stroke-linecap", "round")
            .attr("filter", `url(#${idGlow})`).attr("opacity", 0.14)
            .attr("d", dLigne);
        }
        // La ligne
        svg.append("path").attr("fill", "none")
          .attr("stroke", s.couleur).attr("stroke-width", pointille ? Math.max(1.6, epaisseur - 0.4) : epaisseur)
          .attr("stroke-linejoin", "round").attr("stroke-linecap", pointille ? "butt" : "round")
          .attr("stroke-dasharray", s.dash || null)
          .attr("opacity", pointille ? 0.85 : 1)
          .attr("d", dLigne);

        if (!pointille) {
          // Point terminal souligné d'un halo
          const fin = valid[valid.length - 1];
          const gFin = svg.append("g");
          gFin.append("circle").attr("cx", xLin(fin.annee)).attr("cy", ys(fin.valeur)).attr("r", 7)
            .attr("fill", s.couleur).attr("opacity", 0.3).attr("filter", `url(#${idGlow})`);
          gFin.append("circle").attr("cx", xLin(fin.annee)).attr("cy", ys(fin.valeur)).attr("r", 3.6)
            .attr("fill", s.couleur).attr("stroke", "#fff").attr("stroke-width", 1.6);

          // Points décoratifs
          const nb = valid.length;
          const rBase = nb > 25 ? 0 : nb > 18 ? 1.5 : nb > 10 ? 2 : 2.5;
          if (showDots && rBase > 0) {
            svg.selectAll(`.p${gid}`).data(valid).enter().append("circle")
              .attr("cx", d => xLin(d.annee)).attr("cy", d => ys(d.valeur)).attr("r", rBase)
              .attr("fill", "#fff").attr("stroke", s.couleur).attr("stroke-width", 1.5)
              .style("pointer-events", "none");
          }
        }
      });

      // ── Annotation signature : pic historique (mono-série) ──
      let gPic: any = null;
      if (series.length === 1) {
        const valid = series[0].data.filter(d => d.valeur !== null) as { annee: number; valeur: number }[];
        if (valid.length >= 3) {
          const pic = valid.reduce((m, p) => (p.valeur > m.valeur ? p : m));
          const px = xLin(pic.annee), py = yScales[0](pic.valeur);
          gPic = svg.append("g");
          gPic.append("circle").attr("cx", px).attr("cy", py).attr("r", 7.5)
            .attr("fill", series[0].couleur).attr("opacity", 0.2).attr("filter", `url(#${idGlow})`);
          gPic.append("circle").attr("cx", px).attr("cy", py).attr("r", 4.5)
            .attr("fill", "none").attr("stroke", series[0].couleur).attr("stroke-width", 1.7);
          const libelle = `PIC · ${fmtXv(pic.annee)}`;
          const lw = libelle.length * 6.4 + 16;
          const cx = Math.min(Math.max(px - lw / 2, M.left), W - M.right - lw);
          const cy = Math.max(2, py - 30);
          const chip = gPic.append("g");
          chip.append("rect").attr("x", cx).attr("y", cy).attr("rx", 9).attr("width", lw).attr("height", 18)
            .attr("fill", "#fff").attr("stroke", "rgba(0,30,60,0.16)").attr("stroke-width", 0.75)
            .attr("filter", `drop-shadow(0 3px 6px rgba(0,30,60,0.10))`);
          chip.append("text").attr("x", cx + lw / 2).attr("y", cy + 12.5).attr("text-anchor", "middle")
            .style("font-size", "8.5px").style("font-weight", "700").style("letter-spacing", "0.8px")
            .attr("fill", series[0].couleur).text(libelle);
        }
      }

      // ── Curseur aimanté : ligne + points + tooltip avec delta ──
      const gCurseur = svg.append("g").style("display", "none");
      const ligneCurseur = gCurseur.append("line")
        .attr("y1", M.top).attr("y2", H - M.bottom)
        .attr("stroke", "rgba(26,26,46,0.30)").attr("stroke-width", 1).attr("stroke-dasharray", "3,3");
      const pointsCurseur = series.map(s => {
        const g = gCurseur.append("g");
        g.append("circle").attr("r", 7.5).attr("fill", s.couleur).attr("opacity", 0.25).attr("filter", `url(#${idGlow})`);
        g.append("circle").attr("r", 4.2).attr("fill", s.couleur).attr("stroke", "#fff").attr("stroke-width", 1.8);
        return g;
      });

      let derniereAnnee: number | null = null;
      const viser = (e: any) => {
        const [mx] = d3.pointer(e, el);
        let annee = allAnnees[0];
        for (const a of allAnnees) if (Math.abs(xLin(a) - mx) < Math.abs(xLin(annee) - mx)) annee = a;
        const px = xLin(annee);
        const magnetique = derniereAnnee !== null && derniereAnnee !== annee;
        gCurseur.style("display", null);
        if (gPic) gPic.attr("opacity", 0);
        // Aimantation : la ligne saute à l'année (transition courte = le cran)
        const cibleLigne: any = magnetique ? ligneCurseur.transition().duration(90).ease(d3.easeCubicOut) : ligneCurseur;
        cibleLigne.attr("x1", px).attr("x2", px);
        const lignesTooltip: string[] = [];
        series.forEach((s, si) => {
          const v = s.data.find(d => d.annee === annee)?.valeur ?? null;
          const g = pointsCurseur[si];
          if (v === null) { g.style("display", "none"); return; }
          g.style("display", null);
          const ciblePoint: any = magnetique ? g.transition().duration(90).ease(d3.easeCubicOut) : g;
          ciblePoint.attr("transform", `translate(${px},${yScales[si](v)})`);
          // Delta vs l'année précédente disponible de la série
          const avant = s.data.filter(d => d.valeur !== null && d.annee < annee) as { annee: number; valeur: number }[];
          const prec = avant.length ? avant.reduce((m, d) => (d.annee > m.annee ? d : m)) : null;
          const delta = prec && prec.valeur !== 0 ? (v - prec.valeur) / Math.abs(prec.valeur) * 100 : null;
          const deltaHtml = delta === null ? "" :
            `<span style="color:${delta >= 0 ? "#7FE0A7" : "#FCA5A5"};font-weight:700;font-size:11px"> ${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</span>`;
          lignesTooltip.push(
            `<span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${s.couleur};margin-right:6px"></span>` +
            `${series.length > 1 ? s.nom + " · " : ""}<strong>${fmtV(v)}</strong>${deltaHtml}`);
        });
        derniereAnnee = annee;
        montrerTooltip(tooltip, e, `<strong>${fmtXv(annee)}</strong><br/>${lignesTooltip.join("<br/>")}`);
      };
      svg.append("rect")
        .attr("x", M.left).attr("y", M.top)
        .attr("width", Math.max(0, W - M.left - M.right)).attr("height", Math.max(0, H - M.top - M.bottom))
        .attr("fill", "transparent").style("cursor", "crosshair")
        .on("mousemove", viser)
        .on("mouseleave", () => {
          derniereAnnee = null;
          gCurseur.style("display", "none");
          if (gPic) gPic.transition().duration(200).attr("opacity", 1);
          cacherTooltip(tooltip);
        });

      // Ticks années entières, plafonnées
      const maxTicksLine = Math.max(2, Math.min(7, Math.floor((W - M.left - M.right) / 42)));
      let tickAnnees = allAnnees;
      if (allAnnees.length > maxTicksLine) {
        const stepA = Math.ceil((allAnnees.length - 1) / (maxTicksLine - 1));
        tickAnnees = allAnnees.filter((_, i) => i % stepA === 0);
        const last = allAnnees[allAnnees.length - 1];
        if (tickAnnees[tickAnnees.length - 1] !== last) tickAnnees.push(last);
      }
      svg.append("g").attr("transform", `translate(0,${H - M.bottom})`)
        .call(d3.axisBottom(xLin).tickValues(tickAnnees).tickFormat(fmtX ? ((d: any) => fmtXv(Number(d))) : d3.format("d")).tickSizeOuter(0))
        .call(g => g.select(".domain").attr("stroke", "#E8E5E3"))
        .call(g => g.selectAll("line").remove())
        .call(g => g.selectAll("text").style("fill", "#9aa5b4").style("font-size", "10px"));
    }

    // ── Axe Y gauche (série 0) ──
    svg.append("g").attr("transform", `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(fmtAxis))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").remove())
      .call(g => g.selectAll("text").style("fill", useDual ? series[0].couleur : "#9aa5b4").style("font-size", "10px").style("font-weight", useDual ? "600" : "400"));

    // ── Axe Y droit (série 1) si double axe ──
    if (useDual) {
      svg.append("g").attr("transform", `translate(${W - M.right},0)`)
        .call(d3.axisRight(yScales[1]).ticks(4).tickFormat(fmtAxis))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").remove())
        .call(g => g.selectAll("text").style("fill", series[1].couleur).style("font-size", "10px").style("font-weight", "600"));
    }
  }, [pret, series, type, height, fmtV, showDots, lineWidth]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => { draw(); }, [draw]);

  // Libellé accessible du graphe : noms de séries + bornes d'années disponibles
  const nomsSeries = series.map(s => s.nom).filter(Boolean);
  const anneesValides = series.flatMap(s => s.data.filter(d => d.valeur !== null).map(d => d.annee));
  const libelleGraphe = nomsSeries.length
    ? `${type === "bar" ? "Barres" : "Courbes"} : ${nomsSeries.join(", ")}${anneesValides.length ? ` — ${Math.min(...anneesValides)} à ${Math.max(...anneesValides)}` : ""}`
    : "Graphique";

  return (
    <div ref={wrapRef} style={{ position: "relative" as const }}>
      <svg ref={ref} role="img" aria-label={libelleGraphe} style={{ width: "100%", height, display: "block" }} />
    </div>
  );
}
