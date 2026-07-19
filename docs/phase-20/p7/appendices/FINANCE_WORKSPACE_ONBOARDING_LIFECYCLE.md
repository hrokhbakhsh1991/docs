# Finance workspace onboarding lifecycle audit

```yaml
audit_id: FINANCE_WORKSPACE_ONBOARDING_LIFECYCLE
version: "1.0"
date: "2026-07-19"
scenario: new workspace joins finance tomorrow
proof_baseline: finance-ws3 … finance-ws6 onboarding specs
redesign: none
```

**Goal:** Prove whether onboarding is **operationally repeatable**, and list every step that still needs a **human code (or host) change**.

---

## Verdict

| Claim | Result |
| ----- | ------ |
| Engine / gate / registry **drop-in** via package + manifest + codegen | **REPEATABLE** (proven ws3–ws6) |
| Full operator product (HTTP + nav + ops panels + events + tenant live) | **REPEATABLE with a fixed human checklist** — not zero-touch |
| Zero human code changes | **FALSE** — several host wiring steps remain mandatory |

---

## Lifecycle map

```text
┌─ INPUT (workspace package) ─────────────────────────────────────┐
│ 1. Create package under packages/workspaces/<id>/                 │
│ 2. Implement adapters (ledger, receipt, CoA, reaction[, ops])   │
│ 3. Declare workspace.manifest.json → workspaceFinance.*         │
│ 4. tourWrite.workspaceTypeExport (required by codegen)          │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─ CODEGEN / HOST WIRE ───────────────────────────────────────────┐
│ 5. pnpm install (workspace glob picks up package)                 │
│ 6. HUMAN: apps/api package.json += "@app-tour/workspace-<id>"   │
│ 7. HUMAN (if opsManifest): apps/web package.json += same        │
│ 8. Build workspace package                                        │
│ 9. pnpm run generate:workspace-registry                         │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─ RUNTIME ───────────────────────────────────────────────────────┐
│ 10. Tenant row workspaceType = <id>                             │
│ 11. resolveFinanceServiceForTenant → registry adapters          │
│ 12. Capability gate (supported + theme modules)                 │
│ 13. HTTP /finance/* (shared finance-http; see §HTTP)            │
│ 14. Nav (WORKSPACE_FINANCE_NAV_PLUGIN_IDS)                      │
│ 15. Ops panels (only if opsManifest bound)                      │
│ 16. Event reaction (generated binding + optional HostIo)        │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─ OPERATIONS ────────────────────────────────────────────────────┐
│ 17. Shared finance DB tables (no per-WS migration by default)   │
│ 18. Monitoring (platform gap — see hostile prod audit)          │
│ 19. Rollback = disable module / unsupported type fail-closed    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Input verification

### Required artifacts

| Artifact | Required? | Automated? | Notes |
| -------- | --------- | ---------- | ----- |
| Workspace package `packages/workspaces/<id>/` | **Yes** | Scaffold via `workspace:create` (partial) | Finance adapters are **hand-written** |
| `workspace.manifest.json` with `workspaceFinance.supported: true` | **Yes** | Human | Must include `ledgerPolicy` + `receiptDefaults` together |
| `tourWrite.workspaceTypeExport` | **Yes** | Human | Codegen refuses finance without it |
| Ledger policy adapter | **Yes** | Human | Implements `FinanceLedgerPolicyPort` |
| Receipt defaults adapter | **Yes** | Human | Implements `FinanceReceiptDefaultsPort` |
| Chart of accounts export | **Yes** (when ledger declared) | Human | Codegen Phase 1.10 requirement |
| Event reaction adapter | Optional but typical | Human | `requiresHostIo` true/false |
| `opsManifest` | Optional for API; **required for ops UI panels** | Human | ws6 **omits** it → nav may show, panels `null` |
| Package exports `./finance`, `./host/finance` | **Yes** | Human / copy from fixture | Generated imports use `/host/finance` |

### Manifest minimum (engine path)

```json
"workspaceFinance": {
  "supported": true,
  "defaultModuleEnabledWhenUnset": true,
  "ledgerPolicy": { "module": "./finance", "export": "…" },
  "receiptDefaults": { "module": "./finance", "export": "…" },
  "chartOfAccounts": { "module": "./finance", "export": "…" },
  "eventReaction": { "module": "./finance", "export": "…", "requiresHostIo": false }
}
```

Add `opsManifest` for operator panel layout (Denali / finance-ws5 pattern).

### Codegen outputs (no hand-edit)

| Generated file | Covers |
| -------------- | ------ |
| `workspace-finance-bindings.generated.ts` | Capability support + default module flag |
| `workspace-finance-dependency-bindings.generated.ts` | Ledger + receipt factories |
| `workspace-finance-chart-of-accounts-bindings.generated.ts` | CoA |
| `workspace-finance-event-reaction-bindings.generated.ts` | TourCreated reaction |
| `apps/web/.../workspace-finance-nav-bindings.generated.ts` | Hub nav plugin ids |
| `apps/web/.../workspace-finance-ops-bindings.generated.ts` | Ops panels (only manifests with `opsManifest`) |

**Forbidden to edit for onboarding:** `FinanceService`, finance-core, repository, hand-written gate arrays, hand registries (asserted by ws6 spec).

---

## 2. Runtime verification

### Tenant resolution — PASS (platform)

| Step | Mechanism |
| ---- | --------- |
| Lookup | `resolveFinanceWorkspaceTypeForTenant` → Prisma tenant (or registered-tenant fallback) |
| Fail-closed | Missing tenant / unknown type → `FINANCE_WORKSPACE_UNSUPPORTED` |
| Composition | `resolveFinanceServiceForTenant` → generated dependency bindings by `workspaceType` |

**Human ops (not code):** insert/update `tenants.workspace_type` (and theme) for the customer tenant.

### Capability enablement — PASS (codegen)

| Step | Mechanism |
| ---- | --------- |
| Supported set | `isFinanceSupportedWorkspace` from generated bindings |
| Module flag | `isFinanceModuleEnabled(theme, workspaceType)` + `defaultModuleEnabledWhenUnset` |
| Errors | `FINANCE_WORKSPACE_UNSUPPORTED` / `FORBIDDEN_FINANCE_MODULE_DISABLED` |

**Human:** theme `enabledModules` if default-when-unset is false.

### HTTP exposure — PASS with caveat

| Fact | Evidence |
| ---- | -------- |
| Handlers | Shared `@app-tour/finance-http` |
| Host wiring | `configure-workspace-finance-http-host` → `resolveFinanceServiceForTenant` |
| Route registration | Today owned by **Denali** `httpRoutes` group → codegen into `workspace-http-routes.generated.ts` (global mount) |

**Implication:** A new finance workspace **reuses** existing `/finance/*` routes; it does **not** need its own HTTP route table **while** Denali (or another package) continues to register `finance-http` routes in this monorepo.

| Still human? | When |
| ------------ | ---- |
| No (for new WS in current monorepo) | Denali finance HTTP registration remains |
| **Yes** | Standalone product monorepo without any manifest declaring finance-http routes — must add an `httpRoutes` group (copy Denali finance group / platform pattern) |

New workspace must **not** invent parallel `/finance` handlers in finance-core.

### Ops panel binding — CONDITIONAL

| With `opsManifest` + `apps/web` dep | Panels resolve via generated ops bindings |
| ---------------------------------- | ---------------------------------------- |
| Without `opsManifest` (e.g. ws6) | `resolveWorkspaceFinanceOpsManifest` → unbound → **host renders nothing** |
| Nav only | `supported: true` → plugin id in `WORKSPACE_FINANCE_NAV_PLUGIN_IDS` |

**Human for full ops UX:** implement ops manifest module + add `@app-tour/workspace-<id>` to **`apps/web/package.json`** (codegen static imports; today web lists denali, ws4, ws5 — **not** ws6).

### Event reactions — PASS (codegen + adapter)

| Step | Mechanism |
| ---- | --------- |
| Resolve | `resolveWorkspaceFinanceEventReaction(workspaceType)` |
| HostIo | Injected when `requiresHostIo: true` (Denali); fixtures often `false` |
| Processing | `consumePendingForTenant` / `reactToPublishedRow` + processed-event claim |

**Human:** write reaction adapter; choose HostIo flag; ensure outbox/relay still runs for that tenant (platform worker — not per-WS code).

---

## 3. Operations verification

### Database requirements

| Need | Per new workspace? |
| ---- | ------------------ |
| `payments`, `payment_receipts`, schedules, outbox, idempotency, processed events | **No** — shared host schema |
| New Prisma migration | **Only if** workspace needs new tables (not required for standard finance ports) |
| CoA | Adapter/codegen constants — **not** a DB migration |

**Human:** ensure target env already migrated for finance tables (one-time platform); seed tenant.

### Migrations

| Action | Owner |
| ------ | ----- |
| Platform finance DDL | Host migrate (already assumed for Denali) |
| Workspace package version bump | Human / release process |
| Codegen refresh after manifest change | Human/CI: `generate:workspace-registry` |

### Monitoring

| Status | Note |
| ------ | ---- |
| **Gap** | Hostile production audit: **no** finance alerts; sparse metrics |

**Human / platform ops:** until P0 alerts exist, onboarding a workspace does not automatically get monitoring — operators rely on logs + existing product KPIs.

### Rollback

| Lever | Effect |
| ---- | ------ |
| Theme remove `finance` from `enabledModules` | `FORBIDDEN_FINANCE_MODULE_DISABLED` |
| Set `workspaceFinance.supported: false` + regen | Drops nav/capability binding (code deploy) |
| Wrong `workspaceType` on tenant | Fail-closed unsupported |
| Approve TX failure | Automatic rollback (Option C) — not WS-specific |

**Human:** prefer theme module disable for instant ops rollback without redeploying adapters.

---

## 4. What still requires human code changes?

### Mandatory (every new finance workspace)

| # | Change | Why |
| - | ------ | --- |
| M1 | Create/implement workspace **package** + finance **adapters** | Product policy (CoA, journals, defaults, reaction) |
| M2 | Author **`workspace.manifest.json`** finance (+ tourWrite) | Codegen SoT |
| M3 | Add dependency to **`apps/api/package.json`** | pnpm + generated static imports |
| M4 | **Build** package + run **`generate:workspace-registry`** | Emit bindings |
| M5 | **Tenant** provisioning (`workspaceType`, theme) | Runtime resolution |

### Mandatory for full operator product

| # | Change | Why |
| - | ------ | --- |
| M6 | Implement **`opsManifest`** | Ops panels |
| M7 | Add dependency to **`apps/web/package.json`** | Generated ops imports resolve |
| M8 | Confirm **finance HTTP** still registered in monorepo (Denali group today) | Otherwise add httpRoutes group |

### Optional / situational

| # | Change | Why |
| - | ------ | --- |
| O1 | Onboarding proof spec (wsN pattern) | Regression guard — not required for runtime |
| O2 | `requiresHostIo: true` + HostIo-compatible reaction | Only if reaction needs platform outbox IO types |
| O3 | Custom DB migrations | Only if new persistence beyond shared finance tables |
| O4 | Production certification / guest surfaces | If workspace is a full product, not finance-only fixture |
| O5 | Alerting/dashboard hooks | Platform ops gap — not WS-specific codegen |

### Must NOT change (repeatability proof)

| Do not touch | Evidence |
| ------------ | -------- |
| `packages/finance-core` | ws6 spec |
| Hand gate id lists | codegen + capability specs |
| `finance-dependency-registry.ts` hand map | generated bindings only |
| Prisma repository / Option C | shared host |

---

## 5. Repeatability checklist (tomorrow’s workspace)

Use as the operational runbook:

```text
[ ] Package scaffolded under packages/workspaces/<id>
[ ] Adapters: ledger + receipt + CoA + reaction (+ opsManifest if UI panels needed)
[ ] Manifest workspaceFinance.supported + tourWrite.workspaceTypeExport
[ ] apps/api/package.json dependency added
[ ] apps/web/package.json dependency added (if opsManifest)
[ ] pnpm install && pnpm -C packages/workspaces/<id> run build
[ ] pnpm run generate:workspace-registry
[ ] API boots; isFinanceSupportedWorkspace(<id>) === true
[ ] resolveFinanceWorkspaceDependencies(<id>) returns new adapters
[ ] Tenant created with workspaceType=<id>
[ ] POST/GET /finance/* succeed for that tenant (capability + authz)
[ ] Nav shows finance hub for plugin id=<id>
[ ] Ops panels render if opsManifest present; else accept empty panels
[ ] Reaction registered; relay/consume path smoke (if TourCreated used)
[ ] Rollback drill: disable finance module on theme → FORBIDDEN_…
```

**Automated proof exists for M1–M4 engine path:** `finance-ws3`…`finance-ws6-onboarding.spec.ts` (package + manifest + codegen + api dep; **no** FinanceService edits).

**Not fully automated:** M5 tenant seed, M6–M7 ops UI, M8 HTTP ownership awareness, O5 monitoring.

---

## 6. Repeatability score

| Layer | Score | Meaning |
| ----- | ----: | ------- |
| Input → codegen → capability / deps / CoA / reaction | **9/10** | Drop-in proven; api `package.json` is the main friction |
| HTTP | **8/10** | Shared finance-http; depends on existing route owner in monorepo |
| Ops panels | **6/10** | Optional manifest + **web** dep often forgotten (ws6 gap) |
| DB / migrate | **9/10** | Shared schema; rare per-WS DDL |
| Monitoring | **3/10** | Platform P0 alert gap |
| Rollback | **8/10** | Theme module disable works; docs consolidation weak |

**Overall:** Onboarding is **operationally repeatable** for engine + API composition. It is **not** zero-touch: expect **~5–7 human steps** (adapters, manifest, api dep, codegen, tenant, and optionally web dep + opsManifest).

---

## Related evidence

| Source | Role |
| ------ | ---- |
| `finance-ws6-onboarding.spec.ts` | Drop-in proof |
| `scripts/codegen/workspace-registry/domains/finance.mjs` | Codegen rules |
| `resolve-finance-workspace-type-for-tenant.ts` | Tenant → type |
| `configure-workspace-finance-http-host.ts` | Shared HTTP |
| [`FINANCE_HOSTILE_PRODUCTION_READINESS.md`](./FINANCE_HOSTILE_PRODUCTION_READINESS.md) | Monitoring gap |
| [`FINANCE_PLATFORM_DEBT_AUDIT.md`](./FINANCE_PLATFORM_DEBT_AUDIT.md) | Manual package.json deps = P2 |
