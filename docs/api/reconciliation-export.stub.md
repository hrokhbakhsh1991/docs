# Reconciliation Export Endpoint Stub

This file is a **temporary stub** until reconciliation export API is implemented.

## Proposed Endpoint

- `GET /api/v2/reconciliation/export.csv`

## High-Level Response Shape (Draft)

- Content type: `text/csv`
- Suggested columns:
  - `registration_id`
  - `tour_id`
  - `participant_name`
  - `registration_status`
  - `payment_status`
  - `paid_amount`
  - `updated_at`

For JSON error payloads (non-200), use the common error envelope.

## Expected Statuses

- `200` CSV stream generated successfully
- `400` invalid filter/date range parameters

## TODO

- TODO: Confirm CSV column contract with operations/reconciliation consumers
- TODO: Define date range + status filters in query params
- TODO: Define idempotency/snapshot guarantees for consistent exports
- TODO: Add OpenAPI operation and schema references when endpoint is shipped
