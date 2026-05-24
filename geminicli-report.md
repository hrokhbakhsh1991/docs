# Gemini CLI — Project findings

## File / image upload & MinIO storage (2026-05-24)

### Summary

There is **no** `minio.service.ts`. Object storage is implemented behind a small port/adapter layer in the API:

| Layer | Path |
|--------|------|
| Port (interface) | `apps/api/src/infra/storage/file-storage.port.ts` |
| **MinIO adapter** | `apps/api/src/infra/storage/minio-storage.adapter.ts` |
| Nest module | `apps/api/src/infra/storage/storage.module.ts` |
| Health | `apps/api/src/infra/storage/storage-health.service.ts` |
| Test double | `apps/api/test/helpers/in-memory-file-storage.adapter.ts` |

Config: `ConfigService.getMinioConfig()` (`apps/api/src/config/config.service.ts`) from env vars `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_USE_SSL`, `MINIO_BUCKET` (default bucket name: `receipts`). Docker: `infra/docker-compose.yml` (MinIO API on host port **9002** by default).

**Upload model:** server-side only (`putObject`). There is **no** presigned PUT / client-direct-to-MinIO upload in this codebase. **Fetch model:** presigned GET URLs via `presignedGetObject`.

---

### `FileStoragePort` methods (all implementations)

Defined in `file-storage.port.ts`:

| Method | Purpose |
|--------|---------|
| `upload(params)` | Upload buffer to storage; returns `{ key }` |
| `getSignedUrl(key, expiresInSeconds)` | Presigned **GET** URL for download/preview |
| `deleteObject(key)` | Best-effort delete (e.g. rollback after DB failure) |

`FileUploadParams`: `{ workspaceId, relativePath, body, contentType }`.  
Object key format in MinIO: `{workspaceId}/{relativePath}`.

---

### `MinioStorageAdapter` (MinIO SDK)

File: `apps/api/src/infra/storage/minio-storage.adapter.ts`

| Method | MinIO SDK / behavior |
|--------|----------------------|
| `onModuleInit()` | `bucketExists` → `makeBucket` if missing (skipped throw in `NODE_ENV=test`) |
| `upload()` | `client.putObject(bucket, key, body, length, { "Content-Type": contentType })` |
| `getSignedUrl()` | `client.presignedGetObject(bucket, key, expiresInSeconds)` |
| `deleteObject()` | `client.removeObject(bucket, key)` (errors swallowed) |
| `ping()` | `bucketExists` for health checks |

**Not implemented:** `presignedPutObject`, `statObject`, `listObjects`, multipart upload helpers.

---

### Production call sites (who uses storage)

#### 1. Finance — payment receipt uploads

| Piece | Location |
|-------|----------|
| API upload | `ReceiptService.submitReceipt()` → `storage.upload()` |
| Key path | `receipts/{paymentId}/{uuid}.{ext}` |
| API fetch URL | `ReceiptService.getReceiptSignedUrl()` → `storage.getSignedUrl(fileKey, **3600**)` (1 hour) |
| HTTP | `POST /api/v2/finance/payments/:id/receipt` (`FinancePaymentsController`, multipart field `file`) |
| HTTP | `GET /api/v2/admin/finance/receipts/:id/url` → `{ url }` |
| Web BFF | `apps/web/app/api/finance/payments/[paymentId]/receipt/route.ts` → proxies multipart to API |
| Web client | `apps/web/lib/services/payments.service.ts` — `submitReceipt()`, `getReceiptPreviewUrl()` |
| UI | `payment-receipt-upload-panel.tsx`, `admin-receipt-review-panel.tsx` |

On upload failure after MinIO write, `deleteObject(objectKey)` is called for cleanup.

#### 2. Tours — gallery photo uploads

