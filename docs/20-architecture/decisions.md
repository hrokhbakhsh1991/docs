Document-ID: MKT-DOC-DECISIONS-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Decisions v2

## 1. Decision Governance

This file records canonical product and architecture decisions for active v2 docs.
When conflicts exist, this file and `docs/20-architecture/canonical_framework.md` are authoritative.

---

## 2. Key Decisions

## DEC-V2-001: Leader-Centric Product Boundary

Status: Accepted
Context / Problem:
- Archive-era wording allowed interpretation of global discovery as active behavior.
Decision Drivers:
- Preserve MVP scope clarity and avoid cross-leader assumptions.
Decision Outcome:
- Active product model is leader-centric.
- Global cross-leader marketplace discovery is out of current scope.
Consequences:
- Good: tighter scope and lower implementation risk.
- Bad: discovery use cases are deferred.
Supersedes / Superseded by:
- Supersedes archive marketplace-first framing.

## DEC-V2-002: Shared Multi-Tenant MVP Runtime

Status: Accepted
Context / Problem:
- Need low-complexity MVP runtime while keeping tenant safety.
Decision Drivers:
- Cost and delivery speed constraints.
Decision Outcome:
- Use shared runtime with strict tenant isolation.
- Avoid dedicated infra per leader in MVP.
Consequences:
- Good: faster rollout and simpler operations.
- Bad: stronger need for strict tenant guardrails.
Supersedes / Superseded by:
- N/A

## DEC-V2-003: Dual-Mode Access

Status: Accepted
Context / Problem:
- Entry channels are split between Telegram and standalone web.
Decision Drivers:
- Preserve one domain model and avoid product forks.
Decision Outcome:
- Support Telegram Mini App and standalone web.
- Keep one shared business core across both modes.
Consequences:
- Good: consistent behavior across channels.
- Bad: identity edge cases require explicit contracts.
Supersedes / Superseded by:
- N/A

## DEC-V2-004: Mode-Aware Identity Policy

Status: Accepted
Context / Problem:
- Telegram identity guarantees differ from web onboarding.
Decision Drivers:
- Enable web onboarding while preserving Telegram-required contexts.
Decision Outcome:
- Telegram mode requires Telegram identity.
- Web mode allows non-Telegram onboarding.
- Post-onboarding Telegram linking path availability is mandatory.
Consequences:
- Good: flexible entry without blocking onboarding.
- Bad: linking and mismatch cases need strict policy checks.
Supersedes / Superseded by:
- N/A

## DEC-V2-005: Capacity Canonical Rule

Status: Accepted
Context / Problem:
- Capacity state drift occurs if multiple statuses consume seats.
Decision Drivers:
- Deterministic occupancy and waitlist behavior.
Decision Outcome:
- Only `Accepted` registrations consume capacity.
- `accepted_count` and `total_capacity` remain source-of-truth.
Consequences:
- Good: deterministic guardrails for acceptance.
- Bad: conversion and race handling must be tested thoroughly.
Supersedes / Superseded by:
- N/A

## DEC-V2-006: Waitlist Simplicity for MVP

Status: Accepted
Context / Problem:
- Need predictable behavior under full-capacity conditions.
Decision Drivers:
- Operational simplicity and auditability.
Decision Outcome:
- FIFO waitlist logic.
- Controlled conversion to registration.
Consequences:
- Good: predictable queue processing.
- Bad: override scenarios require explicit policy constraints.
Supersedes / Superseded by:
- N/A

## DEC-V2-007: Payment Scope in MVP

Status: Accepted
Context / Problem:
- MVP needs payment visibility without full financial integration.
Decision Drivers:
- Scope control and implementation speed.
Decision Outcome:
- Operational payment tracking only (`NotPaid`, `Partial`, `Paid`).
- No payment gateway coupling in MVP.
Consequences:
- Good: lower implementation complexity.
- Bad: reconciliation consistency rules become critical.
Supersedes / Superseded by:
- N/A

## DEC-V2-008: Telegram as Communication Channel

Status: Accepted
Context / Problem:
- Telegram is communication infrastructure, not full business system.
Decision Drivers:
- Keep communication gating aligned with registration states.
Decision Outcome:
- Product complements messaging channels.
- Telegram link access is controlled by accepted registration state.
Consequences:
- Good: clear accepted-only access policy.
- Bad: mode-specific UX messaging must stay synchronized.
Supersedes / Superseded by:
- N/A

## DEC-V2-009: MVP Admin Operational Scope

Status: Accepted
Context / Problem:
- Admin-level wording drift risked implying broad cross-tenant operations in MVP.
Decision Drivers:
- Tenant boundary safety and release gating requirements.
Decision Outcome:
- MVP operational surfaces are single-tenant.
- Cross-tenant admin read/write/export is not permitted in MVP operational endpoints.
Consequences:
- Good: removes ambiguity for implementation and tests.
- Bad: cross-tenant admin capabilities are explicitly deferred.
Supersedes / Superseded by:
- N/A

## DEC-V2-010: ORM Selection for Backend

Status: Accepted
Context / Problem:
- Initial architecture drafts referenced a specific ORM implementation.
- Restricted network environments introduced reliability issues for ORM runtime dependencies that require external binary distribution.
Decision Drivers:
- Deterministic behavior in offline/restricted network environments.
- Preserve delivery reliability across dev, CI, and Docker.
Decision Outcome:
- Database access is implemented via an ORM abstraction layer.
- Current implementation: TypeORM.
- Core architecture remains unchanged.
Consequences:
- Good: database layer avoids external engine distribution constraints in restricted environments.
- Good: multi-tenant isolation, auditability, and RLS-aligned policies remain preserved.
- Bad: migration from previously referenced ORM-specific setup requires adapter-level refactoring.
Supersedes / Superseded by:
- Supersedes prior draft references to Prisma ORM as implementation choice.

---

## 3. Change Protocol

Any update affecting:
- status models
- tenant boundaries
- dual-mode identity policy
- capacity/waitlist behavior

must be recorded with a new `DEC-V2-XXX` entry.

Open backend decision dependencies:
- Final per-channel trusted tenant signal precedence (`CLAR-TNT-001`) is still pending confirmation.

---

## Changelog

- 2026-04-28: Added explicit MVP admin operational scope decision (`DEC-V2-009`) for backend consistency.
- 2026-04-28: Added note for pending tenant-precedence confirmation dependency (`CLAR-TNT-001`).
- 2026-04-29: Added ORM implementation decision (`DEC-V2-010`) to standardize on TypeORM under restricted network constraints.
