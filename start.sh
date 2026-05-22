#!/bin/sh
set -e

# On Railway, /data is the persistent volume.
# Symlink /app/output → /data/output so the app writes to persistent storage
# while still serving files from the path FastAPI expects.
mkdir -p /data/output
if [ ! -L /app/output ]; then
  rm -rf /app/output
  ln -s /data/output /app/output
fi

# Restore database from seed on first deploy (volume is empty).
DB_PATH="/data/housing_content.db"
SEED="/app/db/seed.sql"
if [ ! -f "$DB_PATH" ] && [ -f "$SEED" ]; then
  echo "No database found — restoring from seed..."
  sqlite3 "$DB_PATH" < "$SEED"
  echo "Database restored."
fi

exec uvicorn api.server:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --workers 1
