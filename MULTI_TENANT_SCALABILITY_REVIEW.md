# MULTI_TENANT_SCALABILITY_REVIEW

```yaml
audit_id: MULTI_TENANT_SCALABILITY_REVIEW
role: SaaS Platform Architect
date: "2026-07-20"
scenario:
  - new workspace product: Snow Leopard
  - ~100 additional tenant customers
  - divergent business rules + workflows per product/tenant
method: architecture + runtime composition + package inventory (no implementation)
```

## Executive verdict

**The platform’s target architecture can scale. The current implementation will not — not for Snow Leopard as a peer product, and not for 100 heterogeneous customers.**

| Dimension | Target claim | Reality today | Collapse trigger |
| --------- | ------------ | ------------- | ---------------- |
| New workspace | Config + package, zero app forks | **Engineering clone of Denali** + host wiring + CERT | Second enterprise product |
| N tenants same product | Ops provision + theme modules | Mostly OK if Denali-certified + RLS fixed | ~100 Denali clones — **infra/ops**, not package count |
| Divergent rules | Capability grades + adapters | Grades exist; **Denali hardcoding** in core paths | Rules that don’t fit graded modes |
| Isolation | Plugin + RLS | Plugin yes; **RLS holes** + shared pools | Hostile / noisy neighbor |
| Customization | Manifest authority | Manifest + **codegen maps** + **copy-paste workspaces** | Combinatorial package explosion |

**Bottom line:**  
- **100 customers on Denali** = capacity/ops/RLS/outbox problem (scalable *in kind* if hardened).  
- **Snow Leopard + different workflows** = **product engineering**, not configuration — architecture collapses if you pretend otherwise.

---

## 1. Mental model (what actually scales)

```text
                    ┌─────────────────────────────────────┐
                    │  Platform apps (api/web/portal/…)     │
                    │  Behavior + HTTP + RLS + outbox        │
                    └───────────────┬───────────────────────┘
                                    │ generated loaders / ports
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
   workspace=denali          workspace=urban            workspace=snow-leopard
   (~7.5MB package)          (~1.1MB, stub CERT)        (does not exist)
          │                         │                         │
          └──────── tenant rows (workspaceType) + theme.modules ─┘
```

**Two different axes people confuse:**

| Axis | Unit | Cost to add 100 |
| ---- | ---- | --------------- |
| **A — Tenant (customer)** | Row in `tenants` + domains + entitlements | Low *if* same `workspaceType` |
| **B — Workspace (product skin + rules)** | `packages/workspaces/<id>` + adapters + CERT + codegen | High — weeks each at Denali depth |

Snow Leopard is **axis B**. “100 more customers” is mostly **axis A** *only if* they share a certified workspace type.

---

## 2. Workspace isolation — what works, what doesn’t

### Works (directionally)

- Runtime composition keyed by `workspaceType` (booking/finance registries), not by scattering `if (tenantId === …)` for product logic in the happy path.
- Shared DB + `withTenantRls` + FORCE RLS on many money/booking tables.
- Process-wide platform ports (booking payments, finance repo) intentionally **not** “first workspace wins” (`lazy-finance-service.ts`).

### Does not isolate / will not scale cleanly

| Gap | Why it collapses at 100+ / multi-product |
| --- | ---------------------------------------- |
| **Tables without RLS** (`urban_registrations`, `users`, `tenant_domains`, …) | One buggy query = cross-customer blast |
| **Shared Postgres pool + advisory locks** | Noisy-neighbor capacity/approve contention across tenants |
| **Global outbox claim** (admin, `ORDER BY created_at`) | One tenant’s event flood delays all |
| **Static `DEV_TENANTS` / smoke UUIDs** | Mental model and seeds still Denali-centric |
| **Only `denali` production-certified** | Snow Leopard cannot be provisioned in prod until CERT — not a flip of a flag |

**Collapse mode:** “Multi-tenant SaaS” becomes “one hard product + N rows” until CERT and RLS are peer-complete. Second product without CERT is a **fork of operations**, not multi-tenant maturity.

