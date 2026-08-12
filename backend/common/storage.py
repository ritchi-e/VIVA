from __future__ import annotations

import logging
from functools import lru_cache

import boto3
from botocore.client import Config
from django.conf import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME,
        config=Config(signature_version="s3v4"),
    )


def ensure_bucket():
    client = get_s3_client()
    bucket = settings.AWS_STORAGE_BUCKET_NAME
    try:
        client.head_bucket(Bucket=bucket)
    except Exception:
        try:
            client.create_bucket(Bucket=bucket)
            logger.info("Created bucket %s", bucket)
        except Exception as exc:
            logger.warning("Bucket ensure failed: %s", exc)


def upload_fileobj(fileobj, key: str, content_type: str | None = None) -> str:
    extra = {}
    if content_type:
        extra["ContentType"] = content_type
    get_s3_client().upload_fileobj(
        fileobj,
        settings.AWS_STORAGE_BUCKET_NAME,
        key,
        **({"ExtraArgs": extra} if extra else {}),
    )
    return key


def download_bytes(key: str) -> bytes:
    obj = get_s3_client().get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
    return obj["Body"].read()


def generate_presigned_url(key: str, expires_in: int = 3600) -> str:
    return get_s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.AWS_STORAGE_BUCKET_NAME, "Key": key},
        ExpiresIn=expires_in,
    )
