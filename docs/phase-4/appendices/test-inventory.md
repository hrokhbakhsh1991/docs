# Phase 4 — Test inventory (repo truth)

```yaml
inventory_date: "2026-06-04"
rule: "Row must pass + non-hollow before IMPLEMENTATION-TRUTH VERIFIED"
anti_hollow: scripts/guards/lib/anti-hollow-phase4.mjs
```

## packages/tenant-kernel

| File | Count layer | P4-E / matrix | Subphase |
|------|-------------|---------------|----------|
| `test/host-parse.spec.ts` | unit | P4-E-HOST-01 (TK-1, TK-2) | 4.1 |
| `test/phase-4.contract.spec.ts` | contract | P4-E-HOST-01, P4-E-RLS-02 | 4.1 |

## packages/platform-events

| File | P4-E | Subphase |
|------|------|----------|
| `test/events.spec.ts` | P4-E-EVT-01 (EVT-1) | 4.5 |

## apps/api — Phase 4 primary

| File | P4-E / matrix | Subphase | Notes |
|------|---------------|----------|-------|
| `src/tenant-kernel/auth-env.spec.ts` | P4-E-AUTH-01 | 4.0 | dev bearer env gate |
| `src/tenant-kernel/tenant-kernel.spec.ts` | P4-E-AUTH-01 | 4.0 | bearer behavior |
| `src/tenant-kernel/parse-jwt-bearer.spec.ts` | scaffold | 4.0+ | JWT path |
| `src/storage/in-memory-tour.repository.spec.ts` | P4-E-SCALE-01 | 4.0, 4.2 | tenant-scoped index |
| `src/storage/prisma-tour.repository.spec.ts` | P4-E-DATA-01 | 4.2 | prisma adapter |
| `test/rls-isolation.integration.spec.ts` | P4-E-RLS-01 (RLS-1) | 4.2 | needs DATABASE_URL + SQL |
| `test/tenant-security.spec.ts` | P4-E-TENANT-01 | 4.3 | HTTP tenant headers |
| `test/tenant-config.spec.ts` | TH-1 partial | 4.4 | API theme route |
| `src/canonical/canonical-tour.service.events.spec.ts` | P4-E-EVT-01 hook | 4.5 | in-process publish |
| `test/cross-tenant-forensic.spec.ts` | advisory | 4.3+ | extra isolation |

## Not Phase 4 closure (do not confuse)

| File | Phase |
|------|-------|
| `test/phase-5.contract.spec.ts` | 5 |
| `test/integrity-audit-3.2.spec.ts` | 3.2 |
| `src/casl/api-ability.spec.ts` | 3 |

## Guard floors

```yaml
tenant_kernel_min_tests: 6   # gate-thresholds.mjs
platform_events_min_tests: 2
contract_required: test:phase-4
```
