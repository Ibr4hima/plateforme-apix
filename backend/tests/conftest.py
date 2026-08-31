"""Réglages minimaux pour que les tests puissent importer le code applicatif.

`Settings` exige les identifiants PostgreSQL — c'est voulu : en production, un
démarrage sans base doit échouer tout de suite plutôt que servir des pages
vides. Mais les tests, eux, n'ouvrent aucune connexion : ils vérifient des
fonctions pures (lecture des relevés, correspondance des pays, construction
des clauses de filtrage). Sans ces valeurs, importer une route ferait échouer
le test sur la configuration au lieu de le faire passer sur le code.

`setdefault` et non une affectation : un environnement déjà réglé — celui d'un
poste de développement, celui de la CI — garde le sien.
"""
import os

for cle, valeur in (
    ("POSTGRES_HOST", "localhost"),
    ("POSTGRES_DB", "test"),
    ("POSTGRES_USER", "test"),
    ("POSTGRES_PASSWORD", "test"),
    ("SECRET_KEY", "test"),
):
    os.environ.setdefault(cle, valeur)
