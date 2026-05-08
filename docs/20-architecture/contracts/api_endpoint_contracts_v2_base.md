# API Endpoint Contracts v2 (Base)

Document-ID: MKT-DOC-API-ENDPOINT-CONTRACTS-V2-BASE  
Version: v1.0  
Status: Active  
Last-Updated: 2026-04-29

## Canonical Glossary

- **Tenant** -> isolation unit (security boundary).
- **Workspace** -> tenant as presented to the user in UI.

**Mapping:** Workspace = Tenant boundary (one-to-one mapping).

## Implemented Endpoints

### GET `/health`
- **Auth:** Public
- **Request DTO:** none
- **Response (200):**
  - `status`
  - `requestId`
- **Errors:** N/A

### GET `/health/live`
- **Auth:** Public
- **Request DTO:** none
- **Response (200):**
  - `status`
- **Errors:** N/A

### GET `/health/ready`
- **Auth:** Public
- **Request DTO:** none
- **Response (200):**
  - `status`
- **Errors:** `DEPENDENCY_TEMPORARY_UNAVAILABLE`, `INTERNAL_ERROR`

### GET `/health/readiness`
- **Auth:** Public
- **Request DTO:** none
- **Response (200):**
  - `status`
- **Errors:** `DEPENDENCY_TEMPORARY_UNAVAILABLE`, `INTERNAL_ERROR`

### POST `/api/v2/auth/web/session/otp`
- **Auth:** Public
- **Tenant scope:** Resolved server-side from HTTP `Host` / `x-forwarded-host` as `{slug}.{TENANT_ROOT_DOMAIN}` (see `TenantResolverMiddleware`); **not** accepted from the JSON body.
- **Request DTO:** `PhoneSessionDto`
  - `phone` — workspace user’s phone (strip non-digits except leading `+`; SQL match via **`phone_normalized(users.phone)`**; there is **no** `phone_normalized` **column** on `users`)
  - `otp` — one-time password (non-production: static **`1234`**; production disables static OTP)
- **Example body:**
  ```json
  {
    "phone": "+989121236598",
    "otp": "1234"
  }
  ```
- **Response (200):**
  - `session_token`
  - `user_id`
  - `tenant_id`
  - `entry_mode`: **`"web"`**
- **Errors:** `VALIDATION_FAILED`, `AUTH_UNAUTHENTICATED`, `TENANT_HOST_UNKNOWN`, `TENANT_CONTEXT_MISSING`, `TENANT_SCOPE_FORBIDDEN`, `INTERNAL_ERROR`

See **`docs/authentication-phone-otp.md`** for the full web auth narrative.

### POST `/api/v2/auth/telegram/session`
- **Auth:** Public
- **Tenant scope:** Same Host-based resolution as web session.
- **Request DTO:** `TelegramSessionDto`
  - `entry_mode`
  - `telegram_init_payload`
- **Response (200):**
  - `session_token`
  - `user_id`
  - `tenant_id`
  - `entry_mode`
- **Errors:** `VALIDATION_FAILED`, `AUTH_TELEGRAM_CONTEXT_REQUIRED`, `TENANT_HOST_UNKNOWN`, `TENANT_CONTEXT_MISSING`, `TENANT_SCOPE_FORBIDDEN`, `INTERNAL_ERROR`

### POST `/api/v2/auth/link-telegram`
- **Auth:** Authenticated (`member`/`owner`)
- **Request DTO:** `LinkTelegramDto`
  - `telegram_init_payload`
  - `link_reason` (optional)
- **Response (200):**
  - `user_id`
  - `linked_telegram_user_id`
  - `link_status`
  - `linked_at`
- **Errors:** `VALIDATION_FAILED`, `AUTH_UNAUTHENTICATED`, `AUTH_TELEGRAM_CONTEXT_REQUIRED`, `TENANT_SCOPE_FORBIDDEN`, `STATE_TRANSITION_INVALID`, `INTERNAL_ERROR`

