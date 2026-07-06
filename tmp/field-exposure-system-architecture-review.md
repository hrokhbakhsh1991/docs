# Field Exposure System — Enterprise Control Plane Architecture

> Status: Final architecture upgrade. No implementation, no file renames, no runtime
> behavior change. This document defines the enterprise Control Plane end-state.
>
> Date: 2026-06-27
>
> 2026-06-28 update: Sections 0-11 are retained as historical architecture freeze
> context. Section 12 supersedes the earlier linear resolver model with the final
> Stripe-level Policy Graph Control Plane design. Any earlier wording that implies
> sequential pipelines, hardcoded surfaces/triggers/audiences, or integration-owned
> exposure is deprecated by Section 12.

---

## 0. Final Verdict

**Field Exposure System** is the correct end-state.

The current repository has moved in the right direction (it removed the
`deliveryCandidateFieldIds` drift), but it is still structurally centered on
**integration delivery**. The domain still starts from integration concepts
(`IntegrationDeliveryIntent`, `deliveryCandidateFields`, `surface: "delivery"`,
provider/event-policy metadata). Those must remain only as **transitional adapters**,
not domain truth.

The platform should answer the generic question:

> Given a field, entity state, surface, audience, and activation context,
> may this field be exposed, and in what form?

NOT the integration-centric question:

> Which fields should be sent to Telegram / email?

Telegram, Email, PDF, Public Website, Dashboard, Wizard, and Admin Panel become
**equal consumers** of the same Exposure Engine.

---

## 1. Core Problem

The system is still answering the wrong question. Even after removing legacy drift,
field selection is discovered through the **integration** path:

- The domain primitive `IntegrationDeliveryIntent` is keyed by `connectionId + eventType`.
- The selectable field catalog is exposed from **integration meta**.
- The admin UI for field selection lives inside **integration settings**.
- `surface: "delivery"` conflates all outward channels into one ambiguous bucket.
- `deliverable` registry tags are being used as de-facto publication policy.

This is a hybrid model: partially correct, still integration-centric.

---

## 2. Required Paradigm Shift

We are NOT building an Integration Delivery System.

We are building a **Field Exposure Platform**. Integrations are only one consumer of
exposure decisions.

---

## 3. Forbidden Core Concepts (transitional adapters only)

These MUST NOT be core domain concepts. They may exist only as transitional adapters:

- `IntegrationDeliveryIntent` (as domain primitive)
- `selectedFieldIds` owned by integrations
- `deliveryCandidateFields`
- `deliverable` tags used as policy
- `surface: "delivery"`
- Telegram/email-specific field selection logic
- integration-driven field catalogs

---

## 4. Final Target Domain Model


| Layer                              | Responsibility                                                              | NOT responsible for                                         |
| ---------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Field Registry**                 | `fieldId`, `canonicalPath`, `kind`, presentation metadata                   | visibility, timing, audience, publication, integration      |
| **Field Policy (PDP)**             | entity/workspace state: `hidden / visible / required / readonly / redacted` | publication, surface targeting, integration selection       |
| **Exposure Surface**               | where content appears                                                       | encoding timing or triggers                                 |
| **Audience**                       | who the field is for                                                        | being derived from surface                                  |
| **Activation Trigger**             | when/why evaluation happens (incl. timing)                                  | being encoded into surface                                  |
| **Field Exposure Policy** (NEW)    | pure decision: `visible / hidden / redacted / summary_only / blocked`       | sending data, scheduling, executing integrations, rendering |
| **Exposure / Publication Profile** | reusable default exposure shape                                             | provider credentials                                        |
| **Exposure / Publication Intent**  | admin override: enabled, selected fields, template override, optional scope | being owned by integration                                  |
| **Integration Layer**              | transport: credentials, provider API, retries, logs, formatter adapter      | deciding field exposure                                     |


### 4.1 Exposure Surface (where)

Valid:

```text
wizard
review_page
public_list
public_details
admin_panel
user_dashboard
telegram
email
instagram
pdf
mobile_app
```

Invalid (these are triggers, not surfaces):

```text
before_tour_24h
payment_completed
registration_completed
```

### 4.2 Audience (for whom) — independent from surface

```text
public
registered_user
operator
admin
external_channel
system
```

The same surface serves multiple audiences (`email + registered_user`,
`email + operator`, `telegram + external_channel`, `telegram + operator`).
Deriving audience from surface forces fake surfaces like `email_operator` —
the same combinatorial mistake as timing-as-surface.

### 4.3 Activation Trigger (when/why) — timing lives here

```text
always
tour_created
tour_published
payment_completed
registration_completed
relative_to_tour_start(offset=-24h)
relative_to_tour_start(offset=-48h)
manual
```

### 4.4 Naming: Exposure vs Publication

- Use **Exposure** for the generic core (`ExposurePolicy`, `ExposureProfile`,
`ExposureIntent`, `ExposureResolver`). Wizard / review / admin / dashboard are
exposure surfaces, not "publication" in the external sense.
- Use **Publication** as a specialization for outward rendered/sent artifacts
(`PublicationProfile` = an outbound exposure profile).

---

## 5. Required Evaluation Pipeline

```text
Field Registry
  -> Field Policy
  -> Field Exposure Policy
  -> Exposure / Publication Intent
  -> Exposure Resolver
  -> Canonical Enrichment
  -> Template Rendering
  -> Surface Consumer / Integration Provider
```

Integrations must NEVER be the starting point of field selection. Telegram supplies
**context only**:

```text
surface  = telegram
audience = external_channel
trigger  = tour_created
scope    = connectionId
```

…and then receives an already-approved payload.

---

## 6. Audit Results

### A. Architecture Misalignment Table


| Current Concept                        | Problem                                                                                 | Should Become                                                                 | Layer                   |
| -------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------- |
| `IntegrationDeliveryIntent`            | Keyed by `connectionId + eventType`; integration transport owns field exposure choices. | Transitional adapter into `ExposureIntent`.                                   | Exposure Intent         |
| `selectedFieldIds` (integration-owned) | The override is valid; the ownership is wrong.                                          | `ExposureIntent.selectedFieldIds` scoped by profile/surface/audience/trigger. | Intent                  |
| `deliveryCandidateFields`              | Field catalog exposed from integration meta -> integrations become exposure entrypoint. | `exposureCandidateFields` / profile-derived field set.                        | Exposure Meta           |
| `surface: "delivery"`                  | Ambiguous (Telegram? email? PDF? dashboard?).                                           | Explicit `ExposureSurface` values.                                            | Surface                 |
| `deliverable` tags                     | Registry tag used as default publication policy; too weak for audience/surface/trigger. | `ExposureProfile.defaultFieldIds` + `ExposurePolicy` rules.                   | Profile / Policy        |
| Integration meta field catalog         | Provider config + exposure defaults mixed.                                              | Split provider meta from exposure/profile meta.                               | Integration vs Exposure |
| Telegram assumptions                   | Field selection path still starts from integration UI/intent.                           | Telegram = context provider only.                                             | Integration Consumer    |
| Templates in integration surface       | Templates are presentation format, not provider ownership.                              | Templates belong to Exposure/Profile/Intent.                                  | Template                |
| Event policies                         | Routing + historical field/template residue.                                            | Routing/activation enablement only.                                           | Event Routing           |


### B. Hidden Coupling (evidence)

Coupling is mostly in the **domain shape**, not in Telegram provider code:

- `apps/api/src/integrations/domain/integration-delivery-intent.ts` — makes
`connectionId + eventType` the owner of field intent.
- `apps/api/src/integrations/platform/integration-surface-meta.ts` — exposes
`deliveryCandidateFields` from integration metadata.
- `apps/web/app/(app)/settings/integrations/integration-event-delivery-policy-panel.tsx`
— integration settings UI is the field-selection editor.
- `packages/workspaces/denali/src/integrations/denali-field-policy.manifest.ts` —
uses `surface: "delivery"` (too broad).
- `packages/workspaces/denali/src/field-registry/denaliFieldRegistryData.ts` —
`deliverable` tags act as publication defaults.
- `docs/architecture/field-policy-system.md` — still uses delivery defaults,
selected fields, and `surface: "delivery"` as core language.

### C. Model Validation

1. **Should FieldPolicy and ExposurePolicy be separate?** — **Yes.**
  FieldPolicy = field state given entity/workspace state. ExposurePolicy = may the
   field appear given surface + audience + trigger + entity state. Merging pollutes
   every workspace field rule with audience/trigger/channel concerns -> long-term drift.
2. **Is Integration incorrectly owning domain decisions?** — **Yes, conceptually.**
  Even with clean provider code, `IntegrationDeliveryIntent` and
   `deliveryCandidateFields` make integrations the ownership boundary for exposure.
3. **Is surface + trigger separation valid long term?** — **Yes, essential.**
  `surface=telegram` + `trigger=relative_to_tour_start(-24h)` is correct;
   `surface=telegram_before_24h` causes combinatorial explosion.
4. **Rename `PublicationIntent` -> `ExposureIntent`?** — **Yes for the generic core.**
  Reserve "Publication" for outward rendered/sent artifacts.

---

## 7. Enterprise Risk Review

The current target model is directionally correct, but several points must be locked down before
implementation. These are the areas most likely to create enterprise debt if left implicit.


| Risk                                    | Why it is dangerous                                                                                                                             | Required design guardrail                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FieldPolicy vs ExposurePolicy conflict  | A field may be `hidden` by entity state but `visible` by an exposure profile. Without a precedence rule, behavior will drift per surface.       | FieldPolicy is the hard lower bound. ExposurePolicy can only further restrict or transform (`redacted`, `summary_only`), never resurrect a field hidden by FieldPolicy.                |
| Profile explosion                       | `telegram_tour_created`, `email_tour_created`, `email_24h`, `pdf_admin`, etc. can become unmanageable if every small variant becomes a profile. | Profiles must be named reusable defaults. Variant-specific overrides belong in `ExposureIntent`, not new profiles, unless they represent a stable product surface.                     |
| Audience derived from surface           | Teams may assume `telegram = external_channel` or `admin_panel = admin`. That later breaks private Telegram, operator email, admin PDF, etc.    | `audience` must be explicit in every `ExposureContext`. Surfaces may provide defaults, but defaults must be overridable.                                                               |
| Trigger used as scheduler               | `relative_to_tour_start(-24h)` may be confused with the job that wakes up at T-24h.                                                             | Trigger is only evaluation context. Scheduling/event emission belongs to an orchestration layer outside ExposurePolicy.                                                                |
| Registry tags becoming policy again     | Tags like `deliverable` are convenient and will be reused as hidden policy unless forbidden.                                                    | Registry tags may seed migration defaults only. Long-term defaults live in `ExposureProfile`; permissions live in `ExposurePolicy`.                                                    |
| Templates leaking policy                | Templates can reference fields that are not allowed in context. If rendering owns enforcement, redaction behavior becomes renderer-specific.    | ExposureResolver must return the allowed field set before rendering. Template rendering must treat disallowed placeholders as blocked/redacted by decision, not by provider guesswork. |
| Provider formatting coupled to exposure | Telegram/Email/PDF have different formatting limits. If ExposurePolicy knows provider syntax, it stops being generic.                           | ExposurePolicy decides field exposure. Renderer decides format capabilities. Provider sends.                                                                                           |
| Cross-workspace drift                   | Denali-specific assumptions can accidentally become core defaults.                                                                              | Core exposure contracts must be workspace-neutral. Workspace packages provide profiles/policies; core provides evaluation semantics.                                                   |
| Tenant isolation and audit              | Exposure decisions may reveal sensitive/public-private boundaries. Missing audit trails create enterprise compliance risk.                      | Every persisted `ExposureIntent` change must be tenant-scoped, auditable, and attributable to actor/context.                                                                           |
| Versioning and replay                   | Historical events may render with newer policies, changing what would have been exposed.                                                        | Exposure profiles and intents need versioning. Runtime jobs should record the profile/intent/policy version used for decision.                                                         |
| Empty selected field semantics          | `[]` can mean "publish nothing" or "use defaults" depending on layer.                                                                           | Use explicit intent mode: `inherit_profile`, `override_fields`, `disabled`. Avoid nullable/empty-array semantics as domain truth.                                                      |
| PII and secret leakage                  | Canonical enrichment can resolve sensitive data before exposure decisions are applied.                                                          | Resolve allowed field ids first. Enrichment must operate only on approved field ids, and secrets must be non-addressable unless explicitly modeled.                                    |


### 7.1 Required Enterprise Invariants

These invariants should be treated as non-negotiable:

1. Field Registry never decides exposure.
2. FieldPolicy never sends, schedules, formats, or owns provider behavior.
3. ExposurePolicy never schedules jobs or calls integrations.
4. ExposureIntent never stores provider credentials.
5. Integration never owns field selection.
6. Renderer never decides whether a field is allowed; it only renders approved decisions.
7. A hidden FieldPolicy result cannot be made visible by ExposurePolicy or Intent.
8. Every exposure evaluation has explicit `surface`, `audience`, and `trigger`.
9. Timing belongs to `ActivationTrigger`, not `ExposureSurface`.
10. Migration adapters may read legacy integration state, but new domain language must not be integration-owned.

### 7.2 Decision Precedence

The final resolver must have a deterministic precedence order:

```text
Field Registry
  -> field exists and identifies canonical value

Field Policy
  -> base state from entity/workspace context
  -> hidden/redacted here is a hard lower bound

Exposure Policy
  -> context-specific exposure decision for surface/audience/trigger
  -> may restrict or transform further

Exposure Profile
  -> default shape for this stable product context

Exposure Intent
  -> admin override/narrowing within policy limits

Resolver Output
  -> final approved fields + exposure form + template/profile metadata
```

If any layer says `blocked` or hard `hidden`, downstream layers cannot re-enable the field.

### 7.3 Core Object Shape (conceptual, not implementation)

```text
ExposureContext
  workspaceType
  tenantId
  entityType
  entityId
  surface
  audience
  trigger
  actor?
  time
  entityState

ExposureDecision
  fieldId
  state: visible | hidden | redacted | summary_only | blocked
  reasonCode
  source: field_policy | exposure_policy | profile | intent

ExposureProfile
  id
  workspaceType
  entityType
  surface
  audience
  trigger
  defaultFieldIds
  defaultTemplateId?
  version

ExposureIntent
  profileId
  scope
  mode: inherit_profile | override_fields | disabled
  selectedFieldIds?
  templateOverrideId?
  version
  updatedBy
```

This avoids overloading `enabled + selectedFieldIds: []` with multiple meanings.

---

## 8. Detailed Migration Strategy (no implementation yet)

Must NOT break Denali or Telegram.

### Phase 0 — Freeze and Inventory

Goal: stop conceptual drift before creating more migration work.

- Freeze new Telegram/email-specific field-selection behavior.
- Inventory all uses of `IntegrationDeliveryIntent`, `deliveryCandidateFields`,
`deliverable`, and `surface: "delivery"`.
- Mark current integration-driven concepts as transitional in docs/ADR.
- Define acceptance criteria for Denali compatibility: same Telegram output, same saved settings,
same public API behavior until cutover.

Exit criteria:

- Architecture terms are frozen.
- No new feature depends directly on integration-owned field selection.
- Known transitional concepts are listed with planned removal phase.

### Phase 1 — Introduce Exposure Domain Language (no behavior change)

Goal: establish the model without changing runtime behavior.

- Define conceptual contracts:
`ExposureSurface`, `Audience`, `ActivationTrigger`, `ExposurePolicy`,
`ExposureProfile`, `ExposureIntent`, `ExposureContext`, `ExposureDecision`.
- Add an ADR or architecture doc that states all invariants and precedence rules.
- Decide final naming: generic core uses `Exposure*`; outbound artifacts may use `Publication*`.
- Define Denali's first canonical profiles conceptually:
`telegram_tour_created`, `public_tour_details`, `operator_review_panel`.

Exit criteria:

- No runtime behavior changed.
- Every new concept has a single owner and non-owner list.
- `ExposureContext` requires explicit surface, audience, and trigger.

### Phase 2 — Adapter `IntegrationDeliveryIntent` -> `ExposureIntent`

Goal: make current data readable through the future model without changing storage yet.

```text
IntegrationDeliveryIntent.connectionId -> ExposureIntent.scope.connectionId
eventType                              -> trigger
provider telegram                      -> surface = telegram
selectedFieldIds                       -> selectedFieldIds
templateId                             -> template override
```

Additional rules:

- Current `enabled=false` must map to `mode=inherit_profile`, not ambiguous empty selection.
- Explicit empty selected fields must map to `mode=override_fields` with `selectedFieldIds=[]`.
- Adapter must expose reason/source metadata so tests can prove decisions are still legacy-backed.

Exit criteria:

- Denali Telegram reads exactly the same settings through the adapter.
- Existing DB rows remain valid.
- No provider has direct access to legacy field-selection semantics.

### Phase 3 — Shadow Exposure Resolver

Goal: prove the new resolver can reproduce current behavior before cutover.

- Run ExposureResolver in shadow mode beside current integration dispatch.
- Compare:
  - candidate field ids
  - eligible field ids
  - enriched field values
  - rendered template output
- Log mismatches without changing outbound behavior.
- Add explicit cases for:
  - default profile fields
  - admin override fields
  - empty override
  - hidden FieldPolicy field
  - redacted/blocked future state placeholder behavior

Exit criteria:

- Shadow output matches current Telegram behavior for Denali.
- Any mismatch has a documented intentional difference or migration fix.

### Phase 4 — Introduce Exposure Profiles as Source of Defaults

Goal: move defaults out of registry tags and integration meta.

- Create workspace-owned exposure profiles conceptually:
  - `telegram_tour_created`
  - `public_tour_card`
  - `public_tour_details`
  - `registered_user_24h_reminder`
  - `operator_review_panel`
- Move `deliverable` default semantics into profile defaults.
- Keep `deliverable` as migration metadata only, not policy.
- Version profiles from the start.

Exit criteria:

- Defaults can be derived from profiles without reading integration metadata.
- Denali profile defaults match current Telegram defaults.
- Registry remains identity/presentation only.

### Phase 5 — Generic Exposure UI

