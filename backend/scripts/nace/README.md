# Extractions NACE — annexes des rapports annuels

Cinq familles extraites, mêmes règles et même vérification :
- **principaux produits** (`edition_XXXX_principaux_produits.csv`,
  totaux dans `edition_XXXX_totaux.csv`) ;
- **produits regroupés** (`edition_XXXX_produits_regroupes.csv`,
  totaux dans `edition_XXXX_totaux_regroupes.csv`) — nomenclature ANSD
  plus fine (30 postes export, 56 import en 2019), libellés du PDF en
  capitales normalisés en casse normale avec accents restitués et
  fautes corrigées (RAFFINNES → raffinés, HYGYENE → hygiène, TEXTIL →
  textiles, MAIS → Maïs…). Un « - » du PDF (absence de flux) devient un
  champ vide (NULL), distinct d'un 0 ;
- **groupes d'utilisation** (`edition_XXXX_groupes_utilisation.csv`,
  totaux dans `edition_XXXX_totaux_groupes.csv`, colonne `groupe`) —
  9 groupes **exhaustifs** par sens : il n'y a pas de ligne « Autres »,
  la somme des groupes EST le total du commerce extérieur. Extraction
  par parsing (`gen_gu.py`) avec deux contrôles : somme = TOTAL du PDF,
  et **export − import = tableau balance du PDF**, ligne à ligne
  (contre-vérification indépendante de la lecture des deux tableaux).

  Attention : dans l'édition 2019, le tableau 18 (importations en
  valeur) porte des en-têtes erronés « 2014–2018 » alors que les
  valeurs sont bien 2015–2019 (son TOTAL 2019 = 4 229 294 = celui des
  autres tableaux). Les colonnes sont donc lues par position, et la
  contre-vérification par la balance confirme l'alignement.

