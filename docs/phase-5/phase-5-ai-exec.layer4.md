# Phase 5 — Layer 4 ARCHIVE (redirect)

```yaml
status: ARCHIVE
load_tier: T2_lookup_only
forbidden_T0: true
fail_if_used_as_sole_entry: FAIL
sole_execution_entry: phase-5-agent-router.md
boot_manifest: appendices/BOOT-MANIFEST.yaml
historical_note: "Full monolith removed 2026-06-04-v2 — content lives in modular pack + git history"
```

> **NOT canonical SoT.** Do not boot from this file.  
> **Execute from:** [`phase-5-agent-router.md`](phase-5-agent-router.md) + [`appendices/BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml).

## T2 bulk lookup index (use instead of monolith)

| Need                         | Module                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| Boot / subphase pick         | [`phase-5-agent-router.md`](phase-5-agent-router.md)                                                |
| REQ-P5-001..040              | [`audits/verification-matrix.md`](audits/verification-matrix.md)                                    |
| RULE / FORBIDDEN             | [`phase-5-enforcement.md`](phase-5-enforcement.md)                                                  |
| Actions P5-_-A_              | [`subphases/`](subphases/) + [`audits/execution-action-index.md`](audits/execution-action-index.md) |
| Cross-cutting P5-X           | [`appendices/cross-cutting-actions.md`](appendices/cross-cutting-actions.md)                        |
| DAG                          | [`appendices/BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml) `parallel_groups`                  |
| Repo paths                   | [`appendices/IMPLEMENTATION-MAP.md`](appendices/IMPLEMENTATION-MAP.md)                              |
| Tests scaffold vs behavioral | [`appendices/test-inventory.md`](appendices/test-inventory.md)                                      |
| Forensic closure             | [`appendices/FORENSIC-RUBRIC.md`](appendices/FORENSIC-RUBRIC.md)                                    |
| Scores                       | [`audits/DOC-EXECUTION-SCORECARD.md`](audits/DOC-EXECUTION-SCORECARD.md)                            |

## Deprecated (FAIL at T0)

See [`appendices/DEPRECATED-ENTRYPOINTS.md`](appendices/DEPRECATED-ENTRYPOINTS.md).

## Research narrative (T3 only)

[`../research/phase-5-data-architecture-research.md`](../research/phase-5-data-architecture-research.md) — non-authoritative for execution.
