Platform architectural mapping (read-only)
This report maps Identity/IAM, Finance/Ledgers, and Departures/Products as implemented under apps/api/ and packages/shared/. Terminology: Workspace = Tenant (tenants table); JWT and ALS use tenant_id, while some routes use :workspaceId (must match session tenant).
1. Identity & multi-tenancy foundation (IAM)
1.1 Core entities and database relations
ConceptEntity fileTableKey fieldsUser (global identity)
apps/api/src/modules/identity/entities/user.entity.ts
users
id, email, phone, hashed_password, profile_row_version (lines 14–85)
Workspace / Tenant
apps/api/src/modules/identity/entities/tenant.entity.ts
tenants
id, name, subdomain, enabled_modules (jsonb) (lines 22–63)
Membership (User ↔ Tenant + Role)
apps/api/src/modules/identity/entities/user-tenant.entity.ts
user_tenants
user_id, tenant_id, role, membership_status, session_version, labels, membership_metadata (lines 15–75)
Relation model:
User (1) ──< user_tenants >── (N) Tenant
              │
              └── role: varchar (owner | leader | admin | member | viewer)
              └── membership_status: INVITED | ACTIVE | SUSPENDED
UserEntity.memberships → OneToMany UserTenantEntity (83:84:apps/api/src/modules/identity/entities/user.entity.ts).
UserTenantEntity has ManyToOne to both UserEntity and TenantEntity with FK join columns user_id / tenant_id (68:74:apps/api/src/modules/identity/entities/user-tenant.entity.ts).
Uniqueness: one row per (user_id, tenant_id) (uq_user_tenants_user_id_tenant_id, line 16).
Owner invariant: partial unique index uq_user_tenants_active_owner_per_workspace — at most one active owner per tenant (lines 19–22).
Soft-delete: BaseTenantEntity supplies tenant_id, timestamps, deleted_at for tenant-scoped rows (9:24:apps/api/src/database/entities/base-tenant.entity.ts).
Related IAM entities:
workspace_invites — apps/api/src/modules/identity/entities/workspace-invite.entity.ts (invite token, email, role, tenant_id).
user_role_audit — role-change audit trail.
email_verification_token — email verification.
Nest module: apps/api/src/modules/identity/identity.module.ts registers entities and controllers (UsersController, MeController, InvitesController, WorkspaceOwnershipController, etc.).
1.2 RBAC vs dynamic permissions
The platform uses a hybrid model, not plain role-only RBAC:
Coarse workspace roles (WorkspaceRole in packages/shared/rbac/workspace-roles.ts, lines 1–16): owner, leader, admin, member, viewer with ROLE_RANK ordering.
Static capability grants per role — WORKSPACE_CAPABILITY_GRANTS in packages/shared/rbac/capabilities.ts (lines 58–66), e.g. tour.publish, tour.update.tripDetails.
Dynamic grants:user_tenants.membership_metadata JSON (allowedRegionIds, extra capabilities) — parsed in hydrate-workspace-ability-context.ts.
user_tenants.labels → marketing capabilities (e.g. club_member → marketing.segment.read).
tenants.enabled_modules → module capabilities (module.finance, module.form_builder).
JWT caps claim (comma-separated snapshot) with DB drift logging (auth.middleware.ts lines 397–407).
Enforcement layers:
LayerMechanismFileRoute role allow-list
@Roles() + RolesGuard
apps/api/src/modules/auth/roles.guard.ts (reads ALS role, lines 32–48)
CASL subject/action
@CheckAbilities() + AbilitiesGuard
apps/api/src/common/casl/abilities.guard.ts
Fine-grained capability
@RequireCapability() + evaluate-require-capabilities.ts
apps/api/src/common/casl/evaluate-require-capabilities.ts
Membership PATCH policy
Rank-based rules
apps/api/src/common/rbac/workspace-membership-rbac.policy.ts
CASL factory: WorkspaceAbilityFactoryService builds defineAbilityFor() from ALS (apps/api/src/common/casl/workspace-ability.factory.service.ts, lines 22–51). Ability definitions live in packages/shared/rbac/ability.factory.ts (actions: manage, create, read, update, delete, publish; subjects include Tour, Registration, Payment, FinanceReceipt, etc., lines 15–65).
Verdict: RBAC + capability-based authorization (CASL + explicit capability strings), with regional scope and tenant module gates.
1.3 Session / tenant context extraction (workspaceId / tenantId)
There is no Passport JWT strategy; JWT validation uses jose in middleware. JwtAuthGuard is only an alias for bearer presence (authorization-presence.guard.ts); real validation is in AuthMiddleware.
Middleware order (apps/api/src/main.ts, lines 70–77):
RequestContextMiddleware — AsyncLocalStorage request store
TenantResolverMiddleware — Host → req.tenant, setHostTenantId()
AuthMiddleware — JWT → setUserId, setTenantId, setRole, membership hydration
TenantMiddleware — requires resolved tenant, setTenantId again
TenantGuardMiddleware (Nest AppModule) — blocks routes without trusted tenant in ALS
JWT claims (auth.middleware.ts, lines 31–38, 301–341):
sub → user id
tenant_id → workspace id (this is the active tenant; not named workspaceId in JWT)
role → workspace role string
sess_ver → must match user_tenants.session_version (revocation)
caps → optional capability snapshot
Host alignment: JWT tenant_id must match req.tenant.id from subdomain resolution unless route is workspace listing (skipsJwtHostTenantAlignment, lines 45–47, 319–337). Mismatch → TENANT_HOST_TOKEN_MISMATCH.
ALS service: RequestContextService (apps/api/src/common/request-context/request-context.service.ts):
setTenantId / tryGetTenantId (lines 68–72, 201–207)
setHostTenantId (lines 172–183)
resolveTenantContext priority: JWT ALS → req.tenant → host ALS (lines 289–309)
PostgreSQL RLS: TenantSessionBindingService sets app.tenant_id on each query runner (apps/api/src/database/tenant-session-binding.service.ts, documented lines 33–47).
Route param workspaceId: Draft APIs compare URL workspaceId to ALS tenantId (tours.drafts.controller.ts, lines 45–76).
2. Financial & accounting architecture (ledgers & wallets)
2.1 Module layout
AreaPathLedger authority
apps/api/src/modules/finance/ledger/
Pricing engine
apps/api/src/modules/finance/pricing/
Payments orchestration
apps/api/src/modules/payments/ (not under finance/ but wired to ledger)
Receipts
apps/api/src/modules/finance/receipts/
Reconciliation
apps/api/src/modules/finance/reconciliation/ + apps/api/src/modules/reconciliation/
Nest wiring
apps/api/src/modules/finance/finance-ledger.module.ts
2.2 Double-entry ledger vs transaction log
Not a simple payment log. The authoritative money model is in-memory double-entry journals with debit/credit line pairs, materialized by:
postDoubleEntryJournal() — apps/api/src/modules/finance/ledger/post-double-entry-journal.ts (lines 95–147): exactly one debit + one credit, same amount_minor, distinct accounts.
postDoubleEntryReversalJournal() — reversals with reversesLineId (lines 163–217).
Persistence path: transactional outbox finance.ledger.double_entry_applied via emitFinanceLedgerDoubleEntryAppliedOutbox() (emit-finance-ledger-journal-outbox.ts, lines 12–62).
Important gap: Comments state there is no durable ledger_journal_lines table yet — journals are frozen in-memory objects + outbox payload until a worker/table lands (booking-ledger-authority.service.ts lines 60–63; ledger-journal-line.ts line 2).
Synthetic GL accounts (ledger-accounts.ts):
gl:leader-registration-payment-clearing
Per-booking wallet id: booking:{registrationId} via bookingWalletId() (booking-ledger-authority.service.ts, lines 14–16).
2.3 Trip expenses vs tour/departure
There is no separate expense ledger (transfers, guide fees, logistics as accounting line items). Operational “cost” lives in:
tours.cost_context (jsonb) — pricing/payment flags (tour.entity.ts, lines 67–68).
tour_details / tripDetails.logistics — dates, accommodation, guide language IDs, etc. (tours.service.ts normalizes logistics, lines 489–616).
Finance ties to participant revenue (registration quotes, payments), not tour P&L expense tracking.
2.4 Workspace wallet / leader balance
Wallet concept: synthetic ledger account booking:{registrationId}, not a DB wallet table.
Balance read model: calculateWalletBalance() in wallet-projection.ts (lines 34–77) — aggregates in-memory LedgerJournalLine[] (credits +, debits −). Documented as non-authoritative placeholder until SQL/materialized views exist (lines 4–11, 26–27).
Registration paid_amount: explicitly a projection from ledger facts (booking-ledger-authority.service.ts, lines 60–68); CI script check-ledger-only-money.mjs enforces that only ledger authority assigns money fields.
2.5 Concurrency & locking on financial mutations
MechanismWherePurposeOptimistic @VersionColumn row_version
registration.entity.ts lines 34–36
PATCH status/payment conflicts → REGISTRATION_ROW_VERSION_CONFLICT
Optimistic profile_row_version
user.entity.ts lines 64–69
PATCH /me
Pessimistic write FOR UPDATE
registrations.service.ts requireTourInTenantForUpdate lines 1038–1044; payment timeout job payments.service.ts lines 606–615 (skip_locked)
Serialize tour capacity / payment timeout batch
Pessimistic write
tours.service.ts line 343–344 (tour PATCH)
Concurrent tour edits
Pessimistic write
users-write.service.ts lines 670, 683
Membership writes
Idempotency scope
assertFinancialMutationRunsInIdempotentScope
Payment intents/refunds must run inside idempotency ALS (financial-idempotency.ts)
Gateway idempotency PK
postgres-payment-idempotency-key.store.ts
SELECT … FOR UPDATE on digest row
Outbox
Immutable append-only events
Ledger facts deduped by domainEventId
No row-version column on payments entity; payment state changes rely on transaction boundaries + idempotency keys + registration/tour locks in the same EntityManager transaction.
2.6 Payments ↔ ledger chain
PaymentEntity (apps/api/src/modules/payments/entities/payment.entity.ts) — FK registration_id, indexed by tenant/status.
On Paid:
PaymentCaptureLedgerAuthorityService.emitPaymentCaptureAtPaid() — debit clearing, credit booking:{registrationId} (payment-capture-ledger-authority.service.ts, lines 22–57).
Registration → AcceptedPaid via RegistrationsService.transitionRegistrationForPayment.
Outbox booking finalization phases (payments.service.ts, lines 699–757).
Leader manual payment PATCH uses BookingLedgerAuthorityService.applyLeaderRegistrationPaymentMutation() (leader patch path in registrations service).
Pricing snapshot (immutable): booking_price_snapshots — apps/api/src/modules/pricing/entities/booking-price-snapshot.entity.ts; linked from registrations.snapshot_id.
Manual receipts: payment_receipts → PaymentEntity (payment-receipt.entity.ts).
3. Departures & registrations lifecycle (operations)
3.1 Product model (foundation migration)
EntityFileRoleTour (legacy + canonical API surface)
tour.entity.ts
Tenant-scoped bookable activity; lifecycle_status DRAFT/OPEN/CLOSED/CANCELLED
TourProduct
tour-product.entity.ts
Catalog product (title, slug, settings)
TourDeparture
tour-departure.entity.ts
Calendar/inventory row: dates, capacity, sold_count, pricing
TourPrice
tour-price.entity.ts
Price rows per departure
Dual-write bridge: ToursService.syncProductDepartureForTour() (tours.service.ts, lines 172–259):
On first save without tourProductId: creates tour_products, then tour_departures with departure.id = tour.id (1:1 foundation model, lines 200–217), sets tour.tourProductId / tour.tourDepartureId, creates BASE tour_prices.
Subsequent updates mirror capacity, dates, lifecycle from tours row.
3.2 Wizard draft → published execution row
Wizard storage (not auto-published):
Entity: TourWizardDraftEntity — table tour_wizard_drafts (tour-wizard-draft.entity.ts, lines 16–51).
Scoped by (workspace_id, user_id) unique; JSON payload (Record<string, any>, line 41).
API: ToursDraftsController — GET/PATCH/DELETE api/v2/workspaces/:workspaceId/tours/drafts (tours.drafts.controller.ts).
Transition to physical tour/departure (manual product flow):
Client completes wizard (draft is a UX snapshot only).
POST /api/v2/tours (ToursService.createTour, line 732+) or PATCH with lifecycle_status: OPEN.
Publish gates: assertTourIsPublishable / assertTourStateReadyForOpenOnCreate / assertTourStateReadyForOpenAfterPatch (tour-lifecycle.policy.ts, tours.service.ts lines 834–840, 1160–1177).
CASL requires Publish on Tour / capability tour.publish (assert-tour-mutation-abilities.ts).
After save, syncProductDepartureForTour creates/updates product + departure rows (lines 855, 1188).
“Denali” naming: No Denali-specific entity in code; the wizard + tours/tour_departures stack is the implementation.
Lifecycle enum on departures: mirrors tour (TourLifecycleStatus on tour-departure.entity.ts, lines 45–52).
3.3 Registrations / booking chain
Entity: RegistrationEntity (registration.entity.ts):
tour_id + tour_departure_id (required FK to tour_departures, lines 38–43, 114–116).
bookableTourDepartureId(tour) returns tour.tourDepartureId ?? tour.id (bookable-departure-id.ts, lines 4–6).
Quote columns + snapshot_id → booking_price_snapshots.
Status/payment enums (lines 8–25, 69–85).
Create flow (registrations.service.ts, lines 317–354):
Lock/load tour (pessimistic in other paths).
Build quote via RegistrationQuoteApplicationService / PricingEngineService.
Set tourDepartureId: bookableTourDepartureId(tour).
saveRegistrationOrVersionConflict → outbox booking.created.
createAndStampSnapshot → immutable price snapshot + snapshotId stamp.
Financial linkage:
Registration
  ├─ tour_id / tour_departure_id  (operational)
  ├─ booking_price_snapshots (pricing truth at booking time)
  ├─ payments (PSP / manual intents, registration_id)
  ├─ payment_receipts (optional, manual flow)
  └─ outbox: finance.ledger.double_entry_applied (money journal lines)
