# P9 — Agent turn schema (mandatory report)

```yaml
schema_id: P9-AGENT-TURN-SCHEMA
pack_version: "1.0"
fail_token: P9_FAIL
```

> Every P9 turn **must** end with `turn_report`.

---

## Required fields

```yaml
turn_report:
  current_nano: P9-0-N-001
  proof_tier_attempted: PACKAGE
  gap_ids: [G-PKG-01, G-BOOT-01]
  commands_run:
    - cmd: "pnpm run p9:gate"
      exit_code: 0
      expect_token_matched: P9_CODE_CONSOLIDATION_GATE_OK
  files_changed: []
  docs_updated: true
  packages_touched: []              # guest-surface-host | session-client
  surface_column_updated: false     # true when SURFACE+ PASS
  scope_violation: none             # P8_leak | P10_leak | web_guest_leak
  hollow_risk: none
  next_nano: P9-0-N-002
  fail_token_seen: false
```

---

## Validation rules

| Rule | On violation |
| ---- | -------------- |
| P9-1-N-001 with any `apps/web/app/api/public-auth/**/route.ts` remaining | `P9_FAIL` |
| `guest-surface-host` added to web imports | `P9_FAIL` |
| Deleted `apps/web/app/catalog/**/page.tsx` redirect shims | `P9_FAIL` |
| Code touch without `p9:gate` in commands_run | `hollow_risk: flagged` |
| Started before `p8:gate` green | `P9_FAIL` |

---

## Example — valid package turn

```yaml
turn_report:
  current_nano: P9-0-N-001
  proof_tier_attempted: PACKAGE
  gap_ids: [G-PKG-01, G-BOOT-01]
  commands_run:
    - cmd: 'rg "resolve-host-tenant" apps/marketing apps/portal --glob "*.ts"'
      exit_code: 1
      note: "expect no matches after PASS"
    - cmd: "pnpm run guard:import-boundary"
      exit_code: 0
    - cmd: "pnpm run p9:gate"
      exit_code: 0
      expect_token_matched: P9_CODE_CONSOLIDATION_GATE_OK
  files_changed:
    - packages/guest-surface-host/package.json
    - apps/marketing/src/tenant/resolve-marketing-bootstrap.ts
  docs_updated: true
  packages_touched: [guest-surface-host]
  surface_column_updated: false
  scope_violation: none
  hollow_risk: none
  next_nano: P9-0-N-002
  fail_token_seen: false
```
