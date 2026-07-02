# Field Exposure System — Architecture Freeze & Redesign Review

> Status: Architecture freeze. No implementation, no file renames, no runtime
> behavior change. This document is domain validation + redesign + migration planning.
>
> Date: 2026-06-27

---

## 0. Final Verdict

Field Exposure System is the correct end-state.

The current repository has moved in the right direction (it removed the
deliveryCandidateFieldIds drift), but it is still structurally centered on
integration delivery. The domain still starts from integration concepts
(IntegrationDeliveryIntent, deliveryCandidateFields, surface: "delivery",
provider/event-policy metadata). Those must remain only as transitional adapters,
not domain truth.

The platform should answer the generic question:

  Given a field, entity state, surface, audience, and activation context,
  may this field be exposed, and in what form?

NOT the integration-centric question:

  Which fields should be sent to Telegram / email?

Telegram, Email, PDF, Public Website, Dashboard, Wizard, and Admin Panel become
equal consumers of the same Exposure Engine.

---

## 1. Core Problem

The system is still answering the wrong question. Even after removing legacy drift,
field selection is discovered through the integration path:

- The domain primitive IntegrationDeliveryIntent is keyed by connectionId + eventType.
- The selectable field catalog is exposed from integration meta.
- The admin UI for field selection lives inside integration settings.
- surface: "delivery" conflates all outward channels into one ambiguous bucket.
- deliverable registry tags are being used as de-facto publication policy.

This is a hybrid model: partially correct, still integration-centric.

---

## 2. Required Paradigm Shift

We are NOT building an Integration Delivery System.

We are building a Field Exposure Platform. Integrations are only one consumer of
exposure decisions.

---

## 3. Forbidden Core Concepts (transitional adapters only)

These MUST NOT be core domain concepts. They may exist only as transitional adapters:

- IntegrationDeliveryIntent (as domain primitive)
- selectedFieldIds owned by integrations
- deliveryCandidateFields
- deliverable tags used as policy
- surface: "delivery"
- Telegram/email-specific field selection logic
- integration-driven field catalogs

---

## 4. Final Target Domain Model

| Layer | Responsibility | NOT responsible for |
|---|---|---|
| Field Registry | fieldId, canonicalPath, kind, presentation metadata | visibility, timing, audience, publication, integration |
| Field Policy (PDP) | entity/workspace state: hidden / visible / required / readonly / redacted | publication, surface targeting, integration selection |
| Exposure Surface | where content appears | encoding timing or triggers |
| Audience | who the field is for | being derived from surface |
| Activation Trigger | when/why evaluation happens (incl. timing) | being encoded into surface |
| Field Exposure Policy (NEW) | pure decision: visible / hidden / redacted / summary_only / blocked | sending data, scheduling, executing integrations, rendering |
| Exposure / Publication Profile | reusable default exposure shape | provider credentials |
| Exposure / Publication Intent | admin override: enabled, selected fields, template override, optional scope | being owned by integration |
| Integration Layer | transport: credentials, provider API, retries, logs, formatter adapter | deciding field exposure |

### 4.1 Exposure Surface (where)

Valid:

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

Invalid (these are triggers, not surfaces):

    before_tour_24h
    payment_completed
    registration_completed

### 4.2 Audience (for whom) — independent from surface

    public
    registered_user
    operator
    admin
    external_channel
    system

The same surface serves multiple audiences (email + registered_user,
email + operator, telegram + external_channel, telegram + operator).
Deriving audience from surface forces fake surfaces like email_operator —
the same combinatorial mistake as timing-as-surface.

### 4.3 Activation Trigger (when/why) — timing lives here

    always
    tour_created
    tour_published
    payment_completed
    registration_completed
    relative_to_tour_start(offset=-24h)
    relative_to_tour_start(offset=-48h)
    manual

### 4.4 Naming: Exposure vs Publication

- Use Exposure for the generic core (ExposurePolicy, ExposureProfile,
  ExposureIntent, ExposureResolver). Wizard / review / admin / dashboard are
  exposure surfaces, not "publication" in the external sense.
- Use Publication as a specialization for outward rendered/sent artifacts
  (PublicationProfile = an outbound exposure profile).

---

## 5. Required Evaluation Pipeline

    Field Registry
      -> Field Policy
      -> Field Exposure Policy
      -> Exposure / Publication Intent
      -> Exposure Resolver
      -> Canonical Enrichment
      -> Template Rendering
      -> Surface Consumer / Integration Provider

Integrations must NEVER be the starting point of field selection. Telegram supplies
context only:

    surface  = telegram
    audience = external_channel
    trigger  = tour_created
    scope    = connectionId

...and then receives an already-approved payload.

---

## 6. Audit Results

### A. Architecture Misalignment Table

