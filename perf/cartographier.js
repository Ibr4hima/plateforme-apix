// Banc de mesure — la carte des requêtes de chaque page.
//
//     node perf/cartographier.js http://127.0.0.1:3200 perf/pages.json
//
// Ouvre chaque page du site construit, puis chacun de ses onglets et boutons
// segmentés, et relève les appels que la page fait à l'API : exactement ceux
// qu'un agent déclenche en ouvrant la page. Les écritures sont bloquées (tout
// appel autre que GET est annulé) : la carte se dresse sans rien modifier.
const { chromium } = require("playwright");
const fs = require("fs");

const SITE = process.argv[2] || "http://127.0.0.1:3200";
const SORTIE = process.argv[3] || "perf/pages.json";

// Les pages, et les vues qui ne s'ouvrent que par l'adresse
const TOUTES = [
  "/", "/tableau-de-bord", "/fiche-pays", "/fiche-pays?pays=FRA",
  "/ide", "/ide?section=projetes", "/ide?section=projetes&vue=projets", "/ide?section=projetes&vue=signaux",
  "/ide?section=projetes&vue=entreprises", "/ide/rapport", "/ide/rapport-signaux", "/ide/rapport-entreprises",
  "/statistiques", "/prospects", "/opportunites", "/entreprises", "/zones", "/accords", "/evenements",
  "/lexique", "/code-investissements",
  "/admin", "/admin/accords", "/admin/bdef", "/admin/classifications", "/admin/code-investissement",
  "/admin/commerce-exterieur", "/admin/entreprises", "/admin/evenements", "/admin/fdi", "/admin/fdi-projets",
  "/admin/geo", "/admin/gestion-zones", "/admin/ide", "/admin/lexique", "/admin/naema", "/admin/opportunites",
  "/admin/poles", "/admin/projets", "/admin/prospects", "/admin/ref-pays", "/admin/statistiques", "/admin/utilisateurs",
];

const attendreLeCalme = async (p, ms = 1500) => {
  await p.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(ms);
};

// --pages /a,/b : ne recartographie que ces pages, dans la carte existante
const choix = process.argv.find(a => a.startsWith("--pages="));
const PAGES = choix ? choix.slice(8).split(",") : TOUTES;

(async () => {
  const nav = await chromium.launch();
  const carte = choix && fs.existsSync(SORTIE) ? JSON.parse(fs.readFileSync(SORTIE, "utf8")) : {};
  for (const chemin of PAGES) {
    const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: "fr-FR" });
    const p = await ctx.newPage();
    const appels = new Set();
    await p.route("**/api/v1/**", route => {
      const r = route.request();
      if (r.method() !== "GET") return route.abort();
      appels.add(decodeURIComponent(r.url().replace(/^https?:\/\/[^/]+/, "")));
      return route.continue();
    });
    const debut = Date.now();
    await p.goto(SITE + chemin, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await attendreLeCalme(p, 2500);
    const premier = appels.size;
    const premierEcran = [...appels].sort();
    const calme = Math.round((Date.now() - debut) / 100) / 10;
    // Chaque onglet et chaque bouton segmenté, une fois
    const boutons = await p.locator('[role="tab"], .ds-segment, button[aria-pressed]').all();
    for (const b of boutons.slice(0, 30)) {
      if (!(await b.isVisible().catch(() => false))) continue;
      await b.click({ timeout: 2000 }).catch(() => {});
      await attendreLeCalme(p, 600);
    }
    carte[chemin] = { premier_ecran: premier, total: appels.size, secondes_jusqu_au_calme: calme,
      appels_premier_ecran: premierEcran, appels: [...appels].sort() };
    console.log(`${chemin.padEnd(42)} ${String(premier).padStart(3)} appels au premier écran, ${String(appels.size).padStart(3)} avec les onglets (${Math.round((Date.now() - debut) / 1000)} s)`);
    await ctx.close();
  }
  await nav.close();
  fs.writeFileSync(SORTIE, JSON.stringify(carte, null, 2));
  const tous = new Set(Object.values(carte).flatMap(c => c.appels));
  console.log(`\n${Object.keys(carte).length} pages, ${tous.size} adresses d'API distinctes → ${SORTIE}`);
})();