| Piece | Location |
|-------|----------|
| API upload | `ToursService.uploadPhotos()` → `fileStorage.upload()` then `getSignedUrl(key, **604800**)` (7 days) |
| Key path | `tours/{tourId}/photos/{uuid}-{originalname}` |
| HTTP | `POST /api/v2/tours/:tourId/photos` (`ToursController`, `FilesInterceptor("photos", 10)`, max 5MB, `image/jpeg|png|webp`) |
| HTTP | `DELETE /api/v2/tours/:tourId/photos/:photoId` — **stub** (`deletePhoto` returns `{ success: true }` without storage delete yet) |
| Web wizard | Denali `FileUploadField` / `DenaliPhotosStep` currently use **client `blob:` URLs**; **not** wired to `POST .../tours/:id/photos` yet |

Returned DTO per photo: `{ id, url, filename, size, mimeType, uploadedAt }` where `url` is the presigned GET URL.

---

### Tests & health

- E2E/unit tests override `MinioStorageAdapter` with `InMemoryFileStorageAdapter` (`memory://receipts/{key}` fake URLs).
- `StorageHealthService.check()` pings MinIO via `MinioStorageAdapter.ping()` (skipped in test env).
- Runbook: `docs/60-operations/denali-finance-runbook.md` (MinIO + receipt flow).

---

### Related web upload patterns (non-MinIO)

| Area | Notes |
|------|--------|
| Denali wizard photos | `apps/web/src/features/tours/wizard/denali/components/FileUploadField.tsx` — local validation (Zod), `blob:` preview, draft persistence via `serializeDenaliWizardDraft` (HTTPS URLs kept; `blob:` stripped for server draft via `stripBlobUrlsFromDenaliDraftPatch`) |
| Itinerary day photos | `DenaliItineraryDayPhotos.tsx` — same client-side pattern |
| BFF multipart helper | `apps/web/lib/api/bff-proxy.ts` — `proxyBffPostMultipart` for receipt uploads |

---

### Gaps / integration notes for wizard file fields

1. **Tour photos API exists** (`ToursService.uploadPhotos`) but the Denali wizard does not call it yet.
2. **No presigned upload URLs** — wizard integration should either POST multipart to the tour photos endpoint or add a new presigned-PUT flow (not present today).
3. **Single bucket** (`MINIO_BUCKET`, default `receipts`) used for both receipts and tour photos (keys namespaced by `workspaceId/...`).

---

## Denali step visibility audit — `DenaliBasicInfoStep` & `DenaliLogisticsStep` (2026-05-24)

Audited: `apps/web/src/features/tours/wizard/denali/steps/DenaliBasicInfoStep.tsx`, `apps/web/src/features/tours/wizard/denali/steps/DenaliLogisticsStep.tsx`.

### `useState` / `useEffect` for visibility or requiredness

| File | `useState` | `useEffect` | Notes |
|------|------------|-------------|--------|
| `DenaliBasicInfoStep.tsx` | **None** | **None** | Visibility comes from `useDenaliStepFieldRules(STEP).isVisible` + `isDurationAllowed` |
| `DenaliLogisticsStep.tsx` | **None** | **None** | Same; `showGear` is a derived const, not React state |

No local state variables control field show/hide or required flags in either step file.

---

### `DenaliBasicInfoStep.tsx`

**Rule-engine wiring:** `useDenaliStepFieldRules("denali_basic")` → `isDenaliFieldVisibleOnStep` / `isDenaliFieldRequiredOnStep` (via hook). `isRequired` is available from the hook but **not used** in this file (requiredness is enforced at validation/submit, not in labels).

#### Conditional rendering (visibility) — rule-driven

| Lines | Condition | Canonical path | Mechanism |
|-------|-----------|----------------|-----------|
| 116–132 | `isVisible("eventVariant", form) ? … : null` | `eventVariant` | Rule model (event category only) + `denaliUIAdapter` |
| 170–183 | `isVisible("requiresLocalGuide", form) ? … : null` | `requiresLocalGuide` | Rule model |
| 185–203 | `isVisible("localGuideName", form) ? … : null` | `localGuideName` | Rule model + contextual rule (`requiresLocalGuide === true` in `denaliUIAdapter`) |
| 207–209 | `isVisible("endDateTime", form) ? … : null` | `endDateTime` | Rule model (multi-day) |

#### Related UI logic — **not** field visibility, but conditional in JSX

