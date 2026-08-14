# AR CSV export contract (PR23-D3-C)

```yaml
doc_id: FINANCE_AR_CSV_EXPORT_PR23_D3_C
version: "2026-08-09-v1"
status: READY_FOR_PR23_D3_C_IMPLEMENTATION
phase: PR23-D3-C
related:
  - docs/phase-20/p7/appendices/FINANCE_AR_AGING_SEMANTICS_PR23_D3_A.md
  - docs/phase-20/p7/appendices/FINANCE_AR_AGING_PERSISTENCE_PR23_D3_B.md
  - docs/phase-20/p7/appendices/FINANCE_OUTSTANDING_BALANCE_READ_MODEL_PR23_D1.md
  - docs/phase-20/p7/appendices/FINANCE_TOUR_COLLECTION_REPORT_PR23_D2.md
locks:
  money_sot: registration_invoice_compile_only
  aging_anchor: first_positive_remaining_v1
  aging_source: arOpenedAt_only
  collection_mode: manual_offline_first
  ledger_csv_reuse: forbidden
  payment_row_ar: forbidden
  online_gateway: forbidden
  refund_psp: forbidden
  browser_aggregation: forbidden
  ui_dashboard: out_of_scope
```

## Purpose

Lock the **AR CSV export** contract so D3-C implementation can proceed without inventing a second AR SoT or reusing ledger export.

Assumes D3-B aging persistence + outstanding-aging read model exist.

**No UI dashboard. No code in this document.**

## Product boundary (hard)

Manual/offline collection only.

Forbidden: online/PSP/gateway, refund/chargeback, ledger-as-AR, payment-row debt, browser/BFF balance math, SLA/dunning, automated collection.

---

## Decision 1 — Export ownership

| Layer | Responsibility |
| ----- | -------------- |
| **FinanceService** | Owns export: builds snapshot from outstanding-aging read path (invoice compile + `arOpenedAt` helpers). Produces **CSV text** and/or **typed row DTOs** + metadata. |
| **HTTP** | `GET /finance/reports/ar-export` (registration) and optional `GET /finance/reports/ar-export/tours` — auth + tenant gate + stream/body. |
| **BFF** | Proxy only (`proxyFinanceApiGet` / download headers). May set `Content-Disposition`. **Must not** recompute remaining, age, or buckets. |
| **Web UI (later)** | Download button only — consume file bytes. **Out of scope for D3-C impl contract’s first code drop** if UI deferred; API may ship first. |

### Why browser aggregation is forbidden

Today’s **ledger** CSV is assembled in the browser from an already-fetched ledger page (`buildFinanceLedgerCsvContent`). That pattern is **unacceptable for AR** because:

1. Outstanding universe can exceed a single UI page → incomplete export.  
2. Aging requires fixed `asOf` + `arOpenedAt` — client clock drifts.  
3. Risk of summing payments / mixing ledger columns.  
4. Tenant-scale and cursor consistency belong in FinanceService.

**Invariant:** AR CSV is server-authored from the same SoT as D1/D3-B reads.

---

## Decision 2 — Registration AR CSV shape

### Required columns (header order locked)

```text
registrationId
memberDisplayName
tourId
tourTitle
currency
invoiceTotalMinor
paidMinor
remainingMinor
arOpenedAt
arOpenedAtSource
ageDays
agingBucket
```

### Optional columns (allowed; append after required)

| Column | When |
| ------ | ---- |
| `registrationOpenedAt` | D1 sort clock (clarity vs aging) |
| `bookingPaymentStatus` | Ops hint only; not money |
| `asOf` | Per-row echo of snapshot (redundant with metadata; optional) |
| `agingAnchor` | Per-row echo of `first_positive_remaining_v1` |

### Formatting rules

| Rule | Decision |
| ---- | -------- |
| Amounts | **Minor units as integer strings** (no decimal conversion, no locale separators) — matches finance APIs |
| Empty identity | Empty string (not `null` token) |
| `arOpenedAt` | ISO-8601 UTC; empty if null (should be rare post-backfill) |
| `arOpenedAtSource` | Exact enum text: `observed_transition_v1` \| `backfill_provisional_v1` \| empty |
| `ageDays` | Decimal integer string; empty if null |
| `agingBucket` | `current` \| `1_30` \| `31_60` \| `60_plus` \| empty |
| CSV escaping | RFC-style quote when comma/quote/newline present (same spirit as ledger helper) |
| Line endings | `\n` |
| BOM | Optional UTF-8 BOM for Excel — **default off** in API; BFF may add later |

