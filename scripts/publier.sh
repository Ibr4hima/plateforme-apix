#!/usr/bin/env bash
# =============================================================================
# Publier en production ce qui est validé en local.
#
#     bash scripts/publier.sh
#
# La démo suit `main`, pas la branche de travail : c'est un push sur `main` qui
# déclenche le déploiement (GitHub Actions → SSH sur le VPS →
# `scripts/deploy.sh`). Tant qu'on ne pousse que la branche, rien ne part —
# et c'est voulu : on met en ligne quand on a regardé, pas à chaque commit.
#
# Ce script fait donc les gestes dans l'ordre, sans en oublier un : remettre la
# base LOCALE à niveau, pousser la branche, y amener `main`, revenir sur la
# branche. Le reste se passe tout seul sur le serveur — `deploy.sh` y applique
# les migrations et rejoue les imports.
#
# Il refuse de partir si le dossier de travail n'est pas propre : publier un
# état qu'on n'a pas commité mettrait en ligne autre chose que ce qu'on a vu.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

vert() { printf "\033[0;32m%s\033[0m\n" "$1"; }
gris() { printf "\033[0;90m%s\033[0m\n" "$1"; }

BRANCHE=$(git rev-parse --abbrev-ref HEAD)
[ "$BRANCHE" = "main" ] && { echo "✗ déjà sur main — rien à publier depuis ici."; exit 1; }

if [ -n "$(git status --porcelain)" ]; then
  echo "✗ des modifications ne sont pas commitées :"
  git status --short
  echo
  echo "  Commitez-les d'abord — on ne publie que ce qui a été vu et commité."
  exit 1
fi

# La base locale d'abord : on publie ce qu'on vient de voir tourner, et une
# migration oubliée en local se serait vue ici avant d'aller en ligne. L'étape
# est sautée si Docker n'est pas lancé — publier reste alors possible, c'est
# une opération purement Git.
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "${CONTENEUR_PG:-apix_postgres}"; then
  echo "▸ Base locale"
  # --sans-pull : publier, c'est mettre en ligne CE QU'ON VIENT DE VOIR. Aller
  # chercher des commits distants ici publierait du code qu'on n'a pas regardé.
  bash scripts/maj_local.sh --sans-pull | sed 's/^/  /'
else
  gris "▸ Base locale ignorée (Docker n'est pas lancé)"
fi

echo "▸ Branche $BRANCHE → origin"
git push -u origin "$BRANCHE"

echo "▸ main ← $BRANCHE"
git fetch origin --prune
git checkout main
git pull --ff-only origin main

# Avance rapide quand c'est possible ; sinon une fusion ordinaire, qui laisse
# une trace explicite de ce qui a été mis en ligne et quand.
if git merge --ff-only "$BRANCHE" 2>/dev/null; then
  gris "  avance rapide"
else
  gris "  fusion (main avait avancé de son côté)"
  git merge --no-edit "$BRANCHE"
fi

git push origin main
git checkout "$BRANCHE"

vert "✅ Poussé sur main — le déploiement démarre."
echo
gris "Sur le serveur, sans rien faire de plus : images reconstruites, migrations"
gris "appliquées, imports fDi rejoués (scripts/deploy.sh)."
gris "Suivre : https://github.com/Ibr4hima/plateforme-apix/actions"
gris "En ligne dans 2 à 4 minutes sur https://demo-plateforme-apix.com"