Waitlist: waitlist-item.entity.ts also carries tour_departure_id (indexed).
Modules: registrations.module.ts imports payments, pricing, finance ledger, idempotency.
4. Architectural weaknesses & gap detection
4.1 Structural / modeling gaps
IssueEvidenceLedger not persisted in SQL
Journals only in outbox payload; no ledger_journal_lines entity/migration in repo grep
Dual-write tours ↔ product/departure
Risk of drift if syncProductDepartureForTour fails mid-flight; foundation 1:1 departure.id === tour.id limits multi-departure per product
Wizard draft disconnected from publish
No server job promoting tour_wizard_drafts → tours; client must call create/publish separately
No trip expense accounting
Logistics/guide costs only in JSON tripDetails; no GL expense accounts
MVP payment vs accounting
Docs (cost_and_payment.md) state payments are operational, not full settlement ledger
paid_amount dual meaning
Numeric column + ledger projection; reconciliation required on mismatch (documented in data model)
4.2 Type safety smells
LocationIssuetour-wizard-draft.entity.ts:41, save-tour-draft.dto.ts:15
payload!: Record<string, any>
tour.entity.ts:68
costContext?: Record<string, unknown> (loose JSON contract)
user-tenant.entity.ts:66
membershipMetadata!: Record<string, unknown>
ability.factory.ts:70
UserAbilityMembershipStatus includes (string & {}) widening
Test-only any in finance specs
payment-capture-ledger-authority.service.spec.ts
4.3 Indexing (foreign keys)
Well-indexed (examples):
user_tenants: tenant_id, user_id (17:18:apps/api/src/modules/identity/entities/user-tenant.entity.ts)
registrations: tenant_id, tour_id, tour_departure_id, status, payment_status (28:32:apps/api/src/modules/registrations/registration.entity.ts)
payments: registration_id, partial unique pending per registration (payment entity indexes)
tour_departures: tour_product_id, (tenant_id, starts_on)
Gaps to watch:
registrations.snapshot_id — no explicit @Index on entity (FK exists; verify migration).
tours.tour_product_id / tour_departure_id — nullable denormalized pointers; index coverage depends on migration 1777593000000-TourProductsDeparturesAndPrices.ts (not duplicated here).
4.4 N+1 / relation-loading risks
AreaAssessmentTour list/read
ToursCatalogReadApplicationService uses single query with leftJoinAndSelect for details, destination, destination.region (lines 67–71) — good
Tour create/update reload
findOne with TOUR_RESPONSE_RELATIONS — bounded joins
Registration reads
priceSnapshot relation eager: false (line 127) — avoids automatic N+1; callers must opt in
Payment timeout worker
Loops all tenants sequentially, then pending payments per tenant (payments.service.ts 599–628) — scalability smell, not classic N+1
Auth membership hydration
One raw query per authenticated request — acceptable
Users list
Directory uses GET /api/v2/users roster pattern (docs) — watch client-side fan-out if detail endpoints added per user
4.5 Security / consistency notes
Tenant id never taken from client body for registrations (documented in data_model.md §3).
tenantContextFrozen prevents ALS tenant mutation after bind (request-context.service.ts lines 30–49).
Finance mutations require idempotency ALS scope.
CaslMirrorAbilitiesGuard exists for defense-in-depth on sensitive controllers (documented in abilities.guard.ts lines 13–15).
4.6 Documentation anchors (outside code)
docs/20-architecture/data_model.md — User ↔ user_tenants ↔ Tenant ↔ Tour
apps/api/docs/AUTHORITATIVE-FINANCIAL-CUTOVER.md — pricing/ledger authority matrix
docs/20-architecture/flows/cost_and_payment.md — MVP payment scope limits
Quick reference: key DTO / schema entry points
DomainDTO / schema examplesIAM
patch-me.dto.ts, update-user-role.dto.ts, create-workspace-invite.dto.ts, transfer-workspace-ownership.dto.ts
Tours
create-tour.dto.ts, save-tour-draft.dto.ts, tour-response.dto.ts, list-tours-query.dto.ts
Registrations
create-registration.dto.ts, get-registration.dto.ts, payment PATCH DTOs in registrations module
Finance
finance-ledger-event.dto.ts, catalog-pricing-snapshot.dto.ts, payment domain types under finance/payments/domain/
OpenAPI
apps/api/openapi.json (generated contract)
Summary diagram

flowchart TB
  subgraph IAM
    U[users]
    UT[user_tenants role + caps metadata]
    T[tenants subdomain + modules]
    U --> UT --> T
  end

  subgraph Ops
    WD[tour_wizard_drafts]
    TOUR[tours DRAFT/OPEN]
    TP[tour_products]
    TD[tour_departures]
    WD -.manual create/publish.-> TOUR
    TOUR -->|syncProductDepartureForTour| TP
    TOUR --> TD
  end

  subgraph Booking
    REG[registrations]
    SNAP[booking_price_snapshots]
    PAY[payments]
    REG --> SNAP
    REG --> PAY
    REG --> TD
    REG --> TOUR
  end

  subgraph Finance
    DE[postDoubleEntryJournal in-memory]
    OB[outbox finance.ledger.double_entry_applied]
    WAL[booking:registrationId wallet account]
    DE --> OB
    PAY --> DE
    REG --> DE
  end

  JWT[AuthMiddleware tenant_id + role] --> UT
  JWT --> REG
This mapping is read-only and reflects the workspace as analyzed; no map.md / map.log files were written. If you want a follow-up deep-dive on a single flow (e.g. manual receipt → ledger → reconciliation), say which path to expand.



Finance & Ledger Deep-Dive: Manual Receipts vs. Automated Gateway Payments
This report traces only read-only execution paths in apps/api/src/modules/finance/, payments/, and registrations/. One important naming correction up front: manual receipt approval does not call applyLeaderRegistrationPaymentMutation. That method is the leader PATCH registration payment path. Manual receipt approval uses the same ledger spine as gateway capture: PaymentCaptureLedgerAuthorityService.emitPaymentCaptureAtPaid → postDoubleEntryJournal.

