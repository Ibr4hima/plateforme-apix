// ── L'export d'un graphe en image (PNG) ──────────────────────────────────────
//
// Une image qu'on colle dans une note, un rapport ou une présentation : elle
// doit se suffire à elle-même, loin de la page. Elle est donc composée comme
// un graphique de publication, au format 16:9 :
//
//   Titre                                       — ce que montre le graphe
//   Sénégal · 1990–2025 · M$ USD                — sur quoi, quand, en quoi
//   ▬ Sénégal   ▬ Côte d'Ivoire                 — la légende, dès deux séries
//   [le graphe, redessiné à la taille de l'image]
//   ───────────────────────────────────────────
//   Source : CNUCED                             — sans source, pas de pied
//
// LE GRAPHE EST REDESSINÉ, pas photographié. La carte de la page fait 1 300 px
// de large pour 240 de haut : recopiée telle quelle, elle donnait une bande
// étirée, illisible une fois réduite dans une diapositive. Le graphe des
// séries (GrapheMultiPays) sait se redessiner à la taille demandée ; un autre
// graphe, qui ne le sait pas, est repris tel quel et mis à l'échelle.
//
// UNE SEULE POLICE, CELLE DE LA PLATEFORME. Un SVG chargé comme image ne voit
// pas les polices du document : les graduations sortaient en Arial sous un
// titre en Google Sans. La police de la page est donc embarquée dans l'image.
//
// LES COULEURS SONT FIGÉES. Les graphes portent leurs couleurs en var(--…),
// les jetons de la palette ; un SVG détaché de la page n'y a plus accès, et
// tout ressortirait en noir. On recopie donc les couleurs CALCULÉES.

const SVG_NS = "http://www.w3.org/2000/svg";

/** Ce qu'un graphe expose pour être redessiné à la taille de l'image : un SVG
    monté hors de l'écran (ses couleurs et sa police s'y résolvent), et de quoi
    le retirer une fois copié. */
export type ExporteurGraphe = (largeur: number, hauteur: number) => { svg: SVGSVGElement; liberer: () => void };

// Le format : 1 200 × 675 (16:9), rendu à deux pixels par point
const LARGEUR = 1200, HAUTEUR = 675, MARGE = 56, ECHELLE = 2;
const ENCRE = "#1a1a2e", GRIS = "#6b7280", FILET = "#E6E6E9";

const PROPS_COULEUR = ["fill", "stroke", "stop-color", "color"] as const;

/** Recopie sur le clone les couleurs résolues de l'original. */
function figerCouleurs(source: SVGSVGElement, clone: SVGSVGElement) {
  const origines = [source, ...source.querySelectorAll<SVGElement>("*")];
  const copies = [clone, ...clone.querySelectorAll<SVGElement>("*")];
  origines.forEach((el, i) => {
    const copie = copies[i];
    if (!copie) return;
    const calcule = getComputedStyle(el);
    for (const prop of PROPS_COULEUR) {
      const v = calcule.getPropertyValue(prop);
      if (v && v !== "none") copie.style.setProperty(prop, v);
    }
  });
}

/**
 * La valeur d'une couleur qui peut être un var(--…) — pour ce qui ne sait pas
 * les lire (un canevas, une image détachée).
 */
export function couleurFigee(couleur: string): string {
  if (!couleur || !couleur.includes("var(")) return couleur;
  const sonde = document.createElement("span");
  sonde.style.cssText = `display:none;color:${couleur}`;
  document.body.appendChild(sonde);
  const v = getComputedStyle(sonde).color;
  sonde.remove();
  return v || couleur;
}

const echapper = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const enDataUrl = (b: Blob) => new Promise<string>((ok, ko) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => ko(r.error);
  r.readAsDataURL(b);
});

/** La police de la page, prête à embarquer : son nom, et ses @font-face en
    données (le jeu latin suffit au français). Sans elle, l'image retombe sur
    une police du système — lisible, mais étrangère à la plateforme. */
