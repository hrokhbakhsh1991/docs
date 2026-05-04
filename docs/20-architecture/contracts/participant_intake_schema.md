Document-ID: MKT-DOC-ANALYSIS-STEP-04A
Version: v1.2
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-05-04
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Analysis Step 04-A: Participant Intake Schema

## 1. Purpose

Define the minimum participant intake schema for the **implemented** HTTP API (`apps/api/openapi.json`, DTOs under `apps/api/src/modules/registrations/dto/`), aligned with Step-03 requirements (`SR-FR-002`) and tenant enforcement (`SR-NFR-001`).

---

## 2. Scope

Applies to **registration** and **waitlist** creation payloads (JSON) in both access modes:

- Telegram Mini App mode
- Standalone web mode

**Authoritative wire contract:** `CreateRegistrationDto` and `CreateWaitlistItemDto` in OpenAPI; unknown top-level fields are rejected by the API validation pipe.

---

## 2.1 Tenant scope — not in JSON bodies

> Tenant context is derived from the authenticated session or tour bootstrap context. Clients must NOT send `tenant_id`.

For **authenticated** routes, “authenticated session” means the verified **Bearer JWT** (`tenant_id` claim plus membership) established before controller logic. For **public** `…/register` and `…/waitlist` routes, tenant comes from **server-side tour bootstrap** (path `tourId`), not from the client body.

**Clients MUST NOT send** `tenant_id`, `tenantId`, or any other tenant scope field in registration / waitlist JSON bodies. Unknown top-level keys are rejected: Nest **`ValidationPipe`** uses **`forbidNonWhitelisted: true`**, so extra properties cause **validation failure** rather than being ignored. Details: §3 and `docs/security/api_ownership_audit.md`.

---

## 3. Tenant context (not a payload field)

Effective tenant for persistence is **never** taken from participant intake JSON.

| Flow | How tenant is determined |
|------|---------------------------|
| **Authenticated** (`POST /api/v2/registrations`, `POST /api/v2/waitlist-items`, `POST /api/v2/bookings`, etc.) | From the **JWT** (`tenant_id` claim) after `AuthMiddleware`, cross-checked with the **tour row** (`tour.tenantId`) for non-admin mutating paths. |
| **Public tour bootstrap** (`POST /api/v2/tours/{tourId}/register`, `POST /api/v2/tours/{tourId}/waitlist`) | From **server-side resolution** of the tour’s `tenant_id` (e.g. `resolve_tour_tenant_for_public_flow`) using the path **`tourId`** — not from a client-supplied tenant field. |

**References:** `docs/security/api_ownership_audit.md`, `docs/20-architecture/data_model.md` §3.1 Tenant Isolation Model.

---

## 4. Canonical field schema (MVP) — HTTP JSON

Wire names use **camelCase** as in `openapi.json` / Swagger. Domain docs may still speak in snake_case for DB columns; the API is the source of truth for request bodies.

**DTO sources of truth (code):**

| Operation | Class | File |
|-----------|--------|------|
| Authenticated registration | `CreateRegistrationDto` | `apps/api/src/modules/registrations/dto/create-registration.dto.ts` |
| Authenticated waitlist create | `CreateWaitlistItemDto` | `apps/api/src/modules/registrations/dto/create-waitlist-item.dto.ts` |
| Authenticated booking shortcut | `CreateBookingDto` | `apps/api/src/modules/registrations/dto/create-booking.dto.ts` |

Public `…/register` and `…/waitlist` endpoints use the same **registration** vs **waitlist** DTO classes respectively for JSON bodies (see OpenAPI operation `requestBody` refs).

## 4.1 `CreateRegistrationDto` — required fields (`POST /api/v2/registrations`)

| Field | Type | Validation | Notes |
|-------|------|------------|--------|
| `tourId` | UUID string | `@IsUUID()` | Target tour; MUST belong to JWT tenant (enforced server-side; admin exempt where implemented). |
| `participantFullName` | string | `@IsString()` `@IsNotEmpty()` `@MaxLength(255)` | Trimmed by `@Transform` |
| `participantContactPhone` | string | `@Matches(/^\+?[0-9()\-\s]{7,20}$/)` etc. | Primary contact |
| `transportMode` | enum | `@IsEnum(RegistrationTransportModeDto)` | `self_vehicle` \| `group_vehicle` \| `other` |
| `entryMode` | enum | `@IsEnum(RegistrationEntryModeDto)` | `telegram` \| `web` |

