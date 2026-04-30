Document-ID: MKT-DOC-LEADER-APP-DELTA-ANALYSIS
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Leader-Centric Delta Analysis

## 1. Document Goal

This document defines the exact product delta between the archived marketplace model and the active leader-centric model.

It does not re-analyze solved operational problems. It preserves validated archive findings and only updates model-dependent assumptions.

---

## 2. What Changed

### Previous model (archived)

- Shared marketplace-style experience
- User journey often starts from browsing tours across multiple leaders

### Current model (active)

- Leader-centric workspace model
- Each leader operates in an isolated management context
- Participant entry is leader-owned (Telegram link, direct web link, leader channels)

---

## 3. What Remains Valid from Archive

The following remain valid and authoritative unless explicitly replaced:

- Leader pain-point analysis
- Registration lifecycle and status management
- Capacity source-of-truth and accepted-count behavior
- Waitlist FIFO logic and conversion behavior
- Payment tracking approach in MVP (manual recording, no gateway dependency)
- Telegram link visibility rules tied to accepted registrations

---

## 4. Locked Delta Decisions (Canonical)

### DEC-DELTA-001: Leader-Centric Product Model

The active product is leader-centric, not global marketplace-discovery-centric.

Implication:
- Global cross-leader browsing is removed from active scope.
- Core UX is organized around leader workspace operations.

### DEC-DELTA-002: Shared Multi-Tenant Runtime for MVP

The MVP uses a shared platform with strict tenant isolation (`leader_id` / `tenant_id`) rather than separate infrastructure per leader.

Implication:
- Faster implementation and lower ops complexity
- Mandatory tenant-scoped access control in all business paths

### DEC-DELTA-003: Dual-Mode Access is Mandatory

The product must operate in:

- Telegram Mini App mode
- Standalone web mode

Implication:
- Same business core, different entry and identity context
- No parallel product forks

### DEC-DELTA-004: Mode-Aware Identity Policy

Identity policy is channel-aware:

- If journey starts in Telegram Mini App, Telegram identity is mandatory.
- If journey starts on standalone web, registration may continue without Telegram.
- Web users must have a clear post-registration `Connect Telegram` action.

Implication:
- Identity continuity is supported without blocking standalone entry.

### DEC-DELTA-005: Archive Reuse-First Migration Rule

Archive sections are reused by default unless they explicitly rely on global marketplace discovery assumptions.

Implication:
- Re-documentation is delta-based, not full rewrite.

---

## 5. Identity and Authentication Baseline

### Telegram Mini App Mode

- Client sends Telegram init payload to backend.
- Backend validates signature and recency before trust.
- Session is created in tenant context.

### Standalone Web Mode

- User can register/login without Telegram.
- Linking action must be visible and available after onboarding.
- Features that require Telegram identity can remain gated until linking.

---

## 6. Impacted Documentation Areas

### Must rewrite

- Product framing sections describing marketplace-wide discovery
- IA/screen sections requiring global cross-leader listing
- Entry assumptions that do not separate Telegram and standalone contexts

### Must keep/edit

- Leader operation and pain-resolution sections
- Domain rules for registration, capacity, waitlist, and payment tracking
- MVP simplification principles and phased growth posture

---

## 7. Risks Introduced by the Delta

1. Identity fragmentation between web and Telegram accounts
2. Data leakage if tenant scoping is inconsistently enforced
3. UX confusion if mode-specific capabilities are not clearly communicated
4. Documentation drift if legacy marketplace assumptions are copied forward

---

## 8. Mitigation Guidelines

- Define one canonical linking path for web-to-Telegram account association.
- Apply tenant constraints in API, query, and UI layers.
- Add mode-aware labels and capability hints in UX copy.
- Require every rewritten section to cite the specific delta reason.

---

## 9. Delta Acceptance Criteria

The delta is correctly integrated when:

- Active docs contain no dependency on global cross-leader discovery.
- Mode-aware identity rules are explicitly documented and consistent.
- Reused archive logic is traceable and unmodified unless required.
- In-scope and out-of-scope boundaries are clear for the leader-centric MVP.