---

## 3. Capability system — power and ceiling

### What exists

Graded claims (booking/finance):

- `supported` = product enablement gate only  
- `capabilities.*.mode` = executable depth (`create-pipeline`, `booking-owned`, `host-lifecycle`, `none`, …)  
- Runtime asserts adapter presence matches claims (`assertBookingRuntimeCapabilityLevels`)

This is the **right abstraction** for “same platform, different rule depth.”

### Where it collapses

1. **Mode enum is closed.** Snow Leopard needs a workflow not in `{create-pipeline, booking-owned, host-lifecycle, in-process, durable-outbox, …}` → either expand platform (core change) or **fake** with Denali-shaped adapters (lie).

2. **Option A reactions off** on Denali/booking-ws2 (`eventReaction.enabled: false`). “Supported booking” ≠ event-driven enterprise workflow. Customers needing durable side effects don’t get them from capability stamps alone.

3. **Authz is not capability-driven.** Booking ops = `admin|owner` string check. Fine-grained “Snow Leopard leader can approve but not refund” is **not** in the capability matrix — it will be hardcoded or over-permissioned.

4. **Tenant entitlements are thin.** Theme `enabledModules` toggles finance/booking modules; it does not express per-tenant workflow variants inside one workspace type. 100 customers with “almost Denali but step 3 different” → pressure to **fork workspace types** (package explosion) or **branch in Denali** (god package).

**Collapse mode:** Capability system scales **depth of known modes**, not **arbitrary BPM**. Different workflows beyond the enum force platform PRs or Denali forks.

---

## 4. Customization strategy — config vs code (honest)

| Customization need | Config today? | Reality |
| ------------------ | ------------- | ------- |
| Brand colors / CSS | Partial (theme, skins) | Yes-ish |
| Enable booking/finance module | Theme modules + manifest `supported` | Yes |
| Capacity / validation policy | Workspace adapters | **Code** in workspace package |
| Wizard fields / publish gates | Manifest + Denali-specific core branches | **Code + platform ifs** |
| Guest portal IA | Manifest L3/L4 | Code + CERT |
| Commerce defaults | Still `workspaceType === "denali"` in places | **Hardcoded** |
| New HTTP surface | Manifest `http` + package handlers | Code + codegen + often host `package.json` |
| Production onboard | `productionTier: certified` | Only Denali |

Architecture docs say “zero platform code changes.” Architecture docs also admit:

> Today: Step 8 fails if workspace needs urban-style API guards or Denali-style web imports.

**Snow Leopard tomorrow:** not YAML. Expect:

1. `workspace:create`  
2. Hand-written adapters (booking/finance/catalog/wizard)  
3. Likely **copy large Denali slices** (7.5MB gravity well vs booking-ws2 164KB fixture)  
4. `generate:workspace-registry`  
5. Host dependency wiring (finance onboarding lifecycle still human)  
6. L3/L4 + CERT  
7. Fight residual `=== "denali"` branches in `apps/api` / `apps/web`

---

## 5. Duplicated workspace code — combinatorial bomb

Current inventory:

| Package | ~Size | Role |
| ------- | ----- | ---- |
| `denali` | **7.5MB** | Reference / only certified production product |
| `urban` | 1.1MB | Peer aspirant, **stub** CERT |
| `finance-ws2…6` | ~170–200KB each | **Registry fixtures**, not customers |
| `booking-ws2` | 164KB | Booking capability fixture |
| `starter` / `guest-club` | small | Scaffold / smoke |

**Collapse patterns:**

1. **Copy-Denali-to-Snow-Leopard** → two 7MB packages diverging; every platform bugfix × N.  
2. **Fixture workspace per capability experiment** (finance-ws*) → registry noise; codegen/import graphs grow; cognitive load for “which is real?”  
3. **Generated bindings** import every workspace host entry (`workspace-finance-dependency-bindings.generated.ts` style) → API bundle/boot cost grows with each package even if unused by live tenants.  
4. **Host `package.json` deps** still partly manual for finance — N workspaces = N wiring mistakes.

