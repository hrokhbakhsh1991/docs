# Phase 6 — AI execution hub

```yaml
sole_execution_entry: phase-6-agent-router.md
implementation_decisions: appendices/IMPLEMENTATION-DECISIONS.md
implementation_truth: audits/IMPLEMENTATION-TRUTH.md
boot_manifest: appendices/BOOT-MANIFEST.yaml
doc_execution_system: 96
composite_doc: 96
fail_token: FAIL
```

| Score                     | Value  | Meaning                                                                                        |
| ------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| **Doc execution system**  | **96** | PEK + critical spec — [`audits/DOC-EXECUTION-SCORECARD.md`](audits/DOC-EXECUTION-SCORECARD.md) |
| **Critical spec quality** | **96** | completion_proof · RULE-P6 · port/smoke maps                                                   |
| **Repo behavioral**       | **~0** | `denali` package is probe-only on trunk                                                        |

**Prerequisite:** `pnpm run phase-5:gate` exit 0.

```bash
pnpm run phase-6:guard
node scripts/guards/lib/anti-hollow-phase6.mjs
```

## Agent load

| Tier   | Files                                                                                                                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T0** | BOOT-MANIFEST → router → TRUTH → DECISIONS → verification-matrix → subphases/{id}.md                                                                                       |
| **T1** | `ci.md`, `phase-6-guards.md`, `req-p6-command-atlas.md`                                                                                                                    |
| **T2** | `phase-6-overview.md`, `phase-6-state-machine.md`                                                                                                                          |
| **T3** | [`../phase-6-denali-workspace.md`](../phase-6-denali-workspace.md), [`../research/phase-6-denali-workspace-research.md`](../research/phase-6-denali-workspace-research.md) |

## Cross-phase

| Doc                                                                                            | Role                                                                                 |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`../appendices/PLATFORM-CONTINUITY-0-6.md`](../appendices/PLATFORM-CONTINUITY-0-6.md)         | 0→6 ownership                                                                        |
| [`appendices/phase-5-bridge.md`](appendices/phase-5-bridge.md)                                 | Phase 5 → 6 entry                                                                    |
| [`../phase-5/audits/ENTERPRISE-GAP-REGISTER.md`](../phase-5/audits/ENTERPRISE-GAP-REGISTER.md) | Enterprise sprint closed — **deferred** P1-14 / P1-19 / P2-5 code (not Phase 6 main) |
| [`audits/CONSISTENCY-REPORT.md`](audits/CONSISTENCY-REPORT.md)                                 | Doc graph PASS                                                                       |

## Purpose

Ship **Denali** as `packages/workspaces/denali` — plugin, theme, bootstrap, finance hooks, MinIO photos, canonical migration — without polluting `platform-core`.

**Doc PASS ≠ phase closed** — see [`audits/CLOSURE-CHECKLIST.md`](audits/CLOSURE-CHECKLIST.md).