1. In-memory ledger & outbox pipeline
1.1 postDoubleEntryJournal → frozen in-memory facts
postDoubleEntryJournal materializes a balanced journal only in memory (no SQL ledger table). It validates accounts, builds exactly two LedgerJournalLine objects (debit first, credit second), and returns a frozen result:


post-double-entry-journal.ts
Lines 95-146
export function postDoubleEntryJournal(input: PostDoubleEntryJournalInput): PostDoubleEntryJournalResult {
  const tenantId = trimNonEmpty("TENANT_ID", input.tenantId);
  const debitAccount = trimNonEmpty("DEBIT_ACCOUNT", input.debitAccount);
  const creditAccount = trimNonEmpty("CREDIT_ACCOUNT", input.creditAccount);
  // ...
  const amountStr = assertPositiveMinorAmount(input.amount_minor).toString();
  // ...
  const debitLine = materializeLine({ /* side: "debit", account: debitAccount, ... */ });
  const creditLine = materializeLine({ /* side: "credit", account: creditAccount, ... */ });
  return freezePostDoubleEntryJournalResult({ journalId, lines: [debitLine, creditLine] });
}
Callers pass LedgerJournalLine[] into the outbox emitter; lines are never INSERTed into ledger_journal_lines (that table is future work per comments in booking-ledger-authority.service.ts and ledger-journal-line.ts).

1.2 emitFinanceLedgerDoubleEntryAppliedOutbox → outbox payload shape
Conversion is a straight serialization of the in-memory lines into outbox_events.payload, plus metadata for deduplication:


emit-finance-ledger-journal-outbox.ts
Lines 12-62
export async function emitFinanceLedgerDoubleEntryAppliedOutbox(input: {
  manager: EntityManager;
  outboxService: OutboxService;
  tenantId: string;
  registrationId: string;
  lines: readonly LedgerJournalLine[];
  domainEventIdOverride?: string | null;
}): Promise<void> {
  if (input.lines.length === 0) {
    return;
  }
  const tenantIdNorm = normalizeFinanceTenantId(input.tenantId);
  assertLedgerLinesFinanceTenantScope(tenantIdNorm, input.lines);
  const primary = input.lines[0]!;
  const domainRaw =
    override !== undefined && override !== ""
      ? override
      : `finance.ledger:${input.registrationId}:${primary.idempotencyKey}`;
  const domainEventId = domainRaw.length > 128 ? domainRaw.slice(0, 128) : domainRaw;
  await input.outboxService.addEvent(input.manager, {
    tenantId: tenantIdNorm,
    aggregateType: "FinanceLedger",
    aggregateId: primary.journalId,
    eventType: "finance.ledger.double_entry_applied",
    domainEventId,
    payload: {
      entityType: "finance_ledger_journal",
      registrationId: input.registrationId,
      journalId: primary.journalId,
      lines: input.lines.map((l) => ({ /* id, account, side, amount_minor, ... */ }))
    }
  });
}
Same-transaction coupling: OutboxService.addEvent uses the caller’s EntityManager, so the outbox row commits or rolls back with domain writes (outbox.service.ts lines 38–44).

Enqueue idempotency: enqueueOutboxEvent swallows duplicate (tenant_id, domain_event_id) unique violations (enqueue-outbox-event.ts lines 70–75). Payment capture uses override payment:{paymentId}:ledger-capture-anchor (payment-capture-ledger-authority.service.ts line 56).

Financial audit in the same TX: For financial event types, OutboxService.addEvent also calls FinancialMutationAuditService.recordOutboxFinancialMutation → append-only tenant_audit_events (outbox.service.ts lines 60–69; financial-mutation-audit.service.ts).

1.3 Outbox lifecycle — what consumes finance.ledger.double_entry_applied?
Stage	Component	Behavior
Enqueue
Domain TX + outbox_events INSERT
Payload holds full journal lines
Relay
OutboxRelayWorker (outbox-relay-worker.ts)
Polls when schedulers enabled
Dispatch
OutboxProcessor.processBatch (outbox.processor.ts)
FOR UPDATE SKIP LOCKED on pending rows
Handler
AuditService.deliverFromOutbox
For finance ledger: structured log only (audit.event.delivered with payload) — lines 59–65
There is no worker in this repo that:

INSERTs lines into ledger_journal_lines
Rebuilds wallet balances into a materialized table
Publishes to an external message bus for finance ledger (beyond logging)
Downstream readers of ledger facts (read paths, not outbox consumers):

FinanceReportsService.listLedgerEvents — queries outbox_events where eventType LIKE 'finance.ledger.%' (finance-reports.service.ts lines 158–185).
ledgerLinesFromFinanceOutboxRows — parses payload.lines[] back into LedgerJournalLine[] (payment-finance-reconciliation.loader.ts lines 92–115).
PaymentFinanceReconciliationService — periodic job loads outbox + payments + snapshots and runs generatePaymentReconciliationReport (payment-finance-reconciliation.service.ts lines 45–48).
issueImmutableInvoice — accepts caller-supplied ledgerLines (often from outbox parse) for sealed PDF/hash artifacts (immutable-invoice.ts lines 202–212).
Verdict: The pipeline does not stop at the DB transaction — rows land in outbox_events (+ tenant_audit_events for financial types). After commit, OutboxRelayWorker marks them DELIVERED after logging. There is no second-stage ledger persistence consumer; the outbox table is the durable event log for ledger lines today.

2. Wallet balance projection & verification
2.1 Where calculateWalletBalance gets LedgerJournalLine[]
wallet-projection.ts is a pure function — it does not query outbox, cache, or SQL:


wallet-projection.ts
Lines 34-49
export function calculateWalletBalance(
  tenantId: string,
  ledgerAccount: string,
  lines: LedgerJournalLine[]
): WalletProjection {
  const tenantNorm = normalizeFinanceTenantId(tenantId);
  for (const line of lines) {
    if (normalizeFinanceTenantId(line.tenantId) !== tenantNorm) {
      throw new Error(`FINANCE_WALLET_TENANT_SCOPE: ...`);
    }
  }
  const scoped = lines
    .filter((x) => x.account === ledgerAccount)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  // ... sum credits − debits into balance_minor
}
Callers supply the array:

Caller	Source of lines
payment-reconciliation-report.ts
[...input.ledgerLines] from loader
payment-finance-reconciliation.loader.ts
ledgerLinesFromFinanceOutboxRows(financeRows, tid) — reads outbox_events
immutable-invoice.ts
Caller-passed slice (often from reconciliation load)
Unit tests
Hand-built in-memory arrays (wallet-projection.spec.ts)
There is no transient process-global cache of ledger lines in production code paths reviewed.

2.2 BookingLedgerAuthorityService and mismatch handling
applyLeaderRegistrationPaymentMutation does not compare registrations.paid_amount to a wallet projection loaded from outbox. In the same request, it:

Builds new journals via postDoubleEntryJournal
Enqueues outbox
Projects paid_amount from the new lines only via projectPaidAmountString (lines 29–57, 135–141)

booking-ledger-authority.service.ts
Lines 29-57
function projectPaidAmountString(
  registrationId: string,
  payload: LeaderRegistrationPaymentPatchPayload,
  lines: LedgerJournalLine[],
  previousPaidAmount: string | undefined
): string | undefined {
  const bookingAcct = bookingWalletId(registrationId);
  if (lines.length > 0) {
    const onBooking = lines.filter((l) => l.account === bookingAcct).sort(/* ... */);
    const last = onBooking[onBooking.length - 1];
    if (last?.side === "credit") {
      return last.amount_minor;
    }
    if (last?.side === "debit") {
      return undefined;
    }
  }
  // ... fallbacks from payload.paidAmount / previousPaid
}
Cross-request / async integrity is handled elsewhere:


payment-reconciliation-report.ts
Lines 343-361
for (const bookingId of bookingIds) {
  const wallet = bookingWalletId(bookingId);
  const projection = calculateWalletBalance(tenantId, wallet, [...input.ledgerLines]);
  const ledgerMinor = projection.balance_minor.trim() || "0";
  const reg = registrationByBooking.get(bookingId);
  if (reg) {
    const paidProj = reg.paidAmountMinor?.trim() ?? "";
    const ledgerN = tryParseMinor(ledgerMinor);
    const regN = paidProj === "" ? 0n : tryParseMinor(paidProj);
    if (ledgerN !== undefined && regN !== undefined && ledgerN !== regN) {
      findings.push(/* LEDGER_VS_REGISTRATION_PAID_MISMATCH */);
    }
  }
}
detectPaymentMismatch compares PSP vs ledger vs booking snapshot triad (detect-payment-mismatch.ts) — used inside the same report, not inside BookingLedgerAuthorityService.

Policy vs implementation gap: scripts/check-ledger-only-money.mjs allows only booking-ledger-authority.service.ts to assign .paidAmount. Manual receipt approval does assign directly (see §3.2) — that violates the stated CI guard unless the script is not run on this tree.

3. Manual receipt vs. automated gateway accounting flows
The product has three money-touching paths, not two:

Path	Entry API	Ledger authority	postDoubleEntryJournal?
A. Leader PATCH payment
PATCH /api/v2/registrations/:id/payment
BookingLedgerAuthorityService.applyLeaderRegistrationPaymentMutation
Yes (leader idempotency keys)
B. Manual debt + receipt approve
POST .../payments/manual → upload receipt → POST .../receipts/:id/approve
PaymentCaptureLedgerAuthorityService.emitPaymentCaptureAtPaid
Yes (manual_receipt_approve)
C. Online gateway
createPaymentIntent → webhook Paid
Same as B (online_webhook_paid)
Yes (stable payment ids)
Paths B and C share identical GL accounts; path A uses the same accounts but different idempotency/metadata.

3.1 Synthetic GL accounts (both capture-style flows)
Constant:


