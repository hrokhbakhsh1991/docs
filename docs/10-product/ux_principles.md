Document-ID: MKT-DOC-UX-PRINCIPLES-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# UX Principles v2

## 1. UX Objective

Provide a low-friction, high-clarity operational experience for leader-centric tour management across Telegram Mini App and standalone web.

---

## 2. Core Principles

## 2.1 Operational Clarity First

- Every critical action must have explicit status feedback.
- Leaders must understand current registration and payment state at a glance.

## 2.2 Status-Driven UX

- Registration and payment statuses are first-class interface elements.
- No hidden or inferred state transitions.

## 2.3 Role and Tenant Safety

- User interfaces must always reflect tenant context.
- Cross-tenant leakage must be impossible from UX affordances.

## 2.4 Dual-Mode Consistency

- Business behavior remains consistent across Telegram and web modes.
- Mode differences must be visible only where identity/channel rules differ.

## 2.5 Progressive Identity Linking

- Telegram mode: direct identity continuity from entry.
- Web mode: no hard block on onboarding; clear `Connect Telegram` progression.

## 2.6 Minimal Cognitive Load

- Keep primary screens focused on actions, statuses, and next steps.
- Avoid marketplace-like discovery complexity in leader workflows.

---

## 3. UX Guardrails

- Accepted-only communication link access
- Single source of truth for status labels
- Action confirmation for capacity-impacting changes
- Reconciliation-friendly dashboard summaries

---

## 4. Mobile-First Constraints

- Priority for fast and readable mobile layouts
- Interaction patterns optimized for messaging-to-app transitions
- Avoid dense desktop-only interaction assumptions
