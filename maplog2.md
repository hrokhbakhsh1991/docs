# Denali Wizard Step Reorder — Execution Log

## Phase 1 — Step Reorder Alignment (Completed)

Date: 2026-05-27

### Scope Applied
- Verified current rail order is sourced from `apps/web/src/features/tours/wizard/denaliStepConfig.ts`.
- Verified step component mapping in `apps/web/src/components/tours/wizard/DenaliCreateTourWizard.tsx` (`DenaliStepBody`) is aligned to step ids.
- Kept canonical paths unchanged (no edits in `DenaliCanonicalPathUtils.ts`).
- Kept draft/canonical state logic untouched (no edits in `DenaliCanonicalContext` or draft adapters).
- Kept shared/api imports untouched.

### Rail Order (Source of Truth)
`denali_basic -> denali_photos -> denali_program -> denali_logistics -> denali_pricing -> review`

### Validation/Index Guard
- Scan in `apps/web/src/features/tours/wizard/denali/validation/*.ts` showed no `stepIndex/currentStepIndex` coupling.
- Validation ownership remains path/step-id based.

### Test Verification (phase-related)
- node:test batch passed: **26/26**
  - `steps/__tests__/DenaliBasicInfoStep.navigation.spec.ts`
  - `steps/__tests__/DenaliPhotosStep.spec.ts`
  - `steps/__tests__/DenaliProgramNatureStep.spec.ts`
  - `steps/__tests__/denaliStepRelocation.spec.ts`
  - `denaliCanonicalPathUtils.spec.ts`
  - `tourWizardStepPlan.spec.ts`
- Jest integration passed: **1/1**
  - `steps/__tests__/DenaliLogisticsStep.integration.test.tsx`

### Result
- Phase 1 is complete with zero state-logic side effects.
- No canonical path strings were changed.






Gap Analysis — Phase B UX Integrity (Fail-Focused)
Critical non-compliance and likely failures
FocusBridge requirement is not truly tested by the new e2e tests.

In apps/web/tests/e2e/denali-ux-integrity.spec.ts, keyboard test mostly checks active element after Next, but it does not prove DenaliStepFocusBridge caused that focus.
DenaliStepFocusBridge in apps/web/src/features/tours/wizard/denali/DenaliStepFocusBridge.tsx only calls consumePendingFocus(stepId).
consumePendingFocus is triggered only when navigateToField(...) sets pending state in DenaliWizardNavigationContext.
Regular Next-button navigation does not set pending focus. So your “first input focus after every step navigation” requirement is not guaranteed by this mechanism.
Focus target map has broken selectors, so focus can silently fail and land nowhere useful.

In apps/web/src/features/tours/wizard/denali/denaliWizardFieldFocus.ts:
basicInfo.title maps to [data-field-path="basicInfo.title"] but DenaliBasicInfoStep input does not expose this attribute.
pricingPayment.basePricePerPerson maps to [data-field-path="pricingPayment.basePricePerPerson"] but DenaliPricingStep uses data-testid="denali-pricing-base-price" instead.
photosData.photos maps to [data-testid="denali-photos-step"] but actual step container is data-testid="denali-step-photos".
Result: focusDenaliWizardField(...) can no-op, leaving focus at previous control or body.
Review summary jump-link test is state-forced, not real user-flow validation.

apps/web/tests/e2e/denali-ux-integrity.spec.ts uses applyDenaliWizardIntegrationPatch(...) after reaching review.
This bypasses real input events and bypasses true “user leaves Step 2 required field empty then navigates”.
It validates a synthetic state, not true end-user flow integrity.
CI execution path is effectively unreliable for this new e2e spec.

