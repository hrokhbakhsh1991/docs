# P3-C — Super Admin Workspace Builder · Nano-Task Spec (AI Lite v2)

```yaml
doc_id: P3-C-WORKSPACE-BUILDER
version: 1.3-aligned
file_map: TEMP/p3/FILE-MAP.md
agent_entry: TEMP/p3/AGENT-START.md
nano_tasks: 14
parent_tasks: 7
start: P3-C-N-001
stop: P3-C-N-014
epic: P3-C
status: planned
execute_after: P3-B-N-014
execute_before: P3-D-N-001
doc_first: docs/phase-16/platform-workspace-builder.mdoc
doc_status: complete
quality_target: 9.9+/10
```

> **🤖 AI:** Entry [AGENT-START.md](./AGENT-START.md) · **Doc SoT:** [platform-workspace-builder.mdoc](../../docs/phase-16/platform-workspace-builder.mdoc)

---

## Doc-first covenant

**Markdoc SoT:** `docs/phase-16/platform-workspace-builder.mdoc` — versioning, API/RBAC, BFF, builder UX, publish pipeline, tests.

This file is the **execution checklist**. On conflict, mdoc wins for architecture.

---

## برای AI — 12 قانون

1. **فقط `P3-C-N-xxx` به ترتیب**
2. **Doc-first done** — mdoc exists; update mdoc if API shape changes
3. **Immutable publish** — INSERT version row only; never UPDATE `payload`
4. **Owner-only POST publish** — `assertPlatformOpsOwnerRole`
5. **Client validates** — `validateWorkspaceDefinitionPayload` before publish button enabled
6. **Renderer allowlist** — primitives + `platform.*` only in builder palette
7. **Preview headless** — `PlatformWizardEngine.buildRenderPlan`; no operator iframe
8. **Reuse Super Admin patterns** — BFF, tabs, create-club wizard UX, async states
9. **BFF** `/api/platform` → `/platform/v1`
10. **Draft in sessionStorage** — no server-side draft table in v1
11. **No `denali/ui` in `apps/web/src/platform`**
12. **`git diff --quiet packages/workspaces/denali`** every nano
13. **API before UI** — N-001/N-002 green before N-003 builder
14. **Sync web type with API DTO** — `PlatformClubDetail.workspaceDefinition` in N-013

---

## §Facts frozen (code-verified 2026-06-21)

| # | Fact | Evidence |
|---|------|----------|
| F1 | `createPublishedVersion` exists | `workspace-definition.repository.ts:48` |
| F2 | GET list + PATCH tenant assign exist | `workspace-definitions-list.ts`, `tenants-workspace-definition-patch.ts` |
| F3 | Audit ASSIGN/CLEAR exist | `platform-audit-logger.ts` |
| F4 | `WORKSPACE_DEFINITION_PUBLISHED` **not yet** in audit constants | add in N-001 |
| F5 | Owner-only pattern | `assertPlatformOpsOwnerRole` + billing mark-paid |
| F6 | Preview engine in web | `workspace-wizard-host.tsx` uses `PlatformWizardEngine` |
| F7 | API `tenants-get` returns `workspaceDefinition` DTO | `platform-tenant-detail.dto.ts:22` |
| F8 | Web `PlatformClubDetail` lacks binding field | sync in N-013 |
| F9 | Route registrar: list + tenant PATCH only | no POST publish routes yet |
| F10 | BFF: no workspace-definitions routes | N-011 creates |

---

## §File manifest

### Create

```text
docs/phase-16/platform-workspace-builder.mdoc                         ✅
apps/api/src/platform/publish-platform-workspace-definition-version.ts
apps/api/src/platform/create-platform-workspace-definition.schema.ts
apps/api/src/platform/publish-platform-workspace-definition-version.schema.ts
apps/api/src/platform/assert-workspace-definition-renderer-allowlist.ts
apps/api/src/routes/platform/workspace-definitions-post.ts
apps/api/src/routes/platform/workspace-definitions-version-get.ts
apps/api/src/routes/platform/workspace-definitions-versions-post.ts
apps/api/test/platform-workspace-definition-publish.spec.ts
apps/web/app/(platform)/workspace-definitions/page.tsx
apps/web/app/(platform)/workspace-definitions/[id]/page.tsx
apps/web/app/api/platform/workspace-definitions/route.ts
apps/web/app/api/platform/workspace-definitions/[id]/versions/route.ts
apps/web/app/api/platform/workspace-definitions/[id]/versions/[version]/route.ts
apps/web/src/platform/workspace-builder/builder-shell.tsx
apps/web/src/platform/workspace-builder/builder-draft-state.ts
apps/web/src/platform/workspace-builder/field-palette.tsx
apps/web/src/platform/workspace-builder/wizard-canvas.tsx
apps/web/src/platform/workspace-builder/field-inspector.tsx
apps/web/src/platform/workspace-builder/rule-matrix-editor.tsx
apps/web/src/platform/workspace-builder/preview-panel.tsx
apps/web/src/platform/workspace-builder/publish-bar.tsx
apps/web/src/platform/club-detail/tab-workspace-definition.tsx
apps/web/test/platform-workspace-builder.spec.ts
apps/web/test/platform-workspace-definition-tab.spec.ts
```

