#!/bin/sh
set -e

# Restore database from seed if not present.
# With a Railway volume mounted at /data, DB persists across restarts.
# Without a volume, DB resets on redeploy but is seeded from db/seed.sql.
if [ -d "/data" ]; then
  # Volume is mounted — use persistent storage
  mkdir -p /data/output
  if [ ! -L /app/output ]; then
    rm -rf /app/output
    ln -s /data/output /app/output
  fi
  DB_PATH="/data/housing_content.db"
else
  # No volume — use local filesystem (resets on redeploy)
  DB_PATH="/app/housing_content.db"
fi

SEED="/app/db/seed.sql"
if [ ! -f "$DB_PATH" ] && [ -f "$SEED" ]; then
  echo "No database found at $DB_PATH — restoring from seed..."
  sqlite3 "$DB_PATH" < "$SEED"
  echo "Database restored ($(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM published_posts;') posts)."
fi

# Point the app at the correct DB path
export DATABASE_URL="sqlite+aiosqlite:///${DB_PATH}"
export CHECKPOINT_DB_PATH="${DB_PATH%housing_content.db}checkpoints.db"

exec uvicorn api.server:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --workers 1
