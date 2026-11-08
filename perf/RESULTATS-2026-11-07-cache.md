# Après le cache des calculs rares — troisième campagne, 7 novembre 2026

Mêmes scénarios que les deux campagnes précédentes
([avant tout](RESULTATS-2026-11-07.md), [après la pagination](RESULTATS-2026-11-07-pagination.md)),
même machine, base de banc régénérée au même volume par le même générateur.
Résultats bruts : `perf/resultats/2026-11-07-cache/`.

## En bref

Les réponses qui ne changent qu'aux imports sont calculées une fois puis
servies de la mémoire de l'API, prêtes à envoyer.

- **Capacité** : de 10 à **40 pages servies par seconde** (× 4 ; × 80 depuis
  le départ). Le temps de réponse serveur cumulé d'une page vue passe de
  270 à **54 ms**.
- **Journée de travail, 300 agents** : une page s'ouvre en **0,06 s** en
  médiane, 95 % sous 0,44 s, **aucune erreur** (6,7 s et 0,9 % d'erreurs après
  la pagination ; 60 s et 94 % au départ).
- **1 000 agents** : **aucune erreur** (49 % après la pagination, 97 % au
  départ), mais 6,8 s par page en médiane : la machine du banc est à bout
  (voir 3).
- **Une personne** : Tableau de bord 0,92 s → **0,05 s**, Zones 0,66 s →
  **0,02 s**, accueil 0,12 s → **0,03 s** ; couverture des statistiques
  (administration) 3,3 s → 0,12 s.

## Ce qui a changé

- **23 routes publiques** gardent leur réponse en mémoire tant que leurs
  tables n'ont pas changé (`backend/app/core/cache.py`) : 14 de Statistiques
  (filtres, pays, données, commerce…), 8 du relevé fDi (projets, signaux,
  périmètres, entreprises), la liste des zones. *Le message du commit
  c381a836 en annonce 30 : c'est une erreur de compte, les 8 routes NACE
  ayant été retirées avant le commit.*
- Le signal de changement est le compteur d'écritures que Postgres tient pour
  chaque table : tout import, d'où qu'il vienne, rafraîchit les réponses
  concernées, dans tous les processus. Délai mesuré : moins de 0,5 s en
  général, **12 s au pire** (connexion d'écriture occupée). L'administration,
  elle, lit toujours la base.
- Les routes NACE gardent leur propre cache (ETag, 304) et le servent
  désormais mis en forme.
- La couverture des statistiques (administration) est agrégée par la base.

Vérifié contre l'API d'avant, lancée à côté sur la même base : 48 adresses
donnent exactement les mêmes octets, à froid comme servies du cache.

## 1. Une seule personne

| Page | Départ | Après pagination | Après cache |
|---|---:|---:|---:|
| Accueil | 2,9 s | 0,12 s | **0,03 s** |
| Tableau de bord | 0,96 s | 0,92 s | **0,05 s** |
| Zones | 0,73 s | 0,66 s | **0,02 s** |
| IDE — projets | 0,21 s | 0,19 s | **0,06 s** |
| Statistiques | 0,04 s | 0,04 s | **0,01 s** |
| Prospects | 23,1 s | 0,10 s | 0,08 s |
| Opportunités | 9,4 s | 0,04 s | 0,03 s |
| Événements | 2,7 s | 0,19 s | 0,12 s |
| Admin — Statistiques | 3,6 s | 3,3 s | **0,12 s** |

## 2. Sous charge

Agents qui enchaînent les pages **sans pause** :

| Agents | Pages / s | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|---:|
| 10 | 0,48 → 9,7 → **33,0** | 21,7 s → 0,84 s → **0,26 s** | 38,9 s → 2,3 s → 0,68 s | 10,8 % → 0 → **0 %** |
| 25 | 0,58 → 9,6 → **38,6** | 37,0 s → 2,4 s → **0,59 s** | 60,4 s → 4,1 s → 1,2 s | 44,5 % → 0 → **0 %** |
| 50 | 0,83 → 10,8 → **40,1** | 47,6 s → 4,3 s → **1,2 s** | 60,9 s → 6,7 s → 2,0 s | 63,2 % → 0 → **0 %** |
| 100 | 1,24 → 10,5 → **39,6** | 60,4 s → 8,5 s → **2,4 s** | 61,0 s → 17,9 s → 4,2 s | 83,9 % → 0 → **0 %** |
| 200 | 1,99 → 10,7 → **39,9** | 60,6 s → 12,7 s → **4,5 s** | 61,2 s → 54,9 s → 10,5 s | 88,2 % → 1,6 % → **0 %** |

**Journée de travail** (une vingtaine de secondes de lecture par page) :

| Agents | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|
| 25 | 33,2 s → 0,13 s → **0,03 s** | 60,4 s → 0,96 s → 0,22 s | 33,1 % → 0 → **0 %** |
| 50 | 56,6 s → 0,14 s → **0,03 s** | 60,9 s → 0,95 s → 0,18 s | 65,6 % → 0 → **0 %** |
| 100 | 60,5 s → 0,20 s → **0,04 s** | 61,0 s → 1,2 s → 0,30 s | 87,0 % → 0 → **0 %** |
| 300 | 60,6 s → 6,7 s → **0,06 s** | 61,1 s → 27,3 s → **0,44 s** | 93,5 % → 0,9 % → **0 %** |
| 1 000 | 60,8 s → 60,2 s → **6,8 s** | 67,8 s → 61,0 s → 13,1 s | 96,8 % → 48,6 % → **0 %** |

(Chaque cellule : départ → après pagination → après cache.)

## 3. Ce qui limite maintenant

**Le nombre de processus de l'API.** Le plafond de 40 pages par seconde est
atteint dès 50 agents sans pause, les 2 processus occupant 3 cœurs ; la base,
elle, reste entre 5 et 20 % d'un cœur. À 1 000 agents en journée, la machine
du banc est à bout : ses 4 cœurs portent aussi le générateur de charge (1 000
agents simultanés) et le site, et l'API ne dispose plus que de 1,7 cœur. Sur
un serveur où l'API a ses propres cœurs, le débit croît avec le nombre de
processus.

Où vont les 54 ms de réponse serveur d'une page vue :

| Route | Part | |
|---|---:|---|
| `/prospects/cartes` | 25 % | statut de chaque prospect calculé sur ses échanges, 50 à 80 ms |
| `/evenements/cartes` | 12 % | l'agenda entier (1 Mo pour 2 700 événements) |
| `/prospects/facettes` | 12 % | compteurs des onglets et filtres |
| `/ide/cnuced`, `/ide/monde/global` | 10 % | |

Hors pages courantes : `/bdef/verification` 3,7 s et `/auth/users` 0,3 s
(1 Mo), en administration.

## 4. La suite

1. **Plus de processus** pour l'API, réglés sur les cœurs du serveur de
   production (`--workers`) : c'est désormais le levier direct de la
   capacité.
2. **Robustesse** : durées maximales pour les requêtes et les verrous,
   réponse 503 « réessayez » plutôt qu'une longue attente, contrôle de santé
   qui interroge la base, connexions vérifiées avant usage.
3. Les cartes de prospects (statut précalculé), l'agenda (pagination de la
   liste), la vérification BDEF.
4. Relancer ce banc après chaque étape. Objectif : 1 000 agents en journée,
   95 % des pages sous la seconde, aucune erreur — atteint jusqu'à 300 agents
   sur cette machine.

La base de banc a été supprimée à la fin des mesures.
