# Finance packages — semantic versioning policy

```yaml
policy_id: FINANCE_SEMVER_POLICY
version: "1.0"
date: "2026-07-19"
packages:
  - "@app-tour/finance-http-contracts"
  - "@app-tour/finance-core"
publish: false
baseline: "0.1.0"
```

**Purpose:** Prepare both packages for intentional semver without publishing yet.  
**Baseline freeze:** Internal API freeze for finance-core already declared; this policy governs how versions move from `0.1.0` onward.

---

## 1. Which package is the API contract?

| Package | Role | Consumers |
| ------- | ---- | --------- |
| **`@app-tour/finance-http-contracts`** | **Primary wire + workspace capability contract** | HTTP hosts, workspace adapters, finance-core (re-exports ledger/receipt types) |
| **`@app-tour/finance-core`** | **Application engine contract** | Host composition roots (`createFinanceService` + ports + domain helpers) |

### Authority (SoT)

| Surface | SoT package |
| ------- | ----------- |
| Zod HTTP body schemas / parsers (`createManualPaymentBodySchema`, …) | **contracts** |
| `FinanceLedgerPolicyPort`, `FinanceReceiptDefaultsPort`, journal/line/plan DTOs | **contracts** |
| `WorkspaceFinanceEventReactionPort` (+ batch/row types) | **contracts** |
| `createFinanceService` / `FinanceService` / identity helpers | **finance-core** |
| Host infra ports (`FinanceRepositoryPort`, `IBookingPaymentPort`, clock, metrics, …) | **finance-core** |
| Domain helpers (`compileRegistrationInvoice`, schedule builders, …) | **finance-core** |

**Rule:** Workspace packages and HTTP layers must depend on **contracts** for wire/capability types. Hosts that only compose the engine may depend on **finance-core** alone (transitive contracts), but must still install a compatible contracts version.

---

## 2. Which changes are breaking?

Apply to the **public** surface of each package (`exports` map + root barrel / published `.d.ts`).

### Always breaking (major after 1.0; **minor** while on 0.x — see §6)

| Change | Examples |
| ------ | -------- |
| Remove or rename an export | Dropping `createFinanceService`; renaming a port |
| Narrow a type / remove a required method from a port | Removing `raisePaidInTx` from `IBookingPaymentPort` |
| Add a **required** method/field to a stable port or DTO | New required arg on `approveManualReceiptAtomic` |
| Change `createFinanceService` arity or argument order | Inserting a 14th port mid-list |
| Change Option C approve order / fail-closed semantics | Paid ↔ booking order swap |
| Change stable identity formulas | `payment:{id}:ledger-capture-anchor`, prepay domain-event ids |
| Change normative ledger `eventType` string | `finance.ledger.double_entry_applied` |
| Remove a package `exports` subpath | Dropping `./ports` |
| Raise minimum Node engine incompatibly | e.g. `>=24` → `>=26` without major |

### Not breaking (patch / minor as below)

| Change | Bump |
| ------ | ---- |
| Add **optional** fields to DTOs (callers ignore extras) | Minor (0.x) / minor (1.x) |
| Add **new** export (new port method optional via new interface version — prefer new type name) | Minor |
| Add new package export subpath | Minor |
| Bugfix preserving types + semantics | Patch |
| Docs / README / guards only | Patch (or no version bump if unpublished monorepo-only) |
| Internal refactor with identical public `.d.ts` + behavior | Patch |

### Zod / HTTP schemas (contracts)

| Change | Class |
| ------ | ----- |
| Reject previously accepted bodies | **Breaking** |
| Accept additional optional fields | Non-breaking |
| Tighten transforms that change output shape | **Breaking** |
| Rename exported schema/parser symbols | **Breaking** |

---

## 3. Which ports are stable?

**Stable** = hosts may depend on these for production; changes follow §2 strictly; covered by finance-core public-api allowlist and/or contracts barrel.

### Stable — `createFinanceService` (13) — finance-core

| # | Port | Notes |
| - | ---- | ----- |
| 1 | `FinanceLedgerPolicyPort` | SoT in **contracts**; re-exported by core |
| 2 | `FinanceRepositoryPort` | Full method set; Option C atomics |
| 3 | `IBookingPaymentPort` | Incl. `raisePaidInTx` |
| 4 | `FinanceReceiptDefaultsPort` | SoT in **contracts** |
| 5 | `RegistrationDisplayPort` | |
| 6 | `FinanceMetricsPort` | |
| 7 | `FinanceStorageDriverPort` | Prefer over deprecated aliases |
| 8 | `ReceiptProofStoragePort` | Prefer over deprecated aliases |
| 9 | `FinanceCapabilityPort` | |
| 10 | `FinanceAuthorizationPort` | Prefer over `FinanceAccessPort` / `FinanceAuthzPort` |
| 11 | `FinanceSchedulePort` | |
| 12 | `FinanceLoggerPort` | Prefer over `FinanceLogPort` |
| 13 | `FinanceClockPort` | |

