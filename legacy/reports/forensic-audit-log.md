# Forensic Audit Log

**Generated:** 2026-05-31  
**Scope:** Workspace tour wizard template pipeline — GET settings template, POST instantiate, resolver, orchestrator, mutation chaos suite, silent-failure interception.  
**Repository:** `/home/hamed/Music/docs`

---

## Audit 1: Forensic Logic Drift

### Trace summary

| Step | GET `GET /api/v2/settings/tour-wizard-template` | POST `POST /api/v2/settings/tour-wizard-template/instantiate` |
|------|--------------------------------------------------|----------------------------------------------------------------|
| Controller | `SettingsTourWizardTemplateController.getTemplate()` → `findForWorkspace()` | `SettingsTourWizardTemplateController.instantiateTemplate()` → `instantiateForWorkspace()` |
| RBAC | `@Roles(Owner, Admin, Member)` + `AbilityAction.Read` on Settings | `@Roles(Owner, Admin)` only + `AbilityAction.Update` on TourWizardTemplate |
| Row load | `findTourWizardTemplateByWorkspace(workspaceId)` | Same |
| Canonical gate | `toResponse()` → `resolveValidatedCanonicalDataOrThrow(row)` | `resolveValidatedCanonicalDataOrThrow(row)` |
| Resolver | `resolveStoredTemplateCanonical()` in `@repo/types/denali` | Identical |
| Post-canonical | Return JSON envelope `{ template: { canonicalData, fieldRulesOverlay, stepOverrides, baseProfile, … } }` | `TemplateOrchestratorService.createDraftFromTemplate({ canonicalData, fieldRulesOverlay })` → hydrate → normalize → prune → projection |
| Failure (corrupt canonical) | `422` `DataCorruptionError` / `TEMPLATE_CANONICAL_DATA_CORRUPT` | Same at resolver gate; orchestrator defense-in-depth also maps validation failures to `422` |
| Failure (empty hydration) | N/A (no orchestrator on GET) | `400` `TEMPLATE_INSTANTIATE_SILENT_FAILURE` after `logger.error` |

**Canonical resolver parity:** Both paths call the same private method `resolveValidatedCanonicalDataOrThrow()` (`tour-wizard-template-settings.service.ts:121–157` and `:254`). No divergence on `canonicalData` field paths at the API layer.

### Field-path drift table (GET vs POST instantiate)

| FieldPath | GET_Behavior | POST_Behavior | Risk_Level |
|-----------|--------------|---------------|------------|
| `canonicalData.*` (all Layer A paths) | Validated via `resolveStoredTemplateCanonical`; returned in response body | **Identical** validated slice passed to orchestrator | **LOW** |
| `canonicalData.<top-level fossil>` e.g. `tripDetails`, `basicInfo`, `eventVariant` | `422` `TEMPLATE_CANONICAL_DATA_CORRUPT` (fossil rejection, no silent strip) | **Identical** `422` before orchestrator | **LOW** |
| `canonicalData.<nested strict violation>` e.g. `overview.denaliTourKind` | `422` with `details.issues[]` | **Identical** `422` | **LOW** |
| `fieldRulesOverlay` | Raw object from DB via `resolveFieldRulesOverlay()` (no path validation on read) | Passed to orchestrator → `parseFieldRulesOverlay()` **silently drops** invalid/ghost overlay keys | **MEDIUM** |
| `fieldRulesOverlay.<invalidPath>` | Returned verbatim in GET JSON | Silently ignored during rule-set resolution; visibility/required rules may differ from stored JSON | **MEDIUM** |
| `stepOverrides.skip` / `.insert` | Filtered to string arrays in GET response | **Not consumed** by instantiate orchestrator | **LOW** |
| `baseProfile` | Normalized and returned in GET response | Not sent to orchestrator (orchestrator uses overlay ruleSet, not baseProfile) | **LOW** |
| `presetId`, `wizardContractVersion`, `formProfileVersion` | Returned in GET metadata | Not used in instantiate | **LOW** |
| RBAC / endpoint access | Member can GET template | Member **403** on instantiate | **MEDIUM** |
| Orchestrator output (`draftState`, `payload`) | Not produced on GET | POST-only; staging projection + Postgres-compatible draft snapshot | **LOW** (by design) |

