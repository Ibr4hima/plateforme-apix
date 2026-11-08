// Copie dans public/pdfjs/ ce dont pdf.js a besoin à côté de son code : le
// « worker » qui décode les documents, les polices standard (documents qui
// n'embarquent pas leurs polices), les tables de caractères (CMaps), les
// décodeurs d'images en WebAssembly (JPEG 2000, fréquent dans les documents
// numérisés) et les profils de couleur ICC.
//
//   node outils/copier-pdfjs.mjs      (lancé par npm avant build et dev)
//
// Rien n'est versionné : public/pdfjs/ se refait depuis node_modules, à la
// version exacte de pdfjs-dist installée.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const racine = dirname(require.resolve("pdfjs-dist/package.json"));
const cible = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "pdfjs");

rmSync(cible, { recursive: true, force: true });
mkdirSync(cible, { recursive: true });
cpSync(join(racine, "legacy", "build", "pdf.worker.min.mjs"), join(cible, "pdf.worker.min.mjs"));
cpSync(join(racine, "standard_fonts"), join(cible, "standard_fonts"), { recursive: true });
cpSync(join(racine, "cmaps"), join(cible, "cmaps"), { recursive: true });
cpSync(join(racine, "wasm"), join(cible, "wasm"), { recursive: true });
cpSync(join(racine, "iccs"), join(cible, "iccs"), { recursive: true });
console.log("pdf.js : worker, polices, CMaps, décodeurs et profils copiés dans public/pdfjs/");