### Stable — entry points & helpers — finance-core

- `createFinanceService`, `FinanceService`
- `hashFinanceHttpIdempotencyKey`, `buildPrepaymentDomainEventIds`
- Domain: `compileRegistrationInvoice`, `buildPaymentScheduleItems`, `attachFinanceRegistrationContext`, `filterRowsByRegistrationId`
- Actor: `FinanceActorContext` (+ role/status unions)

### Stable — HTTP + ledger wire — contracts

- All exported Zod schemas + `parse*` helpers + body types
- `FinanceLedgerJournalLine`, `FinanceLedgerCapturePlan`, build-* inputs
- `FinanceLedgerPolicyPort`, `FinanceReceiptDefaultsPort`, `FinanceOfflineReceiptDefaults`

### Stable — frozen compatibility aliases (do not expand)

Deprecated names remain until a **major** removal:  
`AmbientTenantTx`, `FinanceTransaction`, `FinanceAccessPort`, `FinanceAuthzPort`, `FinanceLogPort`, `FinancePersistenceModePort`, `FinanceStoragePort`, `FinanceReceiptProofUrlPort`, `FinanceReceiptProofSignedUrlInput`.

---

## 4. Which ports are experimental?

**Experimental** = may change in a **minor** on 0.x without a major; must be labeled in CHANGELOG; hosts should isolate adapters.

| Symbol / area | Package | Why experimental |
| ------------- | ------- | ---------------- |
| `WorkspaceFinanceEventReactionPort` | contracts | Not part of `createFinanceService`; reaction/HostIo still evolving |
| `WorkspaceFinancePublishedOutboxRow` / `WorkspaceFinanceReactionBatchResult` | contracts | Paired with reaction port |
| `FinanceTransactionPort` (`object`) | finance-core | Opaque by design; branding/cast hygiene may change without semantic change |
| Host-local `FinanceOutboxWriter` (today under `apps/api`) | **not published** | Missing from contracts — when added, land as **0.x experimental** first |
| HTTP idempotency lease port | **not published** | Same — experimental on first introduction |

**Rule:** Experimental exports added to contracts/core must be listed under an “Experimental” heading in that release’s CHANGELOG. Promoting to stable requires an explicit CHANGELOG note (and preferably a minor bump with “stabilized” language).

---

## 5. Required versioning order

```text
1. Decide change class (patch / minor / major) per §2–§4
2. Bump + CHANGELOG  @app-tour/finance-http-contracts   FIRST
3. Build contracts
4. Update finance-core dependency range to the new contracts version
5. Bump + CHANGELOG  @app-tour/finance-core             SECOND
6. Build core; run core guards + tests
7. (Monorepo) bump consumers only if they import contracts directly with a pin
8. Tag git: finance-http-contracts@X.Y.Z then finance-core@A.B.C
9. Publish ONLY with explicit product YES — contracts then core
```

### Lockstep rules

| Situation | Versions |
| --------- | -------- |
| Baseline today | contracts `0.1.0`, core `0.1.0` |
| Contracts-only additive (no core code change) | Bump contracts; core may stay if dependency range still satisfies (prefer bump core patch documenting “depends on contracts ≥ …”) |
| Contracts breaking | Bump contracts **and** core (core must compile against new contracts) |
| Core-only change (ports/engine) | Bump core only; contracts unchanged |
| First registry cut | Publish contracts `0.1.0` (or next), then core depending on that exact/`^` range |

### Core → contracts dependency range (when leaving `workspace:*`)

| Phase | Recommended range |
| ----- | ----------------- |
| First pack/publish | Exact `"0.1.0"` (or matching contracts version) |
| After contracts API proven | `"^0.1.0"` while both on 0.x (npm 0.x: `^` allows minor — **tighten if using 0.x minor = breaking**) |
| After 1.0 | `"^1.0.0"` with normal semver |

---

## 6. Compatibility policy

### Pre-1.0 (`0.y.z`) — current

