Document-ID: MKT-DOC-PRODUCT-OVERVIEW-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Product Overview v2

## 1. Product Direction

This product is a leader-centric management system for tour operations.
It replaces fragmented chat-based operations with structured workflows for registration, capacity, payment tracking, and participant control.

---

## 2. Problem Context

Leaders currently manage tours through unstructured messaging channels and manual payment confirmations.
Common issues include:

- fragmented participant information
- unclear payment verification state
- manual follow-ups for every change
- difficult reconciliation and reporting

This product addresses those operational failures through standardized, auditable workflows.

---

## 3. Target Operating Model

- One shared platform
- Isolated tenant workspace per leader
- Participant entry through leader-owned channels
- Dual-mode runtime:
  - Telegram Mini App mode
  - Standalone web mode

---

## 4. Core Value

For leaders:
- operational clarity
- reduced manual coordination overhead
- reliable status and payment visibility

For participants:
- predictable registration experience
- transparent status updates
- controlled access to communication links

---

## 5. Scope Shift from Archive

Archived assumption:
- global cross-leader tour browsing as a primary user journey

Active v2 assumption:
- leader workspace is primary context
- global discovery is out of current scope

The operational domain remains the same; only the product entry and workspace boundaries changed.

---

## 6. Functional Core

The active core includes:

- tour creation and lifecycle management
- registration lifecycle management
- capacity and waitlist management
- payment-proof-based tracking and verification
- Telegram link governance by registration state
- dashboard visibility for leader decisions

---

## 7. Identity Model

- Telegram mode requires Telegram identity.
- Web mode allows initial standalone usage.
- Web users can link Telegram after onboarding through a visible action.

This preserves channel flexibility while enabling identity continuity.

---

## 8. MVP Success Criteria

MVP succeeds when a leader can run end-to-end operations for a tour with:

- clean registration intake
- controlled accepted capacity
- clear payment state recording
- reproducible reconciliation output
- no dependence on global marketplace discovery
