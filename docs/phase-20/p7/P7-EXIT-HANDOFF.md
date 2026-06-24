# P7 exit handoff — operator smoke staging

```yaml
pack: P7
status: STAGING_COMPLETE
blocker: T4_customer_sign_off
vps: 89.45.89.206
profile: B-staging
ports: 23000-23003
evidence: evidence/2026-06-23-operator/
nano_staging_done: 23
nano_total: 27
```

> **23/27 nanos proven on staging.** Remaining gap: formal **T4 customer session** (not automated). Four nanos are spec-only or skipped (P7-2-N-005/006, partial dev N-002).

---

## One-page command map

| When | Command |
| ---- | ------- |
| **Day-of session (one command)** | `pnpm run p7:t4-day` |
| **GO/NO-GO before scheduling** | `pnpm run p7:t4-ready` |
| **Session card (terminal)** | `pnpm run p7:t4-session-brief` |
| Daily regression | `pnpm run p7:gate` |
| VPS health (~5s) | `pnpm run p7:staging-remote-smoke` |
| Re-seed VPS | `pnpm run p7:staging-seed-bundle` |
| Full browser smokes | `pnpm run p7:staging-e2e-probe` |
| Architect witness | `P7_T4_SKIP_GATE=1 pnpm run p7:t4-architect-dry-run` |
| After customer T4 | `P7_T4_ARCHITECT=… P7_T4_OPERATOR=… pnpm run p7:t4-closeout` |

---

## T4 session (customer)

Runbook: [runbooks/p7-t4-sign-off-session.md](runbooks/p7-t4-sign-off-session.md) · [فارسی](runbooks/p7-t4-sign-off-session-fa.md)

| Surface | URL |
| ------- | --- |
| Admin | http://89.45.89.206:23000/auth/login |
| Marketing | http://89.45.89.206:23002/tours |
| Portal | http://89.45.89.206:23003 |
| OTP | `+15550001001` / `1234` |

Use a **fresh guest phone** for registration steps if smoke rows are consumed.

---

## Evidence

| Artifact | Path |
| -------- | ---- |
| Manifest | `evidence/2026-06-23-operator/manifest.yaml` |
| Walkthrough | `evidence/2026-06-23-operator/walkthrough-results.md` |
| E2E summary | `evidence/2026-06-23-operator/staging-e2e-summary.md` |
| Architect log | `evidence/2026-06-23-operator/architect-dry-run.log` |

Verify: `pnpm run p7:evidence-pack-verify`

---

## After closeout

1. `IMPLEMENTATION-TRUTH-P7` → `BEHAVIORAL_COMPLETE`
2. Boot P8: [../phase-21/AGENT-START.md](../phase-21/AGENT-START.md)
3. Horizon: [appendices/POST-P7-HORIZON.md](appendices/POST-P7-HORIZON.md)

---

## Key code fixes (staging arc)

| Fix | File |
| --- | ---- |
| Receipt RLS getById | `apps/api/src/bookings/prisma-bookings.repository.ts` |
| Smoke tour tenant guard | `apps/api/src/settings/seed-operator-smoke-published-tour.ts` |
| VS-07 finance reset | `apps/api/scripts/seed-operator-smoke-pending-booking-staging.ts` |
| E2E tunnel probe | `scripts/p7-staging-e2e-probe.sh` |

VPS runs **tsx** (no dist) — hotfix via rsync + `systemctl restart app-tour-staging-api`.
