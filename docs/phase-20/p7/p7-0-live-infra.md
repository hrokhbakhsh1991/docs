# P7-0 — Live infra (staging + seed)

```yaml
epic: P7-0
nanos: 5
pack_version: "1.6"
status: STAGING_GREEN
priority: 1
blocks: P7-1
current_nano: P7-0-N-005
runbook: runbooks/p7-0-staging-walkthrough.md
exit_signal: Operator staging login + same tenantId on all hosts
```

## Goal

اولین club مشتری روی **staging** با چهار process (API + web + marketing + portal) + Postgres — بدون refactor محصول.

## Scope

| In | Out |
| -- | --- |
| Deploy checklist اجرا | Prod cutover |
| Seed tenant/owner/tour scaffold | Custom apex (`tenant_domains`) مگر اجباری |
| Env matrix profiles A/B/C | Multi-region |
| `smoke-p6-host-bind` روی staging | |

---

## Nanos

### P7-0-N-001 — Staging deploy walkthrough

```yaml
nano: P7-0-N-001
proof_tier: DOC
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-0-N-001
repo_status: DEV_PASS
forbidden_until: []
```

**Do:** Document full staging deploy path + wire `p7:staging-verify`.

**Files:** [runbooks/p7-0-staging-walkthrough.md](runbooks/p7-0-staging-walkthrough.md) · [scripts/p7-staging-verify.sh](../../../scripts/p7-staging-verify.sh)

**Verify:** `pnpm run p7:gate` · walkthrough cross-links [staging-deploy.md](../../phase-19/p6/runbooks/staging-deploy.md)

**Status:** doc complete

---

### P7-0-N-002 — Env matrix verified

```yaml
nano: P7-0-N-002
proof_tier: STAGING
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-0-N-002
repo_status: NOT_STARTED
forbidden_until: [P7-0-N-001]
```

**Do:** Three profiles documented and verified against running env.

**Files:** [runbooks/p7-0-env-matrix.md](runbooks/p7-0-env-matrix.md) · per-app `.env.local` or `/etc/app-tour/*.env`

**Profiles:**

| ID | Use |
| -- | --- |
| A | Local dev canonical hosts |
| B | VPS IP (no DNS) |
| C | Subdomain staging (north star) |

**Verify:** Profile B-staging on VPS · `pnpm run p7:staging-remote-smoke`

**Status:** STAGING PASS (2026-06-23 · `/etc/app-tour-staging` · PORT=23001)

---

### P7-0-N-003 — Customer seed on staging Postgres

```yaml
nano: P7-0-N-003
proof_tier: STAGING
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-0-N-003
repo_status: NOT_STARTED
forbidden_until: [P7-0-N-002]
```

**Do:** Apply P6 seed on staging with migrations + RLS.

**Files:** [first-customer-seed.md](../../phase-19/p6/runbooks/first-customer-seed.md) · [P7-CUSTOMER-SEED-DELTA.md](appendices/P7-CUSTOMER-SEED-DELTA.md) · `apps/api/scripts/db-seed.ts`

**Verify:**

```bash
DATABASE_URL=... DATABASE_URL_ADMIN=... pnpm --filter @apps/api run db:seed
curl -s -H "x-forwarded-host: <staging-host>" "$TOUR_OPS_API_URL/public/tenant-context"
```

`site_surfaces` true · `denali-v1` definition · active tour present

---

### P7-0-N-004 — Four-process deploy + host smoke

```yaml
nano: P7-0-N-004
proof_tier: STAGING
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-0-N-004
repo_status: STAGING_PASS
forbidden_until: [P7-0-N-003]
```

**Do:** API + web + marketing + portal running on staging; host tenant parity.

**Files:** [deploy/vps/README.md](../../../deploy/vps/README.md) · `scripts/p7-staging-remote-smoke.sh`

**Verify:** `pnpm run p7:staging-remote-smoke` · SMK-P7-INFRA-01..02

**Status:** STAGING PASS (2026-06-23 · 4 units active · health 200)

---

### P7-0-N-005 — Operator staging login exit

```yaml
nano: P7-0-N-005
proof_tier: STAGING
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-0-N-005
repo_status: STAGING_PASS
forbidden_until: [P7-0-N-004]
```

**Do:** Operator can OTP-login on staging admin URL; tenant resolves correctly.

**Files:** `scripts/p7-staging-operator-login.sh` · `scripts/vps-deploy/smoke-operator-login.sh`

**Verify:** `pnpm run p7:staging-operator-login` · SMK-P7-INFRA-03

**Status:** STAGING PASS (2026-06-23 · verify-db-env OK · OTP challenge issued)

---

## EPIC exit

Operator logs in on staging; same `tenantId` on marketing · portal · admin; seed + health green.

## References

- [P6-P7-BOUNDARY.md](appendices/P6-P7-BOUNDARY.md)
- [SMOKE-SCENARIO-MAP-P7.md](appendices/SMOKE-SCENARIO-MAP-P7.md)
