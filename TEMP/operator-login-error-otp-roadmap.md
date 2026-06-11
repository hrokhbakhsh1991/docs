# Operator login — closure (final)

```yaml
status: done
closed: 2026-06-10
```

## Resolved contradictions

- BFF `bffCodedError()` — aligned codes, no message leak
- OpenAPI `phone-preflight` + guard PASS
- i18n full catalog (13 codes) fa/en
- API AUTH-PF-01..06 + BFF-LOGIN-01..03
- Identity seed: `OPERATOR_SMOKE_E2E_SEED=1` → owner on tenant …000014
- `readPhoneForSubmit()` + `typeLoginPhone()` — controlled input / Playwright parity
- Playwright SMK-P9-LOGIN-01..05 — all green
