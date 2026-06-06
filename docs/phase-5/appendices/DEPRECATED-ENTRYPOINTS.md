# Phase 5 — Deprecated entrypoints (do not boot)

> **Authoritative boot:** [`BOOT-MANIFEST.yaml`](BOOT-MANIFEST.yaml) · **Execution:** [`../phase-5-agent-router.md`](../phase-5-agent-router.md)

| Path                                                    | Tier             | Use instead                                             |
| ------------------------------------------------------- | ---------------- | ------------------------------------------------------- |
| `phase-5-ai-exec.layer4.md`                             | **FORBIDDEN T0** | Router + `verification-matrix.md` (T2 bulk lookup only) |
| `appendices/agent-contract.md`                          | **FORBIDDEN**    | Router `AGENT_START_SEQUENCE`                           |
| `research/phase-5-data-architecture-research.md` (body) | T3 narrative     | `phase-5-canonical-schema.md` + router                  |
| `subphases/*.skeleton.md`                               | **FORBIDDEN**    | `subphases/5.N-*.md` (non-skeleton)                     |
| `phase-5-ai-exec.md` (initiator boot)                   | Historical       | Router only                                             |
| `INITIATOR-REPORT.md` `canonical_initiator`             | Historical       | Router                                                  |

**FAIL** if an agent loads any FORBIDDEN path before completing `BOOT-MANIFEST.yaml` boot_sequence_T0.
