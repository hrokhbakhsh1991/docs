# Phase 2 paranoid audit (apps/api)

**Audit date:** 2026-06-05  
**Red Team closure:** 2026-06-05  
**Scope:** `apps/api` observability sinks, trace/tenant ALS, metrics, HTTP error surfaces, audit trail, middleware context, unstructured I/O, and automated verification scripts/tests.

---

## Red Team closure — Phase 2 trust score & Must-Fix

**Role:** Adversarial static + behavioral review (assume malicious tenant, noisy neighbor, misconfigured deploy, and headerless clients).  
**Verdict:** **Conditionally acceptable for Phase 2 integration work** on Postgres with correlation headers; **not signed off for production forensics/billing** until Must-Fix items land.

### Trust Score: **90 / 100** (steps 1–7 closed — Fix-next complete)

| Pillar (weight)                  |       Score | Rationale                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ----------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Observability coverage** (50%) | **46 / 50** | Phase 2 Fix-next complete through DEC-049: structured logging, trace correlation (HTTP + outbox), forensic audit create/update, access log `correlation_id`, tenant-scoped metrics guard (**MET-API-01**). Residual: Phase 7 export / relay trace (**TRACE-LOST-02**).                                                      |
| **Leak resistance** (50%)        | **44 / 50** | HTTP handler clears ALS per request (**verify-als-request-cleanup** PASS); no stack/SQL in tenant 500 bodies; tenant metrics fail-closed on missing `tenant_id` (DEC-049); **zero `console.*` in `src/`** (DEC-043); production cannot boot on memory driver (DEC-045). Deductions: scheduler footgun (**ALS-FOOTGUN-01**). |

**Score bands (reference):** 90–100 production-ready · 75–89 ship with Must-Fix · 60–74 material rework · under 60 do not trust.

### Phase 2 status summary

| Area                       | Status    | Headline                                                                                                               |
| -------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Structured logging**     | **Green** | Request path uses pino; **LOG-V-01** closed — `graceful_shutdown.failed` via pino; `guard:no-console-src` (DEC-043).   |
| **Trace / correlation**    | **Green** | Single-resolve trace at `app.ts`; access logs carry `correlation_id` (**TRACE-LOST-01** closed DEC-048).               |
| **Metrics / usage**        | **Green** | Tenant-scoped counters fail-closed without `tenant_id` (**MET-API-01** closed DEC-049); **OBS-MET-01** spec.           |
| **HTTP error surface**     | **Green** | 500/503 opaque; validation 400 intentional; internal routes minor bypass (**ERR-BYPASS-01**).                          |
| **Audit (`audit_events`)** | **Green** | `TOUR_CREATED` + `TOUR_UPDATED` in Prisma atomic TX (DEC-047); memory driver **non-forensic** by design (dev/CI only). |
| **ALS / tenant isolation** | **Green** | No post-request ALS on HTTP listener; concurrent burst clean; middleware does not fork context.                        |
| **Log backpressure**       | **Green** | 1000× `/health` burst: no client latency regression attributable to logging (**LOG-BP-01**).                           |
| **Automated evidence**     | **Green** | 15+ targeted specs + `scripts/verify-als-request-cleanup.ts` + `scripts/log-backpressure-burst.ts`.                    |

**Strengths (keep):** Fail-closed tenant rate limiter; append-only `audit_events` trigger; RLS-aligned audit reads; error interceptor centralization; minimal production log surface (7 pino sites).

**Residual risk (accept or schedule):** Phase 7 outbox trace continuation (**TRACE-LOST-02**); internal route correlation (**ERR-BYPASS-01**).

### Must-Fix list (blocks Red Team sign-off for production)

These are **P0** or production-impacting **P1** items — fix before calling Phase 2 observability “closed” for prod.

| #     | ID                                           | Action                                                                                                                                                       | File / area                                                               | Why Must-Fix                                                                                                          |
| ----- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **1** | **LOG-V-01** / **STD-BYPASS-02**             | **Done** (DEC-037 + DEC-043) — `logger.error({ event: "graceful_shutdown.failed", code: "GRACEFUL_SHUTDOWN_FAILED" })`; `guard:no-console-src` locks `src/`. | `src/server/graceful-shutdown.ts`                                         | Was only production unstructured sink; may leak Prisma/SQL/path text on SIGTERM.                                      |
| **2** | **TRACE-REGEN-01** / **TRACE-CONTEXT-SPLIT** | **Done** (DEC-044) — `runWithHttpRequestContext` reuses `getActiveTraceId()` when outer `app.ts` bind is active.                                             | `http/bind-request-context.ts`                                            | Headerless clients get **different** trace ids for DB work vs error `correlationId` — breaks incident reconstruction. |
| **3** | **AUDIT-GAP-01**                             | **Done** (DEC-045) — production boot fail-closed on memory; `isForensicStorageDriver()`; `guard:forensic-storage`; memory documented **non-forensic**.       | `create-tour-storage.ts` · `production-runtime-env.ts` · deploy checklist | Was compliance blind spot if prod ran memory — now boot throws `PRODUCTION_STORAGE_DRIVER_FORBIDDEN`.                 |

### Phase 2 closure — step 1 (DEC-043)

| Gate                      | Status   | Evidence                                                 |
| ------------------------- | -------- | -------------------------------------------------------- |
| LOG-V-01 shutdown sink    | **Done** | `graceful-shutdown.ts` — pino `graceful_shutdown.failed` |
| STD-BYPASS-02 prod bypass | **Done** | Zero `console.*` in `src/` runtime                       |
| STD-BYPASS-01 CI lock     | **Done** | `pnpm run guard:no-console-src`                          |
| Regression spec           | **Done** | `graceful-shutdown.spec.ts`                              |

```bash
cd apps/api && pnpm run guard:no-console-src
node --import tsx --test src/server/graceful-shutdown.spec.ts
```

**Must-Fix open after step 1:** **2** (TRACE-REGEN-01, AUDIT-GAP-01).

### Phase 2 closure — step 2 (DEC-044)

| Gate                          | Status   | Evidence                                             |
| ----------------------------- | -------- | ---------------------------------------------------- |
| TRACE-REGEN-01 single resolve | **Done** | `bind-request-context.ts` reuses outer trace ALS     |
| TRACE-CONTEXT-SPLIT           | **Done** | No second `randomUUID()` on headerless `/tours` path |
| Regression spec               | **Done** | `bind-request-context.spec.ts`                       |

```bash
cd apps/api
node --import tsx --test src/http/bind-request-context.spec.ts
node --import tsx --test test/2-observability/trace-isolation.spec.ts
```

**Must-Fix open after step 2:** **1** (AUDIT-GAP-01).

### Phase 2 closure — step 3 (DEC-045)

| Gate                             | Status   | Evidence                                                                                                                                       |
| -------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Production prisma + DATABASE_URL | **Done** | `assertProductionStorageDriver()` in factory + `assertProductionRuntimeIntegrity()` at boot                                                    |
| Memory non-forensic contract     | **Done** | `isForensicStorageDriver()` · [`storage-driver-truth.md`](../../../docs/phase-4/appendices/storage-driver-truth.md) § Forensic vs non-forensic |
| CI lock                          | **Done** | `pnpm run guard:forensic-storage`                                                                                                              |
| Regression spec                  | **Done** | `forensic-storage-driver.spec.ts` · `create-tour-storage.spec.ts` · `production-runtime-env.spec.ts`                                           |

```bash
cd apps/api
pnpm run guard:forensic-storage
node --import tsx --test src/storage/forensic-storage-driver.spec.ts
node --import tsx --test src/storage/create-tour-storage.spec.ts
node --import tsx --test src/server/production-runtime-env.spec.ts
```

**Must-Fix open after step 3:** **0** — all Phase 2 Must-Fix items closed. Fix-next (AUDIT-GAP-02, TRACE-LOST-\*) remains for full observability parity.

### Phase 2 closure — step 4 (DEC-046)

| Gate                              | Status   | Evidence                                                                  |
| --------------------------------- | -------- | ------------------------------------------------------------------------- |
| Outbox HTTP correlation on create | **Done** | `correlationId: getActiveTraceId()` in `atomic-canonical-tour-persist.ts` |
| Null when trace ALS absent        | **Done** | `enqueue-domain-event.ts` maps `undefined` → `NULL`                       |
| CI lock                           | **Done** | `pnpm run guard:outbox-correlation`                                       |
| Regression spec                   | **Done** | `test/2-observability/outbox-http-correlation.spec.ts` (Postgres tier)    |

```bash
cd apps/api
pnpm run guard:outbox-correlation
DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
  NODE_ENV=test STORAGE_DRIVER=prisma \
  node --import tsx --test test/2-observability/outbox-http-correlation.spec.ts
```

**Fix-next open after step 4:** **3** (AUDIT-GAP-02, TRACE-LOST-01, MET-API-01). STD-BYPASS-01 closed in step 1.

### Phase 2 closure — step 5 (DEC-047)

| Gate                        | Status   | Evidence                                                                            |
| --------------------------- | -------- | ----------------------------------------------------------------------------------- |
| TOUR_UPDATED audit on PATCH | **Done** | `persistTourUpdateAtomically` in `atomic-canonical-tour-persist.ts`                 |
| Service routing             | **Done** | `CanonicalTourService.updateTourInActiveContext` when `useAtomicCanonicalPersist()` |
| CI lock                     | **Done** | `pnpm run guard:tour-update-audit`                                                  |
| Regression spec             | **Done** | `5.5-audit-events.spec.ts` — PATCH + rollback cases                                 |

```bash
cd apps/api
pnpm run guard:tour-update-audit
DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
  NODE_ENV=test STORAGE_DRIVER=prisma \
  node --import tsx --test test/5.5-audit-events.spec.ts
```

**Fix-next open after step 5:** **2** (TRACE-LOST-01, MET-API-01).

### Phase 2 closure — step 6 (DEC-048)

| Gate                   | Status   | Evidence                                                                 |
| ---------------------- | -------- | ------------------------------------------------------------------------ |
| Access log correlation | **Done** | `correlation_id` on `http.request` from `getActiveTraceId()` in `finish` |
| CI lock                | **Done** | `pnpm run guard:http-access-trace`                                       |
| Regression spec        | **Done** | `test/2-observability/access-log-correlation.spec.ts`                    |

```bash
cd apps/api
pnpm run guard:http-access-trace
NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/2-observability/access-log-correlation.spec.ts
```

**Fix-next open after step 6:** **1** (MET-API-01).

### Phase 2 closure — step 7 (DEC-049)

| Gate                      | Status   | Evidence                                                              |
| ------------------------- | -------- | --------------------------------------------------------------------- |
| Tenant metric label guard | **Done** | `TENANT_SCOPED_METRIC_NAMES` + runtime `METRIC_TENANT_LABEL_REQUIRED` |
| CI lock                   | **Done** | `pnpm run guard:tenant-metrics-labels`                                |
| Regression spec           | **Done** | `metrics.spec.ts` · `tenant-metrics.spec.ts`                          |

