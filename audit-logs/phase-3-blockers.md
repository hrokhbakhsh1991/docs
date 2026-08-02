# Phase 3 — Active blockers (debt flags)

**Accepted readiness:** `phase-3-readiness-2026-06-04`  
**Purpose:** Track open P0 work before treating Phase 3 as production-ready.  
**Persona:** Workspace / App Integration Architect — dependency graph isolation + canonical SoT only.

---

## Closed this session (do not re-open without regression)

| ID | Item | Resolution |
|----|------|------------|
| **P0-01** | CI pipeline + `phase-3:gate` artifact | `scripts/ci-integrity-check.sh` runs phases 0→3; run `pnpm run phase-3:gate` → `reports/phase-3-gate-2026-06-04.json` |
| **P0-02** | API storage (Prisma + memory) | `TourStorageRepository` + `STORAGE_DRIVER` + `apps/api/prisma/schema.prisma` |
| **P0-03** | Production auth path | `auth-env.ts` — dev bearer only `NODE_ENV=test`; boot throws otherwise; prod warns on `DEV_TENANTS` |
| **P0-04** | Wizard binding | `workspace-wizard-host.tsx` + `tour-wizard-draft-path.ts` — `canonicalPath` from render plan |
| **P0-05** | Field kind strategy | `wizard-field.tsx` read-only unsupported UI; `STARTER_ALLOWED_FIELD_KINDS` in starter-plugin-core |
| **3.3.x** | Select + Checkbox primitives | `@app-tour/ui-primitives/select` + `/checkbox`; wizard enum/boolean; engine `uiHints.enumOptions` |

---

## P0 — Task 1.2 scaffold debt

_All P0-02 … P0-05 closed 2026-06-04. Re-open only on regression._

---

## P0 — Task 1.3 Phase 2 leakage into Phase 3 workspace setup

These items are **not** missing packages; they are **incomplete Phase 2** capabilities that affect Phase 3 UX if ignored.

| ID | Leakage | Impact on Phase 3 | Mitigation |
|----|---------|-------------------|------------|
| **L2-01** | **Select / Checkbox** (FT-P2-04) not shipped | Wizard cannot render `enum` / `boolean` from render plan | **Mitigated** — starter text-only + read-only fallback (P0-05); ship 3.3.x for full UX |
| **L2-02** | **Count-only** guard floors (Phase 2/3) | Tests can pass without behavioral depth | Add/strengthen contract specs per package; do not lower floors casually |
| **L2-03** | **P2-006** rgba literals in `primitives.css` | Visual inconsistency | Backlog — not blocking API |
| **L2-04** | Ingress documented as public API (CD-01) | Integrators might deep-import ingress | **Mitigated** — apps use `ThemeProviderChain` only; keep docs aligned |

---

## Explicit non-blockers (do not treat as P0)

- `packages/workspaces/denali` probe — depcruise negative fixture only (Phase 6).
- `platform-core` / `design-tokens` — no Phase 3 hacks found in audit.
- Phase 4 packages in `apps/api` (`tenant-kernel`, `platform-events`) — track as P1 overlap, not this file.

---

## Suggested order of execution

1. ~~P0-01~~ (done)
2. ~~P0-02~~ (done)
3. ~~P0-03~~ (done)
4. ~~P0-04 + P0-05~~ (done)
5. ~~3.3.x Select/Checkbox~~ (done 2026-06-04)
6. **Next:** Phase 4 entry (tenant-kernel RLS, dynamic plugin bootstrap P1-03) or Playwright soft backlog

---

## Commands

```bash
pnpm run phase-3:gate
# Report: reports/phase-3-gate-2026-06-04.json

pnpm run ci:integrity   # full 0→3 (pre-commit)
```

**Readiness source:** [`phase-3-readiness-report.md`](../docs/archive/root-forensics/phase-3-readiness-report.md)
