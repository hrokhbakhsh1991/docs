# P7 — Exit criteria (score 98+)

```yaml
criteria_id: P7-EXIT-CRITERIA-98
pack_version: "1.6"
authority: platform-denali-customer-delivery.mdoc · IMPLEMENTATION-TRUTH-P7.md
```

> **98+ definition:** Doc pack v1.5 complete **and** behavioral proof logged **and** evidence pack ready for T4.

---

## Score rubric (strict)

| Score | Requires |
| ---: | -------- |
| 90 | v1.4 runbooks + `p7:staging-gate` script |
| 93 | P7-0 staging gate PASS on VPS |
| 96 | T2 E2E Profile B PASS + walkthrough §Results filled |
| **98** | VS-01..08 staging ✅ + T3 PASS + evidence manifest + zero open P0 blockers |
| 99+ | T4 signed + `IMPLEMENTATION-TRUTH` → `BEHAVIORAL_COMPLETE` |

---

## Gate chain (normative)

```text
T1  pnpm run p7:gate                    — every PR
T1+ pnpm run p7:staging-gate           — after deploy
T2  p7-staging-e2e.md                  — pre sign-off
T3  finance-ops + DATABASE_URL          — VS-07 depth
T4  p7-customer-sign-off + evidence    — exit
```

---

## Checklist (all required for 98)

### Doc (v1.5)

- [x] Operational runbooks complete
- [x] TRACEABILITY verify commands
- [x] P7-EVIDENCE-PACK template
- [x] p7-staging-e2e-ci.md
- [x] p7-incident-staging.md
- [x] DEC-P7-013 Profile C SMS policy

### Staging proof (execute on VPS)

- [ ] `P7_STAGING_GATE_OK` captured in evidence
- [ ] `p7-staging-e2e` Profile B green (log in evidence)
- [ ] Walkthrough §Results — no open P0
- [ ] `finance-ops.spec.ts` PASS on staging Postgres
- [ ] `p7-exit-checklist` VS staging column all ✅
- [ ] `manifest.yaml` in `evidence/<date>-<club>/`

### Regression

- [ ] `pnpm run p7:gate` green on exit commit SHA

---

## Exit nano (P7-3-N-005)

When all above ✅:

1. `IMPLEMENTATION-TRUTH-P7` → `status: BEHAVIORAL_COMPLETE`
2. `AGENT-CURRENT-PHASE.yaml` → update `nano_staging_done: 27`
3. `p7-exit-checklist` → all staging + manual where applicable

---

## References

- [P7-EVIDENCE-PACK.md](P7-EVIDENCE-PACK.md)
- [p7-exit-checklist.md](../p7-exit-checklist.md)
