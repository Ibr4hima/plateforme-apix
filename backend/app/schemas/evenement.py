from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from uuid import UUID


class EvenementBase(BaseModel):
    nom_event:                  str             = Field(..., min_length=2, max_length=500)
    edition:                    Optional[int]   = Field(None, gt=0, description="Numéro d'édition, entier strictement positif")
    type_evenement:             str
    organisateur:               Optional[str]   = None
    role_apix:                  Optional[str]   = None
    description:                Optional[str]   = None
    lien_site_officiel:         Optional[str]   = None

    date_debut:                 date
    date_fin:                   date

    est_recurrent:              bool            = False
    frequence:                  Optional[str]   = None
    date_prochaine_edition:     Optional[date]  = None

    pays_nom:                   Optional[str]   = None
    ville:                      Optional[str]   = None
    lieu_nom:                   Optional[str]   = None
    est_virtuel:                bool            = False
    lien_virtuel:               Optional[str]   = None

    thematiques:                Optional[str]   = None
    pays_invites:               Optional[str]   = None
    entreprises_invitees:       Optional[str]   = None

    nombre_participants:        Optional[int]   = None
    nombre_prospects_rencontres:Optional[int]   = None
    montant_intentions_usd:     Optional[float] = None
    rapport_disponible:         bool            = False
    lien_rapport:               Optional[str]   = None

    statut:                     str             = "planifie"
    est_publie:                 bool            = True
    note_interne:               Optional[str]   = None


class EvenementCreate(EvenementBase):
    created_by: Optional[str] = None


class EvenementUpdate(BaseModel):
    nom_event:                  Optional[str]   = None
    edition:                    Optional[int]   = Field(None, gt=0, description="Numéro d'édition, entier strictement positif")
    type_evenement:             Optional[str]   = None
    organisateur:               Optional[str]   = None
    role_apix:                  Optional[str]   = None
    description:                Optional[str]   = None
    lien_site_officiel:         Optional[str]   = None
    date_debut:                 Optional[date]  = None
    date_fin:                   Optional[date]  = None
    est_recurrent:              Optional[bool]  = None
    frequence:                  Optional[str]   = None
    date_prochaine_edition:     Optional[date]  = None
    pays_nom:                   Optional[str]   = None
    ville:                      Optional[str]   = None
    lieu_nom:                   Optional[str]   = None
    est_virtuel:                Optional[bool]  = None
    lien_virtuel:               Optional[str]   = None
    thematiques:                Optional[str]   = None
    pays_invites:               Optional[str]   = None
    entreprises_invitees:       Optional[str]   = None
    nombre_participants:        Optional[int]   = None
    nombre_prospects_rencontres:Optional[int]   = None
    montant_intentions_usd:     Optional[float] = None
    rapport_disponible:         Optional[bool]  = None
    lien_rapport:               Optional[str]   = None
    statut:                     Optional[str]   = None
    est_publie:                 Optional[bool]  = None
    note_interne:               Optional[str]   = None


class EvenementResponse(EvenementBase):
    id:         UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str]      = None

    model_config = {"from_attributes": True}


class EvenementListResponse(BaseModel):
    total:      int
    page:       int
    per_page:   int
    data:       list[EvenementResponse]
