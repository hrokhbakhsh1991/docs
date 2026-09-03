# Denali Wallet v1 — Staging deployment runbook

```yaml
runbook_id: DENALI-WALLET-V1-STAGING
pack: wallet
status: ACTIVE
release_sha_contract: checked-out Git HEAD
scope: staging-only · pilot tenant 00000000-0000-4000-8000-000000000430
```

> **Scope:** Staging VPS only (`/opt/app-tour-staging`, `/etc/app-tour-staging`).  
> **Production is explicitly refused** by deploy guards (`/opt/app-cloud`, `/etc/app-tour` without `staging`, production hostnames such as `.denali.club`).  
> **No bulk Wallet enablement.** Pilot seed touches **one** tenant only.

---

## 1 — Prerequisites

| Item            | Staging example                              |
| --------------- | -------------------------------------------- |
| VPS deploy root | `/opt/app-tour-staging`                      |
| Env directory   | `/etc/app-tour-staging`                      |
| Systemd prefix  | `app-tour-staging`                           |
| Loopback ports  | API `23001`, Web `23000`, Portal `23003`     |
| Pilot tenant id | `00000000-0000-4000-8000-000000000430`       |
| Pilot subdomain | `denali-wallet-pilot`                        |
| Release SHA     | checked-out Git HEAD (full 40-character SHA) |

DNS (replace `staging.yourclub.ir` with your apex):

- `admin.denali-wallet-pilot.staging.yourclub.ir` → operator web
- `portal.denali-wallet-pilot.staging.yourclub.ir` → member portal

---

## 2 — Required environment variable names (no values in repo)

Set on VPS in `/etc/app-tour-staging/api.env` (and surface env files as today):

| Variable                  | Surface            | Purpose                                     |
| ------------------------- | ------------------ | ------------------------------------------- |
| `DATABASE_URL`            | API                | App RLS connection                          |
| `DATABASE_URL_ADMIN`      | API                | Migrations + pilot seed                     |
| `STORAGE_DRIVER`          | API                | Must be `prisma`                            |
| `AUTH_JWT_PUBLIC_KEY`     | API                | JWT verify                                  |
| `AUTH_JWT_PRIVATE_KEY`    | API                | JWT sign                                    |
| `AUTH_JWT_ISSUER`         | API                | JWT issuer                                  |
| `AUTH_JWT_AUDIENCE`       | API                | JWT audience                                |
| `PORT`                    | API / Web / Portal | Loopback ports                              |
| `TOUR_OPS_API_URL`        | Web / Portal       | Internal API base                           |
| `PLATFORM_ROOT_DOMAIN`    | All                | Optional for external hostname smoke checks |
| `TENANT_ROOT_DOMAIN`      | All                | Optional for external hostname smoke checks |
| `ALLOW_DENALI_WEB_PLUGIN` | Web                | Denali operator bundle                      |

Deploy orchestration (set only when running wallet deploy scripts):

| Variable                             | Required                  | Purpose                                         |
| ------------------------------------ | ------------------------- | ----------------------------------------------- |
| `DENALI_WALLET_DEPLOY_TARGET`        | yes                       | Must be `staging`                               |
| `DENALI_WALLET_STAGING_CONFIRM`      | yes                       | Must be `1`                                     |
| `ENV_DIR`                            | yes                       | `/etc/app-tour-staging`                         |
| `DEPLOY_ROOT`                        | yes                       | `/opt/app-tour-staging`                         |
| `EXPECTED_RELEASE_SHA`               | required for verification | Exact checked-out Git HEAD SHA                  |
| `DENALI_WALLET_SEED_PILOT`           | opt-in                    | `1` runs pilot seed only                        |
| `DENALI_WALLET_ADMIN_HOST`           | verify                    | Pilot operator host for tenant-config check     |
| `DENALI_WALLET_PORTAL_HOST`          | verify                    | Pilot portal host                               |
| `DENALI_WALLET_NON_PILOT_ADMIN_HOST` | verify                    | Negative check (e.g. `operator.admin.staging…`) |

**Never commit** connection strings, JWT PEM bodies, OTP values, or cookies.

---

## 3 — Artifact build order (build host / CI)

From the clean `release/denali-wallet-v1` checkout at the verified SHA:

```bash
EXPECTED_RELEASE_SHA="$(git rev-parse HEAD)"

# 1. Install + generate
nvm use && pnpm install --frozen-lockfile
pnpm --filter @apps/api run prisma:generate

# 2. Build staging artifact (API + Web + Portal + Marketing bundles)
bash scripts/vps-deploy/build-staging-artifact.sh
# Output: dist/staging-artifacts/app-tour-staging-<sha>.tar.zst + .sha256
# Includes: bin/migrate-deploy.sh, bin/seed-staging.sh, bin/seed-denali-wallet-pilot.sh
```

Artifact contains **API, Web, Portal** standalone Next layouts (marketing included by existing staging pipeline; Wallet deploy restarts API/Web/Portal only).

---

## 4 — Artifact transfer (from machine with VPS access)

```bash
VPS_HOST=<staging-ip> VPS_USER=root \
ARTIFACT=dist/staging-artifacts/app-tour-staging-<release-head-sha>.tar.zst \
bash scripts/vps-deploy/deploy-staging-artifact-remote.sh
```

On VPS after transfer:

```bash
ARTIFACT=/tmp/app-tour-artifacts/app-tour-staging-<sha>.tar.zst \
DEPLOY_ROOT=/opt/app-tour-staging \
ENV_DIR=/etc/app-tour-staging \
bash /opt/app-tour-staging/tooling/scripts/vps-deploy/install-staging-artifact.sh
```

---

## 5 — Migration order

