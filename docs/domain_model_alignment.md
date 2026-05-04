# Domain model alignment (frontend)

The maintained copy of this document lives here:

**[`docs/20-frontend/domain_model_alignment.md`](./20-frontend/domain_model_alignment.md)**

Booking transitions wiki:

**[`docs/20-frontend/bookings-transition-alignment-report.md`](./20-frontend/bookings-transition-alignment-report.md)**

## Current Implementation vs MVP Endpoints

- Journeys **`J-L-02`** and **`J-L-05`** in product wireflows reference:
  - `GET /api/v2/dashboard/leader-workspace`
  - `GET /api/v2/reconciliation/export.csv`
- Current leader/review UI implementation is a temporary **frontend composition** path:
  - `getTours` + per-tour registrations fetch (`GET /api/v2/tours/{tourId}/registrations`)
  - CSV generation/export on client side
- This is an intentional short-term deviation until aggregation endpoints are shipped.
- **Traceability risk:** journey docs point to aggregated endpoints while runtime FE behavior composes multiple calls; this can create mismatch in QA evidence and contract audits.
- **TODO:** **Switch to backend aggregation endpoints when shipped.**
