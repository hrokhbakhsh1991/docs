# Phase 4 — Agent FAQ (FAIL traps)

```yaml
agent_load_tier: T0_execution
fail_token: FAIL
```

## Q: CONSISTENCY-REPORT says PASS — can I close Phase 4?

**No.** That audit is `documentation_graph_only`. Run [`CLOSURE-CHECKLIST.md`](../audits/CLOSURE-CHECKLIST.md) and `phase-4:gate`.

## Q: Which guard table is authoritative?

**`phase-4-guard.md` `p4_*` ids** — not `phase-4-tenant-kernel.md` §14.2 numbered rows (DRIFT-P4-02).

## Q: Does Husky prove Phase 4?

**No.** `ci:integrity` runs phase-0 + phase-1 only (DRIFT-P4-03). PR must run `pnpm run phase-4:gate`.

## Q: `TOUR_STORAGE` or `STORAGE_DRIVER`?

**`STORAGE_DRIVER=memory|prisma`** only — see [`storage-driver-truth.md`](storage-driver-truth.md).

## Q: Can I skip 4.4 (no P4-E-*)?

**No.** TH-1 is `required_for_4_6` in [`test-matrix.md`](test-matrix.md). 4.6 merge **FAIL**.

## Q: Where is tenant-kernel.spec.ts?

**`apps/api/src/tenant-kernel/tenant-kernel.spec.ts`** — not under `apps/api/test/` (path drift fixed in 4.0 subphase).

## Q: Doc score 100 — is code done?

**No** unless [`IMPLEMENTATION-TRUTH.md`](../audits/IMPLEMENTATION-TRUTH.md) shows 7/7 VERIFIED and gate JSON `ok:true`.

## Q: When can I start Phase 5 DDL?

After **4.6 DoD** and [`phase-4-enforcement.md`](../phase-4-enforcement.md) `phase_5_entry_requires_modular` — boot [`phase-5-agent-router.md`](../../phase-5/phase-5-agent-router.md).

## Q: Node 22 and gate fails?

**Expected.** Repo requires Node **24** (`package.json` engines). Run `nvm use` before any `pnpm` gate command.
