from django.core.management.base import BaseCommand

from common.storage import ensure_bucket


class Command(BaseCommand):
    help = "Ensure the MinIO/S3 bucket exists"

    def handle(self, *args, **options):
        ensure_bucket()
        self.stdout.write(self.style.SUCCESS("Bucket ready"))
