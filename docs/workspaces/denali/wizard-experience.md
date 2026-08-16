# Denali tour wizard experience

```yaml
doc_id: DENALI-WIZARD-EXPERIENCE
version: "2026-08-16-v18"
status: style_dod_closed
workspace: denali
stack: ui-primitives · design-tokens · denali/theme/wizard-*
authority: DEC-P9-007 · DEC-P9-013
```

## Scope

**Style remediation DoD (TEMP `denali-wizard-style-remediation-roadmap.md`):** closed 2026-06-11 — phases 1–4 + 4b green; `denali-wizard-theme.spec.ts` 14/14. Deferred: Playwright visual baseline (WZ-P2-06), framer-motion (WZ-P2-07).

Tour create wizard at **`/tours/new`** (`apps/web/app/tours/**`) — outside `(app)/` per DEC-P9-007. Controls stay on **`@app-tour/ui-primitives`**; no shadcn in `app/tours/**`.

| Area              | Path                                            |
| ----------------- | ----------------------------------------------- |
| Route             | `apps/web/app/tours/new/`                       |
| Host              | `apps/web/src/wizard/workspace-wizard-host.tsx` |
| Denali composites | `apps/web/src/wizard/denali/*`                  |
| Theme CSS         | `packages/workspaces/denali/theme/wizard-*.css` |
| Bridge chrome     | `apps/web/src/shell/wizard-bridge-shell.tsx`    |

Operator list/settings use shadcn under `(app)/`; wizard shares **tenant primary** and mist surfaces via `body[data-workspace-plugin="denali"]` + [`admin-experience.md`](admin-experience.md).