```bash
cd apps/api
pnpm run guard:tenant-metrics-labels
node --import tsx --test src/observability/metrics.spec.ts test/2-observability/tenant-metrics.spec.ts
```

**Fix-next open after step 7:** **0** — Phase 2 observability parity complete (steps 1–7).

### Phase 2 closure — step 8 (DEC-050)

| Gate                   | Status   | Evidence                                                 |
| ---------------------- | -------- | -------------------------------------------------------- |
| Formal regression gate | **Done** | `pnpm run phase-2:regression-gate`                       |
| Artifact               | **Done** | `test/reliability/phase-2-regression-gate.last-run.json` |
| Meta spec              | **Done** | `test/reliability/phase-2-regression-gate.spec.ts`       |

```bash
cd apps/api
pnpm run phase-2:regression-gate
# Postgres tier:
DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' pnpm run phase-2:regression-gate
```

### Phase 2 closure sign-off (DEC-051)

| Metric              | Value                                             |
| ------------------- | ------------------------------------------------- |
| **Trust score**     | **90 / 100** (production-ready band)              |
| **Must-Fix**        | **0** open                                        |
| **Fix-next**        | **0** open                                        |
| **Regression gate** | `phase-2:regression-gate`                         |
| **Verdict**         | **Phase 2 observability parity closed** for trunk |

**Scheduled (not blockers):** TRACE-LOST-02 (Phase 7 relay), ERR-BYPASS-01 (internal routes), MET-VALID-01 (empty `tenant_id` on metrics), Phase 3 slow-sink backpressure (FOF-LOG).

### Fix-next (P1 — not Must-Fix, required for full Phase 2 observability parity)

| ID                | Action                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------- |
| **TRACE-LOST-03** | **Done** (DEC-046) — `correlationId: getActiveTraceId()` on tour create outbox enqueue. |
| **AUDIT-GAP-02**  | **Done** (DEC-047) — `TOUR_UPDATED` in same TX as `PATCH /tours` on Prisma path.        |
| **TRACE-LOST-01** | **Done** (DEC-048) — `correlation_id` on `http.request` access logs.                    |
| **STD-BYPASS-01** | **Done** (DEC-043) — `guard:no-console-src` forbids `console.` under `apps/api/src/`.   |
| **MET-API-01**    | **Done** (DEC-049) — tenant-scoped `increment` requires `tenant_id` label.              |

### Verification commands (regression pack)

```bash
cd apps/api
NODE_ENV=test STORAGE_DRIVER=memory npx tsx scripts/verify-als-request-cleanup.ts
NODE_ENV=test STORAGE_DRIVER=memory npx tsx scripts/log-backpressure-burst.ts
NODE_ENV=test node --import tsx --test test/2-observability/log-privacy.spec.ts test/2-observability/trace-isolation.spec.ts test/2-observability/tenant-metrics.spec.ts test/0-security/context-resilience.spec.ts
```

### Section index (detail below)

