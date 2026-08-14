# Denali Booking Strip Action Hierarchy — PR22-B

```yaml
doc_id: DENALI_FINANCE_BOOKING_STRIP_ACTION_HIERARCHY_PR22_B
version: "2026-08-09-v1"
status: READY_FOR_REVIEW
phase: PR22-B
continues:
  - DENALI_FINANCE_BOOKING_STRIP_NEXT_ACTION_PR22_A
locks:
  - Presentation only — no API / DB / finance-core / state-machine changes
  - PR22-A decision order unchanged
  - recorded ≠ settled; payment pending ≠ receipt pending
scope: apps/web booking financial strip CTA visual/nav hierarchy
```

## Hierarchy

### When next-step exists

| Tier | Control | Style |
| ---- | ------- | ----- |
| Primary | Single next-step CTA (Payments or Receipts) | Dashed emphasis block + strong link |
| Secondary | The *other* surface as text nav (Receipts if primary is Payments; Payment history if primary is Receipts) | `text-xs` muted underline |
| Tertiary | Commercial Meaning — read-only | `text-xs` muted + “(read-only)” label |

### When booking is fully paid

| Tier | Control |
| ---- | ------- |
| Primary | **None** — settled/read-only copy; no “Open payments” action CTA |
| Secondary | Payment history (scoped `registrationId`) |
| Tertiary | Meaning (read-only) |

Payment rows remain visible as history, not as actions.
