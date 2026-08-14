# Denali Finance Audit Surfaces — PR21-G5

```yaml
doc_id: DENALI_FINANCE_AUDIT_SURFACES_PR21_G5
version: "2026-08-09-v1"
status: READY_FOR_REVIEW
phase: PR21-G5
continues:
  - DENALI_FINANCE_OVERVIEW_ATTENTION_PR21_G4
locks:
  - FinanceService / finance-core / Case / Meaning / Command Bridge / SoT / APIs / BFF / DB unchanged
  - No ledger event generation/order/payload changes; CSV keeps raw eventType
  - No N+1; no invented amounts; Ledger stays audit-only; Meaning stays semantic
scope: apps/web Ledger presentation + Denali Case Encounter labels / Meaning chrome
```

## Audit summary

### Ledger

| Question | Finding |
| -------- | ------- |
| User-facing today | `formatLedgerEventLabel` → English “double entry applied”; FA subtitle still says “outbox” |
| Implementation ids | `event.eventType`, `journalId`, `outboxEventId` (CSV) |
| Event set | Stable known: `finance.ledger.double_entry_applied` (primary); `finance.ledger.capture` appears in core tests |
| Amount in list DTO | **Absent** — do not fetch per row |
| Identity | `registrationContext` already on rows when present |
| CSV | Must keep raw `eventType` / ids unchanged |

Target row:

```text
Human FA/EN label
Member · Tour (compact)
Timestamp · line count
Details ▾ → raw event type · journal id
```

### Meaning / Case

| Question | Finding |
| -------- | ------- |
| English leaks | `Refresh`, `Loading encounter…`, section titles, readings, “Finance Case” in FA guidance |
| Labels source | `DENALI_CASE_ENCOUNTER_LABELS` overlays English defaults from `finance-case-encounter-ui` |
| Filter | UUID-only in Command Center chip; optional Member · Tour from existing strip payment cache (no new fetch) |
| Loading vs empty | Host has distinct `loading` / `error` / `ready`; empty Meaning is “needs registration” at embed level |

### Cross-surface

Prefer existing Finance FA terms: پرداخت / رسید / تسویه / دفتر / معنای تجاری / پرونده مالی — do not invent synonyms.

## Non-goals

Overview redesign, Payments density, Ledger → queue, Case semantic changes, API amounts.
