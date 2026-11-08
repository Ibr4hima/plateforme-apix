# Accords paginés et en cache — septième campagne, 8 novembre 2026

Mêmes scénarios et même machine que les campagnes précédentes
([départ](RESULTATS-2026-11-07.md), …, [prospects et agenda](RESULTATS-2026-11-08-prospects-agenda.md)) ;
base de banc régénérée au même volume, API lancée par `demarrer.sh`
(4 processus). Résultats bruts : `perf/resultats/2026-11-08-accords/`.

## En bref

- **1 000 agents en journée de travail** : 95 % des pages s'ouvrent en moins
  de **34 ms** (179 ms à la campagne précédente, 7,5 s celle d'avant), la
  médiane à **15 ms** (23 ms), aucune erreur. L'API n'occupe plus qu'un
  tiers de cœur en moyenne (0,6).
- **Débit** : 150 → **200 pages par seconde**, aucune erreur.
- **Page Accords** : 0,59 Mo → 0,17 Mo, 177 → 19 ms pour une personne.
- Les deux routes les plus lentes des pages courantes à la campagne
  précédente (`/accords/cartes`, `/accords/parties-distinctes`, 125 à 130 ms
  en moyenne à 1 000 agents) ont quitté la liste des plus lentes.

## Ce qui a changé

La page Accords recevait tous les traités (416 Ko pour les 2 500 du banc)
et les filtrait, les triait elle-même. Elle les reçoit désormais par pages
de soixante (`/accords/catalogue`) : statut, recherche (titre, référence,
tous les signataires), parties (pays ou APIX), thématiques et ordre de la
page — les accords actifs d'abord, celui qui expire le plus tôt en tête,
puis les expirés — appliqués par le serveur, réponses en cache.
`/accords/parties-distinctes` lit les pays en une requête au lieu de
relire tous les accords, et passe aussi par le cache ; sa réponse ne change
pas (l'application mobile la lit aussi). L'administration lit toujours
sans cache.

## Route par route

Chaque route seule, médiane de 15 appels, sur la même base :

| Route | Avant | Après, du cache | Après, calculée |
|---|---:|---:|---:|
| Accords, ouverture de la page | 47 ms, 416 Ko | **1,5 ms, 23 Ko** | 10 ms |
| Accords, filtre « En vigueur » | 48 ms, 416 Ko | **1,4 ms, 23 Ko** | 9 ms |
| Accords, recherche | 49 ms, 416 Ko | **1,5 ms, 23 Ko** | 12 ms |
| Parties signataires | 16 ms | **1,2 ms** | 9 ms |

« Calculée » : la première demande d'une adresse dans un processus, ou
après une modification des accords.

## Sous charge

Agents qui enchaînent les pages **sans pause** (campagne précédente →
celle-ci) :

| Agents | Pages / s | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|---:|
| 10 | 118 → **180** | 0,055 → **0,046 s** | 0,25 → **0,11 s** | 0 % |
| 25 | 135 → **185** | 0,13 → **0,10 s** | 0,47 → **0,31 s** | 0 % |
| 50 | 142 → **192** | 0,29 → **0,20 s** | 0,76 → **0,59 s** | 0 % |
| 100 | 152 → **204** | 0,66 → **0,46 s** | 1,3 → **1,0 s** | 0 % |
| 200 | 144 → **202** | 1,5 → **1,0 s** | 2,5 → **1,8 s** | 0 % |

**Journée de travail** (une page toutes les 20 s par agent) :

| Agents | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|
| 25 | 0,016 → **0,015 s** | 0,037 → **0,033 s** | 0 % |
| 100 | 0,018 → **0,018 s** | 0,23 → **0,18 s** | 0 % |
| 300 | 0,016 → **0,014 s** | 0,082 → **0,028 s** | 0 % |
| 1 000 | 0,023 → **0,015 s** | 0,18 → **0,034 s** | 0 % |

À 1 000 agents, les douze routes les plus lentes cumulent 13 ms de réponse
serveur par page vue (33 ms à la campagne précédente) ; la plus lente
d'entre elles, les compteurs des prospects, répond en 26 ms en moyenne.

## Ce qui a été vérifié

- **Mêmes octets que l'API d'avant** pour `/accords/parties-distinctes`,
  `/accords/cartes` et `/accords/cartes?admin=true`, calculés puis servis
  du cache.
- **Catalogue contre la règle de la page d'avant**, réécrite à l'identique :
  660 combinaisons (onze recherches dont accents, % et _, quatre statuts,
  cinq choix de parties dont l'APIX, trois de thématiques), mêmes cartes
  dans le même ordre, même total ; avec des accords de test pour ce que le
  banc n'a pas (signataires en toutes lettres, pays absents du référentiel
  ou inactifs, sans aucune date, échéance aujourd'hui, égalités…).
- **Dans un navigateur** : ouverture, suite au défilement, recherche,
  statut, parties, fiche, sans erreur.

## À savoir pour lire les chiffres « une personne »

Le banc n'envoie pas l'en-tête des pages d'administration : il lit donc
`/accords/cartes?admin=true` depuis le cache (8 ms), alors que dans un
navigateur la page d'administration la lit toujours fraîche (environ
130 ms). Comme aux campagnes précédentes, quelques pages varient d'une
mesure à l'autre selon le processus, au cache chaud ou froid, qui répond.

## La suite

1. **Le serveur de production** : sur cette machine de 4 cœurs, l'API
   partage les cœurs avec la base, le site et le générateur de 1 000 agents.
2. **Zones** : 4,8 Mo à chaque ouverture de la page (les zones et leurs
   entreprises) — la plus lourde du site, de loin.
3. **Tableau de bord** : 17 appels, environ 1 s pour une personne.
4. Un cache partagé entre processus, si l'on veut éviter le calcul à froid
   dans chacun.

La base de banc a été supprimée à la fin des mesures.
