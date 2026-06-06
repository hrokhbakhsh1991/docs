# Phase 7 — Forensic rubric

```yaml
rubric_version: "2026-06-04-v1"
minimum_score: 8
report: docs/audits/phase-7-zero-debt-forensic-audit.mdoc
```

| #   | Criterion                                   | Weight | Verification                               |
| --- | ------------------------------------------- | ------ | ------------------------------------------ |
| 1   | Second workspace without platform-core diff | 2      | `phase-7.contract.spec.ts` + git diff      |
| 2   | Urban E2E create→publish                    | 2      | `urban-create-publish.integration.spec.ts` |
| 3   | No denali rail for urban                    | 1      | P7-X-A02 + web config review               |
| 4   | Observability §10 fields                    | 1      | `audit-log-fields.mjs`                     |
| 5   | Rate limits per tenant tier                 | 1      | `rate-limit-tenant.spec.ts`                |
| 6   | TenantConnectionRouter silo                 | 2      | `tenant-connection-router.spec.ts`         |
| 7   | ci:integrity at closure                     | 2      | `pnpm run ci:integrity`                    |
| 8   | Doc/reality alignment                       | 1      | IMPLEMENTATION-TRUTH vs green tests        |

**Pass:** weighted sum ≥ 8 with no P0 adversarial row red — see [`ADVERSARIAL-MATRIX.md`](ADVERSARIAL-MATRIX.md).
