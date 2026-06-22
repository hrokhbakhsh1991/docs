# P6 file map

```yaml
pack_version: "2.1"
nano_total: 58
status: COMPLETE
gate: pnpm run p6:gate
navigator: ../AGENT-NAVIGATOR.md
machine_snapshot: AGENT-CURRENT-PHASE.yaml
```

## Pack (agent) — read order

| # | File | Role |
| - | ---- | ---- |
| 1 | `AGENT-START.md` | Entry · **COMPLETE** · regression loop |
| 2 | `AGENT-CURRENT-PHASE.yaml` | Machine snapshot |
| 3 | `../AGENT-NAVIGATOR.md` | Decision tree · FORBIDDEN |
| 4 | `AGENT-STATE-MAP-P6.md` | ASM triggers · guards · prove |
| 5 | `appendices/IMPLEMENTATION-TRUTH-P6.md` | Repo truth — **read before coding** |
| 6 | `appendices/TRACEABILITY-MATRIX-P6.md` | Nano → file → spec |
| 7 | `appendices/SMOKE-SCENARIO-MAP-P6.md` | SMK-P6 scenarios |
| 8 | `DOC-SYNC-INDEX.md` | Progress yaml v2.1 |
| 9 | `p6-exit-checklist.md` | 58 nano checklist ✅ |

## EPIC specs

| File | EPIC | Nanos |
| ---- | ---- | ----- |
| `p6-0-host-subdomain.md` | P6-0 | 9 |
| `p6-1-guest-slice.md` | P6-1 · **GUEST_SLICE_OK** | 15 |
| `p6-theming-file-tree.md` | P6-1-N-015 | — |
| `p6-2-operator-admin.md` | P6-2 | 16 |
| `p6-3-member-portal.md` | P6-3 | 10 |
| `p6-4-exit-gate.md` | P6-4 | 8 |

## Deprecated (v1.0 — do not use)

| Old | Replaced by |
| --- | ----------- |
| `p6-a-public-club-site.md` | P6-0 + P6-1 |
| `p6-b-user-portal.md` | P6-1 (register) + P6-3 (`/me`) |
| `p6-c-operator-admin.md` | P6-2 |
| `p6-d-vertical-slice-exit.md` | P6-4 |

## Runbooks

| File | Nano |
| ---- | ---- |
| `runbooks/host-subdomain-map.md` | P6-0-N-001, N-006, N-008 |
| `runbooks/guest-slice-operator-minimal.md` | P6-1-N-001, N-014 |
| `runbooks/p6-e2e-smoke.md` | P6-4-N-007 · T2 E2E |
| `runbooks/first-customer-operator.md` | P6-2-N-016 · VS-06/07 |
| `runbooks/first-customer-seed.md` | P6-4-N-005 |
| `runbooks/staging-deploy.md` | P6-4-N-006 |

## Doc SoT (Markdoc)

| File | Role |
| ---- | ---- |
| `../platform-denali-first-customer.mdoc` | Umbrella |
| `../p6-host-addressing-architecture.mdoc` | **Host authority** |
| `../p6-enterprise-theming-architecture.mdoc` | Four-layer cascade |
| `../p6-implementation-standards.mdoc` | BFF · theming · FORBIDDEN |
| `../platform-denali-vertical-slice.mdoc` | VS-01..08 |
| `../platform-portal-otp-flow.mdoc` | P6-1 OTP |
| `../platform-portal-member.mdoc` | P6-3 session + `/me` |

## Code hotspots

| Surface | Paths |
| ------- | ----- |
| Host kernel | `packages/tenant-kernel/src/host/build-dev-portal-public-base-url.ts` |
| Host/tenant API | `resolvePublicIngressSubdomain` · `GET /public/tenant-context` |
| Dev host map | `apps/{marketing,portal,web}/src/tenant/resolve-host-tenant.ts` |
| Marketing CTA | `apps/marketing/src/portal/resolve-web-registration-url.ts` |
| Web redirect | `apps/web/src/portal/resolve-portal-registration-redirect.ts` |
| Public catalog | `apps/marketing/app/tours/` |
| Register | `apps/portal/app/catalog/[tourId]/register/` |
| Member `/me` | `apps/portal/app/me/` · `app/api/me/` |
| Theming | `packages/design-tokens/src/shell-bridge.css` · `denali-*.css` |
| Admin | `apps/web/app/(app)/` · `apps/api/src/bookings/` · workspace-finance |

## Gate & specs (all ✅ in p6:gate)

| File | Nano | Status |
| ---- | ---- | ------ |
| `scripts/p6-denali-product-gate.sh` | P6-4-N-002 | ✅ |
| `scripts/p6-denali-e2e-gate.sh` | P6-4-N-007 | ✅ stub |
| `scripts/smoke-p6-host-bind.mjs` | P6-0-N-007 | ✅ |
| `apps/api/test/p6-host-tenant-parity.spec.ts` | P6-0-N-002 | ✅ |
| `apps/api/test/p6-guest-slice.spec.ts` | P6-1-N-013 | ✅ |
| `apps/portal/test/p6-theming-file-tree.spec.ts` | P6-1-N-015 | ✅ |
| `apps/api/test/p6-offline-receipt-gate.spec.ts` | P6-2-N-014 | ✅ |
| `apps/api/test/p6-preservation-gate.spec.ts` | P6-2-N-015 | ✅ |
| `apps/api/test/bookings-ops.spec.ts` | P6-2-N-001 | ✅ |
| `apps/api/test/platform-denali-first-customer-exit.spec.ts` | P6-4-N-004 | ✅ |
| `apps/portal/test/portal-member-registrations.spec.ts` | P6-3 | ✅ |
| `apps/portal/test/portal-home-redirect.spec.ts` | P6-3-N-009 | ✅ |

## Host gaps (post-closure)

| ID | Status |
| -- | ------ |
| H-P6-02 | ✅ canonical `.portal.` dev hosts |
| H-P6-04 | ✅ parity spec |
| H-P6-05 | ✅ runbook |

Deferred: H-P6-03 custom admin `tenant_domains` — post-P6 optional.
