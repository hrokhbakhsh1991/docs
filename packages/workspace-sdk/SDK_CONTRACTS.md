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
| `wizardHost`, `tourClone`, `publicCatalog`, `catalogIntake`, `draftTombstone` | **No** | Yes (package plugin factory) |
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
| `loadRulesModule?` | — | `Promise<unknown>` | ⚠ opaque |
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
