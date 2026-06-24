# P7 — Smoke scenario map

```yaml
map_id: SMOKE-SCENARIO-MAP-P7
version: "2026-06-22-v1.4"
pack_version: "1.6"
authority: p7-exit-checklist.md · p7-staging-e2e.md
gate_dev: pnpm run p6:gate
gate_staging: pnpm run p7:staging-verify
gate_t2: runbooks/p7-staging-e2e.md
```

> P7 reuses P6 smoke IDs on **staging URLs** via env overrides. Runbook: [p7-staging-e2e.md](../runbooks/p7-staging-e2e.md).

---

## P7 infra

| ID | When | Command / flow | Nano |
| -- | ---- | -------------- | ---- |
| **SMK-P7-INFRA-01** | Post four-process deploy | `TOUR_OPS_API_URL=... node scripts/smoke-p6-host-bind.mjs` | P7-0-N-004 |
| **SMK-P7-INFRA-02** | API health | `curl $TOUR_OPS_API_URL/health` | P7-0-N-004 |
| **SMK-P7-INFRA-03** | Operator login | `scripts/vps-deploy/smoke-operator-login.sh` | P7-0-N-005 |
| **SMK-P7-INFRA-04** | Marketing health | `curl :3002/health` | P7-0-N-004 |
| **SMK-P7-INFRA-05** | Portal health | `curl :3003/health` | P7-0-N-004 |

---

## P6 vertical slice on staging (T2)

| ID | VS | Spec | P7 nano | Staging env |
| -- | -- | ---- | ------- | ----------- |
| SMK-P6-HOST-01 | — | `smoke-p6-host-bind.mjs` | P7-0-N-004 | `TOUR_OPS_API_URL` |
| SMK-P6-VS-01 | VS-01 | `p6-admin-publish-smoke.spec.ts` | P7-1-N-009 | `pnpm run p7:staging-vs01-probe` (staging) · `PLAYWRIGHT_BASE_URL` (E2E) |
| SMK-P6-MKT-03 | VS-02/03 | `marketing-catalog-smoke.spec.ts` | P7-3-N-001 | `SMOKE_MARKETING_BASE_URL` |
| SMK-P6-PTL-01 | VS-03 | `portal-registration-smoke.spec.ts` | P7-3-N-001 | `SMOKE_PORTAL_BASE_URL` |
| SMK-P6-PTL-02 | VS-04 | `portal-member-smoke.spec.ts` | P7-3-N-001 | same |
| SMK-P6-PTL-04 | VS-05 | `portal-member-smoke.spec.ts` | P7-3-N-001 | same |
| SMK-P9-04 | VS-06 | `operator-smoke.spec.ts` | P7-2-N-003 | `PLAYWRIGHT_BASE_URL` |
| SMK-P6-ADM-02 | VS-07 | `p6-operator-receipt-approve-smoke.spec.ts` | P7-3-N-001 | `PLAYWRIGHT_BASE_URL` |
| P6-MR-03 / finance-ops | VS-07 | `finance-ops.spec.ts` | P7-3-N-002 | `DATABASE_URL` |

**External servers:** `PW_EXTERNAL_SERVERS=1` · `PW_NO_REUSE_SERVER=1`

---

## Tier mapping

| Tier | Scenarios | Runbook |
| ---- | --------- | ------- |
| T1 | `p6:gate` · `p7:gate` | AGENT-START |
| T2 | SMK-P6-* on staging | [p7-staging-e2e.md](../runbooks/p7-staging-e2e.md) |
| T3 | `finance-ops.spec.ts` | p7-staging-e2e §T3 |
| T4 | sign-off checklist | [p7-customer-sign-off.md](../runbooks/p7-customer-sign-off.md) |

---

## References

- [P7-PORT-MATRIX.md](P7-PORT-MATRIX.md)
- [SMOKE-SCENARIO-MAP-P6.md](../../phase-19/p6/appendices/SMOKE-SCENARIO-MAP-P6.md)
