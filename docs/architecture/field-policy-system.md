# Field Policy System Architecture

## Purpose

The Field Policy System defines deterministic field visibility and selection state across platform surfaces without owning delivery, event orchestration, or workspace-specific business rules.

This is a platform capability, not a Denali feature. Denali remains one workspace consumer with its own mature wizard rule engine during the MVP migration.

**Field Exposure System:** Entity/workspace field state (this document) is separate from
**where/when/for whom** a field may be published. See
[Field Exposure System Architecture](./field-exposure-system.md) for the target platform
model (`ExposureSurface`, `Audience`, `ActivationTrigger`, `ExposurePolicy`,
`ExposureProfile`, `ExposureIntent`). Phase 8 closed the migration to native exposure
decisions: `ExposureIntent` owns admin selection, persisted `ExposureProfile` rows own
defaults, and integration delivery receives versioned `fieldExposureDecision` metadata.
FieldPolicy still keeps the provider-agnostic `surface: "delivery"` compatibility surface
for eligibility filtering; it is not an exposure destination such as Telegram or email.

**Phase 0 governance:** Do not add new features that treat integration-owned field
selection as a permanent platform primitive. Enforced by
`pnpm run guard:field-exposure-phase-0` (also runs in `pre-commit:fast`).

**Phase 1 vocabulary:** Exposure domain language is frozen in
[field-exposure-system.md](./field-exposure-system.md) (glossary, ADRs, legacy mapping,
forbidden vocabulary). Enforced by `pnpm run guard:field-exposure-phase-1`.

## Boundary Contract

```text
Field Policy System
  Owns: field identity, field state resolution, surface eligibility (entity/workspace context)
  Does not own: exposure profiles, audience/trigger targeting, events, provider routing, formatting, scheduling, external sends

Field Exposure System (target — see field-exposure-system.md)
  Owns: may field appear for surface + audience + trigger; profiles and admin intent
  Does not own: entity/workspace base state (FieldPolicy), scheduling, transport

Integration System
  Owns: domain event routing, provider selection, connection policy, delivery jobs, credentials
  Does not own: field exposure decisions, profile defaults, or admin field selection

Provider Plugins
  Own: provider formatting and API calls
  Examples: Telegram, email, SMS, Slack, WhatsApp
```

The field policy package must not import integration code, provider adapters, workspace-specific packages, or Prisma repositories. Its resolver is pure and receives all definitions, rules, and entity state as explicit input.

## MVP Models

### FieldDefinition

`FieldDefinition` is identity and metadata only.

```ts
export type FieldDefinition = {
  id: string;
  workspaceType: string;
  canonicalPath: string;
  kind: "text" | "number" | "date" | "enum" | "boolean" | "composite";
  labelKey?: string;
  descriptionKey?: string;
  tags?: string[];
  validation?: Record<string, unknown>;
  version: number;
};
```

It must not contain wizard layout, delivery routing, provider identifiers, event timing, or workspace implementation paths such as RHF/Zod paths.

### FieldPolicyRule

`FieldPolicyRule` controls field state for a surface.

```ts
export type FieldPolicyRule = {
  id: string;
  workspaceType: string;
  fieldId: string;
  surface: "wizard" | "public_website" | "profile" | "admin_panel" | "delivery";
  state: "hidden" | "visible" | "required" | "readonly";
  condition?: SimpleCondition;
  priority: number;
  enabled: boolean;
};
```

