# P6 — Traceability matrix (58 nanos → code → specs)

```yaml
matrix_id: TRACEABILITY-MATRIX-P6
version: "2026-06-21-v1"
pack_version: "2.1"
authority: platform-denali-first-customer.mdoc · p6-exit-checklist.md
status: COMPLETE
gate: pnpm run p6:gate
```

> **Agents:** Use this matrix to find **exact file + spec** for a nano without re-scanning the repo. One row per EPIC exit artifact.

---

## P6-0 — Host subdomain

| Nano | Requirement | Handler / surface | Spec / script | VS |
| ---- | ----------- | ----------------- | ------------- | -- |
| N-001 | Host map runbook | `runbooks/host-subdomain-map.md` | linked in architecture mdoc | — |
| N-002 | Same tenantId all hosts | `GET /public/tenant-context` | `p6-host-tenant-parity.spec.ts` | — |
| N-003 | Dev resolver alignment | `resolve-host-tenant.ts` (3 apps) | `portal-host-bind.spec.ts` | — |
| N-004 | Smoke seed | `OPERATOR_SMOKE` fixtures | runbook `first-customer-seed.md` | — |
| N-005 | site_surfaces | platform tenant provision | covenant guard | — |
| N-006 | Env URL matrix | `PORTAL_PUBLIC_BASE_URL` etc. | `public-catalog.md` | — |
| N-007 | Three-URL smoke | `scripts/smoke-p6-host-bind.mjs` | SMK-P6-HOST-01 | — |
| N-008 | Prod ingress note | `host-subdomain-map.md` § Ingress | doc only | — |
| N-009 | Custom domain | `tenant_domains` · `resolve-tenant-from-custom-domain` | architecture mdoc §4 | — |

**Kernel SoT:** `packages/tenant-kernel/src/host/build-dev-portal-public-base-url.ts`

---

## P6-1 — Guest slice

| Nano | Requirement | Handler / surface | Spec | VS |
| ---- | ----------- | ----------------- | ---- | -- |
| N-001 | Publish active | `apps/web` wizard review | `guest-slice-operator-minimal.md` | VS-01 |
| N-002 | Catalog list | `apps/marketing/app/tours/` | catalog specs | VS-02 |
| N-003 | Catalog detail | `apps/marketing/app/tours/[tourId]/` | catalog fetch | VS-02 |
| N-004 | CTA → portal | `resolve-web-registration-url.ts` | `resolve-web-registration-url.spec.ts` MKT-08 | VS-03 |
| N-005 | Register page | `public-catalog-registration-flow.tsx` | OTP-01 · contract spec | VS-03 |
| N-006 | OTP verify | `app/api/public-auth/*` BFF | `portal-public-auth-bff.spec.ts` | VS-03 |
| N-007 | Profile vs intake branch | same flow component | OTP-03/04 | VS-03 |
| N-008 | Publish → revalidate | `maybeScheduleMarketingCatalogRevalidate` | integration spec | VS-02 |
| N-009 | Pending booking | `POST /api/catalog/registrations` | registrations BFF spec | VS-03 |
| N-010 | Guest theme stack | `guest-shell.css` · layouts | `guest-theme-stack.spec.ts` | — |
| N-011 | fa-IR default | `apps/portal/src/i18n/` | locale specs | — |
| N-012 | site_surfaces marketing | marketing bootstrap | marketing gate | — |
| N-013 | Integration gate | compose markers | `p6-guest-slice.spec.ts` | VS-01..03 |
| N-014 | **GUEST_SLICE_OK** | canonical hosts E2E/manual | SMK-P6-PTL-01 · SMK-P6-MKT-02 | VS-01..03 |
| N-015 | Theming file tree | design-tokens · denali skins | `p6-theming-file-tree.spec.ts` | — |

**OTP logic SoT:** `@app-tour/ui-primitives/otp-segment-input-logic`

---

## P6-2 — Operator admin

