from sqlalchemy import Column, String, Integer, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base


class ProjetPhase(Base):
    __tablename__ = "projet_phases"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    projet_id  = Column(Integer, ForeignKey("projets.id", ondelete="CASCADE"), nullable=False)
    ordre      = Column(Integer, nullable=False, default=0)
    titre      = Column(String(300), nullable=False)
    date_debut = Column(Date, nullable=False)
    date_fin   = Column(Date, nullable=True)
    note       = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