### Related consumer drift (outside GET response body)

These are **not** GET-vs-POST API divergences but affect operator perception of “Preview vs live instantiate”:

| FieldPath | GET API | Settings Preview (`packCanonicalFormValuesToTemplateData`) | POST instantiate (DB row) | Risk_Level |
|-----------|---------|--------------------------------------------------------------|---------------------------|------------|
| `duration` | Returned if present in DB | **Omitted** — not in builder seed paths (`listDenaliSettingsOverlayStoragePaths.ts`) | Hydrated from DB | **HIGH** |
| `meetingPoint` | Returned if in DB | **Omitted** from builder pack/unpack cycle | Hydrated from DB | **MEDIUM** |
| `gatheringPoint` | Returned if in DB | **Omitted** (builder uses `gatheringPoints` only) | Hydrated from DB | **MEDIUM** |
| `eventVariant` | N/A at Layer A root (not in schema) | Packed at root by builder UI | Rejected as top-level fossil → `422` | **HIGH** |
| `pricing.paymentMode`, `transport.transportNotes`, `transport.seatPreference` | Returned if in DB | Ghost paths excluded from builder | Hydrated from DB if present | **MEDIUM** |

**CRITICAL_VULNERABILITY (consumer):** `apps/web/lib/validation/tour-wizard-template-semantic-drift.spec.ts` — `packCanonicalFormValuesToTemplateData` round-trip **silently drops `duration`** while POST instantiate uses full DB canonical. Failing tests document false-green Preview vs POST parity.

**CRITICAL_VULNERABILITY (consumer):** `apps/web/app/(app)/settings/tour-wizard-template/tour-wizard-template-preview-panel.tsx:82–90` — orchestrator `success: false` resets preview to empty defaults with **no error surface** (silent UI fail).

### Audit 1 verdict

**Not AIRTIGHT** — canonical API paths are aligned; **medium/high drift remains** on `fieldRulesOverlay` silent filter, RBAC split, and Settings Preview/packer vs DB-backed POST instantiate.

---

## Audit 2: Mutation-Resistant Stress Test

### Test artifact

- **File:** `packages/denali-domain/src/catalog/chaos-template.spec.ts`
- **Target:** `resolveStoredTemplateCanonical()` (`packages/types/src/denali/resolveStoredTemplateCanonical.ts`)
- **Orchestrator cross-check:** `denaliTemplateOrchestratorFactory.createDraftFromTemplate()` escape-path probe

### Mutation matrix (36 traps)

| Category | Count | Mutation IDs |
|----------|-------|--------------|
| Top-level fossil | 4 | `root.tripDetails`, `root.basicInfo`, `root.eventVariant`, `root.defaults` |
| Nested fossil | 12 | `overview.nestedGhost`, `program.nestedGhost`, `program.itinerary.nestedGhost`, `transport.nestedGhost`, `pricing.nestedGhost`, `participants.nestedGhost`, `policies.nestedGhost`, `metrics.nestedGhost`, `gatheringPoints.nestedGhost`, `startPoint.nestedGhost`, `photos.nestedGhost`, `deep.tree.nestedGhostEverywhere` |
| Invalid UUID | 5 | `destinationId.nonV4`, `leaderUserIds.nonV4`, `program.themeIds.nonV4`, `participants.gearItems.nonV4`, `photos.id.nonV4` |
| Schema type swap | 15 | `title.typeSwap.number`, `overview.typeSwap.string`, `program.typeSwap.string`, `transport.typeSwap.string`, `pricing.typeSwap.string`, `participants.typeSwap.string`, `policies.typeSwap.string`, `gatheringPoints.typeSwap.string`, `photos.typeSwap.string`, `capacityMax.typeSwap.string`, `requiresLocalGuide.typeSwap.string`, `program.itinerary.typeSwap.string`, `program.itinerary.activities.typeSwap.number`, `root.typeSwap.string`, `root.typeSwap.null` |

