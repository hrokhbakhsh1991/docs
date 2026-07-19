# Finance platform debt audit (post finance-core prep)

```yaml
audit_id: FINANCE_PLATFORM_DEBT_POST_CORE
version: "1.0"
date: "2026-07-19"
scope: host composition debt after finance-core extraction preparation
constraints:
  - no architecture redesign
  - no business-behavior change
  - implement P0 only
```

**Claim under test:** finance is a multi-workspace **platform engine** (`finance-core`) with a host composition root — not a Denali-hardwired service locator.

**Code SoT reviewed:** `apps/api` boot/registry/adapters; `packages/finance-core` (engine purity assumed green from prior gates).

---

## Summary

| Priority | Open items | Action this pass |
| -------- | ---------- | ---------------- |
| **P0** | **0** | None — prior Class A log fix already landed |
| **P1** | 1 | Document only (do not implement) |
| **P2** | 5 | Accept / keep |

---

## Item-by-item classification

### 1. `BOOT_FINANCE_WORKSPACE_TYPE = "denali"`

| | |
| -- | -- |
| **Location** | `finance-dependency-registry.ts` — constant + default when `FINANCE_BOOT_WORKSPACE_TYPE` unset |
| **Current behavior** | Boot/legacy `resolveLazyFinanceService` uses boot type. **HTTP SoT** is `resolveFinanceServiceForTenant` (tenant → workspaceType). Env override works for registered types. |
| **Platform risk** | Misleading if callers use boot path for HTTP; does **not** hardwire engine or HTTP |
| **Class** | **P2** — acceptable host product default (this host’s primary workspace is Denali) |
| **Why not P0** | Tenant HTTP path is already neutral; fail-closed registry; env override exists |
| **Why not P1** | Changing default without product YES is behavior/ops churn, not extraction blocker |

---

### 2. Shared repository singleton

| | |
| -- | -- |
| **Location** | `finance-repository.factory.ts` (`financeRepositorySingleton`); also cached in `lazy-finance-service.ts` |
| **Why it exists** | One `FinanceRepositoryPort` must share the **same** `IBookingPaymentPort` instance for Option C approve TX + non-TX sync across cached per-`workspaceType` services |
| **Class** | **P2** — host composition detail required by Option C |
| **Must not** | Per-workspaceType Prisma repositories that fork booking adapters (would break approve atomicity assumptions) |

---

### 3. Shared booking singleton

| | |
| -- | -- |
| **Location** | `lazy-finance-service.ts` — `sharedBookingPayments` |
| **Why it exists** | Platform-owned booking projection; all registered finance workspaces use `BookingPaymentAdapter` today; repo singleton requires one port instance |
| **Class** | **P2** — acceptable host implementation detail |
| **P1 only if** | A future workspace needs a **different** booking port implementation (then redesign cache keys — out of scope) |

---

### 4. `apps/api` port façades

| | |
| -- | -- |
| **Location** | `apps/api/src/workspace-finance/ports/*.ts` — re-export types from `@app-tour/finance-core` |
| **Also** | Host-only ports remain here: `finance-outbox-writer.port.ts`, `finance-workspace-outbox-reader.port.ts`, reaction port re-export |
| **Class** | **P2** — compatibility façades; zero runtime Denali coupling |
| **P1 for external extraction** | External hosts should import `@app-tour/finance-core` / contracts directly (façades are monorepo convenience) |

---

### 5. `HostFinanceLogAdapter` console usage

| | |
| -- | -- |
| **Location** | `infrastructure/host-finance-log.adapter.ts` |
| **Current behavior** | Routes `warn` / `error` through platform **pino** `logger` (`event: finance.host.*`) — **not** `console` |
| **Class** | **P0 — CLEARED** (prior Class A fix) |
| **Residual (not this item)** | `in-memory-finance.repository.ts` still `console.warn` on booking sync failure — memory driver only → **P2** |

---

### 6. HostIo casts (`as never`)

| | |
| -- | -- |
| **Location** | `finance-event-reaction-registry.ts` — `binding.create(createPlatformFinanceEventReactionHostIo() as never)` when `requiresHostIo` |
| **Why** | Workspace adapter HostIo types are structurally compatible with platform reader/writer/claim shapes but not nominally identical across package boundaries |
| **Class** | **P2** — acceptable structural bridge; runtime-safe; no semantic leak into finance-core |
| **P1 (optional hygiene)** | Shared HostIo interface in `finance-http-contracts` so cast disappears — type-only, no behavior change |

---

### 7. Manual workspace `package.json` dependencies

| | |
| -- | -- |
| **Location** | `apps/api/package.json` — `@app-tour/workspace-denali`, `workspace-finance-ws2`…`ws6` as `workspace:*` |
| **Why** | Generated bindings statically import workspace adapter factories; pnpm requires declared deps |
| **Class** | **P2** — host wiring cost of manifest→codegen; not engine debt |
| **P1 for second-repo host** | Replace with published workspace plugins or dynamic load — extraction concern, not platform claim |

---

## P1 backlog (do not implement this pass)

| ID | Item | Why before external extraction |
| -- | ---- | ------------------------------ |
| P1-1 | Publish / document HostIo shape in contracts (remove `as never`) | Cleaner second-repo reaction adapters |
| P1-2 | Guide external hosts to skip `apps/api` port façades | Import core/contracts directly |
| P1-3 | Pack/registry path for core+contracts (`workspace:*` → semver) | See `FINANCE_DEPS_WORKSPACE_TO_REGISTRY.md` |

---

## P0 gate for “platform claim”

Platform claim is **allowed** when:

1. HTTP / authenticated finance resolves via **tenant → workspaceType** (not boot Denali) — **met**
2. finance-core has no Prisma / workspace / console / env coupling — **met** (separate guards)
3. Host logger is platform observability, not raw console — **met**
4. Capability gate is codegen/manifest, not `validFinanceWorkspaces = ["denali"]` — **met**

**Open P0 blockers from this debt list: none.**

---

## Explicit non-goals (this audit)

- Removing Denali as default **boot** product
- Splitting repository/booking singletons
- Deleting port re-export files
- Redesigning HostIo or codegen dependency graph
- Changing approve / ledger / payment behavior