| Section                                                                                | Topic                   |
| -------------------------------------------------------------------------------------- | ----------------------- |
| [Logger privacy](#static-analysis--logger-calls--unstructured-log-privacy)             | Pino / OBS-LOG-01       |
| [Trace lifecycle](#static-analysis--request--trace-id-lifecycle-maints--postgres)      | ALS → GUC → correlation |
| [Metrics](#static-analysis--metricsregistry--tenant-billing-cardinality)               | Billing cardinality     |
| [Global errors](#static-analysis--global-http-error-handler-tenant-response-leak)      | HTTP leak resistance    |
| [Log backpressure](#empirical--logging-backpressure-1000-request-burst)                | Burst / buffer          |
| [Audit events](#static-analysis--audit_events-schema--sensitive-mutation-coverage)     | Forensic coverage       |
| [Middleware ALS](#static-analysis--http-middleware--als-context-propagation)           | Context propagation     |
| [Console bypass](#static-analysis--unstructured-io-bypass-console--processstdout)      | Unstructured I/O        |
| [ALS cleanup script](#verification--asynclocalstorage-cleared-after-each-http-request) | Post-request ALS        |

---

## Static analysis — logger calls & unstructured log privacy

**Audit date:** 2026-06-05  
**Scope:** Static analysis of all `logger` / `logHttpRequest` (pino) and `console.*` call sites under `apps/api/` (excluding `node_modules`, `dist`).

### Method

1. Ripgrep inventory: `logger.(info|warn|error|debug|trace|fatal)`, `logHttpRequest`, `console.(log|info|warn|error|debug)` across `**/*.{ts,tsx,mjs,js}`.
2. Manual review of each call site for:
   - **String interpolation** in the human-readable message (`pino` 2nd argument `msg`, or sole `console` string argument).
   - **Object spread** in the first logging argument (`{ ...x }`) — assessed for whether spread values could surface `tenant_id`, `userId`, or PII in **unstructured** output (not merely structured JSON fields).
3. Contract aligned with `test/2-observability/log-privacy.spec.ts` (**OBS-LOG-01**):
   - **Allowed:** `tenantId` / `tenant_id` / `userId` as **structured** pino keys.
   - **Forbidden:** those values (or canonical PII) interpolated into **`msg`** strings or unstructured `console` lines.

**Note:** `appendAuditEvent` writes to Postgres `audit_events` — not application stdout/pino — and is out of scope for this pass.

### Inventory summary

| Sink                          | Production `src/`          | Scripts | Tests / workers                                                    |
| ----------------------------- | -------------------------- | ------- | ------------------------------------------------------------------ |
| `logger.*` / `logHttpRequest` | **7** call sites (6 files) | 0       | 0 (tests wrap logger in `log-privacy.spec.ts` only)                |
| `console.*`                   | **1**                      | **5**   | **~28** (perf/chaos/integration harness; many gated by `*_EMIT=1`) |

---

### Violations (unstructured leak risk)

| ID       | Sev    | File                                             | Line | Pattern                                                      | Risk                                                                                                                                                                      |
| -------- | ------ | ------------------------------------------------ | ---- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LOG-V-01 | **P0** | `src/server/graceful-shutdown.ts`                | 69   | ``console.error(`graceful-shutdown: failed: ${message}`)``   | **Production** SIGTERM/SIGINT handler. `message` is `Error.message` — may echo Prisma/SQL paths, internal codes, or tenant-scoped diagnostics into stderr (unstructured). |
| LOG-V-02 | **P1** | `scripts/db-seed.ts`                             | 12   | ``console.log(`seeded tenant subdomain=… id=${tenant.id}`)`` | **Dev seed** prints real tenant UUID in plaintext log line.                                                                                                               |
| LOG-V-03 | **P1** | `scripts/db-seed.ts`                             | 17   | `console.error(error)`                                       | Unstructured Error serialization (message + stack) to stderr on seed failure.                                                                                             |
| LOG-V-04 | **P2** | `test/4-integration/graceful-shutdown-worker.ts` | 100  | ``console.error(`… shutdown failed: ${message}`)``           | Subprocess harness; same `message` interpolation as LOG-V-01.                                                                                                             |
| LOG-V-05 | **P2** | `test/4-integration/graceful-shutdown.spec.ts`   | 462  | ``console.warn(`…\n${message}`)``                            | Skip-path warn; `message` may carry stack fragments.                                                                                                                      |
| LOG-V-06 | **P2** | `test/chaos/atomic-tx-crash-child.ts`            | 40   | `console.error(message)`                                     | Chaos child logs raw caught error text (may include `CHAOS_TENANT_ID` context from upstream).                                                                             |
| LOG-V-07 | **P2** | `test/chaos/atomic-crash-worker.ts`              | 59   | `console.error(message)`                                     | Same as LOG-V-06.                                                                                                                                                         |

**Not violations (informational / gated):**

| File                                                                       | Line    | Notes                                                                                                              |
| -------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `test/chaos/atomic-crash-worker.ts`                                        | 22      | Static env hint string `P5_CHAOS_TENANT_ID` — names var, does not log UUID.                                        |
| `test/chaos/atomic-tx-crash-child.ts`                                      | 15      | Static `CHAOS_TENANT_ID required` — no UUID.                                                                       |
| `*_EMIT=1` JSON lines (`SOAK_MEMORY_JSON`, `OUTBOX_THROUGHPUT_JSON`, etc.) | various | Reviewed report types: metrics-only or counts; **no `tenantId` UUID** in emitted JSON shapes checked (2026-06-05). |
| `test/0-performance/kernel-latency.spec.ts`                                | 73      | Static label “tenant kernel” — no tenant UUID in output.                                                           |

---

### Object spread in logging arguments

| File                                           | Line | Call                                                                          | Spread source                                                      | Unstructured leak?                                                          |
| ---------------------------------------------- | ---- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `src/outbox/start-outbox-relay.ts`             | 28   | `logger.info({ event: "outbox.relay.tick", ...result }, "outbox relay tick")` | `OutboxRelayProcessResult` (`claimed`, `published`, `failed` only) | **No** — spread is structured; `msg` is static.                             |
| `test/4-integration/graceful-shutdown.spec.ts` | 528  | `console.log(JSON.stringify({ event: "…", ...report }))`                      | `ShutdownRunReport` (counts, exit metadata; no `tenantId` field)   | **No** — gated `GRACEFUL_SHUTDOWN_EMIT=1`; JSON is intentional CI artifact. |

No spread site was found that merges unknown/error/envelope objects into a log call where `msg` is dynamically built from spread fields.

---

### Pino call sites — compliant (static `msg`, structured identifiers)

| File                                      | Line      | `msg` / notes               | Structured tenant fields                                                                                |
| ----------------------------------------- | --------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/observability/logger.ts`             | 17–27     | `"request completed"`       | `http.path` only (see advisory H-01)                                                                    |
| `src/main.ts`                             | 35        | `"@apps/api listening"`     | `port` only                                                                                             |
| `src/tenant/tenant-registry.ts`           | 29–35     | static prod warning         | `count` only                                                                                            |
| `src/outbox/start-outbox-relay.ts`        | 33, 44–46 | static strings              | `message` from caught error in **structured** key (see H-02)                                            |
| `src/middleware/error-interceptor.ts`     | 104–112   | `"unhandled request error"` | `tenant_id`, `correlation_id`, `message`, filtered `stack` — **structured** (OBS-LOG-01 pass for `msg`) |
| `src/events/projection-reconciliation.ts` | 59–67     | static reconciliation text  | `tenantId`, `domainEventId`, `tourId`, `reason` — structured                                            |

**Runtime evidence:** `test/2-observability/log-privacy.spec.ts` asserts POST `/tours` does not embed `tenantId` / `userId` / sample PII in pino `msg` strings.

---

### Advisories (structured fields — not OBS-LOG-01 violations)

| ID   | File                                                                      | Finding                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-01 | `src/observability/logger.ts`                                             | `http.path` logs full `req.url` in structured field. Query strings or path segments could carry sensitive tokens; not in `msg` today. Consider path normalization/redaction.                 |
| H-02 | `src/outbox/start-outbox-relay.ts`, `src/middleware/error-interceptor.ts` | `message: error.message` in **structured** object. If upstream throws user-supplied text, PII could land in JSON logs (not `msg`). Prefer stable `error_code` + log detail server-side only. |
| H-03 | `scripts/reliability-outbox-relay-profile.ts`                             | Dumps `process.env.P5_RELIABILITY_SAMPLES` to stderr when set — environment-controlled; ensure samples never include tenant UUIDs before enabling in shared CI logs.                         |

---

### Remediation hints

| Priority | Action                                                                                                                                                                                                                                          | Violations          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| P0       | Replace LOG-V-01 with pino `logger.error({ event: "graceful_shutdown.failed", message, correlation_id? }, "graceful shutdown failed")` or strip `message` to a stable code; never interpolate raw `Error.message` into `console` in production. | LOG-V-01            |
| P1       | Seed script: log `subdomain` only, or structured single-line JSON without UUID; use `logger` instead of `console.log`.                                                                                                                          | LOG-V-02, LOG-V-03  |
| P2       | Chaos/shutdown test workers: log `{ event, code }` or exit code only; avoid `console.error(message)`.                                                                                                                                           | LOG-V-04 … LOG-V-07 |

---

### Cross-references

- Contract test: `test/2-observability/log-privacy.spec.ts` (OBS-LOG-01)
- Phase 0 error/log matrix: `docs/phase0-audit-report.md` (E-19, OBS-LOG-01)
- Platform doc: `docs/phase-4/appendices/observability.md` — structured logging with `tenantId`; no secrets in logs

---

## Static analysis — request / trace ID lifecycle (`main.ts` → Postgres)

**Audit date:** 2026-06-05  
**Terms:** Ingress **trace id** is resolved once per bind and stored in trace ALS (`traceId`). HTTP error JSON uses **`correlationId`**, which is the active ALS trace id when present, else a fresh `randomUUID()` (`resolveCorrelationId`).

### End-to-end flow (production stack)

```mermaid
sequenceDiagram
  participant Client
  participant Main as main.ts Server
  participant ReqLog as withRequestLogging
  participant App as createRequestListener
  participant Route as /tours handler
  participant Bind as runWithHttpRequestContext
  participant Svc as ToursService → CanonicalTourService
  participant Val as runScheduledValidation
  participant TX as withCanonicalTransaction
  participant PG as Postgres GUC

  Client->>Main: HTTP request (optional x-trace-id / x-correlation-id / x-request-id)
  Main->>ReqLog: wrap listener (no ALS)
  ReqLog->>App: await listener(req,res)
  App->>App: resolveTraceIdFromHeaders → runWithTraceContext (outer ALS)
  App->>Route: dispatchRequest
  Route->>Bind: resolveTraceIdFromHeaders again → runWithTraceContext (inner ALS)
  Bind->>Bind: runWithTenantContext(tenantId, actorId)
  Bind->>Svc: createTour → writeTour
  Svc->>Val: runPreTransactionValidation (queued + setImmediate)
  Val-->>Svc: canonical document
  Svc->>TX: persistNewTourAtomically
  TX->>PG: set_config app.current_tenant_id + app.current_trace_id (if ALS)
  TX->>PG: INSERT tour, audit_events, outbox_events
  TX-->>Client: 201 (no correlationId in success body)
  Note over ReqLog: res.on('finish') → logHttpRequest (no traceId field today)
```

### Stage reference

| Stage                              | File                                                        | Trace bind / read                                                                  | Tenant ALS                               |
| ---------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------- |
| 1. Process boot                    | `src/main.ts`                                               | None                                                                               | None                                     |
| 2. HTTP server                     | `main.ts` L24–29                                            | None                                                                               | None                                     |
| 3. Access log wrapper              | `src/http/request-logging.ts`                               | None; `finish` callback runs after handler                                         | None                                     |
| 4. **Outer HTTP ALS**              | `src/app.ts` L75–76                                         | `resolveTraceIdFromHeaders` → `runWithTraceContext`                                | None                                     |
| 5. Route dispatch                  | `src/app.ts` `dispatchRequest`                              | Inherits outer ALS                                                                 | Route-dependent                          |
| 6. **Inner HTTP ALS** (tours only) | `src/http/bind-request-context.ts` L28–29                   | Second `resolveTraceIdFromHeaders` → nested `runWithTraceContext`                  | `runWithTenantContext` inner             |
| 7. Pre-TX validation               | `pre-transaction-validation.ts` → `validation-scheduler.ts` | `enrichValidationFailure` reads `getActiveTraceId()` inside scheduled `task.run()` | Gate keyed by `tenantId`                 |
| 8. Canonical TX                    | `with-canonical-transaction.ts` L26–30                      | `getActiveTraceId()` → `app.current_trace_id` GUC (tx-local)                       | `set_config('app.current_tenant_id', …)` |
| 9. RLS reads/writes                | `with-tenant-rls.ts` L25–29                                 | Same GUC pattern                                                                   | Explicit `tenantId` arg + GUC            |
| 10. HTTP errors                    | `error-interceptor.ts` L41–42, L121                         | `resolveCorrelationId()` = ALS or **new UUID**                                     | `getActiveTenantId()` in 500 logs only   |

**Ingress resolution** (`resolve-trace-id.ts`): `x-trace-id` → `x-correlation-id` → `x-request-id` → `randomUUID()`.

**Not on the hot path:** `main.ts` does not bind ALS itself; all binding is in the listener stack.

### Database binding (where trace meets SQL)

Both `withCanonicalTransaction` and `withTenantRls` open a Prisma `$transaction`, then:

```sql
SELECT set_config('app.current_tenant_id', $tenantId, true);
SELECT set_config('app.current_trace_id', $traceId, true);  -- only when getActiveTraceId() is defined
```

The GUC is **transaction-local** (`true` = `SET LOCAL` semantics). It is visible to all queries on that connection until the transaction ends. Verified in Postgres mode by `test/2-observability/trace-isolation.spec.ts` (`current_setting('app.current_trace_id', true)`).

**Memory driver:** ALS still applies; GUC calls are skipped when no Prisma/Postgres.

**Outbox row:** `enqueueOutboxEvent` in `atomic-canonical-tour-persist.ts` passes `correlationId: getActiveTraceId()` (DEC-046). `NULL` only when trace ALS is unbound (scripts / background).

---

### Async boundaries — loss, regeneration, or split-brain

| ID                      | Severity             | Boundary                                                                                | Behavior                                                                                 | Impact                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | -------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TRACE-REGEN-01**      | **High**             | `app.ts` outer + `bind-request-context.ts` inner both call `resolveTraceIdFromHeaders`  | When **no** ingress correlation headers, each call executes `randomUUID()` independently | **Split-brain:** inner ALS id is used for `withCanonicalTransaction` GUC during `/tours` work; outer ALS id is active again after `runWithHttpRequestContext` returns. Route-level `handleHttpError` in `tours.routes.ts` runs **after** inner ALS exits → `correlationId` on 4xx/5xx may be **outer** id ≠ id used during persist. |
| **TRACE-REGEN-02**      | **Medium**           | `resolveCorrelationId()` in `error-interceptor.ts`                                      | `getActiveTraceId() ?? randomUUID()`                                                     | Any `handleHttpError` invoked **outside** trace ALS (or after ALS cleared) emits a **new** correlation id unrelated to request work.                                                                                                                                                                                                |
| **TRACE-LOST-01**       | **Closed** (DEC-048) | `res.on("finish")` in `request-logging.ts`                                              | `logHttpRequest` records `correlation_id` from `getActiveTraceId()`                      | Access logs join error envelope and outbox correlation for incident reconstruction.                                                                                                                                                                                                                                                 |
| **TRACE-LOST-02**       | **Info** (deferred)  | `setInterval` outbox relay tick (`start-outbox-relay.ts`)                               | No `runWithTraceContext`; `getActiveTraceId()` is `undefined` in relay `withTenantRls`   | Relay publish path does not set `app.current_trace_id`; aligns with `docs/phase-5/appendices/trace-request-context.md` (outbox continuation → Phase 7).                                                                                                                                                                             |
| **TRACE-LOST-03**       | **Closed** (DEC-046) | Outbox enqueue on tour create                                                           | `correlationId: getActiveTraceId()` wired in `atomic-canonical-tour-persist.ts`          | HTTP create stores ingress trace on `outbox_events.correlation_id`; relay re-bind remains Phase 7 (**TRACE-LOST-02**).                                                                                                                                                                                                              |
| **TRACE-CONTEXT-SPLIT** | **Medium**           | `tours.routes.ts` try/catch → `handleHttpError`                                         | Errors caught at route boundary run after nested ALS teardown                            | With headers present, outer/inner ids match; **without headers**, see TRACE-REGEN-01.                                                                                                                                                                                                                                               |
| **TRACE-SCHED-01**      | **Pass**             | `validation-scheduler.ts` (`setImmediate` / `Promise` chain)                            | Task scheduled synchronously from request `await runScheduledValidation`                 | `trace-isolation.spec.ts` asserts ALS + GUC survive `setImmediate` and nested `await` through repo layer.                                                                                                                                                                                                                           |
| **TRACE-IDEM-01**       | **Pass**             | Idempotency poll `setTimeout(25ms)` in `http-idempotency.ts`                            | Poll loops run inside same `execute()` closure while HTTP ALS still held                 | Trace remains available for `withTenantRls` GUC on claim/update paths.                                                                                                                                                                                                                                                              |
| **TRACE-TENANT-NEST**   | **Pass**             | `canonical-tour.service.ts` `runWithTenantContext` inside already-bound HTTP tenant ALS | Nested ALS with same `tenantId`                                                          | Does not disturb trace ALS (separate `AsyncLocalStorage` instances).                                                                                                                                                                                                                                                                |

### Routes without inner `runWithHttpRequestContext`

| Route                              | Trace ALS         | Tenant ALS                               | DB trace GUC on tenant queries                          |
| ---------------------------------- | ----------------- | ---------------------------------------- | ------------------------------------------------------- |
| `GET /health`                      | Outer only        | None                                     | N/A                                                     |
| `GET /api/v2/tenant-config`        | Outer only        | **None** (auth only)                     | Unlikely on this path                                   |
| `POST /internal/tenants/provision` | Outer only        | None                                     | Admin provisioning (no trace GUC requirement)           |
| `POST/GET/PATCH /tours`            | Outer + **inner** | Inner (+ optional nested canonical bind) | **Inner** trace id when headers absent (TRACE-REGEN-01) |

### Correlation echo (HTTP response vs ALS)

| Mechanism                                                     | Uses trace ALS?                                               | Regenerates?                       |
| ------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| `x-correlation-id` response header on errors                  | Yes, via `resolveCorrelationId()`                             | Yes, if ALS empty (TRACE-REGEN-02) |
| `ValidationFailure` / `SchemaVersionMismatchError` enrichment | `getActiveTraceId()` at throw site                            | Fields omitted if ALS empty        |
| `logInternalServerError` (500)                                | `correlation_id` from `resolveCorrelationId()` at handle time | Same as above                      |
| Success `201` create tour body                                | No `correlationId` field                                      | N/A                                |

### Evidence map

| Claim                                                   | Spec / doc                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ALS survives `setImmediate` / nested await through repo | `test/2-observability/trace-isolation.spec.ts`                                         |
| Concurrent tenants do not cross-bind trace ids          | `trace-isolation.spec.ts` (tenant A vs B)                                              |
| Header priority + correlation echo on errors            | `test/2-observability/error-enrichment.spec.ts` (OBS-ERR-01/03)                        |
| Postgres `app.current_trace_id` matches ALS             | `trace-isolation.spec.ts` (when `DATABASE_URL` set)                                    |
| Architecture map (ingress nesting)                      | `docs/phase0-audit-report.md` §2.2, `docs/phase-5/appendices/trace-request-context.md` |

### Remediation hints (trace continuity)

| Priority | Action                                                                                                                                                       | IDs                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| P0       | Resolve trace id **once** per HTTP request (e.g. only in `app.ts`) and pass into `runWithHttpRequestContext` — do not call `resolveTraceIdFromHeaders` twice | TRACE-REGEN-01, TRACE-CONTEXT-SPLIT |
| P1       | ~~Pass `correlationId` into `enqueueOutboxEvent` on create~~ **Done** (DEC-046)                                                                              | TRACE-LOST-03                       |
| P2       | ~~Add `correlation_id` to `logHttpRequest`~~ **Done** (DEC-048)                                                                                              | TRACE-LOST-01                       |
| P3       | Outbox relay: continue trace from `outbox_events.correlation_id` under `runWithTraceContext` per row (Phase 7)                                               | TRACE-LOST-02                       |

---

## Static analysis — `MetricsRegistry` & tenant billing cardinality

**Audit date:** 2026-06-05  
**Scope:** `apps/api/src/observability/metrics.ts` and all `metricsRegistry` / `recordTourCreated` call sites in `apps/api/src/`.

### Registry behavior (relevant to aggregation)

`MetricsRegistry` stores counters in a `Map` keyed by `seriesKey(name, labels)`:

- **Labeled:** `tour_creation_count{tenant_id=<uuid>}`
- **Label-less:** bare `tour_creation_count` (when `labels` is omitted or `{}`)

Labeled and unlabeled names are **different series**. A label-less increment does **not** add to labeled series, but export/dashboard code that queries `getMetric("tour_creation_count")` without labels or sums `snapshot()` keys without parsing `tenant_id` can **mis-report** usage (under-count labeled tenants, or treat a stray unlabeled series as “global total”).

```3:16:apps/api/src/observability/metrics.ts
function labelKey(labels: MetricLabels | undefined): string {
  if (!labels || Object.keys(labels).length === 0) {
    return "";
  }
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}

function seriesKey(name: string, labels: MetricLabels | undefined): string {
  const lk = labelKey(labels);
  return lk.length > 0 ? `${name}{${lk}}` : name;
}
```

The registry is a **process-global singleton** (`metricsRegistry`). Multi-tenant isolation depends entirely on **per-series labels**, not separate registries per tenant.

### Production metric catalog (static inventory)

| Metric                           | Labels at increment site         | Call site                                                                      | Label-less series in use? |
| -------------------------------- | -------------------------------- | ------------------------------------------------------------------------------ | ------------------------- |
| `tour_creation_count`            | `{ tenant_id: tenantId }`        | `recordTourCreated` → `canonical-tour.service.ts` after successful `writeTour` | **No**                    |
| `projection_inconsistency_total` | `{ tenant_id: signal.tenantId }` | `recordProjectionInconsistency` in `projection-reconciliation.ts`              | **No**                    |

**Grep conclusion:** No production `metricsRegistry.increment(...)` omits `tenant_id` today. No gauges, histograms, or other metric types are registered.

### Findings — label-less / cross-tenant aggregation risk

| ID                | Severity             | Finding                                                                                                                  | Billing / usage reporting risk                                                                                                                                                                                                                                                                               |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| **MET-OK-01**     | —                    | All live counters include `tenant_id`                                                                                    | Per-tenant series are separable in `getMetric(name, { tenant_id })` and in `snapshot()` keys.                                                                                                                                                                                                                |
| **MET-API-01**    | **Closed** (DEC-049) | `increment(name, labels?)` allowed optional labels on tenant-scoped names                                                | `TENANT_SCOPED_METRIC_NAMES` + runtime throw + `guard:tenant-metrics-labels`                                                                                                                                                                                                                                 | Unlabeled billing series blocked at increment time. |
| **MET-EXPORT-01** | **Medium** (Phase 7) | `snapshot()` returns all series keys; no helper to sum by tenant or reject unlabeled business metrics                    | A naive exporter doing `sum(snapshot.values())` or aggregating all keys matching `tour_creation_count` **without** label parsing would **not** equal per-tenant usage; summing **only** unlabeled `tour_creation_count` would **under-report** all labeled creates (OBS-MET-01 asserts unlabeled = 0 today). |
| **MET-VALID-01**  | **Low**              | `recordTourCreated(tenantId)` does not validate non-empty `tenantId`                                                     | Empty string would create `tenant_id=` series — still “labeled,” but could **collapse** bad data into one bucket or break tenant invoice joins.                                                                                                                                                              |
| **MET-COV-01**    | **Low**              | `projection_inconsistency_total` is labeled but **not** covered by `tenant-metrics.spec.ts` (only `tour_creation_count`) | Regression could add unlabeled inconsistency increments without CI failure.                                                                                                                                                                                                                                  |
| **MET-SCOPE-01**  | **Info**             | `updateTour` does not increment any counter                                                                              | Usage/billing based solely on `tour_creation_count` counts **creates only**, not updates — under-reporting, not cross-tenant **over**-aggregation.                                                                                                                                                           |
| **MET-SCOPE-02**  | **Info**             | Failed validation / rolled-back TX do not increment                                                                      | Correct for billing accuracy; not a cardinality leak.                                                                                                                                                                                                                                                        |

### What is _not_ a violation today

- **No label-less business counters** are incremented in `src/` as of this audit.
- **`tour_creation_count` unlabeled total is 0** after multi-tenant load — enforced by `test/2-observability/tenant-metrics.spec.ts` (**OBS-MET-01**).
- **Cross-tenant “bleed”** would require the same metric name with **missing or wrong** `tenant_id` label; current code paths pass `record.tenantId` / `signal.tenantId` from persisted domain rows.

### Billing / usage reporting scenarios (if misused)

| Scenario                                            | Mechanism                                                            | Risk                                                                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Platform-wide “total tours” dashboard**           | `metricsRegistry.getMetric("tour_creation_count")` without labels    | Reads **unlabeled** series only → **0** while tenants have labeled usage → **false zero** billing signal.                       |
| **Invoice line item per tenant**                    | `getMetric("tour_creation_count", { tenant_id })`                    | **Correct** with current instrumentation.                                                                                       |
| **Prometheus scrape (Phase 7) exporting bare name** | Map `tour_creation_count` → single counter without `tenant_id` label | Collapses tenants into one billable SKU or attributes usage to the platform account.                                            |
| **Cardinality explosion**                           | High `tenant_id` cardinality on counters                             | Not a cross-tenant aggregation bug, but **cost** risk for metrics backend; doc defers budgets to Phase 7 (`tenant-metrics.md`). |
| **Ops “partial success” chargeback**                | `projection_inconsistency_total`                                     | Labeled per tenant; suitable for **reliability** SLAs, not tour-creation metering unless product defines it that way.           |

### Evidence map

| Claim                        | Location                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| Labeled increment API        | `apps/api/src/observability/metrics.ts`                                  |
| Create path hook             | `apps/api/src/canonical/canonical-tour.service.ts` (`recordTourCreated`) |
| Inconsistency hook           | `apps/api/src/events/projection-reconciliation.ts`                       |
| OBS-MET-01 unlabeled guard   | `apps/api/test/2-observability/tenant-metrics.spec.ts`                   |
| Phase 5 metric contract      | `docs/phase-5/appendices/tenant-metrics.md`                              |
| Prior singleton note (HT-11) | `apps/api/docs/phase0-audit-report.md`                                   |

### Remediation hints (metrics / billing)

| Priority | Action                                                                                                         | IDs           |
| -------- | -------------------------------------------------------------------------------------------------------------- | ------------- |
| P1       | ~~Add CI grep/lint for tenant_id on tenant-scoped increments~~ **Done** (DEC-049)                              | MET-API-01    |
| P2       | Extend OBS-MET test (or sibling spec) to assert `projection_inconsistency_total` has no unlabeled series       | MET-COV-01    |
| P2       | `recordTourCreated`: `requireActiveTenantId()` or trim+reject empty `tenantId` before increment                | MET-VALID-01  |
| P3       | Phase 7 exporter: never promote unlabeled `tour_creation_count` as global usage; document `sum by (tenant_id)` | MET-EXPORT-01 |

---

## Static analysis — global HTTP error handler (tenant response leak)

**Audit date:** 2026-06-05  
**Primary handler:** `apps/api/src/middleware/error-interceptor.ts` (`handleHttpError`, `sendHttpError`)  
**Ingress fallback:** `apps/api/src/app.ts` `createRequestListener` try/catch → `handleHttpError` for uncaught dispatch errors.

### Response envelope contract

`sendHttpError` serializes **only** these JSON fields (via `HttpErrorBody`):

| Field                    | In response? | Notes                                                                   |
| ------------------------ | ------------ | ----------------------------------------------------------------------- |
| `error`                  | Yes          | String message or stable code                                           |
| `code`                   | Optional     | Often duplicates prefix for machine clients                             |
| `correlationId`          | Yes          | Trace ALS id or fresh UUID                                              |
| `stack`                  | **Never**    | Not part of type; OBS-ERR-04 asserts `undefined`                        |
| `detail`                 | **Never**    | `ValidationFailure.detail` exists on thrown object but is **not** sent  |
| `tenant_id` / `tenantId` | **Never**    | Enrichment on thrown errors stays server-side; not copied into envelope |
| `cause`                  | **Never**    | Node `Error.cause` (e.g. pool saturation wrapper) not serialized        |

`sendJson` uses `JSON.stringify(body)` on plain objects — no automatic `Error` serialization.

### Handler decision flow (tenant-facing routes)

```mermaid
flowchart TD
  A[Thrown error] --> B{Typed handler?}
  B -->|CanonicalSyncValidationError| C[409 stable code only]
  B -->|TourVersionConflict / SchemaVersionMismatch| D[409/400 typed message]
  B -->|ValidationFailure| E[400 message + VALIDATION_FAILURE code]
  B -->|TenantRateLimitExceeded| F[429 via sendTenantRateLimitExceeded]
  B -->|InvalidTenantAuthContext| G[401 SDK code string]
  B -->|WorkspaceInvalidError| H[401 WORKSPACE_INVALID opaque]
  B -->|Prefix map| I{status}
  I -->|503 DB_POOL_SATURATED| J[503 service_unavailable]
  I -->|500 unmapped| K[500 internal_error + server log]
  I -->|4xx/409 other| L[Echo Error.message as error + code]
  K --> M[logInternalServerError: message + filtered stack in pino only]
```

### Leak controls — what never reaches HTTP (verified)

| Leak class                                 | Control                                                                                                                                                                      | Verdict                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Stack traces**                           | 500/503 use fixed strings; no `error.stack` in `sendHttpError`                                                                                                               | **Pass**                         |
| **Prisma / SQL text**                      | Unmapped Prisma/driver errors → `status === 500` → `internal_error` only; pool errors → `DB_POOL_SATURATED` prefix → 503 `service_unavailable` (wrapper `cause` not exposed) | **Pass**                         |
| **DATABASE_URL / connection strings**      | Not in mapped 4xx prefixes; unmapped → 500 opaque; `tenant-error-recovery` asserts no `postgresql://`, `DATABASE_URL`, `Prisma` in raw body                                  | **Pass**                         |
| **RuleEngine / rule-engine paths**         | Not in 500 body; `LOG_STACK_LINE_DENY` strips RuleEngine/prisma lines from **logs** only; OBS-ERR-02 forbids RuleEngine in validation 400 payload                            | **Pass** (with 400 caveat below) |
| **`node_modules` / `apps/api/src/` paths** | Simulated fault with file:line in `Error.message` → 500 `internal_error` (OBS-ERR-04)                                                                                        | **Pass**                         |
| **`ValidationFailure` class name**         | Handler sends `code: VALIDATION_FAILURE` + message only                                                                                                                      | **Pass**                         |

### Findings

| ID                | Severity               | Finding                                                                                                                                   | HTTP response risk                                                                                                                                                    |
| ----------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ERR-PASS-01**   | —                      | All unmapped / internal faults on `/tours` → `500` + `{ error: "internal_error", correlationId }`                                         | No stack/SQL/Prisma in body                                                                                                                                           |
| **ERR-PASS-02**   | —                      | `DB_POOL_SATURATED` retains driver text in `Error.message` for logging but client sees only `service_unavailable`                         | Connection-pool wording not echoed                                                                                                                                    |
| **ERR-PASS-03**   | —                      | `WORKSPACE_PLUGIN_NOT_FOUND` maps to **500** `internal_error` (not 400 echo)                                                              | Plugin resolution failures opaque                                                                                                                                     |
| **ERR-PASS-04**   | —                      | `CanonicalSyncValidationError` → stable `CANONICAL_SYNC_VALIDATION_FAILED` (no `violations.join` in body)                                 | Fixed prior E-11 echo risk                                                                                                                                            |
| **ERR-400-01**    | **Info** (intentional) | `ValidationFailure` / `CANONICAL_VALIDATION_FAILED` returns **rule text** in `error` (from `engine.validateCanonical` violation messages) | Acceptable product contract; **must not** embed engine paths in rule copy (guarded by OBS-ERR-02)                                                                     |
| **ERR-400-02**    | **Info** (intentional) | `ZOD_VALIDATION_FAILED:*` echoes Zod `path: message` on **400**                                                                           | Field paths only; not stack/SQL                                                                                                                                       |
| **ERR-400-03**    | **Info**               | `SchemaVersionMismatchError` echoes version numbers                                                                                       | No infra leak                                                                                                                                                         |
| **ERR-BYPASS-01** | **Low**                | `POST /internal/tenants/provision` and `GET /internal/test/db-pool-hold` use **local** mappers + `sendJson`, not `handleHttpError`        | **500/503** still opaque; **no `correlationId`** on internal JSON errors; 4xx may echo `Error.message` (stable provisioning codes). Tenant-facing paths unaffected.   |
| **ERR-BYPASS-02** | **Low**                | `GET` unknown paths / bare `404` in `app.ts`                                                                                              | Empty body — no leak                                                                                                                                                  |
| **ERR-429-01**    | **Low**                | `sendTenantRateLimitExceeded` uses `sendJson` directly (not `sendHttpError`)                                                              | No stack; includes `correlationId`; human-readable `error` string                                                                                                     |
| **ERR-LOG-01**    | **Info**               | `logInternalServerError` logs raw `error.message` and partial `stack` (filtered, not denied entirely)                                     | **Logs only** — acceptable for ops; not in HTTP envelope                                                                                                              |
| **ERR-GAP-01**    | **Low**                | Default branch `sendHttpError(res, status, { error: message, code: message })` for **any** non-500/503 mapped 4xx                         | Safe **only while** throw sites use stable prefixed messages; a future `throw new Error(prismaMessage)` without `500` mapping would echo leaks — today unmapped → 500 |

### Bypass route matrix

| Route                         | Error path              | 500 body         | Stack in body? | Uses `handleHttpError`? |
| ----------------------------- | ----------------------- | ---------------- | -------------- | ----------------------- |
| `/tours` POST/PATCH/GET       | `tours.routes.ts` catch | `internal_error` | No             | Yes                     |
| `/api/v2/tenant-config`       | catch                   | `internal_error` | No             | Yes                     |
| App dispatch uncaught         | `app.ts` catch          | `internal_error` | No             | Yes                     |
| `/internal/tenants/provision` | local catch             | `internal_error` | No             | **No**                  |
| `/internal/test/db-pool-hold` | local catch             | `internal_error` | No             | **No**                  |
| `GET /health`                 | none                    | N/A              | N/A            | N/A                     |

### Server-side vs client-side enrichment

Thrown errors may carry `tenant_id` / `correlation_id` on the **Error instance** (`enrichValidationFailure`, `SchemaVersionMismatchError`) for in-process handlers/tests. **`handleHttpError` never copies those properties into the JSON envelope** — clients rely on `correlationId` + stable `error`/`code` only (OBS-ERR-03 tests in-process enrichment, not HTTP body tenant fields).

### Evidence map

| Claim                             | Spec / file                                                  |
| --------------------------------- | ------------------------------------------------------------ |
| Opaque 500 + no stack in JSON     | `test/2-observability/error-enrichment.spec.ts` (OBS-ERR-04) |
| No engine leak on validation 400  | `error-enrichment.spec.ts` (OBS-ERR-02)                      |
| Correlation echo                  | `error-enrichment.spec.ts` (OBS-ERR-01/05)                   |
| No SQL/Prisma/ALS in raw response | `test/0-functional/tenant-error-recovery.spec.ts`            |
| Persist fault → `internal_error`  | `test/1-functional/create-tour-flow.spec.ts`                 |
| Handler implementation            | `apps/api/src/middleware/error-interceptor.ts`               |
| Phase 0 error matrix              | `apps/api/docs/phase0-audit-report.md` (E-01…E-20)           |

### Remediation hints

| Priority | Action                                                                                              | IDs           |
| -------- | --------------------------------------------------------------------------------------------------- | ------------- |
| P2       | Route internal handlers through `handleHttpError` (or shared mapper) for consistent `correlationId` | ERR-BYPASS-01 |
| P3       | CI guard: forbid `sendJson(res, 5xx, { error: error.message })` outside `error-interceptor`         | ERR-GAP-01    |
| P3       | Lint rule-engine violation copy for path-like substrings before `throwValidationFailure`            | ERR-400-01    |

---

## Empirical — logging backpressure (1000-request burst)

**Audit date:** 2026-06-05  
**Harness:** `apps/api/scripts/log-backpressure-burst.ts`  
**Scenario:** 1000 concurrent `GET /health` (100 workers × 10), in-process `http.Server`, `STORAGE_DRIVER=memory`, `OUTBOX_RELAY_ENABLED=false`, production stack (`withRequestLogging` → `createRequestListener` as in `main.ts`).

### Architecture (what is being buffered)

| Layer  | Component                                   | Blocking behavior                                                                                                          |
| ------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| HTTP   | `withRequestLogging` (`request-logging.ts`) | Registers `res.on("finish")` → calls `logHttpRequest` **synchronously** on the Node HTTP thread                            |
| Logger | `pino()` default destination (`logger.ts`)  | **Sonic-Boom** to stdout (`fd=1`), `sync: false`, default `minLength: 4096` — appends to in-process buffer; OS write async |
| App    | No custom log queue                         | No `pino.transport`, no worker thread, no `logger.flush()` on shutdown today                                               |

There is **no separate application-level “logging buffer”** beyond Pino/Sonic-Boom’s internal byte buffer and the kernel pipe to stdout.

### Burst results (client-side latency, ms)

Measured from HTTP request start until response `end` (includes queueing under concurrency 100).

| Metric  | Without `withRequestLogging` | With `withRequestLogging` | Δ (logged − bare)       |
| ------- | ---------------------------- | ------------------------- | ----------------------- |
| **p50** | 21.7                         | 19.0                      | **−2.7** (within noise) |
| **p95** | 454.8                        | 358.9                     | −95.9                   |
| **p99** | 580.6                        | 471.8                     | −108.8                  |
| **avg** | 57.3                         | 46.1                      | −11.2                   |
| **max** | 583.8                        | 479.2                     | −104.6                  |

**Verdict:** Under this burst, **request logging does not add noticeable client latency** at the median; tail latency is dominated by **in-process HTTP concurrency** (single server, 100 parallel clients), not by Pino buffer backpressure. Logged path was not slower than bare in this environment.

### Micro-benchmark — `logger.info` return time (1000 sequential writes)

Isolated cost of one `http.request` log line (same shape as `logHttpRequest`):

| Destination                   | p50 (ms) | p95 (ms) | p99 (ms) | max (ms) |
| ----------------------------- | -------- | -------- | -------- | -------- |
| `/dev/null` (async)           | 0.011    | 0.015    | 0.026    | 0.139    |
| stdout (default 4 KiB buffer) | 0.010    | 0.022    | 0.031    | 1.19     |

`logger.info()` returns in **~10–30 µs** typical — far below HTTP handler cost. Backpressure would require the Sonic-Boom buffer to fill and `write()` to block; that was **not observed** for ~200-byte JSON lines × 1000 on a local TTY/pipe.

### Findings

| ID            | Severity            | Finding                                                                                                                                                                                                                                   |
| ------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LOG-BP-01** | —                   | **No measurable backpressure** on `GET /health` burst (1000 req) with current `withRequestLogging` + default Pino                                                                                                                         |
| **LOG-BP-02** | **Info**            | Tail latencies (p95/p99 **350–580 ms**) reflect **connection/worker queueing**, not logging                                                                                                                                               |
| **LOG-BP-03** | **Medium** (future) | `finish` handler runs **sync** `logHttpRequest` on the event loop; a **full** Sonic-Boom buffer or slow stdout (container log driver, JSON pretty-print transport) could delay `finish` callbacks and indirectly stall keep-alive sockets |
| **LOG-BP-04** | **Medium** (future) | `logInternalServerError` on 500 storms writes **larger** records (message + stack lines) — higher buffer fill rate than access logs                                                                                                       |
| **LOG-BP-05** | **Low**             | Default logger does not set explicit `destination` options — relies on Pino 9 defaults; misconfiguration (`sync: true`, `pino-pretty` transport) is the main regression risk                                                              |
| **LOG-BP-06** | **Info**            | Access logs omit `traceId` today — no extra serialization cost; adding fields is cheap vs POST /tours work                                                                                                                                |

### Async-buffer / hardening suggestions

| Priority | Suggestion                                                                                                                          | Rationale                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **P1**   | Configure explicit destination in `logger.ts`: `pino.destination({ dest: 1, sync: false, minLength: 4096 })` (or file path in prod) | Documents intent; avoids accidental `sync: true`                    |
| **P2**   | On graceful shutdown (`graceful-shutdown.ts`), call `logger.flush()` / `destination.flushSync()` after outbox drain                 | Prevents losing buffered lines on SIGTERM (Pino async trade-off)    |
| **P3**   | Defer access log off hot path: `res.on("finish", () => { setImmediate(() => logHttpRequest(...)); })`                               | Keeps `finish` callback O(1); accept rare loss on hard kill         |
| **P3**   | Production: `LOG_LEVEL=warn` for load tests; sample `GET /health` (e.g. 1%) if log volume becomes dominant                          | Reduces buffer churn on health probes                               |
| **P4**   | Phase 7: if using `pino.transport`, handle Sonic-Boom **`drain`** / `await once(dest, 'drain')` in transport worker                 | Required for correct backpressure with pretty-print or remote sinks |
| **P4**   | Avoid `pino-pretty` on stdout in production hot path                                                                                | Worker-thread + formatting increases latency vs NDJSON to collector |
| **P4**   | Monitor `sonic-boom` `writeBufferLen` / dropped logs via destination `'drop'` event (if enabled)                                    | Early signal of stdout backpressure in K8s                          |

### Reproduce

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory OUTBOX_RELAY_ENABLED=false \
  npx tsx scripts/log-backpressure-burst.ts 2>burst-summary.json
# Summary JSON is printed to stderr; pino NDJSON lines go to stdout.
```

**Caveats:** Local Linux workstation, `/health` only (no Prisma/RuleEngine); not a substitute for `test/3-performance/noisy-neighbor-latency.spec.ts` or Postgres-backed soak. Re-run in CI/container with stdout redirected to a slow consumer to stress **LOG-BP-03**.

---

## Static analysis — `audit_events` schema & sensitive-mutation coverage

**Audit date:** 2026-06-05  
**Schema:** `apps/api/prisma/schema.prisma` (`AuditEvent` model)  
**Write API:** `apps/api/src/audit/audit-logger.ts` (`appendAuditEvent`)  
**Policy SoT:** DEC-007 — Phase 5 minimal audit on **successful tour create** only ([`docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md`](../../docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md), [`docs/phase-5/audits/AUDIT-TRAIL-SECURITY-REPORT.md`](../../docs/phase-5/audits/AUDIT-TRAIL-SECURITY-REPORT.md)).

### Schema & immutability

| Column        | Type                  | Populated by                                 | Notes                                                                                                                                          |
| ------------- | --------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | UUID                  | Prisma default                               | —                                                                                                                                              |
| `tenant_id`   | UUID (FK → `tenants`) | `requireActiveTenantId()` from tenant ALS    | **Required**; fails closed if ALS unbound (`TENANT_CONTEXT_NOT_BOUND`)                                                                         |
| `actor_id`    | `String?`             | `getActiveActorId() ?? null` from tenant ALS | **No `user_id` column** — HTTP `auth.userId` is stored here via `runWithHttpRequestContext` → `runWithTenantContext({ actorId: auth.userId })` |
| `action`      | `String`              | Caller (`AUDIT_ACTION_TOUR_CREATED` today)   | —                                                                                                                                              |
| `entity_type` | `String`              | Caller (`"tour"`)                            | —                                                                                                                                              |
| `entity_id`   | UUID                  | Caller (tour id)                             | —                                                                                                                                              |
| `metadata`    | JSON                  | `{ workspaceType }` (+ optional spread)      | Not a substitute for actor identity                                                                                                            |
| `created_at`  | `DateTime`            | DB default                                   | —                                                                                                                                              |

**Indexes:** `(tenant_id, created_at)` — supports tenant-scoped timelines; **no index on `actor_id`**.

**DB triggers on `audit_events`:**

| Trigger                    | Event                     | Purpose                                                           |
| -------------------------- | ------------------------- | ----------------------------------------------------------------- |
| `audit_events_append_only` | `BEFORE UPDATE OR DELETE` | Rejects mutation of audit rows (`reject_audit_events_mutation()`) |

There is **no** Postgres trigger that auto-inserts audit rows when `tours` or `tenants` change. Coverage is **application-only** via `appendAuditEvent`.

### Application audit call sites (production `src/`)

| Call                                                    | Action         | Requires tenant ALS           | Requires actor ALS             |
| ------------------------------------------------------- | -------------- | ----------------------------- | ------------------------------ |
| `atomic-canonical-tour-persist.ts` → `appendAuditEvent` | `TOUR_CREATED` | Yes (`requireActiveTenantId`) | Optional (`actor_id` nullable) |

**Grep:** `appendAuditEvent` appears **only** in `atomic-canonical-tour-persist.ts` (plus tests). No other production writer.

### Sensitive-mutation inventory vs audit coverage

| Mutation                                            | Path                                                                    | `tenant_id` in audit?                               | `actor_id` / user?                              | Verdict                                         |
| --------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| **POST `/tours` create** (Prisma + `DATABASE_URL`)  | `persistNewTourAtomically` → `appendAuditEvent` same TX                 | Yes                                                 | Yes when HTTP context binds `auth.userId` → ALS | **Covered** (DEC-007)                           |
| **POST `/tours` create** (`STORAGE_DRIVER=memory`)  | `persistViaScopedRepository` → in-memory only                           | **N/A** (no `audit_events` table)                   | N/A                                             | **AUDIT-GAP-01**                                |
| **PATCH `/tours/:id` update**                       | `persistTourUpdateAtomically` → `tx.tour.update` + `TOUR_UPDATED` audit | **Yes** (Prisma TX)                                 | **No**                                          | **Closed** DEC-047                              |
| **GET `/tours`**                                    | read-only                                                               | N/A                                                 | N/A                                             | No audit required                               |
| **POST `/internal/tenants/provision`**              | `ProvisioningService` → `prisma.tenant.create` (admin)                  | **No**                                              | **No**                                          | **AUDIT-GAP-03** (internal/dev; high privilege) |
| **`seedDevTenants` / tenant upsert**                | `prisma.tenant.upsert` (admin)                                          | **No**                                              | **No**                                          | **AUDIT-GAP-03**                                |
| **Outbox enqueue** (`TourCreated`)                  | `enqueueOutboxEvent` in same TX as create audit                         | Correlated via tour row, not duplicate audit action | N/A                                             | Covered indirectly on create                    |
| **Outbox relay** (`processing` / `done` / `failed`) | `outbox-relay.ts` admin updates                                         | **No**                                              | **No**                                          | **AUDIT-GAP-04** (ops pipeline; defer Phase 7)  |
| **`http_idempotency_records`** insert/update        | idempotency layer                                                       | **No**                                              | **No**                                          | **Info** — technical dedup store                |
| **`processed_domain_events`** insert                | consumer idempotency                                                    | **No**                                              | **No**                                          | **Info** — not an end-user mutation             |
| **Validation failure** (pre-TX)                     | throw before `withCanonicalTransaction`                                 | **No** (intentional)                                | **No**                                          | **Pass** per DEC-007 success-only policy        |

### Findings (missing or partial audit points)

| ID               | Severity             | Gap                                                                                                     | Risk                                                                                                                                                                                      |
| ---------------- | -------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AUDIT-OK-01**  | —                    | Prisma create path writes `TOUR_CREATED` with `tenant_id` + `entity_id` in same TX as tour              | Forensic trail for production creates ([`5.5-audit-events.spec.ts`](../test/5.5-audit-events.spec.ts), [`audit-trail-integrity.spec.ts`](../test/security/audit-trail-integrity.spec.ts)) |
| **AUDIT-OK-02**  | —                    | Append-only trigger prevents tampering with audit store                                                 | Compliance ([`audit-trail-integrity.spec.ts`](../test/security/audit-trail-integrity.spec.ts))                                                                                            |
| **AUDIT-OK-03**  | —                    | RLS on `audit_events` mirrors `tours` tenant isolation                                                  | [`audit-log-security.spec.ts`](../test/2-observability/audit-log-security.spec.ts)                                                                                                        |
| **AUDIT-GAP-01** | **P0** (prod)        | **`STORAGE_DRIVER=memory`** (default in non-prod without `DATABASE_URL`) never calls `appendAuditEvent` | All creates/updates invisible to `audit_events`; pre-commit/CI may think audit is green while using memory                                                                                |
| **AUDIT-GAP-02** | **Closed** (DEC-047) | **`PATCH /tours`** on Prisma path appends `TOUR_UPDATED` in atomic TX                                   | Memory driver still non-forensic; no `TourUpdated` outbox yet                                                                                                                             |
| **AUDIT-GAP-03** | **P2**               | **Tenant provisioning** (`tenants` insert/upsert) has no audit row                                      | Privileged mutation (new tenant boundary) not in `audit_events`; acceptable for Phase 4.3 dev-only if provision stays internal                                                            |
| **AUDIT-GAP-04** | **P3**               | **Outbox status transitions** (relay) unlogged                                                          | Ops/debugging only unless billing/compliance requires event pipeline audit                                                                                                                |
| **AUDIT-GAP-05** | **Low**              | **`actor_id` nullable** — no DB `NOT NULL`, no `user_id` alias column                                   | Service/background calls without `actorId` in ALS persist `actor_id = null` while `tenant_id` is set; HTTP `/tours` path sets actor when headers present                                  |
| **AUDIT-GAP-06** | **Low**              | **No `actor_id` index**                                                                                 | Slow “all actions by user X” queries across tenants                                                                                                                                       |
| **AUDIT-GAP-07** | **Info**             | **No DB trigger** on domain tables to enforce audit                                                     | Bypass only if code path skips `appendAuditEvent` (e.g. memory driver, update path) — not silently fixed by Postgres                                                                      |

### Identity mapping (`user_id` requirement)

Callers asking for **`user_id`** should use **`audit_events.actor_id`**:

```text
HTTP x-user-id / JWT sub
  → TenantAuthContext.userId
  → runWithTenantContext({ actorId: auth.userId })
  → getActiveActorId()
  → audit_events.actor_id
```

Verified in integration test: `actor_id = "audit-user-1"` when `x-user-id` is set ([`5.5-audit-events.spec.ts`](../test/5.5-audit-events.spec.ts)).

### Remediation hints

| Priority | Action                                                                                                             | IDs          |
| -------- | ------------------------------------------------------------------------------------------------------------------ | ------------ |
| P0       | Production: enforce `STORAGE_DRIVER=prisma` + `DATABASE_URL` (see production-runtime / phase-4 audits)             | AUDIT-GAP-01 |
| P1       | ~~Add `AUDIT_ACTION_TOUR_UPDATED` on update~~ **Done** (DEC-047)                                                   | AUDIT-GAP-02 |
| P2       | `appendAuditEvent` for `TENANT_PROVISIONED` on admin provision (separate action, admin actor from service context) | AUDIT-GAP-03 |
| P3       | `requireActiveActorId()` on tenant-facing writes, or document system-null actor for jobs                           | AUDIT-GAP-05 |
| P3       | Index `(tenant_id, actor_id, created_at)` if user-scoped audit queries are required                                | AUDIT-GAP-06 |

---

## Static analysis — HTTP `middleware/` & ALS context propagation

**Audit date:** 2026-06-05  
**Scope:** `apps/api/src/middleware/*` and how it interacts with `TraceContext` / `TenantContext` (AsyncLocalStorage).

### Architectural note (not a chain middleware stack)

`apps/api` does **not** use a composable `middleware(req, res, next)` pipeline under `middleware/`. Context is bound at:

| Layer                 | File                                                       | Trace ALS                              | Tenant ALS                             |
| --------------------- | ---------------------------------------------------------- | -------------------------------------- | -------------------------------------- |
| Server wrapper        | `main.ts` → `withRequestLogging`                           | No bind                                | No bind                                |
| Request entry         | `app.ts` `createRequestListener`                           | **`runWithTraceContext`** (all routes) | No                                     |
| Tenant routes         | `http/bind-request-context.ts` `runWithHttpRequestContext` | Re-bind trace (same headers)           | **`runWithTenantContext`** + `actorId` |
| Tours / tenant-config | `tours.routes.ts`, `tenant-config.routes.ts`               | Via bind above                         | Via bind above                         |

So **forwarding** tenant + trace into handlers is **`bind-request-context` + `app.ts`**, not individual files in `middleware/`.

### Per-file review (`apps/api/src/middleware/`)

| File                              | Role                                                                | Binds ALS?                                                                      | Detached async branch?                                                                                    | Verdict                                                   |
| --------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **`tenant-rate-limiter.ts`**      | `consumeTenantRateLimit`, `sendTenantRateLimitExceeded`, store impl | **No** — **requires** caller to bind tenant ALS first (`requireActiveTenantId`) | **No** — `await limiter.consume()` / `await prisma.tenant.findUnique` stay on caller’s async continuation | **Pass** — runs inside parent context when used correctly |
| **`redis-rate-limiter-store.ts`** | Redis `RateLimiterRedis` backend                                    | N/A                                                                             | **No** — promise-based `consume`; no `setImmediate` / workers                                             | **Pass** (support module)                                 |
| **`error-interceptor.ts`**        | `handleHttpError`, `sendHttpError`, `resolveCorrelationId`          | **No** — reads `getActiveTraceId()` / `getActiveTenantId()` if still active     | **No** — synchronous mapping + `logger.error`; no `runWithTraceContext` / `runWithTenantContext` fork     | **Pass** — does not strip or replace ALS                  |

### Critical-bug criterion: “new branch without context propagation”

Searched `middleware/` for `setImmediate`, `setTimeout`, `Worker`, `runWithTraceContext`, `runWithTenantContext`, and `AsyncLocalStorage` usage.

**Result: no critical bugs** — none of the middleware modules spawn work on a **new** async branch that drops Tenant/Trace ALS.

### Context propagation matrix (middleware touchpoints)

```mermaid
flowchart TD
  A[app.ts runWithTraceContext] --> B[dispatchRequest]
  B --> C{tours / tenant-config?}
  C -->|yes| D[runWithHttpRequestContext]
  D --> E[runWithTraceContext inner]
  E --> F[runWithTenantContext]
  F --> G[consumeTenantRateLimit optional]
  G --> H[route handler]
  H -->|throw| I[handleHttpError in route catch]
  I --> J{still in ALS?}
  J -->|after inner run returns| K[tenant ALS cleared; trace outer may remain]
  B -->|health / internal| L[no tenant bind]
  A -->|throw| M[app catch handleHttpError]
```

| Call site                                                         | Trace at call                                                          | Tenant at call                                           | Critical?                                                                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `consumeTenantRateLimit` inside `runWithHttpRequestContext`       | Yes (nested trace)                                                     | Yes                                                      | **No**                                                                                                           |
| `handleHttpError` in `tours.routes` catch                         | Outer trace if app wrap active                                         | **Often no** (after `runWithHttpRequestContext` returns) | **No** — not a new branch; intentional teardown. `logInternalServerError` may omit `tenant_id` in structured log |
| `handleHttpError` in `app.ts` catch                               | Yes                                                                    | Usually no                                               | **No**                                                                                                           |
| `sendTenantRateLimitExceeded` from `handleHttpError`              | Uses `correlationId` from `resolveCorrelationId()` at start of handler | Yes if rate limit thrown inside bound handler            | **No**                                                                                                           |
| `sendTenantRateLimitExceeded` direct call with no `correlationId` | `randomUUID()` fallback                                                | N/A                                                      | **Low** — only if called outside trace ALS                                                                       |

### Related HTTP wrapper (outside `middleware/`)

| File                           | Propagates trace/tenant?                                                             | Critical bug?                  |
| ------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------ |
| `http/request-logging.ts`      | Does not bind; `res.on("finish")` inherits ALS from active request if still on stack | **No** — does not fork context |
| `http/bind-request-context.ts` | **Canonical binder** for both contexts on tenant routes                              | **No**                         |

### Findings summary

| ID                 | Severity | Finding                                                                                                                                                                                         |
| ------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CTX-MW-OK-01**   | —        | **No critical ALS fork** in any `middleware/` module                                                                                                                                            |
| **CTX-MW-OK-02**   | —        | Rate limiter **fail-closed** without tenant ALS (`requireActiveTenantId`)                                                                                                                       |
| **CTX-MW-INFO-01** | Info     | `middleware/` files are **helpers**, not stack middleware — binding policy must stay in `bind-request-context` + route adoption                                                                 |
| **CTX-MW-INFO-02** | Info     | `error-interceptor` **consumes** ALS when present but does not **establish** it (by design)                                                                                                     |
| **CTX-MW-LOW-01**  | Low      | Route `catch` → `handleHttpError` after inner context ends — trace/tenant for logs and correlation may differ (see **TRACE-REGEN-01** / TRACE-CONTEXT-SPLIT) — **not** introduced by middleware |

### Routes without full tenant+trace bind (for completeness)

Not in `middleware/`, but affects “every HTTP path has TenantContext”:

| Route                              | Trace (app outer) | Tenant ALS                                          |
| ---------------------------------- | ----------------- | --------------------------------------------------- |
| `GET /health`                      | Yes               | No                                                  |
| `POST /internal/tenants/provision` | Yes               | No                                                  |
| `GET /internal/test/db-pool-hold`  | Yes               | No (uses auth + explicit `withTenantRls(tenantId)`) |

These are **route-level** gaps, not middleware forks.

### Evidence

| Claim                                     | Spec / file                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| ALS survives async/await in handler chain | `test/2-observability/trace-isolation.spec.ts`, `test/0-functional/async-propagation.spec.ts` |
| ALS cleared after run completes           | `test/0-security/context-resilience.spec.ts` (ALS-01…04)                                      |
| Rate limit requires bound tenant          | `tenant-rate-limiter.ts` docstring + `requireActiveTenantId`                                  |
| Bind contract                             | `http/bind-request-context.ts`, `docs/phase-5/appendices/trace-request-context.md`            |

### Remediation hints (only if policy changes)

| Priority | Action                                                                                                                | IDs               |
| -------- | --------------------------------------------------------------------------------------------------------------------- | ----------------- |
| P2       | Single `resolveTraceIdFromHeaders` per request (remove nested re-bind)                                                | TRACE-REGEN-01    |
| P3       | Optional `runWithHttpRequestContext` on internal routes that already resolve `auth`                                   | route table above |
| P3       | Document that `middleware/` must never call `runWithTraceContext` with a **new** random id inside an existing request | CTX-MW-INFO-01    |

---

## Static analysis — unstructured I/O bypass (`console.*` / `process.stdout`)

**Audit date:** 2026-06-05  
**Scope:** `apps/api/**/*.{ts,tsx,mjs,js}` (excludes `docs/`, `node_modules/`, `dist/`).  
**Structured logger:** `apps/api/src/observability/logger.ts` (`pino` → default **stdout** via Sonic-Boom).  
**Method:** `rg 'console\.(log|info|warn|error|debug)'` and `rg 'process\.stdout'`.

### Verification verdict

| Claim                                                     | Result                                                                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| “No `console.log` / `process.stdout` remains in apps/api” | **FAIL** — **45** `console.*` call sites in executable code; **3** `process.stdout.write` call sites        |
| Production `src/` bypasses structured logger              | **1** — `graceful-shutdown.ts` uses `console.error` on shutdown failure                                     |
| HTTP request path uses pino only                          | **Pass** — `logHttpRequest` / `logger.error` in `error-interceptor`; no `console` in `src/` except shutdown |

**Note:** Pino itself writes NDJSON to **stdout** (`fd=1`). That is the intended structured sink, not a bypass.

### Summary by tier

| Tier                 | Files  | `console.*` sites | `process.stdout.write`                                                                  |
| -------------------- | ------ | ----------------- | --------------------------------------------------------------------------------------- |
| **`src/`** (runtime) | 1      | 1                 | 0                                                                                       |
| **`scripts/`**       | 5      | 14                | 0 (+ `validate-canonical-sync.mjs` uses `process.stderr.write` to forward child output) |
| **`test/`**          | 16     | 30                | 3                                                                                       |
| **Total**            | **22** | **45**            | **3**                                                                                   |

### Production runtime (`apps/api/src/`)

| File                          | Line | API             | Purpose                                 | Bypass?                                                |
| ----------------------------- | ---- | --------------- | --------------------------------------- | ------------------------------------------------------ |
| `server/graceful-shutdown.ts` | 69   | `console.error` | SIGTERM/SIGINT shutdown failure message | **Yes** — should use `logger.error` (see **LOG-V-01**) |

**No** `console.log`, `console.info`, or `process.stdout` in `src/`.

**Structured logging in `src/` (reference):**

| File                                  | Mechanism                        |
| ------------------------------------- | -------------------------------- |
| `main.ts`                             | `logger.info` (server start)     |
| `http/request-logging.ts`             | `logHttpRequest` → `logger.info` |
| `middleware/error-interceptor.ts`     | `logger.error` (500 path)        |
| `outbox/start-outbox-relay.ts`        | `logger.info` / `logger.warn`    |
| `events/projection-reconciliation.ts` | `logger.warn`                    |

### Scripts (`apps/api/scripts/`)

| File                                  | Line(s)                    | API                                                        |
| ------------------------------------- | -------------------------- | ---------------------------------------------------------- |
| `db-seed.ts`                          | 12, 17                     | `console.log`, `console.error`                             |
| `guard-no-raw-queries.mjs`            | 54, 55, 59                 | `console.error`, `console.log`                             |
| `validate-canonical-sync.mjs`         | 18–19, 23                  | `process.stderr.write` (child output relay), `console.log` |
| `reliability-outbox-relay-profile.ts` | 29, 30                     | `console.error`                                            |
| `log-backpressure-burst.ts`           | 112, 128–129, 143–144, 151 | `console.error` (benchmark summary to stderr)              |

### Tests & workers (`apps/api/test/`)

| File                                           | Line(s)                    | API                                     | Gating / notes                        |
| ---------------------------------------------- | -------------------------- | --------------------------------------- | ------------------------------------- |
| `0-performance/kernel-latency.spec.ts`         | 73                         | `console.info`                          | Human-readable report                 |
| `2-observability/noise-neighbor.spec.ts`       | 378, 404–406               | `console.log`, `console.info`           | `NOISE_NEIGHBOR_EMIT=1` / SRE verdict |
| `3-performance/cold-start-latency.spec.ts`     | 282, 296, 331, 334, 354    | `console.info`, `console.log`           | `COLD_START_LATENCY_EMIT=1`           |
| `3-performance/cold-start-http-worker.ts`      | 66, 69                     | `console.error`, `process.stdout.write` | `COLD_START_READY` handshake          |
| `3-performance/db-pool-saturation.spec.ts`     | 277                        | `console.info`                          | `*_EMIT` env                          |
| `3-performance/long-tx-safety.spec.ts`         | 336                        | `console.info`                          | `LONG_TX_SAFETY_EMIT=1`               |
| `3-performance/noisy-neighbor-latency.spec.ts` | 389, 392, 413              | `console.info`, `console.log`           | `NOISY_NEIGHBOR_LATENCY_EMIT=1`       |
| `3-performance/outbox-throughput.spec.ts`      | 392, 395–402, 487, 490–497 | `console.log`, `console.info`           | `OUTBOX_*_EMIT=1`                     |
| `3-performance/soak-memory-leak.spec.ts`       | 514, 517, 549              | `console.info`, `console.log`           | `SOAK_MEMORY_EMIT=1`                  |
| `3-performance/tenant-rate-limiting.spec.ts`   | 285+                       | `process.stdout.write`                  | JSON report when `EMIT_REPORT`        |
| `4-integration/graceful-shutdown.spec.ts`      | 462, 528                   | `console.warn`, `console.log`           | `GRACEFUL_SHUTDOWN_EMIT=1`            |
| `4-integration/graceful-shutdown-worker.ts`    | 91, 100, 94                | `console.error`, `process.stdout.write` | Subprocess worker protocol            |
| `chaos/atomic-crash-worker.ts`                 | 22, 59                     | `console.error`                         | Chaos harness                         |
| `chaos/atomic-tx-crash-child.ts`               | 15, 40                     | `console.error`                         | Chaos child                           |
| `chaos/atomic-write-perf.spec.ts`              | 39                         | `console.log`                           | Perf stats                            |
| `chaos/outbox-relay-memory.spec.ts`            | 162–164                    | `console.log`                           | Heap metrics line                     |
| `security/tenant-kernel-load-rls.spec.ts`      | 545                        | `console.log`                           | `TENANT_KERNEL_LOAD_EMIT=1`           |

### Findings

| ID                | Severity | Finding                                                                                                                                                             |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **STD-BYPASS-01** | **P1**   | Claim “no unstructured console/stdout” is **false** for `apps/api` as a whole                                                                                       |
| **STD-BYPASS-02** | **P1**   | **Single production bypass:** `graceful-shutdown.ts:69` — use `logger` (ties to **LOG-V-01**)                                                                       |
| **STD-BYPASS-03** | **Info** | Test/script `console` / `process.stdout.write` are **CI harness** patterns (`*_EMIT=1`, subprocess ready lines) — acceptable if policy scopes “runtime `src/` only” |
| **STD-BYPASS-04** | **Info** | `scripts/db-seed.ts`, guard scripts use console for CLI UX — not on request hot path                                                                                |
| **STD-OK-01**     | —        | Tour/health HTTP handlers do not call `console.*`                                                                                                                   |

### Policy recommendation

| Environment              | Allow console?                                                        |
| ------------------------ | --------------------------------------------------------------------- |
| `src/` production server | **No** — pino only                                                    |
| `scripts/`, `test/`      | Optional console for human/CI; prefer stderr + `*_EMIT` JSON lines    |
| Subprocess workers       | `process.stdout.write` OK for machine-readable handshakes (`*_READY`) |

### Remediation hints

| Priority | Action                                                                          | IDs                     |
| -------- | ------------------------------------------------------------------------------- | ----------------------- |
| P1       | Replace `console.error` in `graceful-shutdown.ts` with `logger.error`           | STD-BYPASS-02, LOG-V-01 |
| P2       | Add CI grep: forbid `console.` in `apps/api/src/` (exclude `scripts/`, `test/`) | STD-BYPASS-01           |
| P3       | Document allowed test emit prefixes vs production zero-console rule             | STD-BYPASS-03           |

---

## Verification — AsyncLocalStorage cleared after each HTTP request

**Audit date:** 2026-06-05  
**Script:** [`apps/api/scripts/verify-als-request-cleanup.ts`](../scripts/verify-als-request-cleanup.ts)  
**ALS stores:** `tenant-request-context.ts` (`tenantId`, `actorId`, `workspaceType`), `trace-request-context.ts` (`traceId`)  
**HTTP bind:** `app.ts` outer `runWithTraceContext`; `/tours` and `/api/v2/tenant-config` inner `runWithHttpRequestContext` (trace + tenant).

### How to run

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory npx tsx scripts/verify-als-request-cleanup.ts
```

Optional: `ALS_VERIFY_STRICT=1` fails exit code when the detached-scheduler footgun reproduces (default: **WARN only**, HTTP must pass).

### What the script checks

| Phase                 | Intent                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Direct ALS**        | Reject/throw/nested `runWithTenantContext` + `runWithHttpRequestContext` — store undefined after each `run()` settles                                                                                            |
| **HTTP instrumented** | Wraps `createRequestListener`; probes **before** request, **after** `await` handler, `queueMicrotask`, `setImmediate`, and **after 80 concurrent** GETs (`/health`, `/api/v2/tenant-config` A/B) + POST `/tours` |
| **Detached footgun**  | `setImmediate` scheduled inside `runWithTraceContext` + `runWithTenantContext` but **not awaited** — models fire-and-forget callbacks                                                                            |

### Results (2026-06-05 run, `STORAGE_DRIVER=memory`)

| Check                           | Outcome                                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Post-request HTTP cleanup**   | **PASS** — zero residuals on `http:after-handler-await`, `http:post-handler-microtask`, `http:post-handler-setImmediate`, `http:after-burst-setImmediate`, `http:after-tours-post` |
| **Between concurrent requests** | **PASS** — no tenant/trace visible on `http:before-request` for subsequent requests in burst                                                                                       |
| **Direct lifecycle**            | **PASS** — reject, nested trace/tenant, simulated `runWithHttpRequestContext` all clear store after settle                                                                         |

**Conclusion:** The production HTTP listener **does not** leave tenant or trace ALS bound after the request handler promise completes. Cross-request tenant bleed via **stale ALS on the Node worker** was **not** observed on the instrumented paths.

### Finding — scheduler footgun (not HTTP listener leak)

| ID                 | Severity                      | Finding                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ALS-FOOTGUN-01** | **Medium** (security hygiene) | Node propagates ALS into **`setImmediate` callbacks scheduled during `AsyncLocalStorage.run`**, even when the bind promise has **already settled** and the callback was **not awaited**. Repro: script phase `detached:setImmediate-after-run` still sees `tenantId` + `traceId`.                                            |
| **ALS-FOOTGUN-02** | **Info**                      | **Impact:** If application code registers `setImmediate` / `process.nextTick` / `void promise` work from a request **without** awaiting it, a later callback may execute with **stale tenant/trace** while another request is in flight on the same worker → wrong `requireActiveTenantId()`, audit `tenant_id`, or RLS GUC. |
| **ALS-FOOTGUN-03** | **Pass (current `src/`)**     | No raw `setImmediate(` in handlers except **`validation-scheduler.ts`**, where `setImmediate` is **awaited** inside a chain that runs while the HTTP caller still **`await runScheduledValidation`** (`pre-transaction-validation.ts`). Covered by `test/2-observability/trace-isolation.spec.ts`.                           |

**Not a memory leak of the ALS store itself:** Node clears the store when `run()` completes; the footgun is **delayed callbacks that captured the async context** at schedule time, not unbounded retention of store objects on the worker.

### Diagram — safe vs risky async boundary

```mermaid
sequenceDiagram
  participant HTTP as createRequestListener
  participant ALS as runWithTraceContext / runWithTenantContext
  participant CB as setImmediate callback

  HTTP->>ALS: run(handler)
  ALS->>ALS: handler work
  Note over ALS: PASS: handler await completes
  ALS-->>HTTP: store cleared
  HTTP->>HTTP: next request (clean ALS)

  ALS->>CB: setImmediate(fn) not awaited
  ALS-->>HTTP: store cleared (bind settled)
  CB->>CB: fn runs later with captured context
  Note over CB: ALS-FOOTGUN-01 stale tenant/trace possible
```

### Related automated tests

| Suite                                                      | Coverage                              |
| ---------------------------------------------------------- | ------------------------------------- |
| `test/0-security/context-resilience.spec.ts`               | ALS-01…04 teardown after throw/reject |
| `test/0-security/tenant-request-context-isolation.spec.ts` | TR-01…12 concurrent / nested          |
| `test/0-security/async-context-leak.spec.ts`               | Mixed-tenant + Postgres RLS           |
| `test/0-security/als-high-load-synthetic.spec.ts`          | 200-task trace+tenant stress          |
| `test/0-functional/async-propagation.spec.ts`              | ALS-PROP-1 call-chain propagation     |

### Remediation hints

| Priority | Action                                                                                                                               | IDs            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| P2       | Ban fire-and-forget `setImmediate` / `void promise` from route handlers without explicit `runWithTenantContext(tenantId, …)` re-bind | ALS-FOOTGUN-01 |
| P3       | Run `verify-als-request-cleanup.ts` in nightly CI (`STORAGE_DRIVER=memory`)                                                          | —              |
| P3       | Keep validation scheduler on **awaited** path only; document in `validation-scheduler.ts` header                                     | ALS-FOOTGUN-03 |