| Lines | Condition | Purpose |
|-------|-----------|---------|
| 104–111 | `category != null && !isDurationAllowed(duration)` | Disables invalid duration `<option>`s (classification matrix), not hide/show of a field |
| 46–50 | `if (role === "owner" \| "admin" \| "leader")` | i18n label for crew roles only |
| 140 | `typeof id === "string" ? id : ""` | Normalizes combobox value shape |
| 164 | `Array.isArray(ids) ? ids : ids ? [ids] : []` | Normalizes multi-select leaders |
| 175–178 | `checked ? … localGuideName : undefined` | Clears dependent value when checkbox unchecked (value sync, not visibility) |
| 194–198 | `requiresLocalGuide: true` on local guide name change | Keeps canonical flag set while editing name |

#### Always rendered (no `isVisible` gate in this file)

These blocks are always mounted on the basics step (visibility may still be governed inside child components or at rule-model level elsewhere):

- `title`, `category`, `duration`, `destination` + QuickAdd, `leaderUserIds`
- `DenaliDatetimeField` `startDateTime` (always)
- `capacityMax`, `capacityMin`
- `DenaliApproximateReturnTimeField`
- `socialMediaLink`, `requiresManualAdminApproval`

`DenaliDatetimeField` / `DenaliApproximateReturnTimeField` do not call `isVisible` internally; end date is gated in the step; start date is not.

#### Hardcoded visibility / required `if/else` or `&&` for fields?

**None** for show/hide or required labels. Prior patterns like `category === "event"` or `requiresLocalGuide === true` for JSX visibility have been replaced by `isVisible(...)`.

---

### `DenaliLogisticsStep.tsx`

**Rule-engine wiring:** `useDenaliStepFieldRules("denali_logistics")` → `isVisible(...)`.

#### Conditional rendering (visibility) — rule-driven

| Lines | Condition | Canonical path | Mechanism |
|-------|-----------|----------------|-----------|
| 35 | `showGear = isVisible("participants.gearItems", form)` | `participants.gearItems` | Rule model (step `denali_logistics`) |
| 50–69 | `showGear ? (gear block) : null` | `participants.gearItems` | Same |
| 94–114 | `isVisible("transport.transportCost", form) ? … : null` | `transport.transportCost` | Rule model + `isDenaliTransportCostVisible(mode)` in adapter |
| 116–132 | `isVisible("transport.allowPersonalCar", form) ? … : null` | `transport.allowPersonalCar` | Rule model + `isDenaliAllowPersonalCarVisible(mode)` |
| 134–151 | `isVisible("transport.dongAmount", form) ? … : null` | `transport.dongAmount` | Rule model + dong visibility helper |

#### Related UI logic — **not** field visibility

| Lines | Condition | Purpose |
|-------|-----------|---------|
| 77–81 | `patchDenaliTransportForMode(...)` on mode change | Clears incompatible transport fields via `@repo/types/denali` helpers (replaces inline `mode === "none"` ternaries) |
| 120–126 | `allowPersonalCar: checked ? true : undefined`, `dongAmount: checked ? …` | Canonical value normalization when toggling personal car |
| 103–108, 140–145 | `v === "" ? undefined : Number(v)` | Empty number input handling |

#### Always rendered (no `isVisible` gate in this file)

- Gathering points widget + hint
- `DenaliLocationZonesSection`
- Transport mode `<Select>` (always)
- Transport notes `<Textarea>` (always)

#### Hardcoded visibility / required `if/else` or `&&` for fields?

**None** for show/hide. Transport conditionals were moved to `patchDenaliTransportForMode` and `denaliUIAdapter` contextual visibility.

---

### Summary table

| Step | Rule-driven visibility gates | Hardcoded field visibility `if/else` | `useState` for visibility |
|------|------------------------------|--------------------------------------|---------------------------|
| `DenaliBasicInfoStep` | 4 (`eventVariant`, `requiresLocalGuide`, `localGuideName`, `endDateTime`) | **0** | **0** |
| `DenaliLogisticsStep` | 4 (`participants.gearItems`, 3× transport fields) | **0** | **0** |