| Current Concept | Problem | Should Become | Layer |
|---|---|---|---|
| IntegrationDeliveryIntent | Keyed by connectionId + eventType; integration transport owns field exposure choices. | Transitional adapter into ExposureIntent. | Exposure Intent |
| selectedFieldIds (integration-owned) | The override is valid; the ownership is wrong. | ExposureIntent.selectedFieldIds scoped by profile/surface/audience/trigger. | Intent |
| deliveryCandidateFields | Field catalog exposed from integration meta -> integrations become exposure entrypoint. | exposureCandidateFields / profile-derived field set. | Exposure Meta |
| surface: "delivery" | Ambiguous (Telegram? email? PDF? dashboard?). | Explicit ExposureSurface values. | Surface |
| deliverable tags | Registry tag used as default publication policy; too weak for audience/surface/trigger. | ExposureProfile.defaultFieldIds + ExposurePolicy rules. | Profile / Policy |
| Integration meta field catalog | Provider config + exposure defaults mixed. | Split provider meta from exposure/profile meta. | Integration vs Exposure |
| Telegram assumptions | Field selection path still starts from integration UI/intent. | Telegram = context provider only. | Integration Consumer |
| Templates in integration surface | Templates are presentation format, not provider ownership. | Templates belong to Exposure/Profile/Intent. | Template |
| Event policies | Routing + historical field/template residue. | Routing/activation enablement only. | Event Routing |

### B. Hidden Coupling (evidence)

Coupling is mostly in the domain shape, not in Telegram provider code:

- apps/api/src/integrations/domain/integration-delivery-intent.ts — makes
  connectionId + eventType the owner of field intent.
- apps/api/src/integrations/platform/integration-surface-meta.ts — exposes
  deliveryCandidateFields from integration metadata.
- apps/web/app/(app)/settings/integrations/integration-event-delivery-policy-panel.tsx
  — integration settings UI is the field-selection editor.
- packages/workspaces/denali/src/integrations/denali-field-policy.manifest.ts —
  uses surface: "delivery" (too broad).
- packages/workspaces/denali/src/field-registry/denaliFieldRegistryData.ts —
  deliverable tags act as publication defaults.
- docs/architecture/field-policy-system.md — still uses delivery defaults,
  selected fields, and surface: "delivery" as core language.

### C. Model Validation

1. Should FieldPolicy and ExposurePolicy be separate? — Yes.
   FieldPolicy = field state given entity/workspace state. ExposurePolicy = may the
   field appear given surface + audience + trigger + entity state. Merging pollutes
   every workspace field rule with audience/trigger/channel concerns -> long-term drift.

2. Is Integration incorrectly owning domain decisions? — Yes, conceptually.
   Even with clean provider code, IntegrationDeliveryIntent and
   deliveryCandidateFields make integrations the ownership boundary for exposure.

3. Is surface + trigger separation valid long term? — Yes, essential.
   surface=telegram + trigger=relative_to_tour_start(-24h) is correct;
   surface=telegram_before_24h causes combinatorial explosion.

4. Rename PublicationIntent -> ExposureIntent? — Yes for the generic core.
   Reserve "Publication" for outward rendered/sent artifacts.

---

## 7. Migration Strategy (no implementation yet)

Must NOT break Denali or Telegram.

### Phase 1 — Introduce Exposure model (no behavior change)
Define language and contracts only:
ExposureSurface, Audience, ActivationTrigger, ExposurePolicy,
ExposureProfile, ExposureIntent, ExposureContext, ExposureDecision.

### Phase 2 — Adapter IntegrationDeliveryIntent -> ExposureIntent

    IntegrationDeliveryIntent.connectionId -> ExposureIntent.scope.connectionId
    eventType                              -> trigger
    provider telegram                      -> surface = telegram
    selectedFieldIds                       -> selectedFieldIds
    templateId                             -> template override

Existing rows read through an adapter; Denali + Telegram keep working.

### Phase 3 — Generic Exposure UI
Move the field checklist out of "integration delivery policy" into a generic
exposure/profile editor. The Telegram settings page may embed/link it but does not own it.

### Phase 4 — Remove integration-owned selection
Deprecate/remove: IntegrationDeliveryIntent, deliveryCandidateFields,
surface: "delivery", deliverable-as-policy, integration-owned templates.
Keep integrations focused on credentials, provider APIs, retries, logs, delivery
status, and formatter adapters.

---

## 8. Broken Abstractions (summary)

- delivery as a generic surface
- deliverable as policy
- integration metadata as source of field catalog
- integration intent as owner of field exposure
- Telegram/email UI as policy editing surface
- event policy owning (or historically owning) content concerns
- templates scoped first to integrations instead of exposure profiles

---

## 9. Recommended Architecture (diagram-like)

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

---

## 10. End-State Confirmation

The final platform should not ask "Which fields does Telegram send?" but
"For this field, entity state, surface, audience, and trigger, what exposure form is
allowed?" — with Telegram, Email, PDF, Public Website, Dashboard, Wizard, and Admin
Panel all equal consumers of one generic Field Exposure Engine.
