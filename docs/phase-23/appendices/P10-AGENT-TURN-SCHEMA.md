# P10 — Agent turn schema (mandatory)

```yaml
schema_id: P10-AGENT-TURN-SCHEMA
pack_version: "1.0"
fail_token: P10_FAIL
```

```yaml
turn_report:
  current_nano: P10-1-N-001
  proof_tier_attempted: PROFILE_C
  gap_ids: [G-TLS-01, G-TLS-02]
  commands_run:
    - cmd: "pnpm run p10:gate"
      exit_code: 0
      expect_token_matched: P10_PRODUCTION_GRADE_GATE_OK
  files_changed: []
  docs_updated: true
  profile_c_column_updated: false
  profile_b_regression_checked: false
  scope_violation: none
  hollow_risk: none
  next_nano: P10-2-N-001
  fail_token_seen: false
```

| Rule | Violation |
| ---- | --------- |
| PROFILE_C without curl/smoke command | P10_FAIL |
| profile_c_column_updated without PROFILE_C PASS | P10_FAIL |
| Deprecated Profile B docs | P10_FAIL |
| admin custom apex work | scope_violation: trunk_v2_leak |
