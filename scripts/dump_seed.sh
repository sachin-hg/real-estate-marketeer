#!/bin/sh
# Regenerate db/seed.sql from the local housing_content.db.
# Includes schema for all tables + data for published_posts and runs.
# Excludes api_calls and llm_calls (telemetry only).
# Run this from the project root whenever you want to update the seed.
#
# Usage: ./scripts/dump_seed.sh

set -e

DB="${1:-housing_content.db}"
OUT="db/seed.sql"

if [ ! -f "$DB" ]; then
  echo "Error: $DB not found. Run from the project root." >&2
  exit 1
fi

echo "Dumping schema + seed data from $DB → $OUT"

{
  echo "PRAGMA journal_mode=WAL;"
  echo "PRAGMA foreign_keys=OFF;"
  echo ""
  echo "-- Schema"
  sqlite3 "$DB" ".schema"
  echo ""
  echo "-- Data: published_posts"
  sqlite3 "$DB" ".mode insert published_posts" "SELECT * FROM published_posts;"
  echo ""
  echo "-- Data: runs"
  sqlite3 "$DB" ".mode insert runs" "SELECT * FROM runs;"
} > "$OUT"

echo "Done. $(wc -l < "$OUT") lines written to $OUT"
