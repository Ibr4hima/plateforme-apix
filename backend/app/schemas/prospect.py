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
class ProspectCreate(BaseModel):
    type:            str           = "physique"   # physique | morale
    nom:             str
    prenom:          Optional[str] = None
    pays_origine_id: Optional[int] = None
    telephone:       Optional[str] = None
    mail:            Optional[str] = None
    siteweb:         Optional[str] = None
    adresse:         Optional[str] = None
    details:         Optional[str] = None
    est_publie:      bool          = True

class ProspectUpdate(BaseModel):
    type:            Optional[str] = None
    nom:             Optional[str] = None
    prenom:          Optional[str] = None
    pays_origine_id: Optional[int] = None
    telephone:       Optional[str] = None
    mail:            Optional[str] = None
    siteweb:         Optional[str] = None
    adresse:         Optional[str] = None
    details:         Optional[str] = None
    est_publie:      Optional[bool] = None

class ProspectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:              int
    type:            Optional[str]
    nom:             str
    prenom:          Optional[str]     = None
    pays_origine_id: Optional[int]     = None
    pays_origine_nom:Optional[str]     = None
    telephone:       Optional[str]     = None
    mail:            Optional[str]     = None
    siteweb:         Optional[str]     = None
    adresse:         Optional[str]     = None
    details:         Optional[str]     = None
    est_publie:      bool
    created_at:      datetime
    updated_at:      datetime
    contacts:        List[ContactResponse] = []

class ProspectListResponse(BaseModel):
    total:    int
    page:     int
    per_page: int
    data:     List[ProspectResponse]
