# Denali tour wizard experience

```yaml
doc_id: DENALI-WIZARD-EXPERIENCE
version: "2026-06-24-v8"
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
| Form profile       | Default `workspaceFormProfile` → `denali_pilot` when tenant payload omits `baseProfile` (via `resolveDenaliWorkspaceFormProfile`) |

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

`DenaliReviewValidationSummary` rows are labelled by `resolveDenaliWizardValidationFieldLabel`. Validation issue paths can be **composite renderer ids** (e.g. `denali.pricing-participants`, `denali.social-media-link`) rather than canonical leaf paths. The resolver is composite-aware: it first tries the composite `composites.<camelId>.sectionTitle` message, then reverse-maps the composite id via `DENALI_COMPOSITE_BY_CANONICAL_PATH` to a canonical `fields.*` label, and only then falls back to the raw path. This avoids `MISSING_MESSAGE: denali.fields.denali.<composite-id>` noise for composite-backed fields.

**Composite surface wiring:** `wizardHost.compositeSurfaceId` (`denali`) resolves via manifest `wizardSurfaces` → `apps/web/src/bootstrap/wizard-surface-bindings.generated.ts`. If composites render as empty `data-denali-wizard-composite-loading` placeholders, run `pnpm run generate:workspace-registry` after manifest changes. **`next-intl` peer** on `@app-tour/workspace-denali` must match host apps (`^4.11.1`) so review/composite surfaces share `NextIntlClientProvider` context. Charter: [`docs/phase-14/subphases/14.0-surface-registry-codegen.md`](../../phase-14/subphases/14.0-surface-registry-codegen.md).

To restore the **full** canonical field set (destination, dates, logistics, …), republish from **Settings → tour wizard template** using the palette — canonical list lives in [`denaliFullWizardTemplate.ts`](../../../packages/workspaces/denali/src/settings/denaliFullWizardTemplate.ts). Charter: [`docs/phase-14/subphases/14.0b-template-gate-hooks.md`](../../phase-14/subphases/14.0b-template-gate-hooks.md).

## Wizard Bridge chrome

When an **authenticated Denali operator** opens `/tours/new`, `ToursWizardLayout` renders **Wizard Bridge** instead of Phase 3 `AppShell`:

- Sticky header: compact brand, back links (`/tours`, `/dashboard`), **`WizardBridgeThemeToggle`** (`ui-primitives` + `wizard-bridge-shell__theme-toggle`)
- RTL (`html[dir="rtl"]`): `wizard-bridge-shell__back-icon` mirrors via CSS (`scaleX(-1)`) — no Tailwind on bridge chrome
- No sidebar — form-focused layout
- Urban / starter / anonymous → legacy `AppShell` unchanged

`data-testid="wizard-bridge-shell"` on the bridge root.

## CSS selectors

All Denali wizard skin rules scope to:

```css
body[data-workspace-plugin="denali"] [data-new-tour-wizard]
```

Progress + fields inside host:

```css
body[data-workspace-plugin="denali"] [data-new-tour-wizard] [data-workspace-wizard]
```

**Portal exception (calendar):** Radix `Popover` renders on `document.body`, outside `[data-new-tour-wizard]`. Calendar skin uses **body-level** selectors on `data-denali-wizard-calendar` / `data-denali-wizard-calendar-popover` — see `wizard-calendar.css`.

## Flat edit skin bridge

Phase 12.4 flat edit (`DenaliFlatEditForm`) renders wizard composites via platform `WizardField` but **does not** mount `WorkspaceWizardHost` or the create stepper. Composite BEM rules in `wizard-fields.css` still key off `[data-new-tour-wizard]` on an ancestor — same contract as create.

| Surface       | Route                   | Scope root                                                                        | Form landmark                              |
| ------------- | ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------ |
| Create wizard | `/tours/new`            | `DenaliCreateTourWizardView` → `data-new-tour-wizard`                             | `[data-workspace-wizard]` inside host      |
| Flat edit     | `(app)/tours/[id]/edit` | `DenaliFlatEditPageShell` → `data-new-tour-wizard` + `data-denali-flat-edit-page` | `[data-denali-flat-edit-form]` on `<form>` |

**Wiring (shell):** `apps/web/src/wizard/denali-flat-edit-chrome.tsx` exports `DenaliFlatEditPageShell` + `DenaliFlatEditPageHeader` (BEM `new-tour-wizard-page__*` — shared with create header typography). `denali-flat-edit-page-client.tsx` wraps all ready-state content in the shell so token bridge + composite borders apply without duplicating `wizard-fields.css` selectors.

**Non-goals:** No Wizard Bridge layout on edit; no stepper CSS required; no `data-new-tour-wizard` on the `<form>` itself (page root only — mirrors create, where scope sits on `new-tour-wizard-page`, not on inner field nodes).

Authority: [`docs/phase-12/subphases/12.4-denali-flat-edit-form.md`](../../phase-12/subphases/12.4-denali-flat-edit-form.md) · [`TOURS-EDIT-UX.md`](../../phase-9/appendices/TOURS-EDIT-UX.md) (Phase 12 supersession note).

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
| `data-denali-wizard-calendar`                | `Calendar` root inside date popover — portal-safe teal `--primary`                                                     |
| `data-denali-wizard-calendar-popover`        | `PopoverContent` wrapping calendar                                                                                     |
| `data-wizard-date-picker`                    | Trigger wrapper (`wizard-field` date kind, `denali-datetime-field`)                                                    |
| `data-denali-wizard-datetime`                | `LocalizedDatetimePicker` with `layout="wizard"` — BEM grid + primitive clock                                          |
| `wizard-bridge-shell__theme-toggle`          | Bridge header theme control (`ui-primitives` ghost)                                                                    |

## Token bridge

| Consumer                  | Variables                                                  |
| ------------------------- | ---------------------------------------------------------- |
| `ui-primitives`           | `--color-primary`, `--color-bg-page`, `--color-surface`, … |
| Legacy stepper in globals | `--primary`, `--border`, …                                 |

Denali wizard CSS sets **both** under `[data-new-tour-wizard]` so primitives and stepper share teal `#0f766e` (light) / `#5eead4` (dark).

