// ── Export d'un graphe SVG (téléchargement SVG / PNG) ─────────────────────────
export function downloadSVG(svgEl: SVGSVGElement, filename: string) {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  // Fond blanc pour PNG
  const bg = document.createElementNS("http://www.w3.org/2000/svg","rect");
  bg.setAttribute("width","100%"); bg.setAttribute("height","100%"); bg.setAttribute("fill","white");
  clone.insertBefore(bg, clone.firstChild);
  const blob = new Blob([clone.outerHTML], {type:"image/svg+xml"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href=url; a.download=`${filename}.svg`; a.click();
  URL.revokeObjectURL(url);
}

export function downloadPNG(svgEl: SVGSVGElement, filename: string, opts?: { titre?: string; annees?: string; legende?: { nom: string; couleur: string }[] }) {
  const SCALE = 3; // suréchantillonnage : rendu net, identique au modal
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  const W = svgEl.viewBox.baseVal.width || 800;
  const H = svgEl.viewBox.baseVal.height || 400;
  // Dimensions explicites en pixels : sans elles le navigateur rastérise le SVG
  // à une taille par défaut puis l'agrandit, d'où une image floue.
  clone.removeAttribute("style");
  clone.setAttribute("width",  String(W * SCALE));
  clone.setAttribute("height", String(H * SCALE));
  clone.setAttribute("font-family", "'Google Sans','Product Sans',Arial,sans-serif");
  const blob = new Blob([clone.outerHTML], {type:"image/svg+xml"});
  const url  = URL.createObjectURL(blob);
  const img  = new Image();
  img.onload = () => {
    const PAD    = 26;
    const FONT   = "'Google Sans','Product Sans',Arial,sans-serif";
    const titre  = opts?.titre  || "";
    const annees = opts?.annees || "";
    const legende = opts?.legende || [];

    // ── Mesure du bandeau (titre + badge d'années + légende, avec retours à la ligne)
    const mctx = document.createElement("canvas").getContext("2d")!;
    let headerH = 0;
    const legLines: { nom: string; couleur: string; w: number }[][] = [];
    if (titre || legende.length) {
      headerH = PAD + 26;
      if (legende.length) {
        mctx.font = `700 11px ${FONT}`;
        const maxW = W - PAD * 2;
        let line: { nom: string; couleur: string; w: number }[] = []; let x = 0;
        legende.forEach(l => {
          const w = Math.ceil(mctx.measureText(l.nom).width) + 22;
          if (x + w > maxW && line.length) { legLines.push(line); line = []; x = 0; }
          line.push({ ...l, w }); x += w + 8;
        });
        if (line.length) legLines.push(line);
        headerH += 6 + legLines.length * 26;
      }
      headerH += 10;
    }

    const canvas = document.createElement("canvas");
    canvas.width = W * SCALE; canvas.height = (H + headerH) * SCALE;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(SCALE, SCALE);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H + headerH);

    if (headerH) {
      ctx.textBaseline = "middle";
      const ty = PAD + 12;
      // Badge d'années (réserve sa place à droite du titre)
      ctx.font = `700 11px ${FONT}`;
      const badgeW = annees ? Math.ceil(ctx.measureText(annees).width) + 20 : 0;
      // Titre, tronqué si besoin
      ctx.font = `700 16px ${FONT}`; ctx.fillStyle = "#1a1a2e";
      let t = titre;
      const maxTitre = W - PAD * 2 - (badgeW ? badgeW + 10 : 0);
      while (t && ctx.measureText(t).width > maxTitre) t = t.slice(0, -2);
      if (t !== titre) t += "…";
      ctx.fillText(t, PAD, ty);
      if (annees) {
        const bx = PAD + ctx.measureText(t).width + 10;
        ctx.fillStyle = "#ECEAE8";
        ctx.beginPath(); ctx.roundRect(bx, ty - 10, badgeW, 20, 999); ctx.fill();
        ctx.font = `700 11px ${FONT}`; ctx.fillStyle = "#4a5568";
        ctx.fillText(annees, bx + 10, ty + 0.5);
      }
      // Légende en pilules teintées, comme dans le modal
      let ly = PAD + 26 + 6 + 13;
      ctx.font = `700 11px ${FONT}`;
      legLines.forEach(line => {
        let lx = PAD;
        line.forEach(l => {
          ctx.fillStyle = l.couleur + "1F";
          ctx.beginPath(); ctx.roundRect(lx, ly - 10, l.w, 20, 999); ctx.fill();
          ctx.fillStyle = l.couleur;
          ctx.fillText(l.nom, lx + 11, ly + 0.5);
          lx += l.w + 8;
        });
        ly += 26;
      });
    }

    ctx.drawImage(img, 0, headerH, W, H);
    const a = document.createElement("a"); a.href=canvas.toDataURL("image/png"); a.download=`${filename}.png`; a.click();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}