### Multi-currency

- Export may contain **multiple currencies** in one file **only if** each row carries `currency` (required).  
- Query may filter `?currency=IRR` for single-currency files.  
- **Never** add a footer “total” that sums across currencies.  
- Optional: one file per currency when `currency` filter omitted and tenant is multi-currency (D3-C default: **single file, multi-row currencies OK**).

### Inclusion

Same as outstanding aging: `remainingMinor > 0` only.  
Cancelled payments do not remove rows unless invoice remaining is 0.  
Pending payments do not invent rows.

---

## Decision 3 — Tour AR export

### Decision: **separate endpoint / file**

| Export | Endpoint (contract) | Source |
| ------ | ------------------- | ------ |
| Registration AR | `GET /finance/reports/ar-export` | D3-B outstanding-aging items |
| Tour AR | `GET /finance/reports/ar-export/tours` | **Σ of registration AR rows** (same snapshot), i.e. D2 aggregation rules over aging-eligible registrations |

**Not** `listPaymentsByTourAggregate`. **Not** payment pending counts.

### Tour CSV columns

```text
tourId
tourTitle
currency
registrationsCount
invoiceTotalMinor
collectedMinor
remainingMinor
```

Optional: aging rollups deferred (e.g. `remainingCurrentMinor`) — **out of D3-C MVP** unless trivial; default tour export is money rollup only, same currency grouping as D2 (one row per `(tourId, currency)`).

### Aggregation source

```text
Tour row = aggregate(registration AR export rows for that tour+currency)
```

Must equal D2 `listTourCollectionSummary` money fields for the same `asOf` universe (outstanding remaining > 0).

---

## Decision 4 — Large export strategy

| Concern | Decision |
| ------- | -------- |
| Snapshot | Single `asOf` + `agingAnchor` for entire export job |
| Ordering (registration) | Same as aging list: `ageDays DESC NULLS LAST`, `registrationId ASC` |
| Ordering (tour) | `remainingMinor DESC`, `tourId ASC`, `currency ASC` |
| Chunking | Prefer **streaming / chunked HTTP** built by walking keyset pages server-side inside one request **or** `?cursor=` multi-request export protocol |
| MVP (D3-C) | Server walks all pages internally with hard **row cap** (e.g. 10_000); if exceeded → `413` / domain error `AR_EXPORT_TOO_LARGE` with message to filter by `currency` or tour (tour filter optional later) |
| Determinism | Fixed `asOf` at start; no re-compile clock drift mid-export |
| Client cursor mode (optional) | If exposed: opaque cursor embeds `asOf`; client concatenates chunks without re-aging |

**Forbidden:** exporting only “currently loaded UI rows.”

---

## Decision 5 — Audit metadata

### HTTP headers (required)

| Header | Example |
| ------ | ------- |
| `Content-Type` | `text/csv; charset=utf-8` |
| `Content-Disposition` | `attachment; filename="finance-ar-{tenantShort}-{date}.csv"` |
| `X-Finance-Ar-As-Of` | ISO-8601 `asOf` |
| `X-Finance-Ar-Aging-Anchor` | `first_positive_remaining_v1` |
| `X-Finance-Ar-Currency-Scope` | `*` or specific currency code |
| `X-Finance-Ar-Tenant-Id` | tenant uuid (or omit if policy forbids echoing; then rely on auth context only) |

### Optional preamble (disabled by default)

If enabled via query `?meta=1`: first lines as `# key=value` comments before header — many tools break; **default off**. Prefer headers.

### Filename

```text
finance-ar-registrations-{tenantShort}-{yyyy-mm-dd}.csv
finance-ar-tours-{tenantShort}-{yyyy-mm-dd}.csv
```

Distinct from `finance-ledger-*`.

---

## Decision 6 — Security