Explicit primitive aliases on page root (phase 2): `--color-surface`, `--color-border`, `--color-focus-ring` re-bound alongside shadcn `--primary` / `--card` bridge.

### Dark mode cascade

Same pattern as admin shell — platform `.theme-dark` in `globals.css` would inject blue `#5b9fd4` without overrides:

1. `html.dark:has(body[data-workspace-plugin="denali"]) [data-new-tour-wizard]`
2. `body[data-workspace-plugin="denali"] .theme-dark [data-new-tour-wizard]`

**Tenant inline override:** `[data-tenant-theme]` ships API `--color-primary` (often `#0f766e`) as an inline style. That value wins over `body` for descendants and would freeze `ui-primitives` primary buttons in dark mode. Denali wizard skin therefore **re-binds** `--color-primary` / `--color-primary-fg` on `[data-new-tour-wizard]` in dark selectors so step nav + primitive CTAs track teal `#5eead4`.

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
| Trigger        | `data-wizard-date-picker` on host + `data-denali-date-picker` on shadcn trigger — `wizard-fields.css` under `[data-new-tour-wizard]`                                                |
| Datetime bar   | `denali-wizard-datetime__control` — single bordered row; date + time triggers stretch full height (`justify-content: flex-start`); popovers use `overflow: visible` on control      |
| Popover + grid | `data-denali-wizard-calendar-popover` + BEM `denali-wizard-calendar__*` grid/header/day — **`wizard-calendar.css` on `body[data-workspace-plugin="denali"]`** (not under page root) |

