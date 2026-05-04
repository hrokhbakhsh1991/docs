# Leader Workspace Endpoint Stub

This file is a **temporary stub** until backend aggregation endpoints are shipped.

## Proposed Endpoint

- `GET /api/v2/dashboard/leader-workspace`

## High-Level Response Shape (Draft)

```json
{
  "kpi": {
    "total_registrations": 0,
    "pending_count": 0,
    "approved_count": 0,
    "rejected_count": 0
  },
  "totals": {
    "tours_loaded": 0,
    "rows_loaded": 0
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 0,
    "has_more": false
  }
}
```

## Expected Statuses

- `200` success with aggregate payload
- `400` invalid query/filter parameters

## TODO

- TODO: Finalize request query params (`status`, `from`, `to`, `search`, `page`, `limit`)
- TODO: Confirm canonical KPI naming with product/domain docs
- TODO: Add tenant-scope/auth requirements and error body examples
- TODO: Add OpenAPI schema refs once endpoint is implemented