### Execution log

```
Command: cd packages/denali-domain && node --import tsx --test src/catalog/chaos-template.spec.ts
Date: 2026-05-31

Results:
  chaos: baseline canonical is accepted by resolveStoredTemplateCanonical     PASS
  chaos: zero mutation traps yield resolveStoredTemplateCanonical ok:true   PASS
  chaos: orchestrator cannot proceed when resolver rejects                  PASS
  chaos: report mutation-trap coverage counts                               PASS

  tests: 4/4 pass
```

### Trap statistics (current codebase)

| Metric | Value |
|--------|-------|
| Total mutation traps | **36** |
| Resolver `{ ok: true }` (false-green) | **0** |
| Resolver `{ ok: false }` | **36** (100%) |
| Orchestrator `success: true` after resolver reject (escape path) | **0** |
| Baseline valid canonical `{ ok: true }` | **1/1** (expected) |

### Historical false-greens (pre-hardening, now closed)

| Mutation | Pre-hardening behavior | Guard applied |
|----------|------------------------|---------------|
| Top-level fossils (`tripDetails`, etc.) | Strip → `{ ok: true }` | `collectDiscardedTemplateKeys` → `{ ok: false }` before Zod |
| `root.typeSwap.string` / `null` | Coerce to `{}` → `{ ok: true }` | Non-object root rejection |
| All nested/type/UUID mutations | Already `{ ok: false }` | Unchanged (Zod strict) |

**Current false-green count:** **0** — no `CRITICAL_VULNERABILITY` entries for mutation pass-through at resolver layer.

### Guards implemented

1. `packages/types/src/denali/resolveStoredTemplateCanonical.ts` — reject non-object root; reject top-level fossils (no silent strip); then `templateToCanonical` + `validateDenaliCanonicalTemplateData`.
2. `packages/denali-domain/src/rules/factory/DenaliTemplateOrchestratorFactory.ts` — uses same resolver; attaches `failureKind` + `validationIssues` on canonical failure.

### Audit 2 verdict

**AIRTIGHT — Mutation-Resistant Stress Test** (36/36 traps reject; 0 orchestrator escape paths on current run).

---

## Audit 3: Silent Failure Interception

### Scan scope

- `TourWizardTemplateSettingsService.instantiateForWorkspace()` and private helpers
- `DenaliTemplateOrchestratorFactory.createDraftFromTemplate()`
- `TemplateOrchestratorService` (Nest adapter — pass-through)
- `.catch()` blocks on the above paths

### Silent-fail candidates (historical → current status)

