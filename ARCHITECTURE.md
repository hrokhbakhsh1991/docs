# Denali Architectural Manifesto

## ⚠️ ARCHITECTURAL COMPLIANCE WARNING

This project follows a strict **Self-Guarding** architecture. Any code that violates the following principles will be considered **Architectural Decay** and must be refactored immediately.

**Do not** introduce branching logic (`if` / `switch` on workspace profiles) without consulting the **WorkspaceStrategyRegistry**.

---

## 1. Core Principles

### Contract-First

Every financial data point must be validated against schemas in `@repo/shared-contracts/finance`. **No raw DTOs for money.**

### Strategy over Branching

Workspace variance is handled via **WorkspaceStrategyRegistry**. Hardcoding `if (profile === '...')` in business logic is **strictly prohibited**.

### Strict Enforcement

Financial mutations (Payments, Ledger) must pass schema validation before persisting. **No** `warn-and-continue` patterns in production.

---

## 2. How to Contribute

| Task | Requirement |
|------|-------------|
| **Adding a workspace?** | Register a new class implementing `IWorkspaceStrategy`. |
| **Adding a field?** | Define a schema in `@repo/shared-contracts` first. |
| **Adding a mutation?** | Run it through the contract enforcement gate. |

---

## 3. Architectural Decay Threshold

**If you find yourself adding a new condition to a service file, STOP.** You are likely missing a Strategy entry.

**If you bypass the `enforcePaymentIntentFinanceContract` gate, you are introducing technical debt.**

---

*This document is the law of the repository. When in doubt, align with these principles before shipping.*
