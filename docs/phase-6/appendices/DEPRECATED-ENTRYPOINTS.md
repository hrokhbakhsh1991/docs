# Phase 6 — Deprecated entrypoints

| Path                                             | Use instead                            |
| ------------------------------------------------ | -------------------------------------- |
| `legacy/` runtime imports in trunk apps          | Port into `packages/workspaces/denali` |
| Monolithic `phase-6-ai-exec.md` (if created)     | `phase-6-agent-router.md`              |
| `subphases/*.skeleton.md`                        | Non-skeleton subphase                  |
| Reading only `phase-6-denali-workspace.md` at T0 | Router + BOOT-MANIFEST                 |

**FAIL** if FORBIDDEN path loaded before BOOT-MANIFEST boot_sequence_T0.
