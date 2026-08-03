# Command Ownership Map

**Status:** Active (S3.2)  
**Initiative:** Platform Simplification  
**Related audits:** `TEMP/DUPLICATE_ENTRYPOINT_AUDIT.md` (local), S1–S2.2 commits on `thin`

This document is the **tracked** source of truth for which root commands are canonical, which are legacy aliases, and what is required before any removal.

Finance GitHub Actions consolidation (S4): see [`FINANCE_CI_MIGRATION_STATUS.md`](./FINANCE_CI_MIGRATION_STATUS.md) — canonical workflow `finance-integrity.yml`; legacy finance YAML files are deprecated (manual `workflow_dispatch` / rollback only).

CI composite setup consolidation (S5.1 / PSR-3b): see [`CI_COMPOSITE_SETUP.md`](./CI_COMPOSITE_SETUP.md) — composite live; portal pilot migrated; required gates deferred.

---

## How to use this map

| Daily intent | Canonical command |
| --- | --- |
| Local safety before push | `pnpm verify:fast` |
| Product/workspace static checks | `pnpm verify:product` |
| Heavy integrity (explicit) | `pnpm verify:full` |
| Marketing guard family | `pnpm guard:marketing` |
| Workspace guard family | `pnpm guard:workspace` |
| Field-exposure family | `pnpm guard:field-exposure` |
| Guest guard family | `pnpm guard:guest` |
| Husky / staged-diff loop | `pnpm pre-commit:fast` |
| Phase 0 SDK contract suite | `pnpm test:phase-0` |

---

## Canonical commands

| Command | Owner intent | Migration status | Removal requirements |
| --- | --- | --- | --- |
| `verify:fast` | Daily invariant loop (node engine, import-boundary, thin-shell, registry check, foundation doc-sync) | **Canonical** | Never remove without replacement + CI/docs update |
| `verify:product` | Product/workspace static bundle on top of `verify:fast` | **Canonical** | Same |
| `verify:full` | Local heavy path (`verify:product` + architecture + `ci:integrity`) | **Canonical** | Same; not a default loop |
| `guard:marketing` | Orchestrate all `guard-marketing-*` leafs | **Canonical family** | Keep until CI parity project completes |
| `guard:workspace` | Orchestrate all `guard-workspace-*` leafs | **Canonical family** | Same |
| `guard:field-exposure` | Orchestrate field-exposure phases 0–11 | **Canonical family** | Leaf aliases remain for path-gated pre-commit |
| `guard:guest` | Orchestrate all `guard-guest-*` leafs | **Canonical family** | Same |
| `pre-commit:fast` | Husky fast path (broader than `verify:fast`) | **Canonical hook path** | Do not replace with `verify:fast` |
| `test:phase-0` | Phase 0 SDK contract suite | **Canonical foundation suite** | CI `phase-0:foundation-gate` still depends on this chain |
| `guard:doc-sync` | Preferred name for documentation-sync guard | **Canonical name** | Keep |
| `doc-gate` | Full Docs-as-Code gate | **Canonical** | Keep |
| `ci:integrity` | Integrity chain used by CI / `verify:full` | **Canonical heavy** | **Wave A:** GHA Phase 7/8 jobs run on **`main` / `workflow_dispatch` only** (not every PR) |
| `phase-0:integration-gate` | Full trunk integration (`pnpm test` + guards) | **Canonical** | `main` / `ci:integrity` / local |
| `phase-0:integration-gate:pr` | PR integration (`test:changed` + guards) | **Canonical PR** | `phase-0-gate.yml` pull_request job |
| `phase-1:gate` | platform-core build/tests + `phase-1:guard` | **Canonical** | Wave A: no monorepo `pnpm test` (Phase 0 / Phase 5 own that) |
| `phase-4:gate` | build + test + `phase-4:guard` | **Canonical** | Wave A: **denested** (no nested `phase-3:gate`) |
| `phase-5:gate` | db reset + build + test + `phase-4:guard` + `phase-5:guard` | **Canonical** | Wave A: **denested** (no nested `phase-4:gate`) |
| Leaf `guard:*` used by CI | Targeted safety leaves | **Required until CI migrates** | Zero CI + docs refs before deprecate |

---

## Legacy aliases (compatibility)

Prefer canonical names in new docs and developer workflows.

### Foundation / contract aliases → `test:phase-0`

