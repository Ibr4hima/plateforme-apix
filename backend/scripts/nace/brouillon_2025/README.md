# Édition 2025 — saisie en cours

Ce dossier reçoit les fichiers de l'édition 2025 (années 2021–2025) au fil de
leur saisie, famille par famille. **L'import de déploiement ne le lit pas** :
`importer_csv` ne cherche que `edition_XXXX_*.csv` à la racine de
`scripts/nace`.

**Tout passe à la racine EN MÊME TEMPS, une fois toutes les familles
saisies et vérifiées.** Une famille seule ne suffit pas : essayé en base de
travail avec les principaux produits complets, la page prend 2025 comme
année par défaut (le curseur va jusqu'à la dernière année disponible) et
les sections Zone géographique, Partenaires par continent et Partenaires
par groupement restent vides à 2025, faute de données ; « À retenir » perd
ses lignes premier client / premier fournisseur. Publier famille par
famille donnerait cette page en production.

Vérification d'une famille, dans ce dossier :

    python3 ../verifier_principaux_produits.py .

## Principaux produits (tableaux 6 à 9) — COMPLET

Saisie ligne à ligne : `saisie_2025_principaux_produits.py`, qui écrit les
deux CSV à côté de lui. Libellés d'import normalisés comme dans les éditions
précédentes (« Machines et Appareils » → « Machines et appareils », etc.).

- Somme des lignes = TOTAL imprimé : 20/20 conformes, écart d'arrondi ≤ 1.
- **Exportations** : aucune révision de 2021–2024 (52 couples identiques,
  TOTAL identiques). Nouveau produit **« Gaz naturel liquéfié »** (2025 :
  115 868 MFCFA / 593 346 t), « - » de 2021 à 2024 stocké vide (NULL =
  absence de flux, distinct de 0).
- **Importations : 36 valeurs révisées sur 44** (9 produits sur 11 ;
  « Huiles brutes de pétrole » et « Huiles et graisses » inchangées).
  - 2021, 2022, 2023 : TOTAL identiques à l'édition 2024 — le rapport
    RÉPARTIT autrement entre produits (ex. 2021 : Machines et appareils
    −30 050, Matériels de transport +23 372), la somme de l'année ne bouge
    pas. Une erreur de lecture ne tiendrait pas cet équilibre.
  - 2024 : TOTAL revu à la baisse, **7 161 394 → 7 012 377 MFCFA
    (−149 017)** et 15 539 032 → 15 520 015 t (−19 017), presque tout sur
    « Matériels de transport et pièces détachées » (721 298 → 571 196).
    La saisie retombe exactement sur le nouveau TOTAL imprimé.
  - Conséquence sur la page : balance 2024 −3 252,3 → −3 103,3 Md FCFA,
    taux de couverture 2024 54,6 % → 55,7 %.
  - À recouper avec les autres familles de l'édition 2025 : leur total
    import 2024 doit être 7 012 377 lui aussi.
- Chargement réel en base de travail (importer.py) puis lecture API et page
  vérifiés, base remise en l'état ensuite.

## Produits regroupés — exportations (tableaux 10 et 11) : saisies

Saisie ligne à ligne : `saisie_2025_produits_regroupes.py`. Libellés du
rapport (capitales sans accents) ramenés à ceux, normalisés, des éditions
précédentes, dans l'ordre du rapport.

- Somme des lignes = TOTAL imprimé : 10/10 conformes, écarts de −2 à +3
  (32 lignes arrondies une à une, tolérance ±6).
- Aucune révision de 2021–2024 : 124 couples produit × année identiques à
  l'édition 2024, aucun poste disparu.
- Nouveau poste : **« Gaz liquéfiés naturels »** (libellé du rapport
  « GAZ LIQUEFIES NATURELS »), « - » de 2021 à 2024 : 32 postes export au
  lieu de 31. Même montant que « Gaz naturel liquéfié » des principaux
  produits.
- « 0 » et « - » distingués comme imprimés : farine de froment 2024 = 0,
  2025 = « - » (vide) ; huile raffinée d'arachide 2023 = 0, 2025 = « - ».
- **Recoupement indépendant avec les tableaux 6–7** (saisis séparément) :
  110 concordances, 0 écart, sur 11 postes présents dans les deux
  nomenclatures, valeur et poids, 2021–2025 — dont les sommes Titane +
  Zirconium = « Titane et zircon » et Coton en masse + Tissus en coton =
  « Cotons et tissus en coton ».
- Chargement en base de travail et lecture API vérifiés, base remise en
  l'état ensuite.

## Reste à saisir

- Produits regroupés — importations (tableaux 12 et 13).
- Groupes d'utilisation, continents, régions, pays (et chapitres SH si le
  rapport les contient encore).
