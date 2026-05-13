from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from uuid import UUID


class AccordBase(BaseModel):
    titre:                  str
    reference:              Optional[str]   = None
    type_accord:            Optional[str]   = None
    pays_signataires:       Optional[str]   = None
    organisation_partenaire:Optional[str]   = None
    date_signature:         Optional[date]  = None
    date_ratification:      Optional[date]  = None
    date_entree_vigueur:    Optional[date]  = None
    date_expiration:        Optional[date]  = None
    secteur_activite:       Optional[str]   = None
    branche_activite:       Optional[str]   = None
    commentaires:           Optional[str]   = None
    domaines_couverts:      Optional[str]   = None
    avantages_principaux:   Optional[str]   = None
    statut:                 str             = "en_vigueur"
    lien_texte_officiel:    Optional[str]   = None
    est_publie:             bool            = True
    note_interne:           Optional[str]   = None


class AccordCreate(AccordBase):
    created_by: Optional[str] = None


class AccordUpdate(BaseModel):
    titre:                  Optional[str]   = None
    reference:              Optional[str]   = None
    type_accord:            Optional[str]   = None
    pays_signataires:       Optional[str]   = None
    organisation_partenaire:Optional[str]   = None
    date_signature:         Optional[date]  = None
    date_ratification:      Optional[date]  = None
    date_entree_vigueur:    Optional[date]  = None
    date_expiration:        Optional[date]  = None
    secteur_activite:       Optional[str]   = None
    branche_activite:       Optional[str]   = None
    commentaires:           Optional[str]   = None
    domaines_couverts:      Optional[str]   = None
    avantages_principaux:   Optional[str]   = None
    statut:                 Optional[str]   = None
    lien_texte_officiel:    Optional[str]   = None
    est_publie:             Optional[bool]  = None
    note_interne:           Optional[str]   = None


class AccordResponse(AccordBase):
    id:           UUID
    fichier_nom:  Optional[str]      = None
    fichier_path: Optional[str]      = None
    created_at:   Optional[datetime] = None
    updated_at:   Optional[datetime] = None
    created_by:   Optional[str]      = None

    model_config = {"from_attributes": True}


class AccordListResponse(BaseModel):
    total:    int
    page:     int
    per_page: int
    data:     list[AccordResponse]