| Legacy alias | Resolves to | Migration status | Owner intent | Removal requirements |
| --- | --- | --- | --- | --- |
| `test:contract` | `test:phase-0` | **Deprecated alias** (retained PSR-3c) | Historical contract naming; phase-0 docs still cite | Consumer retarget then remove |
| `test:contract:foundation` | `test:phase-0` | **Removed executable (PSR-3a)** | Comment marker only | Prefer `test:phase-0` |
| `contract:test` | `test:phase-0` | **Removed executable (PSR-3a)** | Comment marker only | Prefer `test:phase-0` |
| `phase-0:covenant-gate` | `test:phase-0` | **Deprecated alias** (retained PSR-3c) | Phase-0 naming in reports | Docs + mental model migration |
| `phase-0:foundation-gate` | `test:phase-0` | **Deprecated alias** (CI still uses name) | CI `phase-0-gate.yml` entry | **Retarget CI first**, then remove |

### Doc-sync / doc-gate aliases

| Legacy alias | Resolves to | Migration status | Owner intent | Removal requirements |
| --- | --- | --- | --- | --- |
| `guard:documentation-sync` | `guard:doc-sync` | **Removed executable (PSR-3c)** | Comment marker only | Prefer `guard:doc-sync` |
| `phase-3:doc-scaffold` | `doc-gate` | **Removed executable (PSR-3c)** | Comment marker only | Prefer `doc-gate` |

### Other thin wrappers (retained)

| Legacy alias | Resolves to | Migration status | Removal requirements |
| --- | --- | --- | --- |
| `phase-0:trunk-gate` | `phase-0:integration-gate` | Deprecated discovery (retained) | Grep docs/reports |

### PSR-3c note

`guard:documentation-sync` and `phase-3:doc-scaffold` executables removed after
consumer retarget (`docs/README.md`, `docs/MIGRATION-MAP.md`, `AGENTS.md`).
`foundation-scope-assert.mjs` still forbids the old doc-sync name string inside
the `phase-0:foundation-gate` script body (negative assertion, not a caller).

---

## Explicit non-equivalences

Do **not** treat these as interchangeable:

| Command A | Command B | Why |
| --- | --- | --- |
| `verify:fast` | `pre-commit:fast` | Hook path adds lint-staged, path-gated guards, test-changed |
| `verify:fast` | `test:phase-0` | Different proof surface |
| `verify:fast` | `phase-6:fast-track` | Phase-6 adds defensive guards |
| `guard:marketing` | `marketing:control` | Different coverage + exit semantics (DEGRADED/BLOCKED) |
| `guard:marketing` | `marketing-guard.yml` jobs | CI subset ≠ full family |
| `guard:workspace` | `verify:product` workspace leafs | Partial overlap only; wiring family into verify duplicates work |
| `verify:full` | `phase-9:gate` | Different composition |

---

## Deprecation notice locations (S3.2)

Non-breaking notices live as `package.json` script comment keys (`//…`) adjacent to aliases. They do **not** alter command bodies.

Tagged in S3.2 / PSR removals:

- foundation/contract aliases listed above
- `guard:documentation-sync` (executable removed PSR-3c; `//` marker retained)
- `phase-3:doc-scaffold` (executable removed PSR-3c; `//` marker retained)

Not tagged yet (deferred — CI or semantics risk):

- `phase-0:foundation-gate` notice only as docs row (CI still canonical entry name)
- family leaf aliases
- phase gate chains
- finance/marketing CI commands

---

## Removal policy (future S3.3+)

A script may move from **Deprecated alias** → **Removed** only when **all** are true:

1. Canonical replacement exists and is documented here  
2. `git grep` shows no references in `apps/`, `packages/`, `scripts/`, `.github/`, tracked `docs/`  
3. No CI workflow invokes the name  
4. Architect approval recorded  
5. Wrapper retained for one release window **or** explicit break-glass note in CHANGELOG/docs  

Until then: **KEEP wrappers; do not delete.**

---

## S3.2 / S3.3 roadmap

| Phase | Scope |
| --- | --- |
| **S3.2 (this)** | Ownership map + safe deprecation notices + status report |
| **S3.3 (next)** | Optional docs sweep of AGENTS/tiered-testing examples; still no CI retarget / no deletions |
| **S4** | CI matrix simplification (finance integrity cutover) |
| **S5.1** | Composite CI setup (`CI_COMPOSITE_SETUP.md`) — docs → unused action → finance pilot → expand |
