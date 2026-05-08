# Bootstrap Flows Architecture

This document describes pre-tenant/bootstrap behavior after tenant-binding hardening.

## Modes

- **Normal mode:** default request mode. DB tenant binding (`app.tenant_id`) is mandatory before tenant-scoped queries.
- **Suppressed mode:** entered only via `runWithoutTenantBinding(reason, fn)`. This mode is explicit and tightly allow-listed.

Suppressed mode is used only for pre-tenant bootstrap where no trustworthy tenant context exists yet.

## Public Registration Bootstrap

Flow:

1. Request arrives on public endpoints (`/tours/:id/register`, `/tours/:id/waitlist`) without JWT tenant context.
2. `TenantBootstrapService.resolveTenantFromTourId()` runs in:
   - `runWithoutTenantBinding("public_tour_bootstrap_lookup", ...)`
3. The service performs one explicit read-only query on `tours` (`id -> tenant_id`) constrained by the suppressed-mode allow-list.
4. Application continues with explicit tenant-aware logic using the resolved tenant id.

## Workspace/Auth Bootstrap

- Workspace listing for auth/session switch uses `TenantManagementDbService.listUserWorkspacesForAuth`.
- Invite acceptance uses `TenantManagementDbService.acceptWorkspaceInviteByToken`.
- Both use a transaction-local `SET LOCAL row_security = off` around small, explicit SQL blocks instead of generic privileged wrappers.
- Constraints are enforced in TypeScript (user/token/email/role checks), and the privileged path is operation-specific and logged.

## Review Expectations

- Any new bootstrap flow must first attempt Normal mode with explicit tenant context.
- If impossible, use suppressed mode with the smallest possible allow-listed SQL.
- Introduce SECURITY DEFINER only when there is no safe RLS-respecting or controlled app-layer alternative.
- Every privileged flow change (suppressed mode or RLS bypass) requires security regression tests and doc updates.
