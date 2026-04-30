# Installation and Prerequisites

Document-ID: MKT-DOC-OPS-INSTALLATION-PREREQUISITES
Version: v1.1
Status: Active
Owner: Engineering Lead
Last-Updated: 2026-04-28
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

## 1) Purpose

Define an exact, deterministic onboarding baseline for required tools/services so local development stays aligned with CI behavior.

Important context:
- current repository view is documentation-centric, and runtime/toolchain files were **not detected** (`package.json`, `pyproject.toml`, `go.mod`, `Dockerfile`, `docker-compose*.yml`, `.nvmrc`, `.python-version`, `.tool-versions` not found in this workspace snapshot).
- therefore, runtime-specific fields are explicitly marked as `[REQUIRED_FILL]`.

## 2) Scope and Audience

This document is for:
- backend developers
- frontend developers
- QA engineers running local verification
- DevOps/release owners validating CI parity assumptions

## 3) OS Support Matrix

| OS | Support Level | Notes |
|---|---|---|
| Linux (Ubuntu/Debian/Fedora) | Primary | Recommended baseline for parity with CI/container flows. |
| macOS (Apple Silicon + Intel) | Supported | Use package manager equivalents; prefer local runtime over Docker for hot-reload heavy UI workflows. |
| Windows | Supported via WSL2 | Use Ubuntu in WSL2 for shell/tool parity; avoid mixed Windows/WSL path assumptions. |

## 4) Required Tools and Versions

Project-specific runtime stack is not inferable with certainty from current repository files. Fill all `[REQUIRED_FILL]` fields before team-wide enforcement.

| Tool | Purpose | Min Version | Recommended Version | Verify Command |
|---|---|---:|---:|---|
| `git` | source control | 2.40+ | latest stable | `git --version` |
| `curl` | HTTP/API smoke checks | 7.8+ | latest stable | `curl --version` |
| `rg` (ripgrep) | fast repo search | 13+ | latest stable | `rg --version` |
| `[REQUIRED_FILL: primary runtime]` | app runtime (Node/Python/Go/...) | `[REQUIRED_FILL]` | `[REQUIRED_FILL]` | `[REQUIRED_FILL]` |
| `[REQUIRED_FILL: package manager]` | dependency installation | `[REQUIRED_FILL]` | `[REQUIRED_FILL]` | `[REQUIRED_FILL]` |
| `[REQUIRED_FILL: database engine]` | persistence service | `[REQUIRED_FILL]` | `[REQUIRED_FILL]` | `[REQUIRED_FILL]` |
| `[REQUIRED_FILL: cache/queue]` | state/async support (if used) | `[REQUIRED_FILL]` | `[REQUIRED_FILL]` | `[REQUIRED_FILL]` |
| `docker` | optional local service orchestration | 24+ | latest stable | `docker --version` |
| `docker compose` | multi-service local stack | 2.20+ | latest stable | `docker compose version` |

## 5) Version Manager Recommendation

Use one version manager policy and enforce it across dev + CI.

- Node ecosystem: prefer `.nvmrc` or `.tool-versions` + `engines` policy in manifest.
- Python ecosystem: prefer `.python-version` (`pyenv`) + locked virtual environment workflow.
- Polyglot repos: prefer `asdf` with a committed `.tool-versions`.

Policy:
1. version pin file MUST be committed.
2. CI runtime version MUST match local pin.
3. do not rely on system-default runtime.

## 6) Package Manager Policy

Deterministic install rules:
- exactly one primary package manager per runtime path (`npm` OR `pnpm` OR `yarn`, not mixed in one package).
- lockfile MUST be committed.
- CI MUST use lockfile-strict commands.

Command policy by ecosystem (choose only relevant one):
- npm: `npm ci`
- pnpm: `pnpm install --frozen-lockfile`
- yarn: `yarn install --immutable`
- Python pip: `[REQUIRED_FILL: pinned lock/install command]`
- Go: `go mod verify` (after `go mod download`)

## 7) Deterministic Installation Flow (CI-Parity Friendly)

### Step 0: Clone

