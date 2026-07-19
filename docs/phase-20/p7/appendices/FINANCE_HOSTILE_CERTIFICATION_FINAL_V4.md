# Enterprise finance certification (re-score v4)

```yaml
cert_id: FINANCE_HOSTILE_CERTIFICATION_FINAL
version: "4.0"
date: "2026-07-19"
compares_to: FINANCE_HOSTILE_CERTIFICATION_FINAL_V3 (composite 76 / five-dimension)
method: evidence-only re-score after Phase 3.17–3.18 + identity + multi-product hostile
delta_inputs:
  - OUTBOX_PRODUCTION_REPLAY.md
  - FINANCE_SLO_FRAMEWORK.md / FINANCE_SLO_COVERAGE.md / deploy alerts+dashboard
  - FINANCE_RECON_REPAIR_ENGINE.md
  - FINANCE_ADAPTER_IDENTITY_STABILITY.md
  - FINANCE_HOSTILE_MULTI_PRODUCT_CERTIFICATION.md
  - code: outbox-prod-replay, finance-recon repair-*, assertStableCaptureIdentities, finance-slo.*
constraints:
  - no speculative suggestions
  - scores require code or checked-in deploy/doc evidence
```

## Final score

| Dimension | v3.0 | v4.0 | Δ | Evidence delta |
| --------- | ---: | ---: | -- | -------------- |
| **Architecture** | 75 | **78** | +3 | Identity fail-closed at adapter+host; repair engine inside host/outbox boundaries; registry multi-type composition unchanged |
| **Correctness** | 82 | **86** | +4 | Deterministic journal/line seeds; repair reuses capture/prepay ids; INV identity specs green |
| **Security** | 78 | **81** | +3 | Prod ops JWT `outbox:replay`; recon HTTP gated by ops JWT in production auth mode |
| **Operations** | 68 | **86** | **+18** | Prod replay modes + dry-run/`REPLAY` confirm + audit; recon repair matrix apply; SLO pack |
| **Maintainability** | 79 | **84** | +5 | Replay/SLO/repair/identity/multi-product doc pack + deploy guards + regression specs |
| **SRE** | — | **80** | new | SLO-F1…F7, error-budget policy, `finance-slo.yaml` + dashboard, latency budget counters |
| **Recovery** | — | **82** | new | Failed→pending replay; recon preview/manual/approved/automatic; booking-sync degraded retry; rollback strategies on matrix |
| **Multi-product readiness** | — | **45** | new | Engine/ledger/receipt OWN **PASS**; ops/workflows/reports/dashboards/permissions product parity **FAIL** |

**Five-dimension continuity composite (Architecture…Maintainability):** **83 / 100** (v3.0 **76**, **+7**)

**Eight-dimension enterprise composite:** **78 / 100**

```text
(78+86+81+86+84+80+82+45) / 8 = 77.75 → 78
```

---

## Classification

| Label | Verdict | Basis |
| ----- | ------- | ----- |
| **Internal Platform** | **YES** | Money path certified for monorepo reuse; extraction still unnecessary (`FINANCE_CORE_EXTRACTION_DECISION` A) |
| **Enterprise Platform** | **YES — money path** · **NO — multi-SKU catalog** | v3 enterprise blockers (prod replay, numeric SLOs, recon repair apply) cleared on evidence; multi-product hostile cert still FAIL |
| **Reference Platform** | **NO** | Packages `private`; publish path not executed; external-host packed-only path not a published reference |

**Primary label:** **Enterprise Platform (money path)** with Internal Platform reuse certified. Not a Reference Platform. Not a multi-product enterprise catalog.

---

## v3 claim re-verification

| ID | v3.0 | v4.0 | Evidence |
| -- | ---- | ---- | -------- |
| P0 Receipt authorization | PASS | **PASS** | unchanged ownership gate |
| P0 Ledger durability | PASS | **PASS** | `FINANCE_LEDGER_CAPTURE_EMPTY` + Prisma non-empty capture |
| P0 Duplicate credit | PASS | **PASS** | advisory lock + wallet credit XOR |
| P1 Reconciliation repair | PARTIAL | **PASS** (matrix) | `repair-matrix.ts` + handlers: paid-no-ledger, prepay-no-ledger, outbox-failed, booking drift/degraded; dual-control `approvedConfirm` |
| P1 Prod outbox replay | FAIL | **PASS** | `outbox-replay.ts`: prod → `outbox:replay` JWT; dry-run default; `confirmPhrase: "REPLAY"`; `outbox_replay_runs` |
| P1 Written SLOs | FAIL | **PASS** | `FINANCE_SLO_FRAMEWORK.md` F1–F7 + `deploy/alerts/finance-slo.yaml` + `deploy/dashboards/finance-slo.json` + `guard:deploy-finance-slo` |
| Adapter identity stability | residual | **PASS** | `FINANCE_ADAPTER_IDENTITY_STABILITY.md` + specs |
| Multi-product parity | residual | **FAIL** | `FINANCE_HOSTILE_MULTI_PRODUCT_CERTIFICATION.md` |

---

## Dimension notes (evidence-only)

### Architecture — 78
- Composition: `workspaceType` → generated dependency/CoA/reaction/ops bindings.
- Capture identities fail-closed (`assertStableCaptureIdentities`).
- Residual: `BOOT_FINANCE_WORKSPACE_TYPE = "denali"`; generated HTTP handler names `DENALI_FINANCE_HTTP_*`; web `data-denali-*` chrome.

