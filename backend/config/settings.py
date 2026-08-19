import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
_root = BASE_DIR.parent
load_dotenv(_root / ".env")
load_dotenv(_root / ".env.local", override=True)
load_dotenv(BASE_DIR / ".env.local", override=True)

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-insecure-change-me-aiviva-32chars!!")
DEBUG = os.getenv("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = [h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",")
    if o.strip()
]
# Caddy / any reverse proxy terminates TLS and forwards HTTP.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_SECURE_HSTS_SECONDS", "0") or 0)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = SECURE_HSTS_SECONDS > 0
    # TLS redirect is handled by Caddy; Django only sees HTTP on the internal network.
    SECURE_SSL_REDIRECT = False

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "django_prometheus",
    "channels",
    "common",
    "accounts",
    "orgs",
    "courses",
    "assignments",
    "rubrics",
    "submissions",
    "rag",
    "questions",
    "viva",
    "assessments",
    "ai",
    "audit",
]

MIDDLEWARE = [
    "django_prometheus.middleware.PrometheusBeforeMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "common.tenancy_middleware.OrganizationTenantMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "common.middleware.RequestLoggingMiddleware",
    "django_prometheus.middleware.PrometheusAfterMiddleware",
]

ROOT_URLCONF = "config.urls"
ASGI_APPLICATION = "config.asgi.application"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "aiviva"),
        "USER": os.getenv("POSTGRES_USER", "aiviva"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "aiviva"),
        "HOST": os.getenv("POSTGRES_HOST", "localhost"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "DJANGO_CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:13000,http://localhost:3000",
    ).split(",")
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True

from corsheaders.defaults import default_headers  # noqa: E402

CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-organization-id",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/minute",
        "user": "300/minute",
        "auth": "20/minute",
    },
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "EXCEPTION_HANDLER": "common.exceptions.custom_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 60 * 15
CELERY_TASK_SOFT_TIME_LIMIT = 60 * 10
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [os.getenv("CHANNELS_REDIS_URL", "redis://localhost:6379/3")],
        },
    }
}

# Object storage
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "minioadmin")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "minioadmin")
AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME", "aiviva")
AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL", "http://localhost:9000")
AWS_S3_REGION_NAME = os.getenv("AWS_S3_REGION_NAME", "us-east-1")

# AI
AI_PROVIDER = os.getenv("AI_PROVIDER", "mock")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-5-nano")
# Live viva turns (question generation); defaults to chat model. Use a fast model (e.g. gpt-4o-mini) to cut latency.
OPENAI_VIVA_MODEL = os.getenv("OPENAI_VIVA_MODEL", "") or OPENAI_CHAT_MODEL
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
OPENAI_TTS_MODEL = os.getenv("OPENAI_TTS_MODEL", "tts-1")
OPENAI_TTS_VOICE = os.getenv("OPENAI_TTS_VOICE", "nova")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-1.5-flash")
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "text-embedding-004")
EMBEDDING_DIMENSIONS = 1536

# Rumik silk TTS (Mulberry) — preferred for examiner voice when key is set.
# Accept common env spellings so local .env typos still work.
RUMIK_API_KEY = (
    os.getenv("RUMIK_API_KEY", "")
    or os.getenv("rumik_API_KEY", "")
    or os.getenv("RUMIK_TTS_API_KEY", "")
).strip()
RUMIK_TTS_MODEL = os.getenv("RUMIK_TTS_MODEL", "mulberry")
RUMIK_TTS_DEFAULT_SPEAKER = os.getenv("RUMIK_TTS_DEFAULT_SPEAKER", "siya")
RUMIK_TTS_TIMEOUT = float(os.getenv("RUMIK_TTS_TIMEOUT", "45") or 45)
TTS_PROVIDER = os.getenv("TTS_PROVIDER", "").strip().lower()  # rumik | openai | mock | auto

# Deepgram Nova-3 STT (accept common env spellings)
DEEPGRAM_API_KEY = (
    os.getenv("DEEPGRAM_API_KEY", "")
    or os.getenv("deepgram_nova3_api", "")
    or os.getenv("DEEPGRAM_NOVA3_API", "")
).strip()
DEEPGRAM_STT_MODEL = os.getenv("DEEPGRAM_STT_MODEL", "nova-3").strip() or "nova-3"
DEEPGRAM_STT_TIMEOUT = float(os.getenv("DEEPGRAM_STT_TIMEOUT", "45") or 45)
STT_PROVIDER = os.getenv("STT_PROVIDER", "").strip().lower()  # deepgram | mock | auto


GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_OAUTH_CLIENT_SECRET = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "")

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@aiviva.local")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "common.logging.JSONFormatter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"

# GitHub static ingestion (public repos only; never executes student code)
GITHUB_STATIC_INGESTION_ENABLED = os.getenv("GITHUB_STATIC_INGESTION_ENABLED", "true").lower() == "true"
GITHUB_API_TOKEN = os.getenv("GITHUB_API_TOKEN", "").strip()
MAX_SUBMISSION_FILE_BYTES = int(os.getenv("MAX_SUBMISSION_FILE_BYTES", str(25 * 1024 * 1024)))
MAX_REPO_ARCHIVE_BYTES = int(os.getenv("MAX_REPO_ARCHIVE_BYTES", str(40 * 1024 * 1024)))
MAX_REPO_FILES = int(os.getenv("MAX_REPO_FILES", "400"))
MAX_REPO_FILE_BYTES = int(os.getenv("MAX_REPO_FILE_BYTES", str(400 * 1024)))
MAX_EXTRACTED_CHARS = int(os.getenv("MAX_EXTRACTED_CHARS", "400000"))
REPO_FETCH_TIMEOUT_SEC = int(os.getenv("REPO_FETCH_TIMEOUT_SEC", "45"))
REPO_PARSER_CONCURRENCY = int(os.getenv("REPO_PARSER_CONCURRENCY", "4"))
EMBEDDING_BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "64"))

# Viva slot booking
VIVA_SLOT_DURATION_MINUTES = int(os.getenv("VIVA_SLOT_DURATION_MINUTES", "10"))
VIVA_MAX_CONCURRENT_SESSIONS = int(os.getenv("VIVA_MAX_CONCURRENT_SESSIONS", "10"))
VIVA_SLOT_LOOKAHEAD_HOURS = int(os.getenv("VIVA_SLOT_LOOKAHEAD_HOURS", "48"))
VIVA_SLOT_BUFFER_MINUTES = int(os.getenv("VIVA_SLOT_BUFFER_MINUTES", "5"))

CELERY_TASK_ROUTES = {
    "submissions.tasks.process_submission_task": {"queue": "ingestion"},
}
CELERY_TASK_DEFAULT_QUEUE = "celery"
