#!/usr/bin/env node
// Construit la page de la visionneuse PDF d'Android — src/components/pdf/pagePdf.ts —
// à partir du modèle (scripts/visionneuse-pdf/modele.html) et de pdf.js.
//
// pdf.js n'est pas une dépendance de l'app : il voyage dans la page, en ligne,
// et l'app n'a besoin d'aucun module natif pour lire un PDF (mise à jour OTA).
//
// usage :
//   npm pack pdfjs-dist@3.11.174 && tar -xzf pdfjs-dist-3.11.174.tgz
//   node scripts/visionneuse-pdf/construire.mjs package
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "3.11.174";
const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..", "..");

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage : node scripts/visionneuse-pdf/construire.mjs <dossier de pdfjs-dist>");
  process.exit(1);
}
const paquet = JSON.parse(readFileSync(join(dossier, "package.json"), "utf8"));
if (paquet.name !== "pdfjs-dist" || paquet.version !== VERSION) {
  console.error(`pdfjs-dist ${VERSION} attendu, trouvé ${paquet.name} ${paquet.version}`);
  process.exit(1);
}

const lire = fichier => readFileSync(join(dossier, "build", fichier), "utf8");
const pdf = lire("pdf.min.js");
const worker = lire("pdf.worker.min.js");
// Une balise </script> dans le code couperait la page en deux
for (const [nom, code] of [["pdf.min.js", pdf], ["pdf.worker.min.js", worker]]) {
  if (/<\/script/i.test(code)) {
    console.error(`${nom} contient « </script » : à échapper avant de l'insérer`);
    process.exit(1);
  }
}

const modele = readFileSync(join(ici, "modele.html"), "utf8");
// Remplacements par fonction : les « $ » du code minifié restent tels quels
const page = modele.replace("/*PDFJS*/", () => pdf).replace("/*PDFJS_WORKER*/", () => worker);
const empreinte = createHash("sha256").update(page).digest("hex").slice(0, 16);

const sortie = `// FICHIER GÉNÉRÉ — ne pas modifier à la main.
// La page de la visionneuse PDF d'Android : scripts/visionneuse-pdf/modele.html, avec
// pdf.js ${VERSION} (Mozilla, licence Apache 2.0) en ligne.
// Régénérer : node scripts/visionneuse-pdf/construire.mjs <dossier de pdfjs-dist ${VERSION}>
// Empreinte de la page : ${empreinte}
/* eslint-disable */
export const PAGE_PDF: string = ${JSON.stringify(page)};
`;
writeFileSync(join(racine, "src", "components", "pdf", "pagePdf.ts"), sortie);
console.log(`src/components/pdf/pagePdf.ts écrit — ${(sortie.length / 1024).toFixed(0)} Ko, empreinte ${empreinte}`);