```bash
git clone [REQUIRED_FILL: repo_url]
cd [REQUIRED_FILL: repo_dir]
```

### Step 1: Detect Runtime and Toolchain Files

```bash
rg --files -g "package.json" -g "pnpm-lock.yaml" -g "yarn.lock" -g "package-lock.json" -g "pyproject.toml" -g "requirements*.txt" -g "go.mod" -g "Dockerfile" -g "docker-compose*.yml" -g ".nvmrc" -g ".python-version" -g ".tool-versions" .
```

If none found for target app path:
- block onboarding completion
- fill missing stack metadata first (`[REQUIRED_FILL]`)

### Step 2: Pin/Activate Runtime

```bash
# Example patterns only; choose one based on actual stack
nvm use || true
pyenv local [REQUIRED_FILL: python_version] || true
asdf install || true
```

### Step 3: Install Dependencies (Lockfile Strict)

```bash
[REQUIRED_FILL: deterministic_install_command]
```

Examples (use only if matching actual stack):
- `npm ci`
- `pnpm install --frozen-lockfile`
- `yarn install --immutable`

### Step 4: Configure Local Environment

```bash
cp .env.example .env
```

Then fill:
- `[REQUIRED_FILL: env var source doc/path]`

### Step 5: Start Local Services

```bash
[REQUIRED_FILL: local_services_up_command]
```

If using Docker Compose, recommended baseline:
- keep base compose file environment-agnostic
- keep development overrides in `docker-compose.override.yml`
- use healthchecks for dependency readiness

### Step 6: Start Application

```bash
[REQUIRED_FILL: app_start_command]
```

## 8) Optional Tooling (Recommended)

- linting:
  - `[REQUIRED_FILL: lint command]`
- formatting:
  - `[REQUIRED_FILL: format command]`
- API client/testing:
  - `curl`, Postman, Bruno, Insomnia (team preference)
- observability:
  - local logs + traces tooling if available (`[REQUIRED_FILL]`)
- dependency automation:
  - Dependabot/Renovate with lockfile-safe update strategy

## 9) Verification Commands and Expected Outputs

Run this as onboarding proof:

```bash
git --version
curl --version
rg --version
docker --version || true
docker compose version || true
[REQUIRED_FILL: runtime_verify_command]
[REQUIRED_FILL: package_manager_verify_command]
[REQUIRED_FILL: dependency_install_check_command]
[REQUIRED_FILL: app_health_check_command]
```

Expected output pattern:
- version commands return non-empty semantic version lines.
- install check exits with code `0`.
- app health check returns `2xx` or project-defined healthy payload.

Recommended health check template:

```bash
curl -fsS [REQUIRED_FILL: local_health_url] && echo "HEALTH_OK"
```

## 10) CI Parity Checklist (Deterministic)

All must be true:

- [ ] local runtime version equals CI runtime version
- [ ] lockfile exists and is committed
- [ ] install command is lockfile-strict
- [ ] env file is sourced from template, not hardcoded
- [ ] service startup uses health checks (not only startup order)
- [ ] at least one app health endpoint returns healthy
- [ ] lint/test smoke command exits successfully (`[REQUIRED_FILL]`)

## 11) Security Notes

- never commit `.env`, secret dumps, or credential files.
- commit `.env.example` only (placeholder values).
- prefer local secret injection via shell/session/environment manager.
- validate required env vars at startup and fail fast on missing values.
- never print full secret values in logs.
- rotate any secret accidentally exposed in local history immediately.

## 12) Project-Semantic Guardrails (Operational Context)

While installing/running locally, keep behavior aligned with active product semantics:
- tenant-scoped data boundaries
- fail-closed tenant enforcement
- dual-mode identity flow (Telegram + web)
- canonical error envelope expectations

References:
- `docs/20-architecture/canonical_framework.md`
- `docs/20-architecture/contracts/api_endpoint_contracts_v2.md`
- `docs/20-architecture/contracts/authz_tenant_endpoint_matrix_v2.md`
- `docs/20-architecture/contracts/error_response_taxonomy_v2.md`
