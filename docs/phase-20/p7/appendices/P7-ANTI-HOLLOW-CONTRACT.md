# P7 — Anti-hollow contract (agents)

```yaml
contract_id: P7-ANTI-HOLLOW-CONTRACT
pack_version: "1.6"
fail_token: P7_FAIL
authority: P7-BOOT-MANIFEST.yaml · IMPLEMENTATION-TRUTH-P7.md
decision: DEC-P7-015
```

> **Rule:** A green dev gate is **not** staging proof. Agents must cite **proof tier** per nano.

---

## Proof tier enum

| Tier | Meaning | Counts toward P7 exit |
| ---- | ------- | --------------------- |
| **DOC** | Spec/runbook exists | No |
| **DEV_STATIC** | `p7:gate` / pack integrity / wiring | No (VS-08 dev only) |
| **DEV_API_MEMORY** | In-memory HTTP specs in `p6:gate` | No |
| **STAGING** | Command on VPS/staging URLs | Yes |
| **STAGING_E2E** | Playwright with `PW_EXTERNAL_SERVERS=1` | Yes |
| **STAGING_BEHAVIORAL** | Postgres specs (`finance-ops`) on staging | Yes |
| **MANUAL** | T4 sign-off + evidence manifest | Yes |

---

## Gate / spec — proves vs does_not_prove

| Gate / spec | proves | does_not_prove |
| ----------- | ------ | -------------- |
| `pnpm run p7:gate` | Doc pack v1.6 + `p6:gate` regression + `p7-pack-integrity` | Staging VS · walkthrough §Results · T4 |
| `p7-pack-integrity.spec.ts` | BOOT-MANIFEST · anti-hollow · 27 verification keys exist | Behavioral staging |
| `pnpm run p6:gate` | P6 product chain in dev/API memory | VPS deploy · customer seed on staging |
| `pnpm run p7:staging-verify` | Host smoke subset on staging API | Full T2 E2E · finance T3 |
| `pnpm run p7:staging-gate` | T1+infra+T3 bundle on staging | T2 Playwright · T4 sign-off |
| `PW_EXTERNAL_SERVERS=1` smoke | E2E against **configured base URLs** | localhost-only pass ≠ staging |
| `finance-ops.spec.ts` without `DATABASE_URL` | skip or in-memory path | VS-07 on staging Postgres |
| `denali-publish-readiness.spec.ts` | publish validation logic | VS-01 admin publish on staging |
| Reading IMPLEMENTATION-TRUTH | Honest ledger state | Execution of staging commands |

---

## Forbidden claims (`P7_FAIL`)

```yaml
forbidden_claims:
  - "P7 complete" when staging_proof: NOT_STARTED
  - "VS-0N staging green" from unit test only
  - exit checklist staging tick without command log in evidence pack
  - InMemoryFinanceRepository wired to staging to unblock T3
  - "Walkthrough done" without §Results filled in runbook
  - Mark P7-2-N-005/N-006 PASS without SKIP reason when conditional
  - Run p7:gate only and update nano_staging_done
```

---

## Hollow test patterns

| Pattern | Why hollow | Valid instead |
| ------- | ---------- | ------------- |
| Empty spec asserting file exists | STATIC only | Behavioral test or staging command |
| Mock staging URL in unit test | DEV only | `PW_EXTERNAL_SERVERS=1` on real staging |
| Skip finance-ops when DATABASE_URL set on VPS | Avoidance | Run T3 on staging Postgres |
| Bulk-read all 27 nanos before one fix | Scope creep | BOOT-MANIFEST T1 load current nano only |

See [P7-TEST-INVENTORY.md](P7-TEST-INVENTORY.md) per spec.

---

## Agent workflow (linear)

```yaml
AGENT_WORKFLOW_LINEAR:
  1: READ P7-BOOT-MANIFEST.yaml boot_sequence_T0
  2: DETECT current_nano (first staging-not-PASS)
  3: LOAD P7-VERIFICATION-COMMANDS.yaml#nano only
  4: RUN commands — capture exit_code + expect_token
  5: EMIT turn_report per P7-AGENT-TURN-SCHEMA.md
  6: UPDATE IMPLEMENTATION-TRUTH staging log + exit checklist IF proof_tier >= STAGING
  7: pnpm run p7:gate after any code touch

forbidden:
  - "Implement P7-1 before P7-0-N-005 STAGING_PASS"
  - "Claim behavioral from p7-pack-integrity alone"
  - "Load deprecated entrypoints as sole boot"
```

---

## References

- [P7-AGENT-TURN-SCHEMA.md](P7-AGENT-TURN-SCHEMA.md)
- [P7-VERIFICATION-COMMANDS.yaml](P7-VERIFICATION-COMMANDS.yaml)
- [IMPLEMENTATION-TRUTH-P6.md](../../phase-19/p6/appendices/IMPLEMENTATION-TRUTH-P6.md) — proof tiers carryover
