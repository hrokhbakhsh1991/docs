# Troubleshooting Playbook

Document-ID: MKT-DOC-OPS-TROUBLESHOOTING
Version: v1.0
Status: Active
Owner: Engineering Lead
Last-Updated: 2026-04-28
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

## 1. Purpose

Provide deterministic diagnosis and recovery steps for common local development and integration failures.

## 2. How to Use This Guide

For each issue:

1. match symptom
2. run diagnostics in order
3. apply safe fix
4. verify expected result
5. log `DOC-SYNC-*` if documentation mismatch is discovered

## 3. Common Issues

### Issue 01: Backend fails at startup due to missing env vars

- Symptom: startup aborts with configuration error.
- Likely cause: required variable missing or malformed.
- Diagnostics: compare local `.env` with `.env.example` and `environment_variables.md`.
- Fix: add missing values, correct invalid formats, restart service.
- Prevention: enable startup validation and keep `.env.example` current.

### Issue 02: Cross-tenant access unexpectedly allowed or denied

- Symptom: tenant-scoped endpoint behaves incorrectly.
- Likely cause: missing/incorrect tenant predicate or context resolution.
- Diagnostics: inspect endpoint tenant rule in authz matrix; reproduce with negative test.
- Fix: align implementation with fail-closed tenant invariants.
- Prevention: keep `SR-NFR-001` integration tests mandatory.

### Issue 03: Registration create returns duplicate-active conflict unexpectedly

- Symptom: `REGISTRATION_DUPLICATE_ACTIVE` for expected-valid request.
- Likely cause: stale active status data or idempotency replay mismatch.
- Diagnostics: inspect current registration statuses for `(user, tour)`.
- Fix: resolve stale active rows according to business rules.
- Prevention: keep uniqueness guards and cleanup scripts consistent.

### Issue 04: Capacity acceptance fails with `CAPACITY_FULL`

- Symptom: status transition to accepted is blocked.
- Likely cause: capacity counters inconsistent or truly full.
- Diagnostics: compare `accepted_count` vs `total_capacity`; inspect concurrent updates.
- Fix: reconcile counters and retry transition.
- Prevention: enforce transactional guards around acceptance updates.

### Issue 05: Waitlist conversion race produces conflicts

- Symptom: convert endpoint returns conflict/state errors under load.
- Likely cause: concurrent conversion attempts or stale queue position.
- Diagnostics: inspect waitlist item status and conversion logs.
- Fix: retry through idempotent path; enforce atomic conversion operation.
- Prevention: run deterministic concurrency integration tests.

### Issue 06: Participant cannot access communication link after acceptance

- Symptom: `permission_denied` on `S-PART-05` despite expected access.
- Likely cause: registration status not updated or tenant/auth mismatch.
- Diagnostics: verify registration status, tenant context, and auth session.
- Fix: correct status state and session context, then refresh eligibility.
- Prevention: keep `SR-FR-006` test coverage green.

### Issue 07: Payment update rejected with transition invalid

- Symptom: `PAYMENT_STATUS_TRANSITION_INVALID`.
- Likely cause: non-canonical status flow or invalid amount relation.
- Diagnostics: verify requested payment status and current record.
- Fix: apply valid transition and data constraints.
- Prevention: retain contract tests for payment transitions.

### Issue 08: Export fails with snapshot inconsistency

- Symptom: reconciliation export returns `EXPORT_SNAPSHOT_INCONSISTENT`.
- Likely cause: snapshot semantics violated during active writes.
- Diagnostics: check export request window and concurrent write operations.
- Fix: retry using consistent snapshot strategy.
- Prevention: preserve snapshot rules in export implementation.

### Issue 09: Telegram mode authentication fails

- Symptom: `AUTH_TELEGRAM_CONTEXT_REQUIRED`.
- Likely cause: missing/invalid Telegram context payload.
- Diagnostics: validate request payload fields and channel mode.
- Fix: re-init Telegram session and resend valid payload.
- Prevention: enforce mode-aware validation in client and backend.

### Issue 10: Web mode linking fails with tenant conflict

- Symptom: `TENANT_SCOPE_CONFLICT` during link flow.
- Likely cause: session tenant and linking target context mismatch.
- Diagnostics: inspect session tenant and asserted target scope.
- Fix: re-authenticate in correct tenant scope and retry linking.
- Prevention: keep tenant-context checks explicit in linking flow.

### Issue 11: Contract test failures on error envelope

- Symptom: envelope shape mismatch from expected schema.
- Likely cause: endpoint returning ad hoc error format.
- Diagnostics: compare endpoint response with canonical taxonomy envelope.
- Fix: normalize response to canonical `error` object.
- Prevention: run contract suite as merge-blocking gate.

### Issue 12: Local DB migration fails on existing data

- Symptom: migration works on empty DB but fails on populated DB.
- Likely cause: destructive change without expand/migrate/contract sequence.
- Diagnostics: inspect migration step and data assumptions.
- Fix: split migration into safe phased changes and rerun.
- Prevention: test on production-like dataset locally/staging.

### Issue 13: Seed script breaks after schema update

- Symptom: seed command fails due to missing/new required columns.
- Likely cause: seed logic not updated for latest schema.
- Diagnostics: compare seed payload with current schema.
- Fix: update seed and make rerun idempotent.
- Prevention: include seed validation in migration PR checklist.

### Issue 14: Slow local tests after dependency changes

- Symptom: major runtime increase in integration suite.
- Likely cause: heavy setup path, leaked state, or non-isolated tests.
- Diagnostics: profile longest tests and check fixture reset behavior.
- Fix: isolate expensive setup and cache deterministic fixtures.
- Prevention: enforce test runtime budget checks.

### Issue 15: Docs and implementation diverge

- Symptom: runtime behavior conflicts with active docs.
- Likely cause: code change not synchronized with docs.
- Diagnostics: compare changed behavior against contracts and flows.
- Fix: either align code to docs or raise approved doc update.
- Prevention: require doc updates in same PR as behavior changes.

## 4. Escalation Policy

Escalate to lead owner when:

- issue affects tenant safety
- issue affects auth identity boundaries
- issue requires destructive data operation
- issue cannot be resolved within one development cycle

## 5. Safety Warnings

- Do not run destructive data reset commands outside local environment.
- Do not bypass tenant fail-closed checks for convenience.
- Do not patch production-like data manually without approved runbook.
