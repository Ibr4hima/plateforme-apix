from sqlalchemy import Column, String, Integer, Boolean
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base


class RefPotentialiteAvantage(Base):
    __tablename__ = "ref_potentialites_avantages"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    categorie = Column(String(50), nullable=False)
    libelle   = Column(String(500), nullable=False)
    ordre     = Column(Integer, default=0)
    actif     = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
