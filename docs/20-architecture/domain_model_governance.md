# Domain Model Governance

This document records **source-of-truth ordering** and **change rules** for shared domains so engineering changes stay aligned across contracts, backends, shared packages, and the web app.

---

## Tour Domain Source of Truth

Tour shape and field names are owned by the **API contract** first. Downstream layers must mirror that contract unless an explicit, documented exception applies (see **Alias rule** below).

### Priority order (highest → lowest)

1. **API contract (primary source of truth)**  
   Path: `docs/20-architecture/contracts/api_endpoint_contracts_v2_base.md`  
   Defines the canonical tour projection for MVP (fields, semantics, and wire naming for public/authenticated tour reads and related flows).

2. **Backend DTO**  
   `TourResponseDto` (Nest / Swagger), generated and maintained alongside `apps/api/openapi.json`.  
   The serialized JSON for tour reads must match the contract projection (camelCase response fields as documented).

3. **Shared types**  
   `packages/types/src/tour.ts` (`@repo/types`)  
   Should mirror `TourResponseDto` / OpenAPI so monorepo consumers share one typed view of the contract.

4. **Frontend mappers**  
   `apps/web/lib/mappers/tour.mapper.ts`  
   Normalizes raw HTTP JSON into the client tour model; must not invent fields that are absent from the contract.

5. **UI form schemas**  
   `apps/web/src/components/tours/tour-schema.ts`  
   Describes **form-local** inputs (including UI-only status tokens). Form payloads must still map to contract-backed create/update bodies; they are not a parallel source of truth for persisted tour columns.

### Propagation rule

**Tour fields must originate in the API contract and propagate downward** to backend DTOs, shared types, and frontend mappers. When the product adds or renames a tour field, update the contract first, then align the ORM/entity layer, `TourResponseDto`, OpenAPI, `@repo/types`, and `mapTourResponseToDto` in that order.

### Warning (schema drift)

**Directly adding new Tour fields in the UI without updating the API contract is not allowed.**  
If a field is needed for display or forms, it must be justified in the contract (or explicitly scoped as client-only and non-persisted in product docs). Otherwise, UI-only fields risk silent divergence from production APIs and E2E expectations.

### Alias rule (`chatLink` vs `communicationLink`)

| Layer | Name |
|--------|------|
| **API contract & JSON response** | `chatLink` |
| **UI / forms (legacy compatibility)** | `communicationLink` |

The **canonical** persisted and documented field is **`chatLink`**. The frontend may expose **`communicationLink`** as a **mapper-maintained alias** on the client model for form controls and existing components, but new code should prefer **`chatLink`** when reading API-shaped objects. The alias exists for **form compatibility**; it does not change the contract: servers and OpenAPI remain **`chatLink`**.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-05-04 | Initial file: Tour domain source-of-truth stack, propagation rule, UI drift warning, `chatLink` / `communicationLink` alias. |
