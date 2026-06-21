# P3-A — Workspace Definitions · Nano-Task Spec (AI Lite v2)

```yaml
doc_id: P3-A-WORKSPACE-DEFINITIONS
version: 1.3-aligned
file_map: TEMP/p3/FILE-MAP.md
agent_entry: TEMP/p3/AGENT-START.md
current_task: P3-B-N-001
nano_tasks: 12
nano_done_in_epic: 12/12
parent_tasks: 6
start: P3-A-N-001
stop: P3-A-N-012
epic: P3-A
status: complete
execute_before: P3-B-N-001
doc_first: docs/phase-16/platform-workspace-definitions.mdoc
doc_status: complete
quality_target: 9.9+/10
```

> **🤖 AI:** Entry [AGENT-START.md](./AGENT-START.md) · **Doc SoT:** [platform-workspace-definitions.mdoc](../../docs/phase-16/platform-workspace-definitions.mdoc)

---

## Doc-first covenant

**Markdoc SoT:** `docs/phase-16/platform-workspace-definitions.mdoc` — two-plane model, data model, loader, API, ingress matrix, tests.

This file is the **execution checklist**. On conflict, mdoc wins for architecture.

---

## برای AI — 12 قانون

1. **فقط `P3-A-N-xxx` به ترتیب**
2. **`[IMPLEMENT]` قبل از `[TEST]`** در هر parent task
3. **§Facts frozen** — conflict → STOP
4. **`packages/workspaces/denali/**` diff خالی** (except nothing in P3-A)
5. **Payload = data-only** — hooks forbidden in JSON
6. **Wizard = `WorkspaceWizardSurface`** — NOT steps/surfaces
7. **Adapter merges package overlay** — never metadata-only return
8. **Immutable versions** — INSERT only in production publish path
9. **Export via registry** — `resolveWorkspacePluginForType`
10. **N-011 before P3-B** — ingress wiring is hard gate
11. **Engine cache** — extend key or invalidate on assign (mdoc § A6)
12. **Tier P0 ingress first** — validation, clone, wizard-template

---

## §Facts frozen (code-verified 2026-06-21)

| # | Fact | Evidence |
|---|------|----------|
| F1 | Tables + unique `(definitionId, version)` | migrations 20260621160000 |
| F2 | Tenant columns + FK SetNull | schema.prisma:45-47 |
| F3 | Adapter spreads overlay, overwrites data | metadata-plugin-adapter.ts:15-24 |
| F4 | Flag off → package always | workspace-metadata-loader.spec.ts:51 |
| F5 | Binding + flag → metadata fields | workspace-metadata-loader.spec.ts:63 |
| F6 | resolveById reads tenant row | read-tenant-workspace-metadata-binding.ts:21 |
| F7 | Ingress still package-only | canonical-validation-sync.ts:109 |
| F8 | denali-v1.json checksum verified on parse | parseWorkspaceDefinitionExportFile |
| F9 | Audit ASSIGN/CLEAR only | platform-audit-logger.ts:19-20 |
| F10 | Publish HTTP deferred P3-C | no workspace-definitions-versions-post.ts |

---

## §File manifest

### Create ✅ (N-001…N-010)

```text
docs/phase-16/platform-workspace-definitions.mdoc                         ✅ v1.3
apps/api/prisma/migrations/20260621160000_workspace_definitions/
apps/api/prisma/migrations/20260621170000_tenant_workspace_definition/
packages/workspace-sdk/src/metadata/workspace-definition-payload.ts
packages/workspace-sdk/src/metadata/index.ts
apps/api/src/workspace-metadata/  (full tree)
apps/api/scripts/export-workspace-definition.ts
apps/api/scripts/seed-workspace-definitions.ts
apps/api/scripts/seed/definitions/denali-v1.json
apps/api/src/routes/platform/workspace-definitions-list.ts
apps/api/src/routes/platform/tenants-workspace-definition-patch.ts
apps/api/src/platform/list-platform-workspace-definitions.ts
apps/api/src/platform/update-platform-tenant-workspace-definition.ts
apps/api/test/workspace-metadata-loader.spec.ts
apps/api/test/workspace-definition-export.spec.ts
apps/api/test/workspace-definition-tenant-binding.spec.ts
packages/workspace-sdk/test/workspace-definition-payload.spec.ts
```

### Create (N-011…N-012)

```text
apps/api/src/workspace/resolve-workspace-plugin-for-tenant-context.ts
apps/api/test/workspace-plugin-tenant-context-integration.spec.ts
```

### Edit (N-011)

```text
apps/api/src/tours/canonical-validation-sync.ts          # P0 — cache key + resolve
apps/api/src/tours/build-clone-tour-body.ts              # P0
apps/api/src/settings/wizard-template-catalog.ts         # P0
apps/api/src/platform/update-platform-tenant-workspace-definition.ts  # optional cache bust
```

