# Routes IDE et référentiels en cache — cinquième campagne, 8 novembre 2026

Mêmes scénarios et même machine que les campagnes précédentes
([départ](RESULTATS-2026-11-07.md), [pagination](RESULTATS-2026-11-07-pagination.md),
[cache](RESULTATS-2026-11-07-cache.md), [processus](RESULTATS-2026-11-08-processus.md)) ;
API lancée par `demarrer.sh` (4 processus). Résultats bruts :
`perf/resultats/2026-11-08-ide/`.

## En bref

- **1 000 agents en journée de travail : aucune erreur** (les 8 réponses
  « réessayez » de la campagne précédente ont disparu), une page en
  **1,4 s** en médiane (2,3 s ; 60 s au départ), 95 % sous 7,5 s (8,8 s).
- **Débit** : 49 → **60 pages par seconde** (0,5 au départ).
- **300 agents** : 0,02 s par page en médiane, 95 % sous 0,26 s.
- L'API n'occupe plus en moyenne qu'un cœur à 1 000 agents, la base 13 %
  d'un cœur : sur cette machine, la limite est le banc lui-même.

## Ce qui a changé

- **30 routes de plus en cache** (53 en tout), dans deux nouvelles
  familles : l'IDE (15 routes : CNUCED, monde, secteurs, indicateurs,
  analyses) et les référentiels (secteurs, branches et activités NAEMA,
  régions, départements, arrondissements, pays, pôles, formes juridiques,
  groupements).
- **L'administration lit toujours la base** : toute lecture de l'API faite
  depuis une page /admin contourne le cache. Vérifié dans un navigateur :
  un secteur renommé apparaît aussitôt dans sa liste d'administration ;
  les pages publiques, elles, lisent le cache.
- Vérifié contre l'API d'avant, lancée à côté : 44 adresses donnent
  exactement les mêmes octets (et les mêmes en-têtes), y compris les
  référentiels décrits par un modèle de réponse.

## Sous charge

Agents qui enchaînent les pages **sans pause** (campagne précédente →
celle-ci) :

| Agents | Pages / s | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|---:|
| 10 | 42,0 → **46,9** | 0,20 → **0,15 s** | 0,54 → 0,57 s | 0 % |
| 25 | 45,8 → **51,5** | 0,48 → **0,37 s** | 1,1 → 1,2 s | 0 % |
| 50 | 44,8 → **56,3** | 1,0 → **0,78 s** | 2,0 → 1,9 s | 0 % |
| 100 | 49,7 → **59,3** | 2,0 → **1,6 s** | 3,2 → 3,1 s | 0 % |
| 200 | 49,1 → **60,1** | 3,9 → **3,4 s** | 6,7 → **5,5 s** | 0 % |

**Journée de travail** :

| Agents | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|
| 25 | 0,02 → **0,02 s** | 0,15 → 0,18 s | 0 % |
| 100 | 0,03 → **0,02 s** | 0,27 → 0,27 s | 0 % |
| 300 | 0,04 → **0,02 s** | 0,35 → **0,26 s** | 0 % |
| 1 000 | 2,3 → **1,4 s** | 8,8 → **7,5 s** | 0,02 % → **0 %** |

## À savoir pour lire les chiffres « une personne »

La mesure « une personne » ouvre chaque page trois fois et garde la
médiane. Avec 4 processus, chacun garde son propre cache : les trois
ouvertures tombent souvent sur des processus qui n'ont pas encore calculé
la réponse, et la médiane mesure alors un calcul à froid (Tableau de bord
1,2 s, Zones 0,7 s). Sous charge, les caches sont chauds dans tous les
processus, et ce sont les chiffres ci-dessus qui comptent.

## La suite

1. **Le serveur de production** : avec un processus par cœur
   (`demarrer.sh`), l'API y tient d'autant mieux qu'elle a de cœurs à elle ;
   sur cette machine de 4 cœurs, elle les partage avec la base, le site et
   le générateur de 1 000 agents.
2. Les cartes de prospects (statut précalculé), l'agenda (1 Mo), et un
   cache partagé entre processus si l'on veut éviter le calcul à froid dans
   chacun.

La base de banc a été supprimée à la fin des mesures.
