# Finance capability system maturity audit

```yaml
audit_id: FINANCE_CAPABILITY_SYSTEM_MATURITY
version: "1.0"
date: "2026-07-19"
question: Can finance evolve from 5 workspaces to 50 without architecture changes?
```

---

## Executive answer

| Layer | Mature for 5→50 without arch change? |
| ----- | ------------------------------------ |
| Manifest schema + codegen registries | **Yes** |
| Runtime capability gate + dependency resolve | **Yes** |
| Host wire (package.json, ops parity, HTTP owner, adapter QA) | **No — operational scale limit**, not a new architecture |

**Verdict:** The **capability architecture** (manifest → generated bindings → fail-closed resolve) can carry **~50** finance workspace types without redesign. Reaching 50 **production-equal** workspaces is blocked by **linear human/host costs** and **uneven optional surfaces**, not by missing registry primitives.

---

## 1. Manifest maturity

| Field | Required for `supported: true`? | Maturity | Notes |
| ----- | ------------------------------- | -------- | ----- |
| `supported` | Yes (entry flag) | **High** | Drives capability + nav codegen |
| `defaultModuleEnabledWhenUnset` | Optional (boolean) | **High** | Theme empty-modules default via generated set |
| `ledgerPolicy` | **Yes** (with receipt) | **High** | module+export; codegen factories |
| `receiptDefaults` | **Yes** (with ledger) | **High** | Paired validation in codegen |
| `chartOfAccounts` | **Yes** when ledger declared | **High** | Phase 1.10 enforced |
| `eventReaction` | Optional | **Medium** | Common for fixtures; HostIo asymmetry (Denali vs others) |
| `opsManifest` | Optional | **Medium** | Full ops UI only when present; many fixtures omit |
| `registryOnly` | Must not combine with `supported: true` | **High** | Codegen rejects illegal combo |
| `tourWrite.workspaceTypeExport` | **Yes** if supported | **High** | Weird coupling but enforced |

### Gaps (not schema holes — product unevenness)

- Ops and reactions are **optional** → 50 types can be API-capable with **sparse** ops/reaction parity.  
- No manifest field for booking adapter (platform-forced) — intentional.  
- No manifest field for HTTP finance routes (Denali-owned today).

---

## 2. Codegen maturity

### Completeness (finance domain generators)

| Generator | Output | Covers |
| --------- | ------ | ------ |
| `generateWorkspaceFinanceBindings` | API capability + default-enable set | supported / defaultModule |
| `generateWorkspaceFinanceDependencyBindings` | ledger + receipt factories | composition |
| `generateWorkspaceFinanceChartOfAccountsBindings` | CoA map | accounting labels |
| `generateWorkspaceFinanceEventReactionBindings` | reaction + `requiresHostIo` | TourCreated path |
| `generateWorkspaceFinanceNavBindings` | web nav plugin ids | hub visibility |
| `generateWorkspaceFinanceOpsBindings` | web ops manifests | panels (subset) |

### Generated ownership

| Rule | Status |
| ---- | ------ |
| `AUTO-GENERATED … DO NOT EDIT` banner | Present |
| `--check` freshness in guards | Present (phase/certification paths) |
| Hand registries must not hardcode WS ids | Proven by ws3–ws6 specs |

### Drift risks

| Risk | Severity | Mechanism |
| ---- | -------- | --------- |
| Edit generated files by hand | High | Mitigated by `--check` / CI if always run |
| Manifest change without regen | High | Runtime missing binding / stale nav |
| `apps/api` / `apps/web` missing `workspace:*` dep | High | Codegen emits imports → **install/build fail** |
| Package export path `/host/finance` mismatch | High | Static import break |
| `prebuild` filter list omits new WS packages | Medium | Stale dist until full install build |
| Alias sanitization of workspace ids in ops imports | Low | Odd ids still work via replace |

**Completeness score:** Core finance capability codegen is **complete** for composition + gate + nav + optional ops/reaction. Drift is **process**-bound, not missing generators.

---

## 3. Runtime maturity

### Capability resolution

```text
tenantId → workspaceType + theme
  → isFinanceSupportedWorkspace(type)     // generated
  → isFinanceModuleEnabled(theme, type)   // theme modules + default-when-unset
  → resolveFinanceWorkspaceDependencies(type)  // ledger + receipt (+ platform booking)
  → createFinanceService(…)
```

Also: CoA / reaction registries resolve by type; ops by pluginId when bound.

### Failure behavior

| Condition | Error |
| --------- | ----- |
| Unknown / unsupported type | `FINANCE_WORKSPACE_UNSUPPORTED` |
| Module disabled | `FORBIDDEN_FINANCE_MODULE_DISABLED` |
| Missing dependency registration | `FINANCE_*_UNSUPPORTED` / dependencies unsupported |
| Missing event reaction | `FINANCE_EVENT_REACTION_UNSUPPORTED` |
| Missing ops binding | throw / host renders null panels (nav may still show) |

### Missing capability handling

| Missing piece | Behavior |
| ------------- | -------- |
| No `opsManifest` | Nav can show; panels empty — **soft** |
| No `eventReaction` | Reaction resolve fails if worker calls it — **hard** for that path |
| No api package.json dep | Build/codegen consumer break — **hard** |
| Ledger plan invalid | Often **silent money bug** (no engine validate) — correctness gap, not capability gap |

