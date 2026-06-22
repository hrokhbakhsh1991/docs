# P7-3 — Delivery exit (customer sign-off)

```yaml
epic: P7-3
status: PLANNED
priority: 4
prerequisite: [P7-0, P7-1, P7-2]
exit: P7-3-N-TBD
estimate_nanos: TBD
```

## Goal

**Vertical slice کامل روی staging** — مهمان + اپراتور + member — با sign-off مشتری اول.

## Verification tiers (frozen from P6)

| Tier | Artifact | Required for P7 exit |
| ---- | -------- | -------------------- |
| T1 | `pnpm run p6:gate` | ✅ every PR |
| T2 | [p6-e2e-smoke.md](../../phase-19/p6/runbooks/p6-e2e-smoke.md) | ✅ pre-sign-off |
| T3 | [FINANCE-OPS-P6-NOTE.md](../../phase-19/p6/appendices/FINANCE-OPS-P6-NOTE.md) | ✅ staging Postgres |
| T4 | [first-customer-operator.md](../../phase-19/p6/runbooks/first-customer-operator.md) | ✅ manual VS-06/07 |

## VS live checklist

- [ ] VS-01 publish active (customer tour)
- [ ] VS-02 marketing lists tour
- [ ] VS-03 portal register
- [ ] VS-04 `/me` row
- [ ] VS-05 member receipt
- [ ] VS-06 operator approve booking
- [ ] VS-07 operator approve receipt
- [ ] VS-08 `p6:gate` + `p7:gate` (when wired)

## Work packages (بسط بعدی → nanos)

1. **E2E staging run** — SMK-P6-* on real URLs
2. **finance-ops** — green with staging `DATABASE_URL`
3. **p7:gate script** — compose T1 + P7-specific specs (TBD)
4. **Sign-off doc** — customer handoff checklist

## Exit signal

مشتری اول می‌تواند بدون dev یک ثبت‌نام و یک تأیید اپراتور انجام دهد.

## References

- [platform-denali-vertical-slice.mdoc](../../phase-19/platform-denali-vertical-slice.mdoc)