### GET `/api/v2/tours`
- **Auth:** Authenticated (`member`/`owner`)
- **Request DTO:** none
- **Response (200):**
  - `id`
  - `createdAt`
  - `updatedAt`
  - `title`
  - `description`
  - `totalCapacity`
  - `acceptedCount`
  - `lifecycleStatus`
  - `chatLink`
  - `costContext`
- **Errors:** `AUTH_UNAUTHENTICATED`, `AUTH_FORBIDDEN_ROLE`, `TENANT_CONTEXT_MISSING`, `TENANT_SCOPE_FORBIDDEN`, `INTERNAL_ERROR`

### GET `/api/v2/tours/{tourId}`
- **Auth:** Authenticated (`member`/`owner`)
- **Request DTO:** path param `tourId`
- **Response (200):** same projection as list
- **Errors:** `AUTH_UNAUTHENTICATED`, `AUTH_FORBIDDEN_ROLE`, `TENANT_CONTEXT_MISSING`, `TENANT_SCOPE_FORBIDDEN`, `RESOURCE_NOT_FOUND`, `INTERNAL_ERROR`

### POST `/api/v2/tours`
- **Auth:** Authenticated (`owner`)
- **Request DTO:** `CreateTourDto`
  - `title`
  - `total_capacity`
  - `lifecycle_status` (`Draft` or `Open`; normalized to internal enum)
  - `description` (optional)
  - `chat_link` (optional)
  - `cost_context` (optional)
- **Response (201):** same camelCase projection as tour entity
- **Errors:** `VALIDATION_FAILED`, `AUTH_UNAUTHENTICATED`, `AUTH_FORBIDDEN_ROLE`, `TENANT_CONTEXT_MISSING`, `TENANT_SCOPE_FORBIDDEN`, `INTERNAL_ERROR`

### PATCH `/api/v2/tours/{tourId}`
- **Auth:** Authenticated (`owner`)
- **Request DTO:** `UpdateTourDto`
  - `title` (optional)
  - `total_capacity` (optional)
  - `lifecycle_status` (optional)
  - `description` (optional)
  - `chat_link` (optional)
  - `cost_context` (optional)
- **Response (200):** same camelCase projection as tour entity
- **Errors:** `VALIDATION_FAILED`, `AUTH_UNAUTHENTICATED`, `AUTH_FORBIDDEN_ROLE`, `TENANT_CONTEXT_MISSING`, `TENANT_SCOPE_FORBIDDEN`, `RESOURCE_NOT_FOUND`, `STATE_TRANSITION_INVALID`, `INTERNAL_ERROR`

### POST `/api/v2/registrations`
- **Auth:** Authenticated (`member`/`owner`)
- **Request DTO:** `CreateRegistrationDto`
  - `tenantId`
  - `tourId`
  - `participantFullName`
  - `participantContactPhone`
  - `transportMode` (`self_vehicle` | `group_vehicle` | `other`)
  - `entryMode` (`telegram` | `web`)
  - `telegramUserId` (conditional optional)
  - `telegramUsername` (optional)
  - `vehicleSeatCapacity` (optional)
  - `participantNote` (optional)
- **Response (201):** `RegistrationResponseDto`
  - `id`, `tenantId`, `tourId`
  - `participantFullName`, `participantContactPhone`
  - `transportMode`, `entryMode`
  - `telegramUserId`, `telegramUsername`
  - `vehicleSeatCapacity`, `participantNote`
  - `status`, `paymentStatus`, `paidAmount`
  - `createdAt`, `updatedAt`
- **Errors:** `VALIDATION_FAILED`, `VALIDATION_REQUIRED_FIELD_MISSING`, `VALIDATION_ENUM_INVALID`, `VALIDATION_FIELD_FORMAT_INVALID`, `VALIDATION_UNKNOWN_FIELD`, `AUTH_UNAUTHENTICATED`, `AUTH_FORBIDDEN_ROLE`, `TENANT_CONTEXT_MISSING`, `TENANT_CONTEXT_INVALID`, `TENANT_SCOPE_FORBIDDEN`, `TENANT_SCOPE_CONFLICT`, `REGISTRATION_DUPLICATE_ACTIVE`, `CAPACITY_FULL`, `INTERNAL_ERROR`

