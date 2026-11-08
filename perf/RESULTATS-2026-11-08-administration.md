# Pages d'administration allégées — dixième campagne, 8 novembre 2026

Mêmes scénarios et même machine que les campagnes précédentes
([départ](RESULTATS-2026-11-07.md), …, [tableau de bord](RESULTATS-2026-11-08-tableau-de-bord.md)) ;
base de banc régénérée au même volume, API lancée par `demarrer.sh`
(4 processus). Résultats bruts : `perf/resultats/2026-11-08-administration/`.

## En bref

- **Les cinq pages d'administration les plus lourdes** : **9,9 → 0,57 Mo**
  à elles cinq à l'ouverture ; l'attente passe sous 80 ms pour chacune
  (gestion des zones **643 → 59 ms**, utilisateurs **283 → 30 ms**).
- **Plus de liste tronquée** : les grilles des potentialités et des
  avantages s'arrêtaient à 1 000 fiches, et les compteurs calculés sur elles
  avec ; grilles et compteurs disent désormais toutes les fiches. La page
  Utilisateurs gagne une recherche.
- **« Modifier » rempli avec la fiche complète** (zones, potentialités,
  avantages), relue au moment de modifier.
- **Sous charge** : rien n'a bougé ailleurs — le parcours des agents ne
  passe pas par l'administration ; aucune erreur.

## Ce qui a changé

**Gestion des zones (4,9 Mo).** La page téléchargeait toutes les zones avec
toutes leurs entreprises (15 000 sur le banc) pour n'en afficher que des
compteurs. Elle lit désormais les cartes et leurs compteurs
(`/zones-types/cartes`, la route de la page Zones) ; la fiche d'une zone et
ses entreprises se lisent à son ouverture et après chaque écriture
(`/zones-types/{id}`).

**Opportunités (1,8 Mo).** À l'ouverture, quel que soit l'onglet, la page
téléchargeait potentialités et avantages, toutes colonnes (descriptions
comprises), tronqués à 1 000 chacun : sur le banc, la grille et le compteur
des potentialités s'arrêtaient à 1 000 sur 4 888, la grille des avantages à
1 000 sur 2 000. Elle lit désormais les
compteurs des onglets et des niveaux (`/opportunites/admin/compteurs`),
puis les cartes d'un onglet quand on l'ouvre — pour les potentialités,
celles du seul niveau affiché — avec les seuls champs des cartes, sans
troncature. Les grilles s'affichent soixante cartes à la fois.

**Accords, événements (1,0 et 1,2 Mo).** Toute la collection à chaque
ouverture (2 500 accords, 3 000 événements). Désormais soixante cartes à la
fois au fil du défilement (`/accords/admin/cartes`,
`/evenements/admin/cartes`), avec l'ordre et la recherche de la page
appliqués par la base. Pour les événements, l'ordre de travail (en cours, à
venir, sans date, terminés), puis la date, puis le nom dans l'ordre
alphabétique français (collation ICU `fr`, celle du navigateur) ; le
prochain événement est cherché parmi tous.

**Utilisateurs (1,1 Mo).** Les 5 000 comptes à chaque ouverture. Désormais
cinquante à la fois, dans l'ordre des adresses, avec une recherche
(adresse, prénom, nom) — nouvelle sur cette page (`/auth/users/liste`).

**« Modifier ».** Les formulaires des zones, potentialités et avantages se
remplissaient avec la carte : avec une carte allégée, la description aurait
été vidée à l'enregistrement. Ils se remplissent désormais avec la fiche
complète, relue au moment de modifier ; la vue d'une potentialité affiche de
même sa fiche complète.

Ces listes (publiées ou non) sont réservées à l'administration : elles
demandent le jeton de la session.

## Ce que l'administrateur attend

Chaque page ouverte comme l'administration l'ouvre : toutes les demandes du
premier écran en même temps, avec l'en-tête `Cache-Control: no-cache` que
ses pages envoient — donc calculées à chaque fois. API d'avant et d'après
sur la même base, cinq ouvertures, la médiane ; volume des réponses de
l'API.