| Control | Rule |
| ------- | ---- |
| Auth | Same operator finance read gate as other reports (`assertOperatorAccess`) |
| Tenant | RLS + `auth.tenantId` only; no cross-tenant |
| PII | `memberDisplayName` is ops-visible already; export inherits same role boundary — no guest email/phone unless already on aging DTO (D3-C does **not** add new PII fields) |
| No secrets | No receipt URLs, file keys, idempotency keys, ledger journal payloads |
| No payment ids | AR export is registration/tour scoped, not payment ledger |

---

## Decision 7 — Tests required

| # | Case |
| - | ---- |
| E1 | Registration CSV money columns **equal** D1/D3-B outstanding compile for same registrations |
| E2 | `agingBucket` / `ageDays` **match** D3-B helpers for same `(arOpenedAt, asOf)` |
| E3 | Export builder does not call ledger list / payment aggregate APIs |
| E4 | Multi-currency rows keep separate `currency`; no cross-total |
| E5 | Internal pagination/cursor with fixed `asOf` yields stable ages |
| E6 | Empty outstanding → header-only CSV (or header + zero data rows); `200` |
| E7 | Cancelled payment with remaining > 0 still exported; remaining from invoice |
| E8 | Pending payment does not inflate `paidMinor` |
| E9 | Tour export Σ equals sum of registration export rows per tour+currency |
| E10 | Filename/Content-Type distinct from ledger; no ledger column names |
| E11 | Unauthorized / wrong tenant denied |
| E12 | Over cap → explicit error (no silent truncate) |

---

## Decision 8 — Non-goals (confirm)

- No online payment / PSP / gateway fields  
- No automated collection / dunning  
- No invoice mutation  
- No UI dashboard / Command Center charts (download affordance may follow in a later UI slice)  
- No ledger CSV reuse or column merge  
- No payment-row AR calculation  
- No settlement redesign / refund  

---

## Export contract (summary)

```text
FinanceService.exportOutstandingArCsv(auth, { currency?, asOf? })
  → { contentType, filename, body: string, asOf, agingAnchor, currencyScope, rowCount }

FinanceService.exportTourArCsv(auth, { currency?, asOf? })
  → same metadata envelope; body = tour aggregation of registration AR snapshot
```

HTTP maps 1:1; BFF proxies; UI (later) downloads.

---

## Invariants

1. Money = invoice compile only.  
2. Aging = `arOpenedAt` + server `asOf` only.  
3. Registration export SoT = outstanding-aging read model.  
4. Tour export = Σ registration AR rows (not payment aggregates).  
5. Server-authored CSV; no browser AR math.  
6. Ledger export path remains separate forever.  
7. Manual/offline boundary preserved.  
8. One snapshot `asOf` per export.  
9. No silent truncation past max rows.

---

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Copying ledger client-CSV pattern | Contract forbids; review HTTP returns server body |
| Huge tenants | Hard cap + currency filter; later async job |
| asOf drift mid-walk | Capture asOf once at start |
| Analysts treat provisional aging as truth | `arOpenedAtSource` column required |
| Mixing tour+registration in one file | Separate endpoints/files |
| PII expansion | No new identity fields beyond aging DTO |

---

## PR23-D3-C implementation boundary

### In scope

1. FinanceService registration + tour AR CSV builders (from aging/outstanding SoT).  
2. HTTP `GET /finance/reports/ar-export` (+ `/tours`).  
3. BFF proxy routes with download headers.  
4. Metadata headers + filename conventions.  
5. Row cap + empty + auth tests (E1–E12).  
6. Docs status → AR export ready; note UI download as optional follow-up.

### Out of scope

- Command Center / Overview UI for export button (optional tiny follow-up, not required to close D3-C API)  
- Async email/S3 export jobs  
- Excel-specific formatting / FX conversion  
- Gateway/refund columns  
- Changing D3-A/B aging semantics  

### Exit

`READY_FOR_AR_EXPORT_CONSUMERS` (API+BFF green). Full Finance Ops Hub “Export” UX may land after.

---

## Status

`READY_FOR_PR23_D3_C_IMPLEMENTATION` — AR CSV contract locked.
