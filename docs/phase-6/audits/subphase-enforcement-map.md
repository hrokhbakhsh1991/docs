# Subphase ↔ enforcement cross-reference (Phase 6)

> **SOURCE OF TRUTH:** deterministic map for agents — one row per subphase

| Subphase | DAG  | Parallel | Prerequisites | REQ IDs         | RULE / FORBIDDEN     | CI (primary)          | Exit criteria              | Module                                                            |
| -------- | ---- | -------- | ------------- | --------------- | -------------------- | --------------------- | -------------------------- | ----------------------------------------------------------------- |
| 6.0      | P6-0 | no       | phase-5:gate  | 001–003,020,025 | P6-F-002             | `phase-5:gate`        | entry yaml PASS            | [6.0-entry-gate.md](../subphases/6.0-entry-gate.md)               |
| 6.1      | P6-1 | no       | 6.0           | 004–005,027     | P6-F-003             | denali package build  | plugin shell               | [6.1-denali-package.md](../subphases/6.1-denali-package.md)       |
| 6.2      | P6-2 | no       | 6.1           | 006–009,008,021 | P6-F-002             | registry-parity tests | validateCanonical fixtures | [6.2-registry-rules.md](../subphases/6.2-registry-rules.md)       |
| 6.3      | P6-3 | yes†     | 6.2           | 010             | P6-F-003             | component + theme     | widgets/theme              | [6.3-widgets-theme.md](../subphases/6.3-widgets-theme.md)         |
| 6.4      | P6-4 | yes†     | 6.2           | 011–012,028     | P6-F-001             | finance consumer spec | plugin finance hooks       | [6.4-finance-slice.md](../subphases/6.4-finance-slice.md)         |
| 6.5      | P6-5 | no       | 6.2,6.3‡,6.4‡ | 013–014,024,026 | P6-F-004             | api + web integration | bootstrap                  | [6.5-bootstrap.md](../subphases/6.5-bootstrap.md)                 |
| 6.6      | P6-6 | yes§     | 6.5           | 015,023,029     | P6-F-004             | smoke / Playwright    | parity                     | [6.6-smoke-parity.md](../subphases/6.6-smoke-parity.md)           |
| 6.7      | P6-7 | yes§     | 6.5           | 016             | —                    | minio e2e             | photos                     | [6.7-minio-photos.md](../subphases/6.7-minio-photos.md)           |
| 6.8      | P6-8 | no       | 6.5,6.6§      | 017             | dual-write forbidden | migration test        | migrateCanonical           | [6.8-migrate-canonical.md](../subphases/6.8-migrate-canonical.md) |
| 6.9      | P6-9 | no       | 6.2–6.8       | 018–019,022,030 | P6-F-004             | `phase-6:gate`        | forensic + gate            | [6.9-phase-gate.md](../subphases/6.9-phase-gate.md)               |

† Parallel after 6.2 VERIFIED_BEHAVIORAL  
‡ 6.5 requires **both** 6.3 and 6.4 complete per BOOT-MANIFEST `merge_6_9_requires` (bootstrap needs full plugin surface)  
§ 6.6 ∥ 6.7 after 6.5; 6.8 recommends 6.6 smoke green first

## Forbidden transitions (global)

| Transition                    | Enforcement             |
| ----------------------------- | ----------------------- |
| 6.1 before 6.0 PASS           | TG-P6-001               |
| 6.2 before 6.1                | DAG                     |
| 6.5 before 6.2                | DEC-P6-010              |
| 6.5 before 6.3 or 6.4         | TG-P6-005, P6-F-005     |
| 6.8 before 6.5                | migrate needs bootstrap |
| 6.9 before merge_6_9_requires | BOOT-MANIFEST           |
| Closure compile-only          | P6-F-004, REQ-P6-018    |

**See:** [`../phase-6-state-machine.md`](../phase-6-state-machine.md) · [`../phase-6-enforcement.md`](../phase-6-enforcement.md)
