# ASM-P6 — Denali vertical slice + member session states

```yaml
map_id: AGENT-STATE-MAP-P6
phase: 19
authority: platform-denali-vertical-slice.mdoc · platform-portal-member.mdoc
state_count: 16
```

## Host resolution (P6-0)

| State ID | Trigger | Guard | Next |
| -------- | ------- | ----- | ---- |
| ASM-P6-001 | Host `operator.localhost` | marketing apex | tenantId operator |
| ASM-P6-002 | Host `operator.portal.localhost` | club_portal | same tenantId |
| ASM-P6-003 | Host `operator.admin.localhost` | club_admin | same tenantId |
| ASM-P6-004 | Host `shop.operator.localhost` | legacy marketing | same tenantId (strip `shop.`) |

**Prove:** `p6-host-tenant-parity.spec.ts` · `GET /public/tenant-context`

---

## Guest slice (P6-1)

| State ID | Trigger | Guard | Next |
| -------- | ------- | ----- | ---- |
| ASM-P6-010 | Admin publish active | operator session | VS-01 draft hidden |
| ASM-P6-011 | GET marketing `/tours` | active tour seeded | VS-02 list row |
| ASM-P6-012 | CTA click | `buildDevPortalPublicBaseUrl` | portal `/catalog/{id}/register` |
| ASM-P6-013 | OTP verify dev `1234` | phone preflight | profile or intake |
| ASM-P6-014 | Register complete | member session cookie | `[data-public-registration-success]` VS-03 |

**Prove:** `p6-guest-slice.spec.ts` · `guest-theme-stack.spec.ts`

---

## Member portal (P6-3)

| State ID | Trigger | Guard | Next |
| -------- | ------- | ----- | ---- |
| ASM-P6-020 | GET `/me/registrations` | member session | 200 list via BFF |
| ASM-P6-021 | No session on `/me/*` | — | redirect `/` or marketing |
| ASM-P6-022 | BFF `GET /api/me/registrations` | cookie | upstream `GET /bookings?view=mine` |
| ASM-P6-023 | POST receipt | own registrationId | finance receipts API |
| ASM-P6-024 | POST receipt foreign id | member | **403** |
| ASM-P6-025 | Portal `/` with session | member cookie | redirect `/me/registrations` |

**Prove:** `portal-member-registrations.spec.ts` · `portal-home-redirect.spec.ts`

---

## Operator admin (P6-2)

| State ID | Trigger | Guard | Next |
| -------- | ------- | ----- | ---- |
| ASM-P6-030 | POST approve booking | admin + txn | VS-06 status approved + outbox |
| ASM-P6-031 | POST approve receipt | admin finance | VS-07 ledger updated |
| ASM-P6-032 | Member approve booking | — | **403** (reuse ASM-9.5-006) |

**Prove:** `bookings-ops.spec.ts` · runbook `first-customer-operator.md`

---

## Exit (P6-4)

| State ID | Trigger | Guard | Next |
| -------- | ------- | ----- | ---- |
| ASM-P6-040 | `pnpm run p6:gate` | all P6 specs | exit 0 · `P6_DENALI_PRODUCT_GATE_OK` VS-08 |

**Prove:** `platform-denali-first-customer-exit.spec.ts`
