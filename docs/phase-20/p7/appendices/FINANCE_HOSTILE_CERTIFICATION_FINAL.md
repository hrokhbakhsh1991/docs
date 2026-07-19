# Final hostile certification — finance platform

```yaml
cert_id: FINANCE_HOSTILE_CERTIFICATION_FINAL
version: "1.0"
date: "2026-07-19"
method: synthesize hostile audits only; no redesign
evidence_pack:
  - FINANCE_HOSTILE_ARCHITECTURE_SCORE.md
  - FINANCE_HOSTILE_ACCOUNTING.md
  - FINANCE_HOSTILE_SECURITY.md
  - FINANCE_HOSTILE_TENANT_ISOLATION.md
  - FINANCE_HOSTILE_TENANT_ISOLATION_ABC.md
  - FINANCE_HOSTILE_PROD_READINESS_HEAD.md
  - FINANCE_HOSTILE_PRODUCTION_READINESS.md
  - FINANCE_OPERATIONAL_READINESS_ENTERPRISE.md
  - FINANCE_CORE_EXTRACTION_DECISION.md
  - FINANCE_CORE_INTERNAL_FREEZE.md
  - FINANCE_CAPABILITY_SYSTEM_MATURITY.md
```

## Classification

**Platform** (internal modular-monolith finance platform with workspace plugins).

| Label | Fits? |
| ----- | ----- |
| Prototype | No — TX/idempotency/codegen past prototype |
| Product | Partial — Denali-shaped product surface exists; not all plugins are product-parity |
| **Platform** | **Yes** — engine + ports + host composition + multi-workspace plugin seam |
| Enterprise Platform | **No** — ops/alerts/consistency/security P0s block |

---

## Dimension scores (0–100)

| Dimension | Score | Basis |
| --------- | ----: | ----- |
| **Architecture** | **72** | Modular monolith + plugins; frozen core API; not microservices; extraction deferred by design |
| **Correctness** | **62** | Strong Prisma Option C TX + idempotency; P0 accounting holes (empty ledger skip, Paid without books, TourCreated∩capture, prepay enqueue ignore) |
| **Security** | **58** | RLS/tenant PASS; operator gates solid; **P0 member IDOR** on `POST /finance/receipts`; thin audit trail |
| **Operations** | **38** | One finance metric; no finance alerts/SLOs; no Paid↔ledger job; runbooks missing |
| **Maintainability** | **74** | Codegen, guards, kits, ws proofs, ownership matrix; linear onboard; adapter honor-system for money |

**Composite (equal weight):** **61 / 100**

---

## Readiness A–D

| Question | Ready? | Cert |
| -------- | ------ | ---- |
| **A) Enterprise production** | **NO** | Blocked |
| **B) 10 workspace deployment** | **CONDITIONAL** | Engine/plugin seam YES; product-parity / ops-per-type NO |
| **C) Internal platform reuse** | **YES** | Monorepo hosts + new workspace finance plugins |
| **D) Extraction** | **NO** | Decision **A** — keep monorepo; publish/extract not certified |

### A — Enterprise production

**FAIL.** Blockers remain (see below). Atomicity/idempotency alone do not certify enterprise.

### B — 10 workspace deployment

**Engine/registry: PASS** (capability maturity, ws fixtures, tenant→type composition).  
**As 10 enterprise customer products: FAIL** (shared booking/HTTP/schema; ops panels not universal; no per-type ops/SLO).  
**Certification for “10 plugins in one host process”:** YES for technical load of types.  
**Certification for “10 independent finance businesses”:** NO.

### C — Internal platform reuse

**PASS** for in-monorepo reuse: finance-core freeze READY, Host Integration Kit, workspace onboarding lifecycle, composition cache by `workspaceType`.

### D — Extraction

**FAIL / not pursued.** Packaging capable in hostile sim; registry publish blocked; extraction decision **A** — not ready and not required.

---

## Remaining blockers (only)

### Enterprise production (A) — must clear

1. **Ops:** finance metrics + paging alerts + Paid↔ledger consistency job + repair path + SLOs + incident runbook.  
2. **Accounting:** Paid/Approved (or prepay recorded) without ledger (empty lines / non-durable omit); prepay enqueue result ignored; TourCreated + capture double-credit risk.  
3. **Security:** member IDOR on `POST /finance/receipts` (no ownership check).

### 10 workspace deployment (B) — if claim = customer products

4. Product/ops parity not universal across types (e.g. ops panels / HTTP ownership gaps on some ws*).  
5. Same enterprise ops blockers as (A) amplified by `workspace_type` label needs.

### Extraction (D)

6. No public registry publish; `private: true`; host outbox/Prisma not in extractable surface; decision locks **keep monorepo**.

### Internal reuse (C)

**No blockers** for monorepo-internal new workspace finance plugins under current freeze + host kit.

---

## One-line cert

**Internal Platform: certified. Enterprise Platform: not certified. Ten-plugin host: technically deployable; ten enterprise products: not. Extraction: not certified.**
