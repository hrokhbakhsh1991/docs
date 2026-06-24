# P7 — Agent turn schema (mandatory report)

```yaml
schema_id: P7-AGENT-TURN-SCHEMA
pack_version: "1.6"
fail_token: P7_FAIL
authority: P7-BOOT-MANIFEST.yaml · P7-ANTI-HOLLOW-CONTRACT.md
```

> Every agent turn on P7 work **must** end with a `turn_report` block. Missing report → turn invalid.

---

## Required fields

```yaml
turn_report:
  current_nano: P7-0-N-002          # from detect_current_nano
  proof_tier_attempted: STAGING       # DOC | DEV | STAGING | STAGING_E2E | MANUAL
  commands_run:
    - cmd: "bash scripts/vps-deploy/verify-env-coherence.sh"
      exit_code: 0
      expect_token_matched: "verify-env-coherence: OK"
  files_changed: []                 # paths touched this turn
  staging_column_updated: false     # true ONLY if STAGING+ command PASS
  hollow_risk: none                 # none | flagged — explain if flagged
  next_nano: P7-0-N-003
  fail_token_seen: false            # true if any P7_FAIL condition hit
```

---

## Validation rules

| Rule | On violation |
| ---- | -------------- |
| `proof_tier_attempted: STAGING` and `commands_run: []` | `P7_FAIL` — invalid turn |
| `staging_column_updated: true` without STAGING command PASS | `P7_FAIL` |
| `proof_tier_attempted: DEV` used to tick staging checklist | `P7_FAIL` |
| Code touch without `pnpm run p7:gate` in commands_run | `hollow_risk: flagged` |
| `current_nano` ≠ BOOT-MANIFEST detect result without reason | `hollow_risk: flagged` |

---

## Example — valid staging turn

```yaml
turn_report:
  current_nano: P7-0-N-004
  proof_tier_attempted: STAGING
  commands_run:
    - cmd: "TOUR_OPS_API_URL=http://127.0.0.1:3001 pnpm run p7:staging-verify"
      exit_code: 0
      expect_token_matched: P7_STAGING_VERIFY_OK
    - cmd: "TOUR_OPS_API_URL=http://127.0.0.1:3001 node scripts/smoke-p6-host-bind.mjs"
      exit_code: 0
      expect_token_matched: P6_HOST_BIND_SMOKE_OK
  files_changed: []
  staging_column_updated: true
  hollow_risk: none
  next_nano: P7-0-N-005
  fail_token_seen: false
```

---

## Example — valid doc-only turn

```yaml
turn_report:
  current_nano: P7-0-N-001
  proof_tier_attempted: DOC
  commands_run:
    - cmd: "pnpm run p7:gate"
      exit_code: 0
      expect_token_matched: P7_DENALI_DELIVERY_GATE_OK
  files_changed: ["docs/phase-20/p7/runbooks/p7-0-staging-walkthrough.md"]
  staging_column_updated: false
  hollow_risk: none
  next_nano: P7-0-N-002
  fail_token_seen: false
```

---

## References

- [P7-VERIFICATION-COMMANDS.yaml](P7-VERIFICATION-COMMANDS.yaml)
- [P7-EVIDENCE-PACK.md](P7-EVIDENCE-PACK.md)
