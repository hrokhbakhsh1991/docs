# P7 — Customer seed delta (smoke → first customer)

```yaml
delta_id: P7-CUSTOMER-SEED-DELTA
pack_version: "1.6"
authority: P7-0-N-003 · first-customer-seed.md
nano: P7-0-N-003 · P7-1-N-004
```

> P6 seed proves the **vertical slice** with fixture tenant `operator`. P7 staging may use the same fixture **or** a customer-specific tenant — this doc defines the delta.

---

## Two valid staging modes

| Mode | When | Tenant | Tour |
| ---- | ---- | ------ | ---- |
| **Smoke carryover** | Profile A/B infra proof before customer data ready | `00000000-0000-4000-8000-000000000014` · subdomain `operator` | North Ridge Trek `…0210` |
| **Customer fixture** | Sign-off target (Profile C or agreed club id) | Customer UUID + subdomain | Customer tour(s) from wizard |

**P7 exit (T4)** requires **customer fixture** mode unless Architect waives in sign-off §Known exceptions.

---

## Smoke baseline (P6 — do not delete)

Authority: [`first-customer-seed.md`](../../phase-19/p6/runbooks/first-customer-seed.md) · `apps/api/test/fixtures/operator-smoke-e2e-tenant.ts`

| Field | Smoke value |
| ----- | ----------- |
| Subdomain | `operator` |
| Tenant ID | `00000000-0000-4000-8000-000000000014` |
| Published tour | `00000000-0000-4000-8000-000000000210` |
| Owner mobile | `+15550001001` (dev OTP `1234`) |

Use for: `p6:gate` · local stack · VPS infra smoke before customer rows exist.

---

## Customer fixture checklist (P7-0-N-003)

After migrations on staging Postgres:

```bash
DATABASE_URL=... DATABASE_URL_ADMIN=... NODE_ENV=production \
  pnpm --filter @apps/api run db:seed
```

Extend seed (or post-seed SQL) with **customer-specific** rows:

| Asset | Required for wizard | Source |
| ----- | ------------------- | ------ |
| Tenant + `site_surfaces` | marketing · portal · admin = true | provisioning / seed |
| Workspace definition | `denali-v1` | platform seed |
| Settings — destinations | wizard destination picker | `apps/api/src/settings/` · `db-seed.ts` |
| Settings — equipment catalog | wizard equipment step | same |
| Settings — locations | transport / itinerary pickers | same |
| Operator owner | OTP/SMS mobile for staging profile | tenant owner row |
| Terms template (if used) | P7-1-N-008 | settings module seed |

**Verify:**

```bash
curl -s -H "x-forwarded-host: <customer-marketing-host>" \
  "$TOUR_OPS_API_URL/public/tenant-context" | jq .data.tenantId
```

Same `tenantId` on portal + admin hosts for that club.

---

## Wizard prefill (P7-1-N-004)

| Check | Pass signal |
| ----- | ----------- |
| `/tours/new` destination picker | ≥1 option, not empty-state error |
| Equipment picker | customer catalog rows |
| New tour draft | prefill matches customer fixtures (not smoke-only labels) |

Do **not** duplicate seed passes — one `db:seed` + customer delta file or seed branch.

### Profile B staging (automated probe host)

When `p7:staging-wizard-probe` uses `denali.admin.localhost` → tenant `…000003`, seed reference catalog **before** picker proof:

```bash
# VPS (or local with staging DATABASE_URL)
NODE_ENV=development pnpm --filter @apps/api exec tsx scripts/seed-denali-dev-catalog-staging.ts
```

| API module | Path | Min rows |
| ---------- | ---- | -------- |
| Locations | `/settings/resources/locations` → `destinations[]` | ≥3 (توچال · دماوند · …) |
| Equipment | `/settings/resources/equipment` | ≥1 |
| Tour themes | `/settings/resources/tour_themes` | ≥1 |

Verify: `pnpm run p7:staging-picker-probe` · wizard HTML contains `توچال`.

`seed-operator-staging.ts` chains this after operator tenant `…014` seed.

### Operator smoke owner identity (P7-2-N-001)

`seed-operator-smoke-identity-staging.ts` upserts user `…0101` / mobile `+15550001001` with **ACTIVE owner** membership on tenant `…014` (`ws-operator-smoke`). Required for `operator.admin.localhost` OTP in workspace probes — distinct from Denali dev identity on tenant `…003`.

```bash
# VPS (idempotent — probe runs this automatically)
NODE_ENV=development pnpm --filter @apps/api exec tsx scripts/seed-operator-smoke-identity-staging.ts
pnpm run p7:staging-workspace-registrations-probe
```

---

## Customer fixture example (concrete — Denali club «alborz»)

Use when moving from smoke `operator` to first real customer on staging.

| Field | Example value |
| ----- | ------------- |
| Subdomain label | `alborz` |
| Tenant ID | `00000000-0000-4000-8000-000000000099` (allocate new UUID) |
| Workspace | `denali-v1` |
| Operator mobile | `+989121234567` |
| Owner display | `Alborz Trek Club` |
| Settings seed | destinations ≥3 · equipment catalog ≥5 rows · 1 terms template |
| First tour | created via wizard (not seed) — publish after walkthrough |

**Post-seed verify:**

```bash
curl -s -H "x-forwarded-host: alborz.staging.example.com" \
  "$TOUR_OPS_API_URL/public/tenant-context" | jq '{tenantId: .data.tenantId, surfaces: .data.siteSurfaces}'
```

Profile B interim: set `PUBLIC_TENANT_FALLBACK_LABEL=alborz` until DNS (see [P7-HOST-PARITY-PROFILE-B.md](P7-HOST-PARITY-PROFILE-B.md)).

**Seed implementation note:** extend `apps/api/scripts/db-seed.ts` with a `P7_CUSTOMER_FIXTURE=alborz` branch — doc-first before edit.

---

## Regression safety

| Change | Guard |
| ------ | ----- |
| Edit `db-seed.ts` | `pnpm run p7:gate` · smoke tenant IDs unchanged or dual-seed documented |
| New customer tenant only | E2E smoke may still use `operator` locally — staging E2E uses customer URLs per [p7-staging-e2e.md](../runbooks/p7-staging-e2e.md) |

---

## References

- [p7-wizard-blocker-walkthrough.md](../runbooks/p7-wizard-blocker-walkthrough.md) BLK-P7-02
- [IMPLEMENTATION-TRUTH-P7.md](IMPLEMENTATION-TRUTH-P7.md)