## 4.2 `CreateRegistrationDto` — conditional / optional fields

| Field | Type | Condition | Notes |
|-------|------|-----------|--------|
| `telegramUserId` | string | `@ValidateIf` + required when `entryMode === "telegram"` | `@MaxLength(255)` |
| `telegramUsername` | string | `@IsOptional()` | `@MaxLength(255)` |
| `vehicleSeatCapacity` | integer | `@IsOptional()` `@IsInt()` `@Min(1)` | Optional driver metadata |
| `participantNote` | string | `@IsOptional()` `@MaxLength(2000)` | Optional free text |

## 4.3 Public registration — `POST /api/v2/tours/{tourId}/register`

Same **JSON shape** as `CreateRegistrationDto` (including `tourId` in body per OpenAPI). **`tourId` path parameter** is authoritative for routing/bootstrap; keep body **`tourId`** aligned with the path when sending both.

**No JWT.** Tenant resolved from tour only (§3).

## 4.4 `CreateWaitlistItemDto` — all fields (`POST /api/v2/waitlist-items` and public `…/waitlist`)

This DTO is **narrower** than `CreateRegistrationDto`: it has **no** `vehicleSeatCapacity` or `participantNote`.

| Field | Type | Validation | Notes |
|-------|------|------------|--------|
| `tourId` | UUID string | `@IsUUID()` | Target tour |
| `participantFullName` | string | `@IsString()` `@IsNotEmpty()` `@MaxLength(255)` | Trimmed |
| `participantContactPhone` | string | phone `@Matches` | Same pattern as registration DTO |
| `transportMode` | enum | `@IsEnum(RegistrationTransportModeDto)` | |
| `entryMode` | enum | `@IsEnum(RegistrationEntryModeDto)` | |
| `telegramUserId` | string | required when `entryMode === "telegram"` | `@MaxLength(255)` |
| `telegramUsername` | string | `@IsOptional()` `@MaxLength(255)` | |

**No tenant field** on the wire object.

## 4.5 Public waitlist — `POST /api/v2/tours/{tourId}/waitlist`

Body: **`CreateWaitlistItemDto`**; path **`tourId`**. Tenant from tour bootstrap (§3).

## 4.6 Authenticated booking shortcut — `POST /api/v2/bookings`

Body is **`CreateBookingDto`**: only **`tourId`** (`@IsUUID()`). Participant fields are filled server-side from the signed-in user; tenant from JWT + tour checks.

---

## 5. System-assigned fields (response / persistence — not request body)

| Field | Type | Rule |
|-------|------|------|
| `id` / `registration_id` | UUID | Assigned by system |
| `tenantId` | UUID | Set server-side from §3 — appears on **responses**, not accepted on create |
| `status` | enum | Initial registration status `Pending` where applicable |
| `paymentStatus` | enum | Initial `NotPaid` where applicable |
| `createdAt` / `updatedAt` | datetime | System clock |

---

## 6. Validation rules

- `INTAKE-VAL-001`: Request MUST be rejected if any required field is missing (per DTO + class-validator).
- `INTAKE-VAL-002`: Request MUST be rejected if `entryMode=telegram` and `telegramUserId` is absent (when applicable).
- `INTAKE-VAL-003`: Unknown enum values MUST be rejected.
- `INTAKE-VAL-004`: **Strict reject:** unknown top-level JSON fields MUST be rejected (`ValidationPipe` whitelist / forbid non-whitelisted).
- `INTAKE-VAL-005`: Input normalization SHOULD trim whitespace for string fields before validation (implemented on selected DTO fields).

## 6.1 Backend processing notes

- **No payload `tenant_id`:** scope violations are enforced via **JWT + tour membership** and **RLS** after session tenant binding — not by comparing a body tenant to JWT.
- Unknown-field policy: **STRICT REJECT** for intake mutations; record rejections in intake/audit logs where available.

---

## 7. Examples (JSON)

### 7.1 Authenticated registration — minimal web mode

