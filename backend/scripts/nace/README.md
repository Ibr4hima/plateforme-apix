# Extractions NACE — principaux produits (tableaux 8–11)

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
