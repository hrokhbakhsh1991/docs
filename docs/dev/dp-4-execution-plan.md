# DP-4 Execution Plan — Member Self-Service + Notifications

```yaml
plan_id: DP-4-EXECUTION-2026-08-24
authority: docs/dev/denali-product-completion-plan.md
status: IMPLEMENTED_AUTOMATED_VERIFIED — browser closure pending (b6c4fbb2)
approved_gates:
  DEN-PROD-09: "D+B+C composite — see docs/workspaces/denali/member-cancellation-policy.mdoc"
  DEN-PROD-12: "Portal inbox required; email async optional; SMS deferred; lifecycle independent of provider"
  DP4-10: "Emit registration.rejected (flip silent reject)"
```

## Test-first matrix

| ID | Scenario | Package |
| -- | -------- | ------- |
| S1 | Pending withdraw | denali policy + api |
| S2 | Waitlisted withdraw | api |
| S3 | Approved unpaid self-cancel + seat release | api + dp1 harness |
| S4 | Cutoff denied | denali policy |
| S5 | Paid/partial request only | api |
| S6 | Waitlist promote on approved cancel | api |
| S7 | Hold void on member cancel | finance |
| S8 | Notification inbox on cancel/approve | notifications |
| S9 | Delivery failure does not rollback TX | notifications |
| S10 | Portal cancel UI + eligibility BFF | portal |
| S11 | Owned detail forwards paymentDueAt + cancelSource | denali registration-get |
| S12 | registration.rejected outbox | booking |

## Certification script

`pnpm run test:dp4-member-self-service` → `scripts/test-dp4-member-self-service.sh`

Regression chain after DP-4 green: DP-1, DP-2, DP-3 scripts + `pre-commit:fast` + `guard:import-boundary`.
