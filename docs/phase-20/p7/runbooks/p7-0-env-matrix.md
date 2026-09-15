# P7-0 — Env matrix (P7-0-N-002)

```yaml
nano: P7-0-N-002
pack_version: "1.6"
authority: ../p7-0-live-infra.md
port_matrix: ../appendices/P7-PORT-MATRIX.md
profiles: [local-dev, vps-ip-staging, subdomain-staging]
```

**Ports:** canonical table → [P7-PORT-MATRIX.md](../appendices/P7-PORT-MATRIX.md) (DEC-P7-010).

---

## Profile A — Local dev (canonical hosts)

| Variable | api | web | marketing | portal |
| -------- | --- | --- | --------- | ------ |
| `PORT` | **4000** typical | 3000 | 3002 | 3003 |
| `TOUR_OPS_API_URL` | — | `http://127.0.0.1:4000` | same | same |
| `ALLOW_DEV_WEB_SESSION` | — | `true` | — | — |
| `AUTH_ALLOW_DEV_STATIC_OTP` | `true` | — | — | — |
| `PORTAL_PUBLIC_BASE_URL` | — | — | `http://operator.portal.localhost:3003` | — |

Source: `apps/api/.env.local` · per-app `.env.local`.

**Verify:** [p7-0-local-stack.md](p7-0-local-stack.md) · `TOUR_OPS_API_URL=http://127.0.0.1:4000 pnpm run p7:staging-verify`

---

## Profile B — VPS IP staging (no DNS)

Production operator stack (`/etc/app-tour`, ports **13000/13001**) — do not use for P7 proof.

### Profile B-staging — isolated P6/P7 stack (current VPS)

| Variable | api | web | marketing | portal |
| -------- | --- | --- | --------- | ------ |
| `PORT` | **23001** | 23000 | 23002 | 23003 |
| `TOUR_OPS_API_URL` | — | `http://127.0.0.1:23001` | same | same |
| `NODE_ENV` | `development` (tsx API) | `production` | `production` | `production` |
| `PUBLIC_TENANT_FALLBACK_LABEL` | `denali` | — | — | — |
| `PUBLIC_TENANT_FALLBACK_HOSTS` | `89.42.210.252,127.0.0.1` | — | — | — |
| `ALLOW_DEV_WEB_SESSION` | — | `true` | `true` | `true` |
| `TOUR_OPS_DEV_TENANT_ID` | — | — | `…000014` | `…000014` |

Files: `/etc/app-tour-staging/{api,web,marketing,portal}.env` · wiring: `bash scripts/vps-deploy/bootstrap-staging.sh`

**Verify (fast — no full gate):**

```bash
pnpm run p7:staging-remote-smoke
# or on VPS:
ENV_DIR=/etc/app-tour-staging bash scripts/vps-deploy/verify-env-coherence.sh
TOUR_OPS_API_URL=http://127.0.0.1:23001 node scripts/smoke-p6-host-bind.mjs
```

**Proof 2026-06-23:** `verify-env-coherence: OK (api PORT=23001)` · `P6_HOST_BIND_SMOKE_OK` · 4 systemd units active.

### Profile B — prod reference (legacy table)

| Variable | api | web | marketing | portal |
| -------- | --- | --- | --------- | ------ |
| `PORT` | **3001** | 3000 | 3002 | 3003 |
| `TOUR_OPS_API_URL` | — | `http://127.0.0.1:3001` | same | same |
| `PUBLIC_TENANT_FALLBACK_LABEL` | `denali` or `operator` | — | — | — |
| `PUBLIC_TENANT_FALLBACK_HOSTS` | VPS IP | — | — | — |
| `TOUR_OPS_PUBLIC_FALLBACK_HOSTS` | — | VPS IP | VPS IP | VPS IP |
| `SESSION_COOKIE_SECURE` | — | `false` | — | `false` |
| `AUTH_ALLOW_DEV_STATIC_OTP` | optional until SMS | — | — | — |

Files: `/etc/app-tour/{api,web,marketing,portal}.env` — templates under [`deploy/vps/env/`](../../../../deploy/vps/env/).

**Verify:**

```bash
bash scripts/vps-deploy/verify-env-coherence.sh
bash scripts/vps-deploy/smoke-operator-login.sh
TOUR_OPS_API_URL=http://127.0.0.1:3001 pnpm run p7:staging-verify
```

---

## Profile C — Subdomain staging (north star)

| Variable | api | web / marketing / portal |
| -------- | --- | ------------------------ |
| `PLATFORM_ROOT_DOMAIN` | `staging.example.com` | — |
| `TOUR_OPS_API_URL` | — | `https://api.staging.example.com` |
| `MARKETING_PUBLIC_BASE_URL` | — | `https://{club}.staging.example.com` |
| `PORTAL_PUBLIC_BASE_URL` | — | `https://{club}.portal.staging.example.com` |
| `ALLOW_DEV_WEB_SESSION` | — | **`false`** |
| `AUTH_ALLOW_DEV_STATIC_OTP` | **`false`** | — |

DNS: `operator.{root}` · `operator.portal.{root}` · `operator.admin.{root}`.

SMS: configure provider on API (no static OTP). Document provider env in `/etc/app-tour/api.env` — waivers only via T4 §Known exceptions.

---

## Catalog revalidate (required for VS-02 / BLK-CAT-01)

Set on **API** (`api.env`):

| Variable | Profile B example | Profile C example |
| -------- | ----------------- | ----------------- |
| `MARKETING_REVALIDATE_URL` | `http://127.0.0.1:3002` | `https://operator.staging.example.com` |
| `MARKETING_REVALIDATE_SECRET` | shared secret | same secret |

Set on **marketing** (`marketing.env`):

| Variable | Must match |
| -------- | ---------- |
| `MARKETING_REVALIDATE_SECRET` | API secret exactly |

Without both API vars, `maybeScheduleMarketingCatalogRevalidate` is a **no-op** after publish.

**Profile B VPS fix:**

```bash
pnpm run p7:configure-staging-revalidate   # copies secret from marketing.env → api.env · restarts API
pnpm run p7:staging-catalog-probe          # catalog + /tours + POST /api/revalidate
```

**Verify:** publish tour → API log `marketing.catalog.revalidate` success · marketing `/tours` lists new row within one refresh cycle.

---

## MinIO / receipt (VS-05 / VS-07 prep)

| Variable | App | Notes |
| -------- | --- | ----- |
| `MINIO_*` | api | receipt `fileKey` upload path |
| `STORAGE_DRIVER` | api | **`prisma`** on staging (T3) |

---

## Exit signal (P7-0-N-002)

- Profile A/B/C chosen and documented in checklist
- All four env files present on VPS (Profile B) or `.env.local` set (Profile A)
- Revalidate vars set before P7-1 publish proof
- `verify-env-coherence.sh` green (VPS)
- No `ALLOW_DEV_WEB_SESSION=true` on Profile C

**Next:** [P7-CUSTOMER-SEED-DELTA.md](../appendices/P7-CUSTOMER-SEED-DELTA.md) (N-003) · [p7-staging-e2e.md](p7-staging-e2e.md) (T2 after N-004)