### Edit

```text
apps/api/src/http/platform-route-registrar.ts
apps/api/src/platform/platform-audit-logger.ts
apps/api/src/workspace-metadata/workspace-definition.repository.ts   # createDefinition, nextVersion
apps/web/src/platform/platform-nav.ts
apps/web/src/platform/club-detail/platform-club-detail-client.tsx
apps/web/src/platform/club-detail/platform-club-detail.types.ts
apps/web/src/platform/club-detail/load-platform-club-detail.server.ts  # if exists — enrich definition
docs/phase-16/platform-workspace-definitions.mdoc                      # cross-link only
```

### Forbidden

```text
packages/workspaces/denali/**
apps/web/src/wizard/platform/**   # P3-B only — builder must not import wizard platform composites into platform tree
```

Note: builder preview may import `@app-tour/platform-core` and `@app-tour/workspace-sdk/metadata` — not denali/ui.

---

## Parent task map

| Parent | عنوان | Nano |
|--------|--------|------|
| P3-C-T-000 | Publish API + audit | N-001 · N-002 |
| P3-C-T-001 | Field palette | N-003 · N-004 |
| P3-C-T-002 | Wizard canvas + inspector | N-005 · N-006 |
| P3-C-T-003 | Rule matrix | N-007 · N-008 |
| P3-C-T-004 | Preview + publish bar | N-009 · N-010 |
| P3-C-T-005 | Routes + nav + list | N-011 · N-012 |
| P3-C-T-006 | Club assign tab | N-013 · N-014 |

---

## NANO TASKS — DETAIL

### P3-C-N-001 [IMPLEMENT] `P3-C-T-000` — publish API + repository extensions

- **Deps:** P3-B-N-014 ✅
- **Doc:** mdoc § API + Publish pipeline

**DO THIS:**

1. Extend `WorkspaceDefinitionRepository`:
   - `createDefinition({ id, displayName })`
   - `getNextVersionNumber(definitionId): Promise<number>` — `max(version)+1` or 1
2. Create `assert-workspace-definition-renderer-allowlist.ts` — uses `isAllowedPlatformRendererId` from P3-B
3. Create `publish-platform-workspace-definition-version.ts`:
   - validate payload (SDK)
   - allowlist check
   - checksum
   - txn: `createPublishedVersion` + update `workspaceDefinition.status = "published"`
   - audit `WORKSPACE_DEFINITION_PUBLISHED`
4. Add audit constant to `platform-audit-logger.ts`
5. Routes:
   - `workspace-definitions-post.ts` — POST create definition (write role)
   - `workspace-definitions-versions-post.ts` — POST publish (**owner only**)
   - `workspace-definitions-version-get.ts` — GET version payload
6. Extend `WorkspaceDefinitionRepository`: `createDefinition`, `getNextVersionNumber`
7. Register paths in `platform-route-registrar.ts`:
   - `POST /platform/v1/workspace-definitions`
   - `POST /platform/v1/workspace-definitions/:id/versions`
   - `GET /platform/v1/workspace-definitions/:id/versions/:version`

**DO NOT:** UPDATE existing version rows · build UI · edit denali

**VERIFY:**
```bash
pnpm run guard:import-boundary
git diff --quiet packages/workspaces/denali
```

**NEXT:** P3-C-N-002

---

### P3-C-N-002 [TEST] `P3-C-T-000` — publish spec

- **Deps:** P3-C-N-001

**DO THIS:** `apps/api/test/platform-workspace-definition-publish.spec.ts`

