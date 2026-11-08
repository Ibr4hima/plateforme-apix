# Un processus par cœur et des garde-fous — quatrième campagne, 8 novembre 2026

Mêmes scénarios que les campagnes précédentes
([départ](RESULTATS-2026-11-07.md), [pagination](RESULTATS-2026-11-07-pagination.md),
[cache](RESULTATS-2026-11-07-cache.md)), même machine (4 cœurs), base de banc
régénérée au même volume. L'API est lancée comme en production désormais,
par `backend/demarrer.sh` : 4 processus ici, un par cœur. Résultats bruts :
`perf/resultats/2026-11-08-processus/`.

## En bref

- **Débit** : 40 → **49 pages par seconde** (avec 2 processus → 4).
- **1 000 agents en journée de travail** : une page s'ouvre en **2,3 s** en
  médiane (6,8 s avec 2 processus ; 60 s au départ), 95 % sous 8,8 s
  (13,1 s) ; 8 réponses « réessayez » sur environ 20 000 requêtes (0,02 %),
  aucune erreur interne.
- **300 agents** : 0,04 s par page en médiane, 95 % sous 0,35 s, aucune
  erreur.
- **Pannes** : base arrêtée, redémarrée, saturée, requête emballée — l'API
  répond proprement dans tous les cas (section 2).

L'API n'occupe plus que 2 des 4 cœurs au plus fort de la charge : sur cette
machine, c'est désormais le banc lui-même (le générateur de 1 000 agents et
le site) qui fixe la limite, plus l'API.

## Ce qui a changé

- **Un processus par cœur** (`backend/demarrer.sh`, au moins 2, au plus 8 ;
  `API_WORKERS` pour forcer), utilisé par le Dockerfile.
- **Connexions à la base partagées** entre les processus : 80 au plus pour
  l'API (Postgres en accepte 100), vérifiées avant usage.
- **Durées maximales**, pour l'API seulement : requête SQL 2 min, attente de
  verrou 20 s, transaction laissée ouverte 10 min (réglables). Les imports du
  déploiement n'en ont pas.
- **503 « réessayez »** (en-tête Retry-After) quand aucune connexion ne se
  libère en 10 s, quand la base est indisponible, ou quand une opération
  dépasse sa durée maximale — au lieu d'une erreur 500 après 30 s d'attente.
- **`/health` interroge la base**.
- **Tâches planifiées** (rafraîchissement CNUCED, expiration des accords) :
  une seule exécution quel que soit le nombre de processus.
- **Cache** : base injoignable, la dernière réponse connue est servie.
- **Vérification BDEF** : 3,5 s → 1,7 s, et elle ne bloque plus son processus.

## 1. Sous charge (4 processus au lieu de 2)

Agents qui enchaînent les pages **sans pause** :

| Agents | Pages / s | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|---:|
| 10 | 33,0 → **42,0** | 0,26 → **0,20 s** | 0,68 → 0,54 s | 0 % |
| 25 | 38,6 → **45,8** | 0,59 → **0,48 s** | 1,2 → 1,1 s | 0 % |
| 50 | 40,1 → **44,8** | 1,2 → **1,0 s** | 2,0 → 2,0 s | 0 % |
| 100 | 39,6 → **49,7** | 2,4 → **2,0 s** | 4,2 → 3,2 s | 0 % |
| 200 | 39,9 → **49,1** | 4,5 → **3,9 s** | 10,5 → **6,7 s** | 0 % |

**Journée de travail** (une vingtaine de secondes de lecture par page) :

| Agents | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|
| 25 | 0,03 → **0,02 s** | 0,22 → 0,15 s | 0 % |
| 100 | 0,04 → **0,03 s** | 0,30 → 0,27 s | 0 % |
| 300 | 0,06 → **0,04 s** | 0,44 → **0,35 s** | 0 % |
| 1 000 | 6,8 → **2,3 s** | 13,1 → **8,8 s** | 0 → 0,02 % |

Les 8 réponses « réessayez » à 1 000 agents viennent de routes IDE encore
calculées à chaque appel (`/ide/cnuced`, `/ide/monde/…`) : faute de connexion
libre en 10 s, elles ont reçu un 503 avec Retry-After, que le site réessaie
seul. Les connexions ouvertes ont culminé à 85, sous la limite de 100.

## 2. Pannes provoquées

| Situation | Avant | Maintenant |
|---|---|---|
| Base arrêtée — contrôle de santé | « ok » | **503**, aussitôt |
| Base arrêtée — page Prospects | 500 | **503 « réessayez »**, aussitôt |
| Base arrêtée — filtres de Statistiques | 500 | **servis du cache** |
| Base redémarrée — premières requêtes | 2 en échec (connexions mortes) | **28 sur 28 réussies** |
| Requête SQL emballée | sans limite | **503** dès la durée maximale |
| Plus aucune connexion libre | 500 au bout de 30 s | **503** au bout de 10 à 13 s |
| Tâche planifiée, 4 processus | exécutée 4 fois | **exécutée 1 fois** |
| Vérification BDEF en cours | processus figé 3,5 s | les autres requêtes servies |

## 3. La suite

1. **Le serveur de production** : `demarrer.sh` y lance un processus par cœur
   tout seul. Pour aller vers 1 000 agents avec des pages sous la seconde, il
   faut que l'API dispose de ses propres cœurs : sur cette machine, elle
   partage les siens avec la base, le site et le générateur de charge.
2. **Mettre en cache les routes IDE** (cnuced, monde) et les référentiels : ce
   sont elles qui ont manqué de connexions à 1 000 agents.
3. Les cartes de prospects (statut précalculé) et l'agenda (1 Mo).

La base de banc a été supprimée à la fin des mesures.
