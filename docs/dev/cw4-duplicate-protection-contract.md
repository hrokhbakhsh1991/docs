# CW4-07 — Duplicate-registration protection contract

**Wave:** CW-4 (CW4-07)  
**Contract owner (booking capability):** `@app-tour/booking-http-contracts` (`booking-duplicate-protection.contract.ts`)  
**Workspace policy owner (Urban):** `@app-tour/workspace-urban` (`registration.service.ts`)  
**Evidence:** TRUTH §12 (self/other + nationalId behavior is Denali/booking-specific; Urban uses separate table + email key)

## Objective

Freeze duplicate-registration protection as **explicit contracts** without forcing one persistence implementation. Booking and Urban remain intentionally divergent.

## Booking capability — DB partial uniques + probe kinds

**Persistence:** `operator_registrations` (host Booking repository).

**Active rows:** `status NOT IN ('cancelled', 'rejected')`.

**Partial unique indexes** (PostgreSQL; see `BOOKING_GUEST_DUPLICATE_UNIQUENESS.md`):

| Index | Keys | Predicate / note |
| ----- | ---- | ---------------- |
| `uq_operator_reg_active_email` | `(tenant_id, tour_id, lower(guest_email))` | email present + active |
| `uq_operator_reg_active_self` | `(tenant_id, tour_id, submitted_by_user_id)` | active **and** `registrantTarget ≠ other` |
| `uq_operator_reg_active_label` | `(tenant_id, tour_id, lower(guest_label))` | active |
| `uq_operator_reg_active_national_id` | `(tenant_id, tour_id, intake nationalId)` | nationalId present + active |

**Application probes** (`BookingPublicPort` → `findActiveGuestDuplicate` kinds):

| Kind | Semantics |
| ---- | --------- |
| `user` | **Self-only** — same submitter on tour; excludes `registrantTarget=other` |
| `label` | Case-insensitive `guestLabel` collision on tour |
| `email` | Case-insensitive `guestEmail` collision on tour |
| `phone` | Case-insensitive `guestPhone` collision on tour |
| `nationalId` | Intake `nationalId` collision on tour |

Pre-checks run for UX; races map Prisma `P2002` → domain `BOOKING_GUEST_DUPLICATE` (HTTP 409).

**Workspace orchestration (Denali/Harbor):** may throw workspace codes (`DENALI_REGISTRATION_DUPLICATE`, `HARBOR_REGISTRATION_DUPLICATE`) after probe hits **before** host create. Identity collisions after create still surface as `BOOKING_GUEST_DUPLICATE`.

Authority: [registration-self-other-uniqueness.mdoc](../workspaces/denali/registration-self-other-uniqueness.mdoc) · [BOOKING_GUEST_DUPLICATE_UNIQUENESS.md](../phase-20/p7/appendices/BOOKING_GUEST_DUPLICATE_UNIQUENESS.md).

## Urban workspace policy — email uniqueness

**Persistence:** `urban_registrations` (separate table; not `operator_registrations`).

**Uniqueness:** full unique `(tenant_id, tour_id, email)` — index `uq_urban_reg_tenant_tour_email`. **Not** partial on status; cancelled rows still occupy the email slot until product migration approves otherwise.

**Application check:** `findByTenantTourEmail` in `createUrbanRegistration` before insert.

**Conflict code:** `URBAN_REGISTRATION_DUPLICATE` (HTTP 409). Does **not** use `BookingPublicPort` probe kinds or `BOOKING_GUEST_DUPLICATE`.

## Intentional divergence (no unification in CW4-07)

| Dimension | Booking / Denali / Harbor | Urban |
| --------- | ------------------------- | ----- |
| Table | `operator_registrations` | `urban_registrations` |
| Uniqueness model | Multi-key partial uniques + self/other | Single email per tour |
| Probe surface | `BookingPublicPort` (5 kinds) | Repository email lookup only |
| HTTP conflict | `BOOKING_GUEST_DUPLICATE` and/or workspace duplicate codes | `URBAN_REGISTRATION_DUPLICATE` |
| Status vocabulary | `pending` / `approved` / … | `confirmed` / `waitlist` / `cancelled` |

DEC-CW-01 / registration-model unification is **out of scope** (CW4-05 blocked).

## Verification

```bash
# Booking contract + static uniqueness proofs
pnpm --filter @app-tour/booking-http-contracts run test

# Urban workspace policy contract
pnpm --filter @app-tour/workspace-urban exec node --import tsx --test test/urban-duplicate-protection.contract.spec.ts

# Existing integration proofs
pnpm --filter @apps/api exec node --import tsx --test test/booking-guest-duplicate-uniqueness.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/denali-registration.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-catalog-registration.spec.ts

# Parity golden (CW4-07)
pnpm run test:parity
```
