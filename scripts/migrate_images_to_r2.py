"""
Migrate existing locally-stored post images to Cloudflare R2 (or S3/GCS).
Updates media_urls and image_cloud_url in the local DB, then you can
re-run dump_seed.sh to bake the cloud URLs into the seed.

Usage:
    # Set env vars first (or put them in .env)
    export ASSET_STORAGE_BACKEND=r2
    export R2_ACCOUNT_ID=...
    export R2_ACCESS_KEY_ID=...
    export R2_SECRET_ACCESS_KEY=...
    export R2_BUCKET=...
    export R2_PUBLIC_URL=https://pub-xxx.r2.dev

    python scripts/migrate_images_to_r2.py [--db housing_content.db] [--output-dir output] [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import logging
import sqlite3
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Migrate post images to cloud storage")
    p.add_argument("--db", default="housing_content.db", help="Path to SQLite DB")
    p.add_argument("--output-dir", default="output", help="Local output directory")
    p.add_argument("--dry-run", action="store_true", help="Print what would happen, don't upload")
    return p.parse_args()


def get_uploader():
    """Return upload_asset from tools.asset_storage (adds project root to path)."""
    sys.path.insert(0, str(PROJECT_ROOT))
    from tools.asset_storage import upload_asset  # noqa: PLC0415
    return upload_asset


def migrate(db_path: Path, output_dir: Path, dry_run: bool) -> None:
    upload_asset = get_uploader()

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("""
        SELECT id, post_id, run_id, platform, media_urls, image_cloud_url
        FROM published_posts
        WHERE media_urls IS NOT NULL AND media_urls != '[]'
    """)
    rows = cur.fetchall()

    updated = skipped = missing = errors = 0

    for row in rows:
        media_urls: list[str] = json.loads(row["media_urls"] or "[]")
        if not media_urls:
            continue

        first = media_urls[0]

        # Already a cloud URL — skip
        if first.startswith("http"):
            skipped += 1
            continue

        # Resolve local path — try relative to project root first, then absolute
        local_path = PROJECT_ROOT / first
        if not local_path.exists():
            local_path = output_dir / Path(first).name
        if not local_path.exists():
            log.warning("Missing file for post %s: %s", row["post_id"][:8], first)
            missing += 1
            continue

        run_id = row["run_id"] or local_path.parent.name
        filename = local_path.name

        if dry_run:
            log.info("[DRY RUN] Would upload %s  →  <cloud>/%s/%s", local_path, run_id, filename)
            updated += 1
            continue

        try:
            cloud_url = upload_asset(local_path, run_id, filename)
            if not cloud_url.startswith("http"):
                log.warning("Backend returned local path for %s — check env vars", filename)
                errors += 1
                continue

            media_urls[0] = cloud_url
            cur.execute(
                "UPDATE published_posts SET media_urls=?, image_cloud_url=? WHERE id=?",
                (json.dumps(media_urls), cloud_url, row["id"]),
            )
            conn.commit()
            log.info("  ✓ %s [%s] → %s", row["post_id"][:8], row["platform"], cloud_url)
            updated += 1

        except Exception as exc:
            log.error("  ✗ %s: %s", row["post_id"][:8], exc)
            errors += 1

    conn.close()

    log.info("")
    log.info("Done — uploaded: %d | already cloud: %d | missing file: %d | errors: %d",
             updated, skipped, missing, errors)

    if not dry_run and updated > 0:
        log.info("")
        log.info("Next step: regenerate the seed so Railway deploys with cloud URLs:")
        log.info("  ./scripts/dump_seed.sh && git add db/seed.sql && git commit -m 'seed: images migrated to R2' && git push")


if __name__ == "__main__":
    args = parse_args()
    db_path = Path(args.db)
    if not db_path.is_absolute():
        db_path = PROJECT_ROOT / db_path
    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = PROJECT_ROOT / output_dir

    migrate(db_path, output_dir, args.dry_run)
