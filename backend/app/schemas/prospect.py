from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID

# ── Points focaux ─────────────────────────────────────────────────────────────
class PointFocalProspectCreate(BaseModel):
    nom:          str
    prenom:       Optional[str] = None
    poste:        Optional[str] = None
    telephone:    Optional[str] = None
    mail:         Optional[str] = None
    est_principal:bool = False

class PointFocalProspectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:           UUID
    nom:          str
    prenom:       Optional[str]
    poste:        Optional[str]
    telephone:    Optional[str]
    mail:         Optional[str]
    est_principal:bool
    prospect_id:  UUID

# ── Historique ────────────────────────────────────────────────────────────────
class HistoriqueCreate(BaseModel):
    etat:       str
    commentaire:Optional[str] = None

class HistoriqueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:             UUID
    etat:           str
    commentaire:    Optional[str]
    date_changement:datetime

# ── Contacts ──────────────────────────────────────────────────────────────────
class ContactCreate(BaseModel):
    projet_nom:          str
    projet_description:  Optional[str] = None
    date_premier_contact:date
    etat_avancement:     str = "en_cours"
    commentaires:        Optional[str] = None
    contraintes:         Optional[str] = None

class ContactUpdate(BaseModel):
    projet_nom:          Optional[str]  = None
    projet_description:  Optional[str]  = None
    date_premier_contact:Optional[date] = None
    etat_avancement:     Optional[str]  = None
    commentaires:        Optional[str]  = None
    contraintes:         Optional[str]  = None

class ContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:                  UUID
    prospect_id:         UUID
    projet_nom:          str
    projet_description:  Optional[str]
    date_premier_contact:date
    etat_avancement:     str
    commentaires:        Optional[str]
    contraintes:         Optional[str]
    created_at:          datetime
    updated_at:          datetime
    historique:          List[HistoriqueResponse] = []

# ── Prospect ──────────────────────────────────────────────────────────────────
class RefSimple(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:   int
    code: str
    nom:  str

class ProspectCreate(BaseModel):
    nom:               str
    forme_juridique:   Optional[str]  = None
    date_creation_ent: Optional[date] = None
    siege_pays_id:     Optional[int]  = None
    pays:              Optional[str]  = "Sénégal"
    region_id:         Optional[int]  = None
    departement_id:    Optional[int]  = None
    arrondissement_id: Optional[int]  = None
    adresse:           Optional[str]  = None
    telephone:         Optional[str]  = None
    mail:              Optional[str]  = None
    siteweb:           Optional[str]  = None
    secteur_id:        Optional[int]  = None
    branche_id:        Optional[int]  = None
    activite_id:       Optional[int]  = None
    point_entree:            Optional[str]  = None
    type_prospect:           Optional[str]  = "hors_senegal"
    entreprise_installee_id: Optional[UUID] = None
    est_publie:              bool           = True
    points_focaux:     List[PointFocalProspectCreate] = []

class ProspectUpdate(BaseModel):
    nom:               Optional[str]  = None
    forme_juridique:   Optional[str]  = None
    date_creation_ent: Optional[date] = None
    siege_pays_id:     Optional[int]  = None
    region_id:         Optional[int]  = None
    departement_id:    Optional[int]  = None
    arrondissement_id: Optional[int]  = None
    adresse:           Optional[str]  = None
    telephone:         Optional[str]  = None
    mail:              Optional[str]  = None
    siteweb:           Optional[str]  = None
    secteur_id:        Optional[int]  = None
    branche_id:        Optional[int]  = None
    activite_id:       Optional[int]  = None
    point_entree:            Optional[str]  = None
    type_prospect:           Optional[str]  = None
    entreprise_installee_id: Optional[UUID] = None
    est_publie:              Optional[bool] = None

class ProspectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:                UUID
    nom:               str
    forme_juridique:   Optional[str]
    date_creation_ent: Optional[date]
    siege_pays_id:     Optional[int]    = None
    siege_pays_nom:    Optional[str]    = None
    pays:              Optional[str]
    region_id:         Optional[int]    = None
    region_nom:        Optional[str]    = None
    departement_id:    Optional[int]    = None
    departement_nom:   Optional[str]    = None
    arrondissement_id: Optional[int]    = None
    arrondissement_nom:Optional[str]    = None
    adresse:           Optional[str]
    telephone:         Optional[str]
    mail:              Optional[str]
    siteweb:           Optional[str]
    secteur_id:        Optional[int]
    branche_id:        Optional[int]
    activite_id:       Optional[int]
    point_entree:            Optional[str]
    type_prospect:           Optional[str]
    entreprise_installee_id:   Optional[UUID]
    entreprise_hors_senegal_id:Optional[UUID] = None
    est_publie:        bool
    created_at:        datetime
    updated_at:        datetime
    points_focaux:     List[PointFocalProspectResponse] = []
    contacts:          List[ContactResponse] = []
    secteur:           Optional[RefSimple] = None
    branche:           Optional[RefSimple] = None
    activite:          Optional[RefSimple] = None

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
        return instance

class ProspectListResponse(BaseModel):
    total:    int
    page:     int
    per_page: int
    data:     List[ProspectResponse]
