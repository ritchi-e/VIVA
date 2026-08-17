# Deployment

## Local (default)

```bash
cp .env.example .env
docker compose up --build
```

Services: frontend (13000), backend (18000), postgres, redis, minio, celery-worker, celery-beat, prometheus, grafana.

## Production on Linode (`mokhik.online`)

Single-VPS layout: Caddy terminates TLS and reverse-proxies to the SPA + Django. Postgres, Redis, and MinIO stay on the private Docker network (no public ports).

```mermaid
flowchart LR
  User[Browser] -->|HTTPS 443| Caddy
  Caddy -->|/| FE[frontend nginx]
  Caddy -->|/api /ws /admin /static| BE[backend Daphne]
  BE --> PG[(postgres)]
  BE --> Redis[(redis)]
  BE --> MinIO[(minio)]
  CW[celery-worker] --> PG
  CW --> Redis
  CW --> MinIO
```

### 1. Linode server

1. Create a Nanode / Shared CPU (2 GB RAM minimum; 4 GB recommended with AI + MinIO).
2. Image: Ubuntu 24.04 LTS.
3. Open firewall: **22**, **80**, **443** only (Cloud Firewall or UFW).
4. Note the public IPv4 (and IPv6 if you use it).

```bash
# On the server
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER   # then log out/in
```

### 2. DNS at your domain registrar

Point `mokhik.online` at the Linode IP:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `<LINODE_IPV4>` |
| A | `www` | `<LINODE_IPV4>` |
| AAAA | `@` / `www` | `<LINODE_IPV6>` (optional) |

Wait until `dig +short mokhik.online` returns the Linode IP before starting Caddy (Let's Encrypt needs that).

### 3. Deploy the app

```bash
git clone https://github.com/ritchi-e/VIVA.git mokhik
cd mokhik
cp .env.production.example .env
# Edit .env — set secrets, API keys, Google OAuth IDs
nano .env

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f caddy backend
```

Health checks:

- https://mokhik.online/
- https://mokhik.online/api/health/

Seed demo users (optional):

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_demo_data
```

### 4. Google OAuth console

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your OAuth client:

- **Authorized JavaScript origins:** `https://mokhik.online`
- **Authorized redirect URIs:** not required for GIS ID-token flow; add if Google asks

`GOOGLE_OAUTH_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` must match. Rebuild frontend after changing `VITE_*`:

```bash
docker compose -f docker-compose.prod.yml up -d --build frontend
```

### 5. Environment checklist

| Variable | Production value |
|----------|------------------|
| `DJANGO_DEBUG` | `false` |
| `DJANGO_SECRET_KEY` | long random string |
| `DJANGO_ALLOWED_HOSTS` | `mokhik.online,www.mokhik.online` |
| `DJANGO_CORS_ALLOWED_ORIGINS` | `https://mokhik.online,https://www.mokhik.online` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | same as CORS |
| `VITE_API_URL` | `https://mokhik.online/api` |
| `VITE_WS_URL` | `wss://mokhik.online/ws` |
| `POSTGRES_PASSWORD` / MinIO keys | strong, unique |
| AI / Deepgram / Rumik keys | from your local `.env` |

Do **not** use `docker-compose.yml` (dev) on the server — it publishes Postgres/Redis/MinIO/Grafana to the public host.

### 6. Updates (manual)

```bash
cd mokhik
git pull
./scripts/deploy-prod.sh
```

### 7. CI/CD (GitHub Actions → Linode)

Production deploys are automated:

```mermaid
flowchart LR
  PR[Pull request] --> CI[CI workflow]
  Push[Push to main] --> CI
  CI -->|lint / test / docker build / AI eval| Gate{All green?}
  Gate -->|yes| CD[CD workflow]
  CD --> GHCR[Push images to GHCR]
  GHCR --> SSH[SSH to Linode]
  SSH --> Pull[Pull images + compose up]
  Pull --> Smoke[Health check]
```

| Workflow | File | Trigger | What it does |
|----------|------|---------|--------------|
| **CI** | `.github/workflows/ci.yml` | PR + push to `main` | Backend tests + coverage, migration check, frontend lint/build, Compose validation, Docker image builds, mock AI eval |
| **CD** | `.github/workflows/cd.yml` | After successful CI on `main`, or manual dispatch | Build/push `viva-backend` + `viva-frontend` to GHCR, SSH deploy, smoke-test `https://mokhik.online/api/health/` |

#### One-time GitHub setup

1. **Repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Example | Purpose |
|--------|---------|---------|
| `DEPLOY_HOST` | `203.0.113.10` | Linode public IP or hostname |
| `DEPLOY_USER` | `deploy` | SSH user on the VPS |
| `DEPLOY_SSH_KEY` | `-----BEGIN OPENSSH...` | Private key (ed25519 recommended) |
| `DEPLOY_PATH` | `/home/deploy/mokhik` | Absolute path to the git clone |
| `DEPLOY_PORT` | `22` | Optional; defaults to 22 |
| `GHCR_PULL_TOKEN` | `ghp_...` | Optional PAT with `read:packages` if GHCR images stay private |

2. **Repository variables** (optional overrides):

| Variable | Default |
|----------|---------|
| `VITE_API_URL` | `https://mokhik.online/api` |
| `VITE_WS_URL` | `wss://mokhik.online/ws` |
| `VITE_GOOGLE_CLIENT_ID` | _(empty)_ |
| `HEALTHCHECK_URL` | `https://mokhik.online/api/health/` |

3. **GitHub Environment** named `production` (created automatically on first CD run). Optionally add required reviewers for resume / safety.

4. **SSH on the Linode host**

```bash
# On your laptop — create a deploy key pair (do not reuse your personal key)
ssh-keygen -t ed25519 -C "github-actions-viva" -f ./viva-deploy -N ""

# On the Linode host
sudo adduser --disabled-password deploy   # if needed
sudo usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
# append viva-deploy.pub to /home/deploy/.ssh/authorized_keys
# clone repo once as that user:
sudo -u deploy git clone https://github.com/ritchi-e/VIVA.git /home/deploy/mokhik
sudo -u deploy cp /home/deploy/mokhik/.env.production.example /home/deploy/mokhik/.env
# edit .env with real secrets
```

Paste the **private** key contents into `DEPLOY_SSH_KEY`.

5. **GHCR visibility** — after the first successful CD push, open  
   `https://github.com/users/ritchi-e/packages` → `viva-backend` / `viva-frontend` → Package settings → change visibility to **Public**  
   (or set `GHCR_PULL_TOKEN` so the server can pull private images).

6. Push to `main` (or run **CD** → “Run workflow”). Confirm the Actions run and then `https://mokhik.online/api/health/`.

#### Resume / interview talking points

- Separated **CI** (quality gates on every PR) from **CD** (deploy only after green main).
- Immutable deploy artifacts via **GHCR** (`:sha` + `:latest` tags).
- **SSH deploy** to a single Linode VPS with Compose, TLS via Caddy, and post-deploy health checks.
- Frontend production env baked at image build time (`VITE_*` build args).

### 8. Backups

- Snapshot the Linode weekly, or
- `docker compose -f docker-compose.prod.yml exec postgres pg_dump -U aiviva aiviva > backup.sql`
- Persist `postgres_data` / `minio_data` volumes

## Production architecture (managed alternative)

For larger scale, move Postgres / Redis / object storage to managed services and keep only API + workers + static frontend on the VPS. See the diagram in earlier docs revisions.
