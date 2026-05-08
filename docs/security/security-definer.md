# SECURITY DEFINER Inventory And Guardrails

This document tracks active `SECURITY DEFINER` usage and the runtime alternatives used for bootstrap/auth flows.

## Active State

- **Active runtime `SECURITY DEFINER` functions:** none.
- Legacy helper functions remain in historical migrations for reproducibility, but runtime paths no longer depend on executing them.

## Runtime Flows Replacing Definer Helpers

### Public tour bootstrap (registration/waitlist)

- **Path:** `TenantBootstrapService.resolveTenantFromTourId`
- **Tables touched:** `tours` (read-only)
- **Mechanism:** `runWithoutTenantBinding("public_tour_bootstrap_lookup", ...)` + strict suppressed-mode SQL allow-list
- **Why this is acceptable:** single read query, no mutation, explicit reason-scoped suppression

### Workspace listing for auth/session switch

- **Path:** `TenantManagementDbService.listUserWorkspacesForAuth`
- **Tables touched:** `user_tenants`, `tenants` (read-only join)
- **Mechanism:** tightly scoped transaction-local `SET LOCAL row_security = off` around one explicit query
- **Controls:** user-scoped input (`p_user_id` equivalent in app layer), no dynamic SQL, operation-specific logging

### Invite acceptance

- **Path:** `TenantManagementDbService.acceptWorkspaceInviteByToken`
- **Tables touched:** `workspace_invites` (read/delete), `user_tenants` (upsert)
- **Mechanism:** tightly scoped transaction-local `SET LOCAL row_security = off` around one explicit mutation flow
- **Controls:** token/email checks, owner-role rejection, no dynamic SQL, operation-specific logging

## Review Checklist For Future Changes

- Prefer Normal mode + RLS-respecting queries first.
- Use suppressed mode only for bootstrap/public pre-tenant reads and keep reason-specific allow-lists minimal.
- If bypassing RLS is unavoidable, keep SQL operation-specific and short (no generic callback executors).
- No dynamic SQL for privileged paths.
- Keep all privileged paths covered by regression/security tests and documented in this file.
