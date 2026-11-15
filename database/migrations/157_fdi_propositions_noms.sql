-- =============================================================================
-- Migration 157 — Le nom complet PROPOSÉ pour chaque libellé tronqué
--
-- POURQUOI. Deux mille huit cents libellés d'entreprise sont coupés par fDi
-- (« Huawei Technologi… », « Banco de Foment… ») et portent six mille projets.
-- Les trancher un à un en allant chercher chaque nom dans fDi était la partie
-- du travail qui n'avançait pas : il n'existe aucun moyen de les retrouver par
-- recoupement, la source coupant à la largeur de la colonne, et un nom de plus
-- de vingt caractères n'y apparaît donc JAMAIS en entier.
--
-- CE QUE FAIT 157. Une table de PROPOSITIONS, faites par l'API Claude à partir
-- du contexte de chaque libellé — société mère, pays, secteur, dates. Une
-- proposition n'est qu'une proposition : elle pré-remplit le champ de l'écran
-- d'arbitrage, et rien n'est rattaché tant qu'un humain ne l'a pas validée.
-- C'est la même règle que pour la mémoire des arbitrages (migration 134).
--
-- La clé est le libellé NORMALISÉ, comme dans fdi_entreprise_alias : deux
-- graphies d'une même coupe (« … » ou « ... ») partagent leur proposition.
-- Elle est calculée une fois et gardée ; la refaire coûterait un appel de plus
-- pour une réponse qui ne changera guère.
-- =============================================================================

CREATE TABLE IF NOT EXISTS fdi_propositions_noms (
    alias_normalise text PRIMARY KEY,
    brut            text NOT NULL,
    -- NULL : le modèle n'a rien proposé, ou sa proposition a été écartée
    -- parce qu'elle ne prolongeait pas le texte affiché par fDi. On le garde,
    -- pour ne pas redemander sans fin ce qui n'a pas de réponse.
    nom             text,
    -- « haute » : complétion sans ambiguïté (grand groupe, société mère
    -- explicite). « moyenne » : l'entreprise est sûre, la forme exacte chez fDi
    -- moins. « basse » : hypothèse — à vérifier dans fDi avant de valider.
    confiance       text NOT NULL CHECK (confiance IN ('haute', 'moyenne', 'basse')),
    -- Une phrase courte qui dit d'où vient la proposition (« filiale kényane
    -- de Standard Chartered ») : l'humain juge plus vite sur pièce.
    indice          text,
    modele          text,
    cree_le         timestamptz NOT NULL DEFAULT now()
);
