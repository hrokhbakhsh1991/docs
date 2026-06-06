# Phase 5 evolution audit — P2 Phase 3 closure

```yaml
status: implemented
source: apps/api/docs/phase5-evolution-audit.md
closes: SCAL-LIM-02/03, RB-GAP-13, SM-VUL (partial), evolution CI pack
deferred: CAE-GAP-01/02 soft delete → Phase 6; RB-GAP-14 split relay → platform ops
```

## Scope (فاز سوم / P2 میان‌مدت)

| #   | Gap IDs        | Deliverable                                                              | DEC     |
| --- | -------------- | ------------------------------------------------------------------------ | ------- |
| 11  | CAE-GAP-01/02  | Soft delete — **deferred** Phase 6 decision doc                          | DEC-105 |
| 12  | RB-GAP-13      | `POST /internal/cache/invalidate` (dev/test) + Redis `ratelimit:*` flush | DEC-106 |
| 13  | SM-VUL         | `AUTH_JWT_PUBLIC_KEY_PREVIOUS` dual-key verify window                    | DEC-107 |
| 14  | SCAL-LIM-02/03 | `GET /internal/metrics` Prometheus text export                           | DEC-108 |
| 15  | CI             | `phase-5:evolution-gate` — evolution guards 1→3                          | DEC-109 |
| 16+ | Phase 4        | `phase-5:evolution-phase4-gate` — guards 4.1→4.8                         | DEC-117 |

## Verification

```bash
cd apps/api
pnpm run phase-5:evolution-gate
pnpm run openapi:generate
```
