# P3-D — Migration & Parity · Nano-Task Spec (AI Lite v2)

```yaml
doc_id: P3-D-MIGRATION-PARITY
version: 1.3-aligned
file_map: TEMP/p3/FILE-MAP.md
agent_entry: TEMP/p3/AGENT-START.md
nano_tasks: 12
parent_tasks: 6
start: P3-D-N-001
stop: P3-D-N-012
epic: P3-D
status: optional
optional: true
execute_after: P3-C-N-014
execute_before: —
doc_first: docs/phase-16/platform-workspace-cutover.mdoc
doc_status: complete
quality_target: 9.9+/10
```

> **🤖 AI:** Entry [AGENT-START.md](./AGENT-START.md) · **Doc SoT:** [platform-workspace-cutover.mdoc](../../docs/phase-16/platform-workspace-cutover.mdoc)

---

## Doc-first covenant

**Markdoc SoT:** `docs/phase-16/platform-workspace-cutover.mdoc` — Strangler Fig cutover, parity strategy, runbooks, tests.

This file is the **execution checklist**. On conflict, mdoc wins for architecture.

---

## برای AI — 12 قانون

1. **فقط `P3-D-N-xxx` به ترتیب**
2. **Doc-first done** — mdoc exists; update mdoc if cutover model changes
3. **Parity specs green before any prod tenant binding**
4. **Per-tenant cutover** — binding columns + flag; never global prod enable in first PR
5. **Rollback = clear binding** — no canonical tour migration
6. **Data surfaces only** — compare fieldRegistry/ruleSet/wizard; hooks stay package-owned
7. **Export checksum gate** — live export must match committed `denali-v1.json`
8. **Golden fixture:** `packages/workspaces/denali/test/fixtures/golden/tour-publish-ready.json`
9. **Denali package edits only N-009 README** — Architect YES; no fieldRegistry fixes in package
10. **Dev seed upsert ≠ production publish** — do not confuse with P3-C immutable INSERT
11. **Ingress P3-A-N-011 required for live cutover** — parity CI can run without it
12. **`git diff --quiet packages/workspaces/denali`** every nano (except N-009 with YES)
13. **Cutover gates G1–G8** — do not pilot prod until shadow specs green
14. **Ingress P0 list** — canonical-validation-sync, build-clone-tour-body, wizard-template-catalog
15. **Extend loader input with tenantId** in N-007 for allowlist check

---

## §Facts frozen (code-verified 2026-06-21)

| # | Fact | Evidence |
|---|------|----------|
| F1 | Export defaults `denali-tour-ops` | `build-workspace-definition-export.ts:24` |
| F2 | Seed parses + verifies checksum | `parseWorkspaceDefinitionExportFile` |
| F3 | Adapter merges overlay + payload | `metadata-plugin-adapter.ts:15` |
| F4 | Flag off → always package | `workspace-metadata-loader.spec.ts:51` |
| F5 | Binding + flag → metadata fields | `workspace-metadata-loader.spec.ts:63` |
| F6 | Tenant columns on Prisma | `workspaceDefinitionId`, `workspaceDefinitionVersion` |
| F7 | Ingress still package-only | `canonical-validation-sync.ts:109` |
| F8 | Golden smoke SMK-P6-06 exists | `smoke-golden.spec.ts:44` |
| F9 | `WORKSPACE_METADATA_TENANT_ALLOWLIST` | **not yet** — N-007 creates |
| F10 | Export presets denali/starter/urban | `DEFAULT_WORKSPACE_DEFINITION_EXPORTS` |
| F11 | `workspace-definition-export.spec.ts` starter round-trip | `apps/api/test/` |
| F12 | `toTenantWorkspaceMetadataBinding(null)` → null | `read-tenant-workspace-metadata-binding.ts:12` |
| F13 | Only `denali-v1.json` in seed dir today | `scripts/seed/definitions/` |

---

## §File manifest

### Create

```text
docs/phase-16/platform-workspace-cutover.mdoc                              ✅
apps/api/src/workspace-metadata/is-workspace-metadata-enabled-for-tenant.ts
apps/api/test/workspace-metadata-denali-parity.spec.ts
apps/api/test/workspace-metadata-render-plan-parity.spec.ts
apps/api/test/workspace-metadata-cutover-allowlist.spec.ts
apps/api/scripts/provision-metadata-vertical.mjs
packages/workspaces/starter/test/metadata-vertical-smoke.spec.ts
```

### Edit (Architect YES only)

```text
packages/workspaces/denali/README.md                                       # N-009 maintenance notice
apps/api/src/workspace-metadata/load-workspace-plugin-for-tenant.ts        # N-007 allowlist wire
TEMP/wizard-denali-enterprise-assessment.md                                # N-011 rewrite
TEMP/ROADMAP-INDEX.md                                                      # N-011 P3 complete
```

### Forbidden (without Architect YES)

```text
packages/workspaces/denali/src/** fieldRegistry edits for parity
Global prod WORKSPACE_METADATA_ENABLED=true in first P3-D PR
UPDATE workspace_definition_versions.payload in production publish path
```

