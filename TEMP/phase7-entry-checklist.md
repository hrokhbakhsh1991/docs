# Phase 7 — چک‌لیست ورود (Operational · 7.0)

```yaml
created: "2026-06-07"
source:
  - docs/phase-7/subphases/7.0-entry-gate.md
  - docs/phase-7/appendices/phase-6-bridge.md
  - reports/phase-7-entry-verified.yaml
truth_ledgers:
  - reports/phase-7-entry-verified.yaml
  - docs/phase-7/audits/IMPLEMENTATION-TRUTH.md
  - docs/phase-6/audits/IMPLEMENTATION-TRUTH.md
current_verdict: 7.0_ENTRY_PASS — مجاز به 7.1
target_verdict: phase_7_entry.verified_at set → مجاز به 7.1
forbidden_until_7_0_pass: "شروع 7.1-urban-package در حالی که yaml هنوز phase_6_gate: PENDING"
branch: phase-7/entry-gate
```

> **نحوه استفاده:** Tier 0 → Tier 1 → Tier 2.  
> **گام بعد از 7.0:** `7.1-urban-package` — `packages/workspaces/urban` (ABSENT تا الان).

---

## «الان کجاییم؟»

| لایه                              | وضعیت                   | blocker                                |
| --------------------------------- | ----------------------- | -------------------------------------- |
| Doc pack فاز ۷ (`phase-7:guard`)  | ✅ PASS (score 96)      | —                                      |
| فاز ۶ behavioral (Tier D)         | ✅ `phase_closed: true` | merge PR به `main`                     |
| `guard:import-boundary`           | ✅ PASS                 | —                                      |
| `URBAN_*` در apps/api core        | ✅ no matches           | —                                      |
| legacy runtime import             | ✅ no matches           | —                                      |
| `phase-6:fast-closure`            | ✅ exit 0 · ~261s       | `reports/phase-6-gate-2026-06-07.json` |
| **`phase-7-entry-verified.yaml`** | ✅ `verified_at` set    | REQ-P7-002 PASS                        |
| **`packages/workspaces/urban`**   | ❌ ABSENT (expected)    | بعد از 7.0 PASS                        |

---

## Tier 0 — Bootstrap

| #   | کار                        | وضعیت | دستور                                                |
| --- | -------------------------- | ----- | ---------------------------------------------------- |
| 0.1 | Node 24                    | `[x]` | `nvm use && node -v`                                 |
| 0.2 | شاخه ورود                  | `[x]` | `phase-7/entry-gate` از `phase-6/behavioral-closure` |
| 0.3 | Postgres (برای gateهای DB) | `[ ]` | docker compose phase-4                               |

---

## Tier 1 — 7.0 Entry Gate (P7-0)

| #   | کار                      | REQ        | دستور / معیار                                                       |
| --- | ------------------------ | ---------- | ------------------------------------------------------------------- |
| 1A  | Phase 6 closure evidence | REQ-P7-001 | `pnpm run phase-6:fast-closure` exit 0 (fast-track parity با فاز ۶) |
| 1B  | Import boundary          | REQ-P7-003 | `pnpm run guard:import-boundary` exit 0                             |
| 1C  | No urban creep           | REQ-P7-003 | `rg 'URBAN_' apps/api/src --glob '!**/workspace/**'` → empty        |
| 1D  | No legacy import         | REQ-P7-003 | `rg "from ['\"]legacy/" apps/api apps/web` → empty                  |
| 1E  | Entry ledger             | REQ-P7-002 | `reports/phase-7-entry-verified.yaml` → `verified_at` set           |
| 1F  | Denali bootstrap doc     | bridge     | `docs/phase-6/subphases/6.5-bootstrap.md` — urban الگو می‌گیرد      |

```bash
pnpm run phase-6:fast-closure
pnpm run guard:import-boundary
pnpm run phase-7:guard
```

---

## Tier 2 — بعد از 7.0 (7.1)

| #   | کار                 | دستور                                                    |
| --- | ------------------- | -------------------------------------------------------- |
| 2.1 | Urban package shell | `docs/phase-7/subphases/7.1-urban-package.md`            |
| 2.2 | الگو                | `packages/workspaces/starter` + `URBAN-MINIMAL-SCOPE.md` |
| 2.3 | ممنوع               | وابستگی به `@app-tour/workspace-denali`                  |

---

## CI / merge

| اقدام                                       | وضعیت                             |
| ------------------------------------------- | --------------------------------- |
| Merge `phase-6/behavioral-closure` → `main` | ⏳ دستی (gh auth نیست)            |
| `phase-6-gate.yml` روی main                 | بعد از merge                      |
| full `phase-6:gate`                         | Sunday cron / `workflow_dispatch` |

---

## یادداشت export fix (Tier D)

`TourCreatedLedgerPayload` از `@app-tour/workspace-denali` در `index.ts` re-export شد — build api بدون آن fail می‌کرد.
