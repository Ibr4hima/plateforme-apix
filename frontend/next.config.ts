import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Démo : ne pas bloquer le build de production sur les erreurs de type/lint
  // (la branche de dev est déployée en direct ; on ne veut pas qu'une erreur TS
  // en cours de travail casse le déploiement). Le typage reste vérifié en local.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
