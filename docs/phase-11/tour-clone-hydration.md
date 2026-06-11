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
- `apps/web/test/tour-clone-hydrate.spec.ts` (extends `WEB-9.3-04` hydrate assertion)

## Photo remint (11.13)

When `hydrateWizardDraft` receives `wizardSessionId` + `tenantId`, photo rows get new UUIDs and `wizard-drafts/{sessionId}/photos/{newId}` keys. Optional `photoRemintPlan` drives `POST /tours/clone-photo-remint` (MinIO copy). Server `POST /tours/{id}/clone` remints to the new tour id inline. See [`subphases/11.13-clone-photo-remint.md`](subphases/11.13-clone-photo-remint.md).

## Server clone BFF (11.14)

`POST /api/tours/{tourId}/clone` proxies to API `POST /tours/{tourId}/clone`. See [`subphases/11.14-web-bff-tour-clone.md`](subphases/11.14-web-bff-tour-clone.md).

## Deferred

- Full legacy `transformTourToDenaliWizardValues` (API DTO → nested form) — trunk uses canonical `data` directly
