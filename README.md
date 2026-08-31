# Plateforme APIX — Gestion des Investissements

Plateforme numérique intelligente dédiée à la promotion des investissements au Sénégal.
Développée par la Direction de l'Intelligence et des Perspectives Économiques (DIPE).

## Démarrer le projet en local

Dans cet ordre — la mise à jour vient **avant** le lancement du back, sinon
celui-ci démarre sur une base à laquelle il manque une migration.

**0.** Ouvrir Docker Desktop et attendre qu'il soit prêt.

**1.** La base, depuis la racine du dépôt :

```bash
docker compose up -d
```

**2.** Récupérer le code et remettre la base à niveau :

```bash
git pull
bash scripts/maj_local.sh
```

**3.** Le back, depuis `backend/` :

```bash
source venv/bin/activate
uvicorn app.main:app --reload
```

**4.** Le front, depuis `frontend/` :

```bash
npm run dev
```

### Se remettre à jour en cours de route

Les deux commandes de l'étape 2, dans un terminal à part. Le front se recharge
seul ; le back n'a besoin d'être relancé que lorsqu'une route a changé.

`scripts/maj_local.sh` applique les migrations qui manquent, puis rejoue les
imports de référentiels. Tout y est idempotent : la relancer ne fait rien la
seconde fois. Il n'y a donc jamais à se demander « ai-je déjà passé cette
migration ? » — c'est ce que le script sait, en suivant la table
`schema_migrations`. Il exige que Docker tourne, et le dit clairement sinon.

Il ne redémarre volontairement ni le back ni le front : ils tournent dans vos
terminaux. En production, `scripts/deploy.sh` enchaîne les mêmes étapes après
avoir construit les images.

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