At 5 real products (Denali, Urban, Snow Leopard, +2), without extracting shared “tour-ops kit” libraries, the monorepo becomes a **fork farm**.

---

## 6. Tenant-specific logic — hardcoded gravity well

Evidence of **configuration leakage into platform**:

| Location | Pattern | Scalability hit |
| -------- | ------- | --------------- |
| `resolve-validation-mode.ts` | `workspaceType === "denali"` | New product needs core edit or wrong validation |
| `assert-tour-publish-lifecycle-gate.ts` | denali branches | Publish rules not fully manifest-driven |
| `apply-workspace-commerce-create-default.ts` | `isDenali` | Commerce defaults not registry-only |
| `canonical-validation-sync.ts` | denali special cases | Validation worker pool skips denali differently |
| `apps/web/.../read-wizard-draft-field-value.ts` | `pluginId === "denali"` | Admin UI not plugin-pure |
| `resolve-workspace-commerce-for-tenant.ts` | denali equality | Metadata path |
| `URBAN_TEST_WORKSPACE_TYPE` / smoke tenant UUIDs | env/test overrides | Prodlike confusion |
| `OPERATOR_DENALI_SMOKE_TENANT_ID` in storage | tenant UUID special case | Multi-tenant file/seed assumptions |

**Collapse mode:** Snow Leopard either:

- inherits Denali behavior via accidental `=== "denali"` misses, or  
- forces a wave of platform PRs for every rule difference (negates “plugin” story).

Guards (`guard-no-workspace-type-branches`) exist for some layers; **denali still appears in production api/web paths** — the covenant is incomplete.

---

## 7. Configuration vs hardcoded — decision matrix

```text
MUST stay configuration (tenant-level)
  - domains, branding, locale, module on/off, plan limits
  - feature flags / entitlements within a certified product

MUST stay workspace package code (product-level)
  - validation/capacity/ledger policies
  - catalog registration UX
  - skins / wizard field registry

MUST NOT be hardcoded in apps/* (today still is)
  - publish lifecycle quirks
  - commerce defaults
  - validation mode selection
  - wizard draft field reads

MUST stay platform (shared)
  - RLS, outbox, identity session, HTTP envelopes
  - capability *enums* and composition roots
```

Crossing these lines is where SaaS architecture dies: either **infinite packages** or **infinite `if (workspace)`**.

---

## 8. Where architecture collapses (ranked)

### C1 — Second product = second Denali (Snow Leopard)

**Collapse:** Treating Snow Leopard as “add manifest.”  
**Truth:** Peer product requires CERT + adapters + likely Denali-depth UI; only Denali is certified.  
**Symptom:** 6–12 month “config” project that is actually a fork.

### C2 — 100 tenants × divergent micro-workflows inside one type

**Collapse:** Encoding customer-specific steps in Denali with flags.  
**Truth:** Theme modules aren’t a workflow engine.  
**Symptom:** Unreadable Denali, regressions for all tenants, impossible CERT.

### C3 — Package-per-customer

**Collapse:** `workspace-customer-047` for each deal.  
**Truth:** Codegen + CI + host deps + CERT don’t scale linearly to 100 packages.  
**Symptom:** Hour-long generates, fragile deploys, no one knows which package is live.

### C4 — Shared data plane without tenant fairness

**Collapse:** Assuming RLS = multi-tenant SaaS done.  
**Truth:** Global outbox drain, shared pool, advisory locks, missing RLS tables.  
**Symptom:** One big customer starves others; security audit fails.

### C5 — Capability theater

**Collapse:** Shipping `supported: true` + Option A off as “enterprise ready.”  
**Truth:** Grades exist to *prevent* fake parity — then docs stamp LANDED.  
**Symptom:** Sales sells Denali-equivalent; ops discovers hollow reactions/finance.

### C6 — Platform denali branches never die

