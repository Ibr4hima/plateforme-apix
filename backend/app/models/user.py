from sqlalchemy import Column, Integer, Text, Boolean
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base


class User(Base):
    """Compte utilisateur authentifié (email @apix.sn + mot de passe haché).

    Le rôle (admin / viewer) n'est pas stocké : il est dérivé de la liste
    ADMIN_EMAILS au moment de la connexion.
    """
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    email           = Column(Text, nullable=False, unique=True)
    hashed_password = Column(Text, nullable=False)
    is_active       = Column(Boolean, nullable=False, default=True)
    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at      = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
