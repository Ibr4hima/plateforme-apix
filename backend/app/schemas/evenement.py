from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from uuid import UUID


class EvenementBase(BaseModel):
    nom_event:          str             = Field(..., min_length=2, max_length=500)
    edition:            Optional[int]   = Field(None, gt=0)
    type_evenement:     str
    organisateur:       Optional[str]   = None
    role_apix:          Optional[str]   = None
    description:        Optional[str]   = None

    date_debut:         date
    date_fin:           date

    pays_hote_id:       Optional[int]   = None
    ville:              Optional[str]   = None
    est_virtuel:        bool            = False
    lien_virtuel:       Optional[str]   = None

    pays_invites:       Optional[str]   = None
    entreprises_invitees: Optional[str] = None
    thematiques_naema:  Optional[str]   = None

    statut:             str             = "planifie"
    est_publie:         bool            = True


class EvenementCreate(EvenementBase):
    created_by: Optional[str] = None


class EvenementUpdate(BaseModel):
    nom_event:          Optional[str]   = None
    edition:            Optional[int]   = Field(None, gt=0)
    type_evenement:     Optional[str]   = None
    organisateur:       Optional[str]   = None
    role_apix:          Optional[str]   = None
    description:        Optional[str]   = None
    date_debut:         Optional[date]  = None
    date_fin:           Optional[date]  = None
    pays_hote_id:       Optional[int]   = None
    ville:              Optional[str]   = None
    est_virtuel:        Optional[bool]  = None
    lien_virtuel:       Optional[str]   = None
    pays_invites:       Optional[str]   = None
    entreprises_invitees: Optional[str] = None
    thematiques_naema:  Optional[str]   = None
    statut:             Optional[str]   = None
    est_publie:         Optional[bool]  = None


class EvenementResponse(EvenementBase):
    id:             UUID
    pays_hote_nom:  Optional[str]   = None
    pays_hote_iso2: Optional[str]   = None
    created_at:     Optional[datetime] = None
    updated_at:     Optional[datetime] = None
    created_by:     Optional[str]      = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        instance = super().model_validate(obj, *args, **kwargs)
        if hasattr(obj, "pays_hote_obj") and obj.pays_hote_obj:
            instance.pays_hote_nom  = obj.pays_hote_obj.nom_fr
            instance.pays_hote_iso2 = obj.pays_hote_obj.code_iso2
        return instance


class EvenementListResponse(BaseModel):
    total:    int
    page:     int
    per_page: int
    data:     list[EvenementResponse]
