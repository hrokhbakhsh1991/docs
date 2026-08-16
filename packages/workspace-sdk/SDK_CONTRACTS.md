# SDK Contracts — `@app-tour/workspace-sdk`

**Source of truth for workspace authors.** This document describes every public export, manifest hook, and hook I/O contract defined by `@app-tour/workspace-sdk`. Types are taken from `src/public-api.ts`, `src/index.ts`, and subpath barrels as of package version `0.1.0`.

> **Regenerate awareness:** Several capability maps (`WORKSPACE_*`) are auto-generated from `workspace.manifest.json` via `pnpm run generate:workspace-registry`. Edit the manifest in your workspace package, not the generated SDK files.

---

## Table of contents

1. [Package entry points](#1-package-entry-points)
2. [Core contract: `WorkspacePlugin`](#2-core-contract-workspaceplugin)
3. [Manifest hooks — function I/O reference](#3-manifest-hooks--function-io-reference)
4. [Supporting types and surfaces](#4-supporting-types-and-surfaces)
5. [Platform resolver functions](#5-platform-resolver-functions)
6. [Ingress, validation, and persistence](#6-ingress-validation-and-persistence)
7. [Subpath exports](#7-subpath-exports)
8. [Missing / poorly typed exports](#8-missing--poorly-typed-exports)

---

## 1. Package entry points

| Import | Purpose |
|--------|---------|
| `@app-tour/workspace-sdk` | Root barrel — plugin contract, catalog, portal, theme, auth, ingress |
| `@app-tour/workspace-sdk/plugin` | `WorkspacePlugin` validation and lifecycle |
| `@app-tour/workspace-sdk/plugin-types` | Type-only re-exports for consumers |
| `@app-tour/workspace-sdk/workspace-registry` | Runtime manifest discovery (`WorkspaceRegistry`, `workspaceRegistry`) |
| `@app-tour/workspace-sdk/registry` | Field registry, rule set, field policy |
| `@app-tour/workspace-sdk/canonical` | `CanonicalDocument` helpers |
| `@app-tour/workspace-sdk/ingress` | Storage ingress parsers |
| `@app-tour/workspace-sdk/auth` | Tenant auth context and CASL ability builders |
| `@app-tour/workspace-sdk/auth/casl` | CASL-specific ability wiring |
| `@app-tour/workspace-sdk/theme` | Theme sealing and tenant branding |
| `@app-tour/workspace-sdk/metadata` | DB definition payload, commerce config, renderer IDs |

Root also exports `WORKSPACE_SDK_VERSION` (`1`) and tour client types (`TourClient`, `CreateTourPayload`, `UpdateTourPayload`, `buildTourAuthHeaders`).

---

## 2. Core contract: `WorkspacePlugin`

Every workspace package implements this interface. Platform code depends on it; business logic stays in `packages/workspaces/<id>/`.

```typescript
interface WorkspacePlugin {
  // ── Required (persisted in definition payload) ──
  readonly id: WorkspacePluginId;           // string, e.g. "denali"
  readonly version: number;
  readonly contractVersion: 1;               // bump SDK major on shape breaks
  readonly supportedWorkspaceTypes: readonly WorkspaceTypeId[];
  readonly fieldRegistry: WorkspaceFieldRegistry;
  readonly ruleSet: WorkspaceRuleSet;
  readonly wizard: WorkspaceWizardSurface;
  readonly validation: WorkspaceValidationHooks;  // runtime-only
  readonly lifecycle: WorkspaceLifecycleContract;

  // ── Optional surfaces ──
  readonly theme?: WorkspaceThemeContract;
  readonly registrationOps?: OperatorRegistrationOpsSurface;
  readonly operatorSettings?: OperatorSettingsSurface;
  readonly integrationSurface?: WorkspaceIntegrationSurface;
  readonly exposureSurface?: WorkspaceExposureSurface;
  readonly fieldPolicy?: WorkspaceFieldPolicyManifest;
  readonly tourList?: OperatorTourListSurface;
  readonly publicCatalog?: PublicCatalogSurface;
  readonly tourClone?: TourCloneHydrator;
  readonly wizardHost?: WorkspaceWizardHostHooks;
  /** Thin Shell Phase 4r — host-facing capability bag (additive). */
  readonly capabilities?: WorkspacePluginCapabilities;
  readonly draftTombstone?: WorkspaceDraftTombstoneBinding;
  readonly catalogIntake?: WorkspaceCatalogIntakeSurface;
}
```

### Required nested types

#### `WorkspaceWizardSurface`

| Field | Type | Semantics |
|-------|------|-----------|
| `wizardMode` | `"classic" \| "schema"` | Engine mode |
| `railId` | `string` | Wizard rail identifier |
| `roots` | `readonly string[]` | Top-level canonical roots |
| `inactiveFieldGroups` | `readonly string[]` | Groups hidden from wizard |
| `wizardCapacityStepRedundant` | `boolean` | Skip capacity step when redundant |

#### `WorkspaceLifecycleContract`

| Field | Type | Semantics |
|-------|------|-----------|
| `initialStatus` | `string` | Status on create |
| `publishStatus` | `string` | Status after publish |
| `allowedTransitions` | `readonly { from: string; to: string }[]` | Valid state machine edges |

Helpers: `isWorkspaceLifecycleTransitionAllowed(from, to, lifecycle)`, `isWorkspaceUnpublishTransitionAllowed(from, lifecycle)`.

#### `WorkspaceFieldRegistry` / `WorkspaceFieldRegistryEntry`

| Field | Type | Notes |
|-------|------|-------|
| `version` | `number` | Registry schema version |
| `fields` | `readonly WorkspaceFieldRegistryEntry[]` | |
| `id` | `string` | Stable field id |
| `canonicalPath` | `string` | Dot-path in canonical document |
| `stepId` | `string` | Wizard step |
| `kind` | `"text" \| "number" \| "date" \| "enum" \| "boolean" \| "composite"` | |
| `required` | `boolean` | |
| `groupSlug?` | `string` | |
| `tags?` | `readonly string[]` | |
| `adminLabel?` / `adminDescription?` | `string` | Operator UI |
| `group?` / `icon?` | `string` | Integration picker grouping |
| `enumOptions?` | `readonly string[]` | Required when `kind === "enum"` |

#### `WorkspaceRuleSet` / `WorkspaceRuleCell`

| Field | Type | Notes |
|-------|------|-------|
| `version` | `number` | |
| `matrixDimensions` | `readonly string[]` | e.g. `["category", "duration"]` |
| `cells` | `readonly WorkspaceRuleCell[]` | |
| `defaultCellId` | `string` | Fallback cell |
| `cellId` | `string` | |
| `dimensions` | `Readonly<Record<string, string>>` | Matrix coordinates |
| `priority?` | `number` | Higher wins on collision |
| `fieldOverrides` | `readonly { fieldId; hidden?; required? }[]` | |

### Runtime-only vs persisted

| Surface | In DB definition payload? | Attached after ingress? |
|---------|---------------------------|-------------------------|
| `fieldRegistry`, `ruleSet`, `wizard`, `lifecycle` | Yes | — |
| `validation` | **No** | Yes (`noopWorkspaceValidationHooks` or real hooks) |
| `wizardHost`, `capabilities`, `tourClone`, `publicCatalog`, `catalogIntake`, `draftTombstone` | **No** | Yes (package plugin factory) |

#### `WorkspaceWizardHostHooks.ensureReady` (Thin Shell Phase 2a)

Optional async warm hook. Shell calls `await ensureWizardHostReady(plugin)` (Phase 4r), which resolves `plugin.capabilities?.wizardHost ?? plugin.wizardHost` then `ensureReady`, so workspace-owned host adapters are ready.

**Ownership:** Denali implements `ensureReady` inside `denaliWizardHostHooks` (`packages/workspaces/denali/src/wizard/denali-wizard-host-hooks.ts`) by dynamically importing host adapter modules (string-keyed specs so wizard `tsc` does not pull `src/ui`). Starter/Urban may omit the hook.

**Shell (Phase 2b–2d / 4br):** `warmOperatorWizardShell` awaits `ensureReady` only. Workspace `ensureReady` publishes host-adapter surface on `app-cloud.wizardHostAdapterSurface`. Shell `wizard-host-adapter-registry` owns sync + Prefetch resolve. Phase 2d: `workspace-host-adapters.generated.ts` **deleted**; rules-not-ready wire code is neutral `WIZARD_RULES_NOT_READY`. Phase **4br:** host-adapter global is a **`Map<pluginId, surface>`**. Phase **4bt:** sync helpers require `pluginId` as first argument; `app-cloud.wizardHostAdapterActivePluginId` removed (no ambient active-id / sole-entry fallback). Prefer `resolveWizardCatalogPrefetchProvider(pluginId)` when session id is in hand. Phase 3a: draft-shell operator APIs take `pluginId` (no `DENALI_PLUGIN_ID` closure). Phase 3b: shell imports host-adapter helpers from `wizard-host-adapter-registry` only (`host-adapter-runtime` deleted). Phase 3c: settings-hub required module ids live on Denali settings manifest / fallback-modules; shell binder dynamic-imports only (no `denali-required-settings-modules.generated.ts` under `apps/web`). Phase 3d: delete `draft-shell-runtime` / `wizard-chrome-runtime`; draft via `wizard-draft-shell`; chrome via generated binders. Phase 3e: Wave 5a architecture lock + in-memory `generateWebLoaders` acme admission without hand-written `apps/web` edits. Phase 4a: delete empty shell `workspace-wizard-composite-registry-bindings.generated.ts` (Denali package owns composite map). Phase 4b: manifest `wizardCreate.extendedChrome` consumed via generated `isWizardExtendedCreatePlugin` + shell `isExtendedOperatorWorkspace` (no public Set fan-out). Phase 4c: same for finance nav — private Set + `isFinanceNavPlugin` / `shouldShowFinanceNav` (manifest `workspaceFinance.supported`). Phase 4d: booking/finance ops binders expose `has*OpsManifest` + resolve only (no public PLUGIN_IDS / BINDINGS exports). Phase 4e: privatize operator-shell nav + custom brand fallback maps behind resolve helpers. Phase 4f: privatize wizard media BFF/backend path maps behind lookup helpers. Phase 4g: privatize `WORKSPACE_WIZARD_TEMPLATE_GATE_DEFAULT_STEP_ID`; public API remains `resolveWizardTemplateGateDefaultPublishedStepId`. Phase 4h: privatize `WORKSPACE_ADMIN_THEME_REGISTRY`; public `resolveAdminThemeStylesheets` / `listAdminThemeRegistryPluginIds` (+ `importAdminThemeForPlugin`). Phase 4i: privatize `WORKSPACE_WIZARD_I18N_NAMESPACES`; public type + `isWorkspaceWizardI18nNamespace` / `listWorkspaceWizardI18nNamespaces`. Phase 4j: create/flat-edit chrome binders export Operator-named wrappers/types only (collapse B.20 Denali aliases). Phase 4k: flat-edit form binder Operator stub types + `resolveOperatorFlatEditTestIds` only. Phase 4l: template-preset binder uses manifest loader map (no `pluginId ===` hard switch). Phase 4m: Denali `getWorkspacePlugin` is the manifest loader export; generated web loaders must not call `getDenaliWorkspacePlugin`. Phase 4n: `workspace:create` emits canonical `getWorkspacePlugin` for new workspace manifests/loaders. Phase 4o: trunk `packages/workspaces/acme` admitted by registry generate without hand-written `apps/web` edits. Phase 4p: trunk products (urban/starter/guest-club/booking-ws2/finance-ws5) use canonical `getWorkspacePlugin` as manifest loader export. Phase 4q: architecture purity specs + trunk `loadBootstrapWorkspacePlugin("acme")` smoke. Phase 4r: optional `plugin.capabilities.wizardHost` + `resolveWizardHostCapability` / `ensureWizardHostReady`; shell prefers capabilities over top-level `wizardHost`. Phase 4s: `capabilities.hostProbe` + `resolveHostProbeCapability`; acme publishes stub; generic `/workspace-host-probe` route. Phase 4t: hand-written shell wizard call sites must use `resolveWizardHostCapability` (no bare `plugin.wizardHost`). Phase 4u: shell must not invent product matrix coords (e.g. mountain); use plugin hooks / ruleSet.defaultCell. Phase 4v: `capabilities.draftShell` identity slice + `resolveDraftShellCapability`; shell prefers it when plugin is in hand. Phase 4w: draftShell adds `isFreshStartEnvelope` + `resolveDraftMerge`. Phase 4x: shell prefers draftShell keys for create/edit remote draft identity when plugin is loaded. Phase 4y: draftShell may publish `buildCreatePrefilledForm` (package draft-owned; shell `buildCreatePrefilledFormForPlugin` prefers capability). Phase 4z: draftShell may publish `createDraftSchemaGate` (package draft-owned; shell `createDraftSchemaGateForPlugin` prefers capability). Phase 4aa: draftShell may publish `isDraftEssentiallyEmpty` (package wizard-owned; shell `isDraftEssentiallyEmptyForPlugin` prefers capability). Phase 4ab: `capabilities.createChrome.ensureReady` publishes create-chrome surface on `app-cloud.wizardCreateChromeSurface` (string-keyed dynamic import; shell registry + warm prefer capability). Phase 4ac: `capabilities.flatEditChrome.ensureReady` publishes on `app-cloud.wizardFlatEditChromeSurface` (same pattern). Phase 4ad: `capabilities.createView.ensureReady` publishes on `app-cloud.wizardCreateViewSurface` (same pattern). Phase 4ae: `capabilities.flatEditForm.ensureReady` publishes on `app-cloud.wizardFlatEditFormSurface` (same pattern). Phase 4af: `capabilities.flatEditPage.ensureReady` publishes on `app-cloud.wizardFlatEditPageSurface` (same pattern).

**Clone:** use `plugin.tourClone != null` (not shell `CREATE_TOUR_SUPPORTS_CLONE`).

| `theme` (full contract) | Partial (`tokens` only in payload) | Yes |
| `registrationOps`, `operatorSettings`, etc. | **No** | Yes |

`stripWorkspacePluginToDefinitionPayload(plugin)` returns only the persisted slice.

---

## 3. Manifest hooks — function I/O reference

### 3.1 `catalogIntake` — `WorkspaceCatalogIntakeSurface`

**Plugin property:** `plugin.catalogIntake`  
**Also registered at runtime:** `registerWorkspaceIntakePlugin({ id, catalogIntake })` for portal BFF resolution.

| Hook | Input | Output | Contract |
|------|-------|--------|----------|
| `registrationApiPath` | — | `string` | BFF/API path for registration POST |
| `schema` | — | `IntakeSchema` | Default static field list |
| `resolveEffectiveSchema` | `IntakeSchemaContext` | `IntakeSchema` | Session-aware field visibility |
| `resolveSubmitValues` | `{ context, formValues: Record<string, string> }` | `Record<string, string>` | Merge session fallbacks into submit map |
| `buildUpstreamRequest` | `CatalogRegistrationPortalPayload`, `{ idempotencyKey? }?` | `CatalogRegistrationUpstreamRequest` | Portal → API wire format |
| `transport?` | See [3.1a](#31a-catalogintaketransport--workspacecatalogintaketransportsurface) | | Optional transport intake helpers |

#### `IntakeSchema` / `IntakeSchemaContext`

```typescript
type IntakeSchema = {
  readonly fields: readonly IntakeField[];
  readonly features: IntakeSchemaFeatures;
};

type IntakeField = {
  readonly id: string;
  readonly type: "text" | "date" | "email" | "number" | "boolean";
  readonly required: boolean;
  readonly labelKey: string;          // next-intl key under catalogRegistration
  readonly rules?: { pattern?; minLength?; maxLength? };
  readonly widget?: "numeric-text" | "localized-digits";
};

type IntakeSchemaFeatures = {
  readonly registrantTargetTabs: boolean;
  readonly transportIntake: boolean;
  readonly notesAtIntake: boolean;
  readonly idempotencyKey: boolean;
  /** Portal catalog POST requires member Bearer (Denali). */
  readonly requiresMemberSession?: boolean;
  /** Enables GET `{registrationApiPath}/for-tour/:tourId` self gate. */
  readonly selfRegistrationGate?: boolean;
  /** Enables member PATCH `{registrationApiPath}/:id` pending intake amend. */
  readonly memberPendingIntakeAmend?: boolean;
  readonly successDataAttributes?: Record<string, boolean>;
};

type IntakeSchemaContext = {
  readonly registrantTarget: "self" | "other";
  readonly session: {
    fullName?; nationalId?; fatherName?; birthDate?; email?;
  };
  readonly tourRequirements?: {
    nationalIdRequired?; fatherNameRequired?; birthDateRequired?;
  };
};
```

#### `CatalogRegistrationPortalPayload` → `CatalogRegistrationUpstreamRequest`

```typescript
type CatalogRegistrationPortalPayload = {
  readonly tourId: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly partySize: number;
  readonly notes: string;
  readonly nationalId: string;
  readonly fatherName: string;
  readonly birthDate: string;
  readonly registrantTarget?: "self" | "other";
  readonly transport?: unknown;   // ⚠ poorly typed — see §8
};

type CatalogRegistrationUpstreamRequest = {
  readonly path: string;
  readonly body: unknown;           // ⚠ poorly typed — see §8
  readonly extraHeaders?: Record<string, string>;
};
```

#### 3.1a `catalogIntake.transport` — `WorkspaceCatalogIntakeTransportSurface`

| Hook | Input | Output |
|------|-------|--------|
| `initialState` | `PublicCatalogTransportSnapshot \| undefined` | `PublicCatalogTransportIntakeState` |
| `showPersonalCarOptIn` | transport snapshot | `boolean` |
| `showTransportFollowUp` | snapshot + state | `boolean` |
| `buildPayload` | snapshot + state | `{ kind: PublicCatalogRegistrationTransportKind; personalCarOccupants?: 1\|2\|3 } \| undefined` |
| `isComplete` | snapshot + state | `boolean` |
| `computePricePerPerson` | `{ basePrice, transport, transportKind }` | `number \| null` |

Transport kinds: `"primary" | "personal_car" | "no_car_dong" | "no_car_acquaintance"`.

---

### 3.2 `catalogRegistrationFlow` — `WorkspaceCatalogRegistrationFlowSurface`

**Not on `WorkspacePlugin` directly.** Declared in `workspace.manifest.json` → codegen; implemented in workspace package and registered via `registerWorkspaceRegistrationFlowPlugin({ id, catalogRegistrationFlow })`.

Use `defineCatalogRegistrationFlowSurface(input)` to inject canonical `createInitialState`.

| Hook | Input | Output | Required? |
|------|-------|--------|-----------|
| `definition` | — | `IntakeFlowDefinition` | Yes |
| `createInitialState` | `RegistrationFlowContext` | `FlowRuntimeState` | Yes (injected by helper) |
| `resolveNextStep` | `state`, `FlowEvent`, `context` | `FlowRuntimeState` | Yes |
| `validateStep` | `stepId`, `state`, `context` | `readonly FlowValidationIssue[]` | Optional |
| `submitTransform` | `state`, `context` | `FlowSubmitPayload` | Optional |
| `successDataAttributes` | `state`, `context` | `Record<string, boolean>` | Optional |

#### Flow types

```typescript
type RegistrationFlowContext = {
  readonly pluginId: string;
  readonly tenantId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly tourPoliciesText?: string | null;
  readonly tourPriceAmount?: number | null;
  readonly tourTransport?: PublicCatalogTransportSnapshot;
  readonly tourRequirements?: RegistrationFlowTourRequirements;
  readonly backHref: string;
  readonly memberModuleHref: string | null;  // GSH-resolved — use for done steps
  readonly memberLoginEgress?: boolean;  // SSR-stable — portal login host / modal (PCMS-UX-HYDRATE)
  readonly memberLoginStayOnPage?: boolean; // register-host modal: probe cookie then callback (PCMS-UX-MODAL-03)
  readonly onMemberLoginSessionReady?: () => void | Promise<void>;
};

type IntakeFlowDefinition = {
  readonly initialStep: string;
  readonly steps: readonly string[];
};

type FlowRuntimeState = {
  readonly currentStep: string;
  readonly data: CatalogRegistrationFlowState;  // from @app-tour/catalog-registration-auth
};

type FlowEvent =
  | { type: "transition"; to: string }
  | { type: "merge"; patch: Partial<CatalogRegistrationFlowState> };

type FlowValidationIssue = { readonly stepId: string; readonly code: string };
type FlowSubmitPayload = Readonly<Record<string, unknown>>;  // ⚠ see §8
```

Platform reducers (do not reimplement): `mergeFlowState`, `transitionFlowStep`, `applyCatalogRegistrationFlowEvent`.

---

### 3.3 `validation` — `WorkspaceValidationHooks`

Runtime-only. Stripped from storage ingress.

| Hook | Input | Output |
|------|-------|--------|
| `checkCapacity` | `capacity: number` | `WorkspaceViolation \| null` |
| `checkTripDetails` | `tripDetails: unknown`, `transportModes?: readonly string[] \| null` | `WorkspaceViolation \| null` |

```typescript
type WorkspaceViolation = { readonly code: string; readonly message: string };
```

Default: `noopWorkspaceValidationHooks` / `createNoopWorkspaceValidationHooks()`.

---

### 3.4 `publicCatalog` — `PublicCatalogSurface`

| Hook | Input | Output |
|------|-------|--------|
| `isPublished` | `CanonicalDocument` | `boolean` |
| `toCatalogCard` | `PublicCatalogTourInput` | `PublicCatalogCard` |

```typescript
type PublicCatalogTourInput = {
  readonly id: string;
  readonly canonical: CanonicalDocument;
  readonly catalogUpdatedAt?: string | null;
};
```

`PublicCatalogCard` is the egress-safe marketing DTO (id, title, pricing, itinerary, transport, SEO fields, etc.). See `src/tour/public-catalog.contract.ts` for the full field list.

---

### 3.5 `tourList` — `OperatorTourListSurface`

| Hook | Input | Output |
|------|-------|--------|
| `extractTourListProjection` | `CanonicalDocument` | `TourListProjectionFields` |

```typescript
type TourListProjectionFields = {
  readonly title: string;
  readonly shortDescription: string | null;
  readonly listStatus: TourListStatus;   // draft|open|published|closed|cancelled|archived
  readonly uiStatus: TourUiStatus;       // draft|active|archived
  readonly priceAmount: number | null;
  readonly priceCurrency: string | null;
  readonly totalCapacity: number | null;
  readonly acceptedCount: number;
  readonly category: string | null;
  readonly coverImageUrl: string | null;
  readonly coverImageStorageKey: string | null;
  readonly departureAt: string | null;
};
```

Helper: `buildTourListProjection(rowMeta, canonical, extract)`.

---

### 3.6 `tourClone` — `TourCloneHydrator`

| Hook | Input | Output |
|------|-------|--------|
| `hydrateWizardDraft` | `TourCloneHydrationInput` | `TourCloneHydrationResult` |
| `prepareServerCloneCreateData?` | `TourCloneHydrationInput` | `TourCloneHydrationResult` |

```typescript
type TourCloneHydrationInput = {
  readonly canonicalData: Record<string, unknown>;
  readonly activeEquipmentIds?: readonly string[];
  readonly activeDestinationIds?: readonly string[];
  readonly wizardSessionId?: string;
  readonly tenantId?: string;
};

type TourCloneHydrationResult = {
  readonly data: Record<string, unknown>;
  readonly photoRemintPlan?: readonly WizardPhotoRemintPlanEntry[];
};

type WizardPhotoRemintPlanEntry = {
  readonly sourceStorageKey: string;
  readonly destStorageKey: string;
  readonly oldPhotoId: string;
  readonly newPhotoId: string;
  readonly contentType?: string;
};
```

---

### 3.7 `draftTombstone` — `WorkspaceDraftTombstoneBinding`

| Hook | Input | Output |
|------|-------|--------|
| `resolveTombstoneRoots` | `baselineForm`, `incomingForm` (top-level records) | `readonly string[]` |

Helpers: `topLevelRootsRemoved(baseline, incoming, roots)`, `isNonEmptyRootValue(value)`, `noopWorkspaceDraftTombstoneBinding`.

---


### 3.8-pre `capabilities` — `WorkspacePluginCapabilities` (Thin Shell Phase 4r)

Host-facing capability bag. **Optional** and additive: do not remove top-level `wizardHost` in this phase.

| Property | Type | Notes |
|----------|------|-------|
| `wizardHost?` | `WorkspaceWizardHostHooks` | First migrated surface; same type as top-level `wizardHost` |
| `hostProbe?` | `WorkspaceHostProbeCapability` | Phase 4s — data-only Next boot stub (`title` / `body`) |
| `draftShell?` | `WorkspaceDraftShellCapability` | Phase 4v–4aa / 4al–4am — identity + session id + fresh-start/merge + create prefill + schema-gate + empty-draft check + field-read/tombstone-shadow log; Phase 4al/4am deleted draft-shell + draft-unification binders |
| `createChrome?` | `WorkspaceCreateChromeCapability` | Phase 4ab — package-owned `ensureReady` publishes create-chrome surface (no React on frozen plugin) |
| `flatEditChrome?` | `WorkspaceFlatEditChromeCapability` | Phase 4ac — package-owned `ensureReady` publishes flat-edit chrome surface (no React on frozen plugin) |
| `createView?` | `WorkspaceCreateViewCapability` | Phase 4ad — package-owned `ensureReady` publishes create-view surface (no React on frozen plugin) |
| `flatEditForm?` | `WorkspaceFlatEditFormCapability` | Phase 4ae — package-owned `ensureReady` publishes flat-edit form surface (no React on frozen plugin) |
| `flatEditPage?` | `WorkspaceFlatEditPageCapability` | Phase 4af — package-owned `ensureReady` publishes flat-edit page surface (no React on frozen plugin) |
| `templateGate?` | `WorkspaceTemplateGateCapability` | Phase 4an — default published step id + optional prefill/augment helpers (no React; binder deleted) |
| `templatePreset?` | `WorkspaceTemplatePresetCapability` | Phase 4au — pure `buildFullTemplatePreset` (no React; binder deleted) |
| `settingsHubFallback?` | `WorkspaceSettingsHubFallbackCapability` | Phase 4av — pure required-module ids + fallback module map (no React; binder deleted) |
| `templateEditor?` | `WorkspaceTemplateEditorCapability` | Phase 4aw — pure wizard-template editor surface (no React; binder deleted) |
| `tourListCategory?` | `WorkspaceTourListCategoryCapability` | Phase 4ax — pure tour-list category/filter surface (no React; binder deleted) |
| `settingsDestination?` | `WorkspaceSettingsDestinationCapability` | Phase 4az — pure destination settings surface (no React; binder deleted) |
| `settingsEquipmentUi?` | `WorkspaceSettingsEquipmentUiCapability` | Phase 4ba — package-owned `ensureReady` publishes equipment settings UI (no React on frozen plugin; binder deleted) |
| `settingsExposureSurfacesUi?` | `WorkspaceSettingsExposureSurfacesUiCapability` | Phase 4bb — package-owned `ensureReady` publishes exposure surfaces panel UI (no React on frozen plugin; binder deleted) |
| `operatorShellNav?` | `WorkspaceOperatorShellNavCapability` | Phase 4bc — pure Phase 3 AppShell nav links (no React; binder deleted) |
| `financeNav?` | `WorkspaceFinanceNavCapability` | Phase 4bd — pure finance hub enablement (`supported`; no React; binder deleted) |
| `financeOps?` | `WorkspaceFinanceOpsCapability` | Phase 4be — pure `resolveManifest(theme?)` for ops panels (no React; binder deleted) |
| `bookingOps?` | `WorkspaceBookingOpsCapability` | Phase 4bf — pure `resolveManifest(theme?)` → `RegistrationOpsManifest` (no React; binder deleted) |
| `wizardCreate?` | `WorkspaceWizardCreateCapability` | Phase 4bg — `{ extendedChrome: true; customBrandFallbackMark?: string }` (no React; binder deleted; warm+seed) |
| `operatorUi?` | `WorkspaceOperatorUiCapability` | Phase 4ao — package-owned `ensureReady` publishes operator UI surface (no React on frozen plugin; binder deleted) |
| `tourActionSubmit?` | `WorkspaceTourActionSubmitCapability` | Phase 4ap — pure encode/decode for submit error wire tokens (no React; binder deleted) |
| `labels?` | `WorkspaceLabelsCapability` | Phase 4aq — package-owned `ensureReady` publishes label resolver (no React on frozen plugin; binder deleted) |
| `wizardSurfaces?` | `WorkspaceWizardSurfacesCapability` | Phase 4as — package-owned `ensureReady` publishes composite + review surfaces (no React on frozen plugin; binder deleted) |

**Resolve rule:** `resolveWizardHostCapability(plugin)` → `plugin.capabilities?.wizardHost ?? plugin.wizardHost`.  
**Warm rule:** `ensureWizardHostReady(plugin)` awaits that slice’s `ensureReady` when present.

**Host probe (Phase 4s):** `resolveHostProbeCapability(plugin)` → `plugin.capabilities?.hostProbe`. Shell route `/workspace-host-probe?pluginId=` loads the plugin and renders title/body; missing `pluginId` or missing capability fails closed (no product defaults).

**Create chrome (Phase 4ab / 4ag / 4bl):** `resolveCreateChromeCapability(plugin)` → `plugin.capabilities?.createChrome`. Capability exposes only `ensureReady` (no React on the frozen plugin). Package `ensureReady` publishes surface on product-blind `app-cloud.wizardCreateChromeSurface` via string-keyed dynamic import; shell registry peeks that key. Phase 4ag: generated create-chrome binder **deleted**; warm + hook are capability/registry-only (cold hook fails closed). Phase **4bl:** the create-chrome global is a **`Map<pluginId, surface>`** (not a singleton overwrite); shell `useOperatorCreateTourWizardCore` peeks by `session.pluginId`.

### Pattern B registry keying (Phase 4bl)

Pattern B = capability exposes only `ensureReady`; package publishes React/UI on a product-blind `globalThis` key; shell registry peeks.

| Rule | Detail |
| --- | --- |
| **Preferred** | `globalThis[KEY] = Map<pluginId, Surface>`; publish/peek with **`plugin.id`** (workspace packages use identity constants e.g. `DENALI_WORKSPACE_PLUGIN_ID`) |
| **Forbidden (new work)** | Singleton overwrite of `globalThis[KEY] = Surface` without a plugin id |
| **Closed debt** | Pattern B **singleton** debt closed in 4bs; host-adapter **active-pluginId** debt closed in 4bt (sync helpers take `pluginId`). Inventory: `apps/web/test/thin-shell-pattern-b-registry.spec.ts` |
| **Already Map** | labels, wizardSurfaces (composite/review), wizardCreate membership, template editor (where applicable) |

**Flat-edit chrome (Phase 4ac / 4ag warm / 4ah / 4bm):** `resolveFlatEditChromeCapability(plugin)` → `plugin.capabilities?.flatEditChrome`. Same pattern on `app-cloud.wizardFlatEditChromeSurface`; shell registry peeks for `useFlatEditPageCore` / submit-catalog loader. Phase 4ah: generated flat-edit chrome binder **deleted**; hook + catalog loader are registry-only (cold fails closed). Phase **4bm:** global is a **`Map<pluginId, surface>`**; shell peeks by `plugin.id` (submit-catalog bound at call site).

**Create view (Phase 4ad / 4ag warm / 4ak / 4bn):** `resolveCreateViewCapability(plugin)` → `plugin.capabilities?.createView`. Same pattern on `app-cloud.wizardCreateViewSurface`; shell registry peeks for `CreateTourWizardView`. Phase 4ak: generated create-view binder **deleted**; resolve is registry-only. Phase **4bn:** global is a **`Map<pluginId, surface>`**; `resolveWizardCreateViewSurface(pluginId)` peeks by id.

**Flat-edit form (Phase 4ae / 4ag warm / 4ai / 4bo):** `resolveFlatEditFormCapability(plugin)` → `plugin.capabilities?.flatEditForm`. Same pattern on `app-cloud.wizardFlatEditFormSurface`; shell registry peeks for `FlatEditForm` / `testIds`. Phase 4ai: generated flat-edit form binder **deleted**; resolve helpers are registry-only. Phase **4bo:** global is a **`Map<pluginId, surface>`**; resolve/testIds peek by pluginId.

**Flat-edit page (Phase 4af / 4ag warm / 4aj / 4bp):** `resolveFlatEditPageCapability(plugin)` → `plugin.capabilities?.flatEditPage`. Same pattern on `app-cloud.wizardFlatEditPageSurface`; shell registry peeks for `FlatEditPageView` / `FlatEditValidationList`. Phase 4aj: generated flat-edit page binder **deleted**; resolve is registry-only. Phase **4bp:** global is a **`Map<pluginId, surface>`**; `resolveWizardFlatEditPageSurface(pluginId)` peeks by id.

**Template gate (Phase 4an):** `resolveTemplateGateCapability(plugin)` → `plugin.capabilities?.templateGate`. Capability exposes `defaultPublishedStepId` plus optional `preferTemplateDefaultsOnPrefill` and pure `augmentFieldOverlays` (no React). Shell helpers prefer capability when plugin in hand; absent capability ⇒ product-blind `"basics"` / no-op augment. Generated template-gate binder **deleted**.

**Operator UI (Phase 4ao / 4bq):** `resolveOperatorUiCapability(plugin)` → `plugin.capabilities?.operatorUi`. Capability exposes only `ensureReady` (no React on the frozen plugin). Package `ensureReady` publishes surface on product-blind `app-cloud.operatorUiComponentsSurface` via string-keyed dynamic import; shell registry peeks for TimeInput / WizardDatetimePicker / map helpers / leaflet icon. Phase 4ao: generated operator-ui binder **deleted**; warm + shell helpers are capability/registry-only. Phase **4bq:** global is a **`Map<pluginId, surface>`**; ensure/resolve/peek keyed by pluginId.

**Tour action submit codec (Phase 4ap):** `resolveTourActionSubmitCapability(plugin)` → `plugin.capabilities?.tourActionSubmit`. Capability exposes pure `encode` / `decode` (no React). Shell `encodeTourActionSubmitErrorForPlugin(plugin, payload)` prefers capability; `decodeTourActionSubmitError(raw, plugin?)` prefers capability then product-blind `TOUR_ACTION_ERROR:` platform fallback. Generated tour-action-submit binder **deleted** (no warm cache).

**Labels (Phase 4aq):** `resolveLabelsCapability(plugin)` → `plugin.capabilities?.labels`. Capability exposes only `ensureReady` (no React on the frozen plugin). Package `ensureReady` publishes `WizardLabelResolver` on product-blind `app-cloud.wizardLabelResolverCache` (keyed by surface/plugin id) via string-keyed dynamic import; shell registry peeks. Phase 4aq: generated `wizard-label-bindings` **deleted**; i18n namespace helpers live on `wizard-i18n-translator-hooks.generated.ts`.

**Wizard surfaces (Phase 4as):** `resolveWizardSurfacesCapability(plugin)` → `plugin.capabilities?.wizardSurfaces`. Capability exposes only `ensureReady`. Package publishes composite + review factories on product-blind caches; shell registry peeks and keeps shell-local `platform` surfaces eager. Generated `wizard-surface-bindings` **deleted**.

**Wizard rules web binder (Phase 4at):** orphaned `workspace-wizard-rules-bindings.generated.ts` **deleted**. Shell runtime already uses `WorkspaceWizardHostHooks.loadRulesModule` (no separate web capability required this slice). API `apiWizardRules` codegen binder remains until a dedicated API capability phase.

**Template preset (Phase 4au):** `resolveTemplatePresetCapability(plugin)` → `plugin.capabilities?.templatePreset`. Capability exposes pure `buildFullTemplatePreset(seedLabel?)` (no React, no warm cache; return typed as `unknown` at the SDK boundary). Shell helper loads the plugin and awaits the capability; absent capability ⇒ fail-closed. Generated template-preset binder **deleted**.

**Settings hub fallback (Phase 4av):** `resolveSettingsHubFallbackCapability(plugin)` → `plugin.capabilities?.settingsHubFallback`. Capability exposes pure `requiredModuleIds` + `fallbackModules` (SDK `SettingsModuleManifest` shape; no React). Shell registry loads plugin, peeks capability into a product-blind warm cache for sync `resolveSettingsHubFallbackPolicy`. Generated settings-hub-fallback binder **deleted**.

**Template editor (Phase 4aw):** `resolveTemplateEditorCapability(plugin)` → `plugin.capabilities?.templateEditor`. Capability is the pure editor surface (`messageNamespace`, `photosStepId`, catalog/meta helpers, frozen-path + normalize). Shell registry loads plugin and caches the capability for sync resolve. Generated template-editor binder **deleted**.

**Tour list category (Phase 4ax):** `resolveTourListCategoryCapability(plugin)` → `plugin.capabilities?.tourListCategory`. Capability is the pure category/filter surface (`tourKindValues`, `filterGroups`, predicates, duration resolve). Shell registry loads plugin and caches for sync resolve. Generated tour-list-category binder **deleted**.

**Photo upload errors web binder (Phase 4ay):** orphaned `workspace-photo-upload-errors-bindings.generated.ts` **deleted** (no production shell consumers). Package `denaliPhotoUploadErrorsSurface` remains the codec SOT; an SDK capability slot is deferred until a shell call site needs it.

**Settings destination (Phase 4az):** `resolveSettingsDestinationCapability(plugin)` → `plugin.capabilities?.settingsDestination`. Capability is the pure destination settings surface (`locationTypes`, `normalizeLocationType`, `metadataFieldsForType`). Shell registry loads plugin and caches for sync resolve. Generated settings-destination binder **deleted**.

**Settings equipment UI (Phase 4ba / 4bs):** `resolveSettingsEquipmentUiCapability(plugin)` → `plugin.capabilities?.settingsEquipmentUi`. Capability exposes only `ensureReady` (no React on the frozen plugin). Package `ensureReady` publishes `EquipmentCatalogAvatar` / `EquipmentIconPicker` on product-blind `app-cloud.settingsEquipmentUiSurface` via string-keyed dynamic import; shell registry peeks. Generated settings-equipment-ui binder **deleted**. Phase **4bs:** global is a **`Map<pluginId, surface>`**.

**Settings exposure surfaces UI (Phase 4bb / 4bs):** `resolveSettingsExposureSurfacesUiCapability(plugin)` → `plugin.capabilities?.settingsExposureSurfacesUi`. Capability exposes only `ensureReady`. Package `ensureReady` publishes `WorkspaceSurfacesPanel` on product-blind `app-cloud.settingsExposureSurfacesUiSurface` via string-keyed dynamic import of the host binding barrel; shell registry peeks. Generated settings-exposure-surfaces-ui binder **deleted**. H1.d contract asserts registry + package surface (not generated binder). Phase **4bs:** global is a **`Map<pluginId, surface>`**.

**Operator shell nav (Phase 4bc):** `resolveOperatorShellNavCapability(plugin)` → `plugin.capabilities?.operatorShellNav`. Capability is pure `links` (`href` + `labelKey`). Shell registry loads plugin and caches links for sync resolve after ensure; AppShell warms on `pluginId`. Generated operator-shell-nav binder **deleted**.

**Finance nav (Phase 4bd):** `resolveFinanceNavCapability(plugin)` → `plugin.capabilities?.financeNav`. Capability is pure `{ supported: true }` (presence + flag). Shell registry warms via plugin load into a product-blind cache; sync `isFinanceNavPlugin` / `shouldShowFinanceNav` read the cache (callers must ensure first — operator layout, finance page, dashboard client). Generated finance-nav binder **deleted**.

**Finance ops (Phase 4be):** `resolveFinanceOpsCapability(plugin)` → `plugin.capabilities?.financeOps`. Capability exposes pure `resolveManifest(theme?)` (return typed `unknown` at the SDK boundary; shell casts to its ops panel contract). No generated host `import()` map — shell loads the plugin and invokes the capability (soft-null when omitted). Generated finance-ops binder **deleted**. See dual-SOT covenant in remediation charter.

**Booking ops (Phase 4bf):** `resolveBookingOpsCapability(plugin)` → `plugin.capabilities?.bookingOps`. Capability exposes pure `resolveManifest(theme?)` returning SDK `RegistrationOpsManifest`. Shell hub loads plugin and soft-nulls when omitted. Generated booking-ops binder **deleted**.

**Wizard create (Phase 4bg):** `resolveWizardCreateCapability(plugin)` → `plugin.capabilities?.wizardCreate`. Capability exposes `{ extendedChrome: true; customBrandFallbackMark?: string }` (mirrors former `wizardCreate.extendedChrome` / brand mark). Shell warm-cache registry: `ensureWizardCreate` (server layouts) + `seedWizardCreate` (client shells) → sync `isWizardExtendedCreatePlugin` / `resolveWizardCustomBrandFallbackMark`. Generated wizard-create binder **deleted**. Opaque media route tables retained (plan §2.4).

**Dual-SOT derivation spike (Phase 4bu):** Packaging↔capability inventory + derivation rules are locked in `docs/dev/thin-shell-dual-sot-derivation.mdoc` with consistency tests (`apps/web/test/thin-shell-dual-sot-derivation.spec.ts`). Capability-stub codegen and dropping redundant manifest keys remain deferred — dual-publish covenant still applies.

**Capability-bag consolidation map (Phase 4bv):** Fine-grained `WorkspacePluginCapabilities` (~25 slots) remains the live bag. Optional coarse folds (`tourCreation`/`settings`/`ops`/`navigation`) are sketched only in `docs/dev/thin-shell-capability-bag-consolidation.mdoc` — **no SDK type fold** until Architect YES.

**Package Operator naming (Phase 4bx):** Shell hand-written surfaces stay Operator / product-blind. Package `Denali*` export names inside `@app-cloud/workspace-denali` are an accepted product namespace; inventory + rename-wave rules live in `docs/dev/thin-shell-operator-naming-inventory.mdoc`. Big-bang rename is not thin-shell DoD.

**Wizard i18n (Phase 4bh):** Generated `wizard-i18n-translator-hooks` emits **opaque namespace allowlist** helpers only (`isWorkspaceWizardI18nNamespace` / `listWorkspaceWizardI18nNamespaces`). Hand-written `useWorkspaceWizardTranslator(ns?)` uses platform `useTranslations("wizard")` plus one dynamic `useTranslations(activeNs)` — never fan-out `useTranslations` across all product namespaces in generated code.

Absent capability ⇒ shell no-ops that surface on warm (or fails closed for required routes / cold create-chrome hooks). Additional slots (`tourCreation`, `settings`, …) land in later slices.

### 3.8 `wizardHost` — `WorkspaceWizardHostHooks`

Largest hook surface. Platform web host reads these instead of hardcoding plugin ids.

#### Configuration flags (no I/O)

| Property | Type | Purpose |
|----------|------|---------|
| `reviewStepId?` | `string` | Review step id |
| `showCompletionHeader?` | `boolean` | Quality header above stepper |
| `usesContextualFieldRules?` | `boolean` | Post-matrix contextual rules |
| `usesStepValidation?` | `boolean` | Block Next until valid |
| `usesReviewStep?` | `boolean` | Review chrome |
| `reviewFieldCanonicalPath?` | `string` | Field lifted onto review step |
| `hostRootDataAttributes?` | `Record<string, string>` | `data-*` on host root |
| `reviewSurfaceId?` | `string` | React registry key |
| `validationSurfaceId?` | `string` | Validation summary UI key |
| `compositeSurfaceId?` | `string` | Composite widget key |
| `wizardMessageNamespace?` | `string` | next-intl namespace |
| `fieldLabelSurfaceId?` | `string` | Label resolver key |
| `media?` | `WorkspaceWizardMediaHooks` | See [3.8a](#38a-wizardhostmedia--workspacewizardmediahooks) |

#### Function hooks

| Hook | Input | Output | Notes |
|------|-------|--------|-------|
| `loadRulesModule?` | — | `Promise<unknown>` | ⚠ opaque — **Phase 4at:** shell must use this hook; web `workspace-wizard-rules-bindings` deleted (orphaned). API still has a separate codegen binder until an API capability slice. |
| `resolveMatrixDimensionsFromDraft?` | `draft`, `rulesModule: unknown` | `Record<string, string>` | |
| `applyContextualFieldRules?` | `{ steps: unknown; draft; rulesModule; evalContext: unknown }` | `unknown` | ⚠ opaque |
| `prepareDraftEnvelope?` | `<TForm> form, meta` | `WorkspaceWizardDraftEnvelope<TForm>` | |
| `hydrateDraftEnvelope?` | `{ remote, fallbackForm, fallbackMeta? }` | `WorkspaceWizardDraftEnvelope<TForm>` | |
| `normalizeRemoteEnvelope?` | `envelope` | `envelope` | Strip server tombstones |
| `mergeDraftEnvelope?` | `local, server` | `envelope` | Conflict merge |
| `normalizeWizardTemplateGate?` | `WorkspaceWizardTemplateGateNormalizeInput` | `WorkspaceWizardTemplateGateNormalizeResult` | |
| `resolveInitialStepIndex?` | `{ draft; visibleSteps: unknown[]; savedStepIndex; skipFieldInference? }` | `number` | |
| `validateDraftSync?` | `{ plugin; draft; rulesModule; tenantId; evalContext?; scope? }` | `WizardDraftValidationResult` | |
| `validatePublishReadiness?` | `{ plugin; draft; rulesModule; evalContext; scope? }` | `WizardDraftValidationResult` | |
| `buildRuleEvalContext?` | `{ workspaceFormProfile?; mainThemeFormProfile?; fieldRulesOverlay? }` | `unknown` | ⚠ opaque |
| `sanitizeWizardDraft?` | `{ draft; rulesModule; evalContext }` | `Record<string, unknown>` | |
| `prepareSubmitPayload?` | `{ plugin; draft; rulesModule; evalContext; catalog? }` | `unknown` | ⚠ should be `CreateTourPayload` |
| `hydrateEditDraft?` | `{ canonicalData; activeEquipmentIds?; activeDestinationIds? }` | `Record<string, unknown>` | |
| `prepareTourPatchPayload?` | `{ plugin; draft; rulesModule; evalContext; rowVersion; patchIntent?; catalog? }` | `unknown` | ⚠ should be `UpdateTourPayload` |
| `filterEngineValidationResult?` | `result`, `data` | filtered `result` | |
| `normalizeCanonicalForPersist?` | `{ data; destinations?: readonly Record<string, unknown>[] }` | `Record<string, unknown>` | Optional persist rewrite (ED-PEAK-LOCK-01). API enrich on the main thread only; worker must not call settings. Hosts that omit the hook skip `listDestinations`. |

```typescript
type WizardDraftValidationResult = {
  readonly ok: boolean;
  readonly violations: readonly { code: string; fieldId?: string; message: string }[];
};

type WorkspaceWizardDraftEnvelope<TForm = unknown> = {
  readonly form: TForm;
  readonly meta: Readonly<Record<string, unknown>>;  // ⚠ workspace-owned semantics
};
```

#### 3.8a `wizardHost.media` — `WorkspaceWizardMediaHooks`

| Hook | Input | Output |
|------|-------|--------|
| `createAssetSessionId` | — | `string` (UUID v4) |
| `isAssetSessionId` | `value: string` | `boolean` |
| `mediaRouteKey` | — | `string` (BFF route key, e.g. `"wizard-photos"`) |

---

### 3.9 Manifest-declared surfaces (codegen maps)

These are **not** function hooks on the plugin object but manifest-driven capability tables regenerated into SDK:

| Manifest key | Generated constant | Resolver |
|--------------|-------------------|----------|
| `workspaceTypes` | `WORKSPACE_MANIFEST_BINDINGS` | `resolveWorkspacePluginIdForType` |
| `guestConformance` | `WORKSPACE_GUEST_CONFORMANCE_LEVELS` | `resolveGuestConformanceLevelForPlugin` |
| `guestLanding` | `WORKSPACE_GUEST_LANDING` | `resolveGuestLandingFeatures` — includes `whySectionAnchor`, `destinationSlugs`, `destinationImageStems`, and section gates |
| `guestSeo` | `WORKSPACE_GUEST_SEO` | `resolveGuestSeoForPlugin` |
| `catalogListFeatures` | `WORKSPACE_CATALOG_LIST_FEATURES` | `resolveCatalogListFeatures` |
| `catalogDetailSections` | `WORKSPACE_CATALOG_DETAIL_SECTIONS` | `resolveCatalogDetailSections` |
| `catalogPaths` | `WORKSPACE_CATALOG_LIST_PATHS` | `resolveCatalogListApiPath`, `resolveCatalogTourApiPath` |
| `productionTier` | `WORKSPACE_PRODUCTION_CERTIFICATION` | `resolveProductionCertificationForPlugin` |
| `operatorCapabilities` | `WORKSPACE_OPERATOR_CAPABILITIES` | `operatorCapabilitySupportsUsersDirectory`, etc. |
| `memberPortal` | `WORKSPACE_MEMBER_PORTAL_CONTRACTS` | `resolveMemberPortalContract` |
| `memberProfile` | `WORKSPACE_MEMBER_PROFILE_CAPABILITIES` | `resolveMemberProfileCapabilities` |
| `guestCrossSurfaceNav` | `WORKSPACE_GUEST_CROSS_SURFACE_NAV` | `resolveGuestCrossSurfaceNav` |

Conformance levels: `L0`–`L4`. Registration CTA requires **L2+** (`supportsCatalogRegistration`).

---

## 4. Supporting types and surfaces

### Theme — `WorkspaceThemeContract`

```typescript
type WorkspaceThemeContract = {
  readonly id: string;
  readonly version: number;
  readonly cssVariables: Readonly<Record<string, string>>;  // keys must be --ws-*
  readonly optionalStylesheet?: string;
};
```

Tenant overlay: `TenantThemeConfig`, `resolveEffectiveTenantBranding`, `isTenantBrandingEmpty`. Brand logo: `TenantBrandLogo`, `buildTenantBrandLogoObjectKey`, content-type sniffing helpers.

### Operator manifests

- **`OperatorRegistrationOpsSurface`**: `manifestVersion: 1`, `manifest: RegistrationOpsManifest` (views, KPIs, filters, columns, actions).
- **`OperatorSettingsSurface`**: `manifestVersion: 1`, `modules: SettingsModuleManifest[]`.
- **`WorkspaceIntegrationSurface`**: providers, config/credential field schemas, event mappings, optional `messageTemplates`.
- **`WorkspaceExposureSurface`**: audience/trigger field exposure definitions.

Validators: `validateRegistrationOpsManifest`, `validateSettingsManifest`, `validateIntegrationSurface`, `validateExposureSurface`.

### Member portal

```typescript
type MemberPortalSurface = {
  readonly manifestVersion: 1;
  readonly defaultPrimaryModuleId: string;
  readonly modules: readonly MemberModuleManifest[];
};

type MemberModuleManifest = {
  readonly id: string;           // must not be home|more|api|catalog
  readonly routePath: string;      // must start with /me/
  readonly nav: { tier: MemberNavTier; labelKey: string };
};
```

`MemberNavTier`: `"primary" | "secondary" | "hidden" | "user_menu"` (max 5 primary).

Entitlements: `evaluateMemberPortalEntitlements`, keys via `memberPortalEntitlementKey(moduleId)` → `"member.module.<id>"`.

### Field policy — `WorkspaceFieldPolicyManifest`

```typescript
type WorkspaceFieldPolicyManifest = {
  readonly manifestVersion: 1;
  readonly definitions: readonly WorkspaceFieldPolicyDefinition[];
  readonly rules: readonly WorkspaceFieldPolicyRule[];
};
```

Surfaces: `wizard | public_website | profile | admin_panel | delivery`. States: `hidden | visible | required | readonly`.

### Guest cross-surface nav

```typescript
type GuestCrossSurfaceNavLink = {
  readonly id: string;
  readonly labelKey: string;
  readonly surface: "marketing" | "portal_egress";
  readonly path?: string;              // marketing only
  readonly egress?: "member_module" | "marketing_home" | "marketing_tours";
  readonly memberModuleId?: string;    // required when egress=member_module
  readonly visibleWhen?: "always" | "club" | "platform_mother";
};
```

### Canonical document

```typescript
type CanonicalDocument = {
  readonly schemaVersion: number;
  readonly roots: readonly string[];
  readonly data: Readonly<Record<string, unknown>>;
};
```

### Commerce (metadata subpath)

`WorkspaceCommerceConfig` via `parseWorkspaceCommerceConfig` / `workspaceCommerceConfigSchema`. Payment modes and gateway providers are Zod-validated.

### Auth

```typescript
type TenantAuthContext = {
  readonly tenantId: string;
  readonly userId: string;
  readonly role: ActorRole;
  readonly status: MembershipStatus;
  readonly workspaceId: string;
};
```

`ActorRole`: platform roles. `buildTenantAuthz` / `createTenantAuthz` require optional peer `@casl/ability`.

### Tour client (root export)

```typescript
interface TourClient {
  createTour(payload: CreateTourPayload, auth: TourAuthHeaders): Promise<TourRecordDto>;
  getTour(id: string, auth: TourAuthHeaders): Promise<TourRecordDto | null>;
}
```

---

## 5. Platform resolver functions

Functions workspace authors **call** (not implement):

| Function | Returns | Throws |
|----------|---------|--------|
| `resolveIntakeSchema(pluginId)` | `IntakeSchema` | `IntakePluginNotRegisteredError` |
| `resolveEffectiveIntakeSchema(pluginId, context)` | `IntakeSchema` |同上 |
| `resolveIntakeSubmitValues({ pluginId, context, formValues })` | `Record<string, string>` |同上 |
| `validateIntakeSchemaValues(schema, values)` | `IntakeSchemaValidationIssue[]` | — |
| `buildCatalogRegistrationUpstreamRequest(pluginId, payload, options?)` | `CatalogRegistrationUpstreamRequest` |同上 |
| `resolveMemberPortalContract(pluginId)` | `MemberPortalContract` | — |
| `resolveMemberPortalModules(pluginId)` | `MemberPortalSurface` | `MemberPortalNotConfiguredError` |
| `resolveMemberProfileCapabilities(pluginId)` | `MemberProfileCapabilities` | `MemberProfileNotConfiguredError` |
| `resolveCatalogListFeatures(pluginId)` | `CatalogListFeatures` | `UnknownCatalogPresentationPluginError` |
| `resolveCatalogDetailSections(pluginId)` | `CatalogDetailSections` |同上 |
| `resolveGuestLandingFeatures(pluginId)` | `GuestLandingFeatures` | `UnknownGuestLandingPluginError` |
| `resolveGuestSeoForPlugin(pluginId)` | `WorkspaceGuestSeoConfig` | `GuestSeoNotConfiguredError` |
| `resolveGuestConformanceLevelForPlugin(pluginId)` | `WorkspaceGuestConformanceLevel` | `GuestConformanceNotConfiguredError` |
| `supportsCatalogRegistration(pluginId)` | `boolean` | — |
| `validateStructuredData(json)` | `StructuredDataValidationResult` | — |

---

## 6. Ingress, validation, and persistence

### Parse results

```typescript
type SdkResult<T, C extends string> =
  | { ok: true; value: T }
  | { ok: false; error: { code: C; message: string; path?; cause? } };
```

| API | Success | Error codes |
|-----|---------|-------------|
| `tryParseWorkspacePluginFromStorage(raw)` | `WorkspacePlugin` (functions stripped) | `WorkspacePluginIngressErrorCode` |
| `validateWorkspacePlugin(value)` | `WorkspacePlugin` | `WorkspaceSdkValidationErrorCode` |
| `tryParseCanonicalDocumentFromStorage(raw)` | `CanonicalDocument` | `CanonicalIngressErrorCode` |
| `tryParseTenantAuthContext(input)` | `TenantAuthContext` | `AuthContextErrorCode` |

Runtime hooks (`validation`, `wizardHost`, etc.) are **not** in stored JSON. Ingress attaches `noopWorkspaceValidationHooks` by default.

### `WorkspaceDefinitionPayload` (DB-persisted)

```typescript
type WorkspaceDefinitionPayload = Pick<WorkspacePlugin,
  "id" | "version" | "contractVersion" | "supportedWorkspaceTypes" |
  "fieldRegistry" | "ruleSet" | "wizard"
> & {
  readonly theme?: { readonly tokens?: Record<string, string> };
  readonly commerce?: WorkspaceCommerceConfig;
};
```

---

## 7. Subpath exports

Subpaths not re-exported from root (import explicitly):

| Subpath | Key exports |
|---------|-------------|
| `metadata` | `stripWorkspacePluginToDefinitionPayload`, `WorkspaceDefinitionPayload`, `parseWorkspaceCommerceConfig`, `assertAllowedPlatformRendererId` |
| `registry` | `validateWorkspaceFieldRegistry`, `assertWorkspaceFieldRegistry`, `getWorkspaceRuleCell` |
| `plugin-types` | Type-only: `WorkspacePlugin`, field registry, rule set, canonical |

---

## 8. Missing / poorly typed exports

These exports use `unknown`, open records, or stringly-typed ids where stricter contracts would help workspace authors. **No `any` types** were found in public `src/` surfaces; gaps are primarily `unknown` and unconstrained `Record<string, …>`.

### High impact (workspace implementers)

| Export / field | Current type | Gap | Recommended direction |
|----------------|--------------|-----|----------------------|
| `WorkspacePluginId` | `string` | No closed union of registered plugins | Generate `type WorkspacePluginId = "denali" \| "urban" \| …` from registry |
| `WorkspaceTypeId` | `string` | Same | Generate from `WORKSPACE_MANIFEST_BINDINGS` |
| `WorkspaceWizardHostHooks.loadRulesModule` | `() => Promise<unknown>` | Opaque rules bundle | Workspace-specific branded type or generic param |
| `applyContextualFieldRules` | returns `unknown` | Render plan shape undocumented | Export `WizardRenderPlan` from platform-core or SDK |
| `prepareSubmitPayload` | returns `unknown` | Should be `CreateTourPayload` | Narrow return type |
| `prepareTourPatchPayload` | returns `unknown` | Should be `UpdateTourPayload` | Narrow return type |
| `buildRuleEvalContext` | returns `unknown` | Eval context opaque | Document minimum shape or export `RuleEvalContext` |
| `FlowSubmitPayload` | `Readonly<Record<string, unknown>>` | Submit body unchecked | Per-workspace Zod schema or generic on flow surface |
| `CatalogRegistrationPortalPayload.transport` | `unknown` | Transport blob | `RegistrationIntakeTransport \| undefined` |
| `CatalogRegistrationUpstreamRequest.body` | `unknown` | API body unchecked | Workspace-specific upstream body type |
| `WorkspaceValidationHooks.checkTripDetails` | `tripDetails: unknown` | Trip shape undefined | Export `TripDetails` or workspace-specific interface |
| `WorkspaceWizardDraftMeta` | `Readonly<Record<string, unknown>>` | Intentionally workspace-owned | Document per-workspace meta keys in workspace docs |
| `WorkspaceWizardTemplateGateNormalizeInput.templateSteps` | `readonly unknown[]` | Template step shape unknown | Export template step type from wizard engine |
| `CanonicalDocument.data` | `Readonly<Record<string, unknown>>` | Intentionally generic | Workspace canonical schemas live in workspace packages |
| `TourCloneHydrationInput/Result.data` | `Record<string, unknown>` | Draft shape opaque | Generic `TourCloneHydrator<TDraft>` |
| `lifecycle.initialStatus` / `publishStatus` | `string` | Not enum-constrained | Workspace-specific status unions |
| `WorkspaceLifecycleTransition.from/to` | `string` | Same | |

### Medium impact (manifest / policy)

| Export / field | Current type | Gap |
|----------------|--------------|-----|
| `WorkspaceFieldPolicyDefinition.validation` | `Readonly<Record<string, unknown>>` | Validation rule DSL undocumented in SDK |
| `WorkspaceThemeContract.cssVariables` | `Record<string, string>` | Keys validated at runtime (`--ws-*`) but not as TS union |
| `WorkspaceDefinitionThemePayload.tokens` | `Record<string, string>` | Same |
| `PublicCatalogCard.structuredData` | `Readonly<Record<string, unknown>>` | JSON-LD shape not validated here (use `validateStructuredData`) |
| `RegistrationOpsManifest.statusPipeline` | `readonly string[]` | Status values not enum'd |
| `RegistrationOpsManifest.columns.*` | `readonly string[]` | Column ids not enum'd |
| `WorkspaceIntegrationSurface.messageTemplates` | `Record<string, string>` | Event types not enum'd |
| `WorkspaceExposureSurfaceDefinition.surface` | `string` | Surface ids not enum'd |
| `SettingsModuleManifest.ability` | `string` | Ability keys not enum'd |
| `MemberModuleManifest.id` | `string` | Only reserved ids blocked, not a closed union |

### Low impact (intentional ingress boundaries)

| Export | Notes |
|--------|-------|
| `validateWorkspacePlugin(value: unknown)` | Ingress boundary — OK |
| `validateWorkspaceFieldRegistry(registry: unknown)` | Ingress boundary — OK |
| `validateStructuredData(json: unknown)` | Ingress boundary — OK |
| `parseWorkspaceCommerceConfig(input: unknown)` | Zod-validated at runtime — OK |

### Documentation gaps (not type gaps)

| Topic | Status |
|-------|--------|
| `catalogRegistrationFlow` registration vs `catalogIntake` on plugin | Flow is registry + manifest; intake is plugin property — easy to confuse |
| Which surfaces require `registerWorkspace*Plugin` at app bootstrap | Documented in code comments only |
| `WorkspaceCatalogIntakeSchemaProvider` | Legacy/alternate surface; prefer `WorkspaceCatalogIntakeSurface` |
| Denali-specific examples in hook JSDoc | Other workspaces must infer from Denali references |

---

## Quick reference: implement a new workspace

1. Create `packages/workspaces/<id>/` with `workspace.manifest.json`.
2. Implement `get<Id>WorkspacePlugin(): WorkspacePlugin` with required fields + chosen optional surfaces.
3. Register runtime plugins in app bootstrap: `registerWorkspaceIntakePlugin`, `registerWorkspaceRegistrationFlowPlugin` when using catalog registration.
4. Run `pnpm run generate:workspace-registry` after manifest changes.
5. Validate: `assertWorkspacePlugin(plugin)`, `validateFieldPolicyManifest` (if `fieldPolicy` present), `validateMemberPortalManifest` (if portal modules declared in manifest).

---

*Generated from `@app-tour/workspace-sdk` source scan. For Phase 0 covenant and commands see [`README.md`](./README.md) and [`docs/phase-0-foundation.md`](../../docs/phase-0-foundation.md).*
