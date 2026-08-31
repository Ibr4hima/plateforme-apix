-- =============================================================================
-- 135 — Le SENS d'un lot de projets fDi, et ce qu'il rend complet.
-- =============================================================================
--
-- LE PROBLÈME, en une phrase : un lot relevé sous « Dest = Senegal » contient
-- des pays d'origine — France, Turquie, Mali… — mais ces pays n'y figurent que
-- pour ce qu'ils ont envoyé AU SÉNÉGAL. La France annonce des centaines de
-- projets ailleurs dans le monde ; les compter depuis ce lot donnerait une
-- image fausse de la France, exacte seulement du couple France → Sénégal.
--
-- Autrement dit, un lot ne rend exhaustif qu'UN SEUL couple (pays, sens) :
--
--     lot « Dest = Senegal »   → le Sénégal comme DESTINATION est complet ;
--                                les pays d'origine qui y figurent ne le sont
--                                pas, et ne doivent pas être présentés comme
--                                des périmètres à part entière.
--     lot « Source = Senegal » → le Sénégal comme ORIGINE est complet ;
--                                les destinations qui y figurent ne le sont pas.
--
-- D'où cette colonne. Elle ne décrit pas une préférence d'affichage : elle dit
-- ce que la donnée AUTORISE à affirmer. Une page qui l'ignore finit par
-- publier « la France a annoncé 56 projets » alors que la base n'en connaît
-- que 56 vers le Sénégal.
--
-- Les lots déjà importés sont tous des « Dest = Senegal » : la valeur par
-- défaut leur convient, et aucune reprise n'est nécessaire.
-- =============================================================================

ALTER TABLE fdi_lots_import
    ADD COLUMN IF NOT EXISTS sens text NOT NULL DEFAULT 'destination'
        CHECK (sens IN ('destination', 'source'));

COMMENT ON COLUMN fdi_lots_import.sens IS
    'Côté par lequel le périmètre a été relevé : « destination » = tout ce que '
    'le pays reçoit, « source » = tout ce qu''il implante ailleurs. Le couple '
    '(perimetre, sens) est le seul agrégat que le lot rend exhaustif.';

-- Un même périmètre peut être relevé dans les deux sens ; le libellé du lot
-- porte déjà le sens (« Sénégal reçoit · page 01 » / « Sénégal investit ·
-- page 01 »), et c'est lui qui reste la clef d'idempotence de l'import.
CREATE INDEX IF NOT EXISTS idx_fdi_lots_perimetre ON fdi_lots_import (perimetre, sens);

-- Les lots déjà en base s'appelaient « Sénégal · page 01 » ; l'import les
-- nommera désormais « Sénégal reçoit · page 01 ». Le libellé étant la clef
-- d'idempotence, il faut le mettre à jour ICI : sans cela, le prochain import
-- créerait des lots jumeaux et doublerait les 235 projets.
UPDATE fdi_lots_import
   SET libelle = replace(libelle, ' · page', ' reçoit · page')
 WHERE sens = 'destination'
   AND libelle LIKE '% · page%'
   AND libelle NOT LIKE '% reçoit · page%';
