# Environment Variables Reference

Document-ID: MKT-DOC-OPS-ENV-VARIABLES
Version: v1.0
Status: Active
Owner: Engineering Lead
Last-Updated: 2026-04-28
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

## 1. Purpose

Define environment variable standards for local development and CI without exposing secrets.

## 2. Policy

- Required variables MUST be present at startup; application MUST fail fast if missing.
- `.env` and `.env*.local` MUST NOT be committed.
- `.env.example` MUST be committed and kept current.
- Secret values MUST NOT appear in logs or docs.
- Variable names MUST use `SCREAMING_SNAKE_CASE`.

## 3. File Conventions

- committed:
  - `.env.example`
  - optionally `.env.development` and `.env.test` if they contain non-secret defaults
- not committed:
  - `.env`
  - `.env.local`
  - `.env.*.local`

## 4. Core App Variables

| Name | Purpose | Required | Default | Format/Allowed | Security | Used By |
|---|---|---|---|---|---|---|
| `APP_ENV` | runtime environment | yes | `development` | `development|test|staging|production` | non-secret | backend/frontend |
| `APP_PORT` | app bind port | yes | `3000` | integer | non-secret | backend or frontend |
| `LOG_LEVEL` | logging verbosity | no | `info` | `debug|info|warn|error` | non-secret | backend |
| `API_BASE_PATH` | API prefix | yes | `/api/v2` | path | non-secret | backend/frontend |

## 5. Data Service Variables

| Name | Purpose | Required | Default | Format/Allowed | Security | Used By |
|---|---|---|---|---|---|---|
| `DATABASE_URL` | primary database connection | yes | none | URL | secret | backend |
| `DB_POOL_MIN` | db pool lower bound | no | `[REQUIRED_FILL]` | integer | non-secret | backend |
| `DB_POOL_MAX` | db pool upper bound | no | `[REQUIRED_FILL]` | integer | non-secret | backend |
| `CACHE_URL` | cache/queue endpoint | conditional | none | URL | secret | backend |

## 6. Auth/Identity Variables

| Name | Purpose | Required | Default | Format/Allowed | Security | Used By |
|---|---|---|---|---|---|---|
| `SESSION_SECRET` | session signing key | yes | none | high-entropy string | secret | backend |
| `TELEGRAM_BOT_TOKEN` | Telegram integration validation | conditional | none | token string | secret | backend |
| `AUTH_TOKEN_TTL_SECONDS` | session/token TTL | no | `[REQUIRED_FILL]` | integer | non-secret | backend |

## 7. Feature/Operational Variables

| Name | Purpose | Required | Default | Format/Allowed | Security | Used By |
|---|---|---|---|---|---|---|
| `ENABLE_EXPORT` | enable reconciliation export path | no | `true` | `true|false` | non-secret | backend |
| `ENABLE_AUDIT_EVENTS` | enforce audit emissions | no | `true` | `true|false` | non-secret | backend |

## 8. Frontend Public Variables

Use only public-safe values in frontend-exposed variables.

| Name | Purpose | Required | Default | Format/Allowed | Security | Used By |
|---|---|---|---|---|---|---|
| `PUBLIC_API_BASE_URL` | API base URL for browser app | yes | none | URL | non-secret | frontend |
| `PUBLIC_APP_NAME` | app label | no | `[REQUIRED_FILL]` | string | non-secret | frontend |

## 9. .env.example Guidance

Template requirements:

- include every required variable name
- use placeholder values only
- add short comments for purpose/format
- keep ordering stable by section

Example:

```env
# Core
APP_ENV=development
APP_PORT=3000
API_BASE_PATH=/api/v2

# Data
DATABASE_URL=postgresql://user:password@localhost:5432/app_db

# Auth
SESSION_SECRET=replace_with_local_secret
TELEGRAM_BOT_TOKEN=replace_if_needed
```

## 10. Startup Validation Rules

- Required vars missing -> startup MUST fail.
- Invalid format vars -> startup MUST fail with explicit var name.
- Secret vars MUST be redacted in logs.

## 11. CI and Production Notes

- CI uses non-production credentials only.
- Production secrets should come from a secret manager, not committed files.
- Secret rotation policy should be enforced by platform ops.
