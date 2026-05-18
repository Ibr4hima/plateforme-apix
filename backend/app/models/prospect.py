from sqlalchemy import Column, String, Boolean, Date, Text, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
import uuid
from app.core.database import Base
from app.models.shared import RefPays
from app.models.entreprise import RefRegion, RefDepartement, RefArrondissement, RefSecteur, RefBranche, RefActivite


class EntrepriseHorsSenegal(Base):
    __tablename__ = "entreprises_hors_senegal"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom             = Column(String(255), nullable=False)
    forme_juridique = Column(String(100))
    date_creation   = Column(Date)
    statut          = Column(String(20), default="actif")

    siege_pays_id   = Column(Integer, ForeignKey("ref_pays.id"))

    adresse         = Column(Text)
    telephone       = Column(String(50))
    mail            = Column(String(255))
    siteweb         = Column(Text)

    secteur_id      = Column(Integer, ForeignKey("ref_secteurs.id"))
    branche_id      = Column(Integer, ForeignKey("ref_branches.id"))
    activite_id     = Column(Integer, ForeignKey("ref_activites.id"))

    est_publie      = Column(Boolean, default=True)
    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())
    created_by      = Column(String(100))
    is_deleted      = Column(Boolean, default=False)

    siege_pays_obj  = relationship("RefPays",    foreign_keys=[siege_pays_id], lazy="joined")
    secteur         = relationship("RefSecteur", foreign_keys=[secteur_id],    lazy="joined")
    branche         = relationship("RefBranche", foreign_keys=[branche_id],    lazy="joined")
    activite        = relationship("RefActivite",foreign_keys=[activite_id],   lazy="joined")


class Prospect(Base):
    __tablename__ = "prospects"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom               = Column(String(255), nullable=False)
    forme_juridique   = Column(String(100))
    date_creation_ent = Column(Date)
    siege_pays_id     = Column(Integer, ForeignKey("ref_pays.id"))
    pays              = Column(String(100), default="Sénégal")
    region_id         = Column(Integer, ForeignKey("ref_regions.id"))
    departement_id    = Column(Integer, ForeignKey("ref_departements.id"))
    arrondissement_id = Column(Integer, ForeignKey("ref_arrondissements.id"))
    adresse           = Column(Text)
    telephone         = Column(String(30))
    mail              = Column(String(255))
    siteweb           = Column(String(255))
    secteur_id        = Column(Integer, ForeignKey("ref_secteurs.id"))
    branche_id        = Column(Integer, ForeignKey("ref_branches.id"))
    activite_id       = Column(Integer, ForeignKey("ref_activites.id"))
    point_entree             = Column(Text)
    type_prospect            = Column(String(20), default="hors_senegal")
    entreprise_installee_id  = Column(UUID(as_uuid=True), ForeignKey("entreprises_installees.id"), nullable=True)
    entreprise_hors_senegal_id = Column(UUID(as_uuid=True), ForeignKey("entreprises_hors_senegal.id"), nullable=True)
    est_publie        = Column(Boolean, default=True)
    is_deleted        = Column(Boolean, default=False)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), server_default=func.now())

    points_focaux       = relationship("ProspectPointFocal", back_populates="prospect", cascade="all, delete-orphan")
    contacts            = relationship("ProspectContact",    back_populates="prospect", cascade="all, delete-orphan", order_by="ProspectContact.date_premier_contact")
    secteur             = relationship("RefSecteur",   foreign_keys=[secteur_id],         lazy="joined")
    branche             = relationship("RefBranche",   foreign_keys=[branche_id],         lazy="joined")
    activite            = relationship("RefActivite",  foreign_keys=[activite_id],        lazy="joined")
    siege_pays_obj      = relationship("RefPays",      foreign_keys=[siege_pays_id],      lazy="joined")
    region_obj          = relationship("RefRegion",    foreign_keys=[region_id],          lazy="joined")
    departement_obj     = relationship("RefDepartement", foreign_keys=[departement_id],   lazy="joined")
    arrondissement_obj  = relationship("RefArrondissement", foreign_keys=[arrondissement_id], lazy="joined")
    entreprise_hors_obj = relationship("EntrepriseHorsSenegal", foreign_keys=[entreprise_hors_senegal_id], lazy="joined")


class ProspectPointFocal(Base):
    __tablename__ = "prospect_points_focaux"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospect_id  = Column(UUID(as_uuid=True), ForeignKey("prospects.id"), nullable=False)
    nom          = Column(String(100), nullable=False)
    prenom       = Column(String(100))
    poste        = Column(String(100))
    telephone    = Column(String(30))
    mail         = Column(String(255))
    est_principal= Column(Boolean, default=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    prospect = relationship("Prospect", back_populates="points_focaux")


class ProspectContact(Base):
    __tablename__ = "prospect_contacts"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospect_id          = Column(UUID(as_uuid=True), ForeignKey("prospects.id"), nullable=False)
    projet_nom           = Column(String(255), nullable=False)
    projet_description   = Column(Text)
    date_premier_contact = Column(Date, nullable=False)
    etat_avancement      = Column(String(50), default="en_cours")
    commentaires         = Column(Text)
    contraintes          = Column(Text)
    is_deleted           = Column(Boolean, default=False)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), server_default=func.now())

    prospect    = relationship("Prospect",               back_populates="contacts")
    historique  = relationship("ProspectContactHistorique", back_populates="contact", cascade="all, delete-orphan", order_by="ProspectContactHistorique.date_changement")


class ProspectContactHistorique(Base):
    __tablename__ = "prospect_contacts_historique"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contact_id      = Column(UUID(as_uuid=True), ForeignKey("prospect_contacts.id"), nullable=False)
    etat            = Column(String(50), nullable=False)
    commentaire     = Column(Text)
    date_changement = Column(DateTime(timezone=True), server_default=func.now())

    contact = relationship("ProspectContact", back_populates="historique")
