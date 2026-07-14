from sqlalchemy import Column, String, Integer, SmallInteger, Numeric, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base


class IdeCnuced(Base):
    __tablename__ = "ide_cnuced"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    pays        = Column(String(100), nullable=False)
    annee       = Column(SmallInteger, nullable=False)
    direction   = Column(String(10), nullable=False)
    indicateur  = Column(String(30), nullable=False)
    valeur      = Column(Numeric(14,2))
    source      = Column(String(50), default="CNUCED")
    ref_pays_id = Column(Integer, ForeignKey("ref_pays.id"), nullable=True, index=True)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())


class IdeKpiConfig(Base):
    __tablename__ = "ide_kpis_config"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    code        = Column(String(50), nullable=False, unique=True)
    label       = Column(String(200), nullable=False)
    description = Column(Text)
    est_actif   = Column(Boolean, default=False)
    ordre       = Column(SmallInteger, default=0)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())


class IdeAnalyse(Base):
    __tablename__ = "ide_analyses"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    source      = Column(String(20), nullable=False, default="cnuced")
    titre       = Column(String(300), nullable=False)
    commentaire = Column(Text, nullable=False)
    direction   = Column(String(10))
    indicateur  = Column(String(30))
    annee_debut = Column(SmallInteger)
    annee_fin   = Column(SmallInteger)
    est_publie  = Column(Boolean, default=False)
    ordre       = Column(Integer, default=0)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())


class IdeSecteur(Base):
    """Référentiel des secteurs / branches CNUCED (parent_id NULL = secteur)."""
    __tablename__ = "ide_secteurs"
    id        = Column(Integer, primary_key=True)
    nom_en    = Column(Text, nullable=False, unique=True)
    nom_fr    = Column(Text, nullable=False)
    parent_id = Column(Integer, ForeignKey("ide_secteurs.id", ondelete="CASCADE"))
    ordre     = Column(Integer, nullable=False, default=0)


class IdeCnucedSecteur(Base):
    """Données IDE sectorielles (Annex tables 09-12, 15, 18)."""
    __tablename__ = "ide_cnuced_secteurs"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    secteur_id = Column(Integer, ForeignKey("ide_secteurs.id", ondelete="CASCADE"), nullable=False)
    annee      = Column(SmallInteger, nullable=False)
    direction  = Column(String(10), nullable=False)   # entrant / sortant / total
    indicateur = Column(String(30), nullable=False)   # ma_* / greenfield_*
    valeur     = Column(Numeric(16, 2))
    source     = Column(String(20), nullable=False, default="CNUCED")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
