"use client";

// Graphe multi-séries — courbes nettes : un trait, une aire dégradée, rien de plus
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

export default function GrapheMultiPays({ series, height = 280, type = "line", fmt, fmtX, showDots = true, lineWidth, dualAxis, epure }: {
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
  /** Vignette : seules la première et la dernière année en abscisse.
      Par défaut, déduit de la hauteur (moins de 200 px = vignette). */
  epure?: boolean;
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

    // La marge gauche n'est pas devinée : elle se MESURE sur la plus large
    // étiquette de l'axe. Une valeur fixe est forcément trop courte pour
    // « 25 000 » et trop large pour « 4k » — et c'est le second cas qui se
    // produisait, laissant un vide sur la gauche que rien ne compensait à
    // droite. Le graphe s'y trouve maintenant centré dans sa carte.
    // Une vignette de carte garde ses ordonnées — on y lit des montants —,
    // mais pas les graduations d'années intermédiaires : à cette taille elles
    // se chevauchent sans rien apprendre, quand les deux bornes suffisent à
    // dire la période. Le seuil suit la hauteur : moins de 200 px, c'est une
    // vignette.
    const epureEff = epure ?? (H < 200);
    const M: { top: number; right: number; bottom: number; left: number } = { top: 12, right: useDual ? 58 : 22, bottom: 34, left: 64 };
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

    // d3 pose l'étiquette à 9 px à gauche de l'axe, alignée à droite : il faut
    // sa largeur, plus ce décalage, plus un peu d'air.
    const largeurEtiquette = (valeurs: number[]) => {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) return 30;
      ctx.font = "10px 'Google Sans', 'Product Sans', Arial, sans-serif";
      return Math.max(...valeurs.map(v => ctx.measureText(fmtAxe(v)).width));
    };
    M.left = Math.round(Math.max(26, largeurEtiquette(y.ticks(4)) + 13));
    if (useDual) M.right = Math.round(Math.max(26, largeurEtiquette(yScales[1].ticks(4)) + 13));
    else if (epureEff) M.right = 14;

    const xBand = d3.scaleBand().domain(allAnnees.map(String)).range([M.left, W - M.right]).padding(0.18);
    const xLin = d3.scaleLinear().domain([allAnnees[0], allAnnees[allAnnees.length - 1]]).range([M.left, W - M.right]);

    svg.append("g").selectAll("line").data(y.ticks(4)).enter().append("line")
      .attr("x1", M.left).attr("x2", W - M.right).attr("y1", d => y(d)).attr("y2", d => y(d))
      .style("stroke", "var(--grille)").attr("stroke-width", 1);

    if (y.domain()[0] < 0)
      svg.append("line").attr("x1", M.left).attr("x2", W - M.right).attr("y1", y(0)).attr("y2", y(0))
        .style("stroke", "var(--bordure-forte)").attr("stroke-width", 1.2).attr("stroke-dasharray", "4,3");

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
          .style("fill", s.couleur).style("cursor", "pointer")
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
      const tickVals = epureEff && allAnnees.length > 1
        ? [String(allAnnees[0]), String(allAnnees[allAnnees.length - 1])]
        : allAnnees.filter((_, i) => i % step === 0).map(String);
      svg.append("g").attr("transform", `translate(0,${H - M.bottom})`)
        .call(d3.axisBottom(xBand).tickValues(tickVals).tickFormat((t: any) => fmtXv(Number(t))).tickSizeOuter(0))
        .call(g => g.select(".domain").style("stroke", "var(--bordure-forte)"))
        .call(g => g.selectAll("line").remove())
        .call(g => g.selectAll("text").style("fill", "var(--gris)").style("font-size", "10px"));

    // ── COURBES SIGNATURE ──
    } else {
      const epaisseur = lineWidth ?? (series.length === 1 ? 2.6 : 2.2);
      // Ni ombre portée ni halo : la courbe se lit à son tracé. Les deux
      // filtres gaussiens qui la doublaient épaississaient visuellement le
      // trait de trois fois sa largeur et brouillaient les inflexions — c'est
      // précisément ce qu'on demande à un graphe de montrer.

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
        grad.append("stop").attr("offset", "0%").style("stop-color", s.couleur).attr("stop-opacity", 0.22);
        grad.append("stop").attr("offset", "55%").style("stop-color", s.couleur).attr("stop-opacity", 0.05);
        grad.append("stop").attr("offset", "100%").style("stop-color", s.couleur).attr("stop-opacity", 0);

        // ── Trame demi-teinte ────────────────────────────────────────────────
        // La matière des graphiques éditoriaux : des points d'impression dans
        // l'aire, serrés sous la courbe, qui s'évanouissent vers la base. Le
        // motif est un pattern SVG tourné à 45° (l'angle des trames offset) ;
        // le fondu vient d'un masque en dégradé vertical, pas de l'opacité des
        // points — c'est lui qui donne le « grain qui se dissout ». Tout vit
        // dans le SVG : l'export sérialise pattern et masque tels quels, et le
        // gel des couleurs (outilsExport) résout le jeton du point.
        const pid = `${uid}-t${si}`, mid = `${uid}-m${si}`;
        // Pas de 2,4 px : une trame fine et TRÈS serrée — c'est le grain qui
        // remplit l'aire, et sa finesse qui rend le dégradé de densité lisible
        // (de gros points en fondu font des taches ; des petits font une
        // matière).
        const pat = defs.append("pattern").attr("id", pid)
          .attr("width", 2.4).attr("height", 2.4)
          .attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)");
        pat.append("circle").attr("cx", 1.2).attr("cy", 1.2).attr("r", epureEff ? 0.5 : 0.58)
          .style("fill", s.couleur);

        const dAire = d3.area<{ annee: number; valeur: number }>()
          .x(d => xLin(d.annee)).y0(areaBase).y1(d => ys(d.valeur)).curve(d3.curveMonotoneX)(valid) || "";
        const dLigne = d3.line<{ annee: number; valeur: number }>()
          .x(d => xLin(d.annee)).y(d => ys(d.valeur)).curve(d3.curveMonotoneX)(valid) || "";

        // Le fondu de la trame suit LA COURBE, pas une hauteur globale : le
        // masque est un trait blanc épais qui longe la ligne, flouté, découpé
        // à l'aire. Sa luminance est maximale juste sous la courbe — où
        // qu'elle passe, pic ou creux — et se dissout avec la distance. Un
        // dégradé vertical unique ne sait pas faire ça : sous un creux, les
        // points naissaient déjà éteints.
        const hTrace = Math.max(30, H - M.top - M.bottom);
        const clipId = `${uid}-c${si}`, filtId = `${uid}-f${si}`;
        defs.append("clipPath").attr("id", clipId).append("path").attr("d", dAire);
        defs.append("filter").attr("id", filtId)
          .attr("x", "-40%").attr("y", "-120%").attr("width", "180%").attr("height", "340%")
          .append("feGaussianBlur").attr("stdDeviation", hTrace * 0.13);
        // Deux traits dans le masque : un cœur serré et net sous la courbe,
        // et une nappe large qui prolonge la dissolution presque jusqu'à la
        // base — c'est elle qui donne la descente de dégradé.
        const gMasque = defs.append("mask").attr("id", mid)
          .append("g").attr("clip-path", `url(#${clipId})`)
          .attr("filter", `url(#${filtId})`);
        gMasque.append("path").attr("d", dLigne)
          .attr("fill", "none").attr("stroke", "#fff")
          .attr("stroke-opacity", epureEff ? 0.55 : 0.64)
          .attr("stroke-width", hTrace * 1.5)
          .attr("stroke-linejoin", "round");
        gMasque.append("path").attr("d", dLigne)
          .attr("fill", "none").attr("stroke", "#fff")
          .attr("stroke-opacity", epureEff ? 0.82 : 0.94)
          .attr("stroke-width", hTrace * 0.55)
          .attr("stroke-linejoin", "round");
        // L'extinction au pied : un voile noir peint PAR-DESSUS les traits du
        // masque, transparent en haut de l'aire et presque opaque à sa base
        // (noir dans un masque = caché). C'est lui qui fait la descente du
        // dégradé : dense sous la courbe, dissous avant la ligne de base.
        const kgrad = defs.append("linearGradient").attr("id", `${mid}k`)
          .attr("x1", "0").attr("x2", "0").attr("y1", "0").attr("y2", "1");
        kgrad.append("stop").attr("offset", "0%").attr("stop-color", "#000").attr("stop-opacity", 0);
        kgrad.append("stop").attr("offset", "32%").attr("stop-color", "#000").attr("stop-opacity", 0.05);
        kgrad.append("stop").attr("offset", "58%").attr("stop-color", "#000").attr("stop-opacity", 0.22);
        kgrad.append("stop").attr("offset", "80%").attr("stop-color", "#000").attr("stop-opacity", 0.55);
        kgrad.append("stop").attr("offset", "100%").attr("stop-color", "#000").attr("stop-opacity", 0.95);
        d3.select(gMasque.node()!.parentNode as Element)
          .append("path").attr("d", dAire).attr("fill", `url(#${mid}k)`);

        // Aire : le dégradé pose la profondeur, la trame pose la matière
        if (montrerAire) {
          svg.append("path").style("fill", `url(#${gid})`).attr("d", dAire);
          svg.append("path").style("fill", `url(#${pid})`).attr("mask", `url(#${mid})`)
            .style("pointer-events", "none").attr("d", dAire);
        }
        // La ligne
        svg.append("path").style("fill", "none")
          .style("stroke", s.couleur).attr("stroke-width", pointille ? Math.max(1.6, epaisseur - 0.4) : epaisseur)
          .attr("stroke-linejoin", "round").attr("stroke-linecap", pointille ? "butt" : "round")
          .attr("stroke-dasharray", s.dash || null)
          .attr("opacity", pointille ? 0.85 : 1)
          .attr("d", dLigne);

        if (!pointille) {
          // Point terminal : un simple disque cerné de la couleur de carte
          const fin = valid[valid.length - 1];
          const gFin = svg.append("g");
          gFin.append("circle").attr("cx", xLin(fin.annee)).attr("cy", ys(fin.valeur)).attr("r", 3.6)
            .style("fill", s.couleur).style("stroke", "var(--carte)").attr("stroke-width", 1.6);

          // Points décoratifs
          const nb = valid.length;
          const rBase = nb > 25 ? 0 : nb > 18 ? 1.5 : nb > 10 ? 2 : 2.5;
          if (showDots && rBase > 0) {
            svg.selectAll(`.p${gid}`).data(valid).enter().append("circle")
              .attr("cx", d => xLin(d.annee)).attr("cy", d => ys(d.valeur)).attr("r", rBase)
              .style("fill", "var(--sur-bleu)").style("stroke", s.couleur).attr("stroke-width", 1.5)
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
          // Un anneau translucide, comme le point de survol — et non un halo
          // flouté. (Ce cercle avait perdu sa déclaration de remplissage lors
          // du nettoyage des filtres et retombait sur le noir par défaut.)
          gPic.append("circle").attr("cx", px).attr("cy", py).attr("r", 7.5)
            .style("fill", "none").style("stroke", series[0].couleur)
            .attr("stroke-width", 1.2).attr("opacity", 0.35);
          gPic.append("circle").attr("cx", px).attr("cy", py).attr("r", 4.5)
            .style("fill", "none").style("stroke", series[0].couleur).attr("stroke-width", 1.7);
          const libelle = `PIC · ${fmtXv(pic.annee)}`;
          const lw = libelle.length * 6.4 + 16;
          const cx = Math.min(Math.max(px - lw / 2, M.left), W - M.right - lw);
          const cy = Math.max(2, py - 30);
          const chip = gPic.append("g");
          chip.append("rect").attr("x", cx).attr("y", cy).attr("rx", 9).attr("width", lw).attr("height", 18)
            .style("fill", "var(--sur-bleu)").style("stroke", "rgb(var(--encre-rgb) / 0.16)").attr("stroke-width", 0.75)

          chip.append("text").attr("x", cx + lw / 2).attr("y", cy + 12.5).attr("text-anchor", "middle")
            .style("font-size", "8.5px").style("font-weight", "700").style("letter-spacing", "0.8px")
            .style("fill", series[0].couleur).text(libelle);
        }
      }

      // ── Curseur aimanté : ligne + points + tooltip avec delta ──
      const gCurseur = svg.append("g").style("display", "none");
      const ligneCurseur = gCurseur.append("line")
        .attr("y1", M.top).attr("y2", H - M.bottom)
        .style("stroke", "rgb(var(--encre-rgb) / 0.30)").attr("stroke-width", 1).attr("stroke-dasharray", "3,3");
      const pointsCurseur = series.map(s => {
        const g = gCurseur.append("g");
        // Un anneau translucide plutôt qu'un halo flouté : même rôle — signaler
        // le point visé — pour un tracé net.
        g.append("circle").attr("r", 7.5).style("fill", "none").style("stroke", s.couleur).attr("stroke-width", 1.5).attr("opacity", 0.35);
        g.append("circle").attr("r", 4.2).style("fill", s.couleur).style("stroke", "var(--carte)").attr("stroke-width", 1.8);
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
            `<span style="color:${delta >= 0 ? "var(--vert)" : "var(--danger-voile)"};font-weight:700;font-size:11px"> ${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</span>`;
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
        .style("fill", "transparent").style("cursor", "crosshair")
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
      // En vignette, les deux bornes suffisent : elles disent la période, et
      // les graduations intermédiaires ne se lisent pas à cette taille.
      if (epureEff && allAnnees.length > 1) tickAnnees = [allAnnees[0], allAnnees[allAnnees.length - 1]];
      else if (allAnnees.length > maxTicksLine) {
        const stepA = Math.ceil((allAnnees.length - 1) / (maxTicksLine - 1));
        tickAnnees = allAnnees.filter((_, i) => i % stepA === 0);
        const last = allAnnees[allAnnees.length - 1];
        if (tickAnnees[tickAnnees.length - 1] !== last) tickAnnees.push(last);
      }
      svg.append("g").attr("transform", `translate(0,${H - M.bottom})`)
        .call(d3.axisBottom(xLin).tickValues(tickAnnees).tickFormat(fmtX ? ((d: any) => fmtXv(Number(d))) : d3.format("d")).tickSizeOuter(0))
        .call(g => g.select(".domain").style("stroke", "var(--bordure-forte)"))
        .call(g => g.selectAll("line").remove())
        .call(g => g.selectAll("text").style("fill", "var(--gris)").style("font-size", "10px"));
    }

    // ── Axe Y gauche (série 0) ──
    svg.append("g").attr("transform", `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(fmtAxis))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").remove())
      .call(g => g.selectAll("text").style("fill", "var(--gris)").style("font-size", "10px"));

    // ── Axe Y droit (série 1) si double axe ──
    if (useDual) {
      svg.append("g").attr("transform", `translate(${W - M.right},0)`)
        .call(d3.axisRight(yScales[1]).ticks(4).tickFormat(fmtAxis))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").remove())
        .call(g => g.selectAll("text").style("fill", "var(--gris)").style("font-size", "10px"));
    }
  }, [pret, series, type, height, fmtV, showDots, lineWidth, epure]);

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
