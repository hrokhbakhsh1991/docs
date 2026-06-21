# P6 file map

```yaml
pack_version: "2.0"
nano_total: 56
```

## Pack (agent)

| File | Role |
| ---- | ---- |
| `AGENT-START.md` | Entry · `P6-0-N-001` |
| `AGENT-CONTEXT.md` | Three apps · guest-first |
| `DOC-SYNC-INDEX.md` | Progress yaml v2.0 |
| `p6-exit-checklist.md` | 56 nano checklist |
| `p6-denali-safety.md` | STOP rules |
| `p6-0-host-subdomain.md` | EPIC 0 |
| `p6-1-guest-slice.md` | EPIC 1 · **GUEST_SLICE_OK** |
| `p6-2-operator-admin.md` | EPIC 2 |
| `p6-3-member-portal.md` | EPIC 3 |
| `p6-4-exit-gate.md` | EPIC 4 |

## Deprecated (v1.0 — do not use)

| Old | Replaced by |
| --- | ----------- |
| `p6-a-public-club-site.md` | P6-0 + P6-1 |
| `p6-b-user-portal.md` | P6-1 (register) + P6-3 (`/me`) |
| `p6-c-operator-admin.md` | P6-2 |
| `p6-d-vertical-slice-exit.md` | P6-4 |

## Runbooks (created during P6)

| File | Nano |
| ---- | ---- |
| `runbooks/host-subdomain-map.md` | P6-0-N-001, N-006, N-008 |
| `runbooks/guest-slice-operator-minimal.md` | P6-1-N-001 |
| `runbooks/first-customer-operator.md` | P6-2-N-016 |
| `runbooks/first-customer-seed.md` | P6-4-N-005 |
| `runbooks/staging-deploy.md` | P6-4-N-006 |

## Doc SoT (Markdoc)

| File | Nano |
| ---- | ---- |
| `../platform-denali-first-customer.mdoc` | umbrella |
| `../p6-implementation-standards.mdoc` | **all UI work — Phase 2 stack** |
| `../platform-denali-vertical-slice.mdoc` | P6-4-N-001 |
| `../platform-portal-otp-flow.mdoc` | P6-1 OTP |
| `../platform-portal-member.mdoc` | P6-3-N-001 |

## Code hotspots

| Surface | Paths |
| ------- | ----- |
| Host/tenant | `GET /public/tenant-context` · `resolve-*-bootstrap.ts` |
| Public | `apps/marketing/app/tours/` |
| Register | `apps/portal/app/catalog/[tourId]/register/` |
| Member | `apps/portal/app/me/` (P6-3) |
| Admin | `apps/web/app/(app)/` · `tours/new/` |

## Gate

| File | Nano |
| ---- | ---- |
| `scripts/p6-denali-product-gate.sh` | P6-4-N-002 |
| `apps/api/test/p6-guest-slice.spec.ts` | P6-1-N-013 |
| `apps/api/test/p6-host-tenant-parity.spec.ts` | P6-0-N-002 |
| `apps/api/test/platform-denali-first-customer-exit.spec.ts` | P6-4-N-004 |
