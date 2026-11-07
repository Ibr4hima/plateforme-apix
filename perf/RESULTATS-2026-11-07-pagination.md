# Après la pagination — deuxième campagne, 7 novembre 2026

Même banc, même base, même machine que la première campagne
([RESULTATS-2026-11-07.md](RESULTATS-2026-11-07.md)), mêmes scénarios ; seul
le code a changé. Résultats bruts : `perf/resultats/2026-11-07-pagination/`.

## En bref

Les listes ne sont plus téléchargées en entier : chaque page demande ses
cartes au serveur, par paquets, filtres et recherche compris, et la fiche
complète à l'ouverture.

- **Une personne** : Prospects s'ouvre en 0,10 s au lieu de 23 s
  (0,07 Mo au lieu de 94 Mo), Opportunités en 0,04 s au lieu de 9,4 s,
  Entreprises en 0,04 s au lieu de 2,6 s, l'accueil en 0,12 s au lieu de
  2,9 s.
- **Agents sans pause** : le débit passe de 0,5 à **10 pages par seconde**
  (× 20). À 100 agents, une page met 8,5 s en médiane au lieu de 60 s, et
  **aucune requête n'échoue** (84 % avant).
- **Journée de travail** (une vingtaine de secondes de lecture par page) :
  à **100 agents, une page s'ouvre en 0,2 s** (95 % sous 1,2 s), sans erreur,
  là où 87 % des requêtes échouaient. À 300 agents : 6,7 s en médiane, 0,9 %
  d'erreurs (94 % avant). À 1 000 agents la plateforme sature encore.

C'est mieux que la projection de la première campagne (7,4 pages/s) : la
pagination réelle allège aussi les fiches, les compteurs et l'accueil.

## Ce qui a changé

| Page | Avant | Après |
|---|---|---|
| Prospects | 20 000 prospects aspirés, statut calculé dans le navigateur | 30 cartes par page, statut et filtres calculés en SQL, fiche à l'ouverture |
| Accueil | les 3 000 événements pour en montrer un | `/evenements/prochain` |
| Événements | liste complète, 7 requêtes SQL par événement | agenda léger en une requête, fiche à l'ouverture, affichage par 60 |
| Opportunités | projets, potentialités et avantages entiers, quel que soit l'onglet | chaque onglet demande ce qu'il affiche ; projets paginés |
| Entreprises | 12 000 fiches avec points focaux | 30 cartes par page, filtres et tri en SQL |
| Accords | liste complète avec commentaires | liste légère en une requête, affichage par 60 |
| Administration (entreprises, événements, accords) | listes complètes | listes légères ou paginées, fiche relue avant modification |

Au passage : les listes paginées départagent les lignes créées au même
instant (les pages se chevauchaient), la route morte `/ref-potentialites/flat`
n'est plus appelée par le site, et l'hôte des fiches ne charge plus les
référentiels NAEMA sur chaque page.

## 1. Une seule personne

| Page | Requêtes | Données téléchargées | Temps (serveur) |
|---|---:|---:|---:|
| Prospects | 201 → **4** | 93,9 → **0,07 Mo** | 23,1 s → **0,10 s** |
| Opportunités | 125 → **9** | 14,1 → **0,16 Mo** | 9,4 s → **0,04 s** |
| Entreprises | 109 → **11** | 10,2 → **0,16 Mo** | 2,6 s → **0,04 s** |
| Accueil | 40 → **10** | 4,5 → **0,23 Mo** | 2,9 s → **0,12 s** |
| Événements | 34 → **7** | 4,3 → **1,2 Mo** | 2,7 s → **0,19 s** |
| Accords | 29 → **7** | 1,7 → **0,59 Mo** | 0,28 s → **0,07 s** |
| Admin — Entreprises | 125 → **6** | 12,2 → **0,16 Mo** | 3,5 s → **0,03 s** |
| Admin — Événements | 34 → **2** | 4,8 → **1,2 Mo** | 5,0 s → **0,14 s** |
| Admin — Accords | 30 → **3** | 1,9 → **1,0 Mo** | 0,26 s → **0,11 s** |

Sur tout le site : 163 adresses d'API distinctes au lieu de 760, aucune page
au-delà de 17 requêtes au premier écran, aucune adresse en erreur.

Dans le navigateur : l'onglet Prospects occupe 7 Mo de mémoire au lieu de
105, Entreprises 7 au lieu de 87, Opportunités 7 au lieu de 36 ; le réseau
de Prospects se calme en 0,37 s au lieu de 15,6 s, celui d'Opportunités en
0,26 s au lieu de 7,9 s.

## 2. Sous charge

Agents qui enchaînent les pages **sans pause** :

