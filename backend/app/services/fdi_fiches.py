"""Lire la fiche d'un signal fDi : sa description, sa traduction, ses destinations.

POURQUOI. La liste des signaux de fDi ne montre ni description, ni plus d'une
destination par ligne : les deux se lisent dans la fiche du signal, qu'on
ouvre une à une. C'est le gros du travail restant — des milliers de signaux
sans description, et ceux dont la destination africaine est cachée. On copie
donc la fiche dans fDi, on la colle dans la plateforme, et l'API Claude en
tire en une fois :

  · la description anglaise, VERBATIM — c'est le texte de la source ;
  · sa traduction française, à relire ;
  · les destinations que le signal vise, listées par la fiche ou nommées par
    la description, rattachées ici au référentiel — pays ou région du monde.

RIEN N'EST ÉCRIT ICI. L'écran montre ce qui a été lu, l'humain coche et
enregistre : une destination se décide la fiche sous les yeux, et un pays
seulement cité dans une description (un siège, un investisseur) ne doit pas
devenir une destination parce qu'un modèle l'a cru.
"""
import base64
import json
import logging

from app.services import fdi_signaux as S
from app.services.fdi_captures import LectureImpossible, _client, actif, modele

journal = logging.getLogger(__name__)

SYSTEME = """\
Tu lis la fiche d'un signal d'investissement de fDi Markets (Financial Times) : \
l'annonce, par une entreprise, d'une intention d'investir hors de son pays — levée \
de fonds pour s'étendre, recherche de site, recrutement, projet d'implantation. On \
te donne la fiche telle qu'elle a été copiée dans fDi (texte), ou sa capture \
d'écran.

Tu rends quatre choses.

« description_en » : la description du signal, VERBATIM — le paragraphe de la \
fiche qui raconte le signal, recopié tel quel, en anglais, sans résumé ni \
correction. Pas les intitulés ni les champs (date, montants, secteurs, listes). \
Chaîne vide si la fiche n'en porte pas.

« description_fr » : sa traduction française, fidèle et sobre, dans la langue \
d'une agence de promotion des investissements : rien d'ajouté, rien d'omis ; noms \
d'entreprises, montants et devises inchangés ; noms de pays et de villes en \
français. Chaîne vide s'il n'y a pas de description.

« destinations » : chaque pays ou région du monde que le signal VISE — là où \
l'entreprise compte investir, s'implanter, s'étendre, recruter ou chercher un \
site —, un élément par destination, en anglais :
- toutes celles que la fiche liste comme destinations ;
- celles que la description désigne comme cibles de l'investissement.
N'y mets PAS le pays du siège ou d'origine de l'entreprise, ni un pays seulement \
mentionné (marché déjà servi, investisseur, partenaire, place de cotation). Un \
pays s'écrit sous son nom anglais courant (« Ivory Coast », « Democratic Republic \
of the Congo »). Une région du monde s'écrit exactement sous l'un des noms de la \
liste donnée avec la fiche ; une région qui n'y figure pas (« West Africa ») \
s'écrit telle qu'elle est nommée.

« remarque » : une phrase en français si quelque chose gêne — fiche incomplète, \
plusieurs signaux, texte qui n'est pas une fiche fDi, ou fiche d'une autre \
entreprise que celle indiquée —, sinon chaîne vide."""

SCHEMA = {
    "type": "object",
    "properties": {
        "description_en": {"type": "string"},
        "description_fr": {"type": "string"},
        "destinations": {"type": "array", "items": {"type": "string"}},
        "remarque": {"type": "string"},
    },
    "required": ["description_en", "description_fr", "destinations", "remarque"],
    "additionalProperties": False,
}

# Une fiche copiée tient en quelques milliers de caractères ; au delà, ce
# n'est plus une fiche — une page entière collée par erreur.
TEXTE_MAX = 20_000


def _net(v) -> str:
    """Espaces réduits, sauts de paragraphe gardés : une description en a."""
    texte = str(v or "").replace("\r\n", "\n").replace("\r", "\n")
    paragraphes = [" ".join(p.split()) for p in texte.split("\n\n")]
    return "\n\n".join(p for p in paragraphes if p)


