# CI Composite Setup (S5.1)

**Status:** Stage A — documentation only (composite not created; workflows unchanged)  
**Initiative:** Platform Simplification / S5.1 Composite Setup Consolidation  
**Related:** [`COMMAND_OWNERSHIP_MAP.md`](./COMMAND_OWNERSHIP_MAP.md), [`FINANCE_CI_MIGRATION_STATUS.md`](./FINANCE_CI_MIGRATION_STATUS.md)  
**Migration model:** Finance A→E (docs → unused artifact → single pilot → parity → expand)

---

## 1. Purpose

Roughly two dozen workflows repeat the same monorepo toolchain bootstrap:

```text
checkout → pnpm/action-setup → setup-node (.nvmrc + pnpm cache)
  → check-node-engine → pnpm install --frozen-lockfile
```

Duplication makes action major bumps, cache policy, and engine-check policy easy to drift across jobs. S5.1 extracts that **setup surface only** into a reusable local composite so callers keep identical business steps while sharing one contract for toolchain install.

This is **not** a redesign of gates, required checks, or product assertions. Guard strength and install semantics stay fail-closed and frozen-lockfile.

---

## 2. Scope

### Included (composite responsibility — future Stage B+)

| Concern | Behavior |
| --- | --- |
| pnpm setup | `pnpm/action-setup@v4` (version from root `packageManager`) |
| Node setup | `actions/setup-node@v4` via `node-version-file` and/or `node-version` |
| Cache | Optional `cache: pnpm` when `cache-enabled` is true |
| Engine verification | Optional `node scripts/guards/check-node-engine.mjs` |
| Frozen install | Optional `pnpm install --frozen-lockfile` (exact string) |

### Caller responsibility (stays outside composite)

| Concern | Why |
| --- | --- |
| **Checkout** | `actions/checkout@v4` remains the first explicit job step (fetch-depth, path, sparse, etc.) |
| Business / gate steps | Guards, builds, tests, artifacts — unchanged in the workflow YAML |
| Job `name:` / permissions | Owned by the workflow; composite must not declare `permissions:` |

### Excluded from S5.1 (do not migrate in this initiative without a new plan)

| Exclusion | Rationale |
| --- | --- |
| Deploy workflows (e.g. `deploy-vps.yml`) | Non-standard stack (SSH/secrets/partial node) |
| Remote staging workflows (`p7-staging-gate`, `p10-staging-gate`) | Remote bash gates; not the pnpm monorepo bootstrap |
| `phase-0-gate.yml` | Scripted **required** main checks |
| `phase-1-gate.yml` | Scripted **required** main check |
| `booking-postgres-gate.yml` | Scripted **required** Booking PostgreSQL checks |
| PR helper / checkout-only (`phase-g-h-create-pr.yml`) | No full toolchain stack |

Required-check ownership remains [`scripts/ops/main-branch-required-checks.mjs`](../../scripts/ops/main-branch-required-checks.mjs). S5.1 does not edit that script or branch protection.

---

## 3. Proposed composite contract

**Path (not created in Stage A):**

```text
.github/actions/setup-platform/action.yml
```

### Inputs

| Input | Intended default | Description |
| --- | --- | --- |
| `node-version-file` | `.nvmrc` | Passed to `setup-node` when `node-version` is empty |
| `node-version` | `''` | If non-empty, use instead of the version file (variant jobs such as hardcoded `24`) |
| `cache-enabled` | `'true'` | When true, set `cache: pnpm`; when false, omit cache |
| `engine-check-enabled` | `'true'` | When true, run `check-node-engine.mjs` |
| `install-dependencies` | `'true'` | When true, run `pnpm install --frozen-lockfile` |

### Outputs (optional, Stage B)

| Output | Source |
| --- | --- |
| `node-version` | `node -v` after setup |
| `pnpm-version` | `pnpm -v` after pnpm setup |

### Internal step names (preserve current semantics)

1. `Setup pnpm`  
2. `Setup Node.js`  
3. `Verify Node.js engine` (if `engine-check-enabled`)  
4. `Install dependencies` (if `install-dependencies`)

### Example caller shape (illustrative — not applied yet)

```yaml
- name: Checkout
  uses: actions/checkout@v4
- name: Setup platform toolchain
  uses: ./.github/actions/setup-platform
  # defaults: .nvmrc, cache on, engine on, frozen install
```

---

## 4. Migration waves

| Wave | Scope | Notes |
| --- | --- | --- |
| **0 — Finance pilot** | `.github/workflows/finance-integrity.yml` only (both jobs) | Not a required check; full MERGE_SAFE stack; S4 dual-run history; easy rollback |
| **1 — MERGE_SAFE** | Workflows that already match the canonical five-step stack (engine + frozen install + `.nvmrc` + cache), excluding required trio | Expand only after Wave 0 parity |
| **2 — Variants** | Jobs needing inputs (`engine-check-enabled: false`, `node-version`, post-install apt extras remain **after** composite) | Inputs only; do not fold ripgrep/apt into composite |
| **3 — Review remaining** | Unnamed-step jobs, path-gated guards, anything left after Waves 0–2 | Keep separate or migrate with explicit step-name acceptance |

**Hard deferrals through Wave 0–1:** `phase-0-gate`, `phase-1-gate`, `booking-postgres-gate`.

---

## 5. Safety rules

**Never** in S5.1:

| Rule | Reason |
| --- | --- |
| Rename job `name:` strings | Protects check identity / UI continuity |
| Change job or workflow `permissions:` | Avoids auth/token surface drift |
| Change required checks or `main-branch-required-checks.mjs` | Branch protection out of scope |
| Change branch protection settings | Architect-owned; not this initiative |
| Change install semantics | Must remain `pnpm install --frozen-lockfile` when install is enabled |
| Add `continue-on-error` on setup | Failure behavior must stay fail-closed |

---

## 6. Validation model

Before expanding past the pilot, compare a before/after run (same event class: PR path filter or `workflow_dispatch`):

| Check | Pass criterion |
| --- | --- |
| Jobs unchanged | Same job `name:` values |
| Business steps unchanged | Gate/guard/build/test `run:` blocks identical |
| Cache unchanged | `cache: pnpm` still applied when enabled; re-run shows expected cache behavior |
| Failure behavior unchanged | Engine or install failure fails the job; no soft-skip |
| Frozen lockfile | Install command string identical |
| Checkout first | Explicit checkout step still precedes composite |

Evidence: Actions run URLs for the pilot workflow before and after the Wave 0 commit.

---

## 7. Rollback strategy

1. Revert the workflow migration commit that switched the pilot (or restore the file from the parent SHA).  
2. Optionally leave the unused composite on disk, or revert the composite-add commit.  
3. Do not touch required checks, job names, or branch protection during rollback.  
4. Confirm the next finance-path PR (or dispatch) shows the prior inline setup layout.  
5. If cache anomalies appear, use `cache-enabled: false` only as a **documented diagnostic**, not a silent permanent change.

---

## Stage status

| Stage | Status |
| --- | --- |
| **A — Documentation** | **This document** |
| **B — Create unused composite** | Not started |
| **C — Migrate finance-integrity only** | Not started |
| **D — Parity validation** | Not started |
| **E — Expand waves** | Not started |

---

*Stage A only. No `.github/actions/setup-platform` tree and no workflow edits until an explicit implementation YES.*