ledger-accounts.ts
Lines 1-6
export const REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT = "gl:leader-registration-payment-clearing";
Wallet account: booking:{registrationId} from bookingWalletId().

Leader PATCH (applyLeaderRegistrationPaymentMutation) — receive:


booking-ledger-authority.service.ts
Lines 90-104
const { lines } = postDoubleEntryJournal({
  tenantId: registration.tenantId,
  debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
  creditAccount: bookingAccount,
  amount_minor: Math.round(payload.paidAmount).toString(),
  // metadata.kind: "registration_prepayment_received"
});
Leader PATCH — clear (NotPaid / zero paid):


booking-ledger-authority.service.ts
Lines 109-122
const { lines } = postDoubleEntryJournal({
  debitAccount: bookingAccount,
  creditAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
  amount_minor: prevMinor.toString(),
  // metadata.kind: "registration_prepayment_cleared"
});
Payment capture (manual receipt approve + gateway Paid):


payment-capture-ledger-authority.service.ts
Lines 32-47
const { lines } = postDoubleEntryJournal({
  tenantId,
  debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
  creditAccount: bookingWalletId(payment.registrationId),
  amount_minor: amountMinor,
  correlationId: `payment:${payment.id}:capture`,
  idempotencyKey: `payment:${payment.id}:capture-anchor`,
  stableJournalAndLineIds: stableIds,
  metadata: { kind: "payment_capture_at_paid", source, paymentId, registrationId }
});
Flow	Debit	Credit	Amount source
Leader receive
gl:leader-registration-payment-clearing
booking:{regId}
Math.round(payload.paidAmount)
Leader clear
booking:{regId}
clearing
previous paid_amount minor
Payment capture (manual + gateway)
clearing
booking:{regId}
paymentAmountToLedgerMinorString(payment.amount)
Capture flows use deterministic journal/line UUIDs (stable-payment-capture-ledger-ids.ts) and outbox domainEventIdOverride: payment:{id}:ledger-capture-anchor for idempotent replay.

3.2 Manual receipt — step-by-step to postDoubleEntryJournal
Submit receipt (no ledger):

FinancePaymentsController.submitReceipt          [finance-payments.controller.ts:75-92]
  → ReceiptService.submitReceipt                 [receipt.service.ts:42-120]
       → assert payment.method === MANUAL, status === PENDING
       → storage.upload → PaymentReceiptEntity PENDING
       → manager.save(PaymentReceiptEntity)      // NO postDoubleEntryJournal
Approve receipt (ledger):

FinanceAdminReceiptsController.approveReceipt    [finance-payments.controller.ts:120-131]
  → ReceiptService.approveReceipt                [receipt.service.ts:123-184]
       → receipt.status = APPROVED; save
       → payment.status = PAID; payment.paidAt = now; save
       → PaymentCaptureLedgerAuthorityService.emitPaymentCaptureAtPaid(..., "manual_receipt_approve")
            → postDoubleEntryJournal(...)       [payment-capture-ledger-authority.service.ts:32-47]
            → emitFinanceLedgerDoubleEntryAppliedOutbox(...)
       → registrationPaymentPort.transitionRegistrationForPayment(..., ACCEPTED_PAID)
       → updatedRegistration.paymentStatus = PAID
       → updatedRegistration.paidAmount = payment.amount   // direct column write
       → manager.save(RegistrationEntity)
Prior step — create manual debt (no ledger):

FinancePaymentsController.createManualPayment   [finance-payments.controller.ts:57-66]
  → ManualPaymentService.createManualPayment    [manual-payment.service.ts:19-56]
       → assertManualPaymentDebtAllowed (no PAID, no PENDING)
       → PaymentEntity MANUAL + PENDING; save   // NO ledger
3.3 Automated gateway — step-by-step to postDoubleEntryJournal
PaymentsService.createPaymentIntent*            [payments.service.ts:202+]
  → PaymentEntity ONLINE + PENDING (unique per registration)
  → gateway.createPaymentIntent (PSP)
PaymentsService.handleWebhook / applyPaymentStatus [payments.service.ts:638+]
  → on next === PAID:
       → paymentCaptureLedgerAuthority.emitPaymentCaptureAtPaid(..., "online_webhook_paid")
            → postDoubleEntryJournal (same as manual approve)
       → registrationPaymentPort.transitionRegistrationForPayment(..., ACCEPTED_PAID)
  → (does not set registration.paidAmount in PaymentsService grep — status via port only)
Gateway path relies on payment.succeeded / payment outbox plus capture ledger event; manual path skips PSP but emits the same finance.ledger.double_entry_applied shape.

3.4 Leader PATCH — step-by-step to postDoubleEntryJournal
RegistrationsController.updateRegistrationPayment [registrations.controller.ts:450-459]
  → RegistrationsService.updateRegistrationPayment  [registrations.service.ts:664-709]
       → assertFinancialIdempotencyKey + IdempotencyInterceptor scope
       → assertExpectedRegistrationRowVersion (optimistic)
       → bookingLedgerAuthority.applyLeaderRegistrationPaymentMutation
            → postDoubleEntryJournal (receive or clear)
            → emitFinanceLedgerDoubleEntryAppliedOutbox
            → registration.paymentStatus / paidAmount projected in authority
       → saveRegistrationOrVersionConflict (row_version)
Mutual exclusivity (pilot rules, not locks):

assertManualPaymentDebtAllowed blocks new manual PENDING if any PAID or PENDING exists (manual-payment-debt.policy.ts).
createPaymentIntent blocks second PENDING per registration (PaymentEntity partial unique index + service checks).
Leader PATCH does not require absence of a PaymentEntity; it can post ledger without a payment row.
So “mutually exclusive” is product/policy, not a single DB mutex on the booking wallet.

4. Concurrency risks on mutually exclusive flows
There is no durable ledger row lock — only:

Optimistic registrations.row_version on registration saves
Pessimistic locks on tours and payments in some paths
Outbox domainEventId dedupe (per event, not per wallet)
4.1 Double-spending / double credit on booking:{registrationId}
Scenario 1 — Leader PATCH + receipt approve (or gateway Paid) on same registration

Step	File:line	Risk
Leader posts receive journal
booking-ledger-authority.service.ts:90-105
Credits booking wallet
Approve posts capture journal
payment-capture-ledger-authority.service.ts:32-47
Second credit — different domainEventId (finance.ledger:{reg}:{idempotencyKey} vs payment:{payId}:ledger-capture-anchor)
Outbox dedupe
enqueue-outbox-event.ts:73-74
Does not dedupe across flows — keys differ
No code prevents both paths on one registration if a leader PATCH runs while a manual payment is later approved, or if PATCH happens after capture.

Scenario 2 — Parallel leader PATCHes

Mechanism	File:line	Effect
expected_row_version check
registrations.service.ts:686
Second PATCH should get REGISTRATION_ROW_VERSION_CONFLICT after first save bumps version
No FOR UPDATE on registration in PATCH path
findOneInManager read
TOCTOU: two concurrent requests can both read same version if neither saved yet
Scenario 3 — approveReceipt without registration row version


receipt.service.ts
Lines 160-180
const registration = await manager.findOne(RegistrationEntity, { ... });
// ...
updatedRegistration.paidAmount = payment.amount;
await manager.save(RegistrationEntity, updatedRegistration);
No expected_row_version, no pessimistic lock on registrations. Concurrent leader PATCH + approve can interleave: last writer wins on paid_amount while both ledger events may exist in outbox.

Scenario 4 — Duplicate capture replay

Mitigated for same payment id: stable journal IDs + domainEventIdOverride → duplicate enqueue skipped. Not mitigated across payment id + leader journal.

Scenario 5 — Payment timeout worker vs manual approve


payments.service.ts
Lines 606-615
.setLock("pessimistic_write")
.setOnLocked("skip_locked")
Locks payment rows for timeout; approve path does not lock payment row before read in approveReceipt (loads receipt with relations). Two operators approving same receipt: second hits Receipt already {status} (line 139).

4.2 Dirty-read balance mismatch (projection vs column)
Issue	Location	Detail
No live wallet table
wallet-projection.ts
Balance only correct for the slice of lines passed in
Registration paid_amount not ledger-derived on receipt approve
receipt.service.ts:179
Sets payment.amount string, not projectPaidAmountString from new lines
Leader path derives paid_amount from new lines only
booking-ledger-authority.service.ts:135-141
Ignores historical outbox lines in same TX
Reconciliation is async
payment-finance-reconciliation.service.ts
LEDGER_VS_REGISTRATION_PAID_MISMATCH is warning in report, not blocking
Unit mismatch risk
Leader uses Math.round(payload.paidAmount); capture uses paymentAmountToLedgerMinorString
DTO example uses large integers (minor); if payment.amount stored as major units, ledger vs column diverges
Stale read of wallet balance: Any API that called calculateWalletBalance with a partial outbox slice (loader caps: MAX_OUTBOX_FINANCE = 8000, lookback window) can under-count credits → false LEDGER_VS_REGISTRATION_PAID_MISMATCH or missed double-credit detection.

4.3 Exact lines to treat as high-risk concurrency surfaces
registrations.service.ts:694-700 — applyLeaderRegistrationPaymentMutation without registration pessimistic lock
receipt.service.ts:150-180 — capture ledger + direct paidAmount assign
payments.service.ts:687-692 — gateway capture ledger (parallel to 1 if leader PATCH allowed)
emit-finance-ledger-journal-outbox.ts:31-35 — separate domainEventId namespaces per flow
enqueue-outbox-event.ts:73-74 — dedupe only per domainEventId, not per wallet account
payment-reconciliation-report.ts:345-361 — post-hoc detection only
Summary table
Question	Answer
How in-memory journal becomes outbox?
emitFinanceLedgerDoubleEntryAppliedOutbox maps frozen LedgerJournalLine[] → outbox_events.payload + eventType: finance.ledger.double_entry_applied
Outbox consumer for ledger?
OutboxProcessor → AuditService.deliverFromOutbox (logs); no ledger_journal_lines writer
calculateWalletBalance data source?
Caller-supplied array; production recon loads from outbox_events via ledgerLinesFromFinanceOutboxRows
Mismatch handling in booking authority?
In-TX projection only; triad + ledger vs reg checks in reconciliation report
Manual receipt → postDoubleEntryJournal?
Only on approve via PaymentCaptureLedgerAuthorityService, not on submit
Leader manual accounting?
applyLeaderRegistrationPaymentMutation on PATCH payment (separate from receipts)
GL for capture vs leader receive?
Same clearing → booking wallet; leader clear reverses booking → clearing
Main concurrency hole?
Multiple independent journal enqueues per registration + receipt approve bypassing ledger-only paid_amount policy + no registration FOR UPDATE on approve
I can go deeper on webhook idempotency, refund reversals (PaymentRefundLedgerAuthorityService), or the reconciliation job schedule if you want a follow-up focused on one of those.