| Page | Attente | Reçu |
|---|---:|---:|
| Gestion des zones | 643 → **59 ms** | 4,86 → **0,23 Mo** |
| Opportunités | 161 → **75 ms** | 1,82 → **0,21 Mo** |
| Événements | 168 → **32 ms** | 1,18 → **0,04 Mo** |
| Utilisateurs | 283 → **30 ms** | 1,07 → **0,03 Mo** |
| Accords | 117 → **27 ms** | 0,99 → **0,06 Mo** |

Puis, à la demande :

| Ouverture | Attente | Reçu |
|---|---:|---:|
| Fiche d'une zone (la plus fournie) | 18 ms | 0,02 Mo |
| Onglet Avantages (2 000 fiches) | 52 ms | 0,57 Mo |
| Onglet Potentialités, niveau pôle (4 888 fiches) | 196 ms | 1,59 Mo |

L'onglet Potentialités reste lourd quand un niveau compte des milliers de
fiches : le banc les met toutes au niveau pôle. Il les montre toutes, quand
la page d'avant en téléchargeait 1 000, tous niveaux confondus, à chaque
ouverture.

Le mode « une personne » du banc (`pages.json`) n'envoie pas cet en-tête :
il sert du cache les routes qui en ont, et ses temps ne sont pas ceux de
l'administration.

## Sous charge

Le parcours des agents ne passe pas par l'administration : la campagne
vérifie que rien n'a bougé ailleurs (campagne précédente → celle-ci).

| Agents sans pause | Pages / s | Page, médiane | Page, 95 % | Volume par page | Erreurs |
|---:|---:|---:|---:|---:|---:|
| 10 | 187 → 210 | 0,045 → 0,040 s | 0,11 → 0,095 s | | 0 % |
| 100 | 212 → 212 | 0,44 → 0,46 s | 0,96 → 0,90 s | 160 → 161 Ko | 0 % |
| 200 | 210 → 212 | 1,0 → 0,99 s | 1,7 → 1,7 s | | 0 % |

| Journée de travail | Page, médiane | Page, 95 % | Volume par page | Erreurs |
|---:|---:|---:|---:|---:|
| 100 | 0,018 → 0,017 s | 0,12 → 0,14 s | | 0 % |
| 300 | 0,015 → 0,015 s | 0,031 → 0,031 s | | 0 % |
| 1 000 | 0,016 → 0,017 s | 0,038 → 0,040 s | 162 → 162 Ko | 0 % |

## Ce qui a été vérifié

- **Chaque nouvelle liste contre la règle de la page d'avant**, son code
  JavaScript réécrit à l'identique et appliqué aux listes complètes de
  l'API d'avant : 27 contrôles sans écart — cartes et fiches des 300 zones ;
  compteurs et cartes des potentialités de chaque niveau ; avantages avec
  et sans recherche ; accords et événements (sept et huit recherches :
  ordre, total, prochain événement) ; utilisateurs (cinq recherches). Des
  événements de test couvraient les dates manquantes, les récurrents sans
  date fixée, et l'ordre alphabétique à date égale (accents, majuscules,
  ligatures).
- **Dans un navigateur**, sur le site construit : les trois formulaires
  « Modifier » remplis avec le texte complet, la fiche d'une zone et ses
  entreprises, défilement et recherche des accords, événements et
  utilisateurs — 7 vérifications sur 7, sans erreur.
- Tests de l'API (184) ; types du site (tsc).

## La suite

1. **La vérification de la BDEF** (`/bdef/verification`) : 1,7 s de calcul
   à chaque ouverture de la page d'administration BDEF — désormais la plus
   lente de l'administration.
2. **Le rapport des entreprises de l'IDE**
   (`/fdi/public/entreprises/rapport`) : 1 Mo et 0,6 s, page publique.
3. **L'onglet Potentialités**, si un niveau devait compter des milliers de
   fiches : les paginer comme les accords, filtres compris.
4. **Le serveur de production** : sur cette machine de 4 cœurs, l'API
   partage les cœurs avec la base, le site et le générateur de 1 000 agents.

La base de banc, avec les données de test des vérifications (14 événements,
un secteur renommé), a été supprimée à la fin des mesures.