### Child components (out of scope for line-level audit, but relevant)

Visibility for fields inside these widgets is **not** in the step files:

- `DenaliGatheringPointsWidget`, `DenaliLocationZonesSection` — always shown from logistics step
- `DenaliGearSection` — parent gates mount; section has no extra `isVisible`
- `DenaliDatetimeField`, `DenaliApproximateReturnTimeField` — start/end handled at step level for end date only

For full wizard coverage, also see `DenaliProgramNatureStep`, `DenaliPricingPaymentStep`, `DenaliPhotosStep`, and `DenaliReviewStep` (each uses `useDenaliStepFieldRules` or review-step equivalents).

---

## QuickAddModal ↔ CanonicalContext & react-hook-form (2026-05-24)

Analyzed: `apps/web/src/components/shared/QuickAddModal.tsx`, `quick-add/types.ts`, `quick-add/persistWizardSnapshot.ts`, Denali hooks, `DenaliCreateTourWizard.tsx`, `DenaliCanonicalContext.tsx`.

### Architecture (layering)

```
QuickAddModalProvider (wizardPersistence optional)
  └── FormProvider (RHF)
        └── DenaliCanonicalProvider (canonical state + updateCanonical)
              └── Wizard steps / hooks
```

- **`QuickAddModal` / `QuickAddModalProvider`** — UI shell only (Radix Dialog). **No** import of `DenaliCanonicalContext`, `useFormContext`, or `setValue`.
- **Bridge pattern** — Caller passes `onSuccess(entity)` into `quickAdd.open({ ... })`. Types document intent: *"update react-hook-form and CanonicalContext here"* (`quick-add/types.ts`).

### Call chain on successful create

1. Inner form (e.g. `DestinationQuickAddForm`) calls API → `onSuccess(created)` (form prop from provider).
2. Provider `handleFormSuccess` → `prev.config.onSuccess(entity)` (the callback from `open()`), then closes modal and `clearWizardQuickAddGuard()`.
3. Denali-specific logic lives entirely in **caller-supplied** `onSuccess` (hooks or inline), not inside the modal.

```206:214:apps/web/src/components/shared/QuickAddModal.tsx
  const handleFormSuccess = useCallback((entity: unknown) => {
    setState((prev) => {
      prev?.config.onSuccess(entity);
      return null;
    });
    setApiError(null);
    setIsSubmitting(false);
    clearWizardQuickAddGuard();
  }, []);
```

### Does `onSuccess` have direct access to `setValue`?

| Question | Answer |
|----------|--------|
| Is `setValue` passed **into** `onSuccess` as an argument? | **No** — signature is `onSuccess: (entity: TEntity) => void` only. |
| Can `onSuccess` call `setValue`? | **Yes**, via **closure** when defined in a component/hook under `FormProvider` that called `useFormContext()`. |

**Denali destination** (`useDenaliDestinationQuickAdd.ts`):

- Closes over `setValue` from `useFormContext<DenaliCreateTourWizardForm>()`.
- Closes over `updateCanonical` from `useDenaliCanonical()`.
- On success: **both** are invoked explicitly.

```33:38:apps/web/src/features/tours/wizard/denali/hooks/useDenaliDestinationQuickAdd.ts
      onSuccess: (destination) => {
        updateCanonical({ destinationId: destination.id });
        setValue("basicInfo.destinationId", destination.id, {
          shouldDirty: true,
          shouldValidate: true,
        });
```

**Denali equipment** (`useDenaliEquipmentQuickAdd.ts`):

- Closes over `getValues`, `setValue`, `updateCanonical`.
- Uses helper `commitGearItems` that calls `setValue("participantRequirements.gearItems", …)` then `updateCanonical({ participants: { … gearItems } })`.
- `onSuccess` only calls `commitGearItems(upsertGearItem(...))`.

### Manual sync with `CanonicalContext`?

**Yes — manual, explicit, in caller `onSuccess` (not automatic from the modal).**