The `delivery` surface is a **transitional legacy eligibility filter** used by historical
integration dispatch paths to filter outbound candidates **after** candidates are chosen.
Phase 8 starter reference rules use `surface: "telegram"` for external-channel exposure.
It is **not** an `ExposureSurface` and does not mean Telegram, email, or any specific
channel. The long-term model uses explicit `ExposureSurface` values
(`telegram`, `email`, `public_details`, etc.) evaluated by Field Exposure Policy;
see [field-exposure-system.md](./field-exposure-system.md#glossary).

### SimpleCondition

The MVP condition language is intentionally small.

```ts
export type SimpleCondition =
  | { kind: "always" }
  | { kind: "equals"; path: string; value: string | number | boolean | null }
  | { kind: "exists"; path: string };
```

No nested `all` / `any` / `not`, scripts, date math, provider conditions, or permission engines are allowed in MVP.

## Resolver Contract

```ts
export type ResolveFieldStateInput = {
  tenantId: string;
  workspaceType: string;
  surface: "wizard" | "public_website" | "profile" | "admin_panel" | "delivery";
  requestedFieldIds?: string[];
  entityState: Record<string, unknown>;
  definitions: readonly FieldDefinition[];
  rules: readonly FieldPolicyRule[];
};

export type ResolvedFieldState = {
  fieldId: string;
  canonicalPath: string;
  state: "hidden" | "visible" | "required" | "readonly";
  reasonRuleId?: string;
};
```

`resolveFieldState()` must be deterministic:

- No database calls
- No HTTP calls
- No environment reads
- No clock access
- No mutation
- No provider-specific branching
- No workspace-specific imports

Internal resolution stages:

1. Filter definitions by `workspaceType` and `requestedFieldIds`.
2. Filter enabled rules by `workspaceType` and `surface`.
3. Evaluate `SimpleCondition` against `entityState`.
4. Pick one winning rule per field by priority.
5. Break equal-priority ties by state precedence: `required > readonly > visible > hidden`.
6. Return `hidden` when no rule matches.

## Denali Coexistence

Denali is not the center of this architecture and must not shape the platform policy DSL.

Current Denali wizard behavior is richer than MVP field policy:

- Matrix rules via `buildDenaliWorkspaceRuleSet()`
- Contextual rules via `evaluateDenaliContextualRule()`
- Workspace-specific runtime gates such as `telegramIntegrationActive`
- RHF/Zod/wire mappings owned by Denali field registry

Therefore, the MVP must use dual runtime:

```text
Platform Field Policy
  New surfaces: public_website, profile, admin_panel, delivery
  Generic/starter wizard usage only where safe

Denali Workspace Rules
  Existing Denali wizard matrix and contextual rules remain active
  Denali may export metadata and simple policies over time
```

Do not migrate Denali wizard rules into `SimpleCondition` during MVP. In particular, do not add Denali rule kinds or Telegram-specific rule kinds to platform core.

## Workspace Field Policy Manifest

Workspaces may declare an optional, provider-agnostic manifest on `WorkspacePlugin.fieldPolicy`:

```ts
export type WorkspaceFieldPolicyManifest = {
  manifestVersion: 1;
  definitions: readonly WorkspaceFieldPolicyDefinition[];
  rules: readonly WorkspaceFieldPolicyRule[];
};
```

The manifest lives in `@app-tour/workspace-sdk` and is validated by `validateFieldPolicyManifest()`. It must not contain provider identifiers, formatter references, or forbidden model names. Delivery field catalogs and runtime defaults are sourced from `WorkspaceFieldRegistry` fields tagged `deliverable` — not from the manifest.

Denali is not required to adopt this manifest during MVP. Starter ships a reference manifest for new surfaces and delivery filtering only.

## Field Presentation Layer

`FieldDefinition` may carry optional admin UX metadata that does not affect policy evaluation or
dispatch identity:

```ts
readonly adminLabel?: string;
readonly adminDescription?: string;
readonly group?: string;
readonly icon?: string;
```

`resolveFieldPresentation()` maps a definition into admin-facing copy:

```ts
{
  id: string;          // technical identity — unchanged
  label: string;       // adminLabel ?? humanized canonical segment
  group?: string;      // defaults to "General"
  description?: string;
}
```

Registry remains the technical source of truth for field ids. Presentation metadata is consumed by
integration admin UI only — not by FieldPolicy, enrichment, or provider formatters.

## Integration Delivery Intent (transitional)

> **Transitional.** Persisted delivery content today lives in `integration_delivery_intents`
> and is keyed by `connectionId + eventType`. The target domain model is
> `ExposureIntent` scoped by `ExposureProfile` + `surface` / `audience` / `trigger`.
> See [Field Exposure System](./field-exposure-system.md). Do not add new features that
> treat `IntegrationDeliveryIntent` as the permanent platform primitive for field exposure.

Delivery content intent is persisted explicitly in `integration_delivery_intents` (one row per
connection + event type):

```ts
type IntegrationDeliveryIntent = {
  id: string;
  workspaceType: string;
  connectionId: string;
  eventType: string;
  selectedFieldIds: string[];
  templateId?: string;
  enabled: boolean; // when true, selectedFieldIds narrow delivery; when false, registry defaults
  createdAt: string;
  updatedAt: string;
};
```

`IntegrationEventPolicy` retains routing only (`enabled`). Dispatch loads intent, resolves candidate
field ids, applies FieldPolicy eligibility, enriches canonical values, then enqueues provider jobs.
UI writes intent via the delivery-intent API — not via event-policy columns.

## Entity State Contract

`entityState` is an explicit input to `resolveFieldState()` and `filterDeliveryEligibleFields()`. Platform core defines a typed contract without expanding the condition DSL:

```ts
export type FieldPolicyEntityState = Readonly<{
  dimensions?: Readonly<Record<string, string | number | boolean | null>>;
  tour?: Readonly<{
    status?: string;
    publishedAt?: string | null;
  }>;
  actor?: Readonly<{
    role?: string;
    userId?: string;
  }>;
  integrations?: Readonly<{
    activeProviderIds?: readonly string[];
  }>;
}>;
```

Standard path prefixes are documented constants only:

- `dimensions.*` — matrix / variant context from workspace rule sets
- `tour.*` — canonical tour lifecycle facts
- `actor.*` — operator or end-user context
- `integrations.*` — provider-agnostic activation facts, not routing or credentials

Conditions may reference these paths with `equals` or `exists`. No new condition kinds are added for entity state.

## Delivery Eligibility Filter (transitional integration path)

> **Transitional.** This filter uses `surface: "delivery"` for the current integration
> pipeline. Exposure migration will route through `ExposureResolver` with explicit
> `ExposureSurface` + `Audience` + `ActivationTrigger`. FieldPolicy remains the
> entity-state lower bound; ExposurePolicy adds context-specific restrictions.

Integration owns provider routing. Field policy owns eligibility filtering only:

```ts
export function filterDeliveryEligibleFields(input: {
  tenantId: string;
  workspaceType: string;
  candidateFieldIds: readonly string[];
  entityState: FieldPolicyEntityState;
  definitions: readonly FieldDefinition[];
  rules: readonly FieldPolicyRule[];
}): readonly string[];
```

Behavior:

1. Resolve `surface: "delivery"` for the candidate ids via `resolveFieldState()`.
2. Drop fields whose resolved state is `hidden`.
3. Preserve candidate order and deduplicate ids.
4. Never call provider plugins or read integration credentials.

Workspaces declare default delivery candidates through `WorkspaceFieldRegistry` fields tagged
`deliverable`. Integration policy engines override via persisted `selectedFieldIds` before
FieldPolicy filtering. Manifests that still declare `deliveryCandidateFieldIds` fail validation with
`LEGACY_FIELD_CANDIDATE_USAGE_DETECTED` (Pass 3).

## Integration Flow

Delivery remains external to field policy:

```text
DomainEvent
  -> IntegrationPolicyEngine selects provider, connection, capability, and admin field intent
  -> resolveRequestedDeliveryFieldIds(adminSelected OR registry deliverable defaults)
  -> filterDeliveryEligibleFields() or resolveFieldState(surface: "delivery") filters allowed fields
  -> extract canonical values for eligible ids
  -> Provider plugin formats and sends
```

Telegram, email, SMS, Slack, WhatsApp, templates, parse modes, channel IDs, and credentials are integration concerns only.

### API Runtime Consumption

`apps/api` consumes field policy at the dispatch boundary, before enqueueing delivery jobs:

```text
WorkspaceOutboxPublishedRow
  -> IntegrationPolicyEngine.evaluate() per connection decision
  -> requestedFieldIds = decision.selectedFieldIds ?? registry fields tagged deliverable
  -> filterDeliveryEligibleFields(surface: "delivery", candidateFieldIds: requestedFieldIds)
  -> enrichCanonicalDeliveryPayload(eligibleFieldIds, definitions, payload)
  -> enqueue integrationDeliveryCandidateFieldIds, integrationDeliveryFieldIds, integrationDeliveryFieldValues
```

`resolveDeliveryFieldDefinitions()` adapts FieldPolicy definitions from the full exposure catalog for
canonical enrichment. Integration provider ids such as `telegram` are transport metadata only and must not be
used as FieldPolicy surfaces in the engine-authoritative dispatch path.

The delivery worker and provider adapters do not evaluate policy. They receive a provider-agnostic list of eligible canonical field ids in job payload metadata. If a workspace has no `fieldPolicy` manifest, dispatch preserves legacy behavior and omits field eligibility metadata.

The metadata is consumed by the integration message formatter, not by field policy core:

```text
job.payload.integrationDeliveryFieldIds      -> eligible canonical field ids
job.payload.integrationDeliveryFieldValues   -> eligible-only canonical values extracted from the domain payload
formatIntegrationDeliveryMessage(...)         -> resolves {{field:<id>}} only for eligible ids; redacts others to ""
```

`{{field:<id>}}` is an integration-owned placeholder convention. Field policy never formats messages or names providers; it only decides which canonical field ids are eligible. Canonical values are resolved by `enrichCanonicalDeliveryPayload()` — a pure enrichment stage that reads each eligible field's `canonicalPath` from the domain payload (including reference display paths such as `destinationId` → `destination.name`). Fields absent from the payload resolve to omission from `integrationDeliveryFieldValues`, which is the correct fail-safe.

Admin delivery configuration is a narrowing operation over registry defaults or explicit admin
selection, then FieldPolicy eligibility:

```text
candidateFieldIds = adminSelectedFieldIds ?? registryDeliverableDefaults
eligibleFieldIds = filterDeliveryEligibleFields(candidateFieldIds, surface: "delivery")
fieldValues = enrichCanonicalDeliveryPayload(eligibleFieldIds, definitions, payload)
```

When a connection has no admin-selected field list (`selectedFieldIds` is `null`), dispatch uses
registry fields tagged `deliverable`. An explicit empty array (`[]`) means the operator disabled all
fields for that event. Unknown selected ids are rejected at save time and still redact to an empty
string at render time.

The entity-state bridge in `apps/api` is intentionally narrow for MVP:

- `tour.status` may be derived from `payload.status`, `payload.tour.status`, or workspace `lifecycle.initialStatus` on `TourCreated` when the outbox payload has no status field (real `TourCreated` payloads are `{ tenantId, tourId }` only).
- `dimensions.*`, `actor.*`, and `integrations.*` are available to future dispatch bridges, but no provider-specific facts are introduced.
- Delivery eligibility on the `delivery` surface should not depend on marketing lifecycle gates; reference workspaces use `always` conditions for delivery rules and keep lifecycle conditions on `public_website` only.
- `adaptWorkspaceFieldPolicyManifest()` may merge missing `FieldDefinition` rows from `WorkspaceFieldRegistry` when a manifest rule or delivery candidate references a registry field id without duplicating manifest metadata.

## Forbidden Concepts

The field policy module must not introduce:

- `FieldEventTrigger`
- `FieldDeliveryTarget`
- `FieldTimingRule`
- Persisted trigger tables
- Workflow engines
- Scheduling logic
- Provider identifiers
- Formatter or template references
- Nested condition DSL
- Imports from `apps/api/src/integrations`
- Imports from `packages/workspaces/denali`

## Implementation Phases

### Phase 1: Pure Core

Create `packages/platform-core/src/field-policy/` with:

- `types.ts`
- `evaluate-simple-condition.ts`
- `resolve-field-state.ts`
- `index.ts`

Add focused unit tests for condition evaluation, default hidden behavior, requested field filtering, priority, tie-breaking, and determinism.

The public consumption path is the `@app-tour/platform-core` package facade. Consumers should import `resolveFieldState`, `evaluateSimpleCondition`, `adaptWorkspaceFieldRegistryToFieldDefinitions`, adapter helpers, and field policy types from the root package export rather than private source paths.

### Phase 2: Starter Adapter Only

Add a pure adapter from existing `WorkspaceFieldRegistry` / `WorkspaceRuleSet` into field policy definitions and rules for generic or starter workspace use. Do not migrate Denali in this phase.

The adapter may translate only rule cells with zero or one matrix dimension:

- zero dimensions -> `always`
- one dimension -> `equals` against `entityState.dimensions.<key>`
- multiple dimensions -> reported as unsupported, not lowered into a larger DSL

This protects the MVP condition language from becoming a hidden replacement for the existing workspace rule engine.

### Phase 3: New Surfaces First

Use field policy for surfaces that do not already have a mature workspace engine:

- `public_website`
- `profile`
- `admin_panel`
- `delivery`

Avoid replacing Denali wizard behavior in this phase.

### Phase 4: Denali Metadata Export

Allow Denali to export field metadata and simple surface policies where they map cleanly. Denali contextual rules remain workspace-owned until separately simplified.

The first supported Denali bridge is metadata-only:

- `buildDenaliFieldPolicyDefinitions()` maps the existing Denali `WorkspaceFieldRegistry` into platform `FieldDefinition` objects.
- The bridge is exported from the Denali package facade for consumers that need Denali metadata.
- The bridge keeps a local metadata mapper instead of importing runtime helpers from `platform-core`, because workspace package tests resolve `@app-tour/platform-core` through its package facade/dist boundary.
- RHF paths, Zod paths, wire projections, structural invariants, and contextual rules remain Denali implementation details.
- No Denali contextual rule kind is added to platform core.

### Phase 5: Boundary Guards

Add static guards or tests to ensure the field policy module contains no provider strings, integration imports, Denali imports, formatter references, or forbidden model names.

The root guard command is:

```bash
pnpm run guard:field-policy-boundary
```

`phase-6:fast-track` runs this guard after the import-boundary guard so provider or workspace coupling cannot re-enter `packages/platform-core/src/field-policy`.

### Phase 6: Optional Persistence

Only add persistence after a real tenant-editable policy requirement exists. If needed, persistence may cover field definitions and policy rules only. Trigger, timing, and delivery target tables remain out of scope.

### Phase 7: Closure (Gap Register)

The closure sprint adds:

- `WorkspaceFieldPolicyManifest` on workspace-sdk with optional `WorkspacePlugin.fieldPolicy`
- `FieldPolicyEntityState` contract in platform core
- `adaptWorkspaceFieldPolicyManifest()` mapper from SDK manifest to core definitions/rules
- `filterDeliveryEligibleFields()` pure delivery consumer
- Starter reference manifest with simple `public_website` and `delivery` rules
- Extended boundary guard coverage for entity-state provider coupling

## Migration Guide

```text
Simple matrix (0-1 dimension)
  -> adaptWorkspaceRuleSetToFieldPolicy + resolveFieldState

New surfaces (public/profile/admin/delivery)
  -> WorkspaceFieldPolicyManifest on WorkspacePlugin.fieldPolicy
  -> adaptWorkspaceFieldPolicyManifest when calling platform core

Complex contextual rules (Denali-like)
  -> keep workspace engine
  -> export metadata only (buildDenaliFieldPolicyDefinitions)

Delivery outbound
  -> integration selects provider + candidate field ids
  -> filterDeliveryEligibleFields()
  -> provider plugin formats and sends

Never
  -> put Telegram/provider logic in field-policy core
  -> migrate Denali wizard contextual rules into SimpleCondition during MVP
```

## Success Criteria

- Field policy core is pure and deterministic.
- Denali wizard behavior remains unchanged.
- New platform surfaces can resolve field state without workspace-specific imports.
- Integration remains the only outbound delivery system.
- Provider plugins remain isolated.
- `delivery` is only a surface context.
- No advanced DSL or timing engine is introduced.