### Explicit NO (v1 — overlay-only hooks)

```text
apps/api/src/settings/settings-registry.ts
apps/api/src/workspace-drafts/workspace-drafts.service.ts
apps/api/src/marketing/should-invalidate-marketing-catalog.ts
```

---

## Parent task map

| Parent | عنوان | Nano | Status |
|--------|--------|------|--------|
| P3-A-T-001 | DB schema | N-001 · N-002 | ✅ |
| P3-A-T-002 | Payload validate + checksum | N-003 · N-004 | ✅ |
| P3-A-T-003 | Runtime loader + adapter | N-005 · N-006 | ✅ |
| P3-A-T-004 | Export + seed JSON | N-007 · N-008 | ✅ |
| P3-A-T-005 | Tenant binding + platform API | N-009 · N-010 | ✅ |
| P3-A-T-006 | Production ingress wiring | N-011 · N-012 | ✅ | |

---

## NANO TASKS — DETAIL (landed N-001…N-010 retrospective)

### P3-A-N-001 [IMPLEMENT] `P3-A-T-001` — Prisma schema ✅

- **Done:** migrations for definitions + versions + tenant FK

| ID | Assert (retrospective) |
|----|------------------------|
| DB-01 | `workspace_definition_versions` unique on `(definition_id, version)` |
| DB-02 | `tenants.workspace_definition_id` FK with ON DELETE SET NULL |

---

### P3-A-N-002 [TEST] `P3-A-T-001` — schema integrity ✅

| ID | Assert |
|----|--------|
| DB-03 | Prisma client generates `WorkspaceDefinition` model |
| DB-04 | Migration SQL idempotent on fresh DB |

---

### P3-A-N-003 [IMPLEMENT] `P3-A-T-002` — SDK metadata subpath ✅

| ID | Assert |
|----|--------|
| WD-01 | `@app-tour/workspace-sdk/metadata` export in package.json |
| WD-02 | `stripWorkspacePluginToDefinitionPayload` omits validation key |

---

### P3-A-N-004 [TEST] `P3-A-T-002` — payload validation ✅

Spec: `packages/workspace-sdk/test/workspace-definition-payload.spec.ts`

| ID | Assert |
|----|--------|
| WD-03 | Valid starter payload passes validate |
| WD-04 | Payload with `validation: {}` rejected |
| WD-05 | Checksum stable across serializations |

---

### P3-A-N-005 [IMPLEMENT] `P3-A-T-003` — loader + adapter ✅

| ID | Assert |
|----|--------|
| LO-01 | `adaptMetadataPayloadToWorkspacePlugin` keeps overlay.validation |
| LO-02 | Overwrites fieldRegistry from payload |

---

### P3-A-N-006 [TEST] `P3-A-T-003` — loader spec ✅

Spec: `workspace-metadata-loader.spec.ts`

| ID | Assert |
|----|--------|
| LO-03 | Flag off → package plugin id |
| LO-04 | Flag on + binding → payload fieldRegistry |

---

### P3-A-N-007 [IMPLEMENT] `P3-A-T-004` — export + seed ✅

| ID | Assert |
|----|--------|
| EX-01 | `DEFAULT_WORKSPACE_DEFINITION_EXPORTS.denali.definitionId === "denali-tour-ops"` |
| EX-02 | denali-v1.json parses via parseWorkspaceDefinitionExportFile |

---

### P3-A-N-008 [TEST] `P3-A-T-004` — export spec ✅

Spec: `workspace-definition-export.spec.ts`

| ID | Assert |
|----|--------|
| EX-03 | Tampered checksum throws CHECKSUM_MISMATCH |
| EX-04 | `"validation" in exported.payload === false` |

---

### P3-A-N-009 [IMPLEMENT] `P3-A-T-005` — platform API ✅

| ID | Assert |
|----|--------|
| TB-01 | GET list returns items array shape |
| TB-02 | PATCH assign updates tenant columns |

---

### P3-A-N-010 [TEST] `P3-A-T-005` — tenant binding spec ✅

Spec: `workspace-definition-tenant-binding.spec.ts`

| ID | Assert |
|----|--------|
| TB-03 | `toTenantWorkspaceMetadataBinding` null when id null |
| TB-04 | resolveById uses metadata fieldRegistry when flag+binding+mock row |

---

## NANO TASKS — ACTIVE

### P3-A-N-011 [IMPLEMENT] `P3-A-T-006` — production ingress wiring

- **Deps:** P3-A-N-010 ✅
- **Doc:** mdoc § Production ingress (A6)

**DO THIS (order):**

