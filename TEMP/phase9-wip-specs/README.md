# Phase 9 — WIP spec scaffolds (promote train SoT)

```yaml
manifest_version: "2026-06-08-v2"
authority: docs/phase-9/appendices/SPEC-REGISTRY-OPERATOR.yaml
guard_blocker: null
truth_ledger: docs/phase-9/audits/IMPLEMENTATION-TRUTH.md
navigator: docs/phase-9/AGENT-NAVIGATOR.md
promote_status: COMPLETE
```

> **Agents:** All operator prove_with paths are **ON_TRUNK** as of 2026-06-08. Do not copy from here — use canonical paths in [`SPEC-REGISTRY-OPERATOR.yaml`](../../docs/phase-9/appendices/SPEC-REGISTRY-OPERATOR.yaml) `on_trunk`.

---

## Promote train — **COMPLETE**

| Train | Status | Guard |
| ----- | ------ | ----- |
| **T-9.1** | **DONE** | identity + operator CASL scaffolds |
| **T-9.2** | **DONE** | dashboard-smoke |
| **T-9.3** | **DONE** | tours operator + list + projection |
| **T-9.4** | **DONE** | users directory |
| **T-9.5** | **DONE** | bookings ops |
| **T-9.6** | **DONE** | settings registry |
| **T-9.7** | **DONE** | finance-ops + finance-page + finance-admin |
| **T-9.8** | **DONE** | operator-smoke + phase-9.contract |

Verify: `pnpm run phase-9:guard` → **32/32 PASS**.

---

## Canonical trunk index

See [`SPEC-REGISTRY-OPERATOR.yaml`](../../docs/phase-9/appendices/SPEC-REGISTRY-OPERATOR.yaml) `on_trunk` for the full path list per subphase 9.1–9.8.

---

## WIP-only (not Phase 9 promote)

| File | Note |
| ---- | ---- |
| `web/urban-owner-access.spec.ts` | Phase 8 regression reference — canonical path `apps/web/test/urban-owner-access.spec.ts` |

---

## Agent checklist (behavioral implementation PR)

1. Read [`IMPLEMENTATION-TRUTH.md`](../../docs/phase-9/audits/IMPLEMENTATION-TRUTH.md) — behavioral status remains **SPEC_ONLY** until scaffolds exit without `assert.fail`
2. Implement handlers/UI per subphase ERIP COP
3. `pnpm run test:changed`
4. `pnpm run phase-9:guard`
5. Update truth ledger behavioral rows — not scaffold rows