| ID | Assert |
|----|--------|
| PB-01 | Double publish → two rows same `definitionId`, versions 1 and 2 |
| PB-02 | Same payload → identical checksum on republish of unchanged body |
| PB-03 | Payload with `validation: { validateCanonical: fn }` rejected (hooks stripped test via JSON function string or invalid shape) |
| PB-04 | Field id `denali.photos` rejected with `PLATFORM_RENDERER_NOT_ALLOWED` |
| PB-05 | Field id `platform.photos` accepted when allowlist includes it |
| PB-06 | Support role POST publish → 403 |
| PB-07 | POST create duplicate definition id → 409 |

Use in-memory prisma or conditional `DATABASE_URL` skip pattern from other platform specs.

**DO NOT:** `assert.ok(true)`

**NEXT:** P3-C-N-003

---

### P3-C-N-003 [IMPLEMENT] `P3-C-T-001` — field palette

- **Deps:** P3-C-N-002

**DO THIS:**

1. `field-palette.tsx` — lists primitive kinds + buttons for each `PLATFORM_GENERIC_RENDERER_IDS` entry
2. `builder-draft-state.ts` — types `BuilderDraftPayload extends WorkspaceDefinitionPayload` + sessionStorage helpers
3. On add: append to `fieldRegistry.fields` with generated defaults (see mdoc)
4. Markers: `data-platform-field-palette`, `data-palette-item={id}`

**DO NOT:** denali.* in palette · denali/ui imports

**NEXT:** P3-C-N-004

---

### P3-C-N-004 [TEST] `P3-C-T-001` — palette spec

| ID | Assert |
|----|--------|
| BU-01 | Palette source includes `platform.photos` button/marker |
| BU-02 | Palette does not include string `denali.photos` |
| BU-03 | Click add appends field to draft state (unit test on reducer) |

**NEXT:** P3-C-N-005

---

### P3-C-N-005 [IMPLEMENT] `P3-C-T-002` — wizard canvas + field inspector

- **Deps:** P3-C-N-004

**DO THIS:**

1. `wizard-canvas.tsx` — list steps from `wizard.roots`; fields grouped by `stepId`
2. Reorder/remove field actions (move up/down — no drag library required v1)
3. `field-inspector.tsx` — edit `id`, `canonicalPath`, `kind`, `required`, `stepId` for selected field
4. Validate id uniqueness client-side before publish
5. Markers: `data-platform-wizard-canvas`, `data-field-row={fieldId}`

**NEXT:** P3-C-N-006

---

### P3-C-N-006 [TEST] `P3-C-T-002` — canvas spec

| ID | Assert |
|----|--------|
| BU-04 | Removing field reduces `fieldRegistry.fields.length` |
| BU-05 | Duplicate field id flagged in client validation helper |

**NEXT:** P3-C-N-007

---

### P3-C-N-007 [IMPLEMENT] `P3-C-T-003` — rule matrix editor

- **Deps:** P3-C-N-006

**DO THIS:**

1. `rule-matrix-editor.tsx` — add/remove rules on `ruleSet.rules`
2. v1 fields: source field id, operator (`eq`/`neq`), value, effect (`hidden`/`required`)
3. Cap 20 rules — disable add when at cap
4. Marker: `data-platform-rule-matrix`

**NEXT:** P3-C-N-008

---

### P3-C-N-008 [TEST] `P3-C-T-003` — rule matrix spec

| ID | Assert |
|----|--------|
| RM-01 | Add rule increases rules array length |
| RM-02 | Cap at 20 prevents add (static constant test) |

**NEXT:** P3-C-N-009

---

### P3-C-N-009 [IMPLEMENT] `P3-C-T-004` — preview + publish bar

- **Deps:** P3-C-N-008

**DO THIS:**

1. `preview-panel.tsx`:
   - Run `validateWorkspaceDefinitionPayload(draft)`
   - `build-preview-plugin-from-draft.ts` — merge getStarterWorkspacePlugin() + draft data fields
   - Build render plan via `PlatformWizardEngine` + preview plugin
   - Show step/field count + violation list
2. `publish-bar.tsx`:
   - Owner: enabled when validation clean
   - Support/admin read-only: publish button disabled `data-publish-disabled="role"`
   - POST via `fetchPlatformApi('/workspace-definitions/${id}/versions', { method: 'POST', body })`
3. Markers: `data-platform-builder-preview`, `data-preview-violation-count`

**NEXT:** P3-C-N-010

---

### P3-C-N-010 [TEST] `P3-C-T-004` — preview + publish bar spec