1. **Create** `apps/api/src/workspace/resolve-workspace-plugin-for-tenant-context.ts`:

```typescript
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { isWorkspaceMetadataEnabled } from "../workspace-metadata/is-workspace-metadata-enabled.ts";
import { resolveWorkspacePluginForTenantById } from "../workspace-metadata/read-tenant-workspace-metadata-binding.ts";
import { resolveWorkspacePluginForType } from "./resolve-workspace-plugin.ts";

export async function resolveWorkspacePluginForTenantContext(
  tenantId: string,
  workspaceType: string,
): Promise<WorkspacePlugin> {
  if (!isWorkspaceMetadataEnabled()) {
    return resolveWorkspacePluginForType(workspaceType);
  }
  return resolveWorkspacePluginForTenantById(tenantId);
}
```

2. **P0 —** `canonical-validation-sync.ts`:
   - Add `resolveMetadataFingerprint(tenantId)` helper reading binding (or pass through cache key)
   - Extend `engineCacheKey` with `:defId:version` suffix when flag on
   - Replace `resolveWorkspacePluginForType` in `getOrCreateValidationEngine` cache miss path with awaited tenant context
   - For `validateCanonicalBeforePersistSync`: add `validateCanonicalBeforePersistAsync` wrapper OR resolve plugin once at HTTP boundary and pass into sync path

3. **P0 —** `build-clone-tour-body.ts`:
   - `const plugin = await resolveWorkspacePluginForTenantContext(input.tenantId, workspaceType)`

4. **P0 —** `wizard-template-catalog.ts`:
   - `assertWizardTemplateFieldsKnown` → tenant context resolve

5. **Optional —** `update-platform-tenant-workspace-definition.ts`:
   - After assign/clear txn: invalidate engine cache entries for `tenantId` prefix

6. **Export** from `apps/api/src/workspace/index.ts` or workspace-metadata barrel if needed

**DO NOT:**
- Wire settings-registry / drafts / marketing (overlay-only — mdoc tier NO)
- Change adapter semantics
- Enable prod flag
- Edit denali package

**VERIFY:**
```bash
pnpm run guard:import-boundary
git diff --quiet packages/workspaces/denali
```

**NEXT:** P3-A-N-012

---

### P3-A-N-012 [TEST] `P3-A-T-006` — integration gate

- **Deps:** P3-A-N-011

**DO THIS:** `apps/api/test/workspace-plugin-tenant-context-integration.spec.ts`

| ID | Assert |
|----|--------|
| IG-01 | Flag off → context resolve fieldRegistry deepEqual package denali |
| IG-02 | Flag off → validation.validateCanonical still function |
| IG-03 | `canonical-validation-sync.ts` source imports tenant context (static grep) |
| IG-04 | `build-clone-tour-body.ts` source imports tenant context |
| IG-05 | `wizard-template-catalog.ts` source imports tenant context |
| IG-06 | Engine cache key includes definition fingerprint when flag on (unit test on key helper) |

When `DATABASE_URL` set (optional integration):

| ID | Assert |
|----|--------|
| IG-07 | Tenant with binding + flag → resolve context fieldRegistry differs from package when seed differs |
| IG-08 | Assign PATCH clears cache / new key after binding change |

**EPIC verify:**

```bash
pnpm --filter @apps/api exec node --test \
  ../../packages/workspace-sdk/test/workspace-definition-payload.spec.ts \
  test/workspace-metadata-loader.spec.ts \
  test/workspace-definition-export.spec.ts \
  test/workspace-definition-tenant-binding.spec.ts \
  test/workspace-plugin-tenant-context-integration.spec.ts
pnpm run guard:import-boundary
git diff --quiet packages/workspaces/denali
```

**EPIC exit:**
- [ ] N-011 Done
- [ ] N-012 Done
- [ ] Sync AGENT-START → P3-B-N-001
- [ ] P3-A complete in FILE-MAP

**NEXT:** P3-B-N-001

---

## §STOP table

| Symptom | Action |
|---------|--------|
| wizard JSON with steps/surfaces | **STOP** |
| metadata-only plugin | **STOP** |
| edit denali package | **STOP** |
| skip N-011 → P3-B | **STOP** |
| wire overlay-only paths unnecessarily | **STOP** — see tier NO list |
| stale engine cache after assign | **STOP** — fix key or bust |

---

## §AI navigation

| Need | File |
|------|------|
| Architecture SoT | `docs/phase-16/platform-workspace-definitions.mdoc` |
| Denali safety | `TEMP/p3/p3-denali-safety.md` |
| Next EPIC | `TEMP/p3/p3-b-generic-widgets.md` |
| Frozen facts | `TEMP/p3/AGENT-CONTEXT.md` |
