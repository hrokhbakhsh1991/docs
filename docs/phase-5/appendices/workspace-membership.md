# Workspace membership gate (P0)

## Problem

Malformed `workspaceId` values must not reach tour persistence. Unregistered or expired workspace ids must not return **201**.

## Rules

1. **Format** — `parseTenantAuthContext` / `InvalidTenantAuthContextError` with `code: AUTH_SCOPE_ID_INVALID` → HTTP **401** (via `error-interceptor`).
2. **Registry miss** — Workspace ids matching stale dev patterns are rejected before route handlers:
   - Prefixes: `ws-expired-`, `ws-deleted-`, `ws-never-provisioned-`
   - Error: `WORKSPACE_INVALID` → HTTP **401** with `code` echo

Valid dev/test workspaces (`ws-1`, `ws-recovery-known`, product-specific `ws-*` probes) continue to pass when they match `AUTH_SCOPE_ID_PATTERN` and are not stale prefixes.

## Where enforced

`resolveTenantContextFromRequest` → `assertWorkspaceMembership(workspaceId)` after auth parse (headers, dev bearer, JWT).

## Verification

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory AUTH_ALLOW_DEV_BEARER=true \
  node --import tsx --test test/0-functional/tenant-error-recovery.spec.ts
```

## Phase 6+

Replace prefix heuristic with Postgres `workspace_memberships` or IdP claims when provisioning ships.
