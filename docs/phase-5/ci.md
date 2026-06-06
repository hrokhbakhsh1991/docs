# Phase 5 — CI / guards / gates

> **SOURCE OF TRUTH:** CI commands and gate checklist  
> **Guard categories (RULE index):** [`phase-5-guards.md`](phase-5-guards.md)  
> **Enforcement text:** [`phase-5-enforcement.md`](phase-5-enforcement.md)  
> **Per-subphase CI:** each [`subphases/*.md`](subphases/) `ci_commands` block

## Guard scripts (target)

```yaml
phase_5_guard:
  status: IMPLEMENTED
  entrypoint: node scripts/guards/phase-5-guard.mjs
  alias: pnpm run phase-5:guard
  report: reports/phase-5-gate-YYYY-MM-DD.json
  contract_spec: apps/api/test/phase-5.contract.spec.ts
  contract_note: SCAFFOLD_ONLY — see appendices/test-inventory.md (GAP-P5-03)
  closure_checklist: audits/CLOSURE-CHECKLIST.md
gate_json:
  scaffold_pass: "guard ok:true — files exist"
  full_pass: "phase-5:gate exit 0 — includes phase-4:gate"
```

## Gate command (target)

```yaml
closure_gate:
  command: pnpm run phase-5:gate
  chain: "pnpm build && pnpm test && pnpm run phase-4:gate && pnpm run phase-5:guard"
  package_json: "scripts/guards/phase-5-guard.mjs"
  status: IMPLEMENTED
  blocker_p5_002: RESOLVED_2026_06_04
  exit_required: 0
  subphase: "5.6"
  action: P5-6-A06
  req: REQ-P5-039
```

## Pipeline order (when `phase-5:gate` defined)

| Step | Command                                                        | Subphase      | REQ / RULE                              |
| ---- | -------------------------------------------------------------- | ------------- | --------------------------------------- |
| 1    | `pnpm run phase-4:gate`                                        | 5.0           | REQ-P5-002, RULE-034                    |
| 2    | `pnpm build`                                                   | all           | —                                       |
| 3    | `pnpm test`                                                    | all           | REQ-P5-024 (partial)                    |
| 4    | Migration up (`DATABASE_URL`)                                  | 5.1, 5.4, 5.5 | REQ-P5-007,015,023                      |
| 5    | `pnpm --filter @apps/api test`                                 | 5.2–5.5       | REQ-P5-009–023                          |
| 6    | `phase-5.contract.spec.ts` (**SCAFFOLD** — see test-inventory) | 5.6           | REQ-P5-024, RULE-031                    |
| 6b   | Behavioral outbox/audit per test-inventory §5.4–5.5            | 5.4–5.5       | REQ-P5-015–023 — **not** contract alone |
| 7    | `pnpm run phase-5:gate`                                        | 5.6           | REQ-P5-039                              |
| —    | `pnpm run guard:architecture`                                  | 5.6           | RULE-038                                |

## CI ↔ subphase map

| Subphase | CI commands                             | Primary REQ            |
| -------- | --------------------------------------- | ---------------------- |
| 5.0      | `pnpm run phase-4:gate`                 | REQ-P5-001–006         |
| 5.1      | migration up, `pnpm build`              | REQ-P5-007,008,033     |
| 5.2      | `pnpm --filter @apps/api test`          | REQ-P5-009–011,034     |
| 5.3      | api test, EXPLAIN                       | REQ-P5-012–014,032     |
| 5.4      | api test, TourCreated integration       | REQ-P5-015–022,035     |
| 5.5      | migration, api test                     | REQ-P5-023             |
| 5.6      | contract spec, `phase-5:gate`, forensic | REQ-P5-024–028,039,040 |

## MAP §12 gate compliance

```yaml
contractual_gate:
  requirement: phase-5.contract.spec.ts
  forbidden: grep-only closure
  rule: RULE-031
  forbidden_action: FORBIDDEN-017
data_integrity:
  action: P5-6-A02
  req: REQ-P5-025
complexity_bound:
  actions: [P5-6-A03, P5-6-A04]
  rules: [RULE-032, RULE-033]
  req: [REQ-P5-026, REQ-P5-027]
```

## Failure → FAIL

- Any required command exit ≠ 0
- Closure without contract spec
- Closure without Postgres runtime proof (FORBIDDEN-026)
- `phase-5:gate` undefined at 5.6 without Architect waiver → **FAIL** (BLOCKER-P5-002)

**Legacy path:** [`phase-5-ci.md`](phase-5-ci.md) redirects here.