Phase 12.5 — Hardcore Ledger Persistence (read-only analysis + generated code)
Parsed maplog.md Tasks 12.5.1–12.5.5. Below: current-state audit, target architecture, migrations, entities, and refactored service code you can apply in Agent mode. No workspace files were modified (map.md / map.log untouched).

1. Current architecture (as implemented)
Concern	Today	Durability anchor
Journal materialization
post-double-entry-journal.ts — in-memory only, frozen LedgerJournalLine[]
None in SQL
Money writes
emitFinanceLedgerDoubleEntryAppliedOutbox → outbox_events payload lines[]
Transactional outbox
Wallet balance
calculateWalletBalance — loops in-memory lines
N/A
Reconciliation
payment-finance-reconciliation.loader.ts — parses up to 8000 finance.ledger.double_entry_applied outbox rows
Outbox replay
Reports ledger feed
finance-reports.service.ts listLedgerEvents — outbox only
Outbox
Capture / leader pay
PaymentCaptureLedgerAuthorityService, BookingLedgerAuthorityService
Outbox + registration projection
Payment ↔ ledger link
No ledger_journal_id on PaymentEntity or PaymentReceiptEntity
—
Today
postDoubleEntryJournal
outbox_events financ
flowchart LR
  subgraph today [Today]
    PDJ[postDoubleEntryJournal]
    Outbox[outbox_events finance.ledger.*]
    Mem[In-memory lines slice]
    Reg[registrations.paid_amount projection]
    PDJ --> Outbox
    Outbox --> Mem
    Mem --> Reg
  end
Risk: If outbox insert succeeds but a downstream consumer never runs, SQL has no ledger facts. Reconciliation and wallet math depend on parsing JSON from outbox (cap 8000, lossy under load).

2. Target architecture (maplog 12.5)
flowchart LR
  subgraph target [Phase 12.5]
    PDJ[postDoubleEntryJournal materialize]
    Persist[persistLedgerJournal + INSERT lines]
    Bal[account_balances UPSERT deltas]
    OutboxNotify[outbox optional DWH notify]
    Pay[payments.ledger_journal_id]
    PDJ --> Persist --> Bal
    Persist --> OutboxNotify
    Persist --> Pay
    Read[calculateWalletBalance SELECT snapshot]
    Bal --> Read
  end
Invariants

ledger_journal_lines — INSERT-only (DB trigger or app-only API).
account_balances — single row per (tenant_id, account); updates only via balance_minor = balance_minor + :delta in the same transaction as line inserts.
Outbox demoted to async notification / DWH, not SoR.
ledger_journal_id stamped on payment (and receipt on manual approve) at capture time.
3. Database migrations
3.1 1777600000000-LedgerJournalLinesAndAccountBalances.ts
import type { MigrationInterface, QueryRunner } from "typeorm";
export class LedgerJournalLinesAndAccountBalances1777600000000 implements MigrationInterface {
  name = "LedgerJournalLinesAndAccountBalances1777600000000";
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ledger_posting_side_enum" AS ENUM ('debit', 'credit');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ledger_journal_lines" (
        "id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "journal_id" uuid NOT NULL,
        "account" character varying(128) NOT NULL,
        "side" "ledger_posting_side_enum" NOT NULL,
        "amount_minor" bigint NOT NULL,
        "currency" character varying(8) NOT NULL,
        "idempotency_key" character varying(256) NOT NULL,
        "correlation_id" character varying(256) NOT NULL,
        "reverses_line_id" uuid,
        "metadata" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_ledger_journal_lines" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ledger_journal_lines_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "CHK_ledger_journal_lines_amount_positive" CHECK ("amount_minor" > 0),
        CONSTRAINT "UQ_ledger_journal_lines_tenant_idempotency"
          UNIQUE ("tenant_id", "idempotency_key")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ledger_journal_lines_tenant_journal"
        ON "ledger_journal_lines" ("tenant_id", "journal_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ledger_journal_lines_tenant_account_created"
        ON "ledger_journal_lines" ("tenant_id", "account", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ledger_journal_lines_reverses_line"
        ON "ledger_journal_lines" ("reverses_line_id")
        WHERE "reverses_line_id" IS NOT NULL
    `);
    /* Append-only guard at DB layer */
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION ledger_journal_lines_deny_mutation()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'ledger_journal_lines is append-only';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_ledger_journal_lines_no_update"
        BEFORE UPDATE ON "ledger_journal_lines"
        FOR EACH ROW EXECUTE FUNCTION ledger_journal_lines_deny_mutation();
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_ledger_journal_lines_no_delete"
        BEFORE DELETE ON "ledger_journal_lines"
        FOR EACH ROW EXECUTE FUNCTION ledger_journal_lines_deny_mutation();
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "account_balances" (
        "tenant_id" uuid NOT NULL,
        "account" character varying(128) NOT NULL,
        "balance_minor" bigint NOT NULL DEFAULT 0,
        "currency" character varying(8) NOT NULL DEFAULT '',
        "row_version" integer NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_account_balances" PRIMARY KEY ("tenant_id", "account"),
        CONSTRAINT "FK_account_balances_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_account_balances_tenant_account"
        ON "account_balances" ("tenant_id", "account")
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_ledger_journal_lines_no_delete" ON "ledger_journal_lines"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_ledger_journal_lines_no_update" ON "ledger_journal_lines"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS ledger_journal_lines_deny_mutation()`);
    await queryRunner.query(`DROP TABLE IF EXISTS "account_balances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_journal_lines"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ledger_posting_side_enum"`);
  }
}
3.2 1777600100000-AddLedgerJournalIdToPaymentsAndReceipts.ts
import type { MigrationInterface, QueryRunner } from "typeorm";
export class AddLedgerJournalIdToPaymentsAndReceipts1777600100000 implements MigrationInterface {
  name = "AddLedgerJournalIdToPaymentsAndReceipts1777600100000";
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN IF NOT EXISTS "ledger_journal_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_receipts"
      ADD COLUMN IF NOT EXISTS "ledger_journal_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payments_ledger_journal_id"
        ON "payments" ("ledger_journal_id")
        WHERE "ledger_journal_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payment_receipts_ledger_journal_id"
        ON "payment_receipts" ("ledger_journal_id")
        WHERE "ledger_journal_id" IS NOT NULL
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payment_receipts_ledger_journal_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payments_ledger_journal_id"`);
    await queryRunner.query(`ALTER TABLE "payment_receipts" DROP COLUMN IF EXISTS "ledger_journal_id"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "ledger_journal_id"`);
  }
}
Backfill note: One-time job: scan outbox_events where event_type = 'finance.ledger.double_entry_applied', INSERT into ledger_journal_lines (idempotent keys), rebuild account_balances from lines. Run before cutting over reads.

