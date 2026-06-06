# Phase 6 → Phase 7 bridge

```yaml
bridge_version: "2026-06-04-v1"
prerequisite_gate: pnpm run phase-6:gate
```

## Handoff table

| Phase 6 delivers                | Phase 7 consumes                        |
| ------------------------------- | --------------------------------------- |
| Denali plugin + bootstrap (6.5) | Template for urban second plugin (7.3)  |
| Generic resolver pattern        | urban registration without core diff    |
| Finance in plugin boundary      | Urban **excludes** finance (DEC-P7-002) |
| Phase 6 gate + forensic         | 7.0 entry prerequisite                  |

## What Phase 7 must NOT repeat

| Phase 6 lesson          | Phase 7 rule                     |
| ----------------------- | -------------------------------- |
| Denali in platform-core | DEC-P7-001 urban unchanged       |
| Probe as product        | Urban real minimal plugin at 7.1 |
| Large domain port       | Urban starter-plus only          |

## Entry checklist (7.0)

1. `pnpm run phase-6:gate` exit 0
2. Read [`phase-6/audits/IMPLEMENTATION-TRUTH.md`](../phase-6/audits/IMPLEMENTATION-TRUTH.md)
3. Confirm 6.5 bootstrap pattern documented
4. Update `reports/phase-7-entry-verified.yaml`

## Forward reference

Phase 8+ owns CDC/warehouse — see [`phase-7-platform-dod.md`](../phase-7-platform-dod.md) out-of-scope.