- **chapitres SH** (`edition_XXXX_chapitres.csv`, totaux dans
  `edition_XXXX_totaux_chapitres.csv`, colonne `chapitre`) — jusqu'à
  97 chapitres du Système Harmonisé par sens, exhaustifs eux aussi.
  Extraction par `extraire_chapitres.py` ; les libellés (longs, en
  capitales, séparés par des points-virgules) sont mis en casse normale,
  les points-virgules deviennent des virgules et les accents sont
  restitués mot à mot via `lexique_chapitres.json` (fautes du PDF
  corrigées au passage : HUILLES → huiles, PARFURMERIE → parfumerie).
  Pièges traités : libellés coupés sur deux lignes AVANT les valeurs
  (l'inverse des groupes d'utilisation), en-têtes d'années qui sont
  eux-mêmes des lignes de 5 nombres, et « - » (absence de flux) qui
  aurait fait perdre une douzaine de lignes par tableau.

  L'édition 2021 a nécessité un second extracteur,
  `extraire_tableau_bbox.py`, qui repart des coordonnées des mots
  (`pdftotext -bbox-layout`) : dans ce PDF, `-layout` éclate les cellules
  d'une même ligne sur plusieurs lignes de texte et coupe un nombre en
  deux au sein de sa cellule (« 3 800 764 » rendu « 3 800 » puis « 764 »
  dessous), ce qui faisait perdre les deux chapitres les plus lourds à
  l'export. Les cellules y sont reconstituées par regroupement horizontal
  (2,2 pt entre les tranches d'un nombre, 7,4 pt entre deux cellules)
  puis fusion des fragments qui se chevauchent en x. Les éditions 2019 et
  2020, correctement rendues par `-layout`, restent extraites ainsi.

  Anomalie du rapport 2021 : le TOTAL imprimé du tableau 39
  (exportations en poids) vaut 225 404 t pour 2017 alors que la somme de
  ses 96 chapitres donne 6 835 153 t — valeur confirmée par les trois
  autres familles NACE. L'extracteur détecte un total aberrant (> 5 %),
  le signale et retient la somme des chapitres.

  À partir de l'édition 2021, l'appariement des libellés coupés est
  arbitré par la nomenclature elle-même : les fragments et les lignes
  porteuses de valeurs sont collectés séparément, puis toutes les
  combinaisons (fragment + libellé, libellé + fragment, les deux) sont
  testées contre les 96 chapitres de référence. C'est indispensable car
  la suite d'un libellé se place tantôt avant, tantôt après ses valeurs —
  parfois dans un même rapport (édition 2022 : avant en tableau 36,
  après en tableau 35).

- **continents** (`edition_XXXX_continents.csv`, totaux dans
  `edition_XXXX_totaux_continents.csv`, colonne `continent`) — six
  modalités exhaustives : **Europe, Afrique, Amérique, Asie, Océanie,
  Divers**. Les libellés du rapport (« CONTINENT EUROPEEN »…) sont
  ramenés à ces formes courtes par `extraire_continents.py`, qui refuse
  tout libellé inconnu plutôt que de l'ignorer silencieusement.

  Le découpage varie selon les éditions : 2019 publie un « CONTINENT
  AUSTRALIEN ET OCEANIQUE » unique, d'autres peuvent séparer l'Australie
  de l'Océanie. Toutes ces variantes sont ramenées à **Océanie** et
  sommées à l'extraction, si bien que la série reste comparable de 2015 à
  2024 quel que soit le découpage du rapport source.

  Anomalie du rapport 2021 : le TOTAL imprimé du tableau 27
  (exportations en poids) annonce 8 040 349 t pour 2021 alors que la
  somme de ses six continents donne 8 038 327 t. Les quatre autres
  familles convergent vers 8 038 328–8 038 331 t : c'est bien le total
  imprimé qui dévie (de 2 022 exactement). Les continents étant
  exhaustifs, l'extracteur signale l'écart et retient leur somme. Le même
  total erroné est repris tel quel par l'édition 2022 (tableau 24) —
  l'extracteur le corrige donc dans les deux éditions.

  L'édition 2022 mélange par ailleurs des tableaux à cinq colonnes
  d'années (2018–2022) et un tableau à six (le 26, qui remonte à 2017) :
  les colonnes sont donc sélectionnées d'après l'en-tête du tableau, et
  non d'après une largeur supposée. Les libellés varient aussi d'un
  tableau à l'autre au sein du même rapport (« CONTINENT OCEANIQUE » /
  « CONTINENT AUSTRALIEN ET OCEANIQUE ») — tous ramenés à Océanie.

  Comme pour les autres familles, l'édition 2020 révise fortement les
  années antérieures : les exportations 2019 vers l'Afrique passent de
  638 125 à 1 053 940 MFCFA et celles vers l'Europe de 676 461 à
  705 048 (régularisations pétrolières). Au-delà, les valeurs sont
  stables d'une édition à l'autre — celles de 2020, 2021 et 2022 sont
  reprises à l'identique par les éditions suivantes.

  À partir de l'édition 2023, les libellés perdent leur préfixe :
  « EUROPE », « AFRIQUE »… au lieu de « CONTINENT EUROPEEN ». Les deux
  formes sont reconnues. Cette édition écrit aussi les millésimes de ses
  en-têtes « 2 019 », d'où la normalisation des espaces avant lecture des
  colonnes. Elle corrige enfin le total du poids exporté 2021
  (8 038 328 t au lieu des 8 040 349 t imprimés en 2021 et 2022).

  Anomalie du rapport 2024 : le tableau 25 (importations en valeur) porte
  des en-têtes décalés d'un an (« 2 019 » à « 2 023 » alors que ses
  valeurs sont 2020–2024). Sa ligne TOTAL le prouve — 7 161 394 MFCFA en
  dernière colonne, soit le total 2024 des trois autres familles — et le
  recoupement des six continents pour 2023 avec l'édition 2023 concorde à
  l'unité. L'extracteur détecte l'incohérence, relit les colonnes par
  position et le signale.

