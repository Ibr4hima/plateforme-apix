"""Lecture sécurisée des téléversements.

Deux garanties partout où un fichier entre dans l'application :
  - taille plafonnée, contrôlée pendant la lecture par morceaux (jamais un
    flux entier en mémoire sans borne — un upload de plusieurs Go serait un
    déni de service) ;
  - contrôle du type réel via les premiers octets (magic bytes), l'extension
    seule étant falsifiable pour déposer un fichier arbitraire servi ensuite
    par /uploads.
"""

import os

from fastapi import HTTPException, UploadFile

MAX_PDF_MB = 25      # documents (accords, projets, zones, comptes rendus…)
MAX_IMPORT_MB = 20   # fichiers de données des imports (Excel / CSV)
_CHUNK = 1024 * 1024


async def _lire_borne(fichier: UploadFile, max_mb: int) -> bytes:
    morceaux: list[bytes] = []
    total = 0
    while True:
        chunk = await fichier.read(_CHUNK)
        if not chunk:
            break
        total += len(chunk)
        if total > max_mb * 1024 * 1024:
            raise HTTPException(413, f"Fichier trop volumineux (maximum {max_mb} Mo).")
        morceaux.append(chunk)
    return b"".join(morceaux)


async def lire_pdf(fichier: UploadFile, max_mb: int = MAX_PDF_MB) -> bytes:
    """Lit un PDF téléversé : extension .pdf, taille bornée, signature %PDF."""
    ext = os.path.splitext(fichier.filename or "")[1].lower()
    if ext != ".pdf":
        raise HTTPException(422, "Seuls les fichiers PDF sont acceptés.")
    contenu = await _lire_borne(fichier, max_mb)
    if not contenu.startswith(b"%PDF-"):
        raise HTTPException(422, "Le fichier n'est pas un PDF valide.")
    return contenu


_IMPORT_EXTS = {".xlsx", ".xls", ".csv"}
_ZIP_MAGIC = b"PK\x03\x04"           # .xlsx (Office Open XML)
_OLE_MAGIC = b"\xd0\xcf\x11\xe0"     # .xls (OLE2)


async def lire_import(fichier: UploadFile, max_mb: int = MAX_IMPORT_MB) -> bytes:
    """Lit un fichier de données d'import : Excel ou CSV, taille bornée."""
    ext = os.path.splitext(fichier.filename or "")[1].lower()
    if ext not in _IMPORT_EXTS:
        raise HTTPException(422, "Formats acceptés : Excel (.xlsx, .xls) ou CSV.")
    contenu = await _lire_borne(fichier, max_mb)
    if ext == ".xlsx" and contenu[:4] != _ZIP_MAGIC:
        raise HTTPException(422, "Le fichier n'est pas un classeur Excel valide.")
    # .xls légitime en OLE2, mais on tolère un .xlsx renommé (zip) ; CSV = texte libre
    if ext == ".xls" and contenu[:4] not in (_OLE_MAGIC, _ZIP_MAGIC):
        raise HTTPException(422, "Le fichier n'est pas un classeur Excel valide.")
    return contenu
