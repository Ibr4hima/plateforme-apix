# Plateforme APIX — Gestion des Investissements

Plateforme numérique intelligente dédiée à la promotion des investissements au Sénégal.
Développée par la Direction de l'Intelligence et des Perspectives Économiques (DIPE).

## Se remettre à jour, en local

Après un `git pull`, une seule commande, toujours la même :

```bash
bash scripts/maj_local.sh
```

Elle applique les migrations qui manquent, puis rejoue les imports de
référentiels. Tout y est idempotent : la relancer ne fait rien la seconde
fois. Il n'y a donc jamais à se demander « ai-je déjà passé cette
migration ? » — c'est ce que le script sait, en suivant la table
`schema_migrations`.

Elle ne redémarre volontairement ni le back ni le front : ils tournent dans
vos terminaux. En production, `scripts/deploy.sh` enchaîne les mêmes étapes
après avoir construit les images.

## Stack technique
- **Frontend** : Next.js 14 (App Router) + Tailwind CSS
- **Backend** : FastAPI (Python)
- **Base de données** : PostgreSQL 15 + PostGIS
- **BI** : Power BI (connexion directe PostgreSQL)
- **Infrastructure** : Docker

## Modules
1. Investissements Directs Étrangers (IDE)
2. Intentions d'investissement
3. Prospects
4. Entreprises installées
5. Zones d'investissement
6. Opportunités d'investissement
7. Accords et traités
8. Événements
