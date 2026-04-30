Document-ID: MKT-DOC-ARCHIVE-MIGRATION-MAP
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Archive Migration Map

## Purpose

This document maps archived documentation to the active leader-centric model using four actions:

- `Keep`: Reuse as-is (only minor language cleanup if needed)
- `Edit`: Keep structure, update wording/terminology
- `Rewrite`: Rebuild section due to model change
- `Drop`: Remove from active scope

The only strategic delta is the shift from global marketplace discovery to leader-centric workspaces.

---

## File-Level Migration Map

| Archive File | Primary Action | Reason | Target Active Use |
|---|---|---|---|
| `marketplace_v1/project_overview` (non-local archive ref) | Edit + Rewrite (partial) | Core problem and domain are still valid, but product framing must move from cross-leader discovery to leader-centric entry | Baseline for updated context and product framing |
| `marketplace_v1/personas_and_usecases` (non-local archive ref) | Edit | Personas remain valid; use cases that depend on global browsing need wording changes | Reuse actor goals and operational scenarios |
| `marketplace_v1/requirements` (non-local archive ref) | Edit + Rewrite (partial) | Most operational requirements remain valid; marketplace-dependent assumptions need replacement with tenant-scoped equivalents | Source for active requirements normalization |
| `marketplace_v1/ux_principles` (non-local archive ref) | Keep | Principles are mostly channel-agnostic and operationally valid | Reuse UX guardrails |
| `marketplace_v1/screens_overview` (non-local archive ref) | Rewrite (partial) | Any global listing/discovery screens are no longer primary | Replace with leader-workspace IA |
| `marketplace_v1/mvp` (non-local archive ref) | Edit | MVP philosophy remains valid; scope phrasing must reflect leader-centric delivery | Source for MVP boundaries |
| `marketplace_v1/data_model_EN` (non-local archive ref) | Edit (light) | Core entities are valid; add explicit tenant-scoping constraints in active docs | Canonical model reference with tenant clarifications |
| `marketplace_v1/technical_spec` (non-local archive ref) | Edit + Rewrite (partial) | Technical baseline is useful; auth/entry assumptions must reflect dual-mode and tenant boundaries | Source for active technical constraints |
| `marketplace_v1/decisions_EN` (non-local archive ref) | Keep + Add decisions | Existing decisions stay; add delta decisions for leader-centric mode and dual-mode identity | Decision log continuity |
| `marketplace_v1/roadmap` (non-local archive ref) | Edit | Phasing remains useful; sequencing should prioritize leader-centric rollout | Execution planning reference |

---

## Flow-Level Migration Map

| Flow File | Primary Action | Reason | Active Status |
|---|---|---|---|
| `marketplace_v1/flows/registration_flow` (non-local archive ref) | Edit | Registration logic is valid; replace global-discovery entry assumptions with leader-owned entry links/channels | Reuse with entry-path updates |
| `marketplace_v1/flows/capacity_management_flow_EN` (non-local archive ref) | Keep | Capacity logic is independent from marketplace browsing model | Reuse as canonical capacity behavior |
| `marketplace_v1/flows/waitlist_flow` (non-local archive ref) | Keep | Waitlist FIFO and conversion rules remain valid in leader-centric model | Reuse as-is |
| `marketplace_v1/flows/cost_and_payment_flow` (non-local archive ref) | Edit | Payment tracking logic is valid; harmonize terminology with registration statuses (`Accepted` over mixed labels) | Reuse with terminology fixes |
| `marketplace_v1/flows/telegram_integration_flow` (non-local archive ref) | Edit + Add | Existing link visibility rules remain valid; add dual-mode identity/linking policy references | Reuse with dual-mode additions |

---

## Section-Level Delta Rules

Use this rule set when migrating any archived section:

1. If a section assumes users browse tours across all leaders, mark as `Rewrite`.
2. If a section describes leader operational pain and workflows, mark as `Keep` or `Edit`.
3. If a section depends on ambiguous role/status naming, mark as `Edit` and align to canonical terms.
4. If a section duplicates deferred/unsupported capabilities for MVP, mark as `Drop` or move to future notes.

---

## High-Impact Rewrite Targets

These areas must be rewritten in active docs:

- Product positioning and entry model (from marketplace discovery to leader workspace)
- Information architecture sections referencing global tour browsing
- Technical auth/entry assumptions (must include Telegram Mini App + standalone web)
- Identity model sections (must include Connect Telegram flow for web users)

---

## Safe Reuse Areas

These areas are reliable for direct reuse:

- Core pain-point analysis for leaders
- Registration status lifecycle logic
- Capacity source-of-truth rules
- Waitlist FIFO behavior and conversion hook
- Payment tracking as manual recording in MVP
- Telegram link visibility based on accepted registrations

---

## Migration Completion Criteria

Migration is complete when:

- No active document depends on global cross-leader tour discovery.
- All reused sections are explicitly tagged as `Keep` or `Edit`.
- Every rewritten section has a clear reason tied to the model delta.
- Terms are consistent across active docs: `leader workspace`, `tenant scope`, `dual-mode`, `account linking`.
