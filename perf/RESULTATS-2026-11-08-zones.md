# Page Zones allégée — huitième campagne, 8 novembre 2026

Mêmes scénarios et même machine que les campagnes précédentes
([départ](RESULTATS-2026-11-07.md), …, [accords](RESULTATS-2026-11-08-accords.md)) ;
base de banc régénérée au même volume, API lancée par `demarrer.sh`
(4 processus). Résultats bruts : `perf/resultats/2026-11-08-zones/`.

## En bref

- **Page Zones** : **4,78 → 0,16 Mo** à chaque ouverture, 631 → 6 ms pour
  une personne. C'était la page la plus lourde du site, et de loin.
- **Volume servi** : 370 → **226 Ko** par page vue en moyenne sur tout le
  parcours des agents (−39 %) ; à 1 000 agents en journée, 1,8 → 1,1 Go sur
  le palier.
- **Sous charge** : temps et débit inchangés aux écarts de mesure près,
  ils étaient déjà bas — à 1 000 agents en journée, 95 % des pages sous
  36 ms ; 200 pages par seconde sans pause ; aucune erreur.

## Ce qui a changé

La page téléchargeait toutes les zones avec toutes leurs entreprises — nom,
forme juridique, adresse, téléphone, courriel et site de chacune : 15 000
entreprises pour les 300 zones du banc. Elle n'en montrait que des
compteurs ; la liste des entreprises d'une zone ne sert qu'à sa fiche.

Elle reçoit désormais ses cartes (`/zones-types/cartes`) : les champs des
cartes, les entreprises installées et éligibles de chaque zone, comptées,
et celles de chaque pôle pour la vue territoriale, comptées par le serveur
avec la règle de la page. La fiche d'une zone (`/zones-types/{id}`)
arrive à son ouverture, et dès le survol de sa carte.

La liste complète (`/zones-types`) reste pour l'administration et
l'application mobile. Les entreprises d'une zone y sont triées par heure
d'ajout puis par identifiant : celles ajoutées au même instant (un import)
sortaient dans un ordre qui dépendait de la lecture de la table.

## Route par route

Chaque route seule, médiane de 15 appels :

| Route | Avant | Après, du cache | Après, calculée |
|---|---:|---:|---:|
| Zones, ouverture de la page | 3,5 ms, 4,7 Mo | **1,4 ms, 115 Ko** | 46 ms |
| Fiche d'une zone | (comprise dans les 4,7 Mo) | **1,3 ms, 12 Ko** | 9 ms |

La liste complète était déjà servie du cache côté serveur : le gain est le
volume à transférer et à lire, pour le serveur comme pour le navigateur.

## Sous charge

Agents qui enchaînent les pages **sans pause** (campagne précédente →
celle-ci) :

| Agents | Pages / s | Page, médiane | Page, 95 % | Volume par page | Erreurs |
|---:|---:|---:|---:|---:|---:|
| 10 | 180 → **191** | 0,046 → 0,043 s | 0,11 → 0,11 s | | 0 % |
| 25 | 185 → **201** | 0,10 → 0,10 s | 0,31 → 0,29 s | | 0 % |
| 100 | 204 → **212** | 0,46 → 0,46 s | 0,99 → 0,92 s | 373 → **225 Ko** | 0 % |
| 200 | 202 → 199 | 1,0 → 1,1 s | 1,8 → 1,7 s | | 0 % |

**Journée de travail** (une page toutes les 20 s par agent) :

| Agents | Page, médiane | Page, 95 % | Volume par page | Erreurs |
|---:|---:|---:|---:|---:|
| 100 | 0,018 → 0,018 s | 0,18 → 0,13 s | | 0 % |
| 300 | 0,014 → 0,014 s | 0,028 → 0,030 s | | 0 % |
| 1 000 | 0,015 → 0,016 s | 0,034 → 0,036 s | 366 → **228 Ko** | 0 % |

## Ce qui a été vérifié

- **Liste complète** (avec et sans type) : mêmes zones et mêmes entreprises
  que l'API d'avant, entreprises par heure d'ajout puis identifiant.
- **Fiche** de chacune des 297 zones identique à son élément de la liste
  complète ; 404 pour une zone supprimée ou inconnue.
- **Cartes** : mêmes zones, même ordre, mêmes champs, compteurs justes pour
  chaque zone ; entreprises installées des 8 pôles identiques à la règle
  de la vue territoriale d'avant (une entreprise présente dans plusieurs
  zones d'un pôle y compte une fois, avec son statut dans la première zone
  de la liste), avec 547 entreprises sous deux statuts dans un même pôle.
- **Dans un navigateur** : compteurs des trois types, cartes des zones,
  fiche d'une zone, fiche d'un pôle — les nombres de la page d'avant, sans
  erreur.

## La suite

1. **Le serveur de production** : sur cette machine de 4 cœurs, l'API
   partage les cœurs avec la base, le site et le générateur de 1 000 agents.
2. **L'application mobile** précharge la liste complète des zones (4,7 Mo)
   à son ouverture : elle peut passer aux cartes et à la fiche à la
   demande, dans une mise à jour.
3. **Tableau de bord** : 17 appels, 0,8 à 1,3 s pour une personne.
4. **L'administration des zones** lit la liste complète (4,9 Mo) ; peu de
   personnes s'en servent.

La base de banc a été supprimée à la fin des mesures.
