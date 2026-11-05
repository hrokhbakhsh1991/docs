# Denali preset QA — 2026-11-05

Status: INCOMPLETE. This change fixes rule editing and failed-load protection; it does not close automatic matching or the purchase matrix.

## Provenance and reproduction

- Base/test source and staging runtime: `a46fbd85ccb578cc7eea5eafaa392c9b2671b634`.
- Runtime rechecked through `/opt/app-tour-staging/current/release-manifest.json`.
- Live advanced settings page: add an unsaved rule; only its identifier and Delete appear. No tour type, theme or destination editor exists. Reload discards the unsaved rule. No settings PUT was performed.
- Component regression before fix: `Unable to find a label with the text of: Tour type`.
- Separate failed-load regression before fix: HTTP 503 still rendered an actionable Save button with empty defaults.

## Fix and verification

Existing v1 fields are editable, including enabled state. Owner/admin restrictions remain. Saving locks the form; failed initial loading cannot expose a writable blank configuration. Existing user input is kept on save errors. No API, persistence schema, wizard or purchase behavior is changed.

Run from `apps/web`:

```sh
node scripts/run-node-test-file.mjs test/presets-advanced-editor.spec.tsx test/settings-tour-presets.spec.ts test/settings-presets-advanced.spec.ts test/tour-preset-prefill.spec.ts
```

The React test configuration uses the automatic JSX transform, as Next does. It is selected by both the standard unit-test script and test:file wrapper; explicit caller configuration remains supported.

Local component tests use a mocked fetch response, including save/read-back: they are NOT API persistence or staging integration evidence. The editor suite additionally covers read-only access and failed initial load. Existing prefill tests cover empty fields, inactive presets and unknown themes.

Focused suite: 7/7 PASS. Three editor-suite runs: 3/3 each PASS. ESLint on changed component, formatting, web typecheck and import-boundary guard: PASS after building missing guest-surface-host, platform-core and SDK outputs within the isolated worktree. Installed dependencies were reused from the existing workspace; no lockfile changes or package downloads. Raw local logs: `artifacts/preset-qa/` (not release artifacts).

## Remaining acceptance

- Rule priority is unspecified in the existing contract. Confirm first matching enabled rule vs most-specific rule before implementing a consumer. Explicit URL selection and preserving user-entered data must remain protected.
- Wizard currently does not consume advanced settings. Saving a rule does not prove automatic matching.
- Fresh-draft title precedence, persistence through real API, cross-tenant denial, create/publish/purchase, mobile visual acceptance and error/retry behavior require additional integration coverage.
- QA2 identity preview passed; it is not proof of login or fixture application.
- No corrected staging deployment, final acceptance, or merge approval is claimed.
