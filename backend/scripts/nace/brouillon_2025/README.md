# Édition 2025 — saisie en cours

Ce dossier reçoit les fichiers de l'édition 2025 (années 2021–2025) au fil de
leur saisie, famille par famille. **L'import de déploiement ne le lit pas** :
`importer_csv` ne cherche que `edition_XXXX_*.csv` à la racine de
`scripts/nace`. Un fichier à moitié rempli (les exportations sans les
importations) ne peut donc pas partir en production : la page afficherait
2025 à l'export et rien à l'import.

Une famille n'est déplacée à la racine que COMPLÈTE (export + import, valeur
+ poids) et vérifiée :

    python3 ../verifier_principaux_produits.py .

## Principaux produits — exportations (tableaux 6 et 7) : saisies

- Source : saisie ligne à ligne, `saisie_principaux_export.py`.
- Contrôle somme des lignes = TOTAL imprimé : 10/10 conformes, écart
  d'arrondi ≤ 1 (2025 valeur : exact, 5 805 626 MFCFA).
- Recoupement 2021–2024 avec l'édition 2024 : 52 couples produit × année,
  **aucune révision**, totaux identiques.
- Nouveau produit : **« Gaz naturel liquéfié »** (premières exportations,
  2025 : 115 868 MFCFA / 593 346 t). Imprimé « - » de 2021 à 2024 : stocké
  vide (NULL = absence de flux, distinct de 0), pour que chaque produit porte
  ses cinq années comme le vérificateur l'exige.
- Chargement en base de travail vérifié puis annulé : export 2021–2025 lu
  sur l'édition 2025, somme 2025 = TOTAL.

## Reste à saisir

- Principaux produits — importations (valeur, poids).
