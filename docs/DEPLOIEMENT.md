# Déploiement de la démo APIX

Démo temporaire et protégée par mot de passe, partagée à quelques testeurs.
Stack : Postgres+PostGIS · FastAPI · Next.js · Caddy (HTTPS auto).
Mise à jour automatique à chaque push sur `claude/modest-ritchie-DlitS`.

- Domaine : `demo-plateforme-apix.com`
- Hébergement : VPS (Hetzner CX22, Ubuntu 24.04)

---

## 1. VPS

Hetzner Cloud → New Project → Add Server :
- Location : UE (Falkenstein / Nuremberg)
- Image : **Ubuntu 24.04**
- Type : **CX22** (2 vCPU / 4 Go RAM)
- SSH key : ajouter sa clé publique

Noter l'**IP publique** du serveur.

## 2. DNS (Namecheap → Domain List → Manage → Advanced DNS)

| Type | Host | Value        |
|------|------|--------------|
| A    | @    | `<IP_VPS>`   |
| A    | www  | `<IP_VPS>`   |

Supprimer les éventuels enregistrements « parking » par défaut.
Propagation : quelques minutes à ~1 h.

## 3. Accès au repo depuis le VPS (deploy key, lecture seule)

Sur le VPS :
```bash
ssh-keygen -t ed25519 -f ~/.ssh/apix_deploy -N ""
cat ~/.ssh/apix_deploy.pub
```
Coller cette clé publique dans **GitHub → repo → Settings → Deploy keys → Add**
(lecture seule). Puis configurer git pour l'utiliser (ou cloner en HTTPS avec un PAT).

## 4. Installation (une seule fois, sur le VPS)

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# Code
git clone <url_repo> /opt/apix && cd /opt/apix
git checkout claude/modest-ritchie-DlitS

# Variables d'environnement
cp .env.prod.example .env.prod
#   Renseigner :
#   DOMAIN=demo-plateforme-apix.com
#   NEXT_PUBLIC_API_URL=https://demo-plateforme-apix.com/api/v1
#   NEXTAUTH_URL=https://demo-plateforme-apix.com
#   ALLOWED_ORIGINS=https://demo-plateforme-apix.com
#   POSTGRES_PASSWORD / SECRET_KEY / AUTH_SECRET = valeurs fortes aléatoires

# Mot de passe d'accès à la démo (basic-auth)
cp secrets.caddy.env.example secrets.caddy.env
docker run --rm caddy:2-alpine caddy hash-password --plaintext 'MON_MDP_DEMO'
#   Coller le hash dans secrets.caddy.env → BASIC_AUTH_HASH (laisser BASIC_AUTH_USER=apix)

# Premier déploiement
bash scripts/deploy.sh
```

Caddy obtient automatiquement le certificat HTTPS.
→ `https://demo-plateforme-apix.com` est en ligne (identifiant + mot de passe demandés).

## 5. Auto-déploiement sur push (GitHub → Settings → Secrets and variables → Actions)

Ajouter les secrets :

| Secret           | Valeur                                  |
|------------------|-----------------------------------------|
| `DEPLOY_HOST`    | IP du VPS                                |
| `DEPLOY_USER`    | `root`                                   |
| `DEPLOY_PORT`    | `22`                                     |
| `DEPLOY_PATH`    | `/opt/apix`                             |
| `DEPLOY_SSH_KEY` | clé privée SSH (publique installée sur le VPS) |

Ensuite, chaque push sur `claude/modest-ritchie-DlitS` redéploie front + back
via `.github/workflows/deploy-demo.yml`. Sans ces secrets, le workflow ne fait rien.

## 6. Partage aux testeurs

Transmettre : le lien `https://demo-plateforme-apix.com` + identifiant `apix` + le mot de passe.

---

## Notes

- **Build sûr** : si un build échoue, l'ancienne version reste en ligne (`scripts/deploy.sh`
  construit avant de remplacer). Les conteneurs redémarrent seuls (`restart: unless-stopped`).
- **Migrations** : `scripts/apply_migrations.sh` n'applique que les migrations non encore
  passées (suivi dans la table `schema_migrations`, baseline posée au 1er déploiement).
- **Données** : la base se remplit avec les référentiels des migrations (ref_pays, zones, etc.).
  Pour importer en plus les saisies manuelles de la base locale (une seule fois) :
  ```bash
  # En local
  docker compose exec -T postgres pg_dump -U <user> -d <db> \
    --data-only --exclude-table=schema_migrations > dump.sql
  # Copier sur le VPS puis :
  docker compose -f docker-compose.prod.yml --env-file .env.prod \
    exec -T postgres psql -U <user> -d <db> < dump.sql
  ```
- **Commandes utiles** (sur le VPS, dans `/opt/apix`) :
  ```bash
  C="docker compose -f docker-compose.prod.yml --env-file .env.prod"
  $C ps            # état des conteneurs
  $C logs -f caddy # logs (HTTPS / accès)
  $C logs -f backend
  bash scripts/deploy.sh   # redéploiement manuel
  ```
