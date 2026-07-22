"""Route de l'assistant IA public.

POST /api/v1/assistant/chat — diffuse (streaming) la réponse de Claude en texte
brut. La boucle tool-use et l'appel à l'API Anthropic vivent dans
``services/ai_assistant.py``. Ici : validation d'entrée, rate-limit par IP,
garde-fous de taille, et emballage en StreamingResponse.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional

from app.core.config import get_settings
from app.services import ai_assistant

router = APIRouter(prefix="/assistant", tags=["Assistant IA"])

# Garde-fous d'entrée
_MAX_MESSAGES = 24
_MAX_LONGUEUR_MESSAGE = 6000
_MAX_LONGUEUR_CONTEXTE = 4000

# Rate-limit par IP (fenêtre glissante en mémoire). Suffisant pour un process
# unique ; pour un déploiement multi-worker, remplacer par un compteur Redis.
_appels: dict[str, deque] = defaultdict(deque)


class MessageEntree(BaseModel):
    role: str
    content: str


class RequeteChat(BaseModel):
    messages: List[MessageEntree] = Field(default_factory=list)
    contexte_page: Optional[str] = None


def _verifier_rate_limit(ip: str) -> None:
    s = get_settings()
    maintenant = time.monotonic()
    fenetre = s.ASSISTANT_RATE_FENETRE
    file = _appels[ip]
    while file and maintenant - file[0] > fenetre:
        file.popleft()
    if len(file) >= s.ASSISTANT_RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Trop de requêtes. Réessayez dans quelques minutes.",
        )
    file.append(maintenant)


@router.post("/chat")
async def chat(requete: RequeteChat, request: Request):
    if not ai_assistant.assistant_actif():
        raise HTTPException(
            status_code=503,
            detail="L'assistant n'est pas configuré (clé API manquante).",
        )

    ip = (request.client.host if request.client else "?") or "?"
    _verifier_rate_limit(ip)

    # Validation / normalisation des messages
    msgs = requete.messages[-_MAX_MESSAGES:]
    if not msgs:
        raise HTTPException(status_code=400, detail="Aucun message fourni.")
    if msgs[0].role != "user":
        raise HTTPException(status_code=400, detail="Le premier message doit être « user ».")
    if msgs[-1].role != "user":
        raise HTTPException(status_code=400, detail="Le dernier message doit être « user ».")

    messages = []
    for m in msgs:
        role = "assistant" if m.role == "assistant" else "user"
        contenu = (m.content or "").strip()[:_MAX_LONGUEUR_MESSAGE]
        if contenu:
            messages.append({"role": role, "content": contenu})
    if not messages or messages[-1]["role"] != "user":
        raise HTTPException(status_code=400, detail="Message utilisateur vide.")

    contexte = (requete.contexte_page or "").strip()[:_MAX_LONGUEUR_CONTEXTE] or None

    async def flux():
        try:
            async for fragment in ai_assistant.stream_reponse(messages, contexte):
                yield fragment
        except Exception as exc:  # noqa: BLE001 — remonter proprement au client
            yield f"\n\n⚠️ Une erreur est survenue : {exc}"

    return StreamingResponse(
        flux(),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
