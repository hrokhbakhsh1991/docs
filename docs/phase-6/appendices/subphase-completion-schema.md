# Phase 6 — Subphase completion schema

```yaml
schema_version: "2026-06-04"
status_enum: [SPEC_ONLY, PARTIAL, VERIFIED_SCAFFOLD, VERIFIED_BEHAVIORAL, BLOCKED]
```

## Required yaml header (every subphase)

```yaml
subphase: "6.x"
dag_node: P6-x
repo_status: <enum>
enforcement_req_ids: [...]
action_ids: [...]
completion_proof:
  prove_with: [...]
```

## Transition rules

| From              | To                  | Requires                                |
| ----------------- | ------------------- | --------------------------------------- |
| SPEC_ONLY         | VERIFIED_SCAFFOLD   | prove_with command exit 0 + file exists |
| VERIFIED_SCAFFOLD | VERIFIED_BEHAVIORAL | integration/e2e per test-inventory      |
| \*                | BLOCKED             | blockers.md id active                   |

## Ledger update

After each transition, edit [`../audits/IMPLEMENTATION-TRUTH.md`](../audits/IMPLEMENTATION-TRUTH.md) same day.
