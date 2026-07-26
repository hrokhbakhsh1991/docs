# C9 / C10 — Parked residuals (product + boundary)

```yaml
doc_id: STABILIZATION_C9_C10_PARKED
status: C9_RECLAIMED — C10 still PARKED
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
```

## C9 — Portal login modal

| Field | Value |
| ----- | ----- |
| Severity | P1 product |
| Source | Branch `wip/portal-psc-20260718` @ `25f995c7` (+ related `stash@{2}`) |
| On capacity tip? | **Yes** — reclaimed 2026-07-21 under `YES — IMPL-PORTAL-MODAL` |
| Stabilization verdict | **RECLAIMED** (modal-only; finance/header/middleware left on WIP) |
| Evidence | [STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md](./STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md) |
| Related | [STABILIZATION_WP0_DEV_RECONCILE.md](./STABILIZATION_WP0_DEV_RECONCILE.md) §5 |

**Reclaim note:** Only PCMS login modal surfaces landed. Finance/booking, member-header redesign, and middleware cookie-host spikes from the WIP snapshot remain out of scope.

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

- Portal modal reclaim completed — see [STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md](./STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md).
- Do not rewrite package-boundary allowlists without Architect `YES` + codegen impact analysis.