Tour **flat edit** at **`(app)/tours/[id]/edit`** (Denali operator) reuses the same composite field skin as create — see [Flat edit skin bridge](#flat-edit-skin-bridge) below. Edit stays outside Wizard Bridge; it mounts under the operator `(app)/` shell with shadcn nav buttons only in the page header.

## Field labels (i18n)

Wizard field/step copy lives in `packages/workspaces/denali/messages/{fa,en}/wizard.json` under the **`denali`** namespace (`fields.*`, `steps.*`). Host wiring:

| Piece                         | Source                                                            |
| ----------------------------- | ----------------------------------------------------------------- |
| `wizardI18n.messageNamespace` | `denali` in `workspace.manifest.json`                             |
| `wizardI18n.labelResolver`    | `createDenaliFieldLabelResolver` → `fields.${canonicalPath}` keys |
| Message merge                 | `loadWorkspaceWizardMessagesForLocale` (codegen from manifest)    |
| Translator hook               | `useWorkspaceWizardTranslator(wizardHost.wizardMessageNamespace)` |

If labels show English Title-case fallbacks (`Peak Height`), regenerate registry: `pnpm run generate:workspace-registry` — Denali namespace or label resolver missing from generated bindings.

## Template gate invariants (runtime overlay)

Tenant `wizard_template` JSON in `tenant_config` may be trimmed in Settings. Denali **`wizardHost.normalizeWizardTemplateGate`** (`normalize-denali-wizard-template-gate.ts`) runs inside [`wizard-template-gate-logic.ts`](../../../apps/web/src/tours/wizard-template-gate-logic.ts) **before** render:

| Invariant          | Mechanism                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| INV-DENALI-WIZ-001 | `ensureDenaliTourKindTemplateSteps` — inject visible `category` on `denali_basic` when missing                                    |
| INV-DENALI-WIZ-005 | `ensureDenaliMatrixRequiredTemplateSteps` — inject matrix-required paths (e.g. `program.shortDescription`)                        |
| INV-DENALI-WIZ-008 | `DENALI_FROZEN_TEMPLATE_FIELDS` — catalog-critical paths always injected; Settings template UI checkbox disabled; API PUT normalizes + rejects stripped publish payloads |
| Form profile       | Default `workspaceFormProfile` → `denali_pilot` when tenant payload omits `baseProfile` (via `resolveDenaliWorkspaceFormProfile`) |

**Frozen set (INV-DENALI-WIZ-008):** `category`, `title`, `destinationId`, `startDateTime`, `capacityMax`, `program.themeIds`, `photos`, `transport.mode` — always on in Settings template; cannot be unchecked.

`category` mounts composite **`denali.tour-kind-basics`** (category + duration + event variant picker). Trimming DB overlay does **not** remove tour-kind UI once the hook runs.

## Social channel (`socialMediaLink` composite)

Step 1 composite **`denali.social-media-link`** — operator picks how guests join the tour group:

| Kind                   | Wizard UI                                                    | Stored `socialMediaLink`                                     |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| **Telegram** (default) | No manual link input — info banner only                      | Empty until platform provisions the group link after publish |
| **Other platform**     | Full URL input (required when template marks field required) | Normalized `https://…` external URL                          |

Telegram group creation is **automatic**; leaders must not paste `@channel` or `t.me/…` in create-tour. Implementation: `denali-social-media-link-field.tsx` · logic: `denali-social-media-link-logic.ts`.

### Integration gate (Settings → Integrations)

The entire `socialMediaLink` composite (Telegram + other platform) is shown in create and flat-edit wizards **only when** the workspace has an **active Telegram delivery source** (`isActiveDeliverySource` on a `telegram` row from `GET /workspaces/:workspaceId/integrations`). That matches Settings: enabled `integration_connections` telegram row, or enabled legacy `workspace_telegram_bots` fallback when not suppressed.

| Integration state        | Wizard behaviour                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| Active telegram delivery | Composite renders as today (`denali.social-media-link`)                                                  |
| No active telegram       | Field removed from render plan; `clearWhenNotVisible` strips stored `socialMediaLink` on sanitize/submit |

Runtime flag: `uiOptions.telegramIntegrationActive` on `DenaliWizardRuleEvalContext`, fed by web hook `useWorkspaceIntegrationRuntimeState` (no server prop drilling). Create wizard waits on integration fetch alongside template gate to avoid show-then-hide flicker. Rule kind: `telegramIntegrationActive` on registry field `socialMediaLink`. When the flag is omitted (unit tests, non-web callers), visibility stays **unchanged** (backwards compatible).

### Review validation issue labels

`DenaliReviewValidationSummary` rows are labelled by `resolveDenaliWizardValidationFieldLabel`. Validation issue paths can be **composite renderer ids** (e.g. `denali.pricing-participants`, `denali.social-media-link`) rather than canonical leaf paths — because `denaliFieldIdForCanonicalPath` remaps composite **anchors** (e.g. `participants.minimumAge`) to the renderer id.

**INV-DENALI-WIZ-018 (actionable labels):** For validation rows, prefer the **leaf** `fields.*` label via the same order as `resolveDenaliFieldLabel` (`DENALI_COMPOSITE_LABEL_CANONICAL_PATH` → anchor path → `fields.*`), and only then fall back to `composites.<camelId>.sectionTitle` for unmapped composite widgets. Group section titles (e.g. «الزامات شرکت‌کننده» / “Participant requirements”) must **not** win over the leaf (“حداقل سن” / “Minimum age”) — operators need to know which control to fix. Specs: `DN-VLABEL-*` in `packages/workspaces/denali/test/wizard-validation-field-label.spec.ts`.

**Composite surface wiring:** `wizardHost.compositeSurfaceId` (`denali`) resolves via manifest `wizardSurfaces` → `apps/web/src/bootstrap/wizard-surface-bindings.generated.ts`. If composites render as empty `data-denali-wizard-composite-loading` placeholders, run `pnpm run generate:workspace-registry` after manifest changes. **`next-intl` peer** on `@app-tour/workspace-denali` must match host apps (`^4.11.1`) so review/composite surfaces share `NextIntlClientProvider` context. Charter: [`docs/phase-14/subphases/14.0-surface-registry-codegen.md`](../../phase-14/subphases/14.0-surface-registry-codegen.md).

To restore the **full** canonical field set (destination, dates, logistics, …), republish from **Settings → tour wizard template** using the palette — canonical list lives in [`denaliFullWizardTemplate.ts`](../../../packages/workspaces/denali/src/settings/denaliFullWizardTemplate.ts). Charter: [`docs/phase-14/subphases/14.0b-template-gate-hooks.md`](../../phase-14/subphases/14.0b-template-gate-hooks.md).

## Wizard Bridge chrome

When an **authenticated Denali operator** opens `/tours/new`, `ToursWizardLayout` renders **Wizard Bridge** instead of Phase 3 `AppShell`:

- Sticky header: compact brand, back links (`/tours`, `/dashboard`), **`WizardBridgeThemeToggle`** (`ui-primitives` + `wizard-bridge-shell__theme-toggle`)
- RTL (`html[dir="rtl"]`): `wizard-bridge-shell__back-icon` mirrors via CSS (`scaleX(-1)`) — no Tailwind on bridge chrome
- No sidebar — form-focused layout
- Urban / starter / anonymous → legacy `AppShell` unchanged

`data-testid="wizard-bridge-shell"` on the bridge root.

**Template seed banner:** `CreateTourWizardSeedBanner` shows when the published wizard template carries a non-empty `seedLabel` (prefill for `title`). Copy must describe a **template seed**, not the live tour title (`wizard.seedApplied` — e.g. «تمپلیت اعمال‌شده: {label}»). Hide the banner once the draft `title` diverges from `seedLabel` so operators are not told the tour is still named after the seed. Keep `data-testid` / `data-seed-label` stable for SMK-P9 seed e2e (assert on the seed string, not the prefix).

## CSS selectors

All Denali wizard skin rules scope to:

```css
body[data-workspace-plugin="denali"] [data-new-tour-wizard]
```

Progress + fields inside host:

```css
body[data-workspace-plugin="denali"] [data-new-tour-wizard] [data-workspace-wizard]
```

**Portal exception (calendar):** Radix `Popover` renders on `document.body`, outside `[data-new-tour-wizard]`. Calendar skin uses **body-level** selectors on `data-operator-wizard-calendar` / `data-operator-wizard-calendar-popover` — see `wizard-calendar.css`.

## Flat edit skin bridge

Phase 12.4 flat edit (`DenaliFlatEditForm`) renders wizard composites via platform `WizardField` but **does not** mount `WorkspaceWizardHost` or the create stepper. Composite BEM rules in `wizard-fields.css` still key off `[data-new-tour-wizard]` on an ancestor — same contract as create.

| Surface       | Route                   | Scope root                                                                        | Form landmark                              |
| ------------- | ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------ |
| Create wizard | `/tours/new`            | `DenaliCreateTourWizardView` → `data-new-tour-wizard`                             | `[data-workspace-wizard]` inside host      |
| Flat edit     | `(app)/tours/[id]/edit` | `DenaliFlatEditPageShell` → `data-new-tour-wizard` + `data-denali-flat-edit-page` | `[data-denali-flat-edit-form]` on `<form>` |

**Wiring (shell):** `apps/web/src/wizard/denali-flat-edit-chrome.tsx` exports `DenaliFlatEditPageShell` + `DenaliFlatEditPageHeader` (BEM `new-tour-wizard-page__*` — shared with create header typography). `denali-flat-edit-page-client.tsx` wraps all ready-state content in the shell so token bridge + composite borders apply without duplicating `wizard-fields.css` selectors.

**Non-goals:** No Wizard Bridge layout on edit; no stepper CSS required; no `data-new-tour-wizard` on the `<form>` itself (page root only — mirrors create, where scope sits on `new-tour-wizard-page`, not on inner field nodes).

Authority: [`docs/phase-12/subphases/12.4-denali-flat-edit-form.md`](../../phase-12/subphases/12.4-denali-flat-edit-form.md) · [`TOURS-EDIT-UX.md`](../../phase-9/appendices/TOURS-EDIT-UX.md) (Phase 12 supersession note).

## Flat edit draft authority

Flat edit mounts `useWorkspaceDraft` on `denali-edit:{tourId}` so in-progress field edits survive reload. That remote envelope is **not** allowed to clobber a newer saved tour.

```text
                    ┌─ remote denali-edit:{id} ─┐
 GET tour ─────────►│ meta.sourceRowVersion     │
 rowVersion = N     │   = N  (hydrate / seed)   │
                    │ form = canonical snapshot │
                    └──────────┬────────────────┘
                               │ operator types
                               ▼
                    form diverges; stamp stays N
                               │
            ┌──────────────────┼──────────────────┐
            │ reload           │ footer PATCH 200 │
            ▼                  ▼
     stamp N == tour N   tour rowVersion → N+1
     keep draft          GET tour
                         clearDraftAndReset(GET @ N+1)
                         (never clear→null then seed
                          from pre-PATCH React state)
```

| Condition | Form source | Why |
|-----------|-------------|-----|
| No remote draft | GET tour baseline | First open / after delete |
| Draft `sourceRowVersion` missing | Keep draft | Pre-stamp envelopes; unsaved work must not vanish |
| Draft `sourceRowVersion` ≥ tour `rowVersion` | Keep draft | Unsaved edits on the current saved version |
| Draft `sourceRowVersion` < tour `rowVersion` | GET tour | Leftover autosave from before the last successful PATCH |
| PATCH save/publish/unpublish succeeds | GET then `clearDraftAndReset` | Create-wizard already uses this primitive so React never sees `data=null` and cannot re-PUT the old baseline |

**Failure mode this closes:** footer save updated canonical title, heading showed the new title, `input[name=title]` still showed the create-time title after reload. `clearDraft()` set `data=null`; the seed effect ran against the **pre-PATCH** `tourBaseline` and PUT `denali-edit:{id}` with the old title. Next hydrate preferred that remote draft over GET.

Pure helpers (no React): `resolveDenaliFlatEditWorkingEnvelope`, `shouldSeedDenaliFlatEditDraftFromTour`, `replaceDenaliFlatEditDraftAfterSuccessfulPatch` in `packages/workspaces/denali/src/ui/chrome/flat-edit-draft-authority.ts`. Specs: `DEN-12.4-DRAFT-*` in `test/flat-edit-draft-authority.spec.ts`. Stamp reader: `readDenaliWizardSourceRowVersion` (integer ≥ 0). Post-PATCH reset **must** call `clearDraftAndReset` — a `clearDraft` + `setData` fallback is not permitted. Tour PATCH success is independent of draft-reset errors.

**Sensitive fields on this surface (operator edit):**

| Field | UI | Notes |
|-------|----|--------|
| Peak height | `disabled` **and** `readOnly` when destination catalog has `altitudeM` (ED-PEAK-RO-01) | Changing destination (توچال 3962 → دماوند 5610) prefills from catalog. Persist re-applies the lock (ED-PEAK-LOCK-01) via `wizardHost.normalizeCanonicalForPersist` **before** RuleEngine — API does not know `peakHeight`. |
| Paid tour | Checkbox reveals per-person price (تومان) | Empty price with paid checked must fail publish validation, not silently store `priceAmount: null` as free. |
| PII flags | national id / father name / birth date | Default off; enabling is a registration-policy change, not a tour-content edit. |
| Header «ذخیره پیش‌نویس» | Enabled only when draft engine is `DIRTY` or `ERROR` | Draft-engine **flush** only — does **not** PATCH the tour. Footer «ذخیره تغییرات» is the canonical write. Do **not** merge the two actions. Helper copy: `flatEdit.draftVsTourSaveHint` (Denali) + `title` on the host flush button (`wizard.saveDraftHint`). Autosave to `SYNCED` leaves the header disabled even with unsaved-vs-canonical field diffs if the engine already flushed the draft. |

`projection.updatedAt` on the memory storage driver may equal `createdAt` after PATCH even when `rowVersion` increments — do **not** use `updatedAt` to decide draft vs tour freshness; use `rowVersion` / `sourceRowVersion`.

## Operator UX closure (v11 — Denali only)

Layer: `packages/workspaces/denali` (+ host **copy** keys). **ED-PEAK-LOCK-01** adds an optional SDK persist hook and a product-blind API enrich — not a Denali branch in `updateTour`. Do not hand-edit `denaliRuleSet.generated.ts`.

| ID | Failure | Owner | Contract |
| -- | ------- | ----- | -------- |
| **ED-REV-UUID-01** | Review hero/rows flash raw destination/leader UUIDs while `loadDenaliReviewCatalog` is in flight (`mapIds` / `Map.get ?? id`). | `resolveDenaliReviewCatalogName` in `denali-review-format-logic.ts`; `DenaliReviewStep` already shows `review.loading`. | Never emit a UUID-shaped id as display text. Unresolved / loading → empty string so `pushRow` skips. Non-UUID slugs (themes) may still show the id if the catalog miss. Specs: `DEN-REV-CATALOG-01` + `WEB-DENALI-REVIEW-09`. |
| **ED-GATHER-01** | Logistics always **writes** `{ name: "" }` station 1 into the draft (`useEffect` seed). Canonical looks dirty; submit can persist an empty point. | `denali-location-types.ts` (`isDenaliGatheringPointPopulated`, `omitEmptyDenaliGatheringPoints`, editor scaffold helper) + gathering field (no seed effect) + global invariant `omitEmptyGatheringPoints`. | UI may show one empty scaffold; **persist `[]`** until name/address/coords exist. Sanitize/invariants strip empty rows. |
| **ED-GATHER-PERSIST-01** | Operator fills a station (name + OSM address) but review omits it and POST stores `gatheringPoints: []` / nested `[]`. | Field wrote RHF `tripDetails.logistics.gatheringPoints`; form adapter + review read canonical root `gatheringPoints`. | See [Gathering persist path](#gathering-persist-path-ed-gather-persist-01). |
| **ED-SAVE-COPY-01** | Operators confuse header flush with footer PATCH. | Denali helper on flat-edit form; host `title` on `DraftManualSyncButton`. | Actions stay two primitives. Copy only. |
| **ED-HIKE-MULTI-01** | `program.hikingGoHours` / `hikingReturnHours` visible on `*:multi_day` (confuse vs itinerary). | `cellOverrides` on those registry rows → `pnpm --filter @app-tour/workspace-denali run denali:codegen`. **RP-05 snapshot:** same hidden flags on multi-day cells in `apps/api/scripts/seed/definitions/denali-v1.json` (Denali matrix copy — not a new API invariant). | Hidden on multi-day cells; still optional on outdoor single-day. `hikingHoursApprox` unchanged. |
| **ED-PEAK-RO-01** | Peak input `disabled` but `readOnly: false`. | `DenaliDestinationCatalogMetricField`: `readOnly={locked}` in addition to `disabled`. | Inspector/AT see read-only. |
| **ED-PEAK-LOCK-01** | Crafted POST/PATCH could store a peak/trail metric other than the locked catalog value. | Denali `applyLockedDestinationCatalogMetricsToCanonical` on optional `wizardHost.normalizeCanonicalForPersist`. API enrich (main thread, before worker/engine) loads tenant destinations and calls the hook when present. | **Overwrite when locked** (same as UI prefill). Do **not** clear operator-entered values when the catalog does not lock. Skip when the metric field is not visible for the tour kind. Starter/Urban omit the hook → no extra `listDestinations`. Specs: `DEN-PEAK-LOCK-01*` + `API-PEAK-LOCK-01`. |

**Persist lock (v12):**

```text
PATCH/POST body
  → API enrich (optional hook only)
  → listDestinations(tenant)  [opaque rows]
  → plugin.wizardHost.normalizeCanonicalForPersist({ data, destinations })
  → Denali: destinationId hit + catalog metric locked + field visible
        → write catalog number onto tripDetails.overview.peakHeight | trailDistanceKm
  → RuleEngine validateCanonical (sees locked values)
```

API must not branch on `plugin.id === "denali"` or name `peakHeight`. Destinations stay settings records; Denali interprets `altitudeM` / `typicalTrailDistanceKm`. Worker threads must **not** call settings — enrich runs on the HTTP/main path only.

## Matrix visible-again + pair bounds (v13)

Template/matrix cells hide and show fields. Hide is already owned by `structuralInvariant: { kind: "clearWhenNotVisible" }` (sanitize). The remaining hole is **visible-again**: the UI can remount a catalog-locked metric and paint the catalog number while canonical is still empty, so Continue emits `REQUIRED_FIELD_EMPTY`. That is a matrix/lifecycle gap, not a peakHeight special case.

| ID | Failure | Owner | Contract |
| -- | ------- | ----- | -------- |
| **ED-CAT-SEED-01** | Mountain → nature (peak hidden + cleared) → mountain: locked peak shows catalog `3962` but Continue fails required. | `seedEmptyVisibleDestinationCatalogMetrics` after sanitize in `persistDenaliWizardDraftChange` (lookup from destination catalog). Metric field `useLayoutEffect` reseeds when catalog arrives later. | If the field is **visible again**, canonical is **empty**, and the current destination **locks** that metric → write the catalog string. Do **not** overwrite a non-empty operator value. Do **not** call full `applyDestinationCatalogPrefill` on every persist (that clears unlocked metrics). Hidden by template/matrix → no seed (sanitize already cleared). Specs: `DEN-CAT-SEED-01*`. |
| **ED-DT-CLOCK-01** | Category remount re-commits the end calendar day and can replace a complete ISO clock with start `fallbackTime`. | `isDatetimePickerDateUnchanged` in `DenaliWizardDatetimePicker`; inherit still only via `resolveDatetimePickerTimeForDateCommit` (empty / invented midnight). | Same calendar day → no `onChange`. Date-without-clock / `00:00` with a real start clock still inherits (ED-DT-END-01). Specs: `datetime-end-inherit.spec.ts`. |
| **ED-NUM-PAIR-01** | `capacityMin` > `capacityMax` and `participants.minimumAge` > `maximumAge` accepted through Continue/review. | `denali-numeric-pair-policy.ts` + `mergeDenaliNumericPairViolations` (same class as schedule dates). | Emit only when **both** fields are visible (matrix/template) **and** both parse as finite numbers **and** `min > max`. Empty optional min → skip. No `updateTour` / API branch. Codes: `DENALI_CAPACITY_MIN_AFTER_MAX`, `DENALI_AGE_MIN_AFTER_MAX`. |
| **ED-REV-VIS-01** | Review omitted `participants.maximumAge` and `participants.fitnessLevel` even when the pricing composite showed them. | `pushRowWhenFieldVisible` in `denali-review-format-logic.ts` (same helper as peak/trail). | Review visibility = wizard visibility. Fitness display uses `fitnessLevelLabel` (`low` / `medium` / `high`); storage stays the enum. |
| **ED-DT-CLEAR-01** | `endDateTime` lacked `clearWhenNotVisible` while `approximateReturnTime` had it — single-day cells could keep a stale multi-day end. | Registry `endDateTime.structuralInvariant` (sibling of return time). No `denali:codegen` (invariant is registry-owned, not a generated rule row). | Hide → clear on sanitize. Visible-again empty end is operator-owned (not catalog-seeded). |

**Visible-again seed (not dest-change prefill):**

```text
category / matrix cell change
  → persist rebase
  → sanitizeWizardDraft  (clearWhenNotVisible)
  → seedEmptyVisibleDestinationCatalogMetrics(draft, lookup(destinationId))
        visible + canonical empty + catalog lock → write catalog string
        else leave draft
  → persist-if-changed
```

`applyDestinationCatalogPrefill` remains the **destination picker** primitive (peak vs trail vs generic). Persist must not re-run it on every keystroke.

**Still deferred (product):** `projection.updatedAt` on memory GET still mirrors `createdAt` — freshness remains `rowVersion`. Do **not** merge header draft-flush with footer PATCH (`ED-SAVE-COPY-01`).

## Gathering persist path (ED-GATHER-PERSIST-01)

Live create (`/tours/new`) stored a filled Darband station in the composite UI, then review skipped the row and API canonical was `gatheringPoints: []` plus `tripDetails.logistics.gatheringPoints: []`. `omitEmptyGatheringPoints` (ED-GATHER-01) did **not** strip a populated row — the row never reached the form adapter.

```text
UI write  (bug)     tripDetails.logistics.gatheringPoints   ← populated
draft.data.tripDetails.logistics.gatheringPoints            ← populated
tourWizardDraftToDenaliForm reads canonicalPath
  "gatheringPoints" → form tripDetails.logistics.gatheringPoints
root missing → default []
prepareDenaliSubmitArtifact / review getCanonicalValue("gatheringPoints")
  → []
```

Registry SoT is already `canonicalPath: "gatheringPoints"` mapped to form `tripDetails.logistics.gatheringPoints` (`denaliCanonicalPathMap.generated.ts`). Composites, review, sanitize, and submit must use that **root**. Nested RHF path is a fallback read for in-memory drafts written before this fix.

| Layer | Path |
| ----- | ---- |
| Field read | `resolveDenaliGatheringPointsFromStorage(root, nested)` — populated root wins; else populated nested |
| Field write | canonical `gatheringPoints` (mirror nested so catalog-shaped drafts stay in sync) |
| Sanitize | `promoteDenaliGatheringPointsOnDraft` **before** `tourWizardDraftToDenaliForm` so nested-only drafts survive Continue/submit |
| Review | same resolve helper (not root-only) |
| Persist | form adapter maps root → nested form → artifact writes root + `tripDetails` blob |

Empty scaffold still must not persist (`ED-GATHER-01`). Specs: `DEN-GATHER-PERSIST-01*` in `denali-gathering-points.spec.ts` + review nested-only row.

## Catalog recovery (ED-CAT-RETRY-01)

`fetchDenaliCatalogJsonWithSoftRetry` retries **once** on 5xx/network then stops. Leader/theme/gear/language pickers used `useEffect([])` with no later refetch, so a cold BFF `ERR_CONNECTION_REFUSED` left «کاتالوگ موقتاً در دسترس نیست» for the whole create session (`leaderUserIds: []` on submit). Destinations that remount (edit) recovered.

Contract: degraded notice offers **تلاش مجدد**; when the notice is visible, `visibilitychange` / window `focus` also reloads. Soft-retry on each attempt stays one-shot. No API change.

## Optional empty (ED-EMPTY-OPT-01)

Gear (logistics catalog) and guide languages are **optional**. An empty picker is a valid skip, including when the catalog is soft-degraded.

| Surface | When | Contract |
| ------- | ---- | -------- |
| Field | `resolveDenaliOptionalEmptyReason`: degraded (soft-fail), catalog empty, or operator selected nothing | `DenaliOptionalEmptyNotice` — `role="status"` (never `alert`), `data-denali-optional-empty`. Copy: `composites.catalog.optionalEmpty`. Does **not** set `aria-invalid`. |
| Field (services) | Both included/self buckets empty | `composites.tourServices.emptyBucket` states skip is allowed. |
| Review | Visible `program.guideLanguageIds` / `participants.gearItems` / services with no values | Row value `review.optionalEmpty` (`emptyOptional: true`). Unresolved UUID names still omit the row (ED-REV-UUID-01) — that is loading/miss, not a skip. |
| Validate / save | `required: false` on those paths; submit catalog loader returns `{}` on fetch throw | Empty `[]` must not emit `REQUIRED_FIELD_EMPTY`. Soft-degraded catalog must not block `prepareSubmitPayload` / PATCH. |

```text
loading          → no optional-empty (spinner / loading copy)
hard catalog err → DenaliCatalogLoadNotice alert only
soft-fail        → degraded notice + optional-empty (save still allowed)
0 catalog rows   → settings empty copy + optional-empty
N rows, 0 picked → picker stays; optional-empty (operator skip)
N rows, k picked → selected summary only
```

Specs: `DN-EMPTY-OPT-01…` in `denali-optional-empty.spec.ts`; review `WEB-DENALI-REVIEW-11`; step validation `DN-EMPTY-OPT-04`.

## Photo upload error a11y (ED-PHOTO-A11Y-01)

Upload failure copy (`PHOTO_STORAGE_NOT_CONFIGURED` / Minio 503) lived inside the `<label>` wrapping `input[type=file]`, so the accessible name became «آپلود تصویر» + the error. Alert stays `role=alert` **outside** that label. Object-storage 503 remains an env/driver issue, not this UI contract.

## Remaining operator polish (v16)

Live create leftover after Phase 15. **No ×10 conversion.** Storage `priceCurrency` stays ISO `IRR`. Header draft-flush and footer PATCH stay two primitives.

| ID | Failure | Contract |
| -- | ------- | -------- |
| **ED-CURR-01** | Wizard labels تومان; operator list/edit header `Intl` with `priceCurrency: "IRR"` painted **ریال** for the same digits. | `formatTourPrice` (apps/web, product-blind) formats `IRR` as تومان / toman via grouped digits — not `Intl` currency style. Marketing/finance stay on their own formatters. Spec: `WEB-CURR-01` in `tours-list.spec.ts`. |
| **ED-DEST-NATURE-01** | Nature tour destination + itinerary pickers listed `locationType=peak` rows (Tochal/Damavand). Peak altitude prefill was already skipped. | `isDenaliDestinationOfferedForTourKind` hides peaks when `readDenaliCanonicalBasics(kind).category === "nature"`. Currently selected peak remains in the option list so the control does not go blank. Mountain/desert/event unchanged. Specs: `DEN-DEST-NATURE-01*`. |
| **ED-DT-EQ-COPY-01** | Guard is `Date.parse(end) <= Date.parse(start)` (equal instants rejected) but FA copy said only «قبل از شروع». | i18n: end **must be after** start (`باید بعد از شروع برنامه باشد` / `must be after the tour start`). Comparison unchanged. |

```text
loading catalog ──► destination/leader display = "" (not UUID)
catalog hit     ──► display = catalog name
catalog miss + UUID ──► display = "" (never echo id)
catalog miss + slug ──► display = slug
```

## Data attributes

| Attribute                                    | Use                                                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `data-new-tour-wizard`                       | Page root — create (`DenaliCreateTourWizardView`) and flat edit (`DenaliFlatEditPageShell`)                            |
| `data-denali-flat-edit-page`                 | Flat edit page root (with `data-new-tour-wizard`) — distinguishes edit from create in tests/docs                       |
| `data-denali-flat-edit-form`                 | Flat edit `<form>` landmark (`DenaliFlatEditForm`)                                                                     |
| `data-denali-wizard-host`                    | `WorkspaceWizardHost` when `pluginId=denali`                                                                           |
| `data-denali-wizard-surface="card\|section"` | KPI-style cards / composite sections                                                                                   |
| `data-denali-wizard-photo-grid`              | Photos composite — 2-column layout from `__photos-layout` (sm+)                                                        |
| `data-wizard-step-state`                     | **Sole** progress pill state SoT (`current` / `complete` / `upcoming` — upcoming uses dashed border in Denali stepper) |
| `data-wizard-step-rail`                      | Scroll rail wrapper; `data-wizard-step-rail-overflow-start` / `-end` toggle edge fade when pills overflow              |
| `data-denali-review-section`                 | Review step — per content-step summary block (`stepId` value)                                                          |
| `data-denali-review-photo`                   | Review photo grid cell (`photo.id`)                                                                                    |
| `data-denali-review-gear`                    | Review gear list row (`equipmentId` or name)                                                                           |
| `data-denali-review-card`                    | Itinerary / excluded-service card (`itinerary` \| `excluded` \| `text`)                                                |
| `data-denali-wizard-gear-list`               | Equipment catalog compact list (replaces per-item panels)                                                              |
| `data-denali-wizard-file-input`              | Styled file upload in photos composite                                                                                 |
| `data-operator-wizard-calendar`                | `Calendar` root inside date popover — portal-safe teal `--primary`                                                     |
| `data-operator-wizard-calendar-popover`        | `PopoverContent` wrapping calendar                                                                                     |
| `data-wizard-date-picker`                    | Trigger wrapper (`wizard-field` date kind, `denali-datetime-field`)                                                    |
| `data-operator-wizard-datetime`                | `LocalizedDatetimePicker` with `layout="wizard"` — BEM grid + primitive clock                                          |
| `wizard-bridge-shell__theme-toggle`          | Bridge header theme control (`ui-primitives` ghost)                                                                    |

## Token bridge

| Consumer                  | Variables                                                  |
| ------------------------- | ---------------------------------------------------------- |
| `ui-primitives`           | `--color-primary`, `--color-bg-page`, `--color-surface`, … |
| Legacy stepper in globals | `--primary`, `--border`, …                                 |

Denali wizard CSS sets **both** under `[data-new-tour-wizard]` so primitives and stepper share emerald `#059669` (light) / `#5eead4` (dark).

Explicit primitive aliases on page root (phase 2): `--color-surface`, `--color-border`, `--color-focus-ring` re-bound alongside shadcn `--primary` / `--card` bridge.

### Dark mode cascade

Same pattern as admin shell — platform `.theme-dark` in `globals.css` would inject blue `#5b9fd4` without overrides:

1. `html.dark:has(body[data-workspace-plugin="denali"]) [data-new-tour-wizard]`
2. `body[data-workspace-plugin="denali"] .theme-dark [data-new-tour-wizard]`

**Tenant inline override:** `[data-tenant-theme]` ships API `--color-primary` (often `#059669`) as an inline style. That value wins over `body` for descendants and would freeze `ui-primitives` primary buttons in dark mode. Denali wizard skin therefore **re-binds** `--color-primary` / `--color-primary-fg` on `[data-new-tour-wizard]` in dark selectors so step nav + primitive CTAs track teal `#5eead4`.

## Theme bundle

Imported via [`denali-admin.css`](../../../packages/workspaces/denali/theme/denali-admin.css):

- `wizard-skin.css` — bridge header (sticky), page typography, empty/seed states; **document scroll** (no viewport lock / no nested form overflow)
- `wizard-stepper.css` — **dense scroll rail** (single-row `nowrap` + horizontal scroll at all breakpoints); edge fade via `data-wizard-step-rail-overflow-*`; completed steps show checkmark; `WizardStepShell` auto-scrolls active pill (`scrollIntoView` `inline: center`); step fields grow at natural height inside the page flow
- `wizard-fields.css` — labels, composites, in-page date trigger borders
- `wizard-calendar.css` — portaled calendar popover (body-level; dual dark cascade)
- `wizard-interactions.css` — card hover, mild step fade (`prefers-reduced-motion: reduce` disables animation)
- `wizard-review.css` — final review hero (cover thumbnail), section header + edit jump, photo grid, gear list, validation summary

## Date picker exception

`LocalizedDatePicker` / `LocalizedDatetimePicker` (`src/components/i18n/`) use shadcn for calendar popover — allowed outside `app/tours`.

| Layer          | Scoping                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger        | `data-wizard-date-picker` on host + `data-operator-date-picker` on shadcn trigger — `wizard-fields.css` under `[data-new-tour-wizard]`                                                |
| Datetime bar   | `operator-wizard-datetime__control` — single bordered row; date + time triggers stretch full height (`justify-content: flex-start`); popovers use `overflow: visible` on control      |
| Popover + grid | `data-operator-wizard-calendar-popover` + BEM `operator-wizard-calendar__*` grid/header/day — **`wizard-calendar.css` on `body[data-workspace-plugin="denali"]`** (not under page root) |

Selected day uses `aria-pressed="true"` (not `data-selected`). Dark mode re-binds `--operator-wizard-calendar-primary` via the same dual cascade as admin (`html.dark:has(body…)` + `body… .theme-dark`).

**Calendar calendars (INV-DENALI-CAL-01):**

Canonical / API / min / compare / `onSelect` are **Gregorian ISO** (`YYYY-MM-DD` civil date, ISO-8601 datetime). Jalali never enters `data`, RuleEngine, or `updateTour`.

| Layer | Calendar | Notes |
| ----- | -------- | ----- |
| Storage + validation | Gregorian ISO | `startDateTime` / `endDateTime`, `minIsoDate`, `compareIsoDates`, `aria-label` on day cells |
| Admin `locale=fa` | Jalali **presentation** | Month grid + trigger label (`formatIsoDateLabel`) convert at the adapter. Week starts Saturday. |
| Admin `locale=en` | Gregorian presentation | Same ISO values; Sunday-first grid. |

```text
operator click (fa grid shows ۲۵ مرداد)
  → cell.iso = "2026-08-16"          # Gregorian civil day
  → datetime-local / ISO persist
  → review/list: isoToDatetimeLocalInput → formatDatetimeLocalLabel(fa)
        # display Jalali again; storage unchanged
```

Do **not** store `1405-05-25`. Do **not** convert in `apps/api` / `platform-core`. Reverse Jalali→Gregorian uses the same Intl forward mapping as `gregorianToJalaali` (civil-day binary search) — not a second formula and not a nested year/month/day scan. Shell twin: `apps/web/src/i18n/jalaali-calendar.ts` (Wave H.h — no Denali import from shell). Specs: `DN-CAL-01…07`, `WEB-CAL-01…03`.

**Calendar UX (tour schedule):**

| Behavior                | Contract                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day pick                | Clicking a day selects it and **closes** the popover (`LocalizedDatePicker` → `setOpen(false)`).                                                                                                                                                                                                                       |
| Month / year drill-down | Header month and year are buttons (`operator-wizard-calendar__title-btn`); month view = 3×4 grid, year view = 12-year page with nav. `data-operator-wizard-calendar-view` = `days` \| `months` \| `years`.                                                                                                                 |
| Tour start min date     | `startDateTime` — `resolveDenaliDatetimeFieldMinIsoDate` in `src/ui/logic/denali-schedule-date-policy.ts` wires `minIsoDate={today}` into `DenaliDatetimeField` → `DenaliWizardDatetimePicker` → `LocalizedDatePicker` → `DenaliCalendar`. Past calendar days/months/years render `--disabled` and ignore clicks. |
| Tour end min date       | **Single-day** (field hidden in UI) / default: start’s local ISO date so a later clock on day 1 stays selectable. **`*_multi` (INV-DENALI-MULTI-CAL-A):** min is the **next** local calendar day after start (`addIsoDateDays(startLocal, 1)`). Same-calendar-day multi-day is invalid even with a later clock. Empty/unparseable start → no end min (`undefined`; DN-SCHED-DATE-02). Edit grandfather (ED-DT-01) can leave start in the past; end min still follows that start (or start+1 when multi), **not** today. |
| Submit guard            | `mergeDenaliScheduleDateViolations` in `denali-wizard-validation.ts` (create step + flat-edit full validate). Two codes, both i18n’d under `review.validation.*`: |

**Schedule submit-guard logic (v10):**

```text
visible start? → local calendar(start) < today
                 AND not ED-DT-01 grandfather (same local day as scheduleBaselineStartIso)
                 → DENALI_TOUR_START_BEFORE_TODAY on start field id

visible end?   → both ISO parse AND Date.parse(end) <= Date.parse(start)
                 → DENALI_TOUR_END_BEFORE_START on end field id (denali.datetime-end)

visible end + *_multi?
                 → inclusive local calendar days(start, end) < 2
                 → DENALI_TOUR_MULTI_NEEDS_TWO_CALENDAR_DAYS on end field id
```

| Rule | Why this comparison |
| ---- | ------------------- |
| Start vs today | **Local calendar day**, not instant — a 23:00 pick on today must pass even if UTC date rolled. |
| End vs start | **Full instant** (`Date.parse`) — same-day `06:00` → `18:00` is valid **on single-day**; `06:00` → previous calendar day, or same-day earlier clock, is not. Equal instants are rejected (zero-length tour). |
| Multi-day span (**INV-DENALI-MULTI-CAL-A**) | **Distinct local calendar days**, not itinerary row count. `06:00` → next-day `18:00` = 2; same local YMD = 1 even if two itinerary shells exist. `estimateDenaliTourDayCount` returns that inclusive count (no min-2 clamp). Missing/inverted range → `undefined` (other guards own those cases). |
| Step scope | On a wizard step, start/end checks run only when that canonical path is in the expanded step and **not hidden** (single-day hides `endDateTime`). Full validate (flat edit / review) runs both when values are present. |
| Storage | Naive `…T06:00:00.000Z` wall-clock-as-Z is compared consistently on both fields; do not mix true UTC offsets here. |

Specs: `DN-SCHED-DATE-01…08` in `packages/workspaces/denali/test/denali-schedule-date-policy.spec.ts`; `DN-MULTI-CAL-01…04` in `denali-itinerary-day-count.spec.ts`; `WEB-P11-7-08` empty end; `WEB-P11-7-09` end-before-start; `WEB-P11-7-10` same-calendar-day multi-day. i18n: `DENALI_TOUR_END_BEFORE_START` (end **after** start) and `DENALI_TOUR_MULTI_NEEDS_TWO_CALENDAR_DAYS`.

**Destination catalog (searchable select):**

| Behavior | Contract                                                                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trigger  | `DenaliSearchableSelect` — native `<select>` when option count ≤ threshold (default 8); destination + itinerary segment pickers pass `searchableThreshold={0}` so any non-empty catalog is searchable. |
| Filter   | `filterSelectOptionsByQuery` — same normalization as gear/leader pickers (`denali-picker-filter-logic`). Nature tour kinds omit `locationType=peak` (`ED-DEST-NATURE-01`). |
| Panel    | BEM `denali-searchable-select__*` in `wizard-fields.css`; search input reuses `denali-wizard-picker__search` + scroll list `denali-wizard-picker__scroll`.                                             |
| Test ids | `denali-searchable-select-trigger`, `denali-searchable-select-search`, `denali-searchable-select-option-{id}`.                                                                                         |

**Datetime (phase 2):** `LocalizedDatetimePicker layout="wizard"` renders BEM `operator-wizard-datetime*` and `LocalizedTimeInput variant="primitive"`. Admin/finance paths keep default shadcn layout.

**Composite UX (phase 3):** Photos use single `__photo-card` surface (no nested `__panel`). Gear catalog uses `__list` / `__gear-item`. Section headings use `h3`; day blocks use `__subtitle`. File inputs use `data-denali-wizard-file-input`.

**Equipment catalog subtitle (settings parity):** `denali.gear` loads `tour_themes` alongside `equipment`. Each picker card’s secondary line mirrors **Settings → Equipment**: linked **tour theme names** from `themeIds` (joined with `Intl.ListFormat` for the active locale). When `themeIds` is empty, show `composites.gear.allThemes`; legacy rows with only `category` fall back to `composites.tourKind.categories.*` — never the raw slug (`mountain`) in the UI.

**Equipment catalog visual token (`iconKey`):** Operator **Settings → Equipment** may set an optional `iconKey` on each `workspace_equipment` row (platform column `icon_key`). Denali owns the **closed registry** (`packages/workspaces/denali/src/settings/equipment-icon-registry.ts`) and SVG stroke icons (`equipment-icons.tsx`). API rejects unknown keys (`400` invalid resource). Tour canonical `participants.gearItems` stores only `equipmentId` — icons resolve from catalog at render time (SSOT). `EquipmentCatalogAvatar` renders the existing `denali-gear-picker__swatch` + six tone classes from `item.id`; when `iconKey` is set the swatch shows the registry SVG, otherwise **initials from name** (legacy fallback). Same avatar in settings list, wizard `denali.gear`, and review gear rows. No per-row upload; no `iconKey` on tour draft.

**Maintenance (phase 4):** `data-step-state` removed — platform fallback in `globals.css` and Denali `wizard-stepper.css` both key off `data-wizard-step-state` only. Stepper layout duplication is intentional: `globals.css` = Urban/starter neutral pills; `wizard-stepper.css` = Denali scroll rail + teal states under `[data-new-tour-wizard]`.

**Infrastructure hardening (phase 4b):**

| Concern                     | Contract                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Step navigation footer      | `WizardStepShell` — actions inside `workspace-wizard-shell__card` as inset bar; Denali groups ghost **قبلی** + primary **ادامه** at inline-end with chevrons (RTL-aware). First step hides back. |
| Photo external URL          | `denaliImageFileAssetSchema` + UI — `https:` only (`isDenaliHttpsImageUrl` in `@app-tour/workspace-denali`)                                                                                      |
| Wizard draft upload session | `createDenaliWizardDraftSessionId()` — UUID v4 via `crypto.randomUUID` or `getRandomValues` fallback; upload disabled when not UUID-shaped                                                       |
| Denali composite bundle     | `next/dynamic` → `denali-composite-field.tsx`; Urban wizard does not eagerly import Denali composite renderers                                                                                   |
| Section headings            | All composites use `<h3 class="denali-wizard-composite__title">` (including location zones)                                                                                                      |
| Composite load errors       | `denali-wizard-composite__error` + `role="alert"` (gear catalog fetch failures)                                                                                                                  |

## Composites

All `apps/web/src/wizard/denali/*.tsx` fields use BEM classes (`denali-wizard-composite*`) styled in `wizard-fields.css` — no Tailwind utilities in composite renderers.

**Location zones progressive disclosure (INV-DENALI-WIZ-019):** `denali.location-zones` still exposes all registry paths (`startPoint`, `summitPoint`, `campPoint`, `endPoint`) — matrix visibility is unchanged. Each zone is a `<details>` panel: **collapsed by default when empty**, **open when** `isDenaliLocationDataPopulated` (label / address / coordinates). The Leaflet/OSM map (`DenaliLocationPickerMap`) mounts only while that zone’s panel is open (`mapMounted`), so nature tours with unused zones do not pay for four map instances on first paint. Expanding a zone mounts the map; collapsing unmounts it. Mountain tours with prefilled zones still open those panels. Specs: `DN-LOC-ZONE-*` in `packages/workspaces/denali/test/denali-location-zone-disclosure.spec.ts`.

Platform-neutral wizard fallback remains in `apps/web/app/globals.css`; Denali overrides live only under `[data-new-tour-wizard]`.

## Submit error handling (operator-facing)

Server actions (`createTourAction`, `updateTourAction`) return structured `{ status, code, message }` from Tour Ops API. Denali wizard cores encode failures as `TOUR_ACTION_ERROR:` + JSON (see `tour-action-submit-error-codec.ts`) — never raw `ACTION:400:CANONICAL_…` tokens in UI state.

**Auth bind (create):** `createTourAction` must call Tour Ops with the operator **session JWT** (`Authorization: Bearer …` + ingress `host`), same as `updateTourAction`. Using `resolveBootstrapAppSession()` alone (env defaults like `dev-tenant-local`) sends the wrong `x-tenant-id` and API returns `500 internal_error`.

`createTourAction` **must** call `resolveRequestBootstrapAppSession()` (host + signed session cookie), not bare `resolveBootstrapAppSession()`. The env-only bootstrap (`dev-tenant-local` / `default` workspace) makes `POST /tours` return `500 internal_error` even when the operator UI shows the correct Denali tenant from layout bootstrap.

| Layer                             | Responsibility                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `parseTourApiErrorBody`           | Split API `code` vs human `error` message                                          |
| `parsePlatformValidationMessage`  | Turn `CANONICAL_VALIDATION_FAILED: …` into field segments                          |
| `resolveWizardSubmitErrorMessage` | Map segments → shell `wizard.submit*` / `host.validation.codes.*` + product localize |
| `WizardSubmitErrorAlert`          | Summary + bullet list under create/save footer                                     |

**Thin-shell split (create + flat-edit):**

| Concern | Owner | Namespace / surface |
| ------- | ----- | ------------------- |
| HTTP bucket copy (`submit.http500`, `submitEdit.validationSummary`, …) | Shell (`apps/web` `wizard.*`) | `useTranslations("wizard")` |
| Structural codes (`REQUIRED_FIELD_EMPTY`, …) | Shell | `wizard.host.validation.codes.*` (`has` must check that path) |
| Platform prose → operator copy (`validation.requiredField`, `validation.invalidValue`, …) | Workspace plugin via `localizeWizardValidationIssueMessage` | **Workspace** translator (`useWorkspaceWizardTranslator(pluginId)` → `denali.validation.*`), **not** shell `wizard.*` |
| Field labels | Workspace label resolver | Same workspace translator |
| Client-side draft validation list | Product `FlatEditValidationList` from flat-edit page surface registry | `denali.review.validation.*` codes; shell suppresses duplicate `WizardSubmitErrorAlert` when issues are present |

If localize is wired to shell `wizard` alone, next-intl echoes missing keys such as `wizard.validation.invalidValue` in the footer — that is a shell wiring bug, not a Denali message pack gap.

Validation failures show Persian field labels (e.g. «نقطه شروع») — not English canonical paths or HTTP codes.

For non-validation HTTP failures (401/403/409/5xx), the summary stays a localized bucket message (`wizard.submit.http500`, etc.) and **details** carry operator-debuggable facts from the API envelope:

| Detail line | Source |
| ----------- | ------ |
| `submit.errorDetailCode` | Tour Ops `code` when present |
| `submit.errorDetailMessage` | `error` / `message` body (e.g. `internal_error`) |
| `submit.errorDetailCorrelation` | `correlationId` echoed by API — match in `@apps/api` access logs |

Server errors intentionally hide stack/SQL from the response; correlation id is the supported cross-layer lookup key.

## Post-create navigation (Phase 11.6)

Successful create **must** leave `/tours/new` immediately:

| Step | Behavior |
| ---- | -------- |
| Submit OK | `runCreateTourPostSubmitSuccess` → `router.replace(/tours?created={id})` |
| Remote draft | `createCreateTourPostSubmitDiscardRemoteDraft` → `deleteWorkspaceDraftSnapshot` in background (non-verified DELETE) |
| Engine | No `clearDraft()` on success — avoids `data=null` loading stall (especially with `?clone=`) |
| List UX | `OperatorToursPageClient` shows `tours.createdNotice`, strips `?created=` from URL |

Contract guard: `pnpm run guard:wizard-post-submit` (wired in `pre-commit:fast`)

## Verification

```bash
pnpm --filter @apps/web exec playwright test tests/smoke/denali-wizard.spec.ts
cd apps/web && NODE_ENV=test node --import tsx --import ./test/register-dom.mjs --test test/denali-wizard-theme.spec.ts
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts --grep SMK-P9-WIZARD-THEME
```

Manual: `http://denali.localhost:3000/tours/new` (logged in) — bridge header, teal primary on primitive buttons, Persian step labels.
