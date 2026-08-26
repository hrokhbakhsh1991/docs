# First customer seed runbook (P6-4)

```yaml
nano: P6-4-N-005
smoke_club: operator
tenant_id: 00000000-0000-4000-8000-000000000014
seed_tour_id: 00000000-0000-4000-8000-000000000210
```

## Goal

Reproducible Denali club fixture for P6 vertical slice on local/staging.

---

## Operator smoke fixture

Authority: `apps/api/test/fixtures/operator-smoke-e2e-tenant.ts` · `OPERATOR_SMOKE`

| Field | Value |
| ----- | ----- |
| Subdomain label | `operator` |
| Tenant ID | `00000000-0000-4000-8000-000000000014` |
| Published tour ID | `00000000-0000-4000-8000-000000000210` |
| Owner mobile | `09174070937` (dev OTP `1234`) |

---

## Seed commands (dev)

```bash
nvm use && pnpm install
# Apply migrations + platform/workspace seeds as per apps/api package scripts
pnpm --filter @apps/api run db:seed   # or project-specific seed entrypoint
```

Ensure:

- `site_surfaces`: `{ marketing: true, portal: true, admin: true }`
- Workspace definition: `denali-v1`
- ≥1 tour with `publishStatus: active` for smoke tour id

---

## Verify

```bash
curl -s -H "x-forwarded-host: operator.localhost" \
  http://127.0.0.1:4000/public/tenant-context | jq .data.tenantId
# → 00000000-0000-4000-8000-000000000014

curl -s -H "x-forwarded-host: operator.portal.localhost" \
  http://127.0.0.1:4000/public/tenant-context | jq .data.tenantId
# same tenantId
```

---

## Staging

Use platform provision subdomain + `buildClubSiteUrls` URLs — see [staging-deploy.md](staging-deploy.md).
