# Phase 7 → Phase 8 bridge

```yaml
bridge_version: "2026-06-08-v1"
authority: phase-8-agent-router.md
phase_7_truth: ../../phase-7/audits/IMPLEMENTATION-TRUTH.md
phase_8_entry: ../subphases/8.0-entry.md
```

> **Agents:** Phase 8 **Product Parity** builds on Phase 7 **Platform DoD**. Do not re-implement closed 7.x behavior unless 8.x subphase explicitly extends it.

---

## Closure handed to 8.0

| Phase 7 subphase           | Status at bridge    | Phase 8 use                                                     |
| -------------------------- | ------------------- | --------------------------------------------------------------- |
| 7.0 Entry                  | VERIFIED_ENTRY      | 8.0 prerequisite attestation                                    |
| 7.1 Urban package shell    | VERIFIED_BEHAVIORAL | Extended in **8.2** only                                        |
| 7.2 Genericity baseline    | VERIFIED_BEHAVIORAL | `reports/phase-7-genericity-baseline.yaml` → 8.2 zero-diff      |
| 7.3 Urban plugin resolve   | VERIFIED_BEHAVIORAL | `resolveWorkspacePluginForType("urban")` — do not rebind denali |
| 7.4 Create → publish E2E   | VERIFIED_BEHAVIORAL | Baseline for 8.1 auth rail                                      |
| 7.5 Observability §10      | VERIFIED_BEHAVIORAL | SMK-P8 observability tokens                                     |
| 7.6 Redis rate limits      | VERIFIED_BEHAVIORAL | `urban-redis-fallback.spec.ts` in 8.1                           |
| 7.7 TenantConnectionRouter | VERIFIED_BEHAVIORAL | Tier resolution — silo URL in **8.3**                           |
| 7.8 Adversarial P0         | VERIFIED_BEHAVIORAL | RLS matrix — no regression in 8.x                               |
| 7.9 Platform gate          | VERIFIED_BEHAVIORAL | `reports/phase-7-platform-gate-*.json`                          |

---

## Explicit deferrals (still honest at 8.0)

| Item                                 | Phase 7 truth | Phase 8 owner       |
| ------------------------------------ | ------------- | ------------------- |
| Silo dedicated DB in `withTenantRls` | ABSENT        | 8.3                 |
| `SET LOCAL search_path`              | ABSENT        | post-8.3            |
| Phase 7 forensic PASS                | SPEC_ONLY     | optional before 8.5 |

---

## Verification

```bash
rg 'phase_7_gate:[\s\S]*status:\s*PASS' reports/phase-8-entry-verified.yaml
test -f reports/phase-7-platform-gate-2026-06-07.json
pnpm run phase-7:guard
```
