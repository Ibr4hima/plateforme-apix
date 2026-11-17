-- =============================================================================
-- 160 — La mémoire des lignes fDi supprimées à la main
-- =============================================================================
--
-- POURQUOI. L'administration supprime désormais une ligne du relevé — projet
-- ou signal —, et pas seulement une saisie. Effacer la ligne ne suffit pas :
--
--   · le réimport la ramènerait. Une page du relevé est réécrite dès que son
--     fichier, ou ce qui l'interprète, change — et le service d'import en fait
--     partie : à la première évolution du code, la ligne supprimée reviendrait,
--     sans un mot ;
--   · une capture aussi : la page qui la porte, recapturée, la présenterait
--     comme « nouvelle », et elle serait versée de nouveau.
--
-- La ligne supprimée laisse donc ici sa trace. L'import la saute tant que son
-- rang décrit le même projet (projets) ou que son contenu est le même
-- (signaux) ; la capture la reconnaît et ne la propose plus. Une saisie
-- manuelle n'a pas de source qui la ramènerait : elle garde sa trace pour
-- pouvoir être rétablie, sans rien bloquer (origine = 'saisie').
--
-- CE QUE PORTE `donnees` : la ligne telle qu'elle était, entière, et pour un
-- signal ses valeurs rattachées (destinations, secteurs, activités, natures).
-- Elle sert à la reconnaître, et à la rétablir si la suppression était une
-- erreur.
-- =============================================================================

CREATE TABLE IF NOT EXISTS fdi_lignes_supprimees (
    id            bigserial PRIMARY KEY,
    base          text NOT NULL CHECK (base IN ('projets', 'signaux')),
    -- « import » : une ligne du relevé ou d'une capture, que la source
    -- ramènerait ; « saisie » : une ligne entrée à la main.
    origine       text NOT NULL CHECK (origine IN ('import', 'saisie')),
    -- D'où venait la ligne : le libellé du lot (stable d'un import à l'autre,
    -- quand l'identifiant ne l'est pas) et le rang dans ce lot.
    lot_libelle   text NOT NULL,
    ligne         integer NOT NULL,
    -- Signaux : l'identité de contenu, celle que l'import recalcule.
    empreinte     text,
    annee         integer,
    mois          integer,
    donnees       jsonb NOT NULL,
    supprime_le   timestamptz NOT NULL DEFAULT now(),
    supprime_par  text
);

-- Un projet du relevé s'identifie par son rang dans son lot ; un signal, par
-- son contenu. Une seule trace pour chacun.
CREATE UNIQUE INDEX IF NOT EXISTS fdi_lignes_supprimees_rang
    ON fdi_lignes_supprimees (lot_libelle, ligne)
    WHERE base = 'projets' AND origine = 'import';
CREATE UNIQUE INDEX IF NOT EXISTS fdi_lignes_supprimees_empreinte
    ON fdi_lignes_supprimees (empreinte)
    WHERE base = 'signaux' AND origine = 'import';
-- La capture cherche les lignes supprimées des mois qu'une page couvre.
CREATE INDEX IF NOT EXISTS fdi_lignes_supprimees_mois
    ON fdi_lignes_supprimees (base, annee, mois);

COMMENT ON TABLE fdi_lignes_supprimees IS
    'Lignes fDi supprimées depuis l''administration : l''import et la capture ne les ramènent pas, l''écran peut les rétablir.';
