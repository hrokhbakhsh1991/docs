# Phase 3.0 validation — 2026-09-25

## Evidence

- SHA: `6df212b29e00ef57370360a7f785e114d6465b30`
- `pnpm run phase-1:gate`: PASS; current-SHA report `reports/phase-1-guard-2026-09-25.json` (`phase=1.6`, 16 checks).
- `pnpm run phase-2:gate` initial run: BLOCKED at `pnpm test`; build completed, but the test bundle reported 7 failures in the Telegram/field-exposure delivery-template contract.
- Post-fix `pnpm run phase-2:gate`: PASS on HEAD `6df212b29e00ef57370360a7f785e114d6465b30`; API suite `3141 pass / 0 fail / 7 skipped`, Web suite `2042 pass / 0 fail`, platform-core Phase 2 contract `10/10 pass`, and all Phase 2 guards passed.
- Root cause confirmed: the Denali surface intentionally changed its `TourPublished` template to the Persian active-surface copy in commit `6c6d63f19`, while migration seed/docs/tests still asserted the old English template. The contract was aligned without adding a parallel mapping or state.
- Focused post-fix verification: 5 affected suites, 28/28 tests PASS; `pnpm --filter @apps/api exec tsc --noEmit`: PASS.
- `pnpm run doc-gate`: PASS.
- `pnpm run phase-3:guard`: PASS; 10 required and 1 optional check passed, including `p3_doc_gate`.
- `pnpm --filter @app-tour/workspace-sdk run test`: PASS (485/485).
- `pnpm --filter @app-tour/theme-react run test`: PASS (27/27).
- `git diff --check`: PASS.

## Classification

| Area | Result | Classification | Decision |
|---|---|---|---|
| Phase 1 current-SHA baseline | PASS | confirmed-bug: none | eligible baseline |
| Phase 2 current-SHA baseline | PASS after fix | confirmed-gap → fixed contract drift | full gate is green on current HEAD |
| Phase 3 status contradiction | Closed vs Scaffold | confirmed-gap | fixed to Scaffold / In Progress |
| `doc-gate` ownership | outer-step claim vs `p3_doc_gate` | confirmed-gap | single owner is `phase-3:guard`; no duplicate outer call |
| CASL and theme ingress order | existing tests pass | false-positive for missing coverage | no new state, endpoint, abstraction, or duplicate tests |

## Phase 3.0-D backlog classification

| Item | Code evidence | Classification | Decision |
|---|---|---|---|
| Dev bearer / production boundary | `apps/api/src/tenant-kernel/auth-env.ts` fails closed outside `NODE_ENV=test`; auth-env and tenant-kernel tests cover enabled/disabled/production cases | false-positive | no auth rewrite; preserve the existing guard and test contract |
| Web session per request | `resolveRequestBootstrapAppSession`, `readOperatorSessionFromCookies`, and host/session tests read `headers()`/`cookies()` inside each request path; no module-static session source was found in the active path | false-positive | no parallel session state or provider rewrite |
| Canonical persistence / write full-scan | `CanonicalTourService.writeTour` validates only `[written, legacy]`; `InMemoryTourRepository` uses `byId` + `idsByTenant`, caps, and the no-full-scan test passes; operator price sort is explicitly tenant/filter scoped before slicing | false-positive for the named R2 write-path gap | no speculative storage refactor; Postgres/index work remains a later phase concern |
| Web `POST /tours` and `accessibleBy` | `createTourAction` → API `handleCreateTour` → `ToursService` → `CanonicalTourService`; `ScopedTourRepository` injects `accessibleByTourWhere` for create/read/update | false-positive | no endpoint or ACL duplicate |
| Wizard binding / canonical source | `WorkspaceWizardHost` edits `TourWizardDraft` through canonical paths; `createTourAction` receives the draft payload; SDK `CanonicalDocument` is the persisted contract; wizard security test denies DOM before plugin load | false-positive | no RHF mirror or second state machine |
| Direct Denali / primitives barrel imports | `apps/web/test/barrel-hunt.spec.ts` and Phase 3 import-boundary guard pass; active UI imports use allowed primitive subpaths | false-positive | no import cleanup without a failing evidence case |

The Phase 3.0 control-plane prerequisite is now green on current HEAD. Runtime Phase 3 certification remains out of scope until the classified backlog items receive their required runtime evidence.

## Phase 2 contract drift and fix

The failing assertions expected `Tour published: {{title}}`, while the current seeded Denali profile returns the Persian template `🆕 تور جدید منتشر شد`. `git blame` traced the active behavior to the intentional Denali surface change in `6c6d63f19`; the stale migration constant, architecture example, and test expectations were updated to the canonical surface template.

- `apps/api/src/exposure/legacy-delivery-exposure-mapper.spec.ts`
- `apps/api/src/exposure/resolve-registry-seeded-exposure-profile.spec.ts`
- `apps/api/src/integrations/platform/format-integration-delivery-message.spec.ts` (four assertions)
- `test/field-exposure-phase-4-denali-profile-parity.spec.ts`

Verification covered the migration remap plan in addition to the four original failure areas: 28/28 focused tests PASS. The complete Phase 2 gate then passed on the same current HEAD, so the template drift is closed as a contract correction rather than a runtime feature defect.