Goal: move admin field selection out of integration settings ownership.

- Build/define a generic exposure profile editor.
- Integrations page may embed the editor for `surface=telegram`, but it must not own field policy.
- UI copy changes from "delivery policy" to "exposure/publication profile" where appropriate.
- The editor must display:
  - surface
  - audience
  - trigger
  - profile defaults
  - admin intent mode (`inherit`, `override`, `disabled`)

Exit criteria:

- Field checklist is reusable for non-integration surfaces.
- Telegram settings page is only a consumer/entrypoint.
- UI cannot create an integration-owned field catalog.

### Phase 6 — Dual Write / Controlled Cutover

Goal: migrate persistence safely.

- New writes go to ExposureIntent.
- Transitional adapter can still mirror to or read from IntegrationDeliveryIntent.
- Outbound dispatch can be switched per tenant/workspace/profile with a feature flag.
- Store decision metadata on jobs:
  - profile id/version
  - intent id/version
  - resolver version
  - surface/audience/trigger

Exit criteria:

- Denali can run with ExposureIntent-backed decisions.
- Rollback path exists to legacy integration intent.
- Audit logs show actor and before/after intent changes.

### Phase 7 — Remove Integration-Owned Selection

Goal: complete the domain migration.

- Remove integration-owned field catalog from integration meta.
- Remove `surface: "delivery"` as a core surface.
- Remove `deliverable` as policy/default source.
- Retire `IntegrationDeliveryIntent` after backfill and compatibility window.
- Keep integration event policies as routing/activation only.

Exit criteria:

- Integrations own transport only.
- Field selection is impossible without an ExposureProfile/ExposureIntent.
- Telegram, Email, PDF, Public Website, Dashboard, Wizard, and Admin are equal consumers.

### Phase 8 — Enterprise Hardening

Goal: make the system operable and auditable at scale.

- Add profile/intent versioning rules.
- Add policy decision audit/reason codes.
- Define cross-workspace extension rules.
- Define template safety rules per renderer.
- Define tenant isolation/RLS requirements for exposure intent/profile tables.
- Define observability:
  - decision counts by surface/audience/trigger
  - blocked/redacted fields by reason
  - legacy adapter usage
  - profile mismatch drift

Exit criteria:

- Exposure decisions are explainable, auditable, and replayable.
- Legacy adapter usage trends to zero.
- New surfaces can onboard without touching integration delivery code.

---

## 9. Broken Abstractions (summary)

- `delivery` as a generic surface
- `deliverable` as policy
- integration metadata as source of field catalog
- integration intent as owner of field exposure
- Telegram/email UI as policy editing surface
- event policy owning (or historically owning) content concerns
- templates scoped first to integrations instead of exposure profiles

---

## 10. Recommended Architecture (diagram-like)

```text
Field Registry            what exists (identity, canonicalPath, kind, presentation)
  v
Field Policy              entity/workspace state (visible/hidden/required/readonly/redacted)
  v
Exposure Surface          where it appears (wizard, public_details, telegram, email, pdf...)
Audience                  who sees it (public, registered_user, operator, admin, external_channel)
Activation Trigger        when/why (always, tour_created, payment_completed, relative_to_tour_start)
  v
Field Exposure Policy     pure decision (visible/hidden/redacted/summary_only/blocked)
  v
Exposure Profile          reusable default shape (public_tour_details, telegram_tour_created...)
  v
Exposure Intent           admin override (enabled, selectedFieldIds, template, optional scope)
  v
Exposure Resolver         composes registry + field policy + exposure policy + intent
  v
Canonical Enrichment      resolve values
  v
Template Rendering        presentation format
  v
Surface Consumer / Integration Provider   transport only (Telegram, Email, PDF, Web UI, Admin)
```

---

## 11. End-State Confirmation

The final platform should not ask *"Which fields does Telegram send?"* but
*"For this field, entity state, surface, audience, and trigger, what exposure form is
allowed?"* — with Telegram, Email, PDF, Public Website, Dashboard, Wizard, and Admin
Panel all equal consumers of one generic **Field Exposure Engine**.

---

## 12. Final Enterprise Control Plane Upgrade

This section is the final architecture. It intentionally replaces the earlier
pipeline-shaped model with a graph execution model. The Field Exposure System is no
longer an application feature, an integration subsystem, or a sequential resolver. It
is an enterprise policy Control Plane that produces deterministic exposure decisions
from versioned policy artifacts.

### 12.1 Final System Architecture

The target system is an **Exposure Control Plane Kernel** with five strict
responsibilities:

```text
Exposure Control Plane Kernel
  Policy Registry
  Policy Graph Engine
  Decision Orchestrator
  Version Resolver
  Simulation Engine
  Audit & Replay Engine
```

The kernel is the only authority allowed to resolve exposure. Product surfaces,
workspace packages, integration providers, and admin UIs submit context and receive
decisions. They do not select fields.

#### Control Plane Responsibilities

**Policy Registry**

- Stores every policy unit as immutable, versioned data.
- Owns schemas for policy artifacts, node contracts, graph templates, and plugin
declarations.
- Publishes signed policy sets by tenant, workspace type, entity type, surface,
audience, trigger, and effective time.
- Provides read APIs for runtime, simulation, audit, replay, and admin preview.

**Policy Graph Engine**

- Executes a DAG of composable policy nodes.
- Evaluates nodes deterministically from declared dependencies, not from handwritten
resolver order.
- Produces per-field decisions with full trace, inputs, artifact versions, and
conflict resolution output.
- Does not know hardcoded surface, trigger, or audience enums.

**Decision Orchestrator**

- Builds an evaluation request from `ExposureContext`.
- Asks the Version Resolver for the exact policy set.
- Executes graph evaluation.
- Returns a decision envelope to enrichment, renderer, or admin preview consumers.
- Has no integration-specific branches.

**Version Resolver**

- Resolves which immutable artifact versions apply to one evaluation.
- Supports current-time evaluation, historical replay, scheduled future preview, and
explicit policy-set simulation.
- Guarantees that runtime and replay use the same artifact graph, schemas, plugins,
and evaluation inputs.

**Simulation Engine**

- Runs `simulate(policySet, context)` without mutation.
- Runs `diff(previousDecision, newDecision)` before publication.
- Supports bulk impact analysis across tenants, workspaces, entity cohorts, and
surfaces.
- Blocks promotion of policy sets that cannot be simulated.

**Audit & Replay Engine**

- Stores decision envelopes, execution traces, artifact versions, plugin versions,
and context hashes.
- Supports `explain(fieldId)` and `replay(eventId, policyVersion)`.
- Answers "why did this field disappear?" without reading application logs.

### 12.2 No Pipeline Thinking

The old model looked like a linear flow:

```text
Registry -> FieldPolicy -> ExposurePolicy -> Profile -> Intent -> Resolver
```

That shape is no longer the execution model. The global precedence still exists as a
semantic invariant, but it is encoded as graph constraints and conflict rules:

```text
                 +----------------+
                 | Field Registry |
                 | identity only  |
                 +-------+--------+
                         |
             +-----------+------------+
             |                        |
      +------+-------+        +-------+--------+
      | Constraint   |        | Context Rule   |
      | Nodes        |        | Nodes          |
      | FieldPolicy  |        | ExposurePolicy |
      +------+-------+        +-------+--------+
             |                        |
             +-----------+------------+
                         |
                +--------+---------+
                | Profile Template |
                | Default Nodes    |
                +--------+---------+
                         |
                +--------+---------+
                | Intent Override  |
                | Nodes            |
                +--------+---------+
                         |
                +--------+---------+
                | Conflict Resolver|
                | Final Authority  |
                +------------------+
```

Graph edges express dependency, scope, precedence class, and conflict behavior. The
engine may evaluate independent nodes in parallel, cache subgraphs, and reuse modules.
The final result is not produced by a chain of if/else calls. It is produced by graph
execution plus deterministic conflict resolution.

### 12.3 New Core Domain Model

#### PolicyArtifact

`PolicyArtifact` is the atomic runtime policy object. Field policies, exposure rules,
profiles, intents, constraints, graph modules, and plugin declarations are all
artifacts.

Required properties:

```text
PolicyArtifact
  artifactId
  artifactType
  semanticName
  version
  immutableRevisionId
  tenantScope
  workspaceScope
  entityScope
  schemaRef
  data
  dependencies
  activationWindow
  createdBy
  createdAt
  supersedes?
  signatureHash
```

Rules:

- A published artifact is immutable.
- Updates create new versions.
- Runtime uses a resolved policy set, never "latest" by accident.
- Artifacts are independently evaluatable if their dependencies are provided.
- Every artifact has a canonical hash used for replay and audit.

#### PolicyGraph

`PolicyGraph` is a versioned DAG composed of policy nodes and dependency edges.

```text
PolicyGraph
  graphId
  graphVersion
  rootNodeIds
  nodes
  edges
  precedenceContract
  conflictStrategy
  pluginSchemaRefs
  compatibilityContract
  graphHash
```

The graph is publishable only if it passes static validation:

- no cycles
- all node schemas resolvable
- all plugin constraints declared
- no cross-tenant artifact references
- conflict strategy complete for every decision state
- simulation coverage available

#### ExposureContext

`ExposureContext` is data, not code. It carries explicit coordinates and references
schema-driven registry values.

```text
ExposureContext
  tenantId
  workspaceType
  entityType
  entityId
  surfaceKey
  audienceKey
  triggerKey
  entityStateHash
  entityStateRef
  actorRef?
  requestTime
  eventId?
  surfacePluginId?
  pluginVersion?
  requestedPolicySetVersion?
  replayMode?
```

`surfaceKey`, `audienceKey`, and `triggerKey` are registry keys. The engine does not
compile enums for Telegram, email, public pages, admin panels, or event types.

#### ExposureDecision

`ExposureDecision` is the immutable output of one graph evaluation.

```text
ExposureDecision
  decisionId
  policySetVersion
  graphHash
  contextHash
  fields
  summary
  executionTraceId
  simulationRequired
  deterministicReplayKey
```

Each field result contains:

```text
FieldDecision
  fieldId
  state: visible | hidden | redacted | summary_only | blocked
  reasonCode
  reasonChain
  sourceNodeIds
  appliedArtifactVersions
  conflictResolution
  valueAccessMode
```

Only fields with `state=visible` or an explicitly renderable transformed state may be
passed to enrichment and rendering.

#### PolicyNode

`PolicyNode` is an evaluatable unit in the graph.

```text
PolicyNode
  nodeId
  nodeType
  artifactRef
  inputContract
  outputContract
  precedenceClass
  condition?
  dependencies
  cacheKeyStrategy
  deterministicFunctionRef
```

Allowed node types:

- `field_identity_node`
- `hard_constraint_node`
- `context_rule_node`
- `profile_default_node`
- `intent_override_node`
- `plugin_constraint_node`
- `redaction_transform_node`
- `budget_node`
- `tenant_guardrail_node`
- `conflict_resolution_node`
- `decision_projection_node`

Nodes do not call integrations. Nodes do not mutate storage. Nodes emit structured
facts or decisions.

#### SurfacePlugin

`SurfacePlugin` declares what a surface can render and how it accepts approved
decisions.

```text
SurfacePlugin
  pluginId
  pluginVersion
  surfaceKey
  capabilitySchema
  constraintSchema
  rendererContract
  formattingRules
  maxPayloadShape
  forbiddenFieldKinds
  supportedDecisionStates
  isolationPolicy
```

Plugins can define constraints like message length, attachment support, markdown
support, redaction rendering, PDF layout limits, or admin-only display affordances.
Plugins cannot define field selection or exposure allow/deny policy.

#### ExecutionTrace

`ExecutionTrace` is a first-class audit artifact.

```text
ExecutionTrace
  traceId
  decisionId
  graphHash
  policySetVersion
  contextHash
  evaluatedNodes
  skippedNodes
  nodeInputs
  nodeOutputs
  conflicts
  finalFieldReasons
  timing
  cacheHits
```

The trace must be sufficient to reconstruct `explain(fieldId)` without re-running the
system.

### 12.4 Current System Mapping

The existing concepts are demoted into graph artifacts:

- `FieldPolicy` becomes a `PolicyArtifact` of type `hard_constraint_node`. It is the
lower bound and can block, hide, redact, or restrict. It cannot select final fields.
- `ExposurePolicy` becomes one or more `context_rule_node` artifacts. It expresses
surface/audience/trigger/entity rules as data.
- `ExposureProfile` becomes a reusable `PolicyGraph` template or
`profile_default_node` artifact. It supplies defaults for a stable product context.
- `ExposureIntent` becomes an `intent_override_node`. It narrows, disables, or
overrides profile defaults inside the limits of constraints and context rules.
- Integration event policies become routing and activation metadata only. They can
emit an `ExposureContext`; they cannot select fields.
- Telegram, Email, PDF, Web, Admin, and future consumers become `SurfacePlugin`
registrations.

### 12.5 Plugin Architecture

Plugins register into the Control Plane through the Policy Registry, not by adding
engine code.

#### Surface Registration

A plugin publishes:

```text
SurfaceRegistration
  surfaceKey
  pluginId
  pluginVersion
  supportedAudiences
  supportedTriggers
  rendererContract
  constraints
  schemaVersion
```

`supportedAudiences` and `supportedTriggers` are data-driven registry references. The
engine validates them through schemas; it does not hardcode enum members.

#### Plugin Constraints

Plugin constraints are evaluated as graph facts, not as allow/deny exposure policy.

Examples:

- Telegram max message length.
- Email HTML/plain text support.
- PDF page-layout constraints.
- Admin table column density.
- Web public page SEO truncation rules.

Constraint nodes may transform `visible` into `summary_only` or require renderer
fallbacks if the global policy contract allows it. They may not turn `hidden` or
`blocked` into `visible`.

#### Rendering

Rendering receives:

```text
ApprovedExposurePayload
  decisionId
  visibleFields
  transformedFields
  templateRef
  pluginRendererContract
  traceRef
```

The renderer can format approved fields. It cannot fetch disallowed fields. Canonical
enrichment must be scoped to the approved decision output.

#### Plugin Isolation

Isolation rules:

- Plugins execute outside the Policy Graph Engine.
- Plugins never receive raw policy artifacts unless needed for explainable rendering.
- Plugins receive only approved field values.
- Plugin code cannot query cross-tenant policy registry data.
- Plugin constraints are declarative artifacts validated before publication.
- Plugin renderer failures do not change exposure decisions; they only fail rendering
or request a new simulation.

### 12.6 Policy Graph Execution Model

#### Graph Construction

For a given `ExposureContext`, the Version Resolver assembles a policy set:

```text
PolicySet
  registryVersion
  graphVersion
  fieldArtifactVersions
  constraintArtifactVersions
  contextRuleArtifactVersions
  profileArtifactVersion
  intentArtifactVersion
  pluginArtifactVersion
```

The graph is built from reusable modules:

- workspace base graph
- entity-type graph
- field-family graph
- surface plugin constraint graph
- profile template graph
- intent override graph
- tenant guardrail graph

#### Traversal Rules

Evaluation uses deterministic topological traversal:

- nodes with satisfied dependencies are eligible
- independent nodes may run in parallel
- node outputs are content-addressed
- conditional nodes declare their predicates as data
- skipped nodes are recorded in the trace
- the conflict resolver runs only after all contributing nodes for a field are known

#### Conflict Resolution

Global precedence classes:

```text
P0 Field Registry identity only
P1 Hard constraints
P2 Exposure context rules
P3 Profile defaults
P4 Intent overrides
P5 Plugin constraints
P6 Conflict resolver finalization
```

Conflict rules:

- Missing field identity means no decision can be emitted for that field.
- `blocked` dominates all states.
- Hard `hidden` dominates profile and intent visibility.
- Redaction can downgrade visibility but cannot be undone downstream.
- Intent can narrow or disable profile defaults.
- Intent cannot exceed hard constraints, tenant guardrails, budgets, or plugin
supported states.
- Plugin constraints can force render fallback or `summary_only`; they cannot reveal.
- Any unresolved conflict is a policy publication failure, not a runtime guess.

#### Caching Strategy

Cache units:

- artifact parse cache by artifact hash
- node output cache by node hash + input hash
- graph plan cache by graph hash + schema hash
- decision cache by policy set version + context hash when entity state is stable

Cache safety:

- caches are tenant-scoped
- replay can disable cache or require hash match
- cache hits are recorded in `ExecutionTrace`
- no cache key may omit policy version, plugin version, or entity state hash

### 12.7 Simulation, Diff, Explain, Replay

Simulation is mandatory for every policy change and every runtime preview.

#### simulate(policySet, context)

Runs a graph without mutation:

```text
simulate(policySet, context) -> SimulatedExposureDecision
```

It validates:

- artifact schemas
- graph topology
- plugin compatibility
- conflict rules
- tenant guardrails
- field-level decision output
- rendering compatibility if a plugin is attached

#### diff(previousDecision, newDecision)

Compares field-level behavior:

```text
diff(previousDecision, newDecision)
  addedVisibleFields
  removedVisibleFields
  newlyBlockedFields
  redactionChanges
  reasonCodeChanges
  pluginCompatibilityChanges
  blastRadiusSummary
```

Diff is required before policy promotion. Admin UI must show the diff as control-plane
truth, not merely show saved intent rows.

#### explain(fieldId)

Returns the full decision trace for one field:

```text
explain(fieldId)
  finalState
  winningNode
  losingNodes
  appliedArtifacts
  conflictResolution
  skippedNodes
  contextCoordinates
```

This answers operational questions like:

- why was this field hidden?
- why did the admin override not work?
- which policy version changed the result?
- did the Telegram plugin constrain rendering or did exposure policy block it?

#### replay(eventId, policyVersion)

Replay re-evaluates with pinned versions:

```text
replay(eventId, policyVersion)
  originalDecision
  replayedDecision
  driftReport
```

Replay requires:

- original context hash
- original entity state snapshot or stable state reference
- original policy set version
- original plugin version
- graph hash
- execution trace

Rollback is a policy-set operation, not a code deployment. The platform can roll a
tenant, workspace, surface, or profile back to a previous artifact set.

