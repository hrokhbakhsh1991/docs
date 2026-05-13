# 🗺️ Project Execution Guide: User Management & Accounting Refactor

This document serves as the canonical architectural guide and roadmap for evolving the Tour Management platform into a secure, multi-tenant financial system.

---

## 📅 Phased Roadmap

### Phase 1: Critical Fixes & Stabilization
**Goal:** Eliminate high-risk security gaps and harden tenant isolation.

| Task | Priority | Deliverable |
| :--- | :--- | :--- |
| **Server-Side Tenant Guard** | 🔴 Critical | Middleware to validate `tenantId` from JWT against all resources. |
| **Role Enum Migration** | 🔴 Critical | Strict TS Enum for all roles (Owner, Admin, Leader, Member). |
| **RBAC Synchronization** | 🟠 High | Synchronized CASL rules with server-side API guards. |
| **Concurrency Control** | 🟠 High | Versioning/ETags for user mutation endpoints. |

### Phase 2: Module Refactoring
**Goal:** Establish clean architectural boundaries and event-driven foundations.

| Task | Priority | Deliverable |
| :--- | :--- | :--- |
| **Finance Context Extraction** | 🟠 High | Decoupled `Finance` context (Payments, Invoices, Wallets). |
| **Domain Event Bus** | 🟡 Medium | Lightweight event system for critical state changes. |
| **Repository Pattern** | 🟡 Medium | Refactored services following DDD repository patterns. |
| **Pricing Snapshots** | 🟠 High | Immutable historical price capture on booking creation. |

### Phase 3: Feature Enhancement
**Goal:** Implementation of core financial and safety systems.

| Task | Priority | Deliverable |
| :--- | :--- | :--- |
| **Pricing Engine** | 🟠 High | Rule-based engine for dynamic/role-based discounts. |
| **Payment Integration** | 🟠 High | Gateway integration with idempotency key support. |
| **Safety Profiles** | 🟡 Medium | Encrypted Emergency/Medical sub-objects on users. |
| **Ledger System** | 🟠 High | Transactional ledger for user balances/credits. |

### Phase 4: Optimization & Cleanup
**Goal:** Finalize observability and sunset legacy code.

| Task | Priority | Deliverable |
| :--- | :--- | :--- |
| **Audit Trail UI** | 🟢 Low | Admin dashboard for historical activity logs. |
| **Performance Tuning** | 🟢 Low | Virtualized directory UI and optimized caching. |
| **Legacy Code Sunset** | 🟢 Low | Removal of all string-based magic role logic. |

---

## 🛠️ Detailed Technical Design

### 1. Auth & Identity Module
- **Responsibilities:** Manage authentication lifecycle, hydrate session/tenant context, enforce type-safe roles.
- **Interfaces:** 
  - *Input:* OTP Code, Session Cookie, JWT.
  - *Output:* `AuthUser` object (ID, Tenant, Role, Status).
- **Best Practices:** Use strict Enums; implement transparent refresh logic; validate JWT claims at the frontend boundary.

### 2. RBAC & Authorization (CASL)
- **Responsibilities:** Translate roles into CASL rules; provide consistent UI gating.
- **Interfaces:** 
  - *Input:* `AuthUser` object.
  - *Output:* CASL `Ability` instance.
- **Best Practices:** Share rule definitions between FE/BE via shared libs; implement "Graceful Denials" (Request Access flows).

### 3. User Management (Directory)
- **Responsibilities:** Tenant directory rendering; bulk role/suspension updates; activity monitoring.
- **Interfaces:** 
  - *Input:* Search/Filter/Sort params.
  - *Output:* Optimistically updated lists; success/error toasts.
- **Best Practices:** Move all filtering/sorting to server-side; implement Audit Log tabs in detail modals.

### 4. Tour Wizard & Creation
- **Responsibilities:** Multi-step form orchestration; business rule enforcement based on "Tour Profile".
- **Interfaces:** 
  - *Input:* `TourFormProfile`, Draft ID.
  - *Output:* Validated `TourDto`.
- **Best Practices:** Robust server-side draft saving; centralize visibility rules in a dedicated engine.

### 5. Registration & Booking
- **Responsibilities:** Handle tour sign-ups; manage waitlists; coordinate with Finance for payment linkage.
- **Interfaces:** 
  - *Input:* `tourId`, user data.
  - *Output:* `BookingDto`.
- **Best Practices:** Use a strict State Machine for status transitions; capture price snapshots at booking time.

---

## ⚠️ Dependency & Risk Analysis

### Fragile Points
| Module | Risk | Mitigation Strategy |
| :--- | :--- | :--- |
| **AuthContext** | Application-wide lockout | Use contract testing (Pact) between FE/BE. |
| **Ability Provider** | Privilege escalation | Implement comprehensive unit testing for all role mappings. |
| **Tenant Isolation** | Data leakage | Implement mandatory server-side middleware for all resource access. |
| **Wizard State** | Data loss / corruption | Implement real-time draft persistence and Zod schema validation. |

### Mitigation Summary
- **Feature Flags:** Decouple deployment from release for financial features.
- **Shadow Pricing:** Run new pricing logic in parallel with legacy for validation.
- **Idempotency Keys:** Ensure all payment/mutation requests are replay-safe.
- **Zod Boundary Checks:** Validate every API response shape at runtime.

---

## ✅ Phase 1 Execution Checklist
- [ ] Implement `tenantGuard` middleware on all API routes.
- [ ] Refactor `AuthUser` role type to `UserRole` Enum.
- [ ] Add `version` column to User and Booking tables.
- [ ] Mirror CASL permissions in backend `CanActivate` guards.
- [ ] Integrate optimistic update rollbacks in `users.service`.

---
*Blueprint generated on 2026-05-13. Ready for immediate implementation.*