| Path | What happens |
|------|----------------|
| `updateCanonical(patch)` | Merges patch into `canonicalModel` → `commitCanonical` → `applyCanonicalMvpToForm` → **writes full MVP slices to RHF via `setValue`** (`denaliCanonicalFormAdapter.ts`) → updates `canonicalModel` state. |
| Direct `setValue(...)` in hooks | Additional **targeted** RHF writes (destination id, or gear list). |

`DenaliCanonicalProvider.commitCanonical` (invoked by `updateCanonical`):

```105:114:apps/web/src/features/tours/wizard/denali/DenaliCanonicalContext.tsx
  const commitCanonical = useCallback(
    (next: DenaliCanonicalTourModel, basics: DenaliCanonicalBasicsSelection) => {
      const currentForm = getValues();
      const nextFormRaw = denaliCanonicalToForm(next, currentForm, { basics });
      const safeForm = applyDenaliInvariantState(nextFormRaw);

      applyCanonicalMvpToForm(next, currentForm, { basics, setValue });

      setCanonicalModel(denaliFormToCanonical(safeForm));
    },
```

So for **destination QuickAdd**, calling `updateCanonical({ destinationId })` already syncs RHF `basicInfo` (including `destinationId`) through `applyCanonicalMvpToForm`. The extra `setValue("basicInfo.destinationId", …)` is a **redundant but explicit** field-level write (documented in types as intentional “bridge”).

For **equipment**, `commitGearItems` updates RHF first, then canonical `participants.gearItems` — order is RHF → canonical; `updateCanonical` would again push participants (including gear) back to RHF via `applyCanonicalMvpToForm`.

**CanonicalContext does not subscribe to QuickAdd events** — it only reacts when `updateCanonical` / `updateCanonicalBasics` / `commitCanonical` run.

### Wizard draft persistence interaction

When `persistWizardState: true` and `wizardPersistence` is configured (`DenaliCreateTourWizard`):

```194:205:apps/web/src/components/tours/wizard/DenaliCreateTourWizard.tsx
  const quickAddWizardPersistence = useMemo(
    () => ({
      storageKey: draftStorageKey,
      getFormValues: () => getValues() as Record<string, unknown>,
      serializeDraft: (values) =>
        serializeDenaliWizardDraft(values as Partial<DenaliCreateTourWizardForm>, draftWizardMetaRef.current),
    }),
    [draftStorageKey, getValues],
  );
```

On **modal open** (`QuickAddModalProvider.open`):

- Serializes **current** form via `getFormValues()` → `sessionStorage` guard + `localStorage` (`persistWizardSnapshotForQuickAdd`).

On **modal close** (cancel / success):

- `restoreWizardDraftFromQuickAddGuard()` runs on close (restores pre-open snapshot to `localStorage` if guard still present).
- On **success**, `clearWizardQuickAddGuard()` runs — guard removed; in-memory form already updated by `onSuccess`, but **localStorage is not re-written inside QuickAdd** with the new entity.

Ongoing persistence after success relies on **separate** mechanisms (e.g. debounced `useTourWizardServerSync` PATCH to server). Denali wizard does **not** continuously write `localStorage` on every field change—only this QuickAdd snapshot on open.

### Other QuickAdd usages

| Consumer | Canonical / RHF sync |
|----------|----------------------|
| `useDenaliDestinationQuickAdd` | `updateCanonical` + `setValue` + query invalidation |
| `useDenaliEquipmentQuickAdd` | `commitGearItems` (`setValue` + `updateCanonical`) + query invalidation |
| `FileUploadField` (optional metadata) | `onSuccess` merges metadata into local row via `onChange` only — **no** `updateCanonical` unless parent wires it |

### Summary

| Topic | Finding |
|-------|---------|
| QuickAddModal ↔ CanonicalContext | **Indirect only** — via caller `onSuccess` |
| `onSuccess` receives `setValue`? | **Not as a parameter**; **yes via closure** in Denali hooks |
| Manual canonical sync after success? | **Yes** — `updateCanonical(...)` in Denali hooks (and/or `commitGearItems`) |
| Manual RHF sync after success? | **Yes** — explicit `setValue` and/or `applyCanonicalMvpToForm` inside `updateCanonical` |
| Double-write on destination | `updateCanonical` already syncs RHF; extra `setValue` on `basicInfo.destinationId` is duplicate but harmless |
| Modal owns form state? | **No** — stateless shell + provider orchestration |