### 12.8 Runtime Flow

Runtime is graph-based:

```text
Consumer creates ExposureContext
  -> Decision Orchestrator requests policy set
  -> Version Resolver pins artifact versions
  -> Policy Graph Engine evaluates DAG
  -> Conflict Resolver emits ExposureDecision
  -> Audit & Replay Engine stores trace
  -> Canonical Enrichment fetches approved values only
  -> Surface Plugin renders approved payload
```

This is a runtime responsibility map, not a resolver pipeline. The only authority is
the graph decision.

### 12.9 Admin Control Plane

The Denali Settings UI becomes a true Control Plane console:

- shows active policy set, graph version, artifact versions, and plugin version
- shows field decisions from graph output, not persisted intent alone
- exposes `simulate`, `diff`, `explain`, and replay entry points
- edits policy artifacts through draft versions
- requires simulation before publish
- shows blast radius before promotion
- publishes immutable artifact versions
- supports rollback to prior policy set versions

Editable:

- draft exposure profiles
- draft intent overrides
- plugin constraint data where workspace-owned
- tenant guardrails within allowed bounds

Read-only:

- final runtime decision trace
- hard constraints from lower layers
- plugin renderer capability contracts
- previous immutable artifact versions
- replayed historical decisions

### 12.10 Migration Strategy

#### Phase 1 — Graph Visibility Layer

Build the graph model beside current runtime. Import current `FieldPolicy`,
`ExposureProfile`, and `ExposureIntent` as policy artifacts. No runtime behavior
changes. Admin preview reads graph simulation only.

Rollback: disable graph preview reads.

#### Phase 2 — Dual-Run Graph vs Legacy

For every eligible dispatch, run both legacy decision logic and Policy Graph Engine.
Store comparison traces. Legacy remains authoritative.

Guarantee: no outbound payload changes.

Rollback: stop shadow graph evaluation.

#### Phase 3 — Shadow Comparison Enforcement

Require parity thresholds per workspace, surface, and trigger before cutover. Classify
drift as expected, policy bug, plugin constraint mismatch, or legacy bug.

Guarantee: mismatches block cutover, not dispatch.

Rollback: keep legacy as runtime authority.

#### Phase 4 — Progressive Workspace Cutover

Promote graph authority per tenant/workspace/entity/surface. Runtime uses graph
decision output. Legacy is retained only for comparison.

Rollback: move that scope's active policy set pointer back or return authority pointer
to legacy. No code rollback required.

#### Phase 5 — Policy Version Rollback

Replace feature-flag rollback with policy-set rollback. Bad exposure behavior is fixed
by reverting active artifact versions.

Guarantee: rollback is auditable and scoped.

#### Phase 6 — Legacy Selector Removal

Remove runtime selectors that can independently decide fields. Legacy adapters may
remain only for historical replay and migration reads.

Guarantee: field selection is impossible without a graph decision.

#### Phase 7 — Plugin Purity Enforcement

Reject plugins that attempt to select fields, evaluate policy, fetch raw canonical
values, or bypass approved decisions.

Guarantee: integrations are transport/rendering only.

### 12.11 Enterprise Risk Analysis

#### Failure Modes

- Bad policy artifact hides critical fields.
- Bad profile default causes cross-surface behavior change.
- Plugin constraint misclassifies render support.
- Entity state snapshot is not replayable.
- Graph publication allows unresolved conflict.

Controls:

- simulation required before publish
- blast radius diff required before activation
- graph static validation
- policy-set rollback
- trace-first audit

#### Drift Risks

- runtime uses one policy version while admin preview uses another
- plugin version changes rendering without replay compatibility
- workspace defaults diverge from base graph unintentionally
- legacy shadow comparison becomes stale

Controls:

- pinned policy set version per decision
- plugin version included in decision hash
- graph compatibility contracts
- drift dashboards by workspace/surface/trigger

#### Policy Explosion Risks

- one-off profiles for every provider/event combination
- tenant overrides duplicated instead of composed
- condition branches encoded as separate artifacts unnecessarily

Controls:

- reusable graph modules
- profile templates with scoped intent overrides
- artifact dependency visualization
- policy linting for duplication and near-equivalent graphs

#### Plugin Abuse Risks

- plugin attempts to own visibility
- renderer fetches raw fields outside decision output
- plugin encodes provider-specific policy into constraints

Controls:

- plugin sandbox and contract tests
- no raw entity access in renderer
- plugin constraints reviewed as declarative artifacts
- policy graph rejects plugin nodes that reveal blocked fields

#### Cross-Tenant Leakage Risks

- shared cache key omits tenant or policy version
- artifact dependency references another tenant
- replay reads historical state across tenant boundary

Controls:

- tenant-scoped caches
- artifact registry namespace isolation
- static validation of dependency scopes
- replay authorization checks
- RLS on policy, trace, and decision storage

### 12.12 Final Architecture Principle

The end-state system is a **platform-grade policy control plane**:

- policy is data
- every decision is versioned
- every result is replayable
- every field has an explanation
- every plugin is a renderer/constraint provider only
- every admin edit is simulated before publish
- every rollback is a policy version rollback
- no integration owns field selection
- no engine code hardcodes surfaces, triggers, or audiences
- no sequential resolver pipeline is the source of truth

The Control Plane does not ask which integration sends which fields. It executes a
versioned policy graph for a context and emits a deterministic, explainable exposure
decision.

---

## 13. Denali UI Implementation Roadmap

This section maps the Control Plane architecture to concrete Denali workspace UI work.
It is implementation-oriented: routes, files, APIs, components, and phased delivery.

### 13.1 Denali Workspace Entry Points

Denali registers exposure settings through the workspace settings manifest:


| Item               | Location                                                              |
| ------------------ | --------------------------------------------------------------------- |
| Settings module id | `exposure`                                                            |
| Nav route          | `settings/exposure`                                                   |
| Ability            | `operator.settings.exposure`                                          |
| Manifest file      | `packages/workspaces/denali/src/settings/denali-settings.manifest.ts` |


Denali does **not** yet register `settings/exposure/control-plane` as its own settings
module. Control plane is a sub-route reached from the exposure hub page.

### 13.2 Current UI Inventory (as of 2026-06-28)

#### Routes


| Route                                       | Page file                                                     | Purpose                                                  | Status |
| ------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------- | ------ |
| `/{locale}/settings/exposure`               | `apps/web/app/(app)/settings/exposure/page.tsx`               | Exposure hub: edit intent per connection                 | Exists |
| `/{locale}/settings/exposure/control-plane` | `apps/web/app/(app)/settings/exposure/control-plane/page.tsx` | Read-only runtime truth + engine preview                 | Exists |
| `/{locale}/settings/integrations`           | `apps/web/app/(app)/settings/integrations/...`                | Legacy integration settings; still embeds delivery panel | Exists |


#### Core components


| Component                             | File                                                                                   | Role                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `ExposureSettingsClient`              | `apps/web/app/(app)/settings/exposure/exposure-settings-client.tsx`                    | Hub: connection list + embeds policy editor                         |
| `ExposureControlPlaneClient`          | `apps/web/app/(app)/settings/exposure/control-plane/exposure-control-plane-client.tsx` | Runtime badges, intent/profile, engine preview                      |
| `ExposureEnginePreviewPanel`          | `apps/web/src/exposure/ExposureEnginePreviewPanel.tsx`                                 | Per-field engine output (`state`, `reasonChain`, `appliedPolicies`) |
| `IntegrationEventDeliveryPolicyPanel` | `apps/web/app/(app)/settings/integrations/integration-event-delivery-policy-panel.tsx` | Write path: `surface`, `audience`, `trigger`, `selectedFieldIds`    |
| `ExposureFieldChecklist`              | `apps/web/src/exposure/ExposureFieldChecklist.tsx`                                     | Reusable field checklist                                            |
| `exposure-field-selection.ts`         | `apps/web/src/exposure/exposure-field-selection.ts`                                    | Pure selection/patch logic                                          |


#### Client + server data layer


| Concern            | Client                                                                       | Server proxy                                                                |
| ------------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Exposure catalog   | `apps/web/src/exposure/exposure-catalog-client.ts`                           | `apps/web/app/api/workspaces/[workspaceId]/exposure/catalog/route.ts`       |
| Control plane read | `apps/web/src/exposure/exposure-control-plane-client.ts`                     | `apps/web/app/api/workspaces/[workspaceId]/exposure/control-plane/route.ts` |
| SSR fetch          | `fetch-exposure-catalog.server.ts`, `fetch-exposure-control-plane.server.ts` | Proxies to API                                                              |


#### Backend APIs consumed by UI


| API                                                     | Handler                                  | Service                               |
| ------------------------------------------------------- | ---------------------------------------- | ------------------------------------- |
| `GET /workspaces/:workspaceId/exposure/catalog`         | `handleGetWorkspaceExposureCatalog`      | `exposure-catalog.service.ts`         |
| `GET /workspaces/:workspaceId/exposure/control-plane`   | `handleGetWorkspaceExposureControlPlane` | `exposure-control-plane.service.ts`   |
| `GET /exposure/engine-preview?connectionId=&eventType=` | `handleGetExposureEnginePreview`         | `exposure-engine-preview.service.ts`  |
| `PATCH` exposure intent (via integrations client)       | integrations routes                      | `patch-connection-exposure-intent.ts` |


Route registration: `apps/api/src/exposure/exposure.routes.ts`, mounted from `apps/api/src/app.ts`.

#### i18n

- `apps/web/messages/en/settings.json` → `settings.exposure`, `settings.exposure.controlPlane`
- `apps/web/messages/fa/settings.json` → same keys

#### Contract tests

- `apps/web/test/field-exposure-phase-5-ui.contract.spec.ts` — generic exposure UI ownership
- `apps/web/test/exposure-field-selection.spec.ts` — selection logic
- `apps/web/test/integrations-settings-logic.spec.ts` — integration panel embedding rules

### 13.2.1 Critical Alignment Corrections

The roadmap must stay aligned with code instead of describing the desired platform as
if it already exists.

1. `settings/exposure/control-plane` exists as a web sub-route, but Denali currently
  registers only `settings/exposure` in
   `packages/workspaces/denali/src/settings/denali-settings.manifest.ts`. The control
   plane must not be described as a first-class Denali settings module until the
   manifest adds a module such as `exposure_control_plane`.
2. `apps/web/src/exposure/exposure-control-plane-client.ts` currently parses
  `fieldExposureRuntimeMode` as `shadow | cutover`. Any UI copy or roadmap entry that
   says `legacy` or `parity` is future-state unless the API and parser expand.
3. The current control-plane response exposes `activeDeliverySelector` and
  `engineSelectedFieldIds`, but does not expose `legacyEligibleFieldIds`.
   Field-by-field hybrid comparison must first add backend response fields. Until then,
   UI may show selector source, not a fake comparison table.
4. `ExposureEnginePreviewPanel` currently renders preview data bundled inside the
  control-plane response. If the exposure hub needs live preview while the editor
   changes connection/event values, add a direct web client for
   `GET /exposure/engine-preview?connectionId=&eventType=`.
5. `simulate`, `diff`, `explain`, `replay`, policy graph versions, and plugin registry
  APIs do not exist in the current code path. UI phases D-G are intentionally blocked
   on backend artifacts.
6. `IntegrationEventDeliveryPolicyPanel` remains the current write surface. It must be
  treated as a transitional editor, not the final Control Plane editor.

### 13.3 Gap: UI vs Control Plane End-State


| Capability                    | Current Denali UI                                              | Target (Section 12)                                |
| ----------------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| Runtime truth                 | Control plane page shows engine mode, selector source, preview | Graph decision + policy set version                |
| Field decisions               | Engine preview per connection/event                            | Graph `explain(fieldId)` trace                     |
| Edit surface/audience/trigger | Panel exists; runtime may not honor all values                 | Edits become policy artifacts                      |
| Simulation before save        | Not implemented                                                | `simulate` + `diff` required                       |
| Replay                        | Not implemented                                                | `replay(eventId, policyVersion)`                   |
| Policy versioning             | Not shown in UI                                                | Immutable artifact versions visible                |
| Integration ownership         | Exposure hub still connection-centric                          | Surface plugins; integrations are entrypoints only |


### 13.4 UI Implementation Phases

Each phase aligns with backend migration phases in Section 12.10. UI should not claim
runtime authority ahead of backend cutover.

#### UI Phase A — Runtime Truth Visibility (done / stabilize)

**Goal:** Admin can see what runtime actually does, not only persisted intent.

**Files to maintain:**

- `settings/exposure/control-plane/page.tsx`
- `exposure-control-plane-client.tsx`
- `ExposureEnginePreviewPanel.tsx`
- `exposure-control-plane.service.ts` (read-only backend)

**Deliverables:**

- Show per connection: `ExposureIntent`, `ExposureProfile`, effective coordinates,
`fieldExposureRuntimeMode`, `activeDeliverySelector`
- Engine preview: `fieldId → state, reasonChain, appliedPolicies`
- Link from exposure hub → control plane

**Exit:** Operator can answer "what will dispatch use?" without reading logs, and every
displayed value is traceable to the current control-plane API response.

#### UI Phase B — Effective vs Stored Labels

**Goal:** Make inactive controls explicit when stored intent ≠ runtime truth.

**Files to change:**

- `integration-event-delivery-policy-panel.tsx`
- `exposure-control-plane-client.tsx`
- `exposure-control-plane-client.ts` (types for `effective`* vs `stored*`)

**Deliverables:**

- Badge/label when `surface` / `audience` / `trigger` are lookup-only at runtime
- Show stored intent coordinates next to effective runtime coordinates
- Show `activeDeliverySelector` whenever runtime remains hybrid
- Show `engineSelectedFieldIds` from preview
- Do not show `legacyEligibleFieldIds` until backend exposes that field explicitly
- Disable or annotate controls that do not affect final fields yet

**Exit:** No silent mismatch between saved settings and runtime behavior.

#### UI Phase C — Engine Preview as Primary Read Model

**Goal:** Control plane truth panel leads; intent editor follows preview.

**Files to change:**

- `exposure-settings-client.tsx` — embed preview beside editor
- `ExposureEnginePreviewPanel.tsx` — support inline + full-page modes
- Add a direct web client for `GET /exposure/engine-preview?connectionId=&eventType=`
before attempting live preview in the editor

**Deliverables:**

- On event type / connection change, refresh preview immediately
- Summary counts: `visibleCount`, `hiddenCount`, `blockedCount`
- Highlight fields changed by admin selection vs policy

**Exit:** Admin edits with preview visible before save, but the UI still labels preview
as advisory until runtime moves to engine authority.

#### UI Phase D — Simulation Console (read-only first)

**Goal:** Introduce `simulate` / `diff` UX before write APIs exist.

**New files (proposed):**

- `apps/web/app/(app)/settings/exposure/simulate/page.tsx`
- `apps/web/src/exposure/ExposureSimulationPanel.tsx`
- `apps/web/src/exposure/exposure-simulation-client.ts`
- `apps/web/app/api/workspaces/[workspaceId]/exposure/simulate/route.ts` (proxy)

**Backend dependency:** `POST /exposure/simulate`, `POST /exposure/diff` (Section 12.7).

**Deliverables:**

- Draft intent/profile change → simulated decision map
- Side-by-side diff vs current runtime decision
- Block "publish" until simulation passes (when write path lands)

**Exit:** No policy promotion without visible blast radius. This phase cannot start
until backend simulation/diff APIs are implemented.

#### UI Phase E — Policy Artifact Editor

**Goal:** Move from connection-owned delivery panel to generic exposure artifact editor.

**Files to evolve:**

- Split write logic out of `integration-event-delivery-policy-panel.tsx` into
`apps/web/src/exposure/ExposureIntentEditor.tsx`
- Keep integration page as thin embed only
- Add profile editor: `ExposureProfileEditor.tsx`

**Denali manifest:**

- Optionally add `exposure_control_plane` module with route `settings/exposure/control-plane`
once it supports edit + simulate, not read-only only

**Deliverables:**

- Edit `mode: inherit_profile | override_fields | disabled`
- Edit profile defaults (workspace-scoped)
- Version label on every saved artifact
- Integrations settings link to exposure editor, not own catalog

**Exit:** Field checklist reusable for non-integration surfaces (wizard, public page).
Do not mark this phase complete while `IntegrationEventDeliveryPolicyPanel` remains the
only write surface.

#### UI Phase F — Explain & Replay Console

**Goal:** Stripe-level operability in admin UI.

**New files (proposed):**

- `apps/web/src/exposure/ExposureExplainDrawer.tsx`
- `apps/web/src/exposure/ExposureReplayPanel.tsx`
- Route: `settings/exposure/audit` or tab inside control plane

**Deliverables:**

- `explain(fieldId)` — full node trace, winning/losing policies
- `replay(eventId, policyVersion)` — historical vs replayed diff
- Policy-set rollback action (scoped, audited)

**Exit:** "Why did this field disappear?" answered in UI without engineering access.

#### UI Phase G — Surface Plugin Registry UI

**Goal:** Show registered surface plugins and constraints; no field selection in plugin UI.

**New files (proposed):**

- `apps/web/app/(app)/settings/exposure/surfaces/page.tsx`
- `apps/web/src/exposure/SurfacePluginRegistryPanel.tsx`

**Deliverables:**

- List `SurfacePlugin` registrations: `telegram`, `email`, `pdf`, etc.
- Show renderer capabilities and constraint schema
- Read-only until plugin registry API exists

**Exit:** Integrations page no longer implies provider owns exposure policy.

### 13.5 Recommended File Layout (target)

```text
apps/web/
  app/(app)/settings/exposure/
    page.tsx                          # hub
    exposure-settings-client.tsx
    control-plane/
      page.tsx                        # runtime truth
      exposure-control-plane-client.tsx
    simulate/
      page.tsx                        # Phase D
    audit/
      page.tsx                        # Phase F
    surfaces/
      page.tsx                        # Phase G
  src/exposure/
    ExposureFieldChecklist.tsx
    ExposureEnginePreviewPanel.tsx
    ExposureIntentEditor.tsx          # Phase E (extract from integration panel)
    ExposureProfileEditor.tsx         # Phase E
    ExposureSimulationPanel.tsx       # Phase D
    ExposureExplainDrawer.tsx         # Phase F
    exposure-field-selection.ts
    exposure-control-plane-client.ts
    exposure-simulation-client.ts     # Phase D
    fetch-*.server.ts

packages/workspaces/denali/
  src/settings/denali-settings.manifest.ts   # nav modules
  src/exposure/                                # future: Denali profile seeds, not UI
```