**Collapse:** Each new product adds `if (snow-leopard)`.  
**Truth:** Already denali/urban special cases in tours/canonical/web.  
**Symptom:** Plugin architecture becomes a museum exhibit.

### C7 — Production onboarding bottleneck

**Collapse:** Manual CERT + human host wiring + VPS bootstrap Denali seeds.  
**Truth:** `assertProductionCertifiedWorkspaceType`; finance lifecycle checklist; deploy identity bootstrap Denali-centric.  
**Symptom:** Cannot onboard customer #2 of a new type without eng+ops ceremony.

---

## 9. Scenario analysis

### Tomorrow: Snow Leopard workspace

| Question | Answer |
| -------- | ------ |
| Config only? | **No** |
| App fork? | **Should not** — but platform denali branches may force platform PRs |
| Workspace package? | **Yes, substantial** |
| Ready for enterprise provision? | **No** until CERT L3/L4 |
| Risk | Clone Denali → permanent dual maintenance |

### Tomorrow: +100 customers, **same** Denali product

| Question | Answer |
| -------- | ------ |
| Need 100 packages? | **No** |
| Need hardening? | **Yes** — RLS gaps, pool, outbox fairness, relay on, auth/sess_ver, deploy |
| Collapse risk | Infra/noisy neighbor + ops provision/domains — **not** workspace codegen |

### Tomorrow: +100 customers, **different** rules/workflows

| Question | Answer |
| -------- | ------ |
| Fit in one workspace type? | Only if differences ⊆ capability modes + theme entitlements |
| Otherwise? | Finite set of **product** workspaces (e.g. 3–5), never 100; or a real rules/workflow engine (not present) |
| Collapse risk | Highest — current architecture has **no** tenant-level BPM |

---

## 10. Scalability scorecard

| Area | Score /5 | Note |
| ---- | -------- | ---- |
| Tenant row isolation (intent) | 3 | RLS strong where present; holes elsewhere |
| Workspace plugin model | 4 | Directionally correct |
| Capability grading | 3 | Good enum; closed set; authz not included |
| Zero-fork new product | 1 | Docs aspirational; Denali gravity |
| Config-driven workflows | 1 | Not a workflow platform |
| Multi-product CERT | 1 | Single certified type |
| Codegen / registry at N=10 products | 2 | Works; costly; host wiring friction |
| Data-plane multi-tenant fairness | 2 | Shared claim/pool |
| Onboarding automation | 2 | Manual CERT + deploy seeds |

**Overall for stated scenario (Snow Leopard + 100 heterogeneous customers): 2/5 — will collapse without a deliberate product taxonomy.**

---

## 11. Architectural recommendations (guidance only — no implementation)

1. **Freeze product taxonomy:** e.g. max 3–5 certified workspace types; customers are tenants of those types — never packages.  
2. **Extract “tour-ops kit”** shared library from Denali; Snow Leopard composes kits + thin deltas — ban copy-paste 7MB forks.  
3. **Kill remaining `=== "denali"` in apps** before second product; enforce with CI on `apps/**`.  
4. **Extend capability model or refuse sales** for workflows outside modes — don’t stretch `supported: true`.  
5. **Tenant entitlements layer** (plan/features) separate from workspace type — for 100 customers on one product.  
6. **Data-plane SLOs:** per-tenant outbox quotas, pool budgets, RLS completeness (see DB audit).  
7. **CERT factory:** repeatable checklist + automated L3/L4 gates so Snow Leopard isn’t a year-long special.  
8. **Do not** create finance-ws7 style fixtures as a substitute for product strategy.

---

## 12. One-sentence answer

**100 Denali-like customers can scale if the data plane and ops harden; Snow Leopard and “different workflows” require real product packages and a closed capability taxonomy — configuring them like feature flags will collapse the architecture into Denali forks or platform `if` spaghetti.**

Architect, documentation status: **Updated**. Link to docs: [`MULTI_TENANT_SCALABILITY_REVIEW.md`](./MULTI_TENANT_SCALABILITY_REVIEW.md).
