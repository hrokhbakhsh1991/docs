# CI Composite Setup

**Status:** Active — composite exists; callers migrating under PSR-3b  
**Initiative:** Platform Simplification / PSR-3b workflow reuse  
**Related:** [`COMMAND_OWNERSHIP_MAP.md`](./COMMAND_OWNERSHIP_MAP.md),
[`ROOT_COMMAND_REMEDIATION_PLAN.md`](./ROOT_COMMAND_REMEDIATION_PLAN.md),
archived R4 [`ROOT_COMMAND_R4_CI_ASSESSMENT.md`](../archive/psr-001/root-command/ROOT_COMMAND_R4_CI_ASSESSMENT.md)  
**Required checks:** [`scripts/ops/main-branch-required-checks.mjs`](../../scripts/ops/main-branch-required-checks.mjs) — **frozen** in PSR-3b

---

## 1. Purpose

Many workflows repeat the same monorepo toolchain bootstrap:

```text
checkout → pnpm/action-setup → setup-node (.nvmrc + pnpm cache)
  → [optional check-node-engine] → pnpm install --frozen-lockfile
```

The shared composite owns that **setup surface only**. Callers keep checkout,
business steps, job names, permissions, and fail-closed install semantics.

This is **not** a redesign of gates, required checks, or product assertions.

---

## 2. Composite contract (implemented)

**Path:** `.github/actions/setup-platform/action.yml`

### Inputs

| Input | Default | Description |
| --- | --- | --- |
| `node-version-file` | `.nvmrc` | Used when `node-version` is empty |
| `node-version` | `''` | Explicit Node version override |
| `cache-enabled` | `'true'` | When true, `cache: pnpm` |
| `engine-check-enabled` | `'true'` | When true, run `check-node-engine.mjs` |
| `install-dependencies` | `'true'` | When true, `pnpm install --frozen-lockfile` |

### Caller responsibility

| Concern | Why |
| --- | --- |
| **Checkout** | Remains the first explicit job step |
| Business / gate steps | Unchanged `run:` blocks |
| Job `name:` / permissions | Owned by the workflow |

### Hard exclusions (do not migrate in PSR-3b)

| Exclusion | Rationale |
| --- | --- |
| `phase-0-gate.yml` | Required main checks |
| `phase-1-gate.yml` | Required main check |
| `booking-postgres-gate.yml` | Required Booking PostgreSQL checks |
| Deploy / remote staging / PR-create helpers | Non-standard or non-bootstrap stacks |

---

## 3. Current caller inventory (2026-07-31)

| Class | Count | Notes |
| --- | ---: | --- |
| Uses `setup-platform` | 5 → **6** after PSR-3b pilot | See snapshot |
| Direct full bootstrap (pnpm+node+frozen) | 18 → **17** | Discovery metric |
| Other (no full stack) | 4 | deploy, staging, create-pr |

### Already on composite (pre-PSR-3b)

- `finance-integrity.yml`
- `api-nightly.yml`
- `doc-gate.yml`
- `phase-2-gate.yml`
- `phase-3-gate.yml`

### PSR-3b pilot

| Workflow | Change | Parity note |
| --- | --- | --- |
| `portal-control-guard.yml` | Inline setup → `setup-platform` | **`engine-check-enabled: false`** — pre-pilot YAML had no engine step |

Job name `portal-control`, triggers, path filters, permissions, and
`pnpm run control:ci` are unchanged.

---

## 4. Safety rules (unchanged)

| Never | Reason |
| --- | --- |
| Rename job `name:` strings | Check identity |
| Edit `main-branch-required-checks.mjs` | Branch protection out of scope |
| Change branch protection | Architect-owned |
| Soft-fail install / engine | Fail-closed |
| Merge verify:fast/product/full/adversarial | Separate authorities |

---

## 5. Rollback

Revert the single workflow patch for `portal-control-guard.yml`. Leave the
composite on disk. Do not touch required checks.

---

## 6. Stage status (reconciled)

| Stage | Status |
| --- | --- |
| A — Documentation | Complete (this doc; superseded Stage-A-only claim) |
| B — Create composite | **Done** — `.github/actions/setup-platform` |
| C — Finance / early callers | **Done** — five workflows listed above |
| D — Isolated non-required pilot | **PSR-3b** — `portal-control-guard.yml` |
| E — Expand matching non-required | Deferred (separate approval; Actions parity preferred) |

Family-runner consolidation (R3) is already complete via
`scripts/guards/run-guard-family.mjs`. PSR-3b does **not** merge control-pack
adapters or remove leaf guards.
