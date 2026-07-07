# Tour clone hydration (Phase 11.6)

> **DEC:** [DEC-P11-007](appendices/IMPLEMENTATION-DECISIONS.md#dec-p11-007--client-side-tour-clone-hydration-116)  
> **Draft binding:** [`denali-wizard-draft-binding.md`](denali-wizard-draft-binding.md)

## Operator entry

Tour list duplicate CTA links to `/tours/new?clone={tourId}` (`WEB-9.3-04`). The new-tour wizard reads `clone` from the query string, fetches `GET /api/tours/{id}`, and hydrates a fresh `TourWizardDraft` envelope.

**Server clone (11.12):** `POST /tours/{tourId}/clone` uses `plugin.tourClone.prepareServerCloneCreateData` when implemented (Denali: in-place canonical mutation — no wizard-path flattening), then `createTour`. Client wizard still uses `hydrateWizardDraft`. See [`subphases/11.12-server-tour-clone.md`](subphases/11.12-server-tour-clone.md).

## Priority vs saved draft

When `?clone=` is present on a Denali tenant:

1. Clone fetch runs after the wizard template gate is published.
2. Hydrated form **replaces** any remote `operator.wizard` / `denali-create` snapshot for this session (explicit duplicate intent).
3. Template seed prefill and remote draft resume are skipped until clone completes or fails.
4. `useWorkspaceDraft({ hydrateFromRemote: false })` while `?clone=` is set on **Denali only** — prevents remote snapshot from racing the clone hydrate. Starter and other plugins ignore `?clone=` and keep normal template prefill.
5. `clearDraft()` runs before applying the hydrated envelope — replaces any existing `denali-create` snapshot without OCC `DRAFT_VERSION_CONFLICT`.
6. Equipment catalog ids are passed only when `GET /api/settings/resources/equipment` succeeds; a failed equipment fetch leaves gear unchanged (legacy parity).

### Post-create navigation

Successful wizard submit (`POST /tours`) **must not** leave the operator on `/tours/new` (especially with `?clone=` still set — remote hydrate is disabled and engine `clearDraft()` would empty local state → perpetual `draft-loading`). Web shell calls `runCreateTourPostSubmitSuccess` → `router.replace('/tours?created={id}')` immediately; **remote** draft cleanup uses non-verified `deleteWorkspaceDraftSnapshot` in the background (no engine `clearDraft`, no verify GET).

**Tours list notice:** `OperatorToursPageClient` reads `?created=`, shows `tours.createdNotice`, then strips the query param via `router.replace` so refresh does not repeat the banner.

**Verified DELETE:** `deleteWorkspaceDraftSnapshotVerified` trusts `DELETE 204` and skips the follow-up GET (manual clear-draft still deletes remote; post-submit uses simple DELETE only).

**Shared client utilities (Phase 11 hardening):** transient HTTP retry (`fetchWithTransientRetry` in `@app-tour/draft-engine`) backs workspace draft GET and Denali photo preview URL fetch. Photo upload error codec is canonical in `workspace-denali/ui/adapters/photo-upload-errors`; `apps/web/src/i18n/resolve-denali-photo-upload-error.ts` re-exports only.

### Clone hydrate orchestration (Denali create wizard)

`useDenaliCreateTourWizardCore` runs clone hydration **once per** `(cloneTourId, wizardSessionId)` pair:

```text
hydrateCreateTourFromClone → clearDraft → setData → cloneStatus=ready
```

**Stable effect contract:** the clone `useEffect` must **not** list the whole `draftSync` hook return in its dependency array — `useWorkspaceDraft` would otherwise produce a new object reference on every engine state tick and re-trigger hydration in a loop (duplicate tour/catalog/remint fetches, draft DELETE/GET 404 noise, perpetual `clone-loading` UI).

Implementation:

- Pure sequence: `runCreateTourCloneHydrateSequence` in `@app-tour/workspace-denali` (`create-tour-clone-hydrate-sequence.ts`).
- Effect deps: `cloneTourId`, `gate.published`, `wizardSessionId`, `pluginId` only; draft mutators read from refs.
- Idempotency key: `resolveCreateTourCloneHydrateKey(cloneTourId, wizardSessionId)` — replays `ready` without refetch when already hydrated for the same key.
- `useWorkspaceDraft` return value is memoized so downstream effects can safely depend on `draftSync.data` / `draftSync.setData` without object-identity churn.

## Denali transform (`@app-tour/workspace-denali`)

`denaliHydrateTourCloneDraft(canonicalData, options?)`:

| Step | Behavior |
| ---- | -------- |
| Normalize | Legacy nested `basicInfo` → flat canonical paths via `DENALI_CANONICAL_TO_FORM_PATH_MAP`; promote `basics.title` → `title` for starter-shaped storage |
| Title | Append ` (Copy)` unless already suffixed |
| Gear | Filter `participants.gearItems` to `activeEquipmentIds` when catalog ids are supplied |
| Publish | Force `publishStatus: "draft"` on the hydrated draft |

Gear filtering mirrors legacy `filterGearItemsToActiveEquipmentCatalog` — stale equipment rows from the source tour are dropped so the wizard only shows catalog-backed items.

## Workspace SDK contract

Optional plugin surface:

```typescript
type TourCloneHydrator = {
  hydrateWizardDraft(input: {
    canonicalData: Record<string, unknown>;
    activeEquipmentIds?: readonly string[];
  }): { data: Record<string, unknown> };
};
```

Denali implements `plugin.tourClone`; starter omits it (clone query is ignored for non-Denali plugins).

## Web wiring

`new-tour-wizard-client.tsx`:

- `useSearchParams().get("clone")`
- Parallel fetch: tour detail + `/api/settings/resources/equipment`
- Loading copy: `wizard.clone.loading` («در حال بارگذاری تور برای کپی»)
- `denaliPrepareDraftEnvelope(hydratedForm, { currentStepIndex: 0, wizardSessionId })` → `useWorkspaceDraft.setData`

Orchestration helpers live in `apps/web/src/tours/tour-clone-hydrate-logic.ts` (unit-tested). Hydration calls `plugin.tourClone.hydrateWizardDraft` via `getDenaliWorkspacePlugin()` — not a direct bypass of the SDK contract.

## Verification

- `packages/workspaces/denali/test/denali-tour-clone-hydration.spec.ts`
- `packages/workspaces/denali/test/create-tour-clone-hydrate-sequence.spec.ts`
- `apps/web/test/tour-clone-hydrate.spec.ts` (extends `WEB-9.3-04` hydrate assertion)
- `apps/web/test/create-tour-post-submit-wiring.spec.ts` (WEB-P11-6-06…08)
- `apps/web/test/run-create-tour-post-submit-success.spec.ts`
- `pnpm run guard:wizard-post-submit` (also runs in `pre-commit:fast`)
- `apps/web/tests/e2e/urban-wizard-create.spec.ts` (SMK-P15-W-D2 redirect + created notice)

## Photo remint (11.13)

When `hydrateWizardDraft` receives `wizardSessionId` + `tenantId`, photo rows get new UUIDs and `wizard-drafts/{sessionId}/photos/{newId}` keys. Optional `photoRemintPlan` drives `POST /api/wizard-clone-remint` (BFF → MinIO copy) **in the background after the wizard envelope is applied** — remint never blocks clone hydration. Failures log a warning only. Plans larger than 10 entries are sent in batches (API schema max). Server `POST /tours/{id}/clone` remints to the new tour id inline. See [`subphases/11.13-clone-photo-remint.md`](subphases/11.13-clone-photo-remint.md).

**Photo preview / upload errors:** API infrastructure codes (`TENANT_DB_BUDGET_EXCEEDED`, `DB_POOL_SATURATED`) normalize to `PHOTO_SERVICE_BUSY` before i18n lookup (`denali.composites.photos.uploadErrors`) so next-intl never logs `MISSING_MESSAGE` for saturated pool responses during preview URL fetch. Preview URL fetch retries once on `502`/`503`/`504` (same pattern as workspace draft GET).

**Draft GET console noise:** The web BFF maps API `WORKSPACE_DRAFT_NOT_FOUND` (`404`) to `204 No Content` on snapshot GET. The draft client already treats `204` as “no snapshot”; clone `clearDraft` verify and first-open resume no longer surface red `404` in DevTools while API semantics stay unchanged upstream.

## Server clone BFF (11.14)

`POST /api/tours/{tourId}/clone` proxies to API `POST /tours/{tourId}/clone`. See [`subphases/11.14-web-bff-tour-clone.md`](subphases/11.14-web-bff-tour-clone.md).

## Deferred

- Full legacy `transformTourToDenaliWizardValues` (API DTO → nested form) — trunk uses canonical `data` directly
