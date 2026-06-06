# Subphase ↔ enforcement cross-reference (Phase 7)

> **SOURCE OF TRUTH:** deterministic map for agents — one row per subphase

| Subphase | DAG  | Parallel | Prerequisites | REQ IDs     | RULE / FORBIDDEN | CI (primary)                     | Exit criteria   | Module                                                          |
| -------- | ---- | -------- | ------------- | ----------- | ---------------- | -------------------------------- | --------------- | --------------------------------------------------------------- |
| 7.0      | P7-0 | no       | phase-6:gate  | 001–003     | P7-F-002         | `phase-6:gate`                   | entry yaml PASS | [7.0-entry-gate.md](../subphases/7.0-entry-gate.md)             |
| 7.1      | P7-1 | no       | 7.0           | 004–005,031 | P7-F-001         | urban package build              | plugin shell    | [7.1-urban-package.md](../subphases/7.1-urban-package.md)       |
| 7.2      | P7-2 | no       | 7.1           | 006–008     | P7-F-002         | phase-7.contract.spec.ts         | zero core diff  | [7.2-genericity-proof.md](../subphases/7.2-genericity-proof.md) |
| 7.3      | P7-3 | no       | 7.2           | 009–011     | P7-F-003         | urban-workspace-plugin.spec.ts   | bootstrap       | [7.3-bootstrap.md](../subphases/7.3-bootstrap.md)               |
| 7.4      | P7-4 | no       | 7.3           | 012–014     | P7-F-001         | urban-create-publish.integration | E2E             | [7.4-urban-e2e.md](../subphases/7.4-urban-e2e.md)               |
| 7.5      | P7-5 | yes†     | 7.4           | 015–017,033 | P7-F-005         | audit-log-fields.mjs             | runbook         | [7.5-observability.md](../subphases/7.5-observability.md)       |
| 7.6      | P7-6 | yes†     | 7.4           | 018–020,034 | —                | rate-limit-tenant.spec.ts        | Redis keys      | [7.6-rate-limits.md](../subphases/7.6-rate-limits.md)           |
| 7.7      | P7-7 | no       | 7.5‡,7.6‡     | 021–023,032 | P7-F-004         | tenant-connection-router.spec.ts | silo router     | [7.7-tenant-router.md](../subphases/7.7-tenant-router.md)       |
| 7.8      | P7-8 | no       | 7.7           | 024–026     | P7-F-005         | `ci:integrity`                   | adversarial     | [7.8-adversarial.md](../subphases/7.8-adversarial.md)           |
| 7.9      | P7-9 | no       | 7.1–7.8       | 027–030,035 | P7-F-005         | `phase-7:gate`                   | Platform DoD    | [7.9-platform-gate.md](../subphases/7.9-platform-gate.md)       |

† Parallel after 7.4 VERIFIED_BEHAVIORAL  
‡ 7.7 requires **both** 7.5 and 7.6 per TG-P7-005

## Forbidden transitions (global)

| Transition                    | Enforcement          |
| ----------------------------- | -------------------- |
| 7.1 before 7.0 PASS           | TG-P7-001            |
| 7.3 before 7.2 genericity     | TG-P7-003            |
| 7.7 before 7.5 or 7.6         | TG-P7-005            |
| 7.9 before merge_7_9_requires | BOOT-MANIFEST        |
| Closure doc-only              | P7-F-005, REQ-P7-027 |

**See:** [`../phase-7-state-machine.md`](../phase-7-state-machine.md) · [`../phase-7-enforcement.md`](../phase-7-enforcement.md)