---

## Parent task map

| Parent | عنوان | Nano |
|--------|--------|------|
| P3-D-T-001 | Export ↔ seed parity | N-001 · N-002 |
| P3-D-T-002 | Render plan parity | N-003 · N-004 |
| P3-D-T-003 | New vertical smoke | N-005 · N-006 |
| P3-D-T-004 | Per-tenant cutover + allowlist | N-007 · N-008 |
| P3-D-T-005 | Denali maintenance | N-009 · N-010 |
| P3-D-T-006 | Assessment + phase exit | N-011 · N-012 |

---

## NANO TASKS — DETAIL

### P3-D-N-001 [IMPLEMENT] `P3-D-T-001` — parity harness helpers

- **Deps:** P3-C-N-014 ✅
- **Doc:** mdoc § Parity strategy + Export drift gate

**DO THIS:**

1. Create `apps/api/test/workspace-metadata-denali-parity.spec.ts` scaffold with shared helpers:
   - `loadDenaliSeedExport()` — read `scripts/seed/definitions/denali-v1.json` via `parseWorkspaceDefinitionExportFile`
   - `buildLiveDenaliExport()` — `buildWorkspaceDefinitionExport` from `resolveWorkspacePluginForType("denali")`
   - `stripDataSurfaces(plugin)` — fieldRegistry, ruleSet, wizard only
2. No assertions yet — helpers exported for N-002

**DO NOT:** Edit denali package · flip prod flag

**VERIFY:**
```bash
pnpm run guard:import-boundary
git diff --quiet packages/workspaces/denali
```

**NEXT:** P3-D-N-002

---

### P3-D-N-002 [TEST] `P3-D-T-001` — denali parity + golden tour

- **Deps:** P3-D-N-001

**DO THIS:** Complete `workspace-metadata-denali-parity.spec.ts`

| ID | Assert |
|----|--------|
| DP-01 | Live export checksum === `denali-v1.json` checksum |
| DP-02 | `fieldRegistry.fields` ids deepEqual package strip vs seed payload |
| DP-03 | `ruleSet.rules` JSON stableEqual package vs seed |
| DP-04 | `wizard.roots` + `railId` + `wizardMode` equal package vs seed |
| DP-05 | Golden `tour-publish-ready.json` — metadata plugin validates same ok/violation fieldIds as package |
| DP-06 | `adaptMetadataPayloadToWorkspacePlugin` preserves overlay.validation reference |
| DP-07 | `wizard.inactiveFieldGroups` equal package strip vs seed payload |

