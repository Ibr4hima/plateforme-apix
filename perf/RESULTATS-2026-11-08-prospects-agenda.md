# Statut des prospects précalculé, agenda paginé — sixième campagne, 8 novembre 2026

Mêmes scénarios et même machine que les campagnes précédentes
([départ](RESULTATS-2026-11-07.md), [pagination](RESULTATS-2026-11-07-pagination.md),
[cache](RESULTATS-2026-11-07-cache.md), [processus](RESULTATS-2026-11-08-processus.md),
[IDE en cache](RESULTATS-2026-11-08-ide.md)) ; base de banc régénérée au même
volume, API lancée par `demarrer.sh` (4 processus). Résultats bruts :
`perf/resultats/2026-11-08-prospects-agenda/`.

## En bref

- **1 000 agents en journée de travail** : une page s'ouvre en **23 ms** en
  médiane (1,4 s à la campagne précédente, 60 s au départ), 95 % sous
  **0,18 s** (7,5 s), **aucune erreur**. L'API n'occupe plus que 0,6 cœur en
  moyenne (0,85).
- **Débit** : 60 → **150 pages par seconde** (0,5 au départ).
- **Page Événements** : 1,18 Mo → 0,18 Mo, 169 → 24 ms pour une personne.
- **Page Prospects** : 120 → 31 ms pour une personne.

## Ce qui a changé

**Prospects.** Le statut de chaque carte (En cours, En attente, Inactif,
À recontacter…) se recalculait à chaque page en agrégeant tous les échanges
et tous les re-contacts. Ce qu'il faut pour le connaître — au moins un
échange, la date du dernier, le début du cycle courant, le dernier échange de
ce cycle — est désormais tenu à jour par la base elle-même, à chaque écriture
d'un échange ou d'un re-contact (migration 155, déclencheurs par instruction :
un import de mille échanges recalcule une fois chaque prospect concerné).
Deux index servent la page : ses cartes dans leur ordre, ses compteurs lus
dans l'index seul. Le statut dépend aussi de la date du jour : il reste
calculé à la lecture, sur ces colonnes.

**Agenda.** La page Événements recevait l'agenda entier (1 Mo pour les 2 700
événements du banc) et le filtrait elle-même. Elle le reçoit désormais par
pages de soixante cartes (`/evenements/agenda`), filtres, ordre de la liste
ou de la frise et prochain événement appliqués par le serveur, réponses en
cache. Une réponse qui dépend de la date du jour (« à venir », « prochain
événement ») se recalcule d'elle-même à minuit.

## Route par route

Chaque route seule, médiane de 15 appels, l'API d'avant contre la nouvelle,
sur la même base :

| Route | Avant | Après |
|---|---:|---:|
| Prospects, une page de cartes | 62–75 ms | **5–6 ms** |
| Prospects, filtre « Inactif » | 114 ms | **9 ms** |
| Prospects, compteurs et filtres | 75 ms | **22 ms** |
| Événements, une page de liste ou de frise | 120 ms, 1 Mo | **1,4 ms, 23 Ko** |

## Sous charge

Agents qui enchaînent les pages **sans pause** (campagne précédente →
celle-ci) :

| Agents | Pages / s | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|---:|
| 10 | 46,9 → **118,0** | 0,15 → **0,06 s** | 0,57 → **0,25 s** | 0 % |
| 25 | 51,5 → **134,6** | 0,37 → **0,13 s** | 1,2 → **0,47 s** | 0 % |
| 50 | 56,3 → **142,5** | 0,78 → **0,29 s** | 1,9 → **0,76 s** | 0 % |
| 100 | 59,3 → **151,6** | 1,6 → **0,66 s** | 3,1 → **1,3 s** | 0 % |
| 200 | 60,1 → **144,2** | 3,4 → **1,5 s** | 5,5 → **2,5 s** | 0 % |

**Journée de travail** (une page toutes les 20 s par agent) :

| Agents | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|
| 25 | 0,018 → **0,016 s** | 0,18 → **0,04 s** | 0 % |
| 100 | 0,021 → **0,018 s** | 0,27 → **0,23 s** | 0 % |
| 300 | 0,023 → **0,016 s** | 0,26 → **0,08 s** | 0 % |
| 1 000 | 1,4 → **0,023 s** | 7,5 → **0,18 s** | 0 % |

À 1 000 agents, les cartes et les compteurs des prospects, l'agenda et le
prochain événement de l'accueil faisaient à eux seuls 60 % du temps des
routes les plus lentes, chacune autour de 2,5 s d'attente ; plus aucune
n'est désormais parmi les plus lentes, sauf les compteurs des prospects
(42 ms en moyenne).

## Ce qui a été vérifié

- **Colonnes des prospects** contre le calcul complet : aucun écart sur les
  20 000 prospects, après la génération du banc et après chacun de dix lots
  d'écritures (re-contacts avant, pendant et après le dernier échange, deux
  cycles, sans date ; re-contacts déplacés et supprimés ; échanges reculés,
  supprimés, passés d'un prospect à un autre).
- **API d'avant contre la nouvelle** : compteurs identiques, 39 listes de
  cartes identiques (trois onglets entiers, filtres de statut, pays,
  secteurs, recherche).
- **Écritures de l'API** (échange ajouté, sa date changée, supprimé ;
  prospection conclue, re-contactée, nouvel échange) : la carte est juste
  aussitôt après chacune.
- **Deux agents qui écrivent en même temps** sur un même prospect : sans
  verrou, la colonne gardait le 3 novembre quand le vrai dernier échange
  était du 7 ; le recalcul verrouille donc d'abord les prospects touchés.
- **Agenda** : la règle de la page d'avant, réécrite à l'identique, contre la
  nouvelle route — 578 combinaisons (deux ordres, quatre statuts, huit
  recherches, trois choix de pays, trois de thématiques), mêmes cartes dans
  le même ordre, même total, même prochain événement ; avec des événements
  de test pour ce que le banc n'a pas (récurrents sans date fixée, sans
  aucune date, égalités de dates, en cours, non publiés, supprimés).
- **Dans un navigateur** : liste, suite au défilement, frise, recherche,
  statut, fiche, bandeau « Prochain événement », sans erreur.

## À savoir pour lire les chiffres « une personne »

Comme à la campagne précédente, quelques pages semblent plus lentes pour une
seule personne (Accords, IDE projets, rapport IDE) : avec 4 processus, chacun
garde son propre cache, et les trois ouvertures de la mesure tombent souvent
sur un processus qui calcule la réponse à froid. Sous charge, les caches sont
chauds partout, et ce sont les chiffres ci-dessus qui comptent.

## La suite

1. **Le serveur de production** : sur cette machine de 4 cœurs, l'API
   partage les cœurs avec la base, le site et le générateur de 1 000 agents.
2. **Les accords** : `/accords/cartes` et `/accords/parties-distinctes` sont
   désormais les routes les plus lentes des pages courantes (125 à 130 ms en
   moyenne à 1 000 agents).
3. Un cache partagé entre processus, si l'on veut éviter le calcul à froid
   dans chacun.

La base de banc a été supprimée à la fin des mesures.
