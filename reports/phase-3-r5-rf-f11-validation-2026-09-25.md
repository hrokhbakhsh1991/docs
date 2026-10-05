# Phase 3 R5 — RF-F11 validation — 2026-09-25

## Scope

Historical finding: `InMemoryTourRepository` stores a `Tour` object by reference;
TypeScript `readonly` does not protect the in-memory persistence boundary at
runtime.

## Current-SHA evidence

- SHA: `6df212b29e00ef57370360a7f785e114d6465b30`
- Source: `apps/api/src/storage/in-memory-tour.repository.ts`
- `indexTour` stores the supplied object directly in `byId`.
- `getById` returns that same object directly.
- A controlled `tsx` probe created a tour, replaced `created.canonical`, then
  read the row again and observed the replacement (`wrapperFrozen=false`,
  `loadedTitle="mutated"`).

## Classification

`confirmed-gap`

This is an in-memory persistence-integrity gap. It does not demonstrate a
production database mutation path, but it violates the repository contract and
can bypass the validation boundary in API tests or memory-backed runtime.

## Bounded remediation

Normalize the canonical document at the repository write boundary with the
existing `createCanonicalDocument` contract. This deep-clones and freezes the
canonical data without adding a new utility, endpoint, state machine, or
schema change. Add regression coverage for both top-level replacement and
nested mutation through a returned record.

## Implementation evidence

- `apps/api/src/storage/in-memory-tour.repository.ts` now normalizes every
  stored Tour through the existing `createCanonicalDocument` contract and
  freezes the returned Tour wrapper.
- `apps/api/src/storage/in-memory-tour.repository.spec.ts` covers top-level
  replacement and nested mutation attempts.
- Repository test: `7/7 PASS`.
- API TypeScript check: `pnpm --filter @apps/api exec tsc --noEmit` — PASS.

## Exit evidence required

- repository regression tests pass;
- a returned record cannot mutate the stored canonical document;
- existing API canonical write tests remain green;
- `git diff --check` and Phase 3 guards remain green.