### Correctness — 86
- Durable Paid⇒capture, prepay enqueue conflict, Path A/B XOR credit hold.
- Stable adapter ids across replay/retry/recon rebuild.
- Residual: `domainEventId` truncate 128; prepay idempotent key ignores body amount change (no double money); amount-mismatch / dup-capture / stuck-pending / double-wallet repairs are **ticket_ack only**.

### Security — 81
- Member receipt ownership; operator gates; tenant RLS model unchanged.
- Prod internal replay/recon require ops JWT.
- Residual: recon HTTP reuses `OPS_SCOPE_METRICS_READ` (not a dedicated `finance:recon` scope).

### Operations — 86
- Detect R-codes + findings store + repair engine + runner auto-repair flag path.
- Prod replay selection modes (single/batch/tenant/workspace/date_range).
- Residual: ticket-only codes require human GL/ops outside automated money heal.

### Maintainability — 84
- Doc-as-code pack for remediations; onboarding specs ws3–ws6; identity + repair matrix specs; deploy guards for SLO/ops alerts.

### SRE — 80
- Numeric objectives + error-budget policy + burn alerts + latency budget counters in finance-core.
- Residual (documented in `FINANCE_SLO_COVERAGE.md`): no native Prometheus histograms (true p95); payment create lacks success/failure counter pair; Grafana JSON requires cluster import.

### Recovery — 82
- Outbox failed→pending with audit; recon repair rollback strategies; prepay booking-sync degraded list + retry repair action.
- Residual: no reversing-journal HTTP; several divergences only `ticket_only`.

### Multi-product readiness — 45
- OWN ledger + receipt defaults across denali/ws2–ws6.
- FAIL: opsManifest only denali+ws5; TourCreated money workflow Denali-only (ws* stub/no-op); shared reports/dashboards/permissions; IRR UI fallbacks; ws2 registryOnly.

---

## Remaining debt

| Pri | Debt | Evidence |
| --- | ---- | -------- |
| **P0** | Multi-product ops/workflow parity incomplete for supported SKUs ws3/ws4/ws6 | No `opsManifest`; TourCreated reactions stub/no-op |
| **P1** | Generic web finance forms/logic default currency **IRR** | `apps/web/src/finance/finance-*-logic.ts`, panel form defaults |
| **P1** | Recon ops JWT scope shared with metrics read | `OPS_SCOPE_FINANCE_RECON = OPS_SCOPE_METRICS_READ` |
| **P1** | Repair codes without money heal: amount mismatch, dup capture, stuck pending, double wallet | `repair-matrix.ts` → `ticket_ack` / `ticket_only` |
| **P1** | Boot finance workspace hard-defaults to denali | `BOOT_FINANCE_WORKSPACE_TYPE` |
| **P2** | SRE: gauge+budget counters stand in for histogram p95 | `FINANCE_SLO_COVERAGE.md` gaps |
| **P2** | UI Denali chrome tokens (`DenaliSkeleton`, `data-denali-surface`) | `apps/web/src/finance/*` |
| **P2** | `FINANCE_HOSTILE_ACCOUNTING_INTEGRITY.md` still lists automated repair **FAIL** (stale vs repair engine) | integrity doc rows vs `recon/repair-*` |
| **P2** | `domainEventId` 128-char truncation collision class | prior hostile accounting residual |

Open **P0 money-integrity** items from v2/v3 (IDOR receipt, empty capture, double wallet credit): **cleared**.

---

## Technical recommendations

Only actions that close documented debt above (no redesign proposals):

1. **Add `opsManifest` for every `workspaceFinance.supported` SKU that shows finance nav** (`finance-ws3`, `finance-ws4`, `finance-ws6`), matching the denali/ws5 binding pattern — or remove those ids from nav bindings until manifests exist.
2. **Replace IRR hard-defaults in `apps/web/src/finance/*`** with values from resolved receipt-defaults / ops `currencies` for the active `pluginId`.
3. **Introduce a dedicated ops JWT scope for finance recon** (stop aliasing `metrics:read`) in `finance-recon.ts` + verify-ops allowlist.
4. **Require `FINANCE_BOOT_WORKSPACE_TYPE` in production auth mode** (fail closed if unset) instead of implicit `"denali"`.
5. **Align TourCreated reaction behavior with product claims**: either implement non-stub reactions for sold SKUs or mark those SKUs ledger-capture-only in manifests/docs (ws6 already no-op).
6. **Refresh `FINANCE_HOSTILE_ACCOUNTING_INTEGRITY.md` repair rows** to PASS/PARTIAL per `FINANCE_RECON_REPAIR_ENGINE.md` matrix (ticket_only codes remain PARTIAL).
7. **Keep ticket_only repairs ticket_only** until a compensating journal API exists — do not auto-heal amount mismatch / dup capture without that API.

---

## Questions

| # | Question | Verdict |
| - | -------- | ------- |
| 1 | Ready for **enterprise production** (money path)? | **YES** — with residual debt table |
| 2 | Ready for **10 peer enterprise products**? | **NO** |
| 3 | Ready for **internal platform reuse**? | **YES** |
| 4 | Ready as **published reference platform**? | **NO** |
| 5 | Extraction required? | **NO** (decision A stands) |

---

## One-line cert (v4.0)

**Enterprise Platform (money path): certified at 83/100 five-dim · 78/100 eight-dim (+7 continuity). Multi-product catalog and Reference Platform: not certified.**
