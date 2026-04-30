Document-ID: MKT-DOC-MVP-SCOPE-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# MVP Scope v2

## 1. MVP Philosophy

MVP focuses on solving leader operational pain with the smallest reliable feature set.
It prioritizes clarity, speed, and maintainability over full automation.

---

## 2. In Scope (MVP)

## 2.1 Leader-Centric Workspace

- Tenant-scoped leader operations
- Leader-owned participant entry context

## 2.2 Dual-Mode Runtime

- Telegram Mini App mode support
- Standalone web mode support
- Shared business core across both modes

## 2.3 Tour and Registration Core

- Tour creation and lifecycle management
- Registration state management (`Pending`, `Accepted`, `Rejected`, `Cancelled`, `NoShow`)
- Duplicate active registration prevention

## 2.4 Capacity and Waitlist

- Tour-level capacity source of truth
- Accepted-only capacity consumption
- FIFO waitlist behavior
- Controlled waitlist-to-registration conversion

## 2.5 Payment Tracking (Operational)

- Manual payment state recording (`NotPaid`, `Partial`, `Paid`)
- Optional paid amount tracking
- Leader-facing payment visibility for reconciliation

## 2.6 Telegram Link Governance

- Leader-managed tour communication link
- Accepted-only participant access

---

## 3. Out of Scope (MVP)

- Global cross-leader marketplace browsing
- Recommendation/ranking discovery systems
- Full payment gateway integration and auto-settlement
- Advanced automated reminders and notification orchestration
- Complex financial accounting and wallet systems

---

## 4. Entry and Identity Rules

- Telegram entry requires Telegram identity validation.
- Web entry does not require Telegram upfront.
- Web users must have a clear `Connect Telegram` path after onboarding.

---

## 5. MVP Readiness Conditions

MVP is ready when:

- core flows are complete for one leader workspace
- status transitions are reliable and auditable
- capacity and waitlist rules are enforced
- payment tracking supports leader reconciliation workflows
- no active feature depends on global marketplace discovery
