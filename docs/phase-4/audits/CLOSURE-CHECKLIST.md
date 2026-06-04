# Phase 4 — Closure checklist (repo + doc)

```yaml
checklist_meta:
  date: "2026-06-04"
  audience: [agent, architect, CI]
  binding: REPO_SCRIPTS_OVER_STALE_MD
  fail_token: FAIL
  related:
    - IMPLEMENTATION-TRUTH.md
    - PHASE-4-GAP-REGISTER.md
    - phase-4-zero-debt-forensic-audit.mdoc
  precision_pack: ../appendices/PRECISION-DOC-INDEX.md
```

> **Order:** subphases 4.0→4.5 **VERIFIED** first · then **4.6** · then forensic `verdict` update.

---

## A — Environment (always)

```bash
nvm use && corepack enable   # Node >=24 <25
pnpm install
```

| Check | PASS when |
|-------|-----------|
| Node engines | `node -v` matches `package.json` |
| Docker (4.2+) | `docker compose -f infra/docker-compose.yml up -d` |

---

## B — Per subphase (IMPLEMENTATION-TRUTH)

| Subphase | Command / artifact | Ledger → VERIFIED |
|----------|-------------------|-------------------|
| **4.0** | `reports/phase-3.2-red-flag-status-*.md` + track prove_with | All R0–R3 evidence |
| **4.1** | `pnpm --filter @app-tour/tenant-kernel run build test test:phase-4` | Row 4.1 |
| **4.2** | `STORAGE_DRIVER=prisma` + `DATABASE_URL` + RLS integration test | Row 4.2 |
| **4.3** | `pnpm --filter @apps/api test -- tenant-security.spec` | Row 4.3 |
| **4.4** | `tenant-config.spec` + TH-1 e2e (when wired) | Row 4.4 |
| **4.5** | `pnpm --filter @app-tour/platform-events run build test` | Row 4.5 |
| **4.6** | `pnpm run phase-4:gate` exit 0 | Row 4.6 |

**Storage (4.2):** `apps/api/src/storage/create-tour-storage.ts` — env `STORAGE_DRIVER=memory|prisma` (not `TOUR_STORAGE`).

---

## C — Guard matrix (`phase-4:guard`)

| p4_* id | PASS means |
|---------|------------|
| `p4_red_flag_prerequisite` | Status report under `reports/` |
| `p4_tenant_kernel_build` | tenant-kernel build 0 |
| `p4_tenant_kernel_test` | ≥ threshold tests |
| `p4_platform_events_build` | platform-events build 0 |
| `p4_platform_events_test` | ≥ threshold tests |
| `p4_contract_spec` | `test:phase-4` 0 |
| `p4_no_denali_in_kernel` | rg denali = 0 |
| `p4_infra_compose` | compose file exists |
| `p4_rls_integration_tests` | `DATABASE_URL` + `STORAGE_DRIVER=prisma` + RLS/tenant-security specs exit 0 |
| `p4_anti_hollow_tests` | P4-E tests have real asserts |

```bash
pnpm run phase-4:guard
# read: reports/phase-4-gate-YYYY-MM-DD.json → "ok": true
```

---

## D — Documentation closure

| Step | File | Action |
|------|------|--------|
| 1 | `IMPLEMENTATION-TRUTH.md` | 7/7 VERIFIED |
| 2 | `PHASE-4-GAP-REGISTER.md` | All repo_verify green |
| 3 | `phase-4-zero-debt-forensic-audit.mdoc` | `verdict` → Zero-Debt Verified, gitSha, gateReport |
| 4 | `guard:doc-sync` | PASS |

---

## E — Forbidden closure claims

```yaml
forbidden:
  - "Phase 4 Closed from CONSISTENCY-REPORT PASS alone"
  - "Phase 4 Closed with 2/7 subphases VERIFIED"
  - "Phase 4 Closed without phase-4-gate ok:true"
  - "Doc score 99 implies execution complete"
```

---

## F — Phase 5 handoff (after 4.6 only)

- [`phase-4-enforcement.md`](../phase-4-enforcement.md) `phase_5_entry_requires_modular`
- [`phase-5/phase-5-agent-router.md`](../../phase-5/phase-5-agent-router.md)