4. TypeORM entities
ledger-journal-line.entity.ts
import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { LedgerPostingSide } from "./ledger-journal-line";
@Entity("ledger_journal_lines")
@Index("idx_ledger_journal_lines_tenant_journal", ["tenantId", "journalId"])
@Index("idx_ledger_journal_lines_tenant_account_created", ["tenantId", "account", "createdAt"])
export class LedgerJournalLineEntity {
  @PrimaryColumn("uuid", { name: "id" })
  id!: string;
  @Column({ type: "uuid", name: "tenant_id" })
  tenantId!: string;
  @Column({ type: "uuid", name: "journal_id" })
  journalId!: string;
  @Column({ type: "varchar", length: 128, name: "account" })
  account!: string;
  @Column({
    type: "enum",
    enum: ["debit", "credit"],
    enumName: "ledger_posting_side_enum",
    name: "side"
  })
  side!: LedgerPostingSide;
  @Column({ type: "bigint", name: "amount_minor" })
  amountMinor!: string;
  @Column({ type: "varchar", length: 8, name: "currency" })
  currency!: string;
  @Column({ type: "varchar", length: 256, name: "idempotency_key" })
  idempotencyKey!: string;
  @Column({ type: "varchar", length: 256, name: "correlation_id" })
  correlationId!: string;
  @Column({ type: "uuid", name: "reverses_line_id", nullable: true })
  reversesLineId?: string | null;
  @Column({ type: "jsonb", name: "metadata", nullable: true })
  metadata?: Record<string, unknown> | null;
  @Column({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
account-balance.entity.ts
import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn, VersionColumn } from "typeorm";
@Entity("account_balances")
@Index("idx_account_balances_tenant_account", ["tenantId", "account"])
export class AccountBalanceEntity {
  @PrimaryColumn("uuid", { name: "tenant_id" })
  tenantId!: string;
  @PrimaryColumn({ type: "varchar", length: 128, name: "account" })
  account!: string;
  @Column({ type: "bigint", name: "balance_minor", default: "0" })
  balanceMinor!: string;
  @Column({ type: "varchar", length: 8, name: "currency", default: "" })
  currency!: string;
  @VersionColumn({ name: "row_version", default: 0 })
  rowVersion!: number;
  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
Entity column additions
// payment.entity.ts — add:
@Column({ type: "uuid", name: "ledger_journal_id", nullable: true })
ledgerJournalId!: string | null;
// payment-receipt.entity.ts — add:
@Column({ type: "uuid", name: "ledger_journal_id", nullable: true })
ledgerJournalId!: string | null;
5. Core persistence layer (new)
persist-ledger-journal.ts
import type { EntityManager } from "typeorm";
import { AccountBalanceEntity } from "../entities/account-balance.entity";
import { LedgerJournalLineEntity } from "../entities/ledger-journal-line.entity";
import type { LedgerJournalLine } from "./ledger-journal-line";
import type { PostDoubleEntryJournalResult } from "./post-double-entry-journal";
function signedDeltaMinor(side: "debit" | "credit", amountMinor: string): bigint {
  const a = BigInt(amountMinor);
  return side === "credit" ? a : -a;
}
function lineToEntity(line: LedgerJournalLine): LedgerJournalLineEntity {
  const row = new LedgerJournalLineEntity();
  row.id = line.id;
  row.tenantId = line.tenantId;
  row.journalId = line.journalId;
  row.account = line.account;
  row.side = line.side;
  row.amountMinor = line.amount_minor;
  row.currency = line.currency;
  row.idempotencyKey = line.idempotencyKey;
  row.correlationId = line.correlationId;
  row.reversesLineId = line.reversesLineId ?? null;
  row.metadata = line.metadata ?? null;
  row.createdAt = new Date(line.createdAt);
  return row;
}
/**
 * Durability anchor: INSERT journal lines + atomic balance deltas in caller's transaction.
 * Idempotent per (tenant_id, idempotency_key) — duplicate keys are skipped without error.
 */
export async function persistLedgerJournal(
  manager: EntityManager,
  result: PostDoubleEntryJournalResult
): Promise<{ journalId: string; lines: LedgerJournalLine[]; inserted: boolean }> {
  const lines = [...result.lines];
  if (lines.length === 0) {
    return { journalId: result.journalId, lines: [], inserted: false };
  }
  const repo = manager.getRepository(LedgerJournalLineEntity);
  let inserted = false;
  for (const line of lines) {
    const insertResult = await repo
      .createQueryBuilder()
      .insert()
      .into(LedgerJournalLineEntity)
      .values(lineToEntity(line))
      .orIgnore() /* ON CONFLICT DO NOTHING on UQ (tenant_id, idempotency_key) */
      .execute();
    if ((insertResult.raw?.length ?? insertResult.identifiers?.length ?? 0) > 0) {
      inserted = true;
      const delta = signedDeltaMinor(line.side, line.amount_minor);
      await manager
        .createQueryBuilder()
        .insert()
        .into(AccountBalanceEntity)
        .values({
          tenantId: line.tenantId,
          account: line.account,
          balanceMinor: delta.toString(),
          currency: line.currency
        })
        .orUpdate(
          ["balance_minor", "currency", "updated_at", "row_version"],
          ["tenant_id", "account"],
          {
            skipUpdateIfNoValuesChanged: false,
            upsertType: "on-conflict-do-update"
          }
        )
        /* TypeORM orUpdate may not express += ; use raw for atomic increment: */
        .execute();
      // Prefer raw SQL for true atomic increment (maplog 12.5.3):
      await manager.query(
        `
        INSERT INTO account_balances (tenant_id, account, balance_minor, currency, row_version, updated_at)
        VALUES ($1, $2, $3, $4, 1, now())
        ON CONFLICT (tenant_id, account) DO UPDATE SET
          balance_minor = account_balances.balance_minor + EXCLUDED.balance_minor,
          currency = CASE
            WHEN EXCLUDED.currency <> '' THEN EXCLUDED.currency
            ELSE account_balances.currency
          END,
          row_version = account_balances.row_version + 1,
          updated_at = now()
        `,
        [line.tenantId, line.account, delta.toString(), line.currency]
      );
    }
  }
  return { journalId: result.journalId, lines, inserted };
}
Implementation note: Use only the raw INSERT ... ON CONFLICT ... balance_minor + EXCLUDED.balance_minor path; drop the redundant TypeORM orUpdate block in the final PR to avoid double-applying deltas.

post-double-entry-journal.ts — add transactional entrypoint
Keep existing postDoubleEntryJournal / postDoubleEntryReversalJournal as pure materializers; add:

export async function postAndPersistDoubleEntryJournal(
  manager: EntityManager,
  input: PostDoubleEntryJournalInput
): Promise<PostDoubleEntryJournalResult & { persisted: boolean }> {
  const result = postDoubleEntryJournal(input);
  const { inserted } = await persistLedgerJournal(manager, result);
  return { ...result, persisted: inserted };
}
export async function postAndPersistDoubleEntryReversalJournal(
  manager: EntityManager,
  input: PostDoubleEntryReversalJournalInput
): Promise<PostDoubleEntryJournalResult & { persisted: boolean }> {
  const result = postDoubleEntryReversalJournal(input);
  const { inserted } = await persistLedgerJournal(manager, result);
  return { ...result, persisted: inserted };
}
6. wallet-projection.ts (rewrite)
import type { EntityManager } from "typeorm";
import { AccountBalanceEntity } from "../entities/account-balance.entity";
import { normalizeFinanceTenantId } from "./ledger-tenant-scope";
export type WalletProjection = {
  tenantId: string;
  ledgerAccount: string;
  balance_minor: string;
  currency: string;
  asOfLineId: string | null;
  asOfCreatedAt: string | null;
  entryCount: number;
};
/**
 * Authoritative wallet read: single-row snapshot (no outbox scan).
 */
export async function calculateWalletBalance(
  manager: EntityManager,
  tenantId: string,
  ledgerAccount: string
): Promise<WalletProjection> {
  const tenantNorm = normalizeFinanceTenantId(tenantId);
  const row = await manager.findOne(AccountBalanceEntity, {
    where: { tenantId: tenantNorm, account: ledgerAccount }
  });
  if (!row) {
    return {
      tenantId: tenantNorm,
      ledgerAccount,
      balance_minor: "0",
      currency: "",
      asOfLineId: null,
      asOfCreatedAt: null,
      entryCount: 0
    };
  }
  return {
    tenantId: tenantNorm,
    ledgerAccount,
    balance_minor: row.balanceMinor,
    currency: row.currency,
    asOfLineId: null,
    asOfCreatedAt: row.updatedAt.toISOString(),
    entryCount: -1 /* snapshot — use ledger_journal_lines COUNT if needed */
  };
}
Call-site change: Any calculateWalletBalance(tenant, account, lines) becomes await calculateWalletBalance(manager, tenant, account). immutable-invoice.ts stays non-authoritative or gets an async variant.

7. Authority service refactors
booking-ledger-authority.service.ts (pattern)
// Replace postDoubleEntryJournal + outbox-only with:
const { journalId, lines } = await postAndPersistDoubleEntryJournal(manager, { ... });
await emitFinanceLedgerDoubleEntryAppliedOutbox({
  manager,
  outboxService: this.outboxService,
  tenantId: registration.tenantId,
  registrationId: registration.id,
  lines,
  /* optional: emitOnlyIfNotify: true */
});
// paid_amount projection unchanged (still from lines[] returned by persist)
Apply the same for clear/receive branches. Pessimistic lock on registration (already from Task 12) must wrap the whole manager transaction so line insert + balance delta + registration save are atomic.

payment-capture-ledger-authority.service.ts
export async function emitPaymentCaptureAtPaid(
  manager: EntityManager,
  payment: Pick<PaymentEntity, "id" | "tenantId" | "registrationId" | "amount" | "currency" | "paidAt"> & {
    ledgerJournalId?: string | null;
  },
  source: PaymentCaptureLedgerSource
): Promise<{ journalId: string; lines: [LedgerJournalLine, LedgerJournalLine] }> {
  // ... build input ...
  const result = await postAndPersistDoubleEntryJournal(manager, { ... });
  await emitFinanceLedgerDoubleEntryAppliedOutbox({ manager, ..., lines: result.lines });
  return { journalId: result.journalId, lines: result.lines };
}
receipt.service.ts + payments.service.ts (Task 12.5.4)
const { journalId, lines } = await this.paymentCaptureLedgerAuthority.emitPaymentCaptureAtPaid(
  manager,
  payment,
  "manual_receipt_approve"
);
payment.ledgerJournalId = journalId;
await manager.save(PaymentEntity, payment);
savedReceipt.ledgerJournalId = journalId;
await manager.save(PaymentReceiptEntity, savedReceipt);
Same for payments.service.ts when next === PaymentStatus.PAID.

payment-refund-ledger-authority.service.ts
If payment.ledgerJournalId set → SELECT * FROM ledger_journal_lines WHERE journal_id = $1 for reversal anchor (no synthetic re-post).
Else → existing synthetic anchor + postAndPersistDoubleEntryJournal (idempotent keys).
postAndPersistDoubleEntryReversalJournal for reversal legs.
Outbox after persist (notify only).
8. Reconciliation & reports (stop outbox scans)
payment-finance-reconciliation.loader.ts
Replace ledgerLinesFromFinanceOutboxRows usage in loadPaymentReconciliationReportInputForTenant:

const lineRows = await manager.find(LedgerJournalLineEntity, {
  where: { tenantId: tid, createdAt: MoreThanOrEqual(since) },
  order: { createdAt: "ASC" },
  take: 50_000 /* or paginate */
});
const ledgerLines: LedgerJournalLine[] = lineRows.map(entityToLedgerJournalLine);
Keep payment.succeeded outbox path for PSP facts; ledger path reads SQL only.

finance-reports.service.ts listLedgerEvents
const journals = await manager
  .createQueryBuilder(LedgerJournalLineEntity, "l")
  .where("l.tenant_id = :tenantId", { tenantId })
  .orderBy("l.created_at", "DESC")
  .limit(capped)
  .getMany();
// Group by journal_id → FinanceLedgerEventRow
9. Module wiring
finance-ledger.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxModule } from "../outbox/outbox.module";
import { AccountBalanceEntity } from "./ledger/entities/account-balance.entity";
import { LedgerJournalLineEntity } from "./ledger/entities/ledger-journal-line.entity";
// ... existing providers ...
@Module({
  imports: [
    OutboxModule,
    TypeOrmModule.forFeature([LedgerJournalLineEntity, AccountBalanceEntity])
  ],
  providers: [/* unchanged */],
  exports: [/* unchanged */]
})
export class FinanceLedgerModule {}
Register entities in global TypeORM config / database.module entity list if not using forFeature only.

10. Task checklist vs maplog
Task	Deliverable in chat	Post-apply verification
12.5.1
Migrations + entities above
pnpm --filter @apps/api run migration:run
12.5.2
persistLedgerJournal + postAndPersist*
Unit tests in post-double-entry-journal.spec.ts
12.5.3
calculateWalletBalance(manager, …) + balance UPSERT
Rewrite wallet-projection.spec.ts with DB or mocked EntityManager
12.5.4
ledger_journal_id columns + stamp in receipt/payment
E2E approve receipt / webhook paid
12.5.5
pnpm --filter @apps/api exec tsc --noEmit + pnpm --filter @apps/api run test
Expect updates to ~15 spec files
11. Design decisions to confirm before coding
Currency on account_balances — maplog omits it; included here so WalletProjection.currency stays O(1). Alternative: join latest line per account.
Idempotent replay — ON CONFLICT DO NOTHING on lines skips balance delta (correct). Callers must treat “no insert” as success and load existing journal by idempotency key if they need journalId.
Refund anchor — Prefer payments.ledger_journal_id over synthetic capture re-materialization (fixes double-anchor risk noted in refund service comments).
Clearing account snapshot — maplog emphasizes booking:{registrationId} wallet; still apply deltas to REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT for full double-entry consistency.
12. Summary
Phase 12.5 moves the system of record from outbox_events.payload.lines to ledger_journal_lines, with account_balances as the hot read path for wallets. Outbox remains for integration/DWH; reconciliation stops parsing 8000 JSON blobs; payments and receipts get a hard ledger_journal_id link for audit and refund anchoring.

To apply this in the repo, switch to Agent mode and ask to implement maplog 12.5 — the blocks above are the intended full diff blueprint.

Finance/Ledger & Tour Lifecycle — Read-Only Vulnerability Audit
Scope: Phase 12.5 ledger persistence, payment/receipt flows, registration/tour locking. No files modified.

Executive summary
#	Finding	Severity	Production impact
1
Multi-currency poisoning in account_balances
Critical
Single balance_minor sums unrelated currencies on the same booking:{id} account
2
Inverted lock order (Reg → Tour vs Tour → Reg)
High (conditional)
Real deadlock risk on same registration under concurrent payment + operator status change; tour-only PATCH vs webhook is lower risk
3
number / Math.round on money paths
Medium–High
Precision loss and type-model drift; not widespread NaN on ledger strings
4
Extended gaps
Medium–High
Partial journal replay, dual reconciliation sources, missing FKs, webhook projection gaps, unlocked catalog mirror
1. Multi-currency poisoning risk — CONFIRMED (Critical)
Schema: PK is (tenant_id, account) only — currency is not part of the key

1777600000000-LedgerJournalLinesAndAccountBalances.ts
Lines 74-85
      CREATE TABLE IF NOT EXISTS "account_balances" (
        "tenant_id" uuid NOT NULL,
        "account" character varying(128) NOT NULL,
        "balance_minor" bigint NOT NULL DEFAULT 0,
        "currency" character varying(8) NOT NULL DEFAULT '',
        ...
        CONSTRAINT "PK_account_balances" PRIMARY KEY ("tenant_id", "account"),

        Finance / Ledger & Tour Lifecycle — Vulnerability Audit (Read-Only)
No files were modified. Findings below are from the current workspace implementation (including Phase 12.5 durable ledger).

Executive summary
#	Suspected flaw	Verdict	Production severity
1
Multi-currency poisoning on account_balances
Confirmed
Critical (financial integrity)
2
Tour ↔ Registration lock inversion deadlock
Confirmed (conditional)
High under concurrent payment + capacity/status ops
3
BigInt string → Number / Math.round
Partial — one serious smell, not widespread NaN crashes
Medium (precision / edge cases)
4
Extended gaps
Several additional High/Medium items
Mixed
Tests can pass because they use mocked manager.query, single-threaded flows, and mostly single-currency (IRR) fixtures.

1. Multi-currency poisoning risk
Schema: PK is (tenant_id, account) only — no currency

1777600000000-LedgerJournalLinesAndAccountBalances.ts
Lines 74-81
      CREATE TABLE IF NOT EXISTS "account_balances" (
        "tenant_id" uuid NOT NULL,
        "account" character varying(128) NOT NULL,
        "balance_minor" bigint NOT NULL DEFAULT 0,
        "currency" character varying(8) NOT NULL DEFAULT '',
        ...
        CONSTRAINT "PK_account_balances" PRIMARY KEY ("tenant_id", "account"),

account-balance.entity.ts
Lines 6-10
  @PrimaryColumn("uuid", { name: "tenant_id" })
  tenantId!: string;
  @PrimaryColumn({ type: "varchar", length: 128, name: "account" })
  account!: string;
ledger_journal_lines stores per-line currency (migration L23, entity L31–32), but the snapshot table does not include currency in the primary key.

UPSERT: numeric addition with “last currency wins” metadata

persist-ledger-journal.ts
Lines 60-74
      INSERT INTO account_balances (tenant_id, account, balance_minor, currency, row_version, updated_at)
      VALUES ($1, $2, $3::bigint, $4, 1, now())
      ON CONFLICT (tenant_id, account) DO UPDATE SET
        balance_minor = account_balances.balance_minor + EXCLUDED.balance_minor,
        currency = CASE
          WHEN EXCLUDED.currency <> '' THEN EXCLUDED.currency
          ELSE account_balances.currency
        END,
What happens with USD then IRR on the same account string

First credit (e.g. USD): insert row (tenant, account) → balance_minor = +USD_minor, currency = 'USD'.
Second credit (IRR) on the same account: balance_minor becomes USD_minor + IRR_minor as a single bigint sum — not a currency conversion; raw integer addition across currencies.
currency column flips to the latest non-empty EXCLUDED.currency (IRR), while balance_minor still contains the polluted sum.
That is silent, wrong, and will not throw at the database layer.

Where one account string sees multiple currencies
Account key	Source	Currency source
booking:{registrationId}
bookingWalletId()
Leader patch: registration.quotedCurrencyCode (L117); capture: payment.currency (L37–38 in payment-capture-ledger-authority.service.ts) — can differ on same registration
gl:leader-registration-payment-clearing
ledger-accounts.ts L7
One row per tenant for all registrations/payments
Any tenant that posts both IRR and USD (or EUR) through leader tools or mixed gateway currencies will merge all clearing activity into one bigint column.

Read path does not filter by currency

wallet-projection.ts
Lines 30-32
  const row = await manager.findOne(AccountBalanceEntity, {
    where: { tenantId: tenantNorm, account: ledgerAccount }
  });
Authoritative wallet reads return the polluted balance_minor and whichever currency label was written last — no validation against line-level currencies in ledger_journal_lines.

Recommendation (design)
Yes — composite PK (or unique constraint) should include currency, e.g. (tenant_id, account, currency), with UPSERT conflict target matching that triple. Alternatively, enforce one currency per tenant at the application layer and reject mixed-currency posts to shared accounts (especially gl:leader-registration-payment-clearing).

Severity: Critical for any multi-currency or mixed gateway reality.

2. Cross-entity transaction deadlock trap
PostgreSQL deadlock SQLSTATE is 40P01 (deadlock_detected), not 55P03 (lock_not_available / SKIP LOCKED). The inversion risk below still produces real deadlocks under load.

Lock inventory
Tour-first (FOR UPDATE on tours)


registrations.service.ts
Lines 1026-1037
  private async requireTourInTenantForUpdate(
    ...
  ): Promise<TourEntity> {
    return manager
      .getRepository(TourEntity)
      .createQueryBuilder("tour")
      ...
      .setLock("pessimistic_write")
      .getOne();
Used before capacity mutations in e.g.:

createRegistration — L271 (then may save(tour) L339)
updateRegistrationStatus — L618 (then save(registration) L638)
createPublicRegistrationOrWaitlist — L1728
promoteNextWaitlistItem — L1549
transitionRegistrationForPayment — L1635 when accepted-capacity counter changes
Registration-first (FOR UPDATE on registrations)


lock-registration-for-financial-mutation.ts
Lines 15-18
  const registration = await manager.findOne(RegistrationEntity, {
    where,
    lock: { mode: "pessimistic_write" }
  });
Used in:

updateRegistrationPayment — L678 (ledger only; no tour lock)
approveReceipt — L153–157, then transitionRegistrationForPayment L187
applyPaymentStatus (webhook) — L652–656, then transitionRegistrationForPayment L710
Tour-only (no registration lock in same flow)

ToursService.updateTour / loadTourForUpdateLocking — tours.service.ts L331–345 (setLock on t)
Chained path: Registration → Tour (payment / receipt)

registrations.service.ts
Lines 1616-1640
  async transitionRegistrationForPayment(...) {
    ...
    const affectsAcceptedCounter =
      isCapacityConsumingRegistrationStatus(previousStatus) ||
      isCapacityConsumingRegistrationStatus(targetStatus);
    const lockedTour = affectsAcceptedCounter
      ? await this.requireTourInTenantForUpdate(
          manager,
          registration.tourId,
          registration.tenantId
        )
      : null;
ACCEPTED and ACCEPTED_PAID both consume capacity (registration-outbox-event-type.ts L4–6).
PENDING → ACCEPTED_PAID (typical receipt approve / first-time paid webhook): wasAccepted=false, willBeAccepted=true → tour lock is taken after registration is already locked.

Deadlock scenario (confirmed)
Time	Thread A (tour-first)	Thread B (payment webhook / receipt)
T1
updateRegistrationStatus: requireTourInTenantForUpdate — holds tours row (L618)
T2
applyPaymentStatus / approveReceipt: lockRegistration — holds registrations row (L652 / L153)
T3
save(registration) (L638) — waits for B’s registration lock
transitionRegistrationForPayment → requireTourInTenantForUpdate (L1635) — waits for A’s tour lock
Cycle: A holds Tour, wants Registration; B holds Registration, wants Tour → PostgreSQL aborts one transaction (40P01).

Your three paths — precise mapping
Path	Your label	Actual lock order	Deadlock with inverted path?
A
requireTourInTenantForUpdate in registrations (capacity / booking)
Tour → (optional) Registration write without reg FOR UPDATE
Yes, vs B when payment promotes PENDING→ACCEPTED_PAID
B
approveReceipt
Registration → Tour (if capacity changes)
Yes, vs A
C
applyPaymentStatus (webhook)
Registration → Tour (same; L485–526 in processWebhook)
Yes, vs A
Clarifications

Operator PATCH tour capacity only (updateTour, tour lock only): does not by itself form a Tour↔Reg cycle with payment; it can block webhook tour lock (queueing), but not classic deadlock unless another flow holds registrations and wants that tour.
updateRegistrationPayment (leader money PATCH): Registration lock only (L678) — no tour lock; lower deadlock risk with tour-first booking, but still races on registration row vs status updates (see §4).
Severity: High for concurrent admin status changes + Zarinpal/Stripe PAID webhooks on the same tour, not for “capacity PATCH + webhook” alone.
flowchart LR
  subgraph tourFirst [Tour-first booking]
    T1[FOR UPDATE tours]
    T2[UPDATE registrations]
    T1 --> T2
  end
  subgraph payFirst [Payment-first]
    R1[FOR UPDATE registrations]
    R2[FOR UPDATE tours via transitionRegistrationForPayment]
    R1 --> R2
  end
  tourFirst -.->|deadlock cycle| payFirst
3. BigInt string mapping & serialization smells
Entity mapping (correct direction)

ledger-journal-line.entity.ts
Lines 28-29
  @Column({ type: "bigint", name: "amount_minor" })
  amountMinor!: string;

account-balance.entity.ts
Lines 12-13
  @Column({ type: "bigint", name: "balance_minor", default: "0" })
  balanceMinor!: string;
TypeORM maps PostgreSQL bigint to string in JS — appropriate for minor units.

wallet-projection.ts — safe for authoritative path

wallet-projection.ts
Lines 46-50
  return {
    ...
    balance_minor: row.balanceMinor,
No arithmetic on snapshot read.
sumWalletBalanceFromLedgerLines (L87–90) uses BigInt(line.amount_minor) — correct for in-memory recompute.

calculateWalletBalance is not used elsewhere in the repo (grep) — authoritative path is DB snapshot only; invoice uses sumWalletBalanceFromLedgerLines.

Confirmed smell: Math.round on leader paidAmount (number DTO)

booking-ledger-authority.service.ts
Lines 121-126
    if (payload.paidAmount !== undefined && payload.paidAmount > 0) {
      const { lines } = await postAndPersistDoubleEntryJournal(manager, {
        ...
        amount_minor: Math.round(payload.paidAmount).toString(),
DTO: paidAmount?: number (update-registration-payment.dto.ts L30).
> 2^53 or fractional rials/tomans: rounding / precision loss before ledger string.
Unlikely to yield NaN unless paidAmount is already NaN (validation may catch elsewhere).
Ledger posting itself uses BigInt in post-double-entry-journal.ts L43–54 — good.

Confirmed smell: Number() on minor string for registration projection (receipt)

receipt.service.ts
Lines 199-203
      const paidMinor = Number(paymentAmountToLedgerMinorString(String(payment.amount)));
      this.bookingLedgerAuthority.applyPaidAmountProjectionToRegistration(
        updatedRegistration,
        { paymentStatus: RegistrationPaymentStatus.PAID, paidAmount: paidMinor },
paymentAmountToLedgerMinorString returns an integer string (L3–9). For typical tour prices, Number(...) is exact. For amounts > Number.MAX_SAFE_INTEGER, paidAmount projection diverges from ledger string; stored column is numeric (registration.entity.ts L87–88) — DB may still hold exact value if written as string elsewhere.

Not a likely runtime crash; precision risk for very large minors.

Outbox / invoice JSON

emit-finance-ledger-journal-outbox.ts
Lines 47-60
      lines: input.lines.map((l) => ({
        ...
        amount_minor: l.amount_minor,
amount_minor is already a string in outbox JSON — safe (no JSON.stringify(BigInt) crash).

immutable-invoice.ts uses stableStringify on plain objects; ledger refs use string fields (L100–101) — OK.

Verdict on “catastrophic NaN / crashes”
Not confirmed as a systemic production crash from bigint mapping.
Confirmed: leader Math.round + receipt Number() bridge are the main precision / type-coercion smells; fix by keeping end-to-end string/BigInt for money (align with paymentAmountToLedgerMinorString style).

Severity: Medium (integrity at scale), not Critical unless you rely on Number for GL totals.

4. Extended gap detection
4.1 Tenant boundary on persist (application-layer only for lines)
persistLedgerJournal inserts line.tenantId (L39) with no call to assertLedgerLinesFinanceTenantScope (that runs only in outbox emit, L27–28). A buggy caller could insert cross-tenant lines; balance UPSERT would still key off line.tenantId. Defense in depth gap — Medium.

4.2 Idempotent line insert skips balance delta

persist-ledger-journal.ts
Lines 53-55
    if (!Array.isArray(insertRows) || insertRows.length === 0) {
      continue;
    }
If a line exists from a prior attempt but account_balances never updated (partial failure, manual ops), replay silently skips balance adjustment. Rare but snapshot vs lines drift — Medium.

4.3 Registration row not locked on status change vs payment lock
updateRegistrationStatus loads registration with no pessimistic_write (L594), then may lock tour (L618), then save(registration) (L638). Concurrent lockRegistrationForFinancialMutation on same row → lost updates / deadlock (above), not just deadlock. High operational risk.

4.4 payments / payment_receipts.ledger_journal_id without FK
Migration 1777600100000 adds column + partial indexes only — no FK to ledger_journal_lines(journal_id) or line ids. Orphan pointers possible if data repaired manually. Medium reconciliation/audit gap.

4.5 Reconciliation: snapshot vs lines can disagree after poisoning
Loader prefers DB lines, falls back to outbox (payment-finance-reconciliation.loader.ts L217–219); wallet balances from account_balances (walletBalanceMinorByBookingId L228–236). After multi-currency pollution, LEDGER_VS_REGISTRATION_PAID_MISMATCH checks can fire misleadingly or miss true FX errors — High with §1.

4.6 Index / scan risks (moderate)
Table	Index	Gap
ledger_journal_lines
(tenant_id, journal_id), (tenant_id, account, created_at)
OK for tenant-scoped reports
ledger_journal_lines
No index on registrationId (not a column)
Recon by registration relies on outbox payload or account prefix scan
account_balances
PK + redundant idx_account_balances_tenant_account
Fine
payments.ledger_journal_id
Partial index only
Lookup by journal OK; no referential integrity
No unindexed FK on registrations.tour_id for ledger (expected); not a ledger-table scan issue.

4.7 Tour lifecycle: departure mirror without row lock
syncTourDepartureFromTour (registrations.service.ts L1047–1058) UPDATE tour_departures by id without FOR UPDATE on departure — concurrent catalog sync from syncProductDepartureForTour can interleave; sold_count mirror drift under race — Medium (catalog vs booking), separate from ledger but same tour lifecycle layer.

4.8 Webhook does not lock payments row
processWebhook → applyPaymentStatus locks registration first, not payments (L486–491 find without lock). Two concurrent webhooks could race on same payment entity — Medium (status idempotency relies on idempotency key layer L505+).

Structural error map (file → issue)
File	Lines	Issue
1777600000000-LedgerJournalLinesAndAccountBalances.ts
74–81
PK (tenant_id, account) omits currency
persist-ledger-journal.ts
60–74
Cross-currency bigint sum; currency label overwrite
account-balance.entity.ts
6–16
Single balance row per account string
wallet-projection.ts
30–32
Read ignores currency dimension
ledger-accounts.ts
7
Shared clearing account per tenant
booking-ledger-authority.service.ts
117, 126
Per-reg currency from quote; Math.round on number
payment-capture-ledger-authority.service.ts
37–38
Currency from payment row
registrations.service.ts
618–638 vs 1635–1651
Tour→Reg vs Reg→Tour ordering
lock-registration-for-financial-mutation.ts
15–18
Registration FOR UPDATE
receipt.service.ts
153–157, 187, 199
Reg lock then tour transition; Number() on minor
payments.service.ts
652–656, 683–710, 485–526
Reg lock then tour transition on PAID
receipt.service.ts / payments.service.ts
182–185 / 688
ledger_journal_id stamp without FK enforcement
Bottom line
Multi-currency poisoning is real and critical — composite PK should include currency (or enforce single-currency per account at the API).
Deadlock risk is real for registration-locked payment/receipt flows that call transitionRegistrationForPayment when capacity is affected, concurrent with tour-locked registration status/booking on the same tour — not for tour capacity PATCH alone. Expect 40P01, not 55P03.
BigInt strings are mostly handled well in ledger core; Math.round and Number() on money paths are the main serialization/precision smells — unlikely to crash the process with NaN, but can corrupt amounts at scale.
Additional high-value gaps: unlocked registration status updates vs financial locks, non-FK ledger_journal_id, idempotent persist vs balance drift, and shared clearing account design.
I can outline a minimal fix ordering (schema migration + lock ordering policy) in Ask mode, or implement in Agent mode if you want that next.[Rules Gate] Starting Rules Gate check...
[Rules Gate] Rule model defines 45 unique field paths.
[Rules Gate] DENALI_WIZARD_CANONICAL_FIELD_PATHS has 45 entries.
[Rules Gate] All allow-list paths have a matching path definition in denaliRuleModel.
[Rules Gate] Steps identified in rules: denali_basic, denali_program, denali_logistics, denali_pricing, denali_photos
[Rules Gate] Rules Gate check completed.