| Nano | Requirement | Handler / surface | Spec | VS |
| ---- | ----------- | ----------------- | ---- | -- |
| N-001 | Bookings persistence | `apps/api/src/bookings/` | `bookings-ops.spec.ts` | VS-06 |
| N-002 | Approve/reject + outbox | `bookings.service.ts` | `bookings-ops.spec.ts` API-9.5-01 | VS-06 |
| N-003 | Waitlist promote | workspace waitlist tab | bookings specs | VS-06 |
| N-004 | Workspace embed CC | `tour-workspace-registrations-client.tsx` | command-center spec | VS-06 |
| N-005 | Operator register | `(app)/tours/[id]/register` | register route spec | VS-06 |
| N-006 | Finance receipts panel | `(app)/finance/` | `finance-page.spec.ts` | VS-07 |
| N-007 | Receipt → ledger | finance approve path | `finance-ops.spec.ts` (DB skip ok) | VS-07 |
| N-008 | MinIO upload | finance + portal receipt | `p6-offline-receipt-gate.spec.ts` | VS-05/07 |
| N-009 | Wizard sweep | wizard routes | runbook note | — |
| N-010 | Settings persist | 9 modules | `settings-*.spec.ts` | — |
| N-011 | Dashboard KPI | pending bookings widget | dashboard spec | — |
| N-012 | Finance widget | live summary API | finance widget spec | — |
| N-013 | Reconciliation triage | `/settings/reconciliation-triage` | `reconciliation-triage.spec.ts` | — |
| N-014 | offline_receipt gate | static gate | `p6-offline-receipt-gate.spec.ts` | VS-07 |
| N-015 | Preservation PC-01..10 | denali plugin paths | `p6-preservation-gate.spec.ts` | — |
| N-016 | Operator runbook | `first-customer-operator.md` | manual VS-06/07 | VS-06/07 |

**Authority:** `BOOKINGS-OPS-UX.md` · `FINANCE-OPS-UX.md`

---

## P6-3 — Member portal

| Nano | Requirement | Handler / surface | Spec | VS |
| ---- | ----------- | ----------------- | ---- | -- |
| N-001 | Session contract | `platform-portal-member.mdoc` | mdoc present | — |
| N-002 | My registrations | BFF → `GET /bookings?view=mine` | `portal-member-registrations.spec.ts` MEM-BFF-01 | VS-04 |
| N-003 | `/me` shell | `app/me/layout.tsx` | route exists | VS-04 |
| N-004 | List page | `app/me/registrations/page.tsx` | MEM-BFF-02 | VS-04 |
| N-005 | Detail page | `app/me/registrations/[id]/page.tsx` | detail marker | VS-04 |
| N-006 | Receipt BFF | `app/api/me/registrations/[id]/receipt/route.ts` | offline-receipt gate | VS-05 |
| N-007 | POST receipt 403 | finance API boundary | auth spec (future DB) | VS-05 |
| N-008 | Success CTA → `/me` | `public-catalog-registration-flow.tsx` | flow marker | VS-04 |
| N-009 | Home redirect | `app/page.tsx` | `portal-home-redirect.spec.ts` | VS-04 |
| N-010 | i18n | `messages/{fa,en}/portalMember.json` | MEM-I18N-01 | — |

**Forbidden:** new `GET /denali/registrations/mine` — use `view=mine` (ASM-9.5-002).

---

## P6-4 — Exit gate

| Nano | Requirement | Artifact | Spec | VS |
| ---- | ----------- | -------- | ---- | -- |
| N-001 | Vertical slice mdoc | `platform-denali-vertical-slice.mdoc` | cross-linked | VS-01..08 |
| N-002 | Gate script | `scripts/p6-denali-product-gate.sh` | EX-P6-01 | VS-08 |
| N-003 | package.json | `"p6:gate"` | EX-P6-02 | VS-08 |
| N-004 | Exit spec | `platform-denali-first-customer-exit.spec.ts` | EX-P6-01..03 | VS-08 |
| N-005 | Seed runbook | `first-customer-seed.md` | linked | — |
| N-006 | Staging deploy | `staging-deploy.md` | linked | — |
| N-007 | E2E stub | `scripts/p6-denali-e2e-gate.sh` | stub OK marker | — |
| N-008 | Closure | `p6-exit-checklist.md` `nano_done: 58` | `p6:gate` green | VS-08 |

---

## Gate composition (VS-08)

```text
guard:p3-denali-covenant
guard:import-boundary
tenant-kernel host tests
API: p6-host-tenant-parity · p6-guest-slice · p6-offline-receipt · p6-preservation · bookings-ops · exit
marketing: resolve-web-registration-url · guest-theme-stack
portal: p6-theming-file-tree · guest-theme-stack · portal-host-bind · portal-member · portal-home-redirect
web: portal-registration-redirect
→ P6_DENALI_PRODUCT_GATE_OK
```

---

## References

- [SMOKE-SCENARIO-MAP-P6.md](SMOKE-SCENARIO-MAP-P6.md)
- [IMPLEMENTATION-TRUTH-P6.md](IMPLEMENTATION-TRUTH-P6.md)
- [AGENT-STATE-MAP-P6.md](../AGENT-STATE-MAP-P6.md)
