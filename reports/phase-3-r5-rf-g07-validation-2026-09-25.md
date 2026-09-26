# Phase 3 R5 — RF-G07 validation — 2026-09-25

## Finding

Cross-tenant and integration tests use the in-memory repository and therefore
do not prove Postgres/RLS behavior.

## Current evidence

- `apps/api/test/test-helpers.ts` deliberately constructs an in-memory
  repository for fast API tests.
- `apps/api/src/storage/create-tour-storage.ts` explicitly documents memory as
  a test/dev adapter and rejects it in production mode.
- `apps/api/src/storage/prisma-tour.repository.ts` is the production adapter.
- The Phase 3 documents define RLS/Postgres runtime proof as a Phase 4
  obligation and label the in-memory canonical store scaffold-only until then.

## Classification

`false-positive / intentional phase boundary`

This is a coverage limitation that is already acknowledged and bounded by the
phase contract, not an untracked Phase 3 regression. No Phase 3 code change is
made. The Postgres/RLS proof remains an explicit Phase 4 entry requirement.
