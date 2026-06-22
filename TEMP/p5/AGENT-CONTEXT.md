
# P5 — Agent Context (Facts Frozen)

```yaml
doc_id: P5-AGENT-CONTEXT
updated: 2026-06-21
current_task: P5-B-N-013
nano_done: 26
status: in_progress
covenant: TEMP/p5/p5-denali-safety.md
preservation: TEMP/p5/PRESERVATION-CHECKLIST.md
manifest: TEMP/p5/AGENT-MANIFEST.yaml
doc_sync: TEMP/p5/DOC-SYNC-INDEX.md
```

## 1. North star

**P5-core (Denali-first, exit path A):** P5-A cutover pilot + P5-B operator parity on metadata path — **zero regression** on Denali operator product (see PRESERVATION-CHECKLIST).

**P5-optional (exit path B, deferred):** P5-C/D/E — only when second customer needs gateway/commerce config.

## 2. Truth table

| Item | Status | Evidence |
|------|--------|----------|
| Metadata loader + tenant binding | ✅ | `apps/api/src/workspace-metadata/load-workspace-plugin-for-tenant.ts` |
| Flag + allowlist | ✅ | `is-workspace-metadata-enabled-for-tenant.ts` |
| Parity CI | ✅ | `apps/api/test/workspace-metadata-*-parity.spec.ts` |
| Scoped denali covenant | ✅ | `scripts/guards/guard-p3-denali-covenant.mjs` |
| p4:gate uses git diff denali | ✅ N-001 | `scripts/p4-club-product-gate.sh:16` |
| Tenant detail DTO binding fields | ✅ | `platform-tenant-detail.dto.ts` |
| Definition assign/clear audit | ✅ | `TENANT_DEFINITION_ASSIGNED` / `CLEARED` |
| Denali receipts offline | ✅ | `packages/workspaces/denali/src/http/finance.routes.ts` |
| Tour clone + template | ✅ | `denali.plugin.ts` `tourClone` · Phase 11 |
| Settings 9 modules | ✅ | `denali-settings.manifest.ts` |
| PSP / egress in trunk | ❌ | `apps/api/docs/legacy-vs-denali-gap-analysis.md` |
| p5:gate | 🟡 partial N-013 | `scripts/p5-enterprise-evolution-gate.sh` |
| phase-18 mdoc | ✅ N-002 | doc-first |

## 3. NOT gaps — do not rebuild

P4 catalog · portal · Super Admin sites · Denali wizard UI · composites · receipt routes · platform billing (P2-C).

## 4. metadataCutoverStage (computed DTO — no DB column)

| Stage | Rule |
|-------|------|
| `off` | `WORKSPACE_METADATA_ENABLED` false OR no `workspaceDefinitionId` |
| `pilot` | flag true + binding + allowlist env set and tenant in list |
| `live` | flag true + binding + allowlist unset/empty |
| `shadow` | doc label for CI only — not on tenant row |

Implement in: `apps/api/src/workspace-metadata/derive-metadata-cutover-stage.ts` (new, P5-A-N-003).

## 5. Denali commerce frozen

`offline_receipt` only. No Super Admin gateway toggle for Denali v1.

## 6. Prerequisite

P4 ✅ `pnpm run p4:gate`

## 8. Phase-18 doc pack

| mdoc | EPIC |
|------|------|
| `docs/phase-18/platform-metadata-cutover-pilot.mdoc` | P5-A |
| `docs/phase-18/platform-denali-operator-parity.mdoc` | P5-B |
| optional commerce / integrations / registrations mdoc | P5-C/D/E |
