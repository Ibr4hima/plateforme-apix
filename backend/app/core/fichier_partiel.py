"""
Un fichier servi en entier OU par morceaux (en-tête HTTP Range).

La visionneuse de documents du site (pdf.js) lit un PDF par morceaux quand
le serveur le permet : elle demande la table des objets, en fin de fichier,
puis les seules pages qu'elle affiche, et montre la première page d'un
document de 50 Mo sans attendre les 50 Mo. La FileResponse de Starlette 0.37
ne sait servir qu'un fichier entier : la visionneuse devait tout recevoir
avant d'afficher quoi que ce soit.

FichierPartiel s'emploie exactement comme FileResponse. Il annonce
« Accept-Ranges: bytes » ; à une requête « Range: bytes=a-b » (une plage
unique, la forme qu'emploie pdf.js), il répond 206 avec la seule plage ; à une
plage hors du fichier, 416. Sans Range — ou avec une forme qu'il ne sert pas
(plusieurs plages) —, il répond comme FileResponse : le fichier entier.
"""
import os
import re

import anyio
from starlette.responses import FileResponse
from starlette.types import Receive, Scope, Send

_PLAGE = re.compile(r"\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*")


class FichierPartiel(FileResponse):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.headers.setdefault("accept-ranges", "bytes")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        plage = None
        for nom, valeur in scope.get("headers", []):
            if nom.lower() == b"range":
                plage = valeur.decode("latin-1")
                break
        m = _PLAGE.fullmatch(plage) if plage and scope.get("method", "").upper() == "GET" else None
        if not m or (m.group(1) == "" and m.group(2) == ""):
            return await super().__call__(scope, receive, send)

        stat_result = await anyio.to_thread.run_sync(os.stat, self.path)
        taille = stat_result.st_size
        if m.group(1) == "":                      # « bytes=-N » : les N derniers octets
            debut, fin = max(0, taille - int(m.group(2))), taille - 1
        else:
            debut = int(m.group(1))
            fin = min(int(m.group(2)), taille - 1) if m.group(2) else taille - 1
        if taille == 0 or debut >= taille or debut > fin:
            await send({"type": "http.response.start", "status": 416,
                        "headers": [(b"content-range", f"bytes */{taille}".encode()),
                                    (b"accept-ranges", b"bytes"), (b"content-length", b"0")]})
            await send({"type": "http.response.body", "body": b"", "more_body": False})
            return

        # Les en-têtes du fichier entier (type, nom, etag, date), sa longueur
        # remplacée par celle de la plage
        self.set_stat_headers(stat_result)
        longueur = fin - debut + 1
        entetes = [(k, v) for k, v in self.raw_headers if k.lower() != b"content-length"]
        entetes += [(b"content-length", str(longueur).encode()),
                    (b"content-range", f"bytes {debut}-{fin}/{taille}".encode())]
        await send({"type": "http.response.start", "status": 206, "headers": entetes})
        restant = longueur
        async with await anyio.open_file(self.path, mode="rb") as fichier:
            await fichier.seek(debut)
            while restant > 0:
                bloc = await fichier.read(min(self.chunk_size, restant))
                if not bloc:
                    break
                restant -= len(bloc)
                await send({"type": "http.response.body", "body": bloc, "more_body": restant > 0})
        if restant > 0:                             # fichier raccourci entre-temps
            await send({"type": "http.response.body", "body": b"", "more_body": False})
        if self.background is not None:
            await self.background()