| File | Line(s) | Branch | Historical issue | Current status | Fix applied |
|------|---------|--------|------------------|----------------|-------------|
| `tour-wizard-template-settings.service.ts` | 205–218 (legacy) | `!result.success` | `logger.warn` only; `400 TEMPLATE_INSTANTIATE_FAILED`; validation misclassified as 400 | **CLOSED** | `throwInstantiateOrchestratorFailure()` — `logger.error` + `correlationId`; validation → `DataCorruptionError` (422); pipeline → `400 TEMPLATE_INSTANTIATE_SILENT_FAILURE` |
| `DenaliTemplateOrchestratorFactory.ts` | 75–84 | `!resolved.ok` | `failureOutput(strings)` with no `failureKind`; API treated as generic 400 | **CLOSED** | `failureKind: "canonical_validation"` + `validationIssues[]`; service maps to 422 |
| `DenaliTemplateOrchestratorFactory.ts` | 96–100 | `hydrated == null` | Silent `success: false` | **CLOSED** (domain) / **CLOSED** (API) | `failureKind: "hydration_empty"`; service `logger.error` + throw |
| `DenaliTemplateOrchestratorFactory.ts` | 127–129 | `catch (projection)` | Silent `failureOutput([message])` | **CLOSED** (domain) / **CLOSED** (API) | `failureKind: "projection"`; service `logger.error` + throw |
| `DenaliTemplateOrchestratorFactory.ts` | 34–48 | `failureOutput()` | Pure domain — no `LoggerService` (by design) | **ACCEPTED** | Logging delegated to API boundary; not a silent fail at HTTP layer |
| `tour-wizard-template-preview-panel.tsx` | 82–90 | `!result.success` | Resets form to defaults; no log, no user error | **OPEN — CRITICAL_VULNERABILITY (client)** | **Proposed:** surface orchestrator errors in UI; call BFF instantiate or mirror `DataCorruptionError` handling; never silent reset on failure |
| `tour-wizard-template-settings.service.ts` | 131–137 | `onDiscardedKey` warn | Warn hook unreachable for fossils (resolver fails first) | **LOW — dead path** | **Proposed:** remove callback or move warn to migration-only tooling |

### `.catch()` scan

| Location | Finding |
|----------|---------|
| `DenaliTemplateOrchestratorFactory.ts:127–129` | Only `catch` on instantiate path; returns structured `failureOutput` (not `{}`/`undefined`); **intercepted at service** |
| `packages/denali-domain/**` | **No** `.catch()` blocks elsewhere on template orchestration path |
| `apps/api/.../tour-wizard-template-settings.service.ts` | **No** `.catch()` blocks |

### HTTP status matrix (post-fix)

| Failure class | HTTP | Code | Logger |
|---------------|------|------|--------|
| Canonical / validation (`resolveStoredTemplateCanonical` fail) | **422** | `TEMPLATE_CANONICAL_DATA_CORRUPT` | `logger.error` + `correlationId` + `issues[]` |
| Orchestrator `canonical_validation` (defense-in-depth) | **422** | `TEMPLATE_CANONICAL_DATA_CORRUPT` | `logger.error` + `correlationId` |
| Hydration empty / projection runtime | **400** | `TEMPLATE_INSTANTIATE_SILENT_FAILURE` | `logger.error` + `correlationId` + `failureKind` |

**Final check:** No path remains where **invalid canonical template data** returns `400` instead of `422`. Empty-but-schema-valid `{}` correctly returns `400` (hydration failure, not corruption).

### Global exception filter registration

- `TEMPLATE_CANONICAL_DATA_CORRUPT` — registered (`global-exception.filter.ts:76`)
- `TEMPLATE_INSTANTIATE_SILENT_FAILURE` — registered (`global-exception.filter.ts:77`)

### Audit 3 verdict

**Not AIRTIGHT — Silent Failure Interception** — API instantiate path is closed; **client Preview panel remains an open silent-fail surface** (`tour-wizard-template-preview-panel.tsx:82–90`).

---

## Summary

| Audit | Verdict |
|-------|---------|
| Audit 1: Forensic Logic Drift | **Not AIRTIGHT** — overlay/RBAC/Preview-packer drift documented |
| Audit 2: Mutation-Resistant Stress Test | **AIRTIGHT — Mutation-Resistant Stress Test** |
| Audit 3: Silent Failure Interception | **Not AIRTIGHT** — client Preview silent reset remains |

### Open CRITICAL_VULNERABILITY items

1. **Consumer:** `apps/web/lib/validation/tour-wizard-template-builder-form.ts` / `packCanonicalFormValuesToTemplateData` — silent drop of `duration` and other Layer A paths (see semantic drift spec).
2. **Consumer:** `apps/web/app/(app)/settings/tour-wizard-template/tour-wizard-template-preview-panel.tsx:82–90` — orchestrator failure → empty form, no error.

---

*End of forensic audit log.*
