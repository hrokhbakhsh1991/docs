# Final Integrity Report

## Audit Command

`cd apps/api && pnpm exec tsx src/scripts/audit-structural-integrity.ts`

## Final Run Output

```text
MISSING_DATA_LEAK: basicInfo missing in DB
```

## Drift Findings (Fail-Fast First Hit)

- [MISSING] `basicInfo` missing in DB
- [GHOST] none reached (script exits on first discrepancy)
- [TYPE] none reached (script exits on first discrepancy)