### GET `/api/v2/registrations/{registrationId}`
- **Auth:** Authenticated (`member`/`owner`)
- **Request DTO:** path param `registrationId`
- **Response (200):** `RegistrationResponseDto` (same projection as create response)
- **Errors:** `AUTH_UNAUTHENTICATED`, `AUTH_FORBIDDEN_ROLE`, `TENANT_CONTEXT_MISSING`, `TENANT_CONTEXT_INVALID`, `TENANT_SCOPE_FORBIDDEN`, `RESOURCE_NOT_FOUND`, `INTERNAL_ERROR`

### PATCH `/api/v2/registrations/{registrationId}/status`
- **Auth:** Authenticated (`owner`)
- **Request DTO:** `UpdateRegistrationStatusDto`
  - `targetStatus` (`Pending` | `Accepted` | `Rejected` | `Cancelled` | `NoShow`)
- **Response (200):** `RegistrationResponseDto`
- **Errors:** `VALIDATION_FAILED`, `VALIDATION_ENUM_INVALID`, `AUTH_UNAUTHENTICATED`, `AUTH_FORBIDDEN_ROLE`, `TENANT_CONTEXT_MISSING`, `TENANT_CONTEXT_INVALID`, `TENANT_SCOPE_FORBIDDEN`, `RESOURCE_NOT_FOUND`, `STATE_TRANSITION_INVALID`, `CAPACITY_FULL`, `INTERNAL_ERROR`

### PATCH `/api/v2/registrations/{registrationId}/payment`
- **Auth:** Authenticated (`owner`)
- **Request DTO:** `UpdateRegistrationPaymentDto`
  - `paymentStatus` (`NotPaid` | `Partial` | `Paid`)
  - `paidAmount` (optional)
- **Response (200):** `RegistrationResponseDto`
- **Errors:** `VALIDATION_FAILED`, `VALIDATION_ENUM_INVALID`, `VALIDATION_FIELD_FORMAT_INVALID`, `AUTH_UNAUTHENTICATED`, `AUTH_FORBIDDEN_ROLE`, `TENANT_CONTEXT_MISSING`, `TENANT_CONTEXT_INVALID`, `TENANT_SCOPE_FORBIDDEN`, `RESOURCE_NOT_FOUND`, `PAYMENT_STATUS_TRANSITION_INVALID`, `INTERNAL_ERROR`

### POST `/api/v2/waitlist-items`
- **Auth:** Authenticated (`member`/`owner`)
- **Request DTO:** `CreateWaitlistItemDto`
  - `tenantId`
  - `tourId`
  - `participantFullName`
  - `participantContactPhone`
  - `transportMode` (`self_vehicle` | `group_vehicle` | `other`)
  - `entryMode` (`telegram` | `web`)
  - `telegramUserId` (conditional optional)
  - `telegramUsername` (optional)
- **Response (201):** `WaitlistItemResponseDto`
  - `id`, `tenantId`, `tourId`
  - `participantFullName`, `participantContactPhone`
  - `transportMode`, `entryMode`
  - `status`, `conversionReason`, `cancelReason`
  - `createdAt`, `updatedAt`
- **Errors:** `VALIDATION_FAILED`, `VALIDATION_REQUIRED_FIELD_MISSING`, `VALIDATION_ENUM_INVALID`, `VALIDATION_FIELD_FORMAT_INVALID`, `VALIDATION_UNKNOWN_FIELD`, `AUTH_UNAUTHENTICATED`, `AUTH_FORBIDDEN_ROLE`, `TENANT_CONTEXT_MISSING`, `TENANT_CONTEXT_INVALID`, `TENANT_SCOPE_FORBIDDEN`, `TENANT_SCOPE_CONFLICT`, `REGISTRATION_DUPLICATE_ACTIVE`, `WAITLIST_CONFLICT_ACTIVE_RECORD`, `RESOURCE_NOT_FOUND`, `INTERNAL_ERROR`

