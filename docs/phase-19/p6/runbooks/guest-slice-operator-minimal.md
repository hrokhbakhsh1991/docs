# Guest slice — minimal operator steps (P6-1)

Dev smoke club: `operator` host label.

## 1. Publish tour (admin app)

| Item | Value |
| ---- | ----- |
| App | `apps/web` — `http://operator.localhost:3000` |
| Login | Operator OTP (dev `1234`) |
| Wizard | `/tours/new` → review step → **`publishStatus: active`** |

Draft tours do **not** appear on marketing catalog.

## 2. Public catalog (marketing app)

| Item | Value |
| ---- | ----- |
| App | `apps/marketing` — `http://shop.operator.localhost:3002` |
| List | `/tours` |
| Detail | `/tours/{tourId}` → register CTA |

## 3. Portal register (user app)

| Item | Value |
| ---- | ----- |
| App | `apps/portal` — `http://operator.localhost:3003` |
| Route | `/catalog/{tourId}/register` |

### OTP flow

1. Enter mobile → **Send code**
2. Enter OTP **`1234`** (dev/test only)
3. **New user:** profile — name required, email optional
4. **Existing user:** skip profile → tour intake
5. Intake — name, email, party size → submit
6. Success: `[data-public-registration-success]`

See [`platform-portal-otp-flow.mdoc`](../../platform-portal-otp-flow.mdoc).

## Env

| Variable | Purpose |
| -------- | ------- |
| `AUTH_ALLOW_DEV_STATIC_OTP` | unset or not `false` → accept `1234` |
| `ALLOW_DEV_WEB_SESSION` | dev tenant host map |

## Playwright

`SMK-PTL-01` — `apps/portal/tests/e2e/portal-registration-smoke.spec.ts`