---

## DenaliTourEditForm visibility / requiredness audit (2026-05-24)

Analyzed: `apps/web/src/components/tours/DenaliTourEditForm.tsx` and its direct child sections (`DenaliEditPublishSection`, `DenaliEditStepBody` → Denali step components).

### Architecture note

`DenaliTourEditForm` is a **single-page** layout (all wizard steps rendered as stacked sections). It does **not** implement per-field show/hide itself; it mounts the same step components as the create wizard (`DenaliBasicInfoStep`, `DenaliProgramNatureStep`, etc.), which use `useDenaliStepFieldRules` internally.

### Visibility & requiredness logic **inside** `DenaliTourEditForm.tsx`

| Location | Mechanism | Purpose |
|----------|-----------|---------|
| `denaliEditSections` (L47–49) | `.filter(step !== "review")` | Structural: omits review step from edit layout (not field visibility). |
| `DenaliEditStepBody` (L72–86) | `switch (stepId)` | Step routing only; always renders one step component per section. |
| `DenaliEditPublishSection` (L92–95) | `useWatch` | Watches `basicInfo.publishStatus` and full form for publish gate. |
| L109 | Ternary | `field.value === "active" ? "active" : "draft"` for publish status UI mapping. |
| L101 | `&&` | `publishReadinessBlocked = publishStatus === "active" && publishReadinessIssues.length > 0`. |
| L114 | Ternary | `disableValues={publishReadinessBlocked ? (["active"] as const) : undefined}` — disables “active” when not publish-ready. |
| L122–133 | Ternary / conditional render | Alert + list when `publishReadinessBlocked`. |
| L288–304 | `isSubmitted && validationIssues.length > 0` | Shows validation summary after failed submit (RHF/Zod errors). |
| L306–316 | `errors.root?.message`, `mutationErrorMessage` | Conditional error alerts. |
| L319–324 | `isSubmitting` ternaries | Disable cancel/submit; submit label “saving” vs “save”. |

**No** `if (category === …)`, **no** `useDenaliStepFieldRules`, **no** `isVisible` / `isRequired` calls in this file.

### `useState` / `useEffect` in `DenaliTourEditForm.tsx`

| Hook | Lines | Role | Visibility-related? |
|------|-------|------|---------------------|
| `useState` | L151 | `canonicalSyncToken` — bumps `DenaliCanonicalProvider` after `reset` / catalog sanitize | **No** (canonical ↔ RHF sync). |
| `useEffect` | L173–176 | `reset(defaultValues)` when tour-derived defaults change | **No**. |
| `useLayoutEffect` | L179–214 | Catalog ref sanitization (`sanitizeDenaliWizardCatalogRefs` + `applyDenaliInvariantState`) | **No** (data cleanup, can clear invalid destination/themes). |
| `useMemo` | L97–100, L216–227 | Publish readiness issues; validation issue labels | **Publish gate** / error display, not step field visibility. |
| `useCallback` | L230–257 | `onInvalid`, `submitValid` | Submit / scroll-to-error only. |

**No `useEffect` drives field visibility or required flags in this file.**

### `denaliRuleModel` / RuleEngine imports in `DenaliTourEditForm.tsx`

| Import | Present? |
|--------|----------|
| `denaliRuleSet` / `denaliRuleModel` | **No** |
| `useDenaliStepFieldRules` | **No** |
| `FormRuleEngine` / `DENALI_FORM_RULE_CONFIG` | **No** |
| `evaluateFormRules` | **No** |
| `DenaliCanonicalProvider` | **Yes** (L25, L265) — canonical state + `denaliUIAdapter` for descendants |
| `useDenaliCanonical` | **No** (children/steps use it indirectly) |

