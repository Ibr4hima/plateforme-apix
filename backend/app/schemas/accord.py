from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class AccordBase(BaseModel):
    titre:                  str
    reference:              Optional[str]        = None
    parties_signataires:    Optional[str]        = None   # organisations libres
    parties_pays_ids:       Optional[List[int]]  = []     # FK vers ref_pays
    date_signature:         Optional[date]       = None
    date_entree_vigueur:    Optional[date]       = None
    date_expiration:        Optional[date]       = None
    commentaires:           Optional[str]        = None
    statut:                 str                  = "en_vigueur"
    est_publie:             bool                 = True
    secteur_ids:            Optional[List[int]]  = []
    branche_ids:            Optional[List[int]]  = []
    activite_ids:           Optional[List[int]]  = []


class AccordCreate(AccordBase):
    created_by: Optional[str] = None


class AccordUpdate(BaseModel):
    titre:                  Optional[str]        = None
    reference:              Optional[str]        = None
    parties_signataires:    Optional[str]        = None   # organisations libres
    parties_pays_ids:       Optional[List[int]]  = []     # FK vers ref_pays
    date_signature:         Optional[date]       = None
    date_entree_vigueur:    Optional[date]       = None
    date_expiration:        Optional[date]       = None
    commentaires:           Optional[str]        = None
    statut:                 Optional[str]        = None
    est_publie:             Optional[bool]       = None
    secteur_ids:            Optional[List[int]]  = None
    branche_ids:            Optional[List[int]]  = None
    activite_ids:           Optional[List[int]]  = None


class AccordResponse(AccordBase):
    id:           int
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
