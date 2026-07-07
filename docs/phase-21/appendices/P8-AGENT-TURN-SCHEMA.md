# P8 — Agent turn schema (mandatory report)

```yaml
schema_id: P8-AGENT-TURN-SCHEMA
pack_version: "1.0"
fail_token: P8_FAIL
authority: P8-BOOT-MANIFEST.yaml · P8-ANTI-HOLLOW-CONTRACT.md
```

> Every agent turn on P8 work **must** end with a `turn_report` block. Missing report → turn invalid.

---

## Required fields

```yaml
turn_report:
  current_nano: P8-0-N-001
  proof_tier_attempted: DEV_STATIC    # DOC | DEV_STATIC | PROFILE_A | PROFILE_B | REGRESSION
  gap_ids: [G-ING-01]                 # from p8-gap-registry.md
  commands_run:
    - cmd: "pnpm run p8:gate"
      exit_code: 0
      expect_token_matched: P8_PLATFORM_SURFACE_GATE_OK
  files_changed: []
  docs_updated: true                  # required if apps/api or protected packages touched
  profile_column_updated: false       # true ONLY if PROFILE_A+ command PASS for that nano
  scope_violation: none               # none | P9_leak | P10_leak — explain if not none
  hollow_risk: none
  next_nano: P8-0-N-002
  fail_token_seen: false
```

---

## Validation rules

| Rule | On violation |
| ---- | -------------- |
| `proof_tier_attempted: PROFILE_B` and `commands_run: []` | `P8_FAIL` |
| `profile_column_updated: true` without PROFILE_A/B PASS | `P8_FAIL` |
| Code touch without `pnpm run p8:gate` in commands_run | `hollow_risk: flagged` |
| Touched `apps/api` without `docs/` change | `P8_FAIL` doc-first covenant |
| `scope_violation: P9_leak` | `P8_FAIL` — revert out-of-scope |
| `current_nano` skips execution_order without SKIP doc | `hollow_risk: flagged` |

---

## Example — valid Profile A turn

```yaml
turn_report:
  current_nano: P8-0-N-001
  proof_tier_attempted: PROFILE_A
  gap_ids: [G-ING-01]
  commands_run:
    - cmd: "TOUR_OPS_API_URL=http://127.0.0.1:3001 node scripts/smoke-p6-host-bind.mjs"
      exit_code: 0
      expect_token_matched: P6_HOST_BIND_SMOKE_OK
    - cmd: "pnpm run p8:gate"
      exit_code: 0
      expect_token_matched: P8_PLATFORM_SURFACE_GATE_OK
  files_changed: ["apps/api/src/tenant/tenant-branding.routes.ts", "docs/phase-21/..."]
  docs_updated: true
  profile_column_updated: true
  scope_violation: none
  hollow_risk: none
  next_nano: P8-0-N-002
  fail_token_seen: false
```

---

## Example — doc-only pack turn

```yaml
turn_report:
  current_nano: P8-0-N-004
  proof_tier_attempted: DOC
  gap_ids: [G-ING-05a]
  commands_run:
    - cmd: "pnpm run p8:gate"
      exit_code: 0
      expect_token_matched: P8_PLATFORM_SURFACE_GATE_OK
  files_changed: ["docs/phase-21/runbooks/p8-api-loopback-vps.md"]
  docs_updated: true
  profile_column_updated: false
  scope_violation: none
  hollow_risk: none
  next_nano: P8-0-N-005
  fail_token_seen: false
```
