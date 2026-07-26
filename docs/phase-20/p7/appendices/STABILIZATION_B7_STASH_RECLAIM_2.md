# B7 — Stash reclaim `2` (archaeological)

```yaml
doc_id: STABILIZATION_B7_STASH_RECLAIM_2
status: RECLAIMED_SUPERSEDED
unlock: YES — STASH-RECLAIM-2
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
tip_at_reclaim: e4e58665
stash_ref: stash@{2}
stash_sha: 4d93703305f295f8d613f8900d699c17ce6150a5
stash_message: "wip-before-finance-phase-0-isolation"
base_branch_when_stashed: wip/portal-psc-20260718
```

## Policy followed

1. Architect `YES — STASH-RECLAIM-2` (Persian numeral ۲ accepted as `2`)
2. Inspected `git stash show --stat` + `git diff stash@{2}^1 stash@{2}`
3. Compared intent to tip `e4e58665`
4. **No apply** — tip already has Option C payment port + factory injection; applying would regress older Denali boot wiring
5. **No drop** — B7 quarantine retention

## Intent of stash@{2} (despite PSC branch name)

**Not** portal login modal files. Finance **booking-payment port** WIP parked on the PSC branch before finance phase-0:

| Change | Stash intent |
| ------ | ------------ |
| Port | Add `raisePaidInTx` + `BookingPaymentRaisePaidInTxInput` on `IBookingPaymentPort` |
| Adapter | Prisma TX raise-to-`paid` via `raiseBookingPaymentStatus` |
| Factory | `createFinanceRepository(bookingPayments)` shared adapter injection |
| Boot | Wire receipt defaults + shared `BookingPaymentAdapter` instance |
| Docs / guard | PAYMENT-LEDGER-BOUNDARY + phase-10 guard tweaks |

C9 modal reclaim (`YES — IMPL-PORTAL-MODAL`) was a **different** surface from `25f995c7` — this stash does not carry modal UI.

## Tip verdict (already landed — further evolved)

| Check | Tip evidence |
| ----- | ------------ |
| `raisePaidInTx` | Present on tip `BookingPaymentAdapter` |
| Port SoT | `ports/booking-payment.port.ts` re-exports `@app-tour/finance-core` (Phase 1.25) |
| Factory | Requires injected `IBookingPaymentPort` (no silent default Denali-era path in current tip) |
| Boundary doc | `PAYMENT-LEDGER-BOUNDARY.md` documents Option C TX path |

**Conclusion:** stash@{2} is **superseded archaeology**. Zero file land. Current WT untouched.

## Explicit non-actions

- Did **not** `git stash apply` / `pop` / `drop`
- Did **not** mix with C9 portal modal reclaim

## Companion

- Quarantine: [STABILIZATION_B7_STASH_QUARANTINE.md](./STABILIZATION_B7_STASH_QUARANTINE.md)
- C9 modal (separate): [STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md](./STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md)