| Agents | Pages servies / s | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|---:|
| 10 | 0,48 → **9,67** | 21,7 s → **0,84 s** | 38,9 s → 2,3 s | 10,8 % → **0 %** |
| 25 | 0,58 → **9,63** | 37,0 s → **2,4 s** | 60,4 s → 4,1 s | 44,5 % → **0 %** |
| 50 | 0,83 → **10,8** | 47,6 s → **4,3 s** | 60,9 s → 6,7 s | 63,2 % → **0 %** |
| 100 | 1,24 → **10,5** | 60,4 s → **8,5 s** | 61,0 s → 17,9 s | 83,9 % → **0 %** |
| 200 | 1,99 → **10,7** | 60,6 s → **12,7 s** | 61,2 s → 54,9 s | 88,2 % → **1,6 %** |

**Journée de travail** (pause d'une vingtaine de secondes entre deux pages) :

| Agents | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|
| 25 | 33,2 s → **0,13 s** | 60,4 s → 0,96 s | 33,1 % → **0 %** |
| 50 | 56,6 s → **0,14 s** | 60,9 s → 0,95 s | 65,6 % → **0 %** |
| 100 | 60,5 s → **0,20 s** | 61,0 s → 1,2 s | 87,0 % → **0 %** |
| 300 | 60,6 s → **6,7 s** | 61,1 s → 27,3 s | 93,5 % → **0,9 %** |
| 1 000 | 60,8 s → 60,2 s | 67,8 s → 61,0 s | 96,8 % → **48,6 %** |

Les erreurs restantes sont des requêtes abandonnées après 60 s d'attente
(200 agents sans pause, 1 000 en journée) et, à 300 agents, 88 connexions
interrompues sur environ 9 400 requêtes. Les attentes de connexion à la base
qui échouaient en masse (12 024 au premier palier avant) ont disparu : 3
réponses 500 seulement, à 1 000 agents. Aucune route n'est plus en erreur.

## 3. Ce qui limite maintenant

Le plafond est d'environ **10,5 pages par seconde**, atteint dès 25 agents
sans pause. Les 2 processus de l'API sont alors saturés (2,2 cœurs en
moyenne) ; Postgres reste entre 10 et 80 % d'un cœur. À 1 000 agents, la
machine du banc — 4 cœurs partagés entre l'API, la base, le site et le
générateur de charge — est elle-même à bout : ce palier mesure autant le
banc que la plateforme.

Une page vue cumule en moyenne **270 ms de temps de réponse serveur** (à vide,
selon la répartition des pages du banc). Où ils vont :

| Route | Part | Ce qu'elle fait |
|---|---:|---|
| `/statistiques/commerce/filtres` | **31 %** | parcourt les 2 millions de flux à chaque appel pour lister années et pays (0,8 s) |
| `/fdi/public/projets` | 14 % | listes et agrégats du relevé fDi (80 à 110 ms) |
| `/statistiques/pays` | 8 % | les pays ayant des données, recherchés à chaque appel parmi 209 000 indicateurs (22 ms, appelée par beaucoup de pages) |
| `/zones-types` | 7 % | 4,7 Mo de géométries à chaque appel (0,6 s) |
| `/prospects/cartes` | 5 % | 50 à 80 ms par page de cartes |

Hors pages courantes : `/bdef/verification` 3,6 s et
`/statistiques/admin/couverture` 3,5 s (administration).

## 4. La suite, dans l'ordre

1. **Calculer une fois ce qui change rarement** : filtres de Statistiques
   (31 % du temps serveur à elle seule), pays des statistiques, zones,
   vérification BDEF et couverture — au moment des imports, ou gardés en
   cache quelques minutes. Gain attendu : environ +50 % de débit.
2. **Plus de processus** pour l'API, réglés sur les cœurs du serveur de
   production : le débit croît presque linéairement tant que la base suit.
3. **Robustesse** : durées maximales pour les requêtes et les verrous,
   réponse 503 « réessayez » plutôt qu'une attente de 60 s, contrôle de santé
   qui interroge la base, connexions vérifiées avant usage.
4. **Les fiches événement** font encore une requête par thématique ou pays
   invité (une seule fiche à la fois désormais : peu coûteux, mais à
   regrouper).
5. **L'app mobile** appelle encore `/ref-potentialites/flat` (erreur 500
   sans effet visible) : à retirer à la prochaine mise à jour.
6. **Relancer ce banc** après chaque étape. Objectif inchangé : 1 000 agents
   en journée de travail, 95 % des pages sous la seconde, aucune erreur.

## Le banc

Identique à la première campagne : base de 602 Mo (2,75 millions de lignes
générées, relevés fDi et commerce extérieur réels), API comme en production
(uvicorn, 2 processus, pool de 10 + 20 connexions par processus), site
construit (`next build`, sortie standalone), Postgres 16, machine de 4 cœurs
et 15 Go partagée par tous. Pour exercer tous les cas, 670 potentialités ont
été réparties sur les niveaux région, département, arrondissement et global,
et trois secteurs renommés « primaire / secondaire / tertiaire » ; sans effet
mesurable sur la charge. La base de banc a été supprimée à la fin des mesures.