Produits regroupés — notes par édition : nomenclature stable sur les
six éditions (30 postes export, 56 import) ; l'édition 2024 (années
2020–2024) ajoute la ligne export « Huiles brutes de pétrole »
(Sangomar : 464 555 MFCFA / 1 427 941 t en 2024, rétropolage extrait
d'« Autres produits », recollage exact : 538 325 = 542 328 − 4 003),
soit 31 postes export — sans renommer « Produits pétroliers »,
contrairement aux principaux produits.

La tolérance d'arrondi du vérificateur est de ±3 pour les principaux
produits (~15 lignes sommées) et ±6 pour les produits regroupés
(56 lignes) : chaque ligne du PDF étant arrondie, la dérive cumulée
croît avec le nombre de lignes (constaté : +5 sur import poids 2017 de
l'édition 2020, transcription revérifiée exacte par re-parse
indépendant — c'est le TOTAL du PDF qui dévie).

# Principaux produits (tableaux 8–11)

Données extraites des annexes des Notes d'Analyse du Commerce Extérieur
(NACE, ANSD) : principaux produits exportés/importés en **valeur**
(millions FCFA, tableaux 8 et 10) et **poids net** (tonnes, tableaux 9
et 11). Extraction contrôlée via `pdftotext -layout` puis validée par
`verifier_principaux_produits.py` (sommes des lignes vs ligne TOTAL du
PDF, complétude 5 années par produit).

## Fichiers

- `edition_XXXX_principaux_produits.csv` — lignes produit × sens × année
  (colonnes : produit, sens, annee, valeur, poids, edition). La ligne
  TOTAL du PDF n'est pas stockée ; « Autres produits » l'est.
- `edition_XXXX_totaux.csv` — les lignes TOTAL du PDF, uniquement pour
  le contrôle d'intégrité.
- `verifier_principaux_produits.py` — vérification (tolérance d'arrondi
  ±3 : le PDF somme des valeurs non arrondies puis arrondit les lignes).

## Normalisation des libellés

Les libellés du PDF sont normalisés (casse, fautes) et unifiés entre
tableaux valeur/poids pour que la jointure tienne :

| PDF | Normalisé |
|---|---|
| Produits Pétroliers | Produits pétroliers |
| Produits de la Pêche | Produits de la pêche |
| Produits Arachidiers | Produits arachidiers |
| Cuirs et Peaux | Cuirs et peaux |
| Machines et Appareils | Machines et appareils |
| Produits Céréaliers | Produits céréaliers |
| Matériels de Transports et Pièces détachées | Matériels de transport et pièces détachées |
| Produits des industries para chimiques | Produits des industries parachimiques |

## Édition 2020 — nomenclature remaniée et fortes révisions

L'édition 2020 (années 2016–2020) change la nomenclature des principaux
produits et révise lourdement 2016–2019 (régularisations des produits
pétroliers annoncées dans l'avant-propos 2019) : total exports 2019 =
2 446 666 MFCFA contre 1 985 091 dans l'édition 2019 (+23 %). C'est la
raison d'être de la colonne `edition` — chaque édition est stockée
telle quelle, la lecture retient la plus récente.

Renommages/regroupements observés (cohérence vérifiée) :
- « Or non monétaire » → **Or industriel** (mêmes valeurs 2016–2019) ;
- « Titane » + « Zirconium » → **Titane et zircon** (somme exacte) ;
- « Produits de la pêche » → **Produits halieutiques** ;
- « Ciment » → **Ciment hydraulique** ;
- « Engrais » → **Engrais minéraux** (série différente, revue) ;
- imports : « Huiles brutes de pétrole » + « Produits pétroliers finis »
  fusionnés (et élargis) dans **Produits pétroliers** ; nouvelles lignes
  Produits chimiques, Produits laitiers fruits et légumes, Papiers et
  carton, Sucres et produits sucrés, Boissons et tabacs ; « Métaux
  communs et ouvrages… » → **Métaux et ouvrages en métaux** ;
  « Matières plastiques et artificielles » → **Matières plastiques
  artificielles**.
- « Sel » et « Cuirs et peaux » quittent le panier export.

Fautes du PDF 2020 corrigées : « Miatériels de transport » →
« Matériels de transport et pièces détachées » (T11) ; « Préparation
pour soupe, potages, bouillons » → « Préparations pour soupes, potages,
bouillons » (aligné sur 2019).

## Édition 2021 — les imports reviennent au découpage 2019

L'édition 2021 (années 2017–2021) garde la nomenclature export de 2020
(mêmes valeurs 2017–2020, libellé « Préparations pour soupes, potages
et bouillons » → normalisé sans le « et », comme les autres éditions),
mais les **imports reviennent au découpage de l'édition 2019** (Huiles
brutes de pétrole et Produits pétroliers finis séparés, Produits
pharmaceutiques, Produits des industries parachimiques…) — avec des
valeurs révisées (ex. Produits pétroliers finis 2017 : 523 767 contre
288 835 dans l'édition 2019). Les lignes 2020 propres à l'édition 2020
(Produits chimiques, Produits laitiers fruits et légumes, Papiers et
carton, Sucres et produits sucrés, Boissons et tabacs) disparaissent.

## Édition 2022 — céréales éclatées, numérotation décalée

L'édition 2022 (années 2018–2022) numérote les tableaux 6–9 (et non
plus 8–11). Exports inchangés (nomenclature 2020/2021, valeurs
2018–2021 identiques). Imports : « Produits céréaliers » est éclaté en
**Riz / Blé / Maïs / Autres céréales** (somme 2018 = 407 748 = ligne
d'origine, découpage exact) et plusieurs lignes sont révisées
(Machines et appareils 2019 : 658 691 contre 604 417 en 2021).
Fautes corrigées : « Maîs »/« Mais » → « Maïs ».

## Édition 2023 — retour à la ligne « Produits céréaliers »

L'édition 2023 (années 2019–2023) abandonne l'éclatement Riz/Blé/Maïs
de 2022 et revient à la ligne unique « Produits céréaliers » (somme
2022 = 684 327 = les 4 lignes de l'édition 2022, recollage exact).
Exports inchangés (valeurs 2019–2022 identiques). Légères révisions
côté imports (Produits pharmaceutiques, Autres produits).

## Édition 2024 — l'huile brute de pétrole entre dans le panier export

L'édition 2024 (années 2020–2024) crée la ligne export **« Huile brute
de pétrole »** (premières exportations de Sangomar : 464 555 MFCFA /
1 427 941 t en 2024) et renomme « Produits pétroliers » en **« Autres
produits pétroliers »** (mêmes valeurs). Le rétropolage 2020–2023 de
l'huile brute est extrait d'« Autres produits » (2020 : 622 296 =
626 299 − 4 003, recollage exact en valeur comme en poids). Légères
révisions des imports (Machines et appareils 2020 : 612 244 contre
604 249 en 2023).

## Famille pays / régions (tableaux 34–37, puis 31–34 dès 2022)

Seule famille **hiérarchique** : une ligne de région porte son sous-total,
suivie du détail de ses pays. Une lecture unique alimente donc les deux
granularités (`nace_regions` et `nace_pays`). Les libellés de pays sont
conservés BRUTS, en capitales, parce qu'ils servent de clé de rapprochement
au référentiel (cf. `alias_pays_nace.json` et
`verifier_rapprochement_pays.py`) ; l'affichage passe ensuite par
`ref_pays.nom_fr`, ou « Autres pays » pour les partenaires hors référentiel.

### Un 13e groupe qui n'est pas une région géographique

Le rapport ferme ses tableaux sur un groupe résiduel, dont le nom change
selon l'édition et le sens : **`DIVERS`** à l'export, **`NCA`** (« non classé
ailleurs ») dans les tableaux d'import de 2019, **`DIVERS (PBE,PBF,OM,nda..)`**
à partir de 2021. Identité vérifiée au chiffre près contre la famille
continents, dont le « Divers » vaut exactement la même chose (édition 2019,
import : 4 922 / 4 342 / 5 696 / 5 147 / 15 001 MFCFA et 11 462 / 4 798 /
12 650 / 8 500 / 74 830 t).

Ce groupe n'a **pas** de détail pays dans les éditions 2019 et 2020 : sa
ligne est à la fois le sous-total et son unique partenaire. L'édition 2021
le détaille enfin (provisions de bord étrangères et françaises, divers non
déterminés ailleurs, origines mélangées), et la somme boucle : 8 + 1 +
5 366 + 476 = 5 851, le sous-total imprimé du tableau 36 pour 2017.
L'extraction n'injecte donc la ligne de région comme partenaire que si la
région est imprimée sans détail — sans quoi 2021 serait double-comptée.

### Libellés de régions rendus stables entre éditions

Le rapport renomme, fusionne et se trompe de graphie d'une édition à
l'autre. Toutes ces variantes sont ramenées à 12 libellés stables :

| Variantes du rapport | Libellé retenu | Vérification |
|---|---|---|
| `COMMUNAUTE EUROPEENNE` (2019), `EUROPEENE` à un seul N (T36–37), `UNION EUROPEENNE` (2020+) | Union européenne | mêmes 27 partenaires, Royaume-Uni compris |
| `AFRIQUE DE L'OUEST` (2019), `AFRIQUE OCCIDENTALE` (2020+) | Afrique occidentale | mêmes 15 partenaires |
| `CONTINENT AUSTRALIEN` + `OCEANIE` (2019), `OCEANIE` seule (2020+) | Océanie | 3 192 + 1 = 3 193, valeur qu'imprime l'édition 2020 |
| `D''ASIE` (apostrophe doublée), `L’OCEANIE` (apostrophe courbe) | — | `cle()` retirant la ponctuation, une entrée suffit |

L'édition 2021 est la plus incohérente : ses tableaux 34–35 emploient la
nomenclature 2020 (`UNION EUROPEENNE`, `AFRIQUE OCCIDENTALE`) tandis que
ses tableaux 36–37 reviennent à celle de 2019 (`COMMUNAUTE EUROPEENE`,
`AFRIQUE DE L'OUEST`).

### Colonnes repérées par page, et non par tableau

`pdftotext -layout` réaligne les colonnes **à chaque page**, et un tableau
pays en couvre plusieurs : le tableau 37 de l'édition 2020 imprime ainsi
ses régions à trois indentations différentes. Des bornes de colonnes
médianes calculées sur tout le tableau ne collent alors à aucune page, ce
qui fait échouer la lecture des lignes à cellules vides. Deux dégâts
observés avant correction, tous deux silencieux au comptage de colonnes :

- `TONGA` perdu dans le tableau 37 de 2020 (seules 2019 et 2020 sont
  imprimées), et l'Océanie faussée en conséquence ;
- un écart de 7 unités sur « Autres pays d'Asie » en 2018 (tableau 36),
  que l'on aurait pu prendre pour de l'arrondi — c'était bien une valeur
  posée dans la mauvaise colonne.

Les bornes sont donc mesurées par page, avec repli sur les bornes globales
si une page est trop courte pour en fournir.

### Contrôles

`verifier_pays.py` enchaîne quatre contrôles, dont un seul est réellement
indépendant — une somme comparée à un total lu dans le même tableau ne
prouve rien si les deux viennent de la même ligne mal lue :

1. Σ pays d'une région = sous-total imprimé (tolérance 6) ;
2. Σ régions = ligne TOTAL (tolérance 8) ;
3. complétude : 12 régions × 2 sens × 5 ans, chaque partenaire présent en
   valeur comme en poids ;
4. **Σ régions d'un continent = famille `nace_continents`** — deux
   extractions distinctes confrontées (tolérance 3).

Mesures sur les six éditions : écart maximum de **5** sur un sous-total de
région, **3** sur les TOTAL et **4** sur le contrôle inter-familles. Ce
dernier ne dépasse 1 que sur les éditions 2023 et 2024, dont les sous-totaux
fautifs demandent une correction en cascade appuyée sur trois sources
arrondies indépendamment (détail pays, ligne TOTAL, table continents).

| Édition | Lignes pays | Σ pays → sous-total | Σ régions → TOTAL | régions → continents |
|---|---|---|---|---|
| 2019 | 1 835 | 5 | 2 | 1 |
| 2020 | 1 840 | 5 | 2 | 1 |
| 2021 | 1 850 | 5 | 3 | 1 |
| 2022 | 1 860 | 5 | 3 | 1 |
| 2023 | 1 815 | 3 | 1 | 4 |
| 2024 | 1 800 | 4 | 2 | 3 | Ce sont des arrondis — le rapport arrondit chaque sous-total
indépendamment de son détail. Toute erreur réelle se compte en milliers.

### Éditions 2022 et 2023 — sous-totaux fautifs, et comment les trancher

La numérotation glisse : les tableaux pays sont les **31 à 34**, non plus les
34 à 37. Quatre difficultés nouvelles, dont trois silencieuses.

**Libellé de région coupé en deux lignes.** Le tableau 33 de 2022 imprime
« LES PAYS MEMBRES DE LA COMMUNAUTE » seul, puis « EUROPEENE » avec les
valeurs. Sans recollage, la région disparaît et un pays fantôme
« EUROPEENE » la remplace. Le recollage n'est retenu que s'il produit une
région déclarée, si bien qu'un pied de page ne peut pas contaminer le
libellé suivant.

**Nombre de colonnes variable dans une même édition.** Le tableau 34 de 2022
porte six millésimes (2017–2022) là où les trois autres en portent cinq. La
lecture de l'en-tête le gère déjà, mais il faut noter que le millésime est
parfois imprimé « 2 022 », avec une espace.

**Préfixe des régions supprimé en 2023.** « LES PAYS DE L'AFRIQUE
CENTRALE » devient « AFRIQUE CENTRALE ». Le garde-fou qui exigeait le
préfixe « LES » ne protège donc plus : c'est l'assertion sur le nombre de
régions et le contrôle des sous-totaux qui prennent le relais.

**Pieds de page à police cassée.** L'édition 2023 rend ses pieds de page en
caractères illisibles — `!"#$%&'()(*+,$%&-%."//$01$%$2#$03$-0%…` — suivis du
numéro de page. Cette ligne passait pour un partenaire portant une valeur :
le numéro 59 gonflait l'Afrique orientale et du Sud de 59 unités, et le
libellé revenant à chaque page déclenchait un faux doublon. Un libellé doit
désormais porter au moins deux lettres.

### Arbitrage des sous-totaux incohérents

Les éditions 2022 et 2023 impriment des sous-totaux de région qui ne
s'accordent pas avec leur propre détail. Le **signe** de l'écart tranche, et
il tranche logiquement — un sous-total ne peut pas être inférieur à la somme
des lignes qu'il totalise :

| Situation | Lecture | Cas observé |
|---|---|---|
| Σ pays **>** sous-total | le sous-total est faux, le détail fait foi | éd. 2022, T33, Amérique centrale et du Sud 2021 : 220 474 imprimé contre 221 397 sommés — et l'édition 2021 imprimait 221 396 |
| Σ pays **<** sous-total | le rapport ne ventile pas tout | éd. 2022, T34, Océanie 2022 : 8 365 contre 8 341 — l'édition 2023 réimprime les deux mêmes chiffres, ce n'est donc pas une coquille |

Le résidu non ventilé est versé à une ligne synthétique
« NON VENTILE — <région> », qui rejoint « Autres pays » de sa région à la
lecture : rien n'est perdu, rien n'est inventé, et les deux invariants
tiennent. L'import reconnaît ces lignes à leur préfixe.

Reste un écart que le détail ne peut pas arbitrer, faute d'en avoir : celui
d'une région imprimée sans ventilation. Après correction des autres
sous-totaux, s'il subsiste un écart avec la ligne TOTAL et qu'une seule
région est dans ce cas, elle le porte nécessairement. C'est « Divers » dans
l'édition 2023, sous-évalué de 9 000 à 26 364 à l'export — le TOTAL y est
resté celui de l'édition 2022 — et sur-évalué de 451 à 2 474 à l'import, où
le rapport lui a transféré ce qu'il retirait à « Autres pays d'Europe ».

**La famille continents confirme la correction dans les deux sens, au chiffre
près** : avant correction, elle affiche pour l'import un écart de
−451/−522/−2 474/−979 sur Europe et exactement +451/+522/+2 474/+979 sur
Divers. Ce miroir est la preuve du transfert, et il vient d'une extraction
indépendante.

### Belgique et Luxembourg séparés à partir de 2023

Jusqu'à l'édition 2022, le rapport n'a qu'une ligne
« BELGIQUE-LUXEMBOURG », héritée de l'union économique belgo-luxembourgeoise.
L'édition 2023 les sépare — et tranche la question rétroactivement : elle
imprime BELGIQUE 28 287 pour 2019, exactement ce que l'édition 2022 donnait à
l'UEBL, et LUXEMBOURG à « - » sur toutes les années. Le montant était donc
entièrement belge, ce qui valide l'alias BELGIQUE-LUXEMBOURG → Belgique. Cet
alias ne sert plus que pour 2015–2018, qu'aucune édition récente ne couvre.

### Édition 2024 — mêmes défauts que 2023, et la Chine à deux graphies

L'édition 2024 reprend la nomenclature sans préfixe de 2023 et reproduit
exactement les mêmes sous-totaux fautifs sur « Autres pays d'Europe » et
« Divers », aux mêmes montants pour les années communes — ce qui confirme au
passage que ces défauts sont bien recopiés d'une édition à l'autre et non
introduits par la lecture. L'arbitrage par le signe les traite sans
intervention nouvelle.

Deux points propres à cette édition :

**Pied de page lisible.** Là où 2023 rendait ses pieds de page en police
cassée, 2024 les imprime en clair — « Note d'analyse du commerce exterieur -
Edition 2024 » suivi du numéro de page — et le filtre « au moins deux
lettres » ne suffisait plus. Le discriminant retenu est la casse : les
tableaux écrivent leurs libellés en capitales, les pieds de page en casse
mixte. La *majorité* de capitales suffit, et il la faut : le groupe
« DIVERS (PBE,PBF,OM,nda..; etc) » porte un « nda » en minuscules.

**La Chine change de graphie entre deux tableaux du même sens.** Le tableau
32 écrit « CHINE » quand les trois autres écrivent « REPUBLIQUE POPULAIRE DE
CHINE ». Les deux se rattachent bien à la Chine et la lecture les recollerait
(l'agrégation porte sur `ref_pays_id`), mais cela laisserait la Chine sur deux
lignes à l'export — l'une avec la valeur, l'autre avec le poids — et ferait
sonner pour rien le contrôle d'appariement valeur/poids, qui est précisément
l'alarme des lignes perdues. Une table `SYNONYMES` ramène donc la variante à
la forme employée par le reste de l'édition.

## Corrections apportées aux données (édition 2019)

- **« Autres produits » — export, poids (T9)** : le PDF imprime cette
  ligne en *milliers de tonnes* par erreur (814 / 677 / 871 / 875 / 905)
  alors que le reste du tableau est en tonnes — la somme des lignes
  accusait ~900 000 t d'écart avec le TOTAL. Valeurs reconstruites par
  différence TOTAL − somme des autres lignes : 813 636 / 676 742 /
  870 828 / 875 352 / 905 467 t (chacune s'arrondit exactement au
  millier imprimé, ce qui confirme le diagnostic).

## Anomalies du PDF conservées telles quelles

- **« Engrais » — export** : valeur constante 4 003 MFCFA et poids 4 t
  sur 2015–2019 (le tableau 12 « Engrais minéraux et chimiques » donne
  des valeurs différentes et croissantes : nomenclature distincte).
  Les totaux du PDF intègrent bien 4 003 → conservé verbatim.
- **« Cuirs et peaux » — export, poids** : 3 834 puis 1 / 3 / 3 / 5 t
  (2016–2019) ; incohérent avec T13 (1 607 / 1 756 / 2 067 / 3 470 t)
  mais cohérent avec le TOTAL de T9 → conservé verbatim.
