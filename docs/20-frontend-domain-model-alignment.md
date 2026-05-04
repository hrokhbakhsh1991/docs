# Frontend domain model alignment (API-backed)

**Last updated:** 2026-05-04

The web app (`apps/web`) uses the **live Tour-Ops HTTP API** when `NEXT_PUBLIC_API_URL` is configured. Shared TypeScript types and runtime payloads are aligned with **`apps/api/openapi.json`**, which is generated from the NestJS controllers and DTOs.

## Authoritative field definitions

For **Tour** (and other v2 resources), the canonical contract is:

- **`docs/20-architecture/contracts/api_endpoint_contracts_v2_base.md`** — human-readable request/response projections and DTO rules.
- **`apps/api/openapi.json`** — machine-readable schema (`components.schemas.*`) kept in sync with the backend build.

If narrative docs and OpenAPI disagree, **fix the narrative or the server** so OpenAPI and the contract markdown match.

## Where shared types live

**Package:** `packages/types` (`@repo/types` in the monorepo)  
**Entry:** `packages/types/src/index.ts`

| Frontend type | Backend source |
|---------------|----------------|
| `TourResponseDto`, aliases `TourDto`, `Tour` | OpenAPI `components.schemas.TourResponseDto` (implements the contract projection for GET/POST/PATCH tour) |
| `TourLifecycleStatus` | OpenAPI `UpdateTourDto.lifecycle_status` enum (and entity enum on the server) |
| `RegistrationResponseDto`, aliases `BookingDto`, `Booking` | `components.schemas.RegistrationResponseDto` |
| `RegistrationStatus`, `RegistrationPaymentStatus`, transport/entry enums | Same registration schema |
| `WebCredentialDto`, `WebSessionDto`, `WebSessionResponseDto` | Auth/session schemas |
| `UserDto`, `User` | No standalone User entity in OpenAPI today — **`Pick` of `WebSessionResponseDto`** (`user_id`, `tenant_id`, `entry_mode`) |

Field names in JSON follow **camelCase** as in OpenAPI (e.g. `totalCapacity`, `lifecycleStatus`, `chatLink`, `costContext`).

## Tour MVP scope (persistence)

The MVP **Tour** model exposed by the API does **not** include schedule dates (`startDate` / `endDate`) as persisted fields. UI must not imply stored tour dates until a future release adds them to the contract and schema. See also **`docs/20-architecture/data_model.md` §4.2**.

## Related doc

Older narrative (mixed EN/fa): `docs/20-frontend/domain_model_alignment.md`.