| ID | Assert |
|----|--------|
| PV-01 | Invalid payload → violation count > 0 in preview helper |
| PV-02 | `publish-bar` sets disabled for `isOwner=false` |
| PV-03 | Preview helper returns step count > 0 for minimal valid draft |

**NEXT:** P3-C-N-011

---

### P3-C-N-011 [IMPLEMENT] `P3-C-T-005` — routes, nav, list page

- **Deps:** P3-C-N-010

**DO THIS:**

1. BFF routes (see mdoc § BFF)
2. `workspace-definitions/page.tsx` — table from GET list; link to `[id]`
3. `workspace-definitions/[id]/page.tsx` — wraps `builder-shell.tsx`
4. `builder-shell.tsx` — composes palette, canvas, inspector, rules, preview, publish
5. Add nav item in `platform-nav.ts`: Workspaces → `/platform/workspace-definitions`
6. Marker: `data-platform-workspace-definitions-page`, `data-platform-builder`

**NEXT:** P3-C-N-012

---

### P3-C-N-012 [TEST] `P3-C-T-005` — routes + boundary spec

| ID | Assert |
|----|--------|
| RT-01 | `platform-nav.ts` includes href `/platform/workspace-definitions` |
| RT-02 | `platform-epic-c-boundary` — no `@app-tour/workspace-denali/ui` under `src/platform` |
| RT-03 | Builder shell source matches `data-platform-builder` |
| RT-04 | BFF publish route proxies `/platform/v1/workspace-definitions/` |
| BU-06 | `build-preview-plugin-from-draft` preserves starter validation hook |

**NEXT:** P3-C-N-013

---

### P3-C-N-013 [IMPLEMENT] `P3-C-T-006` — club workspace definition tab

- **Deps:** P3-C-N-012

**DO THIS:**

1. Extend `PlatformClubDetail` type with optional `workspaceDefinition`
2. Sync `PlatformClubDetail` with API `workspaceDefinition` from `tenants-get` (API DTO already exists — web type + loader only)
3. `tab-workspace-definition.tsx`:
   - Select definition + version
   - PATCH existing endpoint
   - Write role only for PATCH button
4. Add tab `"workspace"` to `platform-club-detail-client.tsx` (label "Workspace")
5. Marker: `data-tab="workspace-definition"`

**NEXT:** P3-C-N-014

---

### P3-C-N-014 [TEST] `P3-C-T-006` — EPIC gate

- **Deps:** P3-C-N-013

**DO THIS:** `platform-workspace-definition-tab.spec.ts`

| ID | Assert |
|----|--------|
| TA-01 | Tab marker present in component source |
| TA-02 | PATCH path `/tenants/` + `/workspace-definition` in tab source |
| TA-03 | Assign button disabled when `opsRole === "support"` |

Run full EPIC verify:

```bash
pnpm run guard:import-boundary
git diff --quiet packages/workspaces/denali
pnpm --filter @apps/api exec node --test test/platform-workspace-definition-publish.spec.ts
pnpm --filter @apps/web exec node --import tsx --test \
  test/platform-workspace-builder.spec.ts \
  test/platform-workspace-definition-tab.spec.ts \
  test/platform-epic-c-boundary.spec.ts
```

| ID | Assert |
|----|--------|
| EX-01 | All P3-C specs exit 0 |
| EX-02 | `git diff --quiet packages/workspaces/denali` |
| EX-03 | `platform-nav.ts` contains Workspaces href |

**EPIC exit:**

- [ ] All 14 nanos done
- [ ] mdoc synced
- [ ] FILE-MAP P3-C doc ✅
- [ ] AGENT-START → P3-D-N-001 (or phase exit if skipping D)

**NEXT:** P3-D-N-001

---

## §STOP table

| Symptom | Action |
|---------|--------|
| UPDATE version payload column | **STOP** — INSERT only |
| Support user can publish | **STOP** — owner only |
| denali.* in builder palette | **STOP** |
| Import denali/ui in platform tree | **STOP** |
| Skip P3-B allowlist | **STOP** |

---

## §AI navigation

| Need | File |
|------|------|
| Architecture SoT | `docs/phase-16/platform-workspace-builder.mdoc` |
| Widget allowlist | `docs/phase-16/platform-generic-widgets.mdoc` |
| Metadata loader | `docs/phase-16/platform-workspace-definitions.mdoc` |
| Super Admin UI patterns | `docs/phase-15/platform-control-center-ui.mdoc` |
