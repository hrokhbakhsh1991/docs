# DP-5 execution plan — driver settlement

Authority: `docs/workspaces/denali/driver-settlement.mdoc`

## Approved product gates

- **DEN-PROD-06:** billable = min(offered, assigned) at roster freeze
- **DEN-PROD-07:** payable on operator confirm after freeze
- **Finance:** manual driver payable (no Wallet)

## Test matrix

| ID | Scenario | Layer |
|----|----------|-------|
| S1 | 3 offer / 2 assign → 2×unit | domain + API |
| S2 | assigned 0 | domain + API |
| S3 | passenger cancel pre-freeze | API |
| S4 | passenger reassignment | API |
| S5 | driver cancel | API |
| S6 | tour cancel | API |
| S7 | duplicate freeze | API idempotency |
| S8 | duplicate payout | API idempotency |
| S9 | correction before payout | API |
| S10 | correction after payout | API |
| S11 | workspace isolation | API |

## Certification

```bash
pnpm run test:dp5-driver-settlement
```

## Browser (1440)

1. Transport tab → assign 2 passengers to driver (3 offered)
2. Freeze roster with per-seat compensation
3. Confirm settlement → approve payable
4. Finance hub → complete driver payable
5. Cancel one passenger pre-freeze on second run

Evidence: screenshot + network HAR + settlement row JSON
