# Phase 5 — AI execution hub

```yaml
sole_execution_entry: phase-5-agent-router.md
implementation_map: appendices/IMPLEMENTATION-MAP.md
readability_report: AI-READABILITY-REPORT.md
implementation_truth: audits/IMPLEMENTATION-TRUTH.md
gap_register: audits/PHASE-5-GAP-REGISTER.md
precision_pack: appendices/PRECISION-DOC-INDEX.md
fail_token: FAIL
```

**Hardening (2026-06-04):** [`appendices/BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml) · [`appendices/DEPRECATED-ENTRYPOINTS.md`](appendices/DEPRECATED-ENTRYPOINTS.md) · deterministic parallel subphase pick

| Score                    | Value        | Meaning                                                 |
| ------------------------ | ------------ | ------------------------------------------------------- |
| **Doc execution system** | **96**       | BOOT-MANIFEST + guard `p5_doc_hardening` (target >= 95) |
| **Doc navigation**       | 100          | Precision pack complete                                 |
| **Repo scaffold**        | ~43          | 5.1 + guard                                             |
| **Repo behavioral**      | ~29          | 5.2 VERIFIED; 5.3–5.5 open                              |
| **Phase closed**         | ~37 weighted | Needs 5.3–5.5 behavioral + phase-4:gate                 |

`phase-5:guard` PASS ≠ Phase 5 closed. See [`AI-READABILITY-REPORT.md`](AI-READABILITY-REPORT.md).

## Agent load (deterministic)

| Tier   | When                          | Files                                                                                                                                                                     |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T0** | Implement / validate subphase | `BOOT-MANIFEST.yaml` → `phase-5-agent-router.md` + `IMPLEMENTATION-TRUTH` + `IMPLEMENTATION-MAP` + `PRECISION-DOC-INDEX` + `subphases/{id}.md` + `phase-5-enforcement.md` |
| **T1** | Gate / guard debug            | + `ci.md`, `phase-5-guards.md`, `appendices/req-p5-command-atlas.md`                                                                                                      |
| **T2** | Architecture dispute          | + `phase-5-overview.md`, `phase-5-state-machine.md`, `appendices/IMPLEMENTATION-MAP.md`                                                                                   |
| **T3** | Humans / research narrative   | `research/phase-5-data-architecture-research.md`, `phase-5-canonical-schema.md` full read                                                                                 |

**RULE:** T0 loads `phase-5-ai-exec.layer4.md` or research body → **FAIL**

## Canonical entrypoints

| Role                 | File                                                                           |
| -------------------- | ------------------------------------------------------------------------------ |
| **SOLE router (T0)** | [`phase-5-agent-router.md`](phase-5-agent-router.md)                           |
| Cold start stub      | [`../phase-5-canonical-data.ai-exec.md`](../phase-5-canonical-data.ai-exec.md) |
| Schema DDL SoT       | [`../phase-5-canonical-schema.md`](../phase-5-canonical-schema.md)             |
| Index + module map   | [`phase-5.ai-exec.index.md`](phase-5.ai-exec.index.md)                         |
| Repo paths           | [`appendices/IMPLEMENTATION-MAP.md`](appendices/IMPLEMENTATION-MAP.md)         |

## Knowledge ownership

[`appendices/knowledge-index.md`](appendices/knowledge-index.md) — no duplicate SoT; router owns execution boot.

## Implementation decisions (before code 5.3+)

**SOLE technical SoT for ambiguities:** [`appendices/IMPLEMENTATION-DECISIONS.md`](appendices/IMPLEMENTATION-DECISIONS.md) — write path, `withCanonicalTransaction`, outbox relay, env flags, audit scope.

## Cross-phase continuity (0→5)

| Doc                                                                                            | Role                                           |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [`../appendices/PLATFORM-CONTINUITY-0-5.md`](../appendices/PLATFORM-CONTINUITY-0-5.md)         | **Canonical** ownership + gate chain           |
| [`appendices/platform-continuity-0-5.md`](appendices/platform-continuity-0-5.md)               | Phase 5 extension + repo snapshot              |
| [`appendices/CROSS-PHASE-ENTRY-MAP.md`](appendices/CROSS-PHASE-ENTRY-MAP.md)                   | Phase 4 `phase_5_entry_requires_modular` ↔ 5.0 |
| [`appendices/phase-0-3-bridge.md`](appendices/phase-0-3-bridge.md)                             | Foundation chain (no scope reopen)             |
| [`../phase-4/appendices/phase-handoff-3-4-5.md`](../phase-4/appendices/phase-handoff-3-4-5.md) | 3→4→5 artifacts                                |

Guard: `p5_cross_phase_continuity` (with `phase-5:guard`).

## Next phase

**Phase 6** doc pack: [`../phase-6/README.md`](../phase-6/README.md) · router: [`../phase-6/phase-6-agent-router.md`](../phase-6/phase-6-agent-router.md)

## Out of scope (Phases 6–7)

Phase 5 docs and PRs **must not** implement Denali port, MinIO, finance hooks, or silo routing. Authoritative boundary table: [`appendices/phase-boundaries.md`](appendices/phase-boundaries.md) · deferral rationale: [`FUTURE-PROOFING-REPORT.md`](FUTURE-PROOFING-REPORT.md) · enforcement: [`phase-5-enforcement.md`](phase-5-enforcement.md) FORBIDDEN-008–014.

## Purpose

Implement the **data layer standard** (ADR-005): `canonical_data` JSONB SoT, sync projections, transactional outbox, minimal `audit_events`, idempotency — on pool Postgres + RLS. No platform-wide event sourcing; no Denali/MinIO/silo (Phases 6–7).

## Execution DAG

```text
5.0  Entry (phase-4:gate + entry yaml)
  ↓
5.1  Schema + migrations (scaffold VERIFIED)
  ↓
  ├── 5.2  Plugin validate-before-persist (VERIFIED)
  ├── 5.3  Sync projections (parallel)     ─┐
  └── 5.5  audit_events (parallel)         │
       5.4  Outbox + relay (needs 5.2)  ────┴→ 5.6  Gate + forensic
```

| Constraint         | Rule                                     |
| ------------------ | ---------------------------------------- |
| Parallel after 5.1 | 5.2, 5.3, 5.5                            |
| 5.4 start          | Requires 5.1 **and** 5.2                 |
| 5.6 start          | Requires 5.2–5.5 **behavioral** VERIFIED |
| PR label           | `Phase: 5.N` for active subphase only    |

[`audits/subphase-enforcement-map.md`](audits/subphase-enforcement-map.md) · [`audits/execution-action-index.md`](audits/execution-action-index.md)

## Precision & audit modules

| Module                                  | File                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| Precision pack index                    | [`appendices/PRECISION-DOC-INDEX.md`](appendices/PRECISION-DOC-INDEX.md)               |
| DoR / DoD per subphase                  | [`audits/SUBPHASE-READY-SPEC.md`](audits/SUBPHASE-READY-SPEC.md)                       |
| REQ commands                            | [`appendices/req-p5-command-atlas.md`](appendices/req-p5-command-atlas.md)             |
| Test inventory (scaffold vs behavioral) | [`appendices/test-inventory.md`](appendices/test-inventory.md)                         |
| Gap register (7)                        | [`audits/PHASE-5-GAP-REGISTER.md`](audits/PHASE-5-GAP-REGISTER.md)                     |
| Consistency (doc graph)                 | [`audits/CONSISTENCY-REPORT.md`](audits/CONSISTENCY-REPORT.md)                         |
| Closure checklist                       | [`audits/CLOSURE-CHECKLIST.md`](audits/CLOSURE-CHECKLIST.md)                           |
| Implementation truth                    | [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md)                     |
| Industry 2026                           | [`appendices/industry-alignment-2026.md`](appendices/industry-alignment-2026.md)       |
| Continuity 0–5                          | [`appendices/platform-continuity-0-5.md`](appendices/platform-continuity-0-5.md)       |
| Workspace data layer                    | [`appendices/workspace-data-layer-model.md`](appendices/workspace-data-layer-model.md) |
| **Repo ↔ project alignment**            | [`appendices/REPO-PROJECT-ALIGNMENT.md`](appendices/REPO-PROJECT-ALIGNMENT.md)         |
| Phase 4 bridge                          | [`appendices/phase-4-bridge.md`](appendices/phase-4-bridge.md)                         |

## Enforcement & CI

| Module                     | File                                                                       |
| -------------------------- | -------------------------------------------------------------------------- |
| RULE-_ · FORBIDDEN-_ · DoD | [`phase-5-enforcement.md`](phase-5-enforcement.md)                         |
| p5\_\* guards              | [`phase-5-guards.md`](phase-5-guards.md)                                   |
| CI / gates                 | [`ci.md`](ci.md)                                                           |
| Verification matrix        | [`audits/verification-matrix.md`](audits/verification-matrix.md)           |
| Anti-hollow                | [`appendices/anti-hollow-contract.md`](appendices/anti-hollow-contract.md) |
| Agent FAQ                  | [`appendices/agent-faq.md`](appendices/agent-faq.md)                       |

## Subphases

| ID  | Module                                                                           | Status                          |
| --- | -------------------------------------------------------------------------------- | ------------------------------- |
| 5.0 | [`subphases/5.0-entry-gate.md`](subphases/5.0-entry-gate.md)                     | PARTIAL                         |
| 5.1 | [`subphases/5.1-canonical-schema.md`](subphases/5.1-canonical-schema.md)         | VERIFIED (scaffold)             |
| 5.2 | [`subphases/5.2-plugin-validation.md`](subphases/5.2-plugin-validation.md)       | **VERIFIED**                    |
| 5.3 | [`subphases/5.3-projections.md`](subphases/5.3-projections.md)                   | VERIFIED (unified in 5.4-S1 TX) |
| 5.4 | [`subphases/5.4-transactional-outbox.md`](subphases/5.4-transactional-outbox.md) | SPEC_ONLY                       |
| 5.5 | [`subphases/5.5-audit-events.md`](subphases/5.5-audit-events.md)                 | SPEC_ONLY                       |
| 5.6 | [`subphases/5.6-phase-gate.md`](subphases/5.6-phase-gate.md)                     | PARTIAL                         |

## FAIL conditions

| Condition                                       | Token    |
| ----------------------------------------------- | -------- |
| `phase_id` ≠ 5 or `phase_detection_blocker` set | **FAIL** |
| `pnpm run phase-4:gate` ≠ 0 at 5.0              | **FAIL** |
| Forbidden transition (5.4 before 5.2, etc.)     | **FAIL** |
| Claim 5.6 VERIFIED from `phase-5:guard` alone   | **FAIL** |
| `p5_contract_spec` cited as outbox proof        | **FAIL** |
| T0 loads layer4 monolith                        | **FAIL** |

## Related

- Research (T3): [`../research/phase-5-data-architecture-research.md`](../research/phase-5-data-architecture-research.md)
- Phase 4: [`../phase-4/README.md`](../phase-4/README.md)
- MAP: [`../MIGRATION-MAP.md`](../MIGRATION-MAP.md) Phase 5
- Quality: [`PHASE-5-QUALITY-STANDARD.md`](PHASE-5-QUALITY-STANDARD.md) (binding manifesto) · [`QUALITY-VALIDATION.md`](QUALITY-VALIDATION.md)

## Folder layout

```text
docs/phase-5/
├── README.md                    ← this hub
├── phase-5-agent-router.md      ← SOLE T0 entry
├── phase-5-ai-exec.layer4.md    ← T2 bulk only
├── audits/                      ← truth, gaps, closure, matrix
├── subphases/5.0–5.6.md
└── appendices/                  ← precision pack, IMPLEMENTATION-MAP, …
```