- **Public API is intentionally freeze-shaped** (allowlist + Host Kit), but semver still uses 0.x.
- **Breaking changes bump `0.MINOR`** (not patch). Patches are fixes only.
- Hosts should pin exact versions (`0.1.0`) until 1.0 unless they accept 0.x churn.
- Monorepo may keep `workspace:*` until a publish cut.

### Post-1.0

- Semver as usual: breaking → major; additive → minor; fixes → patch.
- Deprecated aliases removed only on major.
- Core `peerDependencies` or `dependencies` on contracts: `"^MAJOR.0.0"` same major.

### Compatibility promises

1. A host written against Host Integration Kit + stable ports on version **X** must compile and pass conformance flows on **X** patch releases.
2. Option C approve order and stable identity formulas do not change without a breaking bump + migration note.
3. finance-core never adds Prisma / apps/api / workspace / generated imports (boundary guards remain release gates).

### Incompatibility (supported)

- Mixing contracts major N with core built for major N−1.
- Relying on experimental reaction/outbox types across minors on 0.x without reading CHANGELOG.

---

## 7. Migration rules

| From → To | Host action |
| --------- | ----------- |
| Patch (same minor) | Upgrade; re-run host tests; no adapter changes expected |
| 0.x minor (may include breaks) | Read CHANGELOG “Breaking”; update port adapters; re-run Option C conformance |
| Contracts bump, core unchanged range | Reinstall; if types break, bump core |
| Alias → preferred name | Replace imports (`FinanceAccessPort` → `FinanceAuthorizationPort`, etc.); aliases remain until major |
| `workspace:*` → registry | Install both packages; set core dep to semver range; drop staging rewrite scripts |
| Experimental → stable | Remove isolation guards; treat as §3 thereafter |

**Behavior migrations** (payment/approve/ledger semantics) require Architect YES and a breaking bump — not silent patch.

---

## 8. Release checklist (do **not** publish without YES)

### A. Pre-bump

- [ ] Classify change: patch / minor / major (0.x: breaking = minor)
- [ ] Identify SoT package(s) touched (contracts and/or core)
- [ ] Update allowlists / guards if new stable exports
- [ ] Mark experimental exports in CHANGELOG draft
- [ ] Confirm **no** business-behavior change unless intentional + documented

### B. Contracts package

- [ ] Bump `packages/finance-http-contracts/package.json` version
- [ ] Update `packages/finance-http-contracts/CHANGELOG.md`
- [ ] `pnpm -C packages/finance-http-contracts run build`
- [ ] Run contracts tests if present

### C. Core package

- [ ] Set dependency on contracts to new version (exact or range per §5)
- [ ] Bump `packages/finance-core/package.json` version when required by §5
- [ ] Update `packages/finance-core/CHANGELOG.md`
- [ ] Clean build: `rm -rf dist && pnpm -C packages/finance-core run build`
- [ ] `guard:boundary` + `guard:portability` + `guard:public-api`
- [ ] `pnpm -C packages/finance-core run test`

### D. Pack smoke (no publish)

- [ ] `pnpm pack` contracts, then core
- [ ] Inspect core tarball `dependencies["@app-tour/finance-http-contracts"]` (no `workspace:*`)
- [ ] Optional: install both tarballs in a clean `/tmp` host and `tsc`

### E. Monorepo / docs

- [ ] Consumers importing contracts directly still typecheck
- [ ] Host Integration Kit / this policy updated if ports stabilized or broken
- [ ] Git tags prepared: `finance-http-contracts@X.Y.Z`, `finance-core@A.B.C`

### F. Publish gate (blocked by default)

- [ ] Product/Architect **YES**
- [ ] Clear or override `private: true` for release channel only
- [ ] Publish **contracts first**, then **core**
- [ ] Verify registry install of core resolves contracts

---

## 9. Related docs

| Doc | Role |
| --- | ---- |
| [`FINANCE_HOST_INTEGRATION_KIT.md`](./FINANCE_HOST_INTEGRATION_KIT.md) | Host adapter expectations |
| [`FINANCE_DEPS_WORKSPACE_TO_REGISTRY.md`](./FINANCE_DEPS_WORKSPACE_TO_REGISTRY.md) | workspace → registry migration |
| [`FINANCE_CORE_INTERNAL_FREEZE.md`](./FINANCE_CORE_INTERNAL_FREEZE.md) | Internal freeze evidence |
| [`FINANCE_CORE_HOSTILE_EXTERNAL_HOST.md`](./FINANCE_CORE_HOSTILE_EXTERNAL_HOST.md) | External install evidence |
| Package `CHANGELOG.md` | Per-release notes (baseline 0.1.0) |
