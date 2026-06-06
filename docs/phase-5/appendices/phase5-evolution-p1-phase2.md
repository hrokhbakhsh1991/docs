# Phase 5 evolution audit — P1 Phase 2 closure

```yaml
status: implemented
source: apps/api/docs/phase5-evolution-audit.md
closes: RB-GAP-01..04, RB-GAP-08/09, SHADOW-API-01..07, DEPLOY-DEBT-01/02 (decision), SH-GAP-13 (verified)
```

## Scope (فاز دوم / P1 کوتاه‌مدت)

| #   | Gap IDs           | Deliverable                                           | DEC     |
| --- | ----------------- | ----------------------------------------------------- | ------- |
| 6   | RB-GAP-01…04      | Forward-only rollback runbook in production checklist | DEC-098 |
| 7   | SHADOW-API        | `openapi:generate` + dispatch parity guard            | DEC-099 |
| 8   | DEPLOY-DEBT-01/02 | Phase 6 version strategy decision doc                 | DEC-100 |
| 9   | RB-GAP-09/08      | HTTP ingress `shuttingDown` reject + K8s grace docs   | DEC-101 |
| 10  | SH-GAP-13         | Redis fail-open — **pre-existing** DEC-083            | —       |

## Verification

```bash
cd apps/api
pnpm run guard:shutdown-ingress
pnpm run guard:openapi-dispatch-parity
pnpm run openapi:generate
node --import tsx --test src/http/shutdown-ingress.spec.ts
```
