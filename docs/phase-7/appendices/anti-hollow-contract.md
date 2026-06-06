# Phase 7 — Anti-hollow contract

```yaml
contract_version: "2026-06-04-v1"
scaffold_contract_warning: true
doc_target: 96
```

## Scaffold honesty

Phase 7 doc pack may score **96 doc execution** while repo behavioral remains **~0**. This is intentional — documentation precedes implementation per doc-first covenant.

## Required tokens

- `IMPLEMENTATION-TRUTH` must state urban package **absent** until 7.1
- Forensic audit stays `verdict: PENDING` until 7.9 behavioral closure
- Verification matrix rows label **TARGET** where tests do not exist yet

## 96 doc target

Guard `pnpm run phase-7:guard` enforces:

- All subphases 7.0–7.9 have `completion_proof` + `Primary spec`
- REQ-P7-001..035 in verification-matrix
- DEC-P7-001..015 in IMPLEMENTATION-DECISIONS

## Forbidden hollow claims

- "Platform DoD complete" from doc guard alone (P7-F-005)
- "Urban E2E green" without integration specs passing
