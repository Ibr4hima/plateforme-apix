# Mesure de la plateforme à grande échelle — 7 novembre 2026

## En bref

À un volume de grande organisation (5 000 agents, 20 000 prospects, 12 000
entreprises, 3 000 événements, 2 millions de flux commerciaux), **la plateforme
décroche dès 10 agents qui enchaînent les pages**, et dès **25 agents qui lisent
chaque page une vingtaine de secondes** : une page met alors 33 s en médiane et
une requête sur trois échoue. À 1 000 agents, 97 % des requêtes échouent.

**95 % du temps serveur vient de 5 listes téléchargées en entier par le
navigateur** (Prospects, Événements, Potentialités, Entreprises, Projets). En
ne gardant que la première page de ces listes (simulation d'une pagination côté
serveur), le débit est multiplié par 15 et les erreurs tombent sous 1 % : une
page s'ouvre en 1,1 s pour 100 agents. Il faut ensuite les autres corrections
(requêtes répétées ligne par ligne, cache, robustesse, plus de processus) pour
aller aux milliers d'agents.

Les volumes de production actuels sont bien plus petits : aujourd'hui, la
plateforme peut sembler correcte. La mesure dit ce qui arrivera quand les
données et le nombre d'utilisateurs grandiront.

## Le banc

| | |
|---|---|
| Base | 602 Mo : 2,75 millions de lignes générées + le relevé fDi réel (16 922 projets, 4 501 signaux) et le commerce extérieur (NACE) réel |
| Volumes | 5 000 agents · 20 000 prospects · 120 000 échanges · 30 000 points focaux · 40 000 coordonnées · 12 000 entreprises · 3 000 événements · 2 500 accords · 6 000 projets · 5 000 potentialités · 300 zones · 44 576 séries IDE · 208 950 indicateurs pays · 2 000 000 flux bilatéraux · 178 880 valeurs BDEF |
| API | Comme en production : uvicorn, 2 processus, pool de 10 + 20 connexions par processus |
| Site | Construit (`next build`, sortie standalone), comme en production |
| Base de données | Postgres 16, réglages par défaut (la production : Postgres 15, mêmes défauts) |
| Machine | 4 cœurs, 15 Go, partagés par le banc, l'API, la base et le site |
| Méthode | Chaque page ouverte par un vrai navigateur pour relever ses appels (760 adresses distinctes sur 43 pages), puis rejouée : tous les appels du premier écran partent ensemble, comme dans le navigateur |

## 1. Une seule personne

| Page | Requêtes | Données téléchargées | Temps (serveur) |
|---|---:|---:|---:|
| Prospects | 201 | **93,9 Mo** | **23,1 s** |
| Opportunités | 125 | 14,1 Mo | 9,4 s |
| Entreprises | 109 | 10,2 Mo | 2,6 s |
| Accueil | 40 | 4,5 Mo | 2,9 s |
| Événements | 34 | 4,3 Mo | 2,7 s |
| Zones | 5 | 4,9 Mo | 0,7 s |
| Tableau de bord | 20 | 1,0 Mo | 1,0 s |
| Accords | 29 | 1,7 Mo | 0,3 s |
| IDE | 8 | 0,2 Mo | 0,06 s |
| Statistiques | 6 | 0,2 Mo | 0,04 s |
| Admin — Entreprises / Événements / BDEF / Statistiques | 125 / 34 / 8 / 7 | 12,2 / 4,8 / 0,2 / 0,5 Mo | 3,5 / 5,0 / 3,9 / 3,6 s |

Dans le navigateur : 0,84 à 1,49 Mo de JavaScript par page (non compressé) ;
l'onglet Prospects occupe 105 Mo de mémoire, Entreprises 87 Mo ; le plus
grand affichage de Prospects arrive à 3,6 s, et son réseau ne se calme qu'au
bout de 15,6 s.

Les routes les plus lentes, appelées seules : `/bdef/verification` 3,6 s,
`/statistiques/admin/couverture` 3,3 s, `/statistiques/commerce/filtres` 0,9 s
(page Statistiques publique), `/zones-types` 0,6 s et 4,7 Mo,
`/fdi/public/entreprises/rapport` 0,6 s et 1 Mo. Toutes les autres répondent
sous 250 ms.

## 2. Sous charge — la plateforme d'aujourd'hui

Agents qui enchaînent les pages **sans pause** (capacité et point de rupture) :

| Agents | Pages servies / s | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|---:|
| 10 | 0,48 | 21,7 s | 38,9 s | 10,8 % |
| 25 | 0,58 | 37,0 s | 60,4 s | 44,5 % |
| 50 | 0,83 | 47,6 s | 61,0 s | 63,2 % |
| 100 | 1,24 | 60,4 s | 61,0 s | 83,9 % |
| 200 | 1,99 | 60,6 s | 61,2 s | 88,2 % |

**Journée de travail** : chaque agent lit sa page une vingtaine de secondes
avant d'ouvrir la suivante :

| Agents | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|
| 25 | 33,2 s | 60,4 s | 33,1 % |
| 50 | 56,6 s | 60,9 s | 65,6 % |
| 100 | 60,5 s | 61,0 s | 87,0 % |
| 300 | 60,6 s | 61,1 s | 93,5 % |
| 1 000 | 60,8 s | 67,8 s | 96,8 % |

