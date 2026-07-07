# P7-3 — Delivery exit (customer sign-off)

```yaml
epic: P7-3
nanos: 5
pack_version: "1.6"
status: PLANNED
priority: 4
prerequisite: [P7-0, P7-1, P7-2]
exit: P7-3-N-005
exit_signal: VS-01..08 on staging + customer sign-off
```

## Goal

**Vertical slice کامل روی staging** — مهمان + اپراتور + member — با sign-off مشتری اول.

---

## Verification tiers (frozen from P6)

| Tier | Artifact | Required for P7 exit |
| ---- | -------- | -------------------- |
| T1 | `pnpm run p7:gate` | every PR |
| T2 | [p7-staging-e2e.md](runbooks/p7-staging-e2e.md) | pre-sign-off |
| T3 | [FINANCE-OPS-P6-NOTE.md](../../phase-19/p6/appendices/FINANCE-OPS-P6-NOTE.md) | staging Postgres |
| T4 | [p7-customer-sign-off.md](runbooks/p7-customer-sign-off.md) | manual VS-01..08 |

---

## Nanos

### P7-3-N-001 — T2 E2E on staging URLs

```yaml
nano: P7-3-N-001
proof_tier: STAGING_E2E
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-3-N-001
repo_status: NOT_STARTED
forbidden_until: [P7-2-N-008]
```

**Do:** Run P6 browser smokes against staging base URLs — **authority:** [runbooks/p7-staging-e2e.md](runbooks/p7-staging-e2e.md).

**Files:** [p7-staging-e2e.md](runbooks/p7-staging-e2e.md) · [p6-e2e-smoke.md](../../phase-19/p6/runbooks/p6-e2e-smoke.md) (localhost reference)

**Verify:** Profile B or C copy-paste block green · `PW_EXTERNAL_SERVERS=1` · VS-01..07 staging column in checklist

---

### P7-3-N-002 — T3 finance-ops on staging Postgres

```yaml
nano: P7-3-N-002
proof_tier: STAGING_BEHAVIORAL
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-3-N-002
repo_status: NOT_STARTED
forbidden_until: [P7-0-N-003]
```

**Do:** `finance-ops.spec.ts` green with staging `DATABASE_URL`.

**Files:** `apps/api/test/finance-ops.spec.ts` · migration `008_finance_payments_delta.sql`

**Verify:**

```bash
pnpm run p7:staging-finance-ops-probe   # VPS · sources /etc/app-tour-staging/api.env
# or locally with staging DATABASE_URL:
pnpm --filter @apps/api exec node --import tsx --test test/finance-ops.spec.ts
```

**Pass:** API-9.7-01..03 green on `tour_db_staging` · manual payment → receipt → approve → ledger outbox.

---

### P7-3-N-003 — p7:gate composition documented

```yaml
nano: P7-3-N-003
proof_tier: DEV_STATIC
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-3-N-003
repo_status: DEV_PASS
forbidden_until: []
```

**Do:** Document and extend gate script beyond pack integrity when behavioral specs land.

**Files:** [scripts/p7-denali-delivery-gate.sh](../../../scripts/p7-denali-delivery-gate.sh)

**Current composition:**

```bash
pnpm run p6:gate
pnpm --filter @apps/api exec node --import tsx --test test/p7-pack-integrity.spec.ts
```

**Staging gate (after deploy):** [runbooks/p7-staging-gate.md](runbooks/p7-staging-gate.md) · `pnpm run p7:staging-gate`

**Do not add** automated T2 Playwright to this script — use [p7-staging-e2e.md](runbooks/p7-staging-e2e.md) before T4.

**Verify:** `pnpm run p7:gate` → `P7_DENALI_DELIVERY_GATE_OK`

---

### P7-3-N-004 — Customer sign-off runbook

```yaml
nano: P7-3-N-004
proof_tier: MANUAL
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-3-N-004
repo_status: NOT_STARTED
forbidden_until: [P7-3-N-001, P7-3-N-002]
```

**Do:** Handoff checklist for first customer without dev assistance.

**Files:** [runbooks/p7-customer-sign-off.md](runbooks/p7-customer-sign-off.md)

**Verify:** T4 checklist completed · Architect + customer initials

---

### P7-3-N-005 — Exit nano

```yaml
nano: P7-3-N-005
proof_tier: STAGING
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-3-N-005
repo_status: NOT_STARTED
forbidden_until: [P7-3-N-004]
```

**Do:** All VS-01..08 staging columns ✅ in exit checklist · `p7:gate` green · IMPLEMENTATION-TRUTH-P7 → `BEHAVIORAL_COMPLETE`.

**Verify:** [p7-exit-checklist.md](p7-exit-checklist.md) · AGENT-CURRENT-PHASE.yaml status

---

## VS live checklist

- [ ] VS-01 publish active (customer tour)
- [ ] VS-02 marketing lists tour
- [ ] VS-03 portal register
- [ ] VS-04 `/me` row
- [ ] VS-05 member receipt
- [ ] VS-06 operator approve booking
- [ ] VS-07 operator approve receipt
- [ ] VS-08 `p7:gate` + `p6:gate`

---

## EPIC exit

مشتری اول بدون dev یک register + approve اپراتور انجام می‌دهد.

## References

- [platform-denali-vertical-slice.mdoc](../../phase-19/platform-denali-vertical-slice.mdoc)
- [IMPLEMENTATION-TRUTH-P7.md](appendices/IMPLEMENTATION-TRUTH-P7.md)
