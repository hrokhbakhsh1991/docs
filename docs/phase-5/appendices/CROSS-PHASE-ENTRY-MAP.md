# Cross-phase entry map — Phase 4 → 5.0

```yaml
map_version: "2026-06-04"
source_contract: docs/phase-4/phase-4-enforcement.md#phase_5_entry_requires_modular
target_subphase: docs/phase-5/subphases/5.0-entry-gate.md
yaml_ledger: reports/phase-5-entry-verified.yaml
```

> **Purpose:** 1:1 mapping so agents do not re-interpret Phase 4 exit at 5.0.

## Modular contract ↔ verification

| #   | `phase_5_entry_requires_modular` item | Phase 4 proof                           | 5.0 action / REQ                     | yaml field                |
| --- | ------------------------------------- | --------------------------------------- | ------------------------------------ | ------------------------- |
| 1   | Subphases 4.0–4.6 PASS                | `subphases/4.*.md` completion_proof     | P5-0-A01 (sections 8–16 T3 optional) | `human_doc_sections_8_16` |
| 2   | Workspace interoperability            | `workspace-interoperability-model.md`   | acknowledged in 5.0 boot             | —                         |
| 3   | `phase-4:gate` exit 0                 | `pnpm run phase-4:gate`                 | P5-0-A02                             | `phase_4_gate`            |
| 4   | Forensic Phase 4 archived             | `phase-4-zero-debt-forensic-audit.mdoc` | P5-0-A03                             | —                         |
| 5   | Postgres SoT tours                    | `create-tour-storage.ts` + env          | P5-0-A04                             | `postgres_sot`            |
| 6   | RLS on tours (+ new tables in P5)     | `001_tenant_rls.sql` + 5.1 DDL          | P5-0-A05                             | `rls_applied`             |
| 7   | Event hooks (no outbox at P4)         | `canonical-tour.service` publish        | P5-0-A06                             | `event_hooks_exist`       |

## Gate commands (ordered)

```bash
pnpm run phase-3:gate    # implied by phase-4:gate chain
pnpm run phase-4:gate    # required at 5.0
# Phase 5 work only after 5.0 yaml PASS:
pnpm run phase-5:guard   # scaffold — not phase closure
pnpm run phase-5:gate    # 5.6 only when 5.2–5.5 behavioral VERIFIED
```

## Standards preserved

| Standard       | Phase 4                   | Phase 5                                  |
| -------------- | ------------------------- | ---------------------------------------- |
| Sole router    | `phase-4-ai-exec.md`      | `phase-5-agent-router.md`                |
| Truth ledger   | `IMPLEMENTATION-TRUTH.md` | `IMPLEMENTATION-TRUTH.md`                |
| Repo alignment | storage-driver-truth      | `REPO-PROJECT-ALIGNMENT.md`              |
| Cross-phase    | `phase-handoff-3-4-5.md`  | this file + `PLATFORM-CONTINUITY-0-5.md` |

**Parent:** [`../../appendices/PLATFORM-CONTINUITY-0-5.md`](../../appendices/PLATFORM-CONTINUITY-0-5.md)
