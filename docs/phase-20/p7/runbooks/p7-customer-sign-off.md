# P7-3 — Customer sign-off (T4 manual)

```yaml
nano: P7-3-N-004
epic: P7-3
tier: T4
authority: ../p7-3-delivery-exit.md
prerequisite: [P7-0, P7-1, P7-2, P7-3-N-001, P7-3-N-002]
smoke_club: operator
```

## Goal

First Denali club customer completes the full vertical slice **without developer assistance** on staging (or agreed production URL).

**Session guide:** [p7-t4-sign-off-session.md](p7-t4-sign-off-session.md) (30 min · copy-paste URLs + OTP)

---

## Sign-off participants

| Role | Responsibility |
| ---- | -------------- |
| Customer operator | Executes daily ops steps |
| Platform architect | Witnesses T4 · records exceptions |
| Support (optional) | SMS/OTP on staging profile C |

---

## Checklist (VS-01..08 live)

| VS | Step | Pass | Notes |
| -- | ---- | ---- | ----- |
| VS-01 | Publish customer tour `active` on admin | ☐ | Tour title: __________ |
| VS-02 | Marketing lists tour | ☐ | URL: __________ |
| VS-03 | Guest portal register (OTP) | ☐ | Phone: __________ |
| VS-04 | `/me/registrations` shows row | ☐ | |
| VS-05 | Member uploads receipt | ☐ | |
| VS-06 | Operator approves booking | ☐ | |
| VS-07 | Operator approves receipt | ☐ | Finance summary updated |
| VS-08 | `pnpm run p7:gate` green in CI | ☐ | Commit: __________ |

---

## Regression (developer — before sign-off meeting)

```bash
pnpm run p7:gate
pnpm run p7:staging-verify
# T2: docs/phase-20/p7/runbooks/p7-staging-e2e.md
# T3 when Postgres available:
# DATABASE_URL=... pnpm --filter @apps/api exec node --import tsx --test test/finance-ops.spec.ts
```

---

## Known exceptions

Document any waived items here (must be Z4 — not P0):

| Item | Reason | Follow-up EPIC |
| ---- | ------ | -------------- |
| | | |

---

## Evidence pack (required for 98+ exit)

Create folder per [P7-EVIDENCE-PACK.md](../appendices/P7-EVIDENCE-PACK.md):

```text
docs/phase-20/p7/evidence/<YYYY-MM-DD>-<club-id>/manifest.yaml
```

Run `pnpm run p7:evidence-pack-verify`. Profile C SMS waiver: `waiver.profile_c_sms` in manifest (DEC-P7-013).

---

## Sign-off

| Field | Value |
| ----- | ----- |
| Date | |
| Staging profile | A / B / C |
| Customer club id | |
| Architect | |
| Evidence manifest path | |

**Exit:** P7-3-N-005 · IMPLEMENTATION-TRUTH-P7 → `BEHAVIORAL_COMPLETE`

## References

- [first-customer-operator.md](../../phase-19/p6/runbooks/first-customer-operator.md)
- [p6-e2e-smoke.md](../../phase-19/p6/runbooks/p6-e2e-smoke.md)
