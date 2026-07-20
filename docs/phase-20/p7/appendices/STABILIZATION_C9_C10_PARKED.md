# C9 / C10 — Parked residuals (product + boundary)

```yaml
doc_id: STABILIZATION_C9_C10_PARKED
status: PARKED
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
```

## C9 — Portal login modal

| Field | Value |
| ----- | ----- |
| Severity | P1 product |
| Location | Branch `wip/portal-psc-20260718` @ `25f995c7` (+ related `stash@{2}`) |
| On capacity tip? | **No** |
| Stabilization verdict | **Parked** — not part of capacity/hostile train |
| Reclaim rule | Explicit product ticket; do not cherry into tip without UX owner review |
| Related | [STABILIZATION_WP0_DEV_RECONCILE.md](./STABILIZATION_WP0_DEV_RECONCILE.md) §5 |

**Why parked:** Modal work lives on a PSC WIP branch. Pulling it into the capacity tip would mix product UX with concurrency/authority hardening and re-open DEV asymmetry.

## C10 — Package-boundary allowlist “rubber-stamp”

| Field | Value |
| ----- | ----- |
| Severity | P1 process (misread risk) |
| Symptom | `package.json` / workspace allowlists include finance + booking workspaces |
| False conclusion | “Allowlist means no isolation” |
| Actual isolation | **Import-boundary AST** + workspace isolation guards + codegen binding rules |
| Stabilization verdict | **Parked as documentation residual** — not a code defect on tip |
| Owner path | Keep enforcing `pnpm run guard:import-boundary` / workspace isolation; do not “fix” by shrinking allowlist without codegen redesign |

**Why not code-fixed here:** Equality of package sets is the wrong invariant. Isolation is proven by AST import graphs and phase guards, not by whether a package name appears in an allowlist required for drop-in registration.

## Explicit non-work

- Do not start portal modal implementation on this tip under Stabilization continue.
- Do not rewrite package-boundary allowlists without Architect `YES` + codegen impact analysis.
