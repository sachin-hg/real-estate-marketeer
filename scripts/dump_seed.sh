#!/bin/sh
# Regenerate db/seed.sql from the local housing_content.db.
# Dumps schema + data for ALL tables — no tables are excluded.
# Run this from the project root whenever you want to update the seed.
#
# Usage: ./scripts/dump_seed.sh [path/to/db]

set -e

DB="${1:-housing_content.db}"
OUT="db/seed.sql"

if [ ! -f "$DB" ]; then
  echo "Error: $DB not found. Run from the project root." >&2
  exit 1
fi

TABLES=$(sqlite3 "$DB" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
echo "Dumping schema + data for tables: $(echo $TABLES | tr '\n' ' ')"

{
  echo "PRAGMA journal_mode=WAL;"
  echo "PRAGMA foreign_keys=OFF;"
  echo ""
  echo "-- Schema"
  sqlite3 "$DB" ".schema"

  for table in $TABLES; do
    echo ""
    echo "-- Data: $table"
    sqlite3 "$DB" ".mode insert $table" "SELECT * FROM $table;"
  done
} > "$OUT"

echo "Done. $(wc -l < "$OUT") lines written to $OUT"
