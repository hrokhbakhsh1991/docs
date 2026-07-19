# Final hostile architecture score — finance platform

```yaml
score_id: FINANCE_HOSTILE_ARCHITECTURE_SCORE
version: "1.0"
date: "2026-07-19"
method: synthesize prior hostile audits only (no new redesign)
decision_context: stay in monorepo (extraction decision A)
```

## One-line rank

**Strong modular monolith with a mature finance plugin seam** — closer to “plugin architecture inside a monolith” than to microservices. Not extraction-ready; not ops-complete.

---

## Scorecard (hostile, 0–100)

| Dimension | Score | Hostile reading |
| --------- | ----: | --------------- |
| **Modularity** | **82** | Clear engine / host / workspace / infra layers; frozen public API; Option C ports |
| **Workspace independence** | **68** | Policy/CoA/reaction/ops plug in; booking/HTTP/schema/boot still Denali-shaped host |
| **Domain isolation** | **78** | Payment vs ledger boundary documented; engine has no Prisma; **ledger plans unvalidated** |
| **Operational maturity** | **42** | Strong TX/idempotency tests; **alerts/SRE dashboards missing**; ownership mapped but gaps |
| **Scalability** (types × tenants) | **74** | 50 types OK for registries; O(N) package.json + static imports strain; RLS multi-tenant OK |
| **Maintainability** | **76** | Codegen + guards + kits; linear human onboard; adapter honor-system for money |
| **Extraction necessity** | **28** | Internal freeze READY; publish/extract **not** required for current single-host product |

**Composite (equal weights):** **64 / 100**

**Composite (product-correctness weighted\*):** **71 / 100**  
\*weights: modularity 1.2, domain 1.2, workspace 1.0, maintainability 1.0, scale 0.9, ops 0.8, extraction necessity inverted as “readiness to extract” 0.5 → still mid-60s if ops penalized harder.

---

## Dimension notes (evidence pointers)

| Dimension | Evidence basis |
| --------- | -------------- |
| Modularity | finance-core freeze; Host Integration Kit; 13 ports; no Prisma in core |
| Workspace independence | Capability maturity + onboarding lifecycle; shared booking/HTTP/singletons |
| Domain isolation | PAYMENT-LEDGER-BOUNDARY; Option C; domain correctness audit (adapter P0s) |
| Operational maturity | Hostile production readiness **FAIL** on alerts; ownership doc |
| Scalability | 10-WS sim + capability 5→50; tenant isolation PASS (Prisma) |
| Maintainability | Codegen completeness; manual deps; ws3–ws6 proofs |
| Extraction necessity | Extraction decision **A**; hostile external host blocked without registry |

---

## Comparison to reference styles

| Style | Fit to current finance | Why |
| ----- | ---------------------- | --- |
| **Strong modular monolith** | **Best match (primary)** | One deployable API; shared DB/RLS; in-process ports; packages as modules |
| **Plugin architecture** | **Strong secondary match** | Manifest → codegen → workspace adapters for ledger/receipt/CoA/reaction/ops |
| **Microservice architecture** | **Poor match / not what you built** | No separate finance deployable, no independent finance DB, no network boundary, extraction deferred |

```text
Microservice ←———————●————————————→ Modular monolith
                      ↑
                 You are here:
                 modular monolith
                 + finance plugins
```

| Claim | Realistic? |
| ----- | ---------- |
| “We have finance microservices” | **No** |
| “We have a pluginized finance domain in a modular monolith” | **Yes** |
| “Workspaces are fully independent finance products” | **No** — shared booking/schema/HTTP/host |
| “We must extract finance-core to scale” | **No** — evidence says stay; extract is optional packaging later |

---

## Rank statement

Among common architecture labels, this ranks as:

1. **Strong modular monolith** — accurate operational and deployment reality  
2. **with embedded plugin architecture** — accurate for workspace finance capabilities  
3. **not a microservice** — and should not be scored against microservice maturity (network isolation, independent release, separate datastores)

Hostile grade vs the **best label** (modular monolith + plugins):

| Bar | Grade |
| --- | ----- |
| Module boundaries / engine purity | **A−** |
| Plugin enablement (manifest/codegen) | **A−** |
| Multi-tenant isolation (Prisma) | **A−** |
| Multi-workspace product parity | **B−** |
| Production SRE/ops | **D+** |
| Extraction / published package | **C** (intentionally incomplete) |

**Overall hostile rank:** **B− / solid modular monolith** — high correctness scaffolding, incomplete operational hardening, low extraction pressure.

---

## What would move the score

| To raise… | Without claiming microservices |
| --------- | ------------------------------ |
| Ops (42→70+) | Alerts, SRE dashboards, incident runbook (ownership already assigned) |
| Workspace independence (68→80+) | Ops/reaction parity automation; reduce Denali-only HTTP assumption |
| Domain isolation (78→90+) | Conformance checks on ledger plans (governance, not redesign) |
| Extraction necessity (28→…) | Only if a second host **needs** registry — not required for rank |

---

## Final answer

**Where does this architecture realistically rank?**

As a **strong modular monolith with a real finance plugin seam** — roughly **top-quartile modularity**, **mid-pack workspace productization**, **bottom-quartile SRE maturity** for a payments-adjacent system, and **low necessity to extract**.

It does **not** rank as a microservice architecture. Judged fairly against modular monolith + plugins, the hostile composite **~64** (or **~71** if correctness is weighted over ops) is earned: the platform boundary is frozen and workable; production ops and adapter governance are the remaining glass jaw.

---

## Source audits

| Doc | Feeds |
| --- | ----- |
| `FINANCE_CORE_INTERNAL_FREEZE.md` | Modularity / extraction |
| `FINANCE_CORE_EXTRACTION_DECISION.md` | Extraction necessity = A |
| `FINANCE_CAPABILITY_SYSTEM_MATURITY.md` | Plugins / scale |
| `FINANCE_10_WORKSPACE_CONCURRENT_SIM.md` | Independence limits |
| `FINANCE_HOSTILE_DOMAIN_CORRECTNESS.md` | Domain isolation risk |
| `FINANCE_HOSTILE_TENANT_ISOLATION.md` | Multi-tenant |
| `FINANCE_HOSTILE_PRODUCTION_READINESS.md` | Ops |
| `FINANCE_OPERATIONAL_OWNERSHIP.md` | Who owns prod |
| `FINANCE_HOST_INTEGRATION_KIT.md` | Host vs core |
