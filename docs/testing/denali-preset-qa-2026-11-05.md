# Denali preset QA — 2026-11-05

Status: INCOMPLETE. Rule editing, failed-load protection and automatic matching are implemented and locally tested. Corrected staging browser/purchase acceptance remains open.

## Provenance and reproduction

- Base/test source and staging runtime: `a46fbd85ccb578cc7eea5eafaa392c9b2671b634`.
- Runtime rechecked through `/opt/app-tour-staging/current/release-manifest.json`.
- Live advanced settings page: add an unsaved rule; only its identifier and Delete appear. No tour type, theme or destination editor exists. Reload discards the unsaved rule. No settings PUT was performed.
- Component regression before fix: `Unable to find a label with the text of: Tour type`.
- Separate failed-load regression before fix: HTTP 503 still rendered an actionable Save button with empty defaults.

## Fix and verification

Existing v1 fields are editable, including enabled state. Owner/admin restrictions remain. Saving locks the form; failed initial loading cannot expose a writable blank configuration. Existing user input is kept on save errors. No API or persistence schema is changed. The create wizard now consumes advanced configuration and only fills empty canonical fields.

Run from `apps/web`:

```sh
node scripts/run-node-test-file.mjs test/presets-advanced-editor.spec.tsx test/settings-tour-presets.spec.ts test/settings-presets-advanced.spec.ts test/tour-preset-prefill.spec.ts
```

The React test configuration uses the automatic JSX transform, as Next does. It is selected by both the standard unit-test script and test:file wrapper; explicit caller configuration remains supported.

Local component tests use a mocked fetch response, including save/read-back: they are NOT API persistence or staging integration evidence. The editor suite additionally covers read-only access and failed initial load. Existing prefill tests cover empty fields, inactive presets and unknown themes.

Focused suite: 7/7 PASS. Three editor-suite runs: 3/3 each PASS. ESLint on changed component, formatting, web typecheck and import-boundary guard: PASS after building missing guest-surface-host, platform-core and SDK outputs within the isolated worktree. Installed dependencies were reused from the existing workspace; no lockfile changes or package downloads. Raw local logs: `artifacts/preset-qa/` (not release artifacts).

## Remaining acceptance

- Matching contract for this change: explicit URL preset wins, then first enabled rule matching all nonempty conditions in list order, then default. Missing/inactive targets are ignored. An invalid explicit selection does not silently fall back. `tourType` matches canonical `category`; theme matches `program.themeIds`. Existing draft values take precedence over prefill, including template seed values.
- Wizard consumes advanced settings once per tenant/plugin/selection scope; reevaluates rules locally when draft fields change. Clone mode, unresolved/conflicting/quarantined drafts, stale-tenant responses and malformed configuration/resources cannot apply prefill. Optional network failure preserves the draft; reload retries. Each selected preset is considered once so clearing a field does not cause a write loop.
- Fresh-draft title precedence, persistence through real API, cross-tenant denial, create/publish/purchase, mobile visual acceptance and error/retry behavior require additional integration coverage.
- QA2 synthetic Owner login and real BFF reads passed on staging a46fbd85. Task-owned preset create/read-back/edit/deactivate/delete passed; empty name rejected; QA2 session replay on tenant A rejected with 403. Exact created record cleanup/read-back passed. This is HTTP/BFF integration, not browser E2E.
- No corrected staging deployment, final acceptance, or merge approval is claimed.

## Continuation evidence

- Automatic-default hook regression fails on the original hook, passes with the new consumer. Additional tests cover late responses preserving typed data, category-triggered matching without refetching, clone mode, synchronization gates, invalid config, malformed resource lists and stale-tenant responses.
- API settings/version/workspace suite: 18/18 PASS (memory storage with real dispatcher).
- Booking HTTP/policy/lifecycle regression: 11/11 PASS (memory storage); this does not prove full purchase from a preset on staging.
- Local real Next browser attempt: BLOCKED. Watcher exhaustion was handled with process-scoped polling, but the login page compilation stalled under workstation memory pressure. Only task-owned API/Web processes were stopped. Corrected UI screenshots and mobile acceptance remain unverified.
- Official staging workflow permits dev or its existing specifically allowlisted QA branch. This PR branch is not allowlisted. No workflow restriction has been bypassed; merge/deployment requires authorization after current-head checks and review.

- Current focused preset suite: 20/20 PASS; auto-prefill suite repeated three times, 9/9 each. Counts describe different layers and are not combined into a single staging total.
- Two real browser tests (1280px desktop and 390px mobile) were added to the existing Phase 6 Denali smoke suite. They save and reload the rule through the real BFF/API/Postgres fixture, assert API read-back, capture screenshots, and restore fixture configuration/remove only the created preset. Execution is pending current-head CI; listing these tests is not PASS.