async function policeDeLaPage(): Promise<{ famille: string; css: string }> {
  const famille = (getComputedStyle(document.body).fontFamily.split(",")[0] || "").trim().replace(/^["']|["']$/g, "");
  if (!famille) return { famille: "Arial", css: "" };
  const regles: CSSFontFaceRule[] = [];
  for (const feuille of Array.from(document.styleSheets)) {
    let liste: CSSRuleList;
    try { liste = feuille.cssRules; } catch { continue; }
    for (const r of Array.from(liste)) {
      if (!(r instanceof CSSFontFaceRule)) continue;
      const f = r.style.getPropertyValue("font-family").trim().replace(/^["']|["']$/g, "");
      const plage = r.style.getPropertyValue("unicode-range");
      if (f === famille && (!plage || /U\+0{1,4}-0{0,2}FF\b/i.test(plage))) regles.push(r);
    }
  }
  const morceaux = await Promise.all(regles.map(async r => {
    const relative = /url\(["']?([^"')]+)["']?\)/.exec(r.style.getPropertyValue("src"))?.[1];
    if (!relative) return "";
    try {
      // L'adresse est relative à la FEUILLE DE STYLE (« ../media/… »), pas à
      // la page : résolue contre la page, elle tombait en 404
      const url = new URL(relative, r.parentStyleSheet?.href || document.baseURI).href;
      const reponse = await fetch(url);
      if (!reponse.ok) return "";
      const donnees = await enDataUrl(await reponse.blob());
      const graisse = r.style.getPropertyValue("font-weight") || "400";
      return `@font-face{font-family:"${famille}";font-style:normal;font-weight:${graisse};src:url(${donnees}) format("woff2");}`;
    } catch { return ""; }
  }));
  return { famille, css: morceaux.join("") };
}

/** Un texte trop long pour sa ligne passe à la ligne au mot, sur `max` lignes
    au plus ; la dernière se termine alors par « … ». */
function couper(texte: string, largeurMax: number, mesure: (t: string) => number, max = 2): string[] {
  const mots = texte.split(/\s+/);
  const lignes: string[] = [];
  let ligne = "";
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (mesure(essai) <= largeurMax || !ligne) ligne = essai;
    else { lignes.push(ligne); ligne = mot; }
  }
  if (ligne) lignes.push(ligne);
  if (lignes.length <= max) return lignes;
  const gardees = lignes.slice(0, max);
  let derniere = gardees[max - 1];
  while (derniere && mesure(`${derniere}…`) > largeurMax) derniere = derniere.slice(0, -1);
  gardees[max - 1] = `${derniere.trimEnd()}…`;
  return gardees;
}

/** Un nom de fichier lisible : « flux-entrants-senegal-1990-2025.png ». */
export function nomDeFichier(...morceaux: (string | null | undefined)[]): string {
  const s = morceaux.filter(Boolean).join(" ")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return s.slice(0, 90) || "graphe";
}

/**
 * Ce que l'image dit d'elle-même : le titre, la ligne de contexte (la série
 * quand elle est seule et que le titre ne la nomme pas, la période, l'unité,
 * une note), la légende dès deux séries, la source.
 */
export function enteteExport({ titre, series, periode, unite, note, source }: {
  titre: string;
  series?: { nom: string; couleur: string }[];
  periode?: string;
  unite?: string;
  note?: string;
  source?: string;
}) {
  const visibles = series || [];
  const seule = visibles.length === 1 && visibles[0].nom
    && visibles[0].nom.trim().toLowerCase() !== titre.trim().toLowerCase() ? visibles[0].nom : null;
  return {
    titre,
    sousTitre: [seule, periode, unite, note].filter(Boolean).join(" · "),
    legende: visibles.length > 1 ? visibles : [],
    source,
    fichier: nomDeFichier(titre, seule, periode),
  };
}

/**
 * Télécharge le graphe en PNG, composé comme décrit en tête de ce fichier.
 * `svgVivant` est le SVG affiché : s'il sait se redessiner (GrapheMultiPays),
 * il l'est à la taille de l'image ; sinon il est repris et mis à l'échelle.
 */
export async function downloadPNG(svgVivant: SVGSVGElement, nomFichier: string, opts: {
  titre: string;
  sousTitre?: string;
  legende?: { nom: string; couleur: string }[];
  source?: string;
}) {
  const { famille, css } = await policeDeLaPage();
  const ctx = document.createElement("canvas").getContext("2d");
  const mesurer = (taille: number, graisse: number) => (t: string) => {
    if (!ctx) return t.length * taille * 0.55;
    ctx.font = `${graisse} ${taille}px "${famille}", Arial, sans-serif`;
    return ctx.measureText(t).width;
  };
  const largeurUtile = LARGEUR - 2 * MARGE;
  const texte = (t: string, x: number, y: number, taille: number, graisse: number, couleur: string, ancre = "start") =>
    `<text x="${x}" y="${y}" font-size="${taille}" font-weight="${graisse}" fill="${couleur}" text-anchor="${ancre}">${echapper(t)}</text>`;

  // ── L'en-tête : titre, contexte, légende ──
  const morceaux: string[] = [];
  let y = MARGE;
  couper(opts.titre, largeurUtile, mesurer(26, 700)).forEach((l, i) => {
    y += i === 0 ? 24 : 33;
    morceaux.push(texte(l, MARGE, y, 26, 700, ENCRE));
  });
  if (opts.sousTitre) {
    y += 28;
    morceaux.push(texte(couper(opts.sousTitre, largeurUtile, mesurer(15, 400), 1)[0], MARGE, y, 15, 400, GRIS));
  }
  const legende = opts.legende || [];
  if (legende.length) {
    y += 34;
    let x = MARGE;
    const mesureNom = mesurer(13.5, 500);
    for (const s of legende) {
      const w = 22 + mesureNom(s.nom);
      if (x > MARGE && x + w > LARGEUR - MARGE) { x = MARGE; y += 24; }
      morceaux.push(`<rect x="${x}" y="${y - 6}" width="15" height="3" rx="1.5" fill="${couleurFigee(s.couleur)}"/>`);
      morceaux.push(texte(s.nom, x + 22, y, 13.5, 500, "#4a5568"));
      x += w + 26;
    }
  }
  y += 26;

  // ── Le pied, posé en bas de l'image : la source seulement ; sans source,
  // pas de pied, et le graphe prend la place ──
  const hautPied = opts.source ? HAUTEUR - MARGE + 6 : HAUTEUR - MARGE / 2;
  const hauteurGraphe = Math.max(220, hautPied - (opts.source ? 30 : 0) - y);

  // ── Le graphe, redessiné à sa place, ou repris et mis à l'échelle ──
  const exporteur = (svgVivant as SVGSVGElement & { __exporter?: ExporteurGraphe }).__exporter;
  let source = svgVivant, liberer = () => {};
  if (exporteur) ({ svg: source, liberer } = exporteur(largeurUtile, hauteurGraphe));
  const clone = source.cloneNode(true) as SVGSVGElement;
  figerCouleurs(source, clone);
  liberer();
  const vb = clone.viewBox?.baseVal;
  const lc = vb?.width || svgVivant.clientWidth || largeurUtile;
  const hc = vb?.height || svgVivant.clientHeight || hauteurGraphe;
  // Repris tel quel : il garde ses proportions et se centre dans la zone
  const ech = exporteur ? 1 : Math.min(largeurUtile / lc, hauteurGraphe / hc);
  const lAff = lc * ech, hAff = hc * ech;
  clone.removeAttribute("style");
  clone.removeAttribute("role");
  clone.setAttribute("x", String(MARGE + (largeurUtile - lAff) / 2));
  clone.setAttribute("y", String(y));
  clone.setAttribute("width", String(lAff));
  clone.setAttribute("height", String(hAff));
  clone.setAttribute("viewBox", `0 0 ${lc} ${hc}`);
  morceaux.push(new XMLSerializer().serializeToString(clone));

  if (opts.source) {
    morceaux.push(`<line x1="${MARGE}" x2="${LARGEUR - MARGE}" y1="${hautPied}" y2="${hautPied}" stroke="${FILET}" stroke-width="1"/>`);
    morceaux.push(texte(`Source : ${opts.source}`, MARGE, hautPied + 30, 12.5, 400, GRIS));
  }

  const svgTexte = `<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="${LARGEUR}" height="${HAUTEUR}" viewBox="0 0 ${LARGEUR} ${HAUTEUR}" font-family='"${famille}", Arial, sans-serif'>`
    + `<style>${css}</style><rect width="100%" height="100%" fill="#ffffff"/>${morceaux.join("")}</svg>`;

  // ── Rendu en PNG, à deux pixels par point ──
  const url = URL.createObjectURL(new Blob([svgTexte], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = LARGEUR * ECHELLE;
    canvas.height = HAUTEUR * ECHELLE;
    const c = canvas.getContext("2d");
    if (!c) return;
    c.scale(ECHELLE, ECHELLE);
    c.imageSmoothingQuality = "high";
    c.drawImage(img, 0, 0, LARGEUR, HAUTEUR);
    const png = await new Promise<Blob | null>(ok => canvas.toBlob(ok, "image/png"));
    if (!png) return;
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(png);
    lien.download = `${nomFichier}.png`;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