**DO NOT:** `assert.ok(true)` · edit denali/**

**NEXT:** P3-D-N-003

---

### P3-D-N-003 [IMPLEMENT] `P3-D-T-002` — render plan parity harness

- **Deps:** P3-D-N-002

**DO THIS:**

1. Create `apps/api/test/workspace-metadata-render-plan-parity.spec.ts` scaffold
2. Helper `buildParityRenderPlans()`:
   - Package plugin from `resolveWorkspacePluginForType("denali")`
   - Metadata plugin from seed payload + same overlay
   - Synthetic canonical shell covering all roots
   - `PlatformWizardEngine.create(...).buildRenderPlan` both paths

**NEXT:** P3-D-N-004

---

### P3-D-N-004 [TEST] `P3-D-T-002` — render plan spec

| ID | Assert |
|----|--------|
| RP-01 | Same total visible field count per step |
| RP-02 | Same ordered `fieldId` list per step |
| RP-03 | Same `uiHints.compositeId` for each composite field |
| RP-04 | Denali seed retains `denali.*` composite ids (not rewritten to platform.*) |

**NEXT:** P3-D-N-005

---

### P3-D-N-005 [IMPLEMENT] `P3-D-T-003` — metadata vertical provision script

- **Deps:** P3-D-N-004

**DO THIS:**

1. `apps/api/scripts/provision-metadata-vertical.mjs`:
   - Requires `DATABASE_URL`
   - Creates or reuses smoke tenant `workspaceType: "starter"`
   - Assigns climbing-club or starter-shell definition (from seed or builder output)
   - Prints tenant id + binding for manual smoke
2. Document usage in mdoc § New metadata vertical

**DO NOT:** Require Denali package changes

**NEXT:** P3-D-N-006

---

### P3-D-N-006 [TEST] `P3-D-T-003` — vertical smoke spec

- **Deps:** P3-D-N-005

**DO THIS:** `packages/workspaces/starter/test/metadata-vertical-smoke.spec.ts`

| ID | Assert |
|----|--------|
| MV-01 | Starter export/build produces valid `WorkspaceDefinitionPayload` |
| MV-02 | Metadata adapter + starter overlay passes `assertWorkspacePlugin` |
| MV-03 | At least one `platform.*` field id in vertical fixture (or skip if P3-B not merged — document skip) |
| MV-04 | `buildRenderPlan` returns ≥1 step for vertical fixture |

**NEXT:** P3-D-N-007

---

### P3-D-N-007 [IMPLEMENT] `P3-D-T-004` — tenant allowlist + runbook

- **Deps:** P3-D-N-006

**DO THIS:**

1. Create `is-workspace-metadata-enabled-for-tenant.ts` (see mdoc)
2. Extend `ResolveWorkspacePluginForTenantInput` with optional `tenantId`
3. Wire into `resolveWorkspacePluginForTenant` — check tenantId when binding set
4. Pass `tenantId` from `resolveWorkspacePluginForTenantById`
3. Ensure mdoc runbook § Per-tenant cutover matches implementation

**DO NOT:** Enable prod flag in this PR

**NEXT:** P3-D-N-008

---

### P3-D-N-008 [TEST] `P3-D-T-004` — cutover allowlist spec

- **Deps:** P3-D-N-007

**DO THIS:** `workspace-metadata-cutover-allowlist.spec.ts`

| ID | Assert |
|----|--------|
| CO-01 | Flag off → package path even with binding |
| CO-02 | Flag on + empty allowlist → metadata path when binding set |
| CO-03 | Flag on + allowlist excluding tenant → package path |
| CO-04 | `toTenantWorkspaceMetadataBinding(null)` → null (rollback shape) |
| CO-05 | Missing definition row throws `WORKSPACE_DEFINITION_NOT_FOUND` |

Comment block: rollback steps 1–3 from mdoc runbook.

**NEXT:** P3-D-N-009

---

### P3-D-N-009 [IMPLEMENT] `P3-D-T-005` — Denali maintenance notice

- **Deps:** P3-D-N-008
- **Requires:** Architect YES

**DO THIS:**

1. Update `packages/workspaces/denali/README.md`:
   - Maintenance mode banner
   - Field layout changes via export → publish → assign
   - Package scope: hooks, composites, finance, theme
2. Link to `platform-workspace-cutover.mdoc`

**DO NOT:** New Denali features · fieldRegistry edits

**NEXT:** P3-D-N-010

---

### P3-D-N-010 [TEST] `P3-D-T-005` — maintenance gate

| ID | Assert |
|----|--------|
| DM-01 | README contains "maintenance" (case-insensitive) |
| DM-02 | README references metadata / export / workspace definition |

**NEXT:** P3-D-N-011

---

### P3-D-N-011 [IMPLEMENT] `P3-D-T-006` — assessment + roadmap

- **Deps:** P3-D-N-010

**DO THIS:**

1. Rewrite `TEMP/wizard-denali-enterprise-assessment.md`:
   - Metadata platform complete
   - Denali maintenance mode
   - Score ≥ 9/10 with per-dimension rubric (mdoc § Assessment rubric)
2. Update `TEMP/ROADMAP-INDEX.md` — mark P3 complete (optional EPIC done)

**NEXT:** P3-D-N-012

---

### P3-D-N-012 [TEST] `P3-D-T-006` — phase exit gate

- **Deps:** P3-D-N-011

Run full EPIC verify:

```bash
pnpm run guard:import-boundary
git diff --quiet packages/workspaces/denali   # unless N-009 merged with YES

pnpm --filter @apps/api exec node --test \
  test/workspace-metadata-denali-parity.spec.ts \
  test/workspace-metadata-render-plan-parity.spec.ts \
  test/workspace-metadata-cutover-allowlist.spec.ts

pnpm --filter @apps/web exec node --import tsx --test \
  ../../packages/workspaces/starter/test/metadata-vertical-smoke.spec.ts
```

| ID | Assert |
|----|--------|
| EX-01 | All P3-D specs exit 0 |
| EX-02 | Assessment documents score ≥ 9/10 with per-dimension rubric |
| EX-03 | `git diff --quiet packages/workspaces/denali` (except N-009 README) |

**EPIC exit:**

- [ ] All 12 nanos done
- [ ] mdoc synced
- [ ] FILE-MAP P3-D doc ✅
- [ ] Phase P3 complete in ROADMAP-INDEX

**NEXT:** — (P3 complete)

---

## §STOP table

| Symptom | Action |
|---------|--------|
| Prod flag flip in parity PR | **STOP** |
| denali fieldRegistry edit for parity | **STOP** — re-export JSON |
| Skip DP-05 golden metadata path | **STOP** |
| Live cutover before N-011 ingress | **STOP** |
| UPDATE version payload in prod publish | **STOP** |

---

## §AI navigation

| Need | File |
|------|------|
| Architecture SoT | `docs/phase-16/platform-workspace-cutover.mdoc` |
| Loader + adapter | `docs/phase-16/platform-workspace-definitions.mdoc` |
| Builder assign | `docs/phase-16/platform-workspace-builder.mdoc` |
| Strangler research | `docs/research/phase-6-denali-workspace-research.md` |
| Cutover gates G1–G8 | mdoc § Cutover acceptance gates |
| Observability pilot | mdoc § Observability during pilot |
| Denali safety | `TEMP/p3/p3-denali-safety.md` |