Field visibility/required for edit UI comes from **child step components** via `useDenaliStepFieldRules` → `denaliRuleSet` + `denaliUIAdapter` (same as create wizard).

### Delegated visibility (child steps — not in `DenaliTourEditForm.tsx` but part of edit UX)

| Step component | Rule hook | Typical gates |
|----------------|-----------|---------------|
| `DenaliBasicInfoStep` | `useDenaliStepFieldRules("denali_basic")` | `isVisible`, `isDurationAllowed` |
| `DenaliProgramNatureStep` | `useDenaliStepFieldRules("denali_program")` | `isVisible`, `arePathsVisible` |
| `DenaliLogisticsStep` | `useDenaliStepFieldRules("denali_logistics")` | `isVisible` (transport, gear, etc.) |
| `DenaliPricingPaymentStep` | `useDenaliStepFieldRules("denali_pricing")` | `isVisible` |
| `DenaliPhotosStep` | `useDenaliStepFieldRules("denali_photos")` | `isRequired` (e.g. insurance photos) |

Edit form reuses these unchanged; no separate edit-specific rule model.

### Hardcoded validation in / wired from `DenaliTourEditForm.tsx`

Logic that is **not** driven by `denaliRuleSet` visibility/required flags but still gates save/publish:

| Mechanism | Where wired | What it does | Ideal owner? |
|-----------|-------------|--------------|--------------|
| **`denaliCanonicalWizardResolver`** | L39, L159 | RHF resolver → `getDenaliWizardSubmitIssues` / Zod (`denaliWizardFormZod`) on blur/submit | Partially overlaps rule model; Zod is submit-shape authority today. |
| **`getDenaliWizardPublishReadinessIssues`** | L27, L98 in `DenaliEditPublishSection` | Blocks switching to `active` + lists issues; uses profile required paths + geo zones (classic DTO paths like `overview.title`, `logistics.primaryTransportMode`) | **Publish transition policy** — could align with rule engine “publish required” slice instead of parallel profile map. |
| **`collectTourFormValidationIssues`** | L225–227, L288–303 | Flattens RHF `errors` for summary UI | Presentation only; source is resolver/Zod. |
| **`applyDenaliInvariantState`** | L204–205 (catalog sanitize path) | Clears ghost/hidden leaves after kind/transport changes | **Invariant engine** (already shared with wizard); not RuleEngine visibility table. |
| **`sanitizeDenaliWizardCatalogRefs`** | L196–198 | Drops stale destination/theme ids | Catalog integrity, not rules. |
| **Server / mutation errors** | L243–254, L259–261 | `ApiError` → `setError("root", …)` | API layer (correct). |

**Not present in edit form (vs create wizard):** `applyDenaliWizardStepValidation` per-step navigation, draft version hash, or `openPublishBlocked` on final submit button (edit only disables publish status “active” via readiness, not the save button).

### Gaps / recommendations

1. **Publish readiness** (`getDenaliWizardPublishReadinessIssues`) uses **classic wizard submit paths** (`overview.title`, `itinerary.days`, …) while Denali form uses `basicInfo.*`, `programNature.*` — parity is via DTO projection in `mapDenaliWizardToCreateTourPayload`, not via `denaliRuleSet`. Risk of drift vs rule-driven required fields on edit.
2. **Edit shell** has no `useDenaliStepFieldRules`; any new visibility rule only needs step updates (good), but publish/save gates should eventually read the same rule model or a single “publish required” projection.
3. **No hardcoded category/duration `if` chains** in `DenaliTourEditForm.tsx` itself — aligned with create-wizard refactor direction.

### Summary

| Question | Answer |
|----------|--------|
| Visibility/required in `DenaliTourEditForm.tsx`? | **Almost none** — only publish-status UI gating and conditional alerts. |
| `useState`/`useEffect` for visibility? | **No** — only sync token, reset, catalog sanitize. |
| Rule engine imported here? | **No** directly; **yes** via child steps + `DenaliCanonicalProvider`. |
| Hardcoded validation? | **Yes** — Zod resolver, publish readiness helper, invariant/catalog sanitizers on the edit shell. |