### 13.6 Denali-Specific Rules

1. **Workspace package owns profiles/policies as data**, not React UI. UI stays in `apps/web`.
2. **Denali manifest** controls nav visibility and abilities; add new routes there when promoting control plane from sub-route to first-class module.
3. **Do not reintroduce integration-owned catalogs** in Denali integration settings; use `exposure/catalog` API.
4. **Control plane page stays read-only** until backend single-authority cutover completes; then enable draft → simulate → publish flow.
5. **Contract tests** must be extended per UI phase (`field-exposure-phase-5-ui.contract.spec.ts` or new phase guards).

### 13.7 UI / Backend Dependency Matrix


| UI phase                | Requires backend                                                         |
| ----------------------- | ------------------------------------------------------------------------ |
| A — Runtime visibility  | `control-plane` + `engine-preview` (exists)                              |
| B — Effective vs stored | `control-plane` exposes stored/effective coordinates + selector metadata |
| C — Preview-primary     | Direct web client for stable `engine-preview` per connection/event       |
| D — Simulation          | `simulate`, `diff` APIs + policy graph                                   |
| E — Artifact editor     | `ExposureIntent` / `ExposureProfile` versioned write APIs                |
| F — Explain/replay      | Audit trace storage + replay API                                         |
| G — Surface plugins     | Plugin registry read API                                                 |


### 13.8 Trust Gates

These gates make the route clear and reliable:

1. Do not claim Control Plane authority while `activeDeliverySelector` can be
  `legacy_eligible_field_ids`.
2. Do not claim `surface`, `audience`, or `trigger` are runtime-effective until the
  backend dispatch path consumes the effective values for final decision input.
3. Do not display field-by-field legacy comparison until the backend returns
  `legacyEligibleFieldIds` or equivalent selector evidence.
4. Do not add publish/edit affordances for graph policies until simulation and diff
  APIs exist.
5. Every new UI phase must add or update a contract test under `apps/web/test/`.
6. Denali workspace code should register routes and provide data manifests; React UI
  and fetch clients remain in `apps/web`.

### 13.9 Immediate Next Steps (actionable)

1. Complete UI Phase B first: label inactive `surface` / `audience` / `trigger` when
  runtime ignores them.
2. Extend the control-plane API only if needed to expose stored vs effective values and
  selector evidence; avoid deriving runtime truth in the web layer.
3. Add a direct engine-preview web client before embedding live preview in
  `exposure-settings-client.tsx`.
4. Add `exposure_control_plane` to `denali-settings.manifest.ts` only when it becomes
  more than a read-only sub-route.
5. Document Denali route/component ownership in `docs/architecture/field-exposure-system.md`
  before implementation that touches protected app code.
6. Defer simulation/replay/plugin registry UI until the graph kernel APIs exist; do not
  fake engine logic in the web layer.

---

## 14. Formal Policy Graph Execution Specification

This section formalizes Policy Graph Execution Rules for implementation. It is grounded in:

- current repository behavior (`resolveFieldExposureDecision`, `resolveExposureDecision`,
`dispatchIntegrationDomainEvent`)
- enterprise control-plane patterns: deterministic DAG evaluation, precedence ladders,
most-restrictive-wins conflict resolution, fail-closed publication

References (external):

