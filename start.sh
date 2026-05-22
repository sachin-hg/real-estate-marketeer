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

exec uvicorn api.server:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --workers 1