async def lire_fiche(*, contexte: str, regions: list[str], texte: str | None = None,
                     image: bytes | None = None, media: str | None = None) -> dict:
    """La fiche lue : {description_en, description_fr, destinations, remarque}.

    `contexte` dit quel signal on décrit (entreprise, pays d'origine) : le
    modèle s'en sert pour écarter l'origine des destinations, et pour signaler
    une fiche qui parlerait d'une autre entreprise — on colle vite, et l'on
    colle parfois la fiche précédente."""
    if not actif():
        raise LectureImpossible("l'assistant IA n'est pas configuré sur ce serveur (clé API absente)")
    consigne = (f"Le signal à décrire : {contexte}\n"
                f"Régions du monde de fDi : {', '.join(regions)}.")
    if image is not None:
        contenu = [{"type": "image", "source": {"type": "base64", "media_type": media,
                                                "data": base64.b64encode(image).decode()}},
                   {"type": "text", "text": f"{consigne}\n\nLis la fiche ci-dessus."}]
    else:
        # Un formulaire envoie ses sauts de ligne en CRLF : ramenés à « \n »,
        # les paragraphes de la fiche restent des paragraphes.
        texte = (texte or "").replace("\r\n", "\n").replace("\r", "\n")
        contenu = [{"type": "text", "text": f"{consigne}\n\nLa fiche :\n\n{texte}"}]
    try:
        reponse = await _client().messages.create(
            model=modele(),
            # Une description et sa traduction tiennent en un millier de jetons.
            max_tokens=4000,
            system=[{"type": "text", "text": SYSTEME, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": contenu}],
            output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
        )
    except Exception as e:  # réseau, clé refusée : rien d'écrit
        journal.warning("lecture d'une fiche fDi : appel refusé (%s)", e)
        raise LectureImpossible(f"l'API n'a pas répondu ({type(e).__name__})") from e
    if reponse.stop_reason not in ("end_turn", "stop_sequence"):
        raise LectureImpossible(f"lecture interrompue ({reponse.stop_reason})")
    bloc = next((b for b in reponse.content if getattr(b, "type", None) == "text"), None)
    try:
        d = json.loads(bloc.text if bloc else "")
    except ValueError as e:
        raise LectureImpossible("réponse illisible") from e
    return {
        "description_en": _net(d.get("description_en")),
        "description_fr": _net(d.get("description_fr")),
        "destinations": [" ".join(str(x).split()) for x in d.get("destinations") or []
                         if str(x or "").strip()],
        "remarque": " ".join(str(d.get("remarque") or "").split()) or None,
    }


def rattacher(noms: list[str], ref: dict, correspondance: dict,
              deja: set[tuple[str, int]], afrique: dict) -> tuple[list[dict], list[str]]:
    """(destinations rattachées, noms non reconnus) — pure.

    Chaque nom passe par le même rapprochement que le relevé (pays par la
    correspondance des noms fDi, région du monde par son libellé) : une
    destination proposée est une destination que l'import aurait reconnue.
    Deux noms du même pays (« Ivory Coast », « Côte d'Ivoire ») n'en font
    qu'un. `deja` : les (nature, id) que le signal porte déjà.
    """
    vues: set[tuple[str, int]] = set()
    sortie: list[dict] = []
    inconnus: list[str] = []
    for nom in noms:
        nom = " ".join(str(nom or "").split())
        if not nom:
            continue
        pays, region, _ = S._destination(nom, ref, correspondance)
        if pays is None and region is None:
            if nom not in inconnus:
                inconnus.append(nom)
            continue
        cle = ("pays", pays) if pays is not None else ("region", region)
        if cle in vues:
            continue
        vues.add(cle)
        sortie.append({
            "brut": nom, "pays_id": pays, "region_id": region, "nature": cle[0],
            "deja": cle in deja,
            "afrique": (pays in afrique["pays"]) if pays is not None else (region in afrique["regions"]),
        })
    return sortie, inconnus
