# P6 — Implementation truth (repo snapshot)

```yaml
truth_id: IMPLEMENTATION-TRUTH-P6
snapshot_version: "2026-06-21-v2"
doc_completeness: FULL
pack_version: "2.1"
status: COMPLETE
gate: pnpm run p6:gate
sync_with: AGENT-CURRENT-PHASE.yaml · DOC-SYNC-INDEX.md
```

> **Agents:** Read this **before** assuming greenfield work. P6 is **closed** — changes are regression fixes only unless Architect reopens scope.

---

## Closure summary

| Item | Value |
| ---- | ----- |
| Nanos | 58/58 ✅ |
| Product gate | `pnpm run p6:gate` → `P6_DENALI_PRODUCT_GATE_OK` |
| Milestone | `P6-1-N-014` GUEST_SLICE_OK |
| Smoke club | `operator` · tenant `…000014` |

---

## Three apps (implemented)

| App | Canonical dev | Tenant resolution |
| --- | ------------- | ----------------- |
| `apps/marketing` | `operator.localhost:3002` | `resolve-host-tenant.ts` |
| `apps/portal` | `operator.portal.localhost:3003` | `club_portal` + legacy apex |
| `apps/web` admin | `operator.admin.localhost:3000` | `club_admin` |

**Same `tenantId`:** proven by `p6-host-tenant-parity.spec.ts`.

---

## Key implementations (do not re-build)

| Concern | SoT path | Notes |
| ------- | -------- | ----- |
| Portal CTA URL | `buildDevPortalPublicBaseUrl` · `@app-tour/tenant-kernel` | Used by marketing + web |
| Guest register | `apps/portal/app/catalog/[tourId]/register/` | OTP flow frozen |
| Member `/me` | `apps/portal/app/me/` | BFF only — no browser→API |
| Member list API | BFF → `GET /bookings?view=mine` | **Not** `/denali/registrations/mine` |
| Receipt upload | `app/api/me/registrations/[id]/receipt` | → finance API |
| OTP logic share | `@app-tour/ui-primitives/otp-segment-input-logic` | apps re-export thin wrappers |
| Guest theming | `p6-theming-file-tree` layout | `guest-theme-stack.spec.ts` |
| Operator bookings | `apps/api/src/bookings/` | `bookings-ops.spec.ts` in gate |
| Preservation | denali plugin + rules | `p6-preservation-gate.spec.ts` |

---

## Doc ↔ code alignment (verified)

| Doc claim | Code truth | Status |
| --------- | ---------- | ------ |
| Portal dev `{club}.portal.localhost:3003` | `playwright.portal.config.ts` baseURL | ✅ |
| Marketing CTA uses tenant-kernel | `resolve-web-registration-url.ts` | ✅ |
| Member session cookie `session` | portal public-auth BFF | ✅ |
| `portalMember.json` fa/en | `load-messages.ts` | ✅ |
| `p6:gate` in package.json | root `package.json` | ✅ |

---

## Verification tiers (complete closure model)

| Tier | Command | Covers | Required for P6 exit |
| ---- | ------- | ------ | -------------------- |
| **T1 Product** | `pnpm run p6:gate` | unit/static · 58 nano proof | ✅ **Yes** (VS-08) |
| **T2 E2E browser** | [runbooks/p6-e2e-smoke.md](../runbooks/p6-e2e-smoke.md) | VS-01..05 Playwright | Architect YES · pre-staging |
| **T3 Finance DB** | [FINANCE-OPS-P6-NOTE.md](FINANCE-OPS-P6-NOTE.md) | VS-07 API integration | When `DATABASE_URL` set |
| **T4 Operator manual** | [first-customer-operator.md](../runbooks/first-customer-operator.md) | VS-06/07 | Staging sign-off |

---

## Documented scope boundaries (not gaps)

| Topic | Doc | Status |
| ----- | --- | ------ |
| E2E not in product gate | [p6-e2e-smoke.md](../runbooks/p6-e2e-smoke.md) | ✅ documented |
| finance-ops DB skip | [FINANCE-OPS-P6-NOTE.md](FINANCE-OPS-P6-NOTE.md) | ✅ documented |
| OTP logic-only share | [OTP-SCOPE-P6.md](OTP-SCOPE-P6.md) | ✅ intentional |
| P6-2 file map | [p6-2-operator-admin.md](../p6-2-operator-admin.md) nano matrix | ✅ complete |
| Legacy 11.16 hosts | [11.16-user-portal.md](../../phase-11/subphases/11.16-user-portal.md) | ✅ aligned P6 |

---

## Post-P6 optional (outside pack)

| ID | Item |
| -- | ---- |
| H-P6-03 | Custom admin in `tenant_domains` v1 |
| OTP-UI | Full `OtpSegmentInput` in ui-primitives package |
| P6-E2E-CI | Wire `p6:e2e-gate` in GHA |

---

## Regression protocol

```text
1. pnpm run p6:gate
2. IF fail → read failing spec in scripts/p6-denali-product-gate.sh
3. TRACEABILITY-MATRIX-P6.md → nano → files
4. doc-first if core package change
5. fix · re-run p6:gate
```

---

## References

- [TRACEABILITY-MATRIX-P6.md](TRACEABILITY-MATRIX-P6.md)
- [SMOKE-SCENARIO-MAP-P6.md](SMOKE-SCENARIO-MAP-P6.md)
- [FINANCE-OPS-P6-NOTE.md](FINANCE-OPS-P6-NOTE.md)
- [OTP-SCOPE-P6.md](OTP-SCOPE-P6.md)
- [../runbooks/p6-e2e-smoke.md](../runbooks/p6-e2e-smoke.md)
- [../AGENT-START.md](../AGENT-START.md)