apps/web/playwright.config.ts sets baseURL to 127.0.0.1.
The test setup in denali-ux-integrity.spec.ts prioritizes testInfo.project.use.baseURL over PW_BASE_URL.
Workflow step in .github/workflows/playwright-visual-tests.yml sets PW_BASE_URL=http://denali.localhost:3000, but this is likely ignored by current test logic.
Result: Denali wizard may not resolve, tests skip, CI gives false green.
FocusBridge Audit Findings
DenaliStepFocusBridge is not “first field tracker.”

It consumes pending focus requests only.
It does not compute first interactable element per step.
It does not run on plain step transitions unless pending state exists.
Body-focus scenario is real.

When selectors don’t match, focusDenaliWizardField returns without focusing.
There is no fallback “focus first interactive element in step container”.
In this case focus can stay on previous Next button, modal trigger, or body.
Review Summary Audit Findings
Link generation is dynamic but depends on accurate field-path → DOM selector mapping.

DenaliReviewValidationSummary emits denali-validation-field-link-${formPath} and calls navigateToField(stepId, formPath).
If denaliWizardFieldFocus lacks valid selector for formPath, link click navigates step but may not focus/highlight field.
Current map mismatch examples above make this fragile.
Dirty-state coupling risk remains untested.

Current e2e test does not validate behavior under normal dirty/touched form evolution.
It injects a patch directly; this can mask issue states where summary content only appears/disappears based on validation timing and visibility rules.
Concurrency / State Leakage (Ghost Fields) Audit
Phase B implementation does not test ghost-field purge after kind switch/reload.

No assertion in denali-ux-integrity.spec.ts for stale fields persisting in CanonicalContext after switching kind.
Existing ghost/draft coverage is in other tests (Phase A/unit), but UX Integrity phase itself does not include that risk explicitly.
If applyDenaliWizardIntegrationPatch seeds full defaults, it can hide leakage paths instead of exposing them.
No explicit UX-level verification that prior-kind fields are removed from review summary after switch.

This is a high-risk regression vector and currently not covered in Phase B file.
A11y / Keyboard Flow Audit
Keyboard-only test is not strict keyboard-only.

It uses helper fills (fillDenaliTitle, select setters) driven programmatically, not pure Tab/Enter traversal.
This does not validate full keyboard reachability chain.
Map interaction path has keyboard accessibility holes.

DenaliLocationPickerMapInner (MapContainer) has no clear tabbable/focusable keyboard path for selecting coordinates.
No tabIndex/keyboard handlers for map click alternative.
If location selection is required in some flow, keyboard-only user may be blocked.
This exact case is not covered in current Phase B tests.
Flakiness / Race Condition Risks
Swallowed readiness waits.

waitForDenaliWizardAuthHydrated(...) catches timeout and suppresses failure.
Tests may continue before auth/session is actually ready.
Network idle as readiness gate is brittle.

page.goto(..., { waitUntil: "networkidle" }) can be unstable with background requests.
Response waiters are race-prone in shared contexts.

Helpers like waitForDraftPatch / waitForDraftPatchAttempt rely on generic route regexes.
In multi-page or noisy draft traffic, wrong response can satisfy wait unexpectedly unless tightly scoped.
Hard-coded tab loop bound (30) is brittle.

Any extra focusable element introduces false failures.
Missing Requirements Report (Phase B)
Missing deterministic proof that FocusBridge controls step-entry focus (not just activeElement coincidence).
Missing fallback strategy in focus engine when selector map fails (body-focus risk).
Missing real user-path test for review summary (no direct patch injection).
Missing explicit ghost-field UX test after kind-switch + reload in this phase file.
Missing keyboard accessibility coverage for map/location picker controls.
Missing CI-safe Denali host resolution for e2e lane (high risk of skipped tests being treated as success).
Missing robust readiness synchronization (auth wait swallowed; networkidle reliance).




## Phase B — UX Integrity (Implementation + Verification)

Date: 2026-05-27

