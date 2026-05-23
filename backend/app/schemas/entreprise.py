from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, datetime


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
    id:            int
    entreprise_id: Optional[int] = None
    created_at:    Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Entreprise ──
class EntrepriseBase(BaseModel):
    nom:             str
    forme_juridique: Optional[str]  = None
    date_creation:   Optional[date] = None
    siege_pays_id:   Optional[int]   = None
    pays:            Optional[str]  = "Sénégal"
    region_id:       Optional[int]  = None
    departement_id:  Optional[int]  = None
    arrondissement_id: Optional[int] = None
    adresse:         Optional[str]  = None
    telephone:       Optional[str]  = None
    mail:            Optional[str]  = None
    siteweb:         Optional[str]  = None
    secteur_ids:     Optional[List[int]] = []
    branche_ids:     Optional[List[int]] = []
    activite_ids:    Optional[List[int]] = []
    pole_territoire_id: Optional[int] = None
    est_publie:      bool           = True

class EntrepriseCreate(EntrepriseBase):
    created_by:    Optional[str]               = None
    points_focaux: Optional[List[PointFocalCreate]] = []

class EntrepriseUpdate(BaseModel):
    nom:             Optional[str]  = None
    forme_juridique: Optional[str]  = None
    date_creation:   Optional[date] = None
    siege_pays_id:   Optional[int]  = None
    pays:            Optional[str]  = None
    region_id:       Optional[int]  = None
    departement_id:  Optional[int]  = None
    arrondissement_id: Optional[int] = None
    adresse:         Optional[str]  = None
    telephone:       Optional[str]  = None
    mail:            Optional[str]  = None
    siteweb:         Optional[str]  = None
    secteur_ids:     Optional[List[int]] = None
    branche_ids:     Optional[List[int]] = None
    activite_ids:    Optional[List[int]] = None
    pole_territoire_id: Optional[int] = None
    est_publie:      Optional[bool] = None

class EntrepriseResponse(EntrepriseBase):
    id:            int
    points_focaux: List[PointFocalResponse]    = []
    secteur:       Optional[RefSecteurResponse]  = None
    branche:       Optional[RefBrancheResponse]  = None
    activite:      Optional[RefActiviteResponse] = None
    siege_pays_nom:      Optional[str]           = None
    pole_territoire_nom: Optional[str]   = None
    region_nom:          Optional[str]           = None
    departement_nom:     Optional[str]           = None
    arrondissement_nom:  Optional[str]           = None
    created_at:    Optional[datetime]            = None
    updated_at:    Optional[datetime]            = None
    created_by:    Optional[str]                 = None
    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        instance = super().model_validate(obj, *args, **kwargs)
        if hasattr(obj, "siege_pays_obj") and obj.siege_pays_obj:
            instance.siege_pays_nom = obj.siege_pays_obj.nom_fr
        if hasattr(obj, "region_obj") and obj.region_obj:
            instance.region_nom = obj.region_obj.nom
        if hasattr(obj, "departement_obj") and obj.departement_obj:
            instance.departement_nom = obj.departement_obj.nom
        if hasattr(obj, "arrondissement_obj") and obj.arrondissement_obj:
            instance.arrondissement_nom = obj.arrondissement_obj.nom
        if hasattr(obj, "pole_territoire") and obj.pole_territoire:
            instance.pole_territoire_nom = obj.pole_territoire.pole_territoire
        return instance

class EntrepriseListResponse(BaseModel):
    total:    int
    page:     int
    per_page: int
    data:     List[EntrepriseResponse]
