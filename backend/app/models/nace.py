"""
Commerce extérieur du Sénégal — Note d'Analyse du Commerce Extérieur
(NACE, ANSD, rapport annuel).

Six nomenclatures, même structure :
- « principaux produits » (tableaux 8–11 de l'édition 2019) : une
  quinzaine de postes par sens ;
- « produits regroupés » (tableaux 12–15) : nomenclature ANSD plus fine,
  une trentaine de postes à l'export, une cinquantaine à l'import ;
- « groupes d'utilisation » (tableaux 16–19) : 9 groupes exhaustifs
  (alimentation, énergie, matières premières, demi-produits, produits
  finis par destination, or industriel) ;
- « chapitres » (tableaux 38–41) : nomenclature la plus fine, jusqu'à
  97 chapitres du Système Harmonisé par sens, également exhaustive ;
- « continents » (tableaux 26–29) : Europe, Afrique, Amérique, Asie,
  Océanie et Divers — exhaustifs eux aussi ;
- « régions » et « pays » (tableaux 34–37) : les deux granularités d'un
  même tableau hiérarchique — 13 régions portant leur sous-total, et le
  détail des ~200 pays partenaires rattachés à ref_pays quand ils y
  figurent (cf. la migration 128 pour la règle « Autres pays »).

Dans tous les cas : une ligne = une modalité × un sens × une année ×
une édition, avec la valeur (millions FCFA) et le poids net (tonnes).
Chaque édition N couvre les années N-4..N ; les fenêtres se chevauchent
et une année peut être révisée d'une édition à l'autre — la lecture
retient l'édition la plus récente disponible pour chaque année.
"""
from sqlalchemy import Column, ForeignKey, Integer, Numeric, Text, UniqueConstraint
from app.core.database import Base


class NacePrincipalProduit(Base):
    __tablename__ = "nace_principaux_produits"
    __table_args__ = (UniqueConstraint("produit", "sens", "annee", "edition"),)

    id      = Column(Integer, primary_key=True)
    produit = Column(Text, nullable=False)      # libellé normalisé (fautes du PDF corrigées)
    sens    = Column(Text, nullable=False)      # 'export' | 'import'
    annee   = Column(Integer, nullable=False)
    valeur  = Column(Numeric)                   # millions FCFA (T8/T10)
    poids   = Column(Numeric)                   # tonnes (T9/T11)
    edition = Column(Integer, nullable=False)   # année du rapport NACE source


class NaceProduitRegroupe(Base):
    __tablename__ = "nace_produits_regroupes"
    __table_args__ = (UniqueConstraint("produit", "sens", "annee", "edition"),)

    id      = Column(Integer, primary_key=True)
    produit = Column(Text, nullable=False)      # libellé normalisé (le PDF est en capitales)
    sens    = Column(Text, nullable=False)      # 'export' | 'import'
    annee   = Column(Integer, nullable=False)
    valeur  = Column(Numeric)                   # millions FCFA (T12/T14)
    poids   = Column(Numeric)                   # tonnes (T13/T15)
    edition = Column(Integer, nullable=False)   # année du rapport NACE source


class NaceGroupeUtilisation(Base):
    __tablename__ = "nace_groupe_utilisation"
    __table_args__ = (UniqueConstraint("groupe", "sens", "annee", "edition"),)

    id      = Column(Integer, primary_key=True)
    groupe  = Column(Text, nullable=False)      # libellé normalisé (le PDF est en capitales)
    sens    = Column(Text, nullable=False)      # 'export' | 'import'
    annee   = Column(Integer, nullable=False)
    valeur  = Column(Numeric)                   # millions FCFA (T16/T18)
    poids   = Column(Numeric)                   # tonnes (T17/T19)
    edition = Column(Integer, nullable=False)   # année du rapport NACE source


class NaceChapitre(Base):
    __tablename__ = "nace_chapitres"
    __table_args__ = (UniqueConstraint("chapitre", "sens", "annee", "edition"),)

    id       = Column(Integer, primary_key=True)
    chapitre = Column(Text, nullable=False)      # libellé normalisé (le PDF est en capitales)
    sens     = Column(Text, nullable=False)      # 'export' | 'import'
    annee    = Column(Integer, nullable=False)
    valeur   = Column(Numeric)                   # millions FCFA (T38/T40)
    poids    = Column(Numeric)                   # tonnes (T39/T41)
    edition  = Column(Integer, nullable=False)   # année du rapport NACE source


class NaceContinent(Base):
    __tablename__ = "nace_continents"
    __table_args__ = (UniqueConstraint("continent", "sens", "annee", "edition"),)

    id        = Column(Integer, primary_key=True)
    continent = Column(Text, nullable=False)     # 'Europe', 'Afrique', 'Amérique'…
    sens      = Column(Text, nullable=False)     # 'export' | 'import'
    annee     = Column(Integer, nullable=False)
    valeur    = Column(Numeric)                  # millions FCFA (T26/T28)
    poids     = Column(Numeric)                  # tonnes (T27/T29)
    edition   = Column(Integer, nullable=False)  # année du rapport NACE source


class NaceRegion(Base):
    """Sous-totaux par région, tels qu'imprimés dans les tableaux 34–37."""
    __tablename__ = "nace_regions"
    __table_args__ = (UniqueConstraint("region", "sens", "annee", "edition"),)

    id      = Column(Integer, primary_key=True)
    region  = Column(Text, nullable=False)
    sens    = Column(Text, nullable=False)       # 'export' | 'import'
    annee   = Column(Integer, nullable=False)
    valeur  = Column(Numeric)                    # millions FCFA
    poids   = Column(Numeric)                    # tonnes
    edition = Column(Integer, nullable=False)


class NacePays(Base):
    """Détail par pays partenaire, rattaché à sa région et — quand le
    libellé y correspond — au référentiel ref_pays. Les partenaires hors
    référentiel gardent ref_pays_id NULL et sont regroupés à la lecture
    sous « Autres pays » de leur région, ce qui préserve l'égalité entre
    la somme des pays et le sous-total imprimé de la région."""
    __tablename__ = "nace_pays"
    __table_args__ = (UniqueConstraint("pays", "sens", "annee", "edition"),)

    id          = Column(Integer, primary_key=True)
    pays        = Column(Text, nullable=False)
    region      = Column(Text, nullable=False)
    ref_pays_id = Column(Integer, ForeignKey("ref_pays.id"))
    sens        = Column(Text, nullable=False)    # 'export' | 'import'
    annee       = Column(Integer, nullable=False)
    valeur      = Column(Numeric)                 # millions FCFA
    poids       = Column(Numeric)                 # tonnes
    edition     = Column(Integer, nullable=False)
