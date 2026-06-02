# Final Integrity Report

## Audit Command

`cd apps/api && pnpm exec tsx src/scripts/audit-structural-integrity.ts`

## Summary

- Templates scanned: 3
- Total discrepancies: 0
- GHOST count: 0
- MISSING count: 0
- TYPE count: 0

## Full Discrepancy Ledger

NO DRIFT DETECTED

## Unknown DB Paths (not in RHF Schema)

- (none)

## Code Compliance Check

- canonical-only output (no RHF structural mirror): COMPLIANT
- serializer return shape (flat canonical, not nested form keys): COMPLIANT
- no hardcoded section key-list arrays in adapter: COMPLIANT

