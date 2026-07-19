# Finance platform — operational ownership

```yaml
doc_id: FINANCE_OPERATIONAL_OWNERSHIP
version: "1.0"
date: "2026-07-19"
audience: on-call / new platform team
code_changes: none
```

**Purpose:** When production breaks, know **who owns the fix** — not how to redesign finance.

## Owner legend

| Owner | Meaning in this monorepo |
| ----- | ------------------------ |
| **finance-core** | `@app-tour/finance-core` — application engine + port contracts (no DB drivers) |
| **host API** | `apps/api` composition, Prisma finance repository, HTTP finance host, workspace-finance adapters |
| **workspace package** | `packages/workspaces/<id>` — ledger policy, receipt defaults, CoA, reaction, ops manifest |
| **platform infrastructure** | Shared Postgres/RLS/outbox relay, observability stack, object storage, deploy/migrate pipelines, tenant kernel |

`finance-http-contracts` is a **contract library** (schemas/ports). It is not an on-call owner; breaks there are owned by whoever ships the package change (usually host API + workspace authors), with finance-core as consumer.

---

## 1. Master ownership matrix

| Component / concern | finance-core | host API | workspace package | platform infrastructure |
| ------------------- | :----------: | :------: | :---------------: | :---------------------: |
| Use-case orchestration (approve/prepay/create payment) | **Primary** | Integrates | — | — |
| Port interfaces / public API freeze | **Primary** | Consumes | Consumes contracts | — |
| HTTP `/finance/*` handlers + idempotency leases | — | **Primary** | — | Auth/session plumbing |
| Tenant → workspaceType resolve | — | **Primary** | Declares type id | Tenant DB row |
| Capability gate (supported / module) | — | **Primary** (codegen consumer) | Manifest flags | Codegen pipeline |
| Ledger policy / CoA / journal materialization | Consumes plan | Enqueues plan | **Primary** | — |
| Receipt defaults | Consumes | Wires | **Primary** | — |
| TourCreated → finance reaction logic | — | HostIo + registry | **Primary** (adapter) | Outbox relay invoke |
| Prisma repository / Option C TX | — | **Primary** | — | Postgres connection |
| Booking payment projection | — | **Primary** (adapter) | — | Bookings schema |
| Receipt proof object storage | — | Adapter | — | **Primary** (MinIO/S3) |
| Database migrations (payments/receipts/schedules/outbox RLS) | — | Authors SQL/Prisma deltas | — | **Primary** (apply/migrate/RLS) |
| Monitoring (metrics/logs plumbing) | Emits via ports | Host adapters | May log in reaction | **Primary** (sinks/backends) |
| Alerts / paging | — | Defines finance signals (gap today) | — | **Primary** (Alertmanager/etc.) |
| Incident response (sev process) | Consult on engine bugs | **Primary** for money path | Consult on CoA/reaction | **Primary** for infra |
| Event failures (relay/claim/poison) | — | Finance reaction wiring | Reaction correctness | **Primary** (relay health) |
| Reconciliation (books vs payments) | Invoice helpers only | **Primary** (ops tooling/queries) | CoA meaning | Warehouse/BI optional |
| Ledger correction workflow | **Forbids silent rewrite in engine** | **Primary** (runbook + compensating ops) | May supply reversing journal policy | Audit/compliance storage |

---

## 2. Deep dive — required coverage areas

### 2.1 Database migrations

| Item | Owner |
| ---- | ----- |
| Schema design for `payments`, `payment_receipts`, `finance_schedules`, outbox columns, idempotency | **host API** (Prisma / `infra/sql/*finance*`) |
| Apply migrations, FORCE RLS, connection roles | **platform infrastructure** |
| Per-workspace DDL | **None by default** — not required; if invented, **workspace + host API** jointly |
| Rollback migrate | **platform infrastructure** (with host API change author) |

**Pager cue:** Migration/RLS failure → platform infra; bad finance DDL in PR → host API.

### 2.2 Monitoring

| Item | Owner |
| ---- | ----- |
| `FinanceMetricsPort` / `FinanceLoggerPort` calls in engine | **finance-core** (what to emit) |
| Adapter → pino / `metricsRegistry` | **host API** |
| Log/metric shipping, retention, dashboards platform | **platform infrastructure** |
| Operator finance KPI widgets (product UI) | **host API** / web — **not** SRE monitoring |
| Sparse counters / missing SRE dashboards | **Gap** — ownership still **host API** to define signals + **platform infra** to alert on them |

**Pager cue:** “No metrics in Grafana” → platform infra pipeline first; “finance never increments” → host API adapter / core instrumentation.

### 2.3 Alerts