1. `install-staging-artifact.sh` runs `bin/migrate-deploy.sh` (standard staging seed).
2. **Wallet deploy** runs migrate again (idempotent) before optional pilot seed:

```bash
DENALI_WALLET_DEPLOY_TARGET=staging \
DENALI_WALLET_STAGING_CONFIRM=1 \
DENALI_WALLET_EXECUTION_CONTEXT=vps \
ENV_DIR=/etc/app-tour-staging \
DEPLOY_ROOT=/opt/app-tour-staging \
EXPECTED_RELEASE_SHA=<release-head-sha> \
DENALI_WALLET_SEED_PILOT=1 \
bash /opt/app-tour-staging/tooling/scripts/vps-deploy/deploy-denali-wallet-staging.sh
```

Pilot seed runs with the staging service `NODE_ENV` (including `production`) only when the target is staging, confirmation is explicit, and execution context is `vps`. Development/test seed behavior remains supported. It does **not** enable Wallet on club smoke `…000003` or operator smoke `…000014`.

---

## 6 — Health checks

```bash
ENV_DIR=/etc/app-tour-staging \
bash /opt/app-tour-staging/tooling/scripts/vps-deploy/smoke-four-process.sh

ENV_DIR=/etc/app-tour-staging \
DEPLOY_ROOT=/opt/app-tour-staging \
DENALI_WALLET_ADMIN_HOST=admin.denali-wallet-pilot.staging.yourclub.ir \
DENALI_WALLET_PORTAL_HOST=portal.denali-wallet-pilot.staging.yourclub.ir \
DENALI_WALLET_NON_PILOT_ADMIN_HOST=operator.admin.staging.yourclub.ir \
bash /opt/app-tour-staging/tooling/scripts/vps-deploy/verify-denali-wallet-staging.sh
```

---

## 7 — Smoke checks (manual)

| Flow                 | Check                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| Operator login       | Admin host → OTP login → `/wallet` nav visible                                      |
| Operator ops         | Credit/debit with reason; insufficient debit rejected                               |
| Member portal        | Entitled member → `/me/wallet` balance/history                                      |
| Non-entitled member  | Portal gate denies wallet                                                           |
| Non-pilot tenant     | Operator smoke tenant has **no** wallet nav (`FORBIDDEN_WALLET_MODULE_DISABLED`)    |
| Manual refund credit | Finance → Completed refund → **Credit refund to member wallet** → idempotent replay |
| Finance integrity    | Refund status/amount unchanged after wallet credit                                  |

---

## 8 — Rollback procedure

**Module disable only** (ledger + finance data preserved):

```bash
DENALI_WALLET_DEPLOY_TARGET=staging \
DENALI_WALLET_ROLLBACK_CONFIRM=1 \
ENV_DIR=/etc/app-tour-staging \
DEPLOY_ROOT=/opt/app-tour-staging \
bash /opt/app-tour-staging/tooling/scripts/vps-deploy/rollback-denali-wallet-staging.sh
```

**Optional artifact revert** (when `previous-release` exists):

```bash
DENALI_WALLET_ROLLBACK_ARTIFACT=1 \
...same confirms... \
bash /opt/app-tour-staging/tooling/scripts/vps-deploy/rollback-denali-wallet-staging.sh
```

---

## 9 — Warnings

- **Do not run `next build` on the VPS while certification dev servers are active** — production build overwrites `.next` and breaks Playwright/cert OTP flows until cache is cleared.
- **Do not set `DENALI_WALLET_BULK_TENANT_UPDATE` or `DENALI_WALLET_ENABLE_ALL_TENANTS`** — guards refuse.
- **Do not point deploy scripts at production paths** — guards refuse `/opt/app-cloud` and non-staging `ENV_DIR`.
- Pilot seed is **explicit opt-in** (`DENALI_WALLET_SEED_PILOT=1`).

---

## 10 — Local dry-run (no VPS / no DB)

From repo checkout:

```bash
DENALI_WALLET_DEPLOY_TARGET=staging \
DENALI_WALLET_STAGING_CONFIRM=1 \
DENALI_WALLET_DEPLOY_DRY_RUN=1 \
ENV_DIR=/etc/app-tour-staging \
DEPLOY_ROOT=/opt/app-tour-staging \
STORAGE_DRIVER=prisma \
DATABASE_URL=postgres://placeholder \
DATABASE_URL_ADMIN=postgres://placeholder \
bash scripts/vps-deploy/deploy-denali-wallet-staging.sh
```

Guard unit tests:

```bash
pnpm run test:wallet-staging-deploy-guards
```

---

## 11 — Exact VPS-side command (post-artifact install)

```bash
DENALI_WALLET_DEPLOY_TARGET=staging \
DENALI_WALLET_STAGING_CONFIRM=1 \
DENALI_WALLET_EXECUTION_CONTEXT=vps \
ENV_DIR=/etc/app-tour-staging \
DEPLOY_ROOT=/opt/app-tour-staging \
EXPECTED_RELEASE_SHA=<release-head-sha> \
DENALI_WALLET_SEED_PILOT=1 \
DENALI_WALLET_ADMIN_HOST=admin.denali-wallet-pilot.staging.yourclub.ir \
DENALI_WALLET_PORTAL_HOST=portal.denali-wallet-pilot.staging.yourclub.ir \
DENALI_WALLET_NON_PILOT_ADMIN_HOST=operator.admin.staging.yourclub.ir \
bash /opt/app-tour-staging/tooling/scripts/vps-deploy/deploy-denali-wallet-staging.sh
```

---

## References

- Wallet contract: `docs/architecture/wallet-module-phase-0-contract.mdoc` §10
- Staging four-process: `docs/phase-23/runbooks/p10-incident-four-process.md`
- Artifact pipeline: `scripts/vps-deploy/build-staging-artifact.sh`
