FROM python:3.11-slim

WORKDIR /app

# Dépendances système pour asyncpg + psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Utilisateur non-root. On crée /app/uploads AVANT le chown pour que le dossier
# existe et appartienne à appuser : sans ça, le volume Docker monté dessus est
# créé « root » et l'app non-root ne peut pas y écrire (téléversements KO).
RUN useradd -m -u 1000 appuser \
 && mkdir -p /app/uploads \
 && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