Selected day uses `aria-pressed="true"` (not `data-selected`). Dark mode re-binds `--denali-wizard-calendar-primary` via the same dual cascade as admin (`html.dark:has(body…)` + `body… .theme-dark`).

**Calendar UX (tour schedule):**

| Behavior                | Contract                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day pick                | Clicking a day selects it and **closes** the popover (`LocalizedDatePicker` → `setOpen(false)`).                                                                                                                                                                                                                       |
| Month / year drill-down | Header month and year are buttons (`denali-wizard-calendar__title-btn`); month view = 3×4 grid, year view = 12-year page with nav. `data-denali-wizard-calendar-view` = `days` \| `months` \| `years`.                                                                                                                 |
| Tour start min date     | `startDateTime` only — `resolveDenaliDatetimeFieldMinIsoDate` in `src/ui/logic/denali-schedule-date-policy.ts` wires `minIsoDate={today}` into `DenaliDatetimeField` → `DenaliWizardDatetimePicker` → `LocalizedDatePicker` → `DenaliCalendar`. Past calendar days/months/years render `--disabled` and ignore clicks. |
| Submit guard            | `mergeDenaliScheduleDateViolations` in `denali-wizard-validation.ts` emits `DENALI_TOUR_START_BEFORE_TODAY` when stored ISO datetime's **local calendar day** is before today.                                                                                                                                         |

**Destination catalog (searchable select):**

| Behavior | Contract                                                                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trigger  | `DenaliSearchableSelect` — native `<select>` when option count ≤ threshold (default 8); destination + itinerary segment pickers pass `searchableThreshold={0}` so any non-empty catalog is searchable. |
| Filter   | `filterSelectOptionsByQuery` — same normalization as gear/leader pickers (`denali-picker-filter-logic`).                                                                                               |
| Panel    | BEM `denali-searchable-select__*` in `wizard-fields.css`; search input reuses `denali-wizard-picker__search` + scroll list `denali-wizard-picker__scroll`.                                             |
| Test ids | `denali-searchable-select-trigger`, `denali-searchable-select-search`, `denali-searchable-select-option-{id}`.                                                                                         |

**Datetime (phase 2):** `LocalizedDatetimePicker layout="wizard"` renders BEM `denali-wizard-datetime*` and `LocalizedTimeInput variant="primitive"`. Admin/finance paths keep default shadcn layout.

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

Platform-neutral wizard fallback remains in `apps/web/app/globals.css`; Denali overrides live only under `[data-new-tour-wizard]`.

## Submit error handling (operator-facing)

Server actions (`createTourAction`, `updateTourAction`) return structured `{ status, code, message }` from Tour Ops API. Denali wizard cores encode failures as `TOUR_ACTION_ERROR:` + JSON (see `tour-action-submit-error-codec.ts`) — never raw `ACTION:400:CANONICAL_…` tokens in UI state.

**Auth bind (create):** `createTourAction` must call Tour Ops with the operator **session JWT** (`Authorization: Bearer …` + ingress `host`), same as `updateTourAction`. Using `resolveBootstrapAppSession()` alone (env defaults like `dev-tenant-local`) sends the wrong `x-tenant-id` and API returns `500 internal_error`.

`createTourAction` **must** call `resolveRequestBootstrapAppSession()` (host + signed session cookie), not bare `resolveBootstrapAppSession()`. The env-only bootstrap (`dev-tenant-local` / `default` workspace) makes `POST /tours` return `500 internal_error` even when the operator UI shows the correct Denali tenant from layout bootstrap.

| Layer                             | Responsibility                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `parseTourApiErrorBody`           | Split API `code` vs human `error` message                                          |
| `parsePlatformValidationMessage`  | Turn `CANONICAL_VALIDATION_FAILED: …` into field segments                          |
| `resolveWizardSubmitErrorMessage` | Map segments → `wizard.submit.*` / `host.validation.codes.*` + Denali field labels |
| `WizardSubmitErrorAlert`          | Summary + bullet list under create/save footer                                     |

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
