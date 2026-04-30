# DOC_COMPLIANCE_REPORT

## 1) Documentation Sources

- `docs/20-architecture/contracts/api_endpoint_contracts_v2_base.md`
- `docs/20-architecture/contracts/api_endpoint_contracts_v2_future.md`
- `docs/20-architecture/contracts/error_response_taxonomy_v2.md`
- `docs/20-architecture/data_model.md`
- `docs/20-architecture/flows/registration.md`
- `docs/20-architecture/flows/waitlist.md`
- `docs/20-architecture/flows/capacity_management.md`
- `docs/20-architecture/contracts/participant_intake_schema.md`
- Swagger bootstrap/config:
  - `apps/api/src/main.ts`
  - `apps/api/src/modules/registrations/registrations.controller.ts`
  - `apps/api/src/modules/registrations/dto/*.ts`

## 2) Extracted Rules

- **Registration schema (docs):** status enum is `Pending|Accepted|Rejected|Cancelled|NoShow`; payment fields are `payment_status` and `paid_amount` with canonical statuses `NotPaid|Partial|Paid` (`data_model.md`).
- **Waitlist schema (docs):** status enum is `Waiting|Converted|Cancelled`; queue is FIFO (`data_model.md`, `waitlist.md`).
- **Registration flow:** only `Accepted` consumes capacity; if full, route to waitlist (`registration.md`, `capacity_management.md`).
- **Capacity rule:** full when `accepted_count >= total_capacity`; acceptance must guard capacity (`capacity_management.md`).
- **Error taxonomy:** canonical codes include `REGISTRATION_DUPLICATE_ACTIVE`, `CAPACITY_FULL`, `STATE_TRANSITION_INVALID`, `PAYMENT_STATUS_TRANSITION_INVALID` and does **not** include custom business codes outside this set (`error_response_taxonomy_v2.md`).
- **API contract status:** registrations/waitlist endpoints are still documented as **planned** in `api_endpoint_contracts_v2_future.md` (not finalized).

## 3) Code Findings

- `apps/api/src/modules/registrations/registration.entity.ts`
  - Adds payment lifecycle values beyond docs (`Refunded`, `Failed`) and `paymentMetadata`.
- `apps/api/src/modules/registrations/waitlist-item.entity.ts`
  - Contains waitlist status enum and internal promotion linkage.
- `apps/api/src/modules/registrations/registrations.service.ts`
  - Transactional create logic and status transition logic present.
  - Capacity check for acceptance is transactional.
  - Waitlist auto-promotion with FIFO + pessimistic lock + skip locked is implemented.
  - Internal payment state-machine method exists.
- `apps/api/src/modules/registrations/registrations.controller.ts` + DTOs
  - Public routes and schemas are present with Swagger decorators.

## 4) Drift Detected

### Drift A — Waitlist status value mismatch (fixed)
- **File/line:** `apps/api/src/modules/registrations/waitlist-item.entity.ts` (enum), `registrations.service.ts` (convert/promotion usage)
- **Expected (docs):** `Waiting|Converted|Cancelled`
- **Current (before fix):** used `Promoted`
- **Correction:** updated enum/usages to `Converted`.
- **Risk:** Low
- **Status:** Fixed automatically

### Drift B — Non-canonical error code for status transition (fixed)
- **File/line:** `apps/api/src/modules/registrations/registrations.service.ts` around `validateStatusTransition`, `apps/api/src/common/errors/global-exception.filter.ts` canonical set
- **Expected (docs):** use `STATE_TRANSITION_INVALID`
- **Current (before fix):** used `REGISTRATION_INVALID_STATUS_TRANSITION`
- **Correction:** changed to `STATE_TRANSITION_INVALID`; removed custom code from canonical set.
- **Risk:** Low
- **Status:** Fixed automatically

### Drift C — Payment lifecycle expanded beyond docs (manual review)
- **File/line:** `apps/api/src/modules/registrations/registration.entity.ts`
- **Expected (docs):** payment statuses `NotPaid|Partial|Paid`
- **Current:** includes `Refunded`, `Failed`, plus `paymentMetadata`
- **Recommended correction:** either (1) update docs/contracts first, then keep code; or (2) roll back extra statuses/field until docs explicitly define them.
- **Risk:** High (schema/behavior drift)
- **Status:** Report only (no auto-fix per policy)

### Drift D — Registration endpoints implemented while docs mark them planned (manual review)
- **File/line:** `apps/api/src/modules/registrations/registrations.controller.ts` vs `docs/20-architecture/contracts/api_endpoint_contracts_v2_future.md`
- **Expected (docs):** planned/not finalized
- **Current:** active implementation + Swagger exposure
- **Recommended correction:** either promote docs from future->base with finalized contract, or gate/remove runtime exposure until finalized.
- **Risk:** High (contract governance mismatch)
- **Status:** Report only

### Drift E — Accepted -> Rejected transition present in code (manual review)
- **File/line:** `apps/api/src/modules/registrations/registrations.service.ts` in `validateStatusTransition`
- **Expected (docs):** registration flow explicitly shows pending review outcome + accepted cancellation; accepted->rejected is not explicitly documented.
- **Current:** transition allowed.
- **Recommended correction:** clarify in docs first; then align code accordingly.
- **Risk:** Medium
- **Status:** Report only

### Drift F — Internal-only promotion linkage field not documented (manual review)
- **File/line:** `apps/api/src/modules/registrations/waitlist-item.entity.ts` (`promotedRegistrationId`)
- **Expected (docs):** waitlist schema does not mention linkage field
- **Current:** internal field present
- **Recommended correction:** document as internal data-model extension or remove if not needed.
- **Risk:** Medium (schema/documentation divergence)
- **Status:** Report only

## 5) Risk Level

- **Overall:** **Medium**
- **Rationale:** low-risk naming/taxonomy drifts were fixed; remaining drifts are mainly governance/schema-level and need explicit product/doc decision.

## 6) Proposed Fixes

### Applied Safe Auto-Fixes

1. Waitlist status normalization to documented `Converted`.
2. Error code normalization to canonical `STATE_TRANSITION_INVALID`.

### Manual Review Required (No Auto-Fix)

1. Payment lifecycle expansion (`Refunded`, `Failed`, `paymentMetadata`) vs current docs.
2. Registrations API published in code while docs keep it in planned/future contracts.
3. Accepted->Rejected status transition policy.
4. Internal waitlist linkage field documentation (`promotedRegistrationId`).

