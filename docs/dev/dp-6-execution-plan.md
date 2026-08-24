# DP-6 execution plan — refund orchestration

## Scope

Wire cancellation lifecycle → existing `FinanceRefund` aggregate. No new money math in Finance.

## Stages

1. **Domain** — `computeDenaliRefundEligibility` in `@app-tour/workspace-denali`
2. **API** — `refund-orchestration.service.ts`, `post-cancel-side-effects.ts`, `tour-cancellation.service.ts`
3. **Hooks** — operator cancel, member cancel, cancellation-request approve, tour cancel
4. **Portal** — refund status BFF + panel hooks
5. **Tests** — `apps/api/test/dp6/*` scenario matrix

## Certification

```bash
pnpm run test:dp6-refund-orchestration
pnpm run test:dp4-member-self-service
pnpm run test:dp5-driver-settlement
pnpm run test:dp1-payment-deadline
```
