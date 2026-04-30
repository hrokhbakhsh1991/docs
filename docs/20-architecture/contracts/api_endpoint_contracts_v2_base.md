# API Endpoint Contracts v2 (Base)

Document-ID: MKT-DOC-API-ENDPOINT-CONTRACTS-V2-BASE  
Version: v1.0  
Status: Active  
Last-Updated: 2026-04-29

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

### POST `/api/v2/auth/web/session`
- **Auth:** Public
- **Request DTO:** `WebSessionDto`
  - `entry_mode`
  - `credential.email`
  - `credential.password`
  - `asserted_tenant_id` (optional)
- **Response (200):**
  - `session_token`
  - `user_id`
  - `tenant_id`
  - `entry_mode`
- **Errors:** `VALIDATION_FAILED`, `AUTH_UNAUTHENTICATED`, `TENANT_SCOPE_CONFLICT`, `TENANT_CONTEXT_MISSING`, `INTERNAL_ERROR`

### POST `/api/v2/auth/telegram/session`
- **Auth:** Public
- **Request DTO:** `TelegramSessionDto`
  - `entry_mode`
  - `telegram_init_payload`
  - `asserted_tenant_id` (optional)
- **Response (200):**
  - `session_token`
  - `user_id`
  - `tenant_id`
  - `entry_mode`
- **Errors:** `VALIDATION_FAILED`, `AUTH_TELEGRAM_CONTEXT_REQUIRED`, `TENANT_SCOPE_CONFLICT`, `TENANT_CONTEXT_MISSING`, `INTERNAL_ERROR`

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

## Changelog

- 2026-04-29: Promoted Registrations/Waitlist/Payment endpoints from future contract set to base implemented contract set after runtime alignment review.
