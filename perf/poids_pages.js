// Banc de mesure — le poids des pages dans le navigateur.
//
//     node perf/poids_pages.js http://127.0.0.1:3200 perf/resultats/poids.json
//
// Pour chaque page principale, une seule personne, sans autre charge : le
// JavaScript et les données téléchargés, le nombre de requêtes, le plus grand
// affichage (LCP), le moment où le réseau se calme, et la mémoire JavaScript
// occupée par l'onglet.
const { chromium } = require("playwright");
const fs = require("fs");

const SITE = process.argv[2] || "http://127.0.0.1:3200";
const SORTIE = process.argv[3];
const PAGES = ["/", "/tableau-de-bord", "/ide", "/ide?section=projetes", "/statistiques", "/fiche-pays?pays=FRA",
  "/prospects", "/entreprises", "/opportunites", "/accords", "/evenements", "/zones", "/lexique", "/code-investissements"];

(async () => {
  const nav = await chromium.launch({ args: ["--enable-precise-memory-info"] });
  const res = {};
  for (const page of PAGES) {
    const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: "fr-FR" });
    const p = await ctx.newPage();
    await p.addInitScript(() => {
      window.__lcp = 0;
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
        .observe({ type: "largest-contentful-paint", buffered: true });
    });
    const debut = Date.now();
    await p.goto(SITE + page, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
    await p.waitForLoadState("networkidle", { timeout: 180000 }).catch(() => {});
    const calme = Date.now() - debut - 500; // networkidle attend 500 ms sans requête
    const m = await p.evaluate(() => {
      const r = performance.getEntriesByType("resource");
      const somme = f => r.filter(f).reduce((t, e) => t + (e.decodedBodySize || 0), 0);
      return {
        js_ko: Math.round(somme(e => e.name.endsWith(".js") || e.initiatorType === "script") / 1024),
        css_ko: Math.round(somme(e => e.name.endsWith(".css")) / 1024),
        donnees_ko: Math.round(somme(e => e.name.includes("/api/")) / 1024),
        requetes: r.length,
        requetes_api: r.filter(e => e.name.includes("/api/")).length,
        lcp_ms: Math.round(window.__lcp),
        memoire_js_mo: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
      };
    });
    res[page] = { ...m, reseau_calme_ms: calme };
    console.log(`${page.padEnd(24)} JS ${String(m.js_ko).padStart(5)} Ko | données ${String(m.donnees_ko).padStart(7)} Ko en ${String(m.requetes_api).padStart(3)} requêtes | LCP ${String(m.lcp_ms).padStart(5)} ms | réseau calme ${String(calme).padStart(6)} ms | mémoire ${m.memoire_js_mo} Mo`);
    await ctx.close();
  }
  await nav.close();
  if (SORTIE) fs.writeFileSync(SORTIE, JSON.stringify(res, null, 1));
})();
