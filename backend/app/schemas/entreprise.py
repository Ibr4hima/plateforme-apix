from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID


# ── Référentiels ──
class RefSecteurResponse(BaseModel):
    id:   int
    code: str
    nom:  str
    model_config = {"from_attributes": True}

class RefBrancheResponse(BaseModel):
    id:         int
    secteur_id: int
    code:       str
    nom:        str
    model_config = {"from_attributes": True}

class RefActiviteResponse(BaseModel):
    id:         int
    branche_id: int
    code:       str
    nom:        str
    model_config = {"from_attributes": True}


# ── Points focaux ──
class PointFocalBase(BaseModel):
    nom:           str
    prenom:        Optional[str]  = None
    civilite:      Optional[str]  = "Monsieur"
    poste:         Optional[str]  = None
    telephone:     Optional[str]  = None
    mail:          Optional[str]  = None
    est_principal: bool           = False

class PointFocalCreate(PointFocalBase):
    pass

class PointFocalResponse(PointFocalBase):
    id:            UUID
    entreprise_id: UUID
    created_at:    Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Entreprise ──
class EntrepriseBase(BaseModel):
    nom:             str
    forme_juridique: Optional[str]  = None
    date_creation:   Optional[date] = None
    siege_pays:      Optional[str]  = None
    pays:            Optional[str]  = "Sénégal"
    region:          Optional[str]  = None
    departement:     Optional[str]  = None
    commune:         Optional[str]  = None
    arrondissement:  Optional[str]  = None
    adresse:         Optional[str]  = None
    telephone:       Optional[str]  = None
    mail:            Optional[str]  = None
    siteweb:         Optional[str]  = None
    secteur_id:      Optional[int]  = None
    branche_id:      Optional[int]  = None
    activite_id:     Optional[int]  = None
    statut:          str            = "actif"
    est_publie:      bool           = True
    note_interne:    Optional[str]  = None

class EntrepriseCreate(EntrepriseBase):
    created_by:    Optional[str]               = None
    points_focaux: Optional[List[PointFocalCreate]] = []

class EntrepriseUpdate(BaseModel):
    nom:             Optional[str]  = None
    forme_juridique: Optional[str]  = None
    date_creation:   Optional[date] = None
    siege_pays:      Optional[str]  = None
    pays:            Optional[str]  = None
    region:          Optional[str]  = None
    departement:     Optional[str]  = None
    commune:         Optional[str]  = None
    arrondissement:  Optional[str]  = None
    adresse:         Optional[str]  = None
    telephone:       Optional[str]  = None
    mail:            Optional[str]  = None
    siteweb:         Optional[str]  = None
    secteur_id:      Optional[int]  = None
    branche_id:      Optional[int]  = None
    activite_id:     Optional[int]  = None
    statut:          Optional[str]  = None
    est_publie:      Optional[bool] = None
    note_interne:    Optional[str]  = None

class EntrepriseResponse(EntrepriseBase):
    id:            UUID
    points_focaux: List[PointFocalResponse]    = []
    secteur:       Optional[RefSecteurResponse]  = None
    branche:       Optional[RefBrancheResponse]  = None
    activite:      Optional[RefActiviteResponse] = None
    created_at:    Optional[datetime]            = None
    updated_at:    Optional[datetime]            = None
    created_by:    Optional[str]                 = None
    model_config = {"from_attributes": True}

class EntrepriseListResponse(BaseModel):
    total:    int
    page:     int
    per_page: int
    data:     List[EntrepriseResponse]
