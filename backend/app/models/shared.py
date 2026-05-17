"""
Modèles SQLAlchemy partagés entre plusieurs modules.
Toutes les tables ref_* communes sont définies ici une seule fois.
"""
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey
from app.core.database import Base


class RefPays(Base):
    __tablename__ = "ref_pays"
    id           = Column(Integer, primary_key=True)
    code_iso2    = Column(String(2))
    code_iso3    = Column(String(3))
    nom_fr       = Column(String(100))
    nom_en       = Column(String(100))
    region_monde = Column(String(100))
    actif        = Column(Boolean, default=True)
