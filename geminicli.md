# Enterprise Refactor Tasks: Tour-Equipment Decoupling

## Task 1: Server-Side Aggregation (BFF Layer)
- **Goal:** Resolve equipment names on the server to bypass client-side 403 errors.
- **File:** `apps/web/app/api/tours/[tourId]/equipment/route.ts`
- **Actions:**
  1. Implement a server-side resolver that fetches the Tour data first.
  2. Use internal BFF service calls (bypassing user-level RBAC) to fetch the Equipment Catalog (`/api/v2/settings/equipment`).
  3. Merge the Tour's `equipmentIds` with the Catalog data.
  4. Return a single aggregated JSON payload to the client.

## Task 2: Frontend Client Decoupling
- **Goal:** Remove dependency on Settings API from the UI layer.
- **File:** `apps/web/app/(app)/tours/[id]/tour-detail-client.tsx`
- **Actions:**
  1. Delete the standalone `useQuery` for `/api/tours/${tourId}/equipment`.
  2. Modify the main `tourQuery` to handle the new aggregated response structure.
  3. Clean up the component: remove `gearLists` lookup logic and legacy helper hooks.
  4. Update the JSX to consume `tourData.equipment` directly from the main tour object.

## Task 3: Security & Verification
- **Goal:** Ensure clean architecture and no "Settings" leakage.
- **Actions:**
  1. Audit `tour-detail-client.tsx` to ensure zero references to `/api/settings/`.
  2. Perform a network trace in the browser to confirm the 403 is gone and the response is 200 OK.
  3. Delete any orphaned files or unused hooks related to the old Equipment resolver.