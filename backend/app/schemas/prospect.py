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
    forme_juridique:   Optional[str] = None
    date_creation_ent: Optional[date] = None
    siege_pays:        Optional[str] = None
    pays:              Optional[str] = "Sénégal"
    region:            Optional[str] = None
    departement:       Optional[str] = None
    arrondissement:    Optional[str] = None
    adresse:           Optional[str] = None
    telephone:         Optional[str] = None
    mail:              Optional[str] = None
    siteweb:           Optional[str] = None
    secteur_id:        Optional[int] = None
    branche_id:        Optional[int] = None
    activite_id:       Optional[int] = None
    point_entree:           Optional[str]  = None
    type_prospect:          Optional[str]  = 'autre'
    entreprise_installee_id:Optional[UUID]  = None
    est_publie:             bool = True
    note_interne:      Optional[str] = None
    points_focaux:     List[PointFocalProspectCreate] = []

class ProspectUpdate(BaseModel):
    nom:               Optional[str]  = None
    forme_juridique:   Optional[str]  = None
    date_creation_ent: Optional[date] = None
    siege_pays:        Optional[str]  = None
    region:            Optional[str]  = None
    departement:       Optional[str]  = None
    arrondissement:    Optional[str]  = None
    adresse:           Optional[str]  = None
    telephone:         Optional[str]  = None
    mail:              Optional[str]  = None
    siteweb:           Optional[str]  = None
    secteur_id:        Optional[int]  = None
    branche_id:        Optional[int]  = None
    activite_id:       Optional[int]  = None
    point_entree:           Optional[str]  = None
    type_prospect:          Optional[str]  = None
    entreprise_installee_id:Optional[UUID]  = None
    est_publie:             Optional[bool] = None
    note_interne:      Optional[str]  = None

class ProspectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:                UUID
    nom:               str
    forme_juridique:   Optional[str]
    date_creation_ent: Optional[date]
    siege_pays:        Optional[str]
    pays:              Optional[str]
    region:            Optional[str]
    departement:       Optional[str]
    arrondissement:    Optional[str]
    adresse:           Optional[str]
    telephone:         Optional[str]
    mail:              Optional[str]
    siteweb:           Optional[str]
    secteur_id:        Optional[int]
    branche_id:        Optional[int]
    activite_id:       Optional[int]
    point_entree:           Optional[str]
    type_prospect:          Optional[str]
    entreprise_installee_id:Optional[UUID]
    est_publie:        bool
    note_interne:      Optional[str]
    created_at:        datetime
    updated_at:        datetime
    points_focaux:     List[PointFocalProspectResponse] = []
    contacts:          List[ContactResponse] = []
    secteur:           Optional[RefSimple] = None
    branche:           Optional[RefSimple] = None
    activite:          Optional[RefSimple] = None

class ProspectListResponse(BaseModel):
    total:    int
    page:     int
    per_page: int
    data:     List[ProspectResponse]
