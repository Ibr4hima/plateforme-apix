from sqlalchemy import Column, String, Boolean, Integer, Date, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.shared import RefPays
import uuid


class RefSecteur(Base):
    __tablename__ = "ref_secteurs"
    id          = Column(Integer, primary_key=True)
    code        = Column(String(20), unique=True, nullable=False)
    nom         = Column(String(150), nullable=False)
    description = Column(Text)
    actif       = Column(Boolean, default=True)
    branches    = relationship("RefBranche", back_populates="secteur")


class RefBranche(Base):
    __tablename__ = "ref_branches"
    id          = Column(Integer, primary_key=True)
    secteur_id  = Column(Integer, ForeignKey("ref_secteurs.id"), nullable=False)
    code        = Column(String(20), unique=True, nullable=False)
    nom         = Column(String(150), nullable=False)
    actif       = Column(Boolean, default=True)
    secteur     = relationship("RefSecteur", back_populates="branches")
    activites   = relationship("RefActivite", back_populates="branche")


class RefActivite(Base):
    __tablename__ = "ref_activites"
    id          = Column(Integer, primary_key=True)
    branche_id  = Column(Integer, ForeignKey("ref_branches.id"), nullable=False)
    code        = Column(String(20), unique=True, nullable=False)
    nom         = Column(String(255), nullable=False)
    actif       = Column(Boolean, default=True)
    branche     = relationship("RefBranche", back_populates="activites")


class EntreprisePointFocal(Base):
    __tablename__ = "entreprises_points_focaux"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entreprise_id   = Column(UUID(as_uuid=True), ForeignKey("entreprises_installees.id", ondelete="CASCADE"), nullable=False)
    nom             = Column(String(255), nullable=False)
    prenom          = Column(String(255))
    civilite        = Column(String(20), default="Monsieur")
    poste           = Column(String(150))
    telephone       = Column(String(50))
    mail            = Column(String(255))
    est_principal   = Column(Boolean, default=False)
    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())
    entreprise      = relationship("EntrepriseIntallee", back_populates="points_focaux")


class RefRegion(Base):
    __tablename__ = "ref_regions"
    id    = Column(Integer, primary_key=True)
    code  = Column(String(10))
    nom   = Column(String(100))
    actif = Column(Boolean, default=True)

class RefDepartement(Base):
    __tablename__ = "ref_departements"
    id        = Column(Integer, primary_key=True)
    region_id = Column(Integer, ForeignKey("ref_regions.id"))
    code      = Column(String(10))
    nom       = Column(String(100))
    actif     = Column(Boolean, default=True)

class RefArrondissement(Base):
    __tablename__ = "ref_arrondissements"
    id             = Column(Integer, primary_key=True)
    departement_id = Column(Integer, ForeignKey("ref_departements.id"))
    code           = Column(String(10))
    nom            = Column(String(100))
    actif          = Column(Boolean, default=True)

class EntrepriseIntallee(Base):
    __tablename__ = "entreprises_installees"
    # ── Identité ──
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom             = Column(String(255), nullable=False)
    forme_juridique = Column(String(100))
    date_creation   = Column(Date)
    statut          = Column(String(20), default="actif")
    # ── Siège social ──
    siege_pays_id   = Column(Integer, ForeignKey("ref_pays.id"))
    pays            = Column(String(100), default="Sénégal")  # pays d'implantation (fixe)
    # ── Localisation Sénégal ──
    region_id           = Column(Integer, ForeignKey("ref_regions.id"))
    departement_id      = Column(Integer, ForeignKey("ref_departements.id"))
    arrondissement_id   = Column(Integer, ForeignKey("ref_arrondissements.id"))
    adresse             = Column(Text)
    # ── Contact ──
    telephone       = Column(String(50))
    mail            = Column(String(255))
    siteweb         = Column(Text)
    # ── Classification ──
    secteur_id      = Column(Integer, ForeignKey("ref_secteurs.id"))
    branche_id      = Column(Integer, ForeignKey("ref_branches.id"))
    activite_id     = Column(Integer, ForeignKey("ref_activites.id"))
    # ── Publication ──
    est_publie      = Column(Boolean, default=True)
    # ── Métadonnées ──
    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())
    created_by      = Column(String(100))
    is_deleted      = Column(Boolean, default=False)
    # ── Relations ──
    siege_pays_obj      = relationship("RefPays",          foreign_keys=[siege_pays_id],      lazy="joined")
    region_obj          = relationship("RefRegion",        foreign_keys=[region_id],          lazy="joined")
    departement_obj     = relationship("RefDepartement",   foreign_keys=[departement_id],     lazy="joined")
    arrondissement_obj  = relationship("RefArrondissement",foreign_keys=[arrondissement_id],  lazy="joined")
    points_focaux   = relationship("EntreprisePointFocal", back_populates="entreprise", cascade="all, delete-orphan")
    secteur         = relationship("RefSecteur")
    branche         = relationship("RefBranche")
    activite        = relationship("RefActivite")
