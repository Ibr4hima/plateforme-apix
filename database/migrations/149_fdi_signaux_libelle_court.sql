-- =============================================================================
-- 149 — Un libellé court pour les stades de signal.
-- =============================================================================
--
-- POURQUOI. Le libellé complet dit ce qu'il faut : « Réception de nouveau
-- financement ou de nouvelles ressources pour l'expansion ». Mais sur une carte
-- de repérage, il occupe trois lignes en capitales et écrase le nom de
-- l'entreprise — alors que c'est l'entreprise qu'on cherche. Les cartes des
-- projets annoncés portent « Extension », « Nouvelle implantation » : une
-- étiquette se lit d'un coup d'œil ou ne sert à rien.
--
-- POURQUOI EN BASE ET NON DANS L'ÉCRAN. C'est une propriété de la nomenclature,
-- au même titre que le libellé long et la définition : plusieurs écrans s'en
-- serviront, et elle doit se corriger là où l'on corrige les autres — dans
-- l'administration des classifications — sans toucher au code.
--
-- LE LONG RESTE : il porte le sens exact, et c'est lui qu'on affiche en
-- infobulle et partout où la place ne manque pas. Le court ne le remplace pas,
-- il l'abrège.
-- =============================================================================

ALTER TABLE fdi_signaux
    ADD COLUMN IF NOT EXISTS libelle_court_fr text NOT NULL DEFAULT '';

COMMENT ON COLUMN fdi_signaux.libelle_court_fr IS
    'Étiquette courte, pour les cartes et les tableaux. Le libellé long reste la référence.';
