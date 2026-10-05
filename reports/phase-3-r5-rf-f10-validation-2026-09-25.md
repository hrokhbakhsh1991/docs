# Phase 3 R5 — RF-F10 validation — 2026-09-25

## Scope

Historical finding: the Tour CASL policy is tenant-wide and does not add a
workspace/resource-level ACL.

## Current contract evidence

- `apps/api/src/casl/api-ability.ts` grants Tour access with `tenantId` scope.
- `apps/api/src/db/scoped-tour.repository.ts` applies the same tenant boundary
  to repository reads and writes.
- `Tour` persistence has no `workspaceId` boundary, and the current product
  contract defines Tour ownership by tenant rather than workspace/resource ACL.

## Classification

`false-positive / out-of-scope`

The absence of a workspace-level ACL is not a violation of the current Tour
contract. Adding one would require a new persistence boundary and behavior
change without evidence that the product requires it. No code change is made.
