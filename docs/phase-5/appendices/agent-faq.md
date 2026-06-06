# Phase 5 — Agent FAQ

> **Router:** [`phase-5-agent-router.md`](../phase-5-agent-router.md) · **Decisions:** [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md) · **Repo map:** [`IMPLEMENTATION-MAP.md`](IMPLEMENTATION-MAP.md)

## Q: Where is the write path / outbox / relay decided?

[`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md) — DEC-001..DEC-011. Supersedes vague `prisma.$transaction` lines in subphase drafts.

## Q: `withCanonicalTransaction` vs `withTenantRls`?

**5.4:** canonical persist uses `withCanonicalTransaction` only (DEC-002). Phase 4 per-op `withTenantRls` in `PrismaTourRepository` is replaced for writes — not two production paths.

## Q: `OUTBOX_RELAY_ENABLED` vs legacy `OUTBOX_PROCESSOR_ENABLED`?

Trunk uses **`OUTBOX_RELAY_ENABLED`** (DEC-005). Legacy Nest worker is reference only — see `legacy/.../outbox-relay-worker.ts`.

## Q: Can in-process bus still run?

**After commit only** via relay (DEC-004). `publishTourCreatedEvent` in `writeTour` is removed at 5.4. FORBIDDEN-006 = no bus-only path when relay enabled.

## Q: Where do projections sync?

`projection-sync.ts` + `PrismaTourRepository` create/update (DEC-003). Not a second SoT table.

## Q: Idempotency-Key header required for 5.4?

**Outbox yes** — `domain_event_id` UNIQUE (DEC-006). **HTTP optional** — when `Idempotency-Key` is sent on `POST /tours`, dedup is required ([`http-idempotency.md`](http-idempotency.md)). Omitted header = no HTTP dedup (backward compatible).

## Q: `phase-5-guard` PASS — is Phase 5 done?

**No.** That is **scaffold** (5.1 files). 5.3–5.5 need **behavioral** tests per [`test-inventory.md`](test-inventory.md). 5.2 is done; 5.3–5.5 are not.

## Q: Is 5.2 done?

**Yes (repo VERIFIED).** See [`IMPLEMENTATION-MAP.md`](IMPLEMENTATION-MAP.md) §5.2 and tests:

- `apps/api/test/canonical-validate-before-persist.spec.ts`
- `apps/api/test/validate-before-persist-ordering.spec.ts`

## Q: `phase-5.contract.spec.ts` proves outbox?

**No.** It only checks schema/SQL/Prisma/file exist (SCAFFOLD-REQ-P5-024). Outbox behavior is **5.4**.

## Q: Can I load layer4 monolith?

**No (T0).** Use router + precision pack. Layer4 is **T2** bulk REQ lookup only.

## Q: When does research doc apply?

**T3 narrative only** — [`research/phase-5-data-architecture-research.md`](../../research/phase-5-data-architecture-research.md) has non-authoritative banner. Schema DDL: [`phase-5-canonical-schema.md`](../../phase-5-canonical-schema.md).

## Q: phase-5:gate without phase-4?

**FAIL.** Chain includes `pnpm run phase-4:gate`. Entry yaml blocking fields are PASS — re-run gate on Node 24 before 5.6.

## Q: Doc 100 vs code?

| Score               | Meaning                                                 |
| ------------------- | ------------------------------------------------------- |
| **Doc 100**         | Precision pack + maps — agent can work without research |
| **Behavioral ~29%** | 5.2 done; 5.3–5.5 not                                   |
| **Weighted ~37**    | Phase not closed                                        |

## Q: Where is validate-before-persist documented?

[`phase-5-canonical-schema.md`](../../phase-5-canonical-schema.md) **§4.1** — pipeline order before persist.

## Q: `getStarterWorkspacePlugin` still in API?

**Not as sole resolver.** Use `resolveWorkspacePluginForType` via [`apps/api/src/workspace/resolve-workspace-plugin.ts`](../../../apps/api/src/workspace/resolve-workspace-plugin.ts). Starter-only test waiver: BLOCKER-P5-011.

## Q: In-process events from Phase 4?

**Replace** in 5.4 — `publishDomainEvent` before commit is FORBIDDEN-005/006 after outbox exists. Today `canonical-tour.service.ts` still publishes in-process until 5.4.

## Q: Denali / second workspace plugin?

**BLOCKER-P5-011** — `denali` → `WORKSPACE_PLUGIN_NOT_BOUND` until Phase 6. Test: `resolve-workspace-plugin.spec.ts`.

## Q: CONSISTENCY-REPORT PASS — phase closed?

**No.** Doc graph PASS ≠ repo behavioral closure. Read [`CONSISTENCY-REPORT.md`](../audits/CONSISTENCY-REPORT.md) repo section.

## Q: What subphase should I implement next?

Read [`IMPLEMENTATION-TRUTH.md`](../audits/IMPLEMENTATION-TRUTH.md) — first non-VERIFIED behavioral row. Typical order after 5.2: **5.3** and **5.5** in parallel, then **5.4**, then **5.6**.

## Q: Husky pre-commit runs phase-5:gate?

**No** (by design today). `ci:integrity` may not include full phase-4/5 gates — run `pnpm run phase-5:gate` manually before Phase 5 PR.

## Q: Node version?

**24** required (`nvm use`). Node 22 fails `engines` on `pnpm`.
