# APIX Sénégal — application mobile (Expo / React Native)

L'app consomme la même API FastAPI que le site web et partage son langage
visuel (`src/theme.ts`) et ses libs métier (`src/lib/format.ts`,
`src/lib/couleurs.ts`, `src/lib/statuts.ts`, portées du frontend).

## Développement (iOS d'abord)

1. Installer les dépendances : `npm install`
2. Créer `.env` à partir de `.env.example` — sur un téléphone, `localhost`
   désigne le téléphone : mettre l'adresse IP locale du Mac, ex.
   `EXPO_PUBLIC_API_URL=http://192.168.1.20:8000/api/v1`
   (le backend doit écouter sur le réseau : `uvicorn ... --host 0.0.0.0`)
3. Lancer : `npx expo start`
4. Sur l'iPhone : installer **Expo Go** (App Store), scanner le QR code.
   Sur simulateur iOS (si Xcode installé) : touche `i`.

## Structure

- `src/app/` — écrans (Expo Router, navigation par fichiers comme Next)
- `src/lib/` — API + libs métier partagées avec le site
- `src/theme.ts` — jetons de design APIX (couleurs, rayons, badges)

## Distribution

Builds & soumission App Store via EAS : `npx eas build -p ios` (compte
Expo + Apple Developer requis — à configurer le moment venu).