- [Mneme precedence semantics](https://mnemehq.com/concepts/precedence-semantics/) —
total ordering, compile-time ambiguity rejection, auditable winner citation
- [Raigo conflict resolution](https://github.com/PericuloLimited/raigo/blob/main/docs/conflict-resolution.md) —
most-restrictive action hierarchy with deterministic tie-breakers

### 14.1 Implementation Status


| Capability                  | Current code                                                                                              | Target graph kernel                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Per-field decision function | `resolveFieldExposureDecision` in `packages/platform-core/src/exposure/field-exposure-decision-engine.ts` | `PolicyGraphEngine.evaluate()`            |
| Graph structure             | Implicit linear chain inside one function                                                                 | Explicit `PolicyGraph` DAG artifact       |
| Field fan-out               | `buildFieldExposureEngineDecisionMap` loops catalog                                                       | `decision_projection_node` over field set |
| Outer selector              | `resolveExposureDecision` + `resolveDeliveryFieldPolicy` hybrid                                           | Graph-only; legacy adapter outside kernel |
| Runtime authority switch    | `resolveActiveDeliveryFieldIds` in `dispatch-integration-domain-event.ts`                                 | Policy-set pointer + cutover scope only   |
| Plugin constraints          | Not in engine                                                                                             | `plugin_constraint_node` at P5            |
| Version pinning             | Partial (`profile.version`, `intent.version`)                                                             | Full `PolicySet` hash                     |
| Replay / simulate           | Preview only (`exposure-engine-preview.service.ts`)                                                       | `SimulationEngine` + `AuditReplayEngine`  |


The rules below define the **target kernel**. Section 14.11 maps today's linear engine as a
degenerate graph so migration does not require a behavioral cliff.

### 14.2 Graph Model (Formal)

A `PolicyGraph` is a directed acyclic graph:

```text
G = (N, E, R, C)

N  = finite set of PolicyNode instances
E  = directed edges (dependency, scope, precedence)
R  = root evaluation contexts (field-scoped or batch-scoped)
C  = conflict contract (precedence lattice + tie-breakers)
```

Edge kinds:


| Edge kind        | Meaning                               | Constraint                       |
| ---------------- | ------------------------------------- | -------------------------------- |
| `depends_on`     | Node B requires output of node A      | Must be acyclic                  |
| `scopes_to`      | Node applies only within parent scope | Parent must complete first       |
| `precedes`       | Declared precedence class ordering    | Cannot contradict global lattice |
| `feeds_conflict` | Output enters conflict resolver       | Must declare `precedenceClass`   |


Publication invariants (compile-time, fail-closed):

1. `G` has no cycles.
2. Every `field_decision` path includes exactly one `conflict_resolution_node`.
3. Every node references a resolvable `artifactRef` + `schemaRef`.
4. No cross-tenant `artifactRef`.
5. Any ambiguous conflict the lattice cannot resolve → **publication error**, not runtime guess
  (Mneme compile-time rule).
6. Plugin nodes cannot emit `visible` when any P1 node emitted `hidden` or `blocked`.

### 14.3 Node Contract Definition

Every graph node is a **versioned, schema-validated, pure evaluator**. The kernel does not
call integration code, workspace plugins, or DB clients from inside `evaluate()`. Nodes
consume pinned snapshot inputs only.

This section defines the formal contract all nodes MUST implement, then specifies each
registered node type with input/output schemas and current-code mapping.

#### 14.3.1 Core Contract Types

##### PolicyNodeRegistration

Published into the Policy Registry with the graph artifact:

```text
PolicyNodeRegistration
  nodeId: string                          # unique within graph version
  nodeType: NodeType                      # kernel enum; extensible via registry
  precedenceClass: P0 | P1 | P2 | P3 | P4 | P5 | P6 | PX
  artifactRef?: ArtifactRef               # required for policy-bearing nodes
  schemaRef: string                       # input+output bundle schema id
  deterministicFunctionRef: string        # e.g. "core/field_identity/v1"
  purity: "pure" | "read_only_snapshot"
  earlyTermination: boolean
  feedsConflict: boolean
  fieldScoped: boolean                    # true = evaluated once per fieldId
  dependencies: string[]                  # nodeIds, edge kind depends_on
  condition?: NodeCondition               # declarative predicate; skip if false
  cacheKeyInputs: string[]                # paths into NodeEvaluationInput
```

`PX` is reserved for orchestration-only nodes (`decision_projection_node`) that do not
enter the conflict lattice.

##### NodeEvaluationInput

Assembled by `DecisionOrchestrator` before any node runs:

```text
NodeEvaluationInput
  envelope: CanonicalEvaluationEnvelope   # Section 14.5.1
  fieldId?: string                         # present when fieldScoped=true
  snapshot:
    registryField?: RegistryFieldSnapshot
    entityState: CanonicalEntityState
    fieldPolicy?: FieldPolicySnapshot
    exposurePolicy?: ExposurePolicySnapshot
    exposureIntent?: ExposureIntentSnapshot
    pluginConstraints?: PluginConstraintSnapshot
  upstream: Record<nodeId, NodeOutput>     # dependency outputs only
```

##### NodeOutput (required shape)

```text
NodeOutput
  nodeId: string
  nodeType: NodeType
  artifactRevisionId?: string
  outputHash: string                       # Section 14.5.9
  facts: Record<string, unknown>           # schema-validated payload
  decision?: ExposureDecisionState          # optional partial decision
  reasonCodes: string[]                    # machine codes; sorted on emit
  appliedArtifactIds: string[]             # sorted on emit
  terminated: boolean                      # true => short-circuit field subgraph
  skipped: boolean                         # condition false or dependency blocked
  error?: NodeEvaluationError              # only for orchestrator-level failures
```

##### NodeEvaluationError

```text
NodeEvaluationError
  code:
    | NODE_INPUT_SCHEMA_VIOLATION
    | NODE_OUTPUT_SCHEMA_VIOLATION
    | ARTIFACT_NOT_FOUND
    | ARTIFACT_TENANT_SCOPE_VIOLATION
    | UPSTREAM_TERMINATED
    | CONFLICT_UNRESOLVED
    | PLUGIN_CONSTRAINT_VIOLATION
  message: string
  nodeId: string
  retryable: boolean                       # always false for evaluate()
```

**Fail-closed:** any `NodeEvaluationError` during runtime evaluation for a field yields
`blocked` for that field with reason `node_error:{code}` unless P0 identity already
terminated as `hidden`.

##### evaluate() signature

```text
evaluate(
  registration: PolicyNodeRegistration,
  input: NodeEvaluationInput,
  options: { mode: runtime | simulate | replay }
) -> NodeOutput
```

Invariants:

1. `evaluate` MUST be referentially transparent for fixed `(registration, input, options)`.
2. Output MUST validate against `outputContract` schema before return.
3. `outputHash` MUST be computed from canonical output (Section 14.5.9).
4. `reasonCodes` MUST use stable namespaced codes (`registry_check:missing`, not free text).
5. `appliedArtifactIds` MUST cite immutable artifact revisions only.

#### 14.3.2 Publication-Time Node Validation

Before a graph is publishable, each node registration is validated:


| Check                                                          | Failure                        |
| -------------------------------------------------------------- | ------------------------------ |
| `nodeId` unique in graph                                       | `GRAPH_DUPLICATE_NODE_ID`      |
| `dependencies` reference existing nodes                        | `GRAPH_MISSING_DEPENDENCY`     |
| `precedenceClass` matches `nodeType` allowlist                 | `GRAPH_PRECEDENCE_MISMATCH`    |
| `artifactRef` tenant scope matches graph tenant                | `GRAPH_CROSS_TENANT_ARTIFACT`  |
| `schemaRef` resolvable                                         | `GRAPH_UNKNOWN_SCHEMA`         |
| `deterministicFunctionRef` registered in kernel                | `GRAPH_UNKNOWN_EVALUATOR`      |
| field subgraph includes exactly one `conflict_resolution_node` | `GRAPH_MISSING_CONFLICT_NODE`  |
| `plugin_constraint_node` has `depends_on` conflict or P4 node  | `GRAPH_PLUGIN_ORDER_VIOLATION` |
| conditional node declares total predicate                      | `GRAPH_NON_TOTAL_CONDITION`    |


#### 14.3.3 Node Type Registry (Formal)


| nodeType                   | P   | fieldScoped | earlyTermination | feedsConflict | artifactRef               |
| -------------------------- | --- | ----------- | ---------------- | ------------- | ------------------------- |
| `field_identity_node`      | P0  | yes         | yes              | yes           | registry snapshot         |
| `hard_constraint_node`     | P1  | yes         | yes              | yes           | FieldPolicy artifact      |
| `tenant_guardrail_node`    | P1  | no          | yes              | yes           | tenant guardrail artifact |
| `budget_node`              | P1  | no          | yes              | yes           | budget artifact           |
| `context_rule_node`        | P2  | yes         | yes              | yes           | ExposurePolicy artifact   |
| `redaction_transform_node` | P2  | yes         | no               | yes           | redaction artifact        |
| `profile_default_node`     | P3  | no          | no               | yes           | ExposureProfile artifact  |
| `intent_override_node`     | P4  | no          | yes              | yes           | ExposureIntent artifact   |
| `plugin_constraint_node`   | P5  | yes         | no               | yes           | SurfacePlugin artifact    |
| `conflict_resolution_node` | P6  | yes         | no               | yes           | none (kernel builtin)     |
| `decision_projection_node` | PX  | no          | no               | no            | none                      |


#### 14.3.4 Per-Node Contracts

Each subsection lists: **inputs**, **outputs**, **reason codes**, **termination**, **current code**.

---

##### `field_identity_node` (P0)

**Purpose:** Assert field exists in registry snapshot. Identity only — never decides exposure.

**deterministicFunctionRef:** `core/field_identity/v1`

**Input schema `FieldIdentityInput`:**

```json
{
  "fieldId": "string",
  "registryField": {
    "exists": "boolean",
    "tags": ["string"]
  }
}
```

**Output schema `FieldIdentityOutput`:**

```json
{
  "exists": "boolean",
  "canonicalPath": "string | null",
  "kind": "string | null"
}
```

**Evaluation rules:**

```text
if registryField undefined -> reason registry_check:pending; no termination
if registryField.exists=false -> decision hidden; terminated=true
else -> facts.exists=true; reason registry_check:exists
```

**Current code:** `resolveFieldExposureDecision` lines 38–45.

---

##### `hard_constraint_node` (P1)

**Purpose:** Apply entity/workspace FieldPolicy lower bound for one field.

**deterministicFunctionRef:** `core/hard_constraint/v1` → delegates to `resolveFieldState`

**Input schema `HardConstraintInput`:**

```json
{
  "fieldId": "string",
  "tenantId": "string",
  "workspaceType": "string",
  "entityState": "FieldPolicyEntityState",
  "fieldPolicy": {
    "surface": "FieldPolicySurface",
    "definitions": ["FieldDefinition"],
    "rules": ["FieldPolicyRule"]
  }
}
```

**Output schema `HardConstraintOutput`:**

```json
{
  "fieldPolicyState": "hidden | visible | required | readonly",
  "reasonRuleId": "string | null",
  "exposureLowerBound": "hidden | visible"
}
```

**Mapping FieldPolicy state → exposure lower bound:**


| fieldPolicyState | exposureLowerBound | Notes                                       |
| ---------------- | ------------------ | ------------------------------------------- |
| `hidden`         | `hidden`           | terminates subgraph                         |
| `visible`        | `visible`          | may continue                                |
| `readonly`       | `visible`          | exposure may show; renderer marks read-only |
| `required`       | `visible`          | exposure may show; renderer marks required  |


**Reason codes:** `field_policy_check:pending`, `field_policy_check:no_state:{surface}`,
`field_policy_check:{state}:{surface}`

**Applied artifacts:** `field_policy:{reasonRuleId}` when present.

**Termination:** `exposureLowerBound === hidden` → `terminated=true`, `decision=hidden`.

**Current code:** lines 47–72; rule winner via `compareRules` in `resolve-field-state.ts`.

**Known gap:** engine uses `FIELD_EXPOSURE_ENGINE_FIELD_POLICY_SURFACE = "delivery"` in
`build-field-exposure-engine-input.ts` — node input MUST use explicit surface from envelope,
not hardcoded delivery surface, in kernel target.

---

##### `context_rule_node` (P2)

**Purpose:** Context-specific allow/deny from ExposurePolicy / profile-backed allowed set.

**deterministicFunctionRef:** `core/context_rule/v1`

**Input schema `ContextRuleInput`:**

```json
{
  "fieldId": "string",
  "surfaceKey": "string",
  "audienceKey": "string",
  "trigger": "NormalizedExposureTrigger",
  "exposurePolicy": {
    "allowedFieldIds": ["string"],
    "profileId": "string | null"
  }
}
```

**Output schema `ContextRuleOutput`:**

```json
{
  "allowed": "boolean",
  "profileId": "string | null"
}
```

**Evaluation:**

```text
allowed = fieldId ∈ sort(exposurePolicy.allowedFieldIds)
if not allowed -> decision hidden; terminated=true
```

**Reason codes:** `exposure_policy_check:pending`, `exposure_policy_check:not_allowed`,
`exposure_policy_check:allowed`

**Applied artifacts:** `exposure_profile:{profileId}` when profileId present.

**Current code:** lines 74–91; snapshot built by `mapExposurePolicyForEngine` in
`build-field-exposure-engine-input.ts`.

**Semantic split (target):** `profile_default_node` supplies defaults; `context_rule_node`
evaluates ExposurePolicy rules. Today both collapse into `exposurePolicy` snapshot.

---

##### `profile_default_node` (P3)

**Purpose:** Emit profile default field set and template metadata. Does not terminate per
field; supplies facts consumed by P2 and P4.

**deterministicFunctionRef:** `core/profile_default/v1`

**Input schema `ProfileDefaultInput`:**

```json
{
  "profile": {
    "id": "string",
    "version": "string",
    "defaultFieldIds": ["string"],
    "defaultTemplateId": "string | null",
    "surface": "string",
    "audience": "string",
    "trigger": "string"
  }
}
```

**Output schema `ProfileDefaultOutput`:**

```json
{
  "defaultFieldIds": ["string"],
  "defaultTemplateId": "string | null",
  "profileId": "string",
  "profileVersion": "string"
}
```

**Normalization:** `defaultFieldIds` sorted unique ascending before emit.

**Current code:** `ExposureProfile` type in `exposure-profile.ts`; seeded via
`resolveSeededExposureProfile`; mapped into engine via `mapExposurePolicyForEngine` when
intent mode is `inherit_profile`.

---

##### `intent_override_node` (P4)

**Purpose:** Apply admin override — disable exposure or narrow selected fields.

**deterministicFunctionRef:** `core/intent_override/v1`

**Input schema `IntentOverrideInput`:**

```json
{
  "fieldId": "string",
  "exposureIntent": {
    "mode": "inherit_profile | override_fields | disabled",
    "selectedFieldIds": ["string"] | null,
    "templateOverrideId": "string | null",
    "version": "string"
  }
}
```

**Output schema `IntentOverrideOutput`:**

```json
{
  "mode": "inherit_profile | override_fields | disabled",
  "selected": "boolean | null",
  "templateOverrideId": "string | null"
}
```

**Evaluation:**

```text
mode=disabled -> decision blocked; terminated=true
mode=override_fields AND fieldId ∉ selectedFieldIds -> decision hidden; terminated=true
mode=override_fields AND fieldId ∈ selectedFieldIds -> selected=true
mode=inherit_profile -> pass-through; no decision
```

**Reason codes:** `exposure_intent_override:{mode}`, `exposure_intent_override:not_selected`,
`exposure_intent_override:selected`

**Applied artifacts:** `exposure_intent:disabled`, `exposure_intent:override_not_selected`

**Current code:** lines 93–108; intent mapped by `mapExposureIntentForEngine`; persisted
shape in `exposure-intent.ts`.

---

##### `plugin_constraint_node` (P5)

**Purpose:** Apply surface plugin render constraints. May downgrade visibility form, never
raise restrictiveness.

**deterministicFunctionRef:** `plugin/constraint/v1`

**Input schema `PluginConstraintInput`:**

```json
{
  "fieldId": "string",
  "surfaceKey": "string",
  "plugin": {
    "pluginId": "string",
    "pluginVersion": "string",
    "supportedDecisionStates": ["visible", "summary_only", "redacted"],
    "maxPayloadShape": "object",
    "forbiddenFieldKinds": ["string"]
  },
  "upstreamDecision": "ExposureDecisionState"
}
```

**Output schema `PluginConstraintOutput`:**

```json
{
  "renderMode": "visible | summary_only | redacted | blocked_render",
  "constraintCodes": ["string"]
}
```

**Rules:**

- If `upstreamDecision` is `hidden` or `blocked` → `skipped=true` (no resurrection).
- If field `kind` ∈ `forbiddenFieldKinds` → `renderMode=blocked_render`.
- If plugin cannot render full value → downgrade to `summary_only` if allowed by contract.
- Plugin node NEVER sets `decision=visible` when upstream was non-visible.

**Current code:** **Not implemented** in engine. Target-only node.

---

##### `redaction_transform_node` (P2)

**Purpose:** Transform allowed fields to `redacted` or `summary_only` based on policy.

**deterministicFunctionRef:** `core/redaction_transform/v1`

**Input:** upstream partial decision + redaction artifact rules.

**Output:** `decision` ∈ `{ redacted, summary_only, hidden }` or pass-through.

**Current code:** **Not implemented** as separate step; state exists in types only.

---

##### `tenant_guardrail_node` / `budget_node` (P1)

**Purpose:** Tenant-wide hard limits (forbidden surfaces, max visible fields, PII budget).

**Output:** `decision=blocked` or guardrail facts.

**Current code:** **Not implemented** in exposure engine. Target enterprise nodes.

---

##### `conflict_resolution_node` (P6)

**Purpose:** Merge all `feedsConflict` upstream outputs into one `FieldDecision`.

**deterministicFunctionRef:** `core/conflict_resolution/v1`

**Input schema `ConflictResolutionInput`:**

```json
{
  "fieldId": "string",
  "candidates": [
    {
      "nodeId": "string",
      "precedenceClass": "P0..P5",
      "decision": "ExposureDecisionState",
      "artifactRevisionId": "string | null",
      "reasonCodes": ["string"],
      "appliedArtifactIds": ["string"]
    }
  ]
}
```

**Output schema `FieldDecision`:**

```json
{
  "fieldId": "string",
  "state": "visible | hidden | redacted | summary_only | blocked",
  "reasonChain": ["string"],
  "appliedPolicies": ["string"],
  "winningNodeId": "string",
  "losingNodeIds": ["string"],
  "conflictResolution": "lattice | tie_break | fail_closed"
}
```

**Algorithm:** Section 14.5.5 precedence-class merge + Section 14.5.6 tie-break ladder.

**Current code:** **Not a separate node** — early returns in `resolveFieldExposureDecision`
are the implicit resolver. Migration MUST extract to this contract without behavior change.

---

##### `decision_projection_node` (PX)

**Purpose:** Batch orchestration — iterate field catalog, invoke per-field subgraph, collect
`FieldDecision` map.

**deterministicFunctionRef:** `core/decision_projection/v1`

**Input:**

```json
{
  "fieldIds": ["string"],
  "perFieldSubgraphRef": "string"
}
```

**Output:**

```json
{
  "fields": { "fieldId": "FieldDecision" },
  "evaluatedFieldCount": "number"
}
```

**Rules:**

- `fieldIds` MUST be pre-sorted.
- Subgraph evaluation order independent per field (embarrassingly parallel).
- Aggregate `deterministicReplayKey` from per-field outputs (Section 14.5.9).

**Current code:** `buildFieldExposureEngineDecisionMap` in
`build-field-exposure-engine-input.ts` — loop over `registryCatalog` calling
`resolveFieldExposureDecision` per field.

#### 14.3.5 Node Condition Language

Optional `NodeCondition` is declarative JSON, not code:

```text
NodeCondition
  | { "op": "always" }
  | { "op": "eq", "path": "$.envelope.surfaceKey", "value": "telegram" }
  | { "op": "in", "path": "$.fieldId", "values": ["..."] }
  | { "op": "and", "args": [NodeCondition, ...] }
  | { "op": "not", "arg": NodeCondition }
```

Skipped nodes emit `skipped=true` and appear in `ExecutionTrace.skippedNodes`.

#### 14.3.6 Reason Code and Applied Policy Namespaces

Stable prefixes (CI-enforced):


| Prefix                      | Owner node                 |
| --------------------------- | -------------------------- |
| `registry_check:`           | `field_identity_node`      |
| `field_policy_check:`       | `hard_constraint_node`     |
| `exposure_policy_check:`    | `context_rule_node`        |
| `exposure_intent_override:` | `intent_override_node`     |
| `plugin_constraint:`        | `plugin_constraint_node`   |
| `guardrail:`                | `tenant_guardrail_node`    |
| `budget:`                   | `budget_node`              |
| `conflict:`                 | `conflict_resolution_node` |
| `node_error:`               | orchestrator               |


Applied policy ids:

```text
field_policy:{ruleId}
exposure_profile:{profileId}
exposure_intent:{mode}
plugin:{pluginId}@{pluginVersion}
guardrail:{artifactId}
```

#### 14.3.7 Transitional Linear Graph as Node Chain

Current `resolveFieldExposureDecision` is equivalent to this published subgraph:

```text
field_identity
  -> hard_constraint
  -> context_rule
  -> intent_override
  -> (implicit visible default)
```

Missing nodes vs target kernel: `profile_default` (folded into context snapshot),
`conflict_resolution` (implicit returns), `plugin_constraint`, `decision_projection` (outer loop).

**Extraction plan:**


| Step | Action                                                                     |
| ---- | -------------------------------------------------------------------------- |
| 1    | Register five evaluators matching lines 38–108                             |
| 2    | Golden-test equivalence per field                                          |
| 3    | Add `conflict_resolution_node`; remove early returns                       |
| 4    | Split `mapExposurePolicyForEngine` into `profile_default` + `context_rule` |
| 5    | Wrap loop in `decision_projection_node`                                    |


#### 14.3.8 Node Contract Acceptance Criteria

Node contracts are complete when:

1. Every `nodeType` has JSON Schema for input and output published in Policy Registry.
2. Every `deterministicFunctionRef` has kernel unit tests + golden fixtures.
3. `evaluate()` violations return `NodeEvaluationError`, never silent fallback.
4. `ExecutionTrace` records `nodeId`, `artifactRevisionId`, `outputHash` per evaluation.
5. `explain(fieldId)` cites `winningNodeId` from `conflict_resolution_node` output.
6. No node performs field selection outside its precedence class authority.

**Purity rule:** evaluation nodes are pure functions of pinned artifacts + context snapshot.
No network, no DB reads inside `evaluate()` except through pre-resolved snapshot inputs
provided by `DecisionOrchestrator`.

### 14.4 Policy Graph Execution Algorithm

Execution is **wave-based topological traversal**, not sequential if/else.

#### Phase 0 — Pin inputs

```text
policySet  = VersionResolver.resolve(context)
graph      = PolicyRegistry.loadGraph(policySet.graphVersion)
snapshot   = SnapshotBuilder.build(context)   # entity state, registry, artifacts
contextHash = hash(policySet, context, snapshot)
```

#### Phase 1 — Plan waves

```text
waves = topologicalLayers(graph, edgeKind=depends_on)
```

Nodes in the same wave have no unresolved `depends_on` edges to each other and MAY run in
parallel. Tie-breaking for logging only: sort by `nodeId` lexicographically.

#### Phase 2 — Evaluate waves

For each wave `w` in `waves` (in order):

```text
for each node n in sort(w, by=nodeId):
  if all dependencies satisfied:
    inputs = collectOutputs(dependencies(n))
    if condition(n, inputs) is false:
      mark skipped in ExecutionTrace
      continue
    output = evaluate(n, inputs, snapshot)
    store output in nodeOutputStore
    if output.terminated and n.earlyTermination:
      mark shortCircuited(fieldId) in ExecutionTrace
```

**Early termination rule (current engine behavior, preserved):**

- P0 `field_identity_node` with `exists=false` → terminate field subgraph; emit `hidden`.
- P1 `hard_constraint_node` with `hidden` → terminate; downstream visibility nodes skipped.
- P4 `intent_override_node` with `mode=disabled` → emit `blocked`; terminate.

This matches today's `resolveFieldExposureDecision` early returns at lines 42, 70, 97.

#### Phase 3 — Conflict resolution

For each `fieldId` in evaluation scope:

```text
candidates = collect node outputs where feeds_conflict(fieldId)
final = ConflictResolver.resolve(candidates, lattice=C)
emit FieldDecision(fieldId, final)
```

#### Phase 4 — Project batch decision

```text
ExposureDecision = {
  fields: map fieldId -> FieldDecision,
  graphHash,
  policySetVersion,
  contextHash,
  deterministicReplayKey: hash(all node outputHashes + final decisions)
}
```

### 14.5 Deterministic Evaluation Model

This subsection is the formal determinism contract. A policy graph evaluation is
**deterministic** iff:

```text
∀ evaluation E:
  evaluate(policySet, context, options) = evaluate(policySet, context, options)

where policySet, context, and snapshot inputs are byte-identical after canonicalization.
```

No randomness, no wall-clock reads inside nodes, no map/set iteration order dependence, no
environment-specific locale collation outside `en-US` / `Intl.Collator('en', { sensitivity: 'variant' })`,
and no dependency on database row return order.

Industry alignment:

- **Most-restrictive-wins** state lattice (Raigo) for merged exposure outcomes.
- **Precedence ladder** with compile-time ambiguity rejection (Mneme) for artifact ties.
- **Graph-first authoritative decision** with full trace (Rainbird-style); LLM/renderers never
change exposure state.

#### 14.5.1 Canonical Evaluation Envelope

Every evaluation MUST be reducible to this envelope before hashing or replay:

```text
CanonicalEvaluationEnvelope
  policySetVersion: string
  graphHash: string
  tenantId: string
  workspaceType: string
  entityType: string
  entityId: string
  surfaceKey: string
  audienceKey: string
  triggerKey: string
  requestTime: string            # ISO-8601 UTC, pinned
  entityState: CanonicalEntityState
  registrySnapshotHash: string
  artifactRevisionIds: sorted map role -> revisionId
  pluginVersion?: string
  evaluationMode: runtime | simulate | replay
  fieldScope: sorted fieldId[]
```

**Current code partial envelope** (transitional):


| Envelope field         | Current source                                                               | Gap                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `tenantId`             | `buildFieldExposureEngineDecisionInput`                                      | Present                                                                                |
| `surfaceKey`           | provider string in preview/dispatch                                          | Present                                                                                |
| `audienceKey`          | hardcoded `"external_channel"` in `build-field-exposure-engine-input.ts:126` | **Not context-driven**                                                                 |
| `triggerKey`           | `normalizeIntegrationEventType(eventType)`                                   | **Ignores stored intent trigger**                                                      |
| `entityState`          | `buildDeliveryFieldPolicyEntityState`                                        | Present but preview uses fixed payload via `deterministic-exposure-preview-payload.ts` |
| `registrySnapshotHash` | Not computed                                                                 | **Missing**                                                                            |
| `policySetVersion`     | Partial (`profile.version`, `intent.version`)                                | **Not unified**                                                                        |


Admin preview determinism today is guaranteed only because
`resolveDeterministicExposurePreviewPayload` returns fixed payloads per `eventType`, not
because live entity snapshots are pinned.

#### 14.5.2 Canonical Serialization Rules

All hashes and replay comparisons use **canonical JSON** (JCS-style rules):

1. Object keys sorted lexicographically (`localeCompare`).
2. Arrays preserve semantic order rules below; never rely on insertion order.
3. `undefined` omitted; `null` explicit only when semantically nullable.
4. Numbers: no `-0`, no `NaN`, integers preferred where applicable.
5. Strings: NFC normalized Unicode.
6. Sets become sorted unique arrays before serialization.
7. Maps become sorted `{ "key": value }` objects.

**Already in repo:**

- `normalizeExposureIntentScope` + `exposureIntentScopeHash` in
`exposure-intent.repository.ts` — recursive key sort (transitional canonicalization).
- `buildExposureFieldCatalog` sorts by `field.id` (`exposure-field-catalog.ts:58`).
- Shadow parity sorts field reports by `fieldId` (`compare-shadow-vs-legacy.ts:88`).

**Target hash primitive:**

```text
canonicalJson(value) -> string
sha256Hex(canonicalJson(value)) -> hash
```

Transitional `JSON.stringify(normalize(...))` is acceptable only for intent scope until
kernel ships unified `canonicalJson`.

#### 14.5.3 Collection Ordering Invariants

Every collection participating in evaluation MUST use fixed ordering:


| Collection                             | Order rule                                                 | Current code reference                     |
| -------------------------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| `fieldIds` (catalog)                   | `field.id` ascending `localeCompare`                       | `buildExposureFieldCatalog`                |
| `fieldIds` (engine map keys)           | same as catalog iteration order                            | `buildFieldExposureEngineDecisionMap`      |
| `fieldIds` (preview response)          | explicit sort before emit                                  | `exposure-engine-preview.service.ts:194`   |
| `candidateFieldIds`                    | `localeCompare` ascending                                  | `exposure-control-plane.service.ts:165`    |
| `selectedFieldIds` / `allowedFieldIds` | sort before set membership tests                           | **Required in kernel; partially implicit** |
| `definitions`                          | `definition.id` ascending                                  | `resolveFieldState` line 54                |
| `matchingRules` per field              | winner via `compareRules`, not array order                 | `resolve-field-state.ts:17-25`             |
| `reasonChain`                          | append-only in node evaluation order                       | `resolveFieldExposureDecision`             |
| `appliedPolicies`                      | sort ascending before emit in kernel                       | **Target; currently push order**           |
| graph wave nodes                       | `nodeId` ascending                                         | Section 14.4                               |
| conflict candidates                    | `(precedenceClass, artifactRevisionId, nodeId)` tuple sort | **Target**                                 |
| `ExecutionTrace.evaluatedNodes`        | evaluation wave index, then `nodeId`                       | **Target**                                 |


**Rule:** parallel wave execution MUST produce identical `ExposureDecision` and
`deterministicReplayKey` regardless of goroutine/task scheduling order.

#### 14.5.4 Exposure State Lattice (Formal)

States:

```text
S = { blocked, hidden, redacted, summary_only, visible }
```

Restrictiveness rank `ρ` (higher = more restrictive):

```text
ρ(blocked)       = 50
ρ(hidden)        = 40
ρ(redacted)      = 30
ρ(summary_only)  = 20
ρ(visible)       = 10
```

Merge function for states only:

```text
mergeState(a, b) = argmax(ρ(a), ρ(b)) by state
```

This is total and commutative. Conflict resolver uses `mergeState` after precedence rules
filter illegal resurrections (e.g. P4 cannot raise `hidden` → `visible`).

**Visibility selection** (fields included in outbound/enrichment set):

```text
isSelected(state) = state ∈ { visible, redacted, summary_only }
```

Matches `ENGINE_SELECTED_STATES = { visible }` in `resolve-exposure-decision.ts:76` today.
Kernel target expands selected states per surface plugin contract, but selection function
must remain a pure predicate on final state.

#### 14.5.5 Precedence-Class Merge (Formal)

For candidates `C = { c1..cn }` each with `(state, precedenceClass, artifactRevisionId, nodeId)`:

```text
resolve(C):
  1. Filter: drop candidates invalidated by P1 hard deny / missing P0 identity
  2. Apply resurrection guard:
       if ∃ c: ρ(c.state) ≥ ρ(hidden) at P1..P2
       then remove all less-restrictive visible/summary_only from P4..P5
  3. Let M = { mergeState(c.state) for c in C' }  // lattice merge of remaining
  4. If |M| > 1 after resurrection guard:
       apply tie-break ladder (14.5.6) on tied candidates
  5. If still tied: FAIL (publication error or runtime fail-closed → blocked)
  6. Return winner with full citation chain
```

**Early-termination equivalence (current linear engine):**

Today's `resolveFieldExposureDecision` implements steps 1–3 implicitly via early `return`
instead of collecting candidates. Migration MUST prove identical outputs on golden fixtures
before enabling `conflict_resolution_node`.

#### 14.5.6 Tie-Break Ladder (Complete)

When two candidates share the same merged state and are not resolved by resurrection guard:


| Step | Rule              | Comparator                                                 |
| ---- | ----------------- | ---------------------------------------------------------- |
| T1   | Supersedes link   | candidate with `supersedes → other` wins                   |
| T2   | Scope specificity | narrower scope key set wins (more keys > fewer; see below) |
| T3   | Precedence class  | lower `P` number wins                                      |
| T4   | Artifact revision | higher `immutableRevisionId` (lexicographic) wins          |
| T5   | Node id           | lower `nodeId` `localeCompare` wins                        |
| T6   | Artifact id       | lower `artifactId` `localeCompare` wins                    |
| FAIL | Still tied        | publication blocked                                        |


**Scope specificity score** (deterministic):

```text
specificity(scope) =
  (connectionId present ? 8 : 0)
+ (eventType present ? 4 : 0)
+ (entityId present ? 2 : 0)
+ (count of scope keys)
```

Higher score wins. Equal score → proceed to T3.

#### 14.5.7 FieldPolicy Subgraph Determinism (P1)

`resolveFieldState` in `packages/platform-core/src/field-policy/resolve-field-state.ts` is
the reference implementation for rule-level determinism inside `hard_constraint_node`.

Rule winner selection `compareRules(left, right)`:

1. Higher `priority` wins.
2. If priority tie: lower `STATE_PRECEDENCE[state]` wins (`hidden=0` beats `visible=1`).
3. If still tie: higher `rule.id` lexicographically wins (`right.id.localeCompare(left.id)`).

Definitions are processed in `definition.id` sort order. Output array order follows
definition order, not rule discovery order.

**Kernel requirement:** FieldPolicy evaluation MUST NOT depend on `rules` array input order.

#### 14.5.8 Trigger and Coordinate Normalization

All coordinates entering the envelope MUST pass normalization functions:

```text
normalizeSurfaceKey(raw)   -> string   # trim, lowercase snake unless plugin declares otherwise
normalizeAudienceKey(raw)  -> string
normalizeTriggerKey(raw)   -> NormalizedExposureTrigger
```

Current trigger normalization (`normalize-integration-event-type`):

- Known map: `TourCreated` → `{ kind: "event", name: "tour_created" }`, etc.
- Unknown: PascalCase → snake_case event name.
- Empty → `{ kind: "event", name: "unknown" }`.

**Determinism rule:** same raw `eventType` always yields same `NormalizedExposureTrigger`.
Stored intent `trigger` MUST be normalized through the same function before engine input.

#### 14.5.9 Hash Construction

##### contextHash

```text
contextHash = sha256Hex(canonicalJson({
  policySetVersion,
  graphHash,
  tenantId,
  workspaceType,
  entityType,
  entityId,
  surfaceKey,
  audienceKey,
  trigger: normalizeTriggerKey(triggerKey),
  requestTime,
  entityStateHash,
  registrySnapshotHash,
  artifactRevisionIds,
  pluginVersion,
  evaluationMode,
  fieldScope
}))
```

##### entityStateHash

```text
entityStateHash = sha256Hex(canonicalJson(canonicalizeEntityState(entityState)))
```

`canonicalizeEntityState` sorts object keys recursively; arrays sorted only when semantically
unordered (tag lists, id lists).

##### nodeOutputHash

```text
nodeOutputHash = sha256Hex(canonicalJson({
  nodeId,
  artifactRevisionId,
  precedenceClass,
  facts: canonicalizeFacts(output.facts),
  decision: output.decision,
  reasonCodes: sort(output.reasonCodes),
  appliedArtifactIds: sort(output.appliedArtifactIds),
  terminated: output.terminated
}))
```

##### deterministicReplayKey

```text
deterministicReplayKey = sha256Hex(canonicalJson({
  contextHash,
  nodeOutputHashes: sort by (waveIndex, nodeId),
  fieldDecisions: sort by fieldId -> { state, winningNodeId, artifactRevisionId }
}))
```

Two evaluations are replay-equivalent iff `deterministicReplayKey` matches.

#### 14.5.10 Parallel Evaluation Equivalence

When wave `w` has independent nodes `N = {n1..nk}`:

```text
∀ bijections π on N:
  sequentialEvaluate(sort(N, nodeId)) ≡ parallelEvaluate(N)
```

Requirements:

- Nodes in the same wave MUST NOT mutate shared mutable state.
- `nodeOutputStore` keyed by `nodeId` only.
- Conflict resolution runs only after all waves complete.
- Trace records `waveIndex` + sorted `nodeId` for audit, not completion timestamp order.

#### 14.5.11 Clock, Randomness, and IO Boundaries


| Source                   | Allowed?               | Rule                                                                      |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------- |
| `Date.now()` inside node | **No**                 | use `context.requestTime`                                                 |
| `Math.random()`          | **No**                 | forbidden                                                                 |
| DB reads inside node     | **No**                 | snapshot-only via orchestrator                                            |
| Network IO               | **No**                 | forbidden                                                                 |
| Locale-default `sort()`  | **No**                 | explicit `localeCompare`                                                  |
| `Set` / `Map` iteration  | **No** for output      | convert to sorted arrays                                                  |
| Filesystem               | **No**                 | forbidden                                                                 |
| Preview fixed payload    | **Yes (transitional)** | `deterministic-exposure-preview-payload.ts` only in `simulate` admin mode |


#### 14.5.12 Forbidden Non-Determinism Sources (Audit Checklist)

These are hard CI guard targets:

1. Unsorted `Object.keys` / `for...in` driving policy output order.
2. `eligibleFieldIds` derived from `Set` without sort before hash/compare.
3. Dual selector (`legacy` vs `engine`) without recording `activeDeliverySelector` in envelope.
4. Different normalization paths for UI save vs dispatch read.
5. `audience` / `trigger` hardcoded in engine input builder.
6. Preview using live random entity payload without pinned snapshot.
7. Floating-point entity fields without fixed precision in canonical JSON.
8. Timezone-dependent date formatting in entity state (use UTC ISO strings).

#### 14.5.13 Current Code Determinism Map


| Layer                  | Deterministic today?    | Evidence                                    | Fix for kernel                     |
| ---------------------- | ----------------------- | ------------------------------------------- | ---------------------------------- |
| Field catalog order    | Yes                     | `exposure-field-catalog.ts` sort by id      | Keep                               |
| Per-field engine       | Yes (pure function)     | `resolveFieldExposureDecision`              | Extract to nodes                   |
| FieldPolicy rules      | Yes                     | `compareRules` total order                  | Keep inside P1 node                |
| Engine preview payload | Yes (fixed fixture)     | `deterministic-exposure-preview-payload.ts` | Replace with pinned snapshot store |
| Intent scope hash      | Yes                     | `exposureIntentScopeHash`                   | Promote to general canonicalJson   |
| Outer field selector   | **No** (mode-dependent) | `resolveActiveDeliveryFieldIds` in dispatch | Remove hybrid                      |
| Audience/trigger input | **No**                  | hardcoded / derived from eventType          | Use envelope coordinates           |
| appliedPolicies order  | Weak                    | push order                                  | Sort before emit                   |
| Replay key             | **No**                  | not computed                                | Implement 14.5.9                   |


#### 14.5.14 Golden Fixture Contract

Determinism is not proven by convention; it requires fixtures:

```text
fixtures/determinism/
  denali-telegram-tour-created.json     # input envelope
  denali-telegram-tour-created.expected.json  # full ExposureDecision + replayKey
```

Each fixture asserts:

1. `deterministicReplayKey` stable across 100 repeated evaluations.
2. Parallel wave execution matches sequential reference evaluator.
3. `explain(fieldId)` reason chain byte-equal.
4. Changing artifact revision changes replay key predictably (diff test).

**Transitional acceptance:** until kernel ships, golden fixtures target
`resolveFieldExposureDecision` + `buildFieldExposureEngineDecisionMap` with pinned preview
payload.

#### 14.5.15 Reason Chain and Applied Policy Canonical Form

**reasonChain** (target kernel):

```text
reasonChain = [
  fixed coordinate prefix in order:
    "field:{fieldId}",
    "surface:{surfaceKey}",
    "audience:{audienceKey}",
    "trigger:{canonicalTriggerString}",
  ...node-emitted reason codes in wave order...
]
```

Matches current `resolveFieldExposureDecision` lines 30–35 prefix pattern.

**appliedPolicies** (target kernel):

```text
appliedPolicies = sortUnique([
  "field_policy:{ruleId}",
  "exposure_profile:{profileId}",
  "exposure_intent:{mode}",
  ...
])
```

Sort ascending `localeCompare` before persistence in `ExecutionTrace`.

#### 14.5.16 Transition Guarantee

While migrating linear engine → graph kernel:

```text
∀ fixture F in GoldenFixtureSet:
  linearEngine(F) ≡ graphKernel(F) on fieldDecisions
  graphKernel(F).deterministicReplayKey is stable
```

If equivalence fails, cutover scope MUST NOT expand. Drift is classified via existing
`compare-shadow-vs-legacy.ts` patterns (sorted field reports, stable keys).

### 14.6 Version Resolution Algorithm

Version resolution is how the kernel answers: **which immutable policy artifacts apply to
this evaluation, at this time, for this tenant and context?** Runtime never guesses
"latest". It resolves a pinned `PolicySet` from an explicit pointer, coordinate match, and
artifact revision ids.

#### 14.6.1 Core Types

##### PolicySetPointer

Mutable control-plane handle. Points at a bundle of immutable artifact revisions.

```text
PolicySetPointer
  pointerId: string
  tenantId: string
  workspaceType: string
  status: "active" | "superseded" | "rollback"
  policySetVersion: string          # human label, e.g. "2026-06-28T12:00:00Z"
  effectiveAt: string                 # ISO-8601 UTC; inclusive start
  supersededAt?: string
  promotedBy?: string
  parentPointerId?: string          # rollback lineage
  artifactBindings: ArtifactBinding[]
```

##### ArtifactBinding

```text
ArtifactBinding
  role: ArtifactRole
  artifactId: string
  immutableRevisionId: string       # content-addressed revision
  coordinates?: CoordinateScope     # optional narrowing
```

##### ArtifactRole (resolution order)

```text
registry          # field registry snapshot for workspace
graph             # PolicyGraph DAG artifact
fieldPolicy       # workspace FieldPolicy manifest snapshot
exposurePolicy    # context exposure rules (when separate from profile)
profile           # ExposureProfile defaults
intent            # ExposureIntent override (scoped)
plugin            # SurfacePlugin constraint artifact
resolver          # kernel evaluator version pin (optional)
```

##### ResolvedPolicySet

Output of `VersionResolver.resolve()`:

```text
ResolvedPolicySet
  policySetVersion: string
  pointerId: string
  graphHash: string
  effectiveAt: string
  mode: runtime | simulate | replay | draft
  artifacts: Record<ArtifactRole, ResolvedArtifact>
  coordinates: ExposureCoordinates
  resolutionTrace: ResolutionTraceEntry[]

ResolvedArtifact
  role: ArtifactRole
  artifactId: string
  immutableRevisionId: string
  contentHash: string
  source: "registry" | "tenant_db" | "workspace_seed" | "draft"
  versionLabel: string              # display string, e.g. "v3" or ISO timestamp
```

##### ResolutionTraceEntry

Auditable record of each resolution step:

```text
ResolutionTraceEntry
  role: ArtifactRole
  matchStrategy: "pointer_binding" | "coordinate_match" | "seed_fallback" | "draft_overlay"
  candidatesConsidered: number
  winnerArtifactId: string
  winnerRevisionId: string
  specificityScore: number
```

#### 14.6.2 Resolution Modes


| Mode       | Pointer source                                   | Missing artifact                    | Draft allowed |
| ---------- | ------------------------------------------------ | ----------------------------------- | ------------- |
| `runtime`  | active pointer for tenant+workspace              | fail-closed (`blocked` all fields)  | no            |
| `simulate` | explicit or active pointer                       | validation error returned           | yes (overlay) |
| `replay`   | pinned `requestedPolicySetVersion` from envelope | fail with `REPLAY_ARTIFACT_MISSING` | no            |
| `draft`    | active pointer + draft overlays                  | validation error                    | yes           |


**Rule:** `replay` MUST NOT read the current active pointer. It uses only the pointer
stored on the original decision envelope.

#### 14.6.3 Coordinate Matching

Artifacts are selected by role + coordinate specificity:

```text
ExposureCoordinates
  tenantId
  workspaceType
  entityType
  entityId?
  surfaceKey
  audienceKey
  triggerKey
  scope?: { connectionId?, eventType?, ... }
```

**Specificity score** (same as Section 14.5.6 — used for artifact tie-break within role):

```text
specificity(coordinates, binding) =
  (binding.scope.connectionId matches ? 8 : 0)
+ (binding.scope.eventType matches ? 4 : 0)
+ (binding.scope.entityId matches ? 2 : 0)
+ (count of matched scope keys)
```

For role `intent`, the winning artifact is the highest specificity among bindings on the
active pointer. Equal specificity → tie-break ladder (supersedes → revision → artifactId).

#### 14.6.4 Resolution Algorithm (Formal)

```text
VersionResolver.resolve(context, options) -> ResolvedPolicySet | ResolutionError

INPUT:
  context: ExposureContext + tenant auth
  options.mode: runtime | simulate | replay | draft
  options.requestedPolicySetVersion?: string
  options.draftOverlays?: DraftArtifact[]
  options.asOfTime?: string                    # default context.requestTime

STEP 1 — Authorize tenant scope
  require context.tenantId matches auth tenant
  if violation -> RESOLUTION_TENANT_SCOPE_VIOLATION

STEP 2 — Resolve pointer
  if options.mode == replay:
    pointer = PolicyRegistry.getPointer(options.requestedPolicySetVersion)
  else:
    pointer = PolicyRegistry.getActivePointer(context.tenantId, context.workspaceType, asOfTime)
  if pointer == null:
    if mode == runtime -> fail-closed empty PolicySet
    else -> RESOLUTION_POINTER_NOT_FOUND

STEP 3 — Build coordinate bundle
  coordinates = normalizeCoordinates(context)
  // surfaceKey, audienceKey, triggerKey through same normalizers as Section 14.5.8

STEP 4 — Resolve artifacts by role (fixed role order)
  artifacts = {}
  trace = []
  for role in [registry, graph, fieldPolicy, exposurePolicy, profile, intent, plugin, resolver]:
    winner = resolveRoleArtifact({
      role,
      pointer,
      coordinates,
      mode: options.mode,
      draftOverlays: options.draftOverlays,
    })
    trace.push(winner.traceEntry)
    if winner.artifact == null:
      if isRequired(role) and mode != draft:
        return RESOLUTION_MISSING_REQUIRED_ARTIFACT(role)
      continue
    artifacts[role] = winner.artifact

STEP 5 — Load and validate graph
  graphArtifact = artifacts.graph
  if graphArtifact == null and mode != draft:
    return RESOLUTION_MISSING_GRAPH
  graph = PolicyGraphLoader.load(graphArtifact)
  validateGraphTopology(graph)           // no cycles, one conflict node per field subgraph
  validateGraphTenantScope(graph, context.tenantId)
  validateGraphArtifactRefs(graph, artifacts)   // all refs resolvable
  if validation fails:
    if mode == runtime -> fail-closed
    else -> RESOLUTION_GRAPH_VALIDATION_FAILED

STEP 6 — Compute graphHash
  graphHash = sha256Hex(canonicalJson({
    graphRevisionId: graphArtifact.immutableRevisionId,
    nodeRegistrations: sorted graph.nodes by nodeId,
    edgeSet: sorted graph.edges,
    artifactRevisionIds: map role -> artifacts[role].immutableRevisionId
  }))

STEP 7 — Assemble ResolvedPolicySet
  return {
    policySetVersion: pointer.policySetVersion,
    pointerId: pointer.pointerId,
    graphHash,
    effectiveAt: pointer.effectiveAt,
    mode: options.mode,
    artifacts,
    coordinates,
    resolutionTrace: trace
  }
```

##### resolveRoleArtifact (per role)

```text
resolveRoleArtifact(input):
  1. candidates = pointer.artifactBindings where role == input.role
  2. if input.mode == draft and draftOverlay exists for role:
       return overlay artifact (matchStrategy=draft_overlay)
  3. filter candidates where coordinates satisfy binding.coordinates
  4. if empty and role has seed fallback (profile, registry):
       return seedFallback(role, coordinates)   // see 14.6.5
  5. sort candidates by specificity desc, then revision desc, then artifactId asc
  6. winner = candidates[0]
  7. load immutable revision content from PolicyRegistry by immutableRevisionId
  8. verify contentHash matches revision record
  9. return ResolvedArtifact + trace entry
```

**Required roles for runtime:** `registry`, `graph`, `fieldPolicy`, `profile`. Optional:
`exposurePolicy`, `intent`, `plugin`, `resolver`.

#### 14.6.5 Seed Fallback (Transitional)

Until all artifacts are tenant-published, the resolver MAY fall back to workspace seeds
with explicit trace marking `matchStrategy=seed_fallback`:


| Role                  | Current seed source                                      | versionLabel today                      |
| --------------------- | -------------------------------------------------------- | --------------------------------------- |
| `registry`            | `buildExposureFieldCatalog(workspaceType)`               | implicit workspace manifest version     |
| `fieldPolicy`         | `adaptWorkspaceFieldPolicyManifest` via workspace plugin | manifest version                        |
| `profile`             | `resolveRegistrySeededExposureProfile`                   | `"migration-seed-v1"`                   |
| `profile` (persisted) | `resolvePersistedExposureProfileForContext` → DB         | `v{n}` from `exposure_profiles.version` |
| `intent`              | `exposureIntentRepository.findForContext`                | `row.updatedAt.toISOString()`           |
| `graph`               | **none** — linear engine degenerate graph                | **not implemented**                     |
| `plugin`              | integration surface meta                                 | **implicit, not versioned**             |


**Target rule:** seed fallback is allowed only when pointer has no binding for that role.
Fallback MUST be recorded in `resolutionTrace` and in the decision envelope. Cutover
criteria: zero `seed_fallback` entries in production traces for a scope.

#### 14.6.6 Current Code Resolution Path (Transitional)

Today's runtime does **not** call `VersionResolver`. Equivalent steps are scattered:

```text
1. Profile coordinates derived (hardcoded partial):
     resolveDeliveryExposureProfileContext(eventType)
     + surface = provider
     -> resolveRegistrySeededExposureProfile (integration-policy-engine.ts:165-169)

2. Persisted profile (optional):
     resolvePersistedExposureProfileForContext (ensureSeededProfile on first use)

3. Intent lookup:
     findForContext({ profileId, surface, audience, trigger, scope: { connectionId } })
     (integration-policy-engine.ts:173-182)

4. FieldPolicy + registry:
     buildFieldExposureEngineInputSnapshot(workspaceType, eventType, payload)

5. Versions recorded on decision:
     profile.version, intent.version (resolve-exposure-decision.ts:186-192)
     resolverVersion = EXPOSURE_RESOLVER_VERSION ("8.0.0")
```

**Gaps vs target algorithm:**

1. No `PolicySetPointer` — versions are per-artifact, not a unified bundle.
2. Profile coordinates partially hardcoded (`telegram`, `external_channel`, eventType as trigger).
3. Intent `version` = `updatedAt` ISO string, not immutable revision id.
4. Profile DB `version` is incrementing integer (`v${n}`), not content hash.
5. No `graphHash` or `policySetVersion` on decision envelope.
6. Replay cannot re-resolve identical artifact bundle by pointer.

#### 14.6.7 Immutable Revision Model

Every published artifact follows:

```text
PolicyArtifactRevision
  artifactId: string
  immutableRevisionId: string    # sha256Hex(content) or uuidv7+hash
  contentHash: string
  content: bytes | json
  publishedAt: string
  publishedBy: string
  supersedesRevisionId?: string
  tenantId: string
```

Rules:

- Published revisions are **append-only**. Edit = new revision + new `immutableRevisionId`.
- Pointer bindings reference `immutableRevisionId`, never "latest artifact id".
- `contentHash` verified on load; mismatch → `RESOLUTION_CONTENT_HASH_MISMATCH`.
- DB `updatedAt` MUST NOT be used as authoritative revision id in target kernel (current
intent versioning is transitional only).

#### 14.6.8 Policy Set Promotion Algorithm

New policy sets enter runtime only through promotion:

```text
promotePolicySet(draftBindings, context, options):

1. draftSet = VersionResolver.resolve(context, { mode: "draft", draftOverlays: draftBindings })
2. currentSet = VersionResolver.resolve(context, { mode: "runtime" })
3. simulated = PolicyGraphEngine.simulate(draftSet, context)
4. diff = SimulationEngine.diff(currentSet.decision, simulated.decision)
5. if diff.hasBlockingChanges and not options.force:
     return PROMOTION_BLOCKED(diff)
6. newPointer = PolicyRegistry.publishPointer({
     tenantId, workspaceType,
     policySetVersion: generateVersionLabel(),
     artifactBindings: draftBindings,
     parentPointerId: currentSet.pointerId,
     status: "active"
   })
7. PolicyRegistry.supersede(currentSet.pointerId)
8. AuditLog.recordPromotion({ newPointer, diff, actor })
9. return newPointer
```

**Rollback** = activate a prior pointer (or `parentPointerId`), not code deploy:

```text
rollbackPolicySet(tenantId, workspaceType, targetPointerId):
  require targetPointer.status in { active, superseded }
  supersede current active pointer
  activate targetPointer with status=active, effectiveAt=now
  AuditLog.recordRollback(...)
```

#### 14.6.9 policySetVersion and graphHash on Decision Envelope

Every runtime decision MUST carry:

```text
DecisionVersionEnvelope
  policySetVersion: string
  pointerId: string
  graphHash: string
  artifactRevisionIds: Record<ArtifactRole, string>
  resolverVersion?: string
  pluginVersion?: string
  resolutionTraceHash: string
  deterministicReplayKey: string        # Section 14.5.9
```

`resolutionTraceHash = sha256Hex(canonicalJson(resolutionTrace))`

Enables `replay(eventId, policySetVersion)` to call Step 2 with pinned pointer and verify
artifact bundle before re-evaluation.

#### 14.6.10 Resolution Error Taxonomy


| Code                                   | Mode    | Runtime behavior    |
| -------------------------------------- | ------- | ------------------- |
| `RESOLUTION_TENANT_SCOPE_VIOLATION`    | all     | deny                |
| `RESOLUTION_POINTER_NOT_FOUND`         | runtime | fail-closed         |
| `RESOLUTION_MISSING_REQUIRED_ARTIFACT` | runtime | fail-closed         |
| `RESOLUTION_MISSING_GRAPH`             | runtime | fail-closed         |
| `RESOLUTION_GRAPH_VALIDATION_FAILED`   | runtime | fail-closed         |
| `RESOLUTION_CONTENT_HASH_MISMATCH`     | all     | deny + security log |
| `RESOLUTION_CROSS_TENANT_ARTIFACT`     | all     | deny + security log |
| `REPLAY_ARTIFACT_MISSING`              | replay  | replay failed       |
| `REPLAY_POINTER_MISMATCH`              | replay  | replay failed       |
| `PROMOTION_BLOCKED`                    | promote | no pointer change   |


Fail-closed runtime default: all fields `blocked`, reason `resolution_error:{code}`.

#### 14.6.11 Migration: Transitional → Full VersionResolver


| Phase | Change                                                                   | Proof                                              |
| ----- | ------------------------------------------------------------------------ | -------------------------------------------------- |
| V1    | Record `profileVersion` + `intentVersion` on every decision (done)       | `resolve-exposure-decision.ts`                     |
| V2    | Add `resolutionTrace` with `seed_fallback` markers                       | control-plane API exposes sources                  |
| V3    | Introduce `PolicySetPointer` for graph + registry + fieldPolicy bindings | pointer resolves same decisions as V2              |
| V4    | Replace `updatedAt` intent version with `immutableRevisionId` on upsert  | replay stable across row updates with same content |
| V5    | Unified `policySetVersion` + `graphHash` on dispatch envelope            | replay API works                                   |
| V6    | Remove seed fallback for scopes with full pointer bindings               | zero seed_fallback in traces                       |


#### 14.6.12 Acceptance Criteria

Version resolution is complete when:

1. Runtime resolves exclusively through `VersionResolver.resolve(context, { mode: "runtime" })`.
2. No evaluation uses implicit "latest" without active pointer.
3. Every decision envelope includes `policySetVersion`, `graphHash`, and per-role revision ids.
4. `replay(eventId, policySetVersion)` re-resolves identical `ResolvedPolicySet` before evaluate.
5. Promotion requires `simulate` + `diff`; rollback is pointer-only.
6. Intent/profile versions use `immutableRevisionId`, not `updatedAt`.
7. Seed fallback is traced and measurable; cutover removes it per scope.

**Pointer rule (unchanged):** runtime never resolves "latest" without an explicit active
pointer per tenant/workspace. Promotion changes the pointer only after `simulate` + `diff`
pass.

### 14.7 State, Caching, and Replay Rules

#### Mutable vs immutable state


| State                     | Mutable?                     | Owner                 |
| ------------------------- | ---------------------------- | --------------------- |
| Policy artifacts          | Immutable once published     | Policy Registry       |
| Active policy set pointer | Mutable (promotion/rollback) | Control Plane         |
| Entity state snapshot     | Immutable per evaluation     | Orchestrator snapshot |
| Node output store         | Ephemeral per evaluation     | Graph Engine          |
| ExecutionTrace            | Immutable once written       | Audit & Replay Engine |
| Cache entries             | Evictable                    | Graph Engine          |


#### Cache key formula

```text
cacheKey = hash(
  tenantId,
  policySetVersion,
  graphHash,
  nodeId,
  artifactRevisionId,
  inputHash,
  entityStateHash,
  pluginVersion?
)
```

Rules:

- Missing any component → cache disabled for that entry.
- Tenant id MUST be part of every cache key.
- Replay mode MAY set `cachePolicy=require_miss` to force re-evaluation.
- Cache hits MUST be logged in `ExecutionTrace.cacheHits`.

#### Replay rules

```text
replay(eventId, policySetVersion):
  envelope = AuditStore.loadDecisionEnvelope(eventId)
  require envelope.contextHash match rebuilt context
  require envelope.entityStateRef resolvable
  rerun VersionResolver in mode=replay
  compare deterministicReplayKey
  emit driftReport if keys differ
```

Replay is valid only when `deterministicReplayKey` matches OR drift is explained by
documented intentional policy change.

### 14.8 Plugin Execution Sandbox Spec

Surface plugins (Telegram, Email, PDF, Web, Admin) are **renderers and constraint
providers only**. They execute strictly after the graph emits an authoritative
`ExposureDecision`. This section formalizes the isolation boundary, the plugin lifecycle,
the constraint declaration model, the runtime sandbox, and the violation taxonomy.

#### 14.8.1 Execution Boundary

```text
PolicyGraphEngine
   -> ExposureDecision (authoritative; immutable)
   -> CanonicalEnrichment (resolves values for approved fields ONLY)
   -> ApprovedExposurePayload
   -> SurfacePlugin.render(payload, capabilityContext)
   -> RenderedArtifact
   -> Transport (provider send / file write / HTTP response)
```

Two separate plugin touch points, never merged:

1. **Constraint declaration (build/publish time):** plugin publishes a declarative
  `SurfacePlugin` artifact. The kernel compiles it into a `plugin_constraint_node` (P5).
   This is data, not executed plugin code.
2. **Rendering (runtime, post-decision):** plugin imperative code runs in the sandbox with
  only the approved payload.

The kernel NEVER calls plugin code during `evaluate()`. P5 constraint effects come from the
declarative artifact, not a plugin callback.

#### 14.8.2 ApprovedExposurePayload (only plugin input)

```text
ApprovedExposurePayload
  decisionId: string
  policySetVersion: string
  surfaceKey: string
  audienceKey: string
  triggerKey: string
  templateRef?: string
  fields: ApprovedField[]
  renderHints: RenderHint[]
  pluginContract: CompiledPluginContract
  traceRef: string

ApprovedField
  fieldId: string
  canonicalPath: string
  kind: string
  renderMode: "full" | "summary_only" | "redacted"
  value: unknown            # already enrichment-resolved; redacted fields carry masked value
  formatHints?: Record<string, unknown>
```

Hard rules:

- The payload contains ONLY fields whose final `FieldDecision.state ∈ { visible, summary_only, redacted }`.
- `hidden` and `blocked` fields are **absent** from the payload — not present with a flag.
- No raw entity object, no `entityState`, no policy artifacts, no other tenants' data.
- `value` for `redacted` fields is pre-masked by enrichment, never the raw value.

#### 14.8.3 Enrichment-After-Decision Invariant

Canonical enrichment MUST run only on approved field ids:

```text
approvedFieldIds = [ d.fieldId for d in decision.fields if isSelected(d.state) ]
enriched = CanonicalEnrichment.resolve(entityRef, approvedFieldIds)   # scoped fetch
```

This closes the PII/secret leak path: enrichment cannot resolve a sensitive field unless the
graph already approved it. Plugins receive enriched values, never an enrichment handle.

**Current code gap:** today `format-integration-delivery-message.ts` reads
`integrationDeliveryFieldIds` + `integrationDeliveryFieldValues` from the job payload and
redacts placeholders for non-eligible ids (`applyFieldPolicyPlaceholders`, lines 33–50). That
is the right *direction* (placeholder gated by eligible set), but:

1. The full value map (`integrationDeliveryFieldValues`) is placed on the payload regardless,
  so non-approved values can still travel in the job envelope.
2. Eligibility comes from the hybrid selector, not yet a single engine decision.

Target: enrichment produces values only for approved ids; the payload never carries
non-approved values.

#### 14.8.4 Compiled Plugin Contract (P5 source)

The declarative artifact compiled into the constraint node and passed to the renderer:

```text
CompiledPluginContract
  pluginId: string
  pluginVersion: string
  surfaceKey: string
  supportedDecisionStates: ("visible" | "summary_only" | "redacted")[]
  supportedFieldKinds: string[]
  forbiddenFieldKinds: string[]
  maxFields?: number
  maxPayloadBytes?: number
  maxTextLength?: number
  template:
    engine: "placeholder_v1" | "mjml" | "pdf_layout_v1"
    allowedPlaceholders: "approved_fields_only"
  capabilities:
    supportsMarkdown: boolean
    supportsAttachments: boolean
    supportsHtml: boolean
  isolationPolicy: PluginIsolationPolicy
```

Constraint compilation rules:

- `supportedDecisionStates` defines which approved states the plugin can render. If a field
is `summary_only` but the plugin lacks it, P5 forces `blocked_render` for that field.
- `forbiddenFieldKinds` (e.g. `composite`, `secret`) → field excluded from payload at P5.
- Limits (`maxFields`, `maxTextLength`) produce deterministic truncation/`summary_only`
downgrades recorded in the decision trace, never silent drops.

#### 14.8.5 Template Rendering Rules

Templates are presentation only. Placeholder resolution MUST gate on approved fields:

```text
render(template, payload):
  for each placeholder {{field:<id>}}:
     if <id> not in payload.fields:        -> "" (redact)
     elif field.renderMode == redacted:    -> mask token
     elif field.renderMode == summary_only:-> summarized value
     else:                                  -> formatted value
```

This generalizes the current `FIELD_PLACEHOLDER_PATTERN` logic in
`format-integration-delivery-message.ts` (lines 3, 43–49) into a surface-neutral rule:

- Unknown/non-approved placeholder → empty string (current behavior, preserved).
- Renderer cannot introduce a field not present in the approved payload.
- Renderer cannot upgrade `summary_only`/`redacted` back to full.

#### 14.8.6 Runtime Sandbox

Plugin render code executes under capability isolation:


| Capability                                         | Allowed?                                            |
| -------------------------------------------------- | --------------------------------------------------- |
| Read `ApprovedExposurePayload`                     | Yes                                                 |
| Pure string/format/layout transforms               | Yes                                                 |
| Read its own compiled contract                     | Yes                                                 |
| Network / provider send from inside `render()`     | No (render returns artifact; transport is separate) |
| Filesystem (except declared PDF temp via host API) | No                                                  |
| Read DB / Policy Registry                          | No                                                  |
| Read other plugins' payloads                       | No                                                  |
| Access `entityState` / raw canonical entity        | No                                                  |
| Cross-tenant data access                           | No                                                  |
| Mutate `ExposureDecision`                          | No                                                  |
| Wall-clock / randomness affecting output identity  | No (must be deterministic for replay)               |


```text
PluginIsolationPolicy
  executionContext: "isolated_worker" | "in_process_pure"
  allowedHostApis: string[]      # e.g. ["pdf.allocateTempBuffer"]
  timeoutMs: number
  memoryBudgetBytes: number
  deterministicRequired: boolean
```

Default for new plugins: `isolated_worker`, no host APIs, deterministic required.

#### 14.8.7 Separation of Render vs Transport

Rendering and sending are distinct stages:

```text
RenderedArtifact = SurfacePlugin.render(payload)     # pure, deterministic
TransportResult  = ProviderAdapter.send(RenderedArtifact, credentials)  # side effects
```

- Credentials live in the integration/provider layer, never in the plugin sandbox or
`ExposureIntent` (Invariant 7.1.4).
- Transport failures (network, provider 5xx) retry at the outbox layer and never re-run the
graph decision.
- `RenderedArtifact` is replay-stable: same payload + same plugin version → same artifact.

#### 14.8.8 Plugin Failure Semantics


| Failure                              | Effect on decision                        | Effect on delivery                                                       |
| ------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------ |
| Render throws / timeout              | None (decision immutable)                 | Delivery fails; logged against `decisionId`; retryable per outbox policy |
| Field kind unsupported               | Already handled at P5 (field excluded)    | Renders remaining approved fields                                        |
| Payload exceeds limit                | P5 downgraded/truncated deterministically | Renders within limit                                                     |
| Plugin attempts forbidden capability | Sandbox denies; render fails closed       | Delivery fails; security event logged                                    |
| Plugin non-deterministic output      | Replay drift detected                     | Flagged in drift report                                                  |


Plugin failure NEVER results in exposing a non-approved field, and NEVER mutates the stored
`ExposureDecision`.

#### 14.8.9 Versioning and Replay

- `pluginId@pluginVersion` is pinned in the decision/render envelope.
- Replay re-renders with the original plugin version; a newer plugin version is a separate
diff, not an in-place change.
- `RenderedArtifact` hash MAY be stored for render-replay verification.
- A plugin version bump that changes rendered output for the same payload MUST surface in the
drift report (Section 14.5.10 determinism applies to render too).

#### 14.8.10 Plugin Abuse Prevention (CI + runtime guards)

Enforced rules (extend existing boundary guards like
`guard-legacy-delivery-candidate-field-ids`):

1. Plugin packages MUST NOT import the policy engine, FieldPolicy, ExposurePolicy, or
  ExposureIntent modules.
2. Plugin packages MUST NOT read `integrationDeliveryFieldValues` for non-approved ids
  (target: that map only contains approved ids).
3. Plugin constraint artifacts MUST validate against `CompiledPluginContract` schema before
  publish.
4. A plugin declaring `supportedDecisionStates` that could resurrect `hidden` is rejected at
  publish (`GRAPH_PLUGIN_ORDER_VIOLATION`).
5. Render functions are contract-tested for determinism (same payload → same artifact).

#### 14.8.11 Current vs Target


| Aspect                 | Current code                                                          | Target sandbox                                 |
| ---------------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| Field gating in render | `applyFieldPolicyPlaceholders` gates on `integrationDeliveryFieldIds` | Gate on `ApprovedExposurePayload.fields`       |
| Value exposure         | Full `integrationDeliveryFieldValues` on payload                      | Only approved values enriched                  |
| Plugin constraints     | Implicit in `format-integration-delivery-message.ts` + surface meta   | Declarative `CompiledPluginContract` → P5 node |
| Eligibility source     | Hybrid selector                                                       | Single engine decision                         |
| Isolation              | Same-process formatter function                                       | `isolated_worker` capability sandbox           |
| Replay of render       | Not tracked                                                           | Plugin version pinned + artifact hash          |


#### 14.8.12 Acceptance Criteria

Plugin sandbox is complete when:

1. Plugins receive only `ApprovedExposurePayload`; no path to raw entity or policy.
2. Enrichment runs only on approved field ids.
3. P5 constraints are declarative artifacts, validated at publish.
4. Render is deterministic and replay-stable per pinned plugin version.
5. Render/transport are separate stages; credentials never enter the sandbox.
6. Plugin failure cannot expose non-approved fields or mutate the decision.
7. CI guards reject plugins importing policy/decision modules.

### 14.9 Current Code as Degenerate Linear Graph

Today's engine is a **single-path DAG** per field (not yet the full kernel):

```text
[field_identity] -> [hard_constraint] -> [context_rule] -> [intent_override] -> [visible default]
        |                  |                    |                    |
     P0 early           P1 early            P2 early            P4 early
```

File mapping:


| Graph node                 | Current implementation                                                     |
| -------------------------- | -------------------------------------------------------------------------- |
| `field_identity_node`      | `resolveFieldExposureDecision` registry check (lines 38–45)                |
| `hard_constraint_node`     | `resolveFieldState` via FieldPolicy (lines 47–72)                          |
| `context_rule_node`        | `exposurePolicy` allowed set check (lines 74–91)                           |
| `profile_default_node`     | `mapExposurePolicyForEngine` in `build-field-exposure-engine-input.ts`     |
| `intent_override_node`     | `exposureIntent` mode handling (lines 93–108)                              |
| `decision_projection_node` | `buildFieldExposureEngineDecisionMap`                                      |
| `conflict_resolution_node` | **Not separate today** — early returns ARE the resolver                    |
| Outer legacy selector      | `resolveDeliveryFieldPolicy` in `resolveExposureDecision` when not cutover |


**Known gaps vs this spec (must fix during migration):**

1. `audience` is hardcoded to `"external_channel"` in
  `buildFieldExposureEngineDecisionInput` (line 126) — violates Section 14.5 input pinning.
2. `trigger` comes from `normalizeIntegrationEventType(eventType)` — stored intent trigger
  not used as engine input.
3. `resolveExposureDecision` can bypass engine selection via `deliveryPolicy.eligibleFieldIds`.
4. No compile-time graph validation — runtime only.

### 14.10 Kernel API Surface (target)

```text
PolicyGraphEngine.evaluate(policySet, context, options) -> ExposureDecision
PolicyGraphEngine.explain(decision, fieldId) -> ExecutionTraceSlice
SimulationEngine.simulate(policySet, context) -> SimulatedExposureDecision
SimulationEngine.diff(before, after) -> DecisionDiff
VersionResolver.resolve(context, mode) -> PolicySet
AuditReplayEngine.replay(eventId, policySetVersion) -> ReplayResult
```

`exposure-engine-preview.service.ts` is the transitional implementation of
`SimulationEngine.simulate` for a single connection/event — it calls
`resolveFieldExposureDecision` directly, not yet `PolicyGraphEngine`.

### 14.11 Migration: Linear Engine → Graph Kernel


| Step | Action                                                                                     | Proof                                                   |
| ---- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| 1    | Extract node functions from `resolveFieldExposureDecision` into registered node evaluators | Same per-field output on golden fixtures                |
| 2    | Build static `PolicyGraph` artifact mirroring current chain                                | Graph validation passes                                 |
| 3    | Replace early returns with `conflict_resolution_node`                                      | `explain()` works per field                             |
| 4    | Pin `PolicySet` in preview + dispatch envelopes                                            | `deterministicReplayKey` stable                         |
| 5    | Remove outer `resolveDeliveryFieldPolicy` selector from cutover scopes                     | `activeDeliverySelector=engine_selected_field_ids` only |
| 6    | Add `plugin_constraint_node` after engine authority                                        | Renderer tests only                                     |


### 14.12 Conflict Resolution Strategy (Formal)

This section consolidates and completes the conflict resolution model referenced in
Sections 7.2, 14.3 (`conflict_resolution_node`), and 14.5.4–14.5.6. It is the single
authoritative spec for how multiple policy node outputs become one `FieldDecision`.

Design influences:

- **Most-restrictive-wins** state lattice (Raigo) — exposure safety defaults to deny.
- **Precedence classes** (P0–P6) — hard constraints bind before overrides.
- **Total resolution** (Mneme) — unresolved ties are publication errors, not runtime guesses.

#### 14.12.1 Conflict Resolution Property

For each `fieldId`, the resolver MUST produce:

```text
ConflictResolutionResult
  fieldId: string
  finalState: ExposureDecisionState
  winningCandidate: ConflictCandidate
  losingCandidates: ConflictCandidate[]
  resolutionMethod: "single_candidate" | "lattice_merge" | "resurrection_guard" | "tie_break"
  tieBreakStep?: "T1".."T6"
  reasonChain: string[]
  appliedPolicies: string[]
  explainable: true
```

**Totality:** every evaluation produces exactly one result per field, or fails closed with
`blocked` + `conflict:unresolved`.

**Determinism:** same sorted candidate set → same `ConflictResolutionResult`.

**Auditability:** `winningCandidate` cites `nodeId`, `precedenceClass`, `artifactRevisionId`.

#### 14.12.2 ConflictCandidate

```text
ConflictCandidate
  nodeId: string
  nodeType: NodeType
  precedenceClass: P0 | P1 | P2 | P3 | P4 | P5 | P6
  state: ExposureDecisionState | null     # null = pass-through / facts only
  artifactRevisionId?: string
  artifactId?: string
  scope?: CoordinateScope
  supersedes?: string[]                   # other artifactRevisionIds
  reasonCodes: string[]
  appliedArtifactIds: string[]
  specificityScore: number
  terminated: boolean                     # early-termination source
```

Candidates are collected only from nodes with `feedsConflict=true` that evaluated (not
`skipped`) for this `fieldId`.

#### 14.12.3 State Lattice (Authoritative)

```text
ρ(blocked)       = 50
ρ(hidden)        = 40
ρ(redacted)      = 30
ρ(summary_only)  = 20
ρ(visible)       = 10

mergeState(S) = state with max ρ among S
```

**Commutativity:** `mergeState({a,b}) = mergeState({b,a})`.

**Selection predicate** (fields entering enrichment):

```text
isSelected(state) =
  state ∈ { visible, redacted, summary_only }   # kernel target
  state == visible                               # current cutover default
```

#### 14.12.4 Precedence Classes and Authority


| Class | Nodes                                    | May emit decision?    | Authority                       |
| ----- | ---------------------------------------- | --------------------- | ------------------------------- |
| P0    | `field_identity_node`                    | yes                   | identity only; missing → hidden |
| P1    | `hard_constraint`, `guardrail`, `budget` | yes                   | **hard lower bound**            |
| P2    | `context_rule`, `redaction_transform`    | yes                   | context deny/transform          |
| P3    | `profile_default`                        | facts + allowed set   | defaults only                   |
| P4    | `intent_override`                        | yes                   | narrow/disable within bounds    |
| P5    | `plugin_constraint`                      | render downgrade only | never resurrect                 |
| P6    | `conflict_resolution`                    | yes                   | **final merge**                 |


**Monotonicity invariant (non-negotiable):**

```text
∀ field f, ∀ candidate c at P4..P5:
  if ∃ c' at P1..P2 with ρ(c'.state) ≥ ρ(hidden)
  then c cannot produce visible/summary_only/redacted that increases exposure
```

Intent cannot make a FieldPolicy-hidden field visible. ExposurePolicy cannot override
FieldPolicy hidden. Plugin cannot override graph hidden.

#### 14.12.5 Resurrection Guard

Before lattice merge, remove illegal resurrection candidates:

```text
applyResurrectionGuard(candidates):
  hardDeny = { c | c.precedenceClass ∈ {P0,P1,P2} AND ρ(c.state) ≥ ρ(hidden) }
  if hardDeny is empty:
    return candidates
  maxHard = mergeState(hardDeny.states)
  return candidates.filter(c =>
    c.precedenceClass ∈ {P0,P1,P2}
    OR ρ(c.state) ≤ ρ(maxHard)   // downstream cannot be less restrictive than maxHard
    OR c.state == null            // fact-only pass-through
  )
```

Special cases:


| Upstream (P1–P2)                  | Downstream (P4–P5)          | Result                             |
| --------------------------------- | --------------------------- | ---------------------------------- |
| `hidden`                          | `visible` (intent selected) | `hidden` — intent loses            |
| `hidden`                          | `override_fields` selected  | `hidden`                           |
| `blocked` (intent disabled at P4) | any                         | `blocked` — P4 termination wins    |
| `visible` (P2 allowed)            | not in intent selection     | `hidden` — P4 narrows              |
| `visible`                         | `summary_only` (P5)         | `summary_only` — downgrade allowed |
| `redacted` (P2)                   | `visible` (P4)              | `redacted`                         |
| missing registry (P0)             | any                         | `hidden` — P0 termination          |


#### 14.12.6 Complete Truth Table (Two-Candidate)

For candidates `a` (class Pa) and `b` (class Pb) after resurrection guard:


| ρ(a.state) vs ρ(b.state) | Winner                 | resolutionMethod |
| ------------------------ | ---------------------- | ---------------- |
| ρ(a) > ρ(b)              | a.state                | lattice_merge    |
| ρ(b) > ρ(a)              | b.state                | lattice_merge    |
| ρ equal, Pa < Pb         | state; cite a          | tie_break (T3)   |
| ρ equal, Pb < Pa         | state; cite b          | tie_break (T3)   |
| ρ equal, Pa = Pb         | tie-break ladder T1→T6 | tie_break        |
| `blocked` in either      | `blocked`              | lattice_merge    |


**N-candidate:** reduce pairwise with stable sort:

```text
sort candidates by (ρ desc, precedenceClass asc, specificityScore desc,
                    revisionId desc, nodeId asc)
fold merge using truth table rules
```

Stable sort guarantees deterministic fold order.

#### 14.12.7 Tie-Break Ladder (Executable)

Applied only when ρ and resurrection guard leave multiple winners:

```text
tieBreak(candidates):
  for step in [T1_supersedes, T2_specificity, T3_precedence, T4_revision, T5_nodeId, T6_artifactId]:
    winners = filterToBest(candidates, step)
    if |winners| == 1: return winners[0], step
  FAIL conflict:unresolved
```


| Step | Function                                                                |
| ---- | ----------------------------------------------------------------------- |
| T1   | Keep candidate whose `supersedes` contains other's `artifactRevisionId` |
| T2   | Max `specificityScore`; tie → next step                                 |
| T3   | Min `precedenceClass` numeric (P0=0 .. P6=6)                            |
| T4   | Max `artifactRevisionId` lexicographic                                  |
| T5   | Min `nodeId` lexicographic                                              |
| T6   | Min `artifactId` lexicographic                                          |


**Publication rule:** if tie-break reaches FAIL during graph publish validation with static
fixture coordinates → graph rejected. At runtime → `blocked` + `conflict:unresolved`.

#### 14.12.8 ConflictResolver Algorithm (Complete)

```text
ConflictResolver.resolve(fieldId, candidates) -> ConflictResolutionResult:

1. C0 = sort(candidates, candidateSortKey)     # stable pre-sort
2. if C0 is empty:
     return blocked(fieldId, reason=conflict:no_candidates)
3. if |C0| == 1:
     return finalize(C0[0], method=single_candidate)

4. // Early termination candidates (terminated=true) from P0,P1,P4
   T = { c ∈ C0 | c.terminated AND ρ(c.state) ≥ ρ(hidden) }
   if T not empty:
     winner = mergeState(T); pick highest-precedence terminated source
     return finalize(winner, method=resurrection_guard)

5. C1 = applyResurrectionGuard(C0)

6. states = { c.state | c ∈ C1 AND c.state != null }
   if states empty:
     return visible(fieldId)    # all pass-through; default visible (matches linear engine)

7. merged = mergeState(states)

8. winners = { c ∈ C1 | c.state == merged OR (c.state null AND merged==visible) }
   if |winners| == 1:
     return finalize(winners[0], method=lattice_merge)

9. winner, step = tieBreak(winners)
   return finalize(winner, method=tie_break, tieBreakStep=step)

finalize(winner):
  reasonChain = coordinatePrefix(fieldId) + winner.reasonCodes + losers.reasonCodes
  appliedPolicies = sortUnique(all appliedArtifactIds from winner)
  return ConflictResolutionResult { ... }
```

#### 14.12.9 Nested Conflict: FieldPolicy Rule Conflicts (P1 Internal)

Inside `hard_constraint_node`, multiple FieldPolicy rules may match one field.
`resolveFieldState` resolves **before** candidates reach P6:

```text
compareRules(left, right):
  1. higher priority wins
  2. lower STATE_PRECEDENCE[state] wins (hidden=0 beats visible=1)
  3. higher rule.id lexicographic wins
```

P6 receives **one** P1 candidate per field — internal rule conflict is not a graph conflict.
This is intentional: FieldPolicy subgraph is self-contained.

#### 14.12.10 Transitional Outer Conflict (Legacy vs Engine)

Today a second conflict layer exists **outside** the graph:

```text
finalEligibleFieldIds =
  runtimeMode == cutover AND scope accepted
    ? engineSelectedFieldIds
    : legacyEligibleFieldIds        # resolveDeliveryFieldPolicy
```


| Layer                      | Authority today                 | Target                     |
| -------------------------- | ------------------------------- | -------------------------- |
| Per-field graph (implicit) | `resolveFieldExposureDecision`  | `conflict_resolution_node` |
| Outer selector             | `resolveActiveDeliveryFieldIds` | **removed** — graph only   |


Until cutover completes, shadow comparison (`compare-shadow-vs-legacy.ts`) classifies
field-level drift between layers. **Outer selector conflict is not resolved by P6** — it is
a migration artifact.

#### 14.12.11 Current Linear Engine as Implicit Resolver

`resolveFieldExposureDecision` implements conflict resolution via ordered early returns —
equivalent to steps 4–7 for single-path candidates:


| Step                              | Code lines | Implicit winner |
| --------------------------------- | ---------- | --------------- |
| Registry missing                  | 40–42      | P0 → hidden     |
| FieldPolicy hidden                | 69–70      | P1 → hidden     |
| Not in exposurePolicy allowed set | 79–84      | P2 → hidden     |
| Intent disabled                   | 95–97      | P4 → blocked    |
| Intent override not selected      | 101–104    | P4 → hidden     |
| Default                           | 110        | visible         |


No tie-break needed today because each precedence layer short-circuits. Extracting to P6
MUST preserve this table on all golden fixtures.

#### 14.12.12 Compile-Time vs Runtime Conflicts


| Conflict type                      | When detected | Action                                                             |
| ---------------------------------- | ------------- | ------------------------------------------------------------------ |
| Graph ambiguous tie on fixture set | publish       | reject graph                                                       |
| Missing conflict node in subgraph  | publish       | reject graph                                                       |
| Plugin resurrection rule violation | publish       | reject plugin artifact                                             |
| Runtime unresolved tie after guard | evaluate      | `blocked` + log                                                    |
| Legacy vs engine field mismatch    | shadow only   | drift report; no user impact                                       |
| FieldPolicy internal tie unbroken  | evaluate      | `hidden` (no winning rule → hidden default in `resolveFieldState`) |


#### 14.12.13 explain(fieldId) Conflict Output

```text
explain(fieldId) -> {
  finalState,
  winningNode: { nodeId, precedenceClass, artifactRevisionId },
  losingNodes: [...],
  resolutionMethod,
  tieBreakStep?,
  resurrectionGuardApplied: boolean,
  stateLatticeRanks: { candidateId: ρ(state) },
  reasonChain,
  appliedPolicies
}
```

Must be reconstructable from `ExecutionTrace` without re-running graph (Section 14.5.9).

#### 14.12.14 Golden Conflict Fixtures (Required)


| Fixture id | Scenario                            | Expected state                   |
| ---------- | ----------------------------------- | -------------------------------- |
| `CR-01`    | P0 missing registry                 | `hidden`                         |
| `CR-02`    | P1 hidden + P4 selected             | `hidden`                         |
| `CR-03`    | P2 not allowed + P4 selected        | `hidden`                         |
| `CR-04`    | P4 disabled                         | `blocked`                        |
| `CR-05`    | P4 override not selected            | `hidden`                         |
| `CR-06`    | P2 allowed + P4 selected            | `visible`                        |
| `CR-07`    | P5 summary_only + P4 visible        | `summary_only`                   |
| `CR-08`    | Two P1 rules tie on priority        | inner `compareRules` winner      |
| `CR-09`    | N-candidate fold order independence | stable merged state              |
| `CR-10`    | Unresolved artifact tie             | publish FAIL / runtime `blocked` |


#### 14.12.15 Acceptance Criteria

Conflict resolution strategy is complete when:

1. `ConflictResolver.resolve()` implements Sections 14.12.5–14.12.8 exactly.
2. Golden fixtures CR-01..CR-10 pass for linear and graph kernels.
3. `explain(fieldId)` cites `resolutionMethod` and winning/losing nodes.
4. Resurrection guard prevents all P4/P5 visibility resurrections over P1/P2 hidden.
5. Unresolved ties fail at publish time when detectable; runtime fail-closed otherwise.
6. Outer legacy selector removed — no second conflict layer.
7. FieldPolicy internal conflicts remain inside P1; never reach P6 as multiple P1 candidates.

### 14.13 Acceptance Criteria for "Graph Execution Rules Complete"

The specification is implementation-complete when:

1. Graph publication rejects unresolved conflicts at compile time.
2. Every `FieldDecision` cites winning `nodeId`, `artifactRevisionId`, and precedence rule.
3. `deterministicReplayKey` is stable across processes for same pinned inputs.
4. Cache keys are tenant-scoped and include policy version.
5. Plugin sandbox cannot access non-approved fields (contract test).
6. Golden replay fixtures pass for Denali Telegram scopes.
7. `explain(fieldId)` matches `resolveFieldExposureDecision` output during transition.

