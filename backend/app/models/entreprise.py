from sqlalchemy import Column, String, Boolean, Integer, Date, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.orm import relationship
from app.core.database import Base
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
    poste           = Column(String(150))
    telephone       = Column(String(50))
    mail            = Column(String(255))
    est_principal   = Column(Boolean, default=False)
    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())
    entreprise      = relationship("EntrepriseIntallee", back_populates="points_focaux")


class EntrepriseIntallee(Base):
    __tablename__ = "entreprises_installees"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom             = Column(String(255), nullable=False)
    forme_juridique = Column(String(100))
    date_creation   = Column(Date)
    siege_pays      = Column(String(100))
    pays            = Column(String(100), default="Sénégal")
    region          = Column(String(100))
    departement     = Column(String(100))
    commune         = Column(String(100))
    adresse         = Column(Text)
    telephone       = Column(String(50))
    mail            = Column(String(255))
    siteweb         = Column(Text)
    secteur_id      = Column(Integer, ForeignKey("ref_secteurs.id"))
    branche_id      = Column(Integer, ForeignKey("ref_branches.id"))
    activite_id     = Column(Integer, ForeignKey("ref_activites.id"))
    statut          = Column(String(20), default="actif")
    est_publie      = Column(Boolean, default=True)
    note_interne    = Column(Text)
    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())
    created_by      = Column(String(100))
    is_deleted      = Column(Boolean, default=False)
    points_focaux   = relationship("EntreprisePointFocal", back_populates="entreprise", cascade="all, delete-orphan")
    secteur         = relationship("RefSecteur")
    branche         = relationship("RefBranche")
    activite        = relationship("RefActivite")
