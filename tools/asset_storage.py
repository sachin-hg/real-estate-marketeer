"""
Cloud asset storage abstraction.

Backend selected by ASSET_STORAGE_BACKEND env var:
  local  (default) — serve via FastAPI static mount at /output/<run_id>/<file>
  s3               — upload to AWS S3; needs AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
                     AWS_S3_BUCKET, optional AWS_S3_REGION (default us-east-1)
  gcs              — upload to Google Cloud Storage; needs GCS_BUCKET + ADC / service account

Usage:
    from tools.asset_storage import upload_asset
    url = upload_asset(local_path, run_id, "instagram_abc123.png")
    # url is a public URL or relative path, ready to store in PublishedPostRecord.media_urls
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

_CONTENT_TYPES = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "mp4": "video/mp4",
    "mov": "video/quicktime",
    "pdf": "application/pdf",
    "json": "application/json",
}


def _content_type(filename: str) -> str:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    return _CONTENT_TYPES.get(ext, "application/octet-stream")


def upload_asset(local_path: Path, run_id: str, filename: str) -> str:
    """
    Upload a local file to the configured storage backend.
    Returns a public URL (S3/GCS) or a relative URL (/output/...) for local.
    Falls back to local if upload fails.
    """
    backend = os.getenv("ASSET_STORAGE_BACKEND", "local").lower().strip()
    try:
        if backend == "s3":
            return _upload_s3(local_path, run_id, filename)
        if backend == "gcs":
            return _upload_gcs(local_path, run_id, filename)
    except Exception as exc:
        logger.warning("Asset upload to %s failed: %s — serving from local path", backend, exc)
    return f"/output/{run_id}/{filename}"


def _upload_s3(local_path: Path, run_id: str, filename: str) -> str:
    import boto3  # noqa: PLC0415

    bucket = os.getenv("AWS_S3_BUCKET", "").strip()
    region = os.getenv("AWS_S3_REGION", "us-east-1").strip()
    prefix = os.getenv("AWS_S3_PREFIX", "housing-marketeer").strip().rstrip("/")
    if not bucket:
        logger.warning("ASSET_STORAGE_BACKEND=s3 but AWS_S3_BUCKET not set — falling back to local")
        return f"/output/{run_id}/{filename}"

    key = f"{prefix}/{run_id}/{filename}"
    s3 = boto3.client("s3", region_name=region)
    s3.upload_file(
        str(local_path), bucket, key,
        ExtraArgs={"ContentType": _content_type(filename), "ACL": "public-read"},
    )
    url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
    logger.info("Asset uploaded to S3: %s", url)
    return url


def _upload_gcs(local_path: Path, run_id: str, filename: str) -> str:
    from google.cloud import storage as gcs  # noqa: PLC0415

    bucket_name = os.getenv("GCS_BUCKET", "").strip()
    prefix = os.getenv("GCS_PREFIX", "housing-marketeer").strip().rstrip("/")
    if not bucket_name:
        logger.warning("ASSET_STORAGE_BACKEND=gcs but GCS_BUCKET not set — falling back to local")
        return f"/output/{run_id}/{filename}"

    client = gcs.Client()
    bucket = client.bucket(bucket_name)
    blob_name = f"{prefix}/{run_id}/{filename}"
    blob = bucket.blob(blob_name)
    blob.upload_from_filename(str(local_path), content_type=_content_type(filename))
    blob.make_public()
    logger.info("Asset uploaded to GCS: %s", blob.public_url)
    return blob.public_url
