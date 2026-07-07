# Staging E2E summary — 2026-06-23

```yaml
command: pnpm run p7:staging-e2e-probe
profile: B-staging
vps: 89.45.89.206
tunnel: 127.0.0.1:23000-23003
result: P7_STAGING_E2E_PROBE_OK
last_run: "2026-06-23T01:18Z"
duration_s: 114
tests: "12/12 PASS (portal 4 · marketing 4 · admin 3 · host bind)"
```

## Portal (SMK-PTL)

| ID | VS | Result |
| -- | -- | ------ |
| SMK-PTL-01 | VS-03 | PASS |
| SMK-PTL-02 | VS-04 | PASS |
| SMK-PTL-04 | VS-05 | PASS |
| SMK-PTL-05 | — | PASS |

## Marketing (SMK-MKT)

| ID | VS | Result |
| -- | -- | ------ |
| SMK-MKT-01 | VS-02 | PASS |
| SMK-MKT-03 | VS-03 | PASS |
| SMK-MKT-02 | — | PASS |
| SMK-MKT-04 | — | PASS |

## Admin (SMK-P6 / P9)

| ID | VS | Result |
| -- | -- | ------ |
| SMK-P6-VS-01 | VS-01 | PASS |
| SMK-P9-04 | VS-06 | PASS |
| SMK-P6-ADM-02 | VS-07 | PASS |

## Infra

- Host bind (operator.*.localhost) → tenant `…014` PASS
- Portal static chunk via tunnel → 200 PASS
- VS-07 finance reset in `seed-operator-smoke-pending-booking-staging.ts` before probe

## Re-run

```bash
pnpm run p7:staging-e2e-probe
```

Requires SSH access to `89.45.89.206` (probe opens tunnels automatically).