| Item | Owner |
| ---- | ----- |
| Alert rule definitions for approve failure, outbox lag, ledger enqueue fail | **host API** (signal contract) + **platform infrastructure** (rule deploy) |
| Current state | **Unowned in practice** (hostile prod audit P0) — default escalation: **host API** on-call until rules exist |

**Pager cue:** Until alerts exist, finance incidents arrive via customer/ops UI or generic API error rates → **host API**.

### 2.4 Incident response

| Symptom class | First owner | Escalate to |
| ------------- | ----------- | ----------- |
| 5xx on `/finance/*`, idempotency storms | **host API** | platform infra (DB/pool) |
| Approve TX rollback / booking miss | **host API** | finance-core only if orchestration bug proven |
| Wrong CoA / unbalanced journal / wrong capture id | **workspace package** | host API (enqueue), finance-core (if identity helper bug) |
| RLS leak / wrong tenant data | **platform infrastructure** + **host API** | — |
| MinIO proof URL broken | **platform infrastructure** | host API adapter |
| Module unexpectedly disabled | **host API** (theme/gate) | workspace (manifest default flags) |
| Engine pure logic bug (debt gate, replay) | **finance-core** | host API verifies composition |

**Pager cue:** Open with **host API** for any live money-path incident; narrow to workspace or core after classification.

### 2.5 Event failures

| Failure | Owner |
| ------- | ----- |
| Outbox not draining / relay down | **platform infrastructure** |
| `tryClaim` / processed-event store | **host API** (finance processed log) + platform DB |
| Reaction throws / wrong journal from TourCreated | **workspace package** |
| HostIo wiring / `as never` / registry resolve | **host API** |
| Duplicate domainEventId conflicts | **host API** (unique + enqueue) + **workspace** if unstable ids |
| Prepay booking-sync degraded / retry API | **host API** |

**Pager cue:** Relay health → platform; “Denali reaction posts bad ledger” → workspace; “unsupported workspaceType on react” → host API registry/tenant row.

### 2.6 Reconciliation

| Activity | Owner |
| -------- | ----- |
| Compare Paid payments vs `finance.ledger.double_entry_applied` | **host API** (queries/runbooks) |
| Invoice / balance-due read models | **finance-core** helpers + **host API** facts port |
| CoA interpretation / wallet ids | **workspace package** |
| External GL / ERP export | **host API** or future integration — **not** finance-core |
| Cross-tenant recon | **platform infrastructure** (warehouse) + host API |

**Pager cue:** “Books don’t match cash” → host API recon; “wrong account names” → workspace.

### 2.7 Ledger correction workflow

There is **no** first-class “edit ledger row” API in finance-core (by design).

| Step | Owner |
| ---- | ----- |
| Policy: corrections via **reversing** journals / compensating entries | **workspace package** (how to build reversing lines) + **host API** (how to enqueue safely) |
| Execute correction in prod (manual SQL forbidden without infra) | **host API** + **platform infrastructure** (controlled change) |
| Freeze / disable finance module during incident | **host API** (theme) |
| Document customer-facing impact | **host API** / product ops |
| Change capture identity formulas | **Forbidden** without Architect YES — spans core docs + workspace adapters |

**Pager cue:** Never “fix” outbox payloads in place without a written correction runbook owned by **host API**.

---

## 3. Quick “who do I page?” card

```text
DB migrate / RLS / Postgres / relay process     → platform infrastructure
/finance HTTP, approve, prepay, idempotency    → host API
Wrong CoA, journal shape, TourCreated books    → workspace package (that tenant’s type)
Engine replay/debt-gate/identity helper bug    → finance-core
Metrics backend / paging system down           → platform infrastructure
No alert fired but money wrong                 → host API (then workspace)
```

---

## 4. Gaps a new team must know

| Gap | Practical ownership until closed |
| --- | -------------------------------- |
| No finance-specific alert rules | **host API** on-call + platform when adding rules |
| No consolidated finance incident/rollback runbook | **host API** should author; platform reviews infra steps |
| Ledger correction not productized | **host API** + Architect for any compensating procedure |
| finance-core cannot see prod DB | Core team debugs via failing tests + host reproduction |

---

## 5. Related docs

| Doc | Use when |
| --- | -------- |
| [`FINANCE_HOST_INTEGRATION_KIT.md`](./FINANCE_HOST_INTEGRATION_KIT.md) | What host must implement |
| [`FINANCE_HOSTILE_PRODUCTION_READINESS.md`](./FINANCE_HOSTILE_PRODUCTION_READINESS.md) | Ops gaps (alerts) |
| [`PAYMENT-LEDGER-BOUNDARY.md`](./PAYMENT-LEDGER-BOUNDARY.md) | Payment vs ledger spine |
| [`FINANCE_HOSTILE_DOMAIN_CORRECTNESS.md`](./FINANCE_HOSTILE_DOMAIN_CORRECTNESS.md) | Adapter-caused money bugs |
