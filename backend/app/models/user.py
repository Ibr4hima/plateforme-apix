from sqlalchemy import Column, Integer, Text, Boolean
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base


class User(Base):
    """Compte utilisateur authentifié (email @apix.sn + mot de passe haché).

    RBAC : `role` est stocké en base (admin / agent / restreint) — le rôle `dev`
    n'est jamais stocké : il est dérivé de DEV_EMAILS (env) à chaque requête.
    `modules` liste les modules accessibles pour le rôle `restreint`.
    """
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    email           = Column(Text, nullable=False, unique=True)
    hashed_password = Column(Text, nullable=False)
    is_active       = Column(Boolean, nullable=False, default=True)
    role            = Column(Text, nullable=False, default="restreint")
    modules         = Column(ARRAY(Text), nullable=False, default=[])
    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at      = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
