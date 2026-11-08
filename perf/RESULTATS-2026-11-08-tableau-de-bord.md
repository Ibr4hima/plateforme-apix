# Tableau de bord allégé — neuvième campagne, 8 novembre 2026

Mêmes scénarios et même machine que les campagnes précédentes
([départ](RESULTATS-2026-11-07.md), …, [zones](RESULTATS-2026-11-08-zones.md)) ;
base de banc régénérée au même volume, API lancée par `demarrer.sh`
(4 processus). Résultats bruts : `perf/resultats/2026-11-08-tableau-de-bord/`.

## En bref

- **Tableau de bord** : **794 → 272 ms** pour une personne, **0,89 → 0,28 Mo**.
- **Volume servi** : 226 → **161 Ko** par page vue en moyenne sur tout le
  parcours des agents (−29 %).
- **Sous charge** : temps et débit inchangés aux écarts de mesure près —
  à 1 000 agents en journée, 95 % des pages sous 38 ms ; 210 pages par
  seconde sans pause ; aucune erreur.

## Ce qui a changé

**Le calcul qui faisait attendre.** Sur les 17 demandes du tableau de bord,
une seule coûtait : les filtres du commerce (`/statistiques/commerce/filtres`),
**960 ms** à calculer, car elle parcourait les 2 millions de flux commerciaux
du banc pour en tirer les années et les pays. La page l'attendait avant de
demander ses chiffres du commerce. Servie du cache le reste du temps, elle se
recalculait dans chacun des 4 processus, après chaque import et toutes les
dix minutes : le premier visiteur payait la seconde. Années et pays se lisent
désormais dans les index des flux : **15 ms**, même réponse octet pour octet.

**Le détail téléchargé pour sept lignes.** La page téléchargeait le détail du
commerce extérieur par pays partenaire (600 Ko) pour n'en montrer que les
sept premiers partenaires de l'année choisie. Le serveur les calcule
désormais avec la règle de la page (`/nace/partenaires`, 9 Ko). Le détail
reste pour l'onglet Commerce extérieur des Statistiques.

Chaque demande du tableau de bord, calculée (cache vide) : toutes les autres
restaient sous 45 ms.

## Sous charge

Agents qui enchaînent les pages **sans pause** (campagne précédente →
celle-ci) :

| Agents | Pages / s | Page, médiane | Page, 95 % | Volume par page | Erreurs |
|---:|---:|---:|---:|---:|---:|
| 10 | 191 → 187 | 0,043 → 0,045 s | 0,11 → 0,11 s | | 0 % |
| 100 | 212 → 212 | 0,46 → 0,44 s | 0,92 → 0,96 s | 225 → **160 Ko** | 0 % |
| 200 | 199 → 210 | 1,1 → 1,0 s | 1,7 → 1,7 s | | 0 % |

**Journée de travail** (une page toutes les 20 s par agent) :

| Agents | Page, médiane | Page, 95 % | Volume par page | Erreurs |
|---:|---:|---:|---:|---:|
| 100 | 0,018 → 0,018 s | 0,13 → 0,12 s | | 0 % |
| 300 | 0,014 → 0,015 s | 0,030 → 0,031 s | | 0 % |
| 1 000 | 0,016 → 0,016 s | 0,036 → 0,038 s | 228 → **162 Ko** | 0 % |

## Ce qui a été vérifié

- **Filtres du commerce** et **détail par pays** : mêmes octets que l'API
  d'avant, calculés puis servis du cache.
- **Premiers partenaires** contre la règle de la page d'avant — son code
  JavaScript exécuté tel quel sur le détail de l'API d'avant : 24 couples
  (sens, année) sur 24 identiques, les sept premiers comme le premier de
  l'année d'avant.
- **Dans un navigateur**, caches de l'API vides : la section Commerce
  extérieur (premier client, sa variation, les sept principaux clients)
  conforme, sans erreur.

## La suite

1. **Le serveur de production** : sur cette machine de 4 cœurs, l'API
   partage les cœurs avec la base, le site et le générateur de 1 000 agents.
2. **Les pages d'administration** les plus lourdes : zones (4,9 Mo),
   opportunités (1,9 Mo), événements (1,2 Mo), utilisateurs (1,1 Mo),
   accords (1,0 Mo) — peu de personnes s'en servent, mais à chaque ouverture.
3. Un cache partagé entre processus, si l'on veut que chaque calcul ne se
   fasse qu'une fois pour les quatre.

La base de banc a été supprimée à la fin des mesures.