### POST `/api/v2/waitlist-items/{waitlistItemId}/convert`
- **Auth:** Authenticated (`owner`)
- **Request DTO:** `ConvertWaitlistItemDto`
  - `conversionReason` (optional)
- **Response (200):** `WaitlistItemResponseDto`
- **Errors:** `VALIDATION_FAILED`, `VALIDATION_FIELD_FORMAT_INVALID`, `AUTH_UNAUTHENTICATED`, `AUTH_FORBIDDEN_ROLE`, `TENANT_CONTEXT_MISSING`, `TENANT_CONTEXT_INVALID`, `TENANT_SCOPE_FORBIDDEN`, `RESOURCE_NOT_FOUND`, `STATE_TRANSITION_INVALID`, `WAITLIST_CONFLICT_ACTIVE_RECORD`, `CONCURRENCY_CONFLICT`, `INTERNAL_ERROR`

### PATCH `/api/v2/waitlist-items/{waitlistItemId}/cancel`
- **Auth:** Authenticated (`member`/`owner`)
- **Request DTO:** `CancelWaitlistItemDto`
  - `cancelReason` (optional)
- **Response (200):** `WaitlistItemResponseDto`
- **Errors:** `VALIDATION_FAILED`, `VALIDATION_FIELD_FORMAT_INVALID`, `AUTH_UNAUTHENTICATED`, `AUTH_FORBIDDEN_ROLE`, `TENANT_CONTEXT_MISSING`, `TENANT_CONTEXT_INVALID`, `TENANT_SCOPE_FORBIDDEN`, `RESOURCE_NOT_FOUND`, `STATE_TRANSITION_INVALID`, `CONCURRENCY_CONFLICT`, `INTERNAL_ERROR`

### POST `/api/v2/workspaces/{tenantId}/invites`
- **Auth:** Authenticated (`owner`/`admin`)
- **Request DTO:** `CreateWorkspaceInviteDto`
  - `email`
  - `role` (`admin` | `member` | `viewer`)
- **Response (201):** `WorkspaceInviteResponseDto`
  - `id`, `tenant_id`, `email`, `role`, `invite_link`, `expires_at`
- **Errors:** `VALIDATION_FAILED`, `OWNER_ROLE_INVITE_FORBIDDEN`, `AUTH_UNAUTHENTICATED`, `AUTH_FORBIDDEN_ROLE`, `TENANT_SCOPE_FORBIDDEN`, `INTERNAL_ERROR`
- **Notes:** `owner` role is restricted and cannot be assigned through invites.

### POST `/api/v2/invites/accept`
- **Auth:** Authenticated
- **Request DTO:** `AcceptWorkspaceInviteDto`
  - `token`
- **Response (200):** `AcceptWorkspaceInviteResponseDto`
  - `tenant_id`, `role`
- **Errors:** `VALIDATION_FAILED`, `INVITE_NOT_FOUND`, `INVITE_EXPIRED`, `INVITE_EMAIL_MISMATCH`, `OWNER_ROLE_INVITE_FORBIDDEN`, `AUTH_UNAUTHENTICATED`, `INTERNAL_ERROR`

### POST `/api/v2/workspaces/{tenantId}/ownership-transfer`
- **Auth:** Authenticated (`owner`)
- **Request DTO:** `TransferWorkspaceOwnershipDto`
  - `newOwnerUserId` (UUID of existing active member in the same tenant)
- **Response (200):** `TransferWorkspaceOwnershipResponseDto`
  - `tenant_id`, `previous_owner_user_id`, `new_owner_user_id`
- **Errors:** `VALIDATION_FAILED`, `OWNER_ONLY_TRANSFER`, `OWNER_TRANSFER_SELF_FORBIDDEN`, `OWNER_ALREADY_ASSIGNED`, `TENANT_SCOPE_FORBIDDEN`, `RESOURCE_NOT_FOUND`, `AUTH_UNAUTHENTICATED`, `INTERNAL_ERROR`

## Changelog

- 2026-04-29: Promoted Registrations/Waitlist/Payment endpoints from future contract set to base implemented contract set after runtime alignment review.