L'API occupe 2,5 à 3,5 cœurs ; Postgres 15 à 60 % d'un cœur : **le goulot est
l'API**, pas la base. Les erreurs sont presque toutes des requêtes qui
attendent 30 s une connexion libre puis échouent (12 024 fois au premier
palier : « QueuePool limit of size 10 overflow 20 reached »), et, plus haut,
des requêtes abandonnées après 60 s.

Même **sans les 5 pages à listes complètes**, 10 agents sans pause attendent
13 s en médiane : l'accueil charge lui aussi tous les événements (voir 4.b).

## 3. Projection — listes paginées côté serveur

Simulation : seule la première page de chaque liste est demandée, comme le
ferait une page paginée. Rien d'autre ne change.

| Agents sans pause | Pages servies / s | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|---:|
| 10 | **7,41** (× 15) | **0,89 s** | 4,0 s | 0,5 % |
| 25 | 7,42 | 1,6 s | 14,3 s | 0,3 % |
| 50 | 6,74 | 4,0 s | 24,0 s | 0,5 % |
| 100 | 6,92 | 9,9 s | 30,9 s | 0,7 % |
| 200 | 7,30 | 21,1 s | 50,1 s | 0,4 % |

| Journée (pause 20 s) | Page, médiane | Page, 95 % | Erreurs |
|---:|---:|---:|---:|
| 100 | **1,1 s** | 11,7 s | 0,5 % |
| 300 | 23,7 s | 44,8 s | 0,6 % |
| 1 000 | 60,3 s | 61,0 s | 56,9 % |

Les erreurs restantes viennent toutes d'une route morte (4.g). Le plafond
d'environ 7 pages par seconde vient ensuite des événements, des potentialités
et des statistiques (4.b à 4.d) et des 2 seuls processus de l'API (4.e).

## 4. Les causes, de la plus coûteuse à la moins coûteuse

**a. Des listes téléchargées en entier par le navigateur.** Prospects,
Entreprises, Événements, Accords, Opportunités (projets, potentialités,
avantages) aspirent toute leur collection, cent lignes par requête, puis
filtrent sur place (`fetchTous`). Sur une page vue moyenne, ces listes font
95 % du temps serveur et 12,6 Mo des données téléchargées.

**b. Des requêtes répétées ligne par ligne.** Chaque événement d'une liste
lance jusqu'à 7 requêtes (noms des secteurs, branches, activités, pays invités,
arborescence, fichiers) : environ 700 par page de 100. L'accueil, qui charge les
3 000 événements pour afficher le prochain, en déclenche environ 21 000 à
chaque visite. Mesuré : la requête d'arborescence a tourné 762 893 fois.
Chaque potentialité en lance jusqu'à 8.

**c. Une liste de prospects trop lourde.** Chaque ligne embarque tous ses
échanges (commentaires compris), leurs fichiers, ses points focaux, contraintes
et cycles : 650 Ko pour 100 prospects. Et chaque page recompte les 20 000
prospects (50 à 60 ms par comptage).

**d. Des calculs refaits à chaque appel.** Les filtres de Statistiques
parcourent les 2 millions de flux pour trouver les années et les pays (0,84 s
par appel). La vérification BDEF (3,6 s) et la couverture des statistiques
(3,3 s) aussi. `/zones-types` renvoie 4,7 Mo.

**e. Un serveur sans garde-fous.** 2 processus seulement ; une requête attend
jusqu'à 30 s une connexion puis échoue en 500 (au lieu d'un 503 « réessayez ») ;
aucune durée maximale pour une requête SQL ou une attente de verrou. Base
coupée, le contrôle de santé répond quand même « ok », et les pages 500 ; à la
relance, deux requêtes échouent encore sur des connexions mortes.

**f. Des pages lourdes dans le navigateur.** 0,84 à 1,49 Mo de JavaScript par
page ; jusqu'à 105 Mo de mémoire pour l'onglet Prospects.

**g. Une route qui interroge une table supprimée.** La migration 040 a
supprimé `ref_potentialites_avantages`, mais `/ref-potentialites/flat`
l'interroge encore, et la page Opportunités l'appelle à chaque visite : une
erreur 500 à chaque fois, que l'écran masque (`.catch(() => {})`). Code mort.

## 5. Ce qu'il faut corriger, dans l'ordre

1. **Paginer et chercher côté serveur** sur les 9 pages à listes complètes, et
   donner à l'accueil une route « prochain événement ». Gain mesuré par
   simulation : × 15 de débit, erreurs sous 1 %.
2. **Supprimer les requêtes ligne par ligne** (événements, potentialités) : les
   noms se résolvent en une requête pour toute la page.
3. **Alléger la liste des prospects** : les champs de la carte seulement ; le
   détail à l'ouverture de la fiche ; un comptage par recherche, pas par page.
4. **Calculer une fois ce qui change rarement** : filtres de Statistiques,
   vérification BDEF, couverture, au moment des imports.
5. **Robustesse** : durées maximales pour les requêtes et les verrous, réponse
   503 réessayable, contrôle de santé qui interroge la base, connexions
   vérifiées avant usage, nombre de processus réglé sur le serveur.
6. **Retirer la route morte** `/ref-potentialites/flat` et ses deux appels.
7. **Relancer ce banc après chaque étape.** Objectif : 1 000 agents en journée
   de travail, une page sous la seconde pour 95 % des ouvertures, aucune erreur.
