# Guest slice — minimal operator steps (P6-1)

```yaml
smoke_club: operator
smoke_tenant_id: 00000000-0000-4000-8000-000000000014
host_authority: ../../p6-host-addressing-architecture.mdoc
```

Dev smoke club: `operator` host label. **Canonical hosts** below; legacy aliases still work (see [host-subdomain-map.md](host-subdomain-map.md)).

## 1. Publish tour (admin app)

| Item | Value |
| ---- | ----- |
| App | `apps/web` |
| URL (canonical) | `http://operator.admin.localhost:3000` |
| URL (legacy) | `http://operator.localhost:3000` |
| Login | Operator OTP (dev `1234`) |
| Wizard | `/tours/new` → review step → **`publishStatus: active`** |

Draft tours do **not** appear on marketing catalog.

## 2. Public catalog (marketing app)

| Item | Value |
| ---- | ----- |
| App | `apps/marketing` |
| URL (canonical) | `http://operator.localhost:3002` |
| URL (legacy) | `http://shop.operator.localhost:3002` |
| List | `/tours` |
| Detail | `/tours/{tourId}` → register CTA |

## 3. Portal register (user app)

| Item | Value |
| ---- | ----- |
| App | `apps/portal` |
| URL (canonical) | `http://operator.portal.localhost:3003` |
| URL (legacy) | `http://operator.localhost:3003` |
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
| `PLATFORM_ROOT_DOMAIN` | `localhost` (dev) |

## Playwright

`SMK-PTL-01` — `apps/portal/tests/e2e/portal-registration-smoke.spec.ts`