### Scope Applied
- Added dedicated UX integrity e2e suite in `apps/web/tests/e2e/denali-ux-integrity.spec.ts`.
- Covered keyboard focus flow across wizard transitions.
- Covered review validation summary jump-to-field behavior and focus/highlight handoff.
- Wired CI discovery path for e2e lane:
  - `apps/web/playwright.config.ts` includes `e2e/**/*.spec.ts` in CI match.
  - `.github/workflows/playwright-visual-tests.yml` includes explicit Denali UX e2e step.

### Implemented Scenarios
- Keyboard-only navigation focus assertions:
  - Step transitions from basic -> photos -> program -> logistics -> pricing.
  - `document.activeElement` checked against step-first expected selectors.
- Review validation summary integration:
  - Injected invalid field state for `programNature.shortDescription`.
  - Asserted summary visibility, clicked summary field link, verified:
    - Step redirection to photos.
    - Target field focus.
    - Focus shell highlight (`data-denali-focus="true"`).

### Phase B Verification Status
- Test file implemented and included in CI routing.
- Known quality gap findings documented in this file under:
  - `Gap Analysis — Phase B UX Integrity (Fail-Focused)`
- Those findings remain the authoritative risk backlog for hardening.

### Result
- Phase B implementation is registered and executable.
- Critical UX/risk gaps are explicitly documented for follow-up hardening.


## Phase C — Backend Integrity (Implementation + Runtime Outcome)

Date: 2026-05-27

### Scope Applied
- Added new backend e2e suites:
  - `apps/api/test/e2e/tours-rbac-parity.e2e-spec.ts`
  - `apps/api/test/e2e/finance-cutover-integrity.e2e-spec.ts`
- Reused real e2e infra (testcontainers + bootstrap + OTP session path), no guard mocking.
- Enforced tenant host/token separation in test requests.
- Added explicit vulnerability-surfacing assertions (no silent pass on security visibility gaps).

### Security/Integrity Scenarios Implemented
- RBAC parity suite:
  - Contract-gap probe for nonexistent `PATCH /api/v2/tours/:tourId/pricing` -> `404`.
  - Real enforcement on `PATCH /api/v2/tours/:tourId`:
    - low-privilege role denied (`403`).
    - owner positive control allowed (`200`).
  - Audit-visibility guardrail assertion for denied pricing attempts.
- Financial cutover suite:
  - Draft `pricingSnapshot` invariance after external pricing mutation.
  - Draft OCC/versioning race: parallel same-base writes -> one `200`, one `409`.
  - Tenant isolation probe on cross-tenant draft access path.
  - Audit-visibility guardrail assertion for deny path.

### Supporting Runtime Fixes (to execute real paths)
- Added explicit DI injection annotations in draft-engine runtime path:
  - `apps/api/src/modules/draft-engine/draft-engine.controller.ts`
  - `apps/api/src/modules/draft-engine/draft-engine.facade.ts`
  - `apps/api/src/modules/draft-engine/storage/draft-scope.resolver.ts`
- Purpose: prevent undefined dependency resolution in e2e and ensure controller->facade->store execution.

### Isolated Execution Results
- `node --import tsx --test test/e2e/tours-rbac-parity.e2e-spec.ts`
  - pass: 3
  - fail: 1
  - failing assertion: audit visibility growth check for allowed/denied pricing mutation stream.
- `node --import tsx --test test/e2e/finance-cutover-integrity.e2e-spec.ts`
  - pass: 3
  - fail: 1
  - failing assertion: audit visibility growth check for pricing mutation security path.

### Security Visibility Findings (Surfaced, Not Hidden)
- Unauthorized/forbidden pricing mutation path is not producing the expected observable audit growth in these checks.
- This is currently treated as an explicit security visibility gap and remains intentionally red in Phase C verification.

### Result
- Phase C test suites are implemented, wired, and executable in isolation.
- Core guardrails (RBAC deny/allow, OCC conflict, snapshot invariance) are covered.
- Audit visibility gap is surfaced by failing assertions and remains open for backend remediation.