**Runtime score:** Fail-closed for **support + module + deps**. Soft-fail / uneven for **ops**. Correctness of ledger content is **outside** capability system.

---

## 4. Can 5 → 50 happen without architecture changes?

### What does **not** need redesign

| Concern | Why 50 works on current arch |
| ------- | ---------------------------- |
| Registry maps / Sets | O(1) lookup by type; 50 entries trivial |
| `FinanceService` cache | ≤50 instances; policies per type |
| Shared repo + booking + RLS | Tenant isolation model unchanged |
| Manifest → codegen pipeline | Same generators |
| Gate errors | Same codes |

### Blockers (to operating 50 well — not new boxes on the diagram)

| Blocker | Kind |
| ------- | ---- |
| **O(N) manual `apps/api/package.json` deps** | Process / tooling |
| **O(N) `apps/web` deps** when opsManifest used | Process / tooling |
| **O(N) adapter authoring + invariant honor** (domain audit P0) | Quality / governance |
| **HTTP finance route ownership** still Denali-centric | Product assumption |
| **Ops/reaction parity** optional → 50 unequal “finance” products | Product maturity |
| **Monitoring/alerts** gap × N tenants/types | Ops readiness |
| **Static import graph size** (api/web bundles all WS finance modules) | Soft performance limit |

### Scaling limits (approximate, evidence-based)

| Dimension | Comfortable | Strain before arch change |
| --------- | ----------- | ------------------------- |
| Codegen map size | 50–100+ | Not the bottleneck |
| Process service cache | 50 | Fine |
| Human onboard (deps + adapters + regen) | ~5–15 | **Painful at 50** without automation of package.json / scaffold |
| Bundle of static workspace imports | Dozens | May need lazy/dynamic import **later** (that would be an arch/tooling change) |
| Shared booking/schema | Unlimited types | Breaks only if a type needs different booking port (manifest cannot express) |

### Acceptable tradeoffs (keep current arch)

1. **One booking adapter / one finance schema** for all types — plugins only for ledger/receipt/CoA/reaction/ops.  
2. **Ops manifest optional** — some types API-only.  
3. **Fail-closed** unknown type rather than soft fallback to Denali.  
4. **Manual package.json** until automated — known P2 debt; acceptable short-term, costly at 50.  
5. **Denali HTTP registration** shared by all types in this monorepo.  
6. **Adapter-trusted ledger plans** — document + review instead of engine validation (risk accepted unless governance added).

---

## 5. Maturity scorecard

| Area | Score /5 | Comment |
| ---- | -------: | ------- |
| Manifest coverage | 4 | Core complete; ops/reaction optional by design |
| Codegen completeness | 5 | All finance surfaces generated |
| Drift control | 4 | Strong if CI `--check`; weak if skipped |
| Runtime fail-closed | 5 | Support/module/deps |
| Ops/reaction uniformity | 2 | Uneven across fixtures vs Denali |
| Host wire automation | 2 | package.json linear |
| 5→50 arch readiness | **4** | Registry yes; factory floor no |

---

## 6. Return summary

### Blockers (for “50 first-class finance workspaces”)

1. Linear **host dependency** declaration (api ± web).  
2. Linear **high-quality adapters** without engine ledger guards.  
3. Optional **ops/reaction** → product inequality.  
4. **HTTP** still assuming a Denali (or single) route owner.  
5. **Ops monitoring** not capability-scaled.

### Scaling limits

- **Architecture (registries/gate/composition):** not limiting at 50.  
- **Tooling/process:** limiting.  
- **Bundle/static imports:** soft limit; may force lazy-load later.  
- **Divergent booking/persistence per type:** **would** require architecture change (not expressible today).

### Acceptable tradeoffs

- Plugin model (policy/CoA/reaction/ops) on shared host finance engine.  
- Shared RLS schema.  
- Fail-closed capability.  
- Incomplete ops UI for some types.  
- Manual wire until automated — if headcount accepts cost.

### Direct answer

**Yes — finance can evolve from 5 to 50 workspace types without changing the capability architecture** (manifest fields, codegen ownership, runtime resolve/fail-closed).

**No — not without changing how humans wire and govern those 50** (deps automation, adapter conformance, ops parity expectations). That is scaling of **operations and product completeness**, not a new capability subsystem.

---

## Related

| Doc | Role |
| --- | ---- |
| [`FINANCE_WORKSPACE_ONBOARDING_LIFECYCLE.md`](./FINANCE_WORKSPACE_ONBOARDING_LIFECYCLE.md) | Human checklist |
| [`FINANCE_10_WORKSPACE_CONCURRENT_SIM.md`](./FINANCE_10_WORKSPACE_CONCURRENT_SIM.md) | Concurrent host shape |
| [`FINANCE_HOSTILE_DOMAIN_CORRECTNESS.md`](./FINANCE_HOSTILE_DOMAIN_CORRECTNESS.md) | Adapter invariant risk |
| `scripts/codegen/workspace-registry/domains/finance.mjs` | Codegen SoT |
