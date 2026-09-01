# B4 — catalog tour id validation

`GET /denali/catalog/:tourId` validates persisted UUID shape in `getDenaliCatalogTour` before store lookup.

| Input                    | HTTP                            |
| ------------------------ | ------------------------------- |
| Valid published id       | `200` + card                    |
| Valid missing id         | `404 NOT_FOUND`                 |
| Malformed / non-UUID id  | `404 NOT_FOUND` (same envelope) |
| Unexpected store failure | `500 internal_error`            |

Implementation: `packages/workspaces/denali/src/catalog/is-persisted-catalog-tour-id.ts` + guard in `catalog.service.ts`.

Regression: `apps/api/test/denali-catalog-tour-id-contract.spec.ts`, `apps/marketing/test/fetch-catalog-tour.spec.ts`.
