# Finance CI Migration Status

**Initiative:** Platform Simplification (S4)  
**Decision:** `READY_FOR_CUTOVER` (executed through Stage B)  
**Docs stage:** **A — Documentation synchronized** (this document)  
**CI stage:** **B complete** on `thin` @ `519dd546` — legacy automatic triggers disabled  
**Next:** Stage C observation window

---

## Current State

- Canonical automatic finance CI: **`.github/workflows/finance-integrity.yml`**
- Dual-run evidence completed on SHA `cadb02f2` (PR #24) before Stage B:
  - Shadow: [30380261664](https://github.com/hrokhbakhsh1991/docs/actions/runs/30380261664)
  - Legacy core: [30380261589](https://github.com/hrokhbakhsh1991/docs/actions/runs/30380261589)
  - Legacy golden: [30380261583](https://github.com/hrokhbakhsh1991/docs/actions/runs/30380261583)
- Stage B commit: `519dd546` — `ci(finance): disable legacy automatic workflow triggers`
- Legacy YAML files remain on disk for **rollback** / optional `workflow_dispatch` only (no PR/push).
- Shared product note: `Test finance-core` may still fail identically under integrity (out of S4 assertion-weakening scope).

---

## Canonical Workflow

```text
.github/workflows/finance-integrity.yml
```

Triggers: `pull_request` (paths), `push` to `main` (paths), `workflow_dispatch`.

| Job check `name:` (unchanged) | Role |
| --- | --- |
| `Finance-core boundary (guard + test + build)` | Boundary / portability / build / test (+ golden guard) |
| `Finance golden architecture (G1–G7)` | Golden guard + API node:test mirror |

Path filter = union of former finance-core + finance-golden path sets (+ integrity / legacy self-watches).

---

## Legacy Workflows

| File | Status |
| --- | --- |
| `.github/workflows/finance-core-boundary.yml` | **Deprecated** — automatic `push`/`pull_request` removed (Stage B). `workflow_dispatch` retained for rollback verification. |
| `.github/workflows/finance-golden-architecture.yml` | **Deprecated** — same as above. |

Do **not** treat legacy filenames as the primary CI entrypoint. Prefer integrity for all operational references.

---

## Cutover Stages

### Stage A — Documentation migration *(docs sync)*

- Point ACTIVE docs at `finance-integrity.yml`.
- Legacy filenames only as deprecated / historical / rollback.
- No branch-protection or check-name renames in docs scope.

### Stage B — Disable legacy automatic workflows *(done)*

- Legacy `on:` reduced to `workflow_dispatch` only (`519dd546`).
- Integrity remains sole automatic emitter of the two finance check names.

### Stage C — Observation window

- Confirm finance-path PRs show a single pair of finance checks from integrity (no legacy workflow runs on synchronize).
- Re-verify path-class behavior (shared vs workspace-finance-only expansion).

### Stage D — Archive/remove legacy workflows

- Optional delete of deprecated YAML after observation.
- Optional later: Architect YES before adding finance names to required checks.

---

## Rollback Strategy

1. **Docs:** revert the documentation commit(s); does not restore legacy automatic CI by itself.
2. **CI (after Stage B):** restore pre-B `push`/`pull_request` blocks on the two legacy YAML files from git history (e.g. `git checkout <pre-519dd546> -- .github/workflows/finance-core-boundary.yml .github/workflows/finance-golden-architecture.yml`). Expect temporary duplicate check names if integrity still runs.
3. **Never** rename the two GitHub check `name:` strings during an incident.
4. **Never** weaken `--frozen-lockfile` or skip finance-core tests to “green” cutover.

---

## Related docs

- [`FINANCE_GOLDEN_ARCHITECTURE_TESTS.md`](../phase-20/p7/appendices/FINANCE_GOLDEN_ARCHITECTURE_TESTS.md)
- [`FINANCE_PLATFORM_EVOLUTION_PLAN.md`](../phase-20/p7/appendices/FINANCE_PLATFORM_EVOLUTION_PLAN.md) — Phase 2.2.3
- [`COMMAND_OWNERSHIP_MAP.md`](./COMMAND_OWNERSHIP_MAP.md)
- [`docs/dev/tiered-testing.md`](../dev/tiered-testing.md)