```http
POST /api/v2/registrations
Authorization: Bearer <JWT>
Idempotency-Key: <uuid>
Content-Type: application/json
```

```json
{
  "tourId": "22222222-2222-4222-8222-222222222222",
  "participantFullName": "Ali Ahmadi",
  "participantContactPhone": "+989121234567",
  "transportMode": "group_vehicle",
  "entryMode": "web"
}
```

**Do not include:** `tenantId`, `tenant_id`, or any extra top-level keys.

### 7.2 Authenticated registration — telegram mode

```json
{
  "tourId": "22222222-2222-4222-8222-222222222222",
  "participantFullName": "Sara Karimi",
  "participantContactPhone": "+989351112233",
  "transportMode": "self_vehicle",
  "entryMode": "telegram",
  "telegramUserId": "123456789",
  "telegramUsername": "sara_trips"
}
```

### 7.3 Public registration — same body shape; tour in path

```http
POST /api/v2/tours/22222222-2222-4222-8222-222222222222/register
Content-Type: application/json
```

```json
{
  "tourId": "22222222-2222-4222-8222-222222222222",
  "participantFullName": "Ali Ahmadi",
  "participantContactPhone": "+989121234567",
  "transportMode": "group_vehicle",
  "entryMode": "web"
}
```

Tenant scope is **derived from the tour row**, not from the client.

### 7.4 Authenticated booking shortcut

```http
POST /api/v2/bookings
Authorization: Bearer <JWT>
Idempotency-Key: <uuid>
Content-Type: application/json
```

```json
{
  "tourId": "22222222-2222-4222-8222-222222222222"
}
```

### 7.5 Authenticated waitlist — `CreateWaitlistItemDto` (no `participantNote` / no `vehicleSeatCapacity`)

```http
POST /api/v2/waitlist-items
Authorization: Bearer <JWT>
Idempotency-Key: <uuid>
Content-Type: application/json
```

```json
{
  "tourId": "22222222-2222-4222-8222-222222222222",
  "participantFullName": "Sara Mohammadi",
  "participantContactPhone": "+989351112233",
  "transportMode": "other",
  "entryMode": "web"
}
```

---

## 8. Acceptance criteria

- `AC-INTAKE-001`: Valid payload creates a registration with initial lifecycle consistent with API (`Pending` / `NotPaid` where applicable).
- `AC-INTAKE-002`: Missing required field returns structured validation error.
- `AC-INTAKE-003`: Telegram-mode payload without `telegramUserId` fails validation.
- `AC-INTAKE-004`: Enum violations return deterministic error codes/messages.
- `AC-INTAKE-005`: Payload containing top-level `tenant_id` / `tenantId` **MUST** fail validation (unknown field) or remain unsupported — clients MUST omit them.

---

## 9. Traceability

- `SR-FR-002` → mandatory field enforcement on implemented DTOs
- `SR-FR-008` → dual-mode field `entryMode`
- `SR-FR-009` → Telegram identity condition
- `SR-NFR-001` → tenant boundary via **JWT + RLS + tour resolution**, **not** via intake `tenant_id`

Related clarifications:
- `docs/40-clarifications/clarifications_backlog.md` (`CLAR-001`, `CLAR-005`, `CLAR-034`)

---

## Changelog

- 2026-05-04 (v1.2): Prominent note — tenant from **authenticated session** or **tour bootstrap**; clients must NOT send `tenant_id`; tables split per **`CreateRegistrationDto`** vs **`CreateWaitlistItemDto`** (waitlist omits `participantNote` / `vehicleSeatCapacity`); DTO file paths; §7.5 waitlist example; `participantNote` max **2000** per DTO.
- 2026-05-04 (v1.1): **Aligned with implemented API:** removed `tenant_id` from HTTP intake schema; documented tenant as **derived from JWT or tour bootstrap**; camelCase wire fields; booking shortcut; **client MUST NOT send tenant_id** warning; examples updated; traceability updated for `SR-NFR-001`.
- 2026-04-28: Added backend processing notes for tenant mismatch fail-closed handling.
- 2026-04-28: Added explicit clarification linkage for unknown-field policy freeze dependency.
- 2026-04-28: Replaced unknown-field pending note with strict reject policy and intake-log requirement. — Decision Source: CLAR-034 — 2026-04-28
