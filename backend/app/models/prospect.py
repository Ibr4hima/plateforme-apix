from sqlalchemy import Column, String, Boolean, Date, Text, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.core.database import Base

class Prospect(Base):
    __tablename__ = "prospects"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom               = Column(String(255), nullable=False)
    forme_juridique   = Column(String(100))
    date_creation_ent = Column(Date)
    siege_pays        = Column(String(100))
    pays              = Column(String(100), default="Sénégal")
    region            = Column(String(100))
    departement       = Column(String(100))
    arrondissement    = Column(String(100))
    adresse           = Column(Text)
    telephone         = Column(String(30))
    mail              = Column(String(255))
    siteweb           = Column(String(255))
    secteur_id        = Column(Integer, ForeignKey("ref_secteurs.id"))
    branche_id        = Column(Integer, ForeignKey("ref_branches.id"))
    activite_id       = Column(Integer, ForeignKey("ref_activites.id"))
    point_entree             = Column(Text)
    type_prospect            = Column(String(20), default='autre')
    entreprise_installee_id  = Column(UUID(as_uuid=True), ForeignKey('entreprises_installees.id'), nullable=True)
    est_publie        = Column(Boolean, default=True)
    note_interne      = Column(Text)
    is_deleted        = Column(Boolean, default=False)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), server_default=func.now())

    points_focaux = relationship("ProspectPointFocal", back_populates="prospect", cascade="all, delete-orphan")
    contacts      = relationship("ProspectContact",    back_populates="prospect", cascade="all, delete-orphan", order_by="ProspectContact.date_premier_contact")
    secteur       = relationship("RefSecteur",  foreign_keys=[secteur_id])
    branche       = relationship("RefBranche",  foreign_keys=[branche_id])
    activite      = relationship("RefActivite", foreign_keys=[activite_id])


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
