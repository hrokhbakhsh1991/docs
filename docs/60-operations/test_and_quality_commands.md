# Test and Quality Commands

Document-ID: MKT-DOC-OPS-TEST-QUALITY-COMMANDS
Version: v1.0
Status: Active
Owner: QA Lead
Last-Updated: 2026-04-28
Language: English
Canonical-Reference: docs/30-analysis/step_07_test_strategy.md

## 1. Purpose

Provide one authoritative command reference for quality gates and test execution.

## 2. Test Model

Aligned with active strategy:

- unit tests: field rules, small logic guards
- integration tests: tenant boundaries, endpoint behavior, persistence interactions
- contract tests: endpoint envelope/schema invariants
- e2e tests: role/mode journey behavior

Reference:
- `docs/50-validation/test_case_id_traceability_matrix_v2.md`
- `docs/30-analysis/step_07_test_strategy.md`

## 3. Command Catalog

Fill exact commands based on actual runtime/tooling in repository.

| Command | Scope | Runtime Estimate | Blocks Merge | Related SR/TC |
|---|---|---|---|---|
| `[REQUIRED_FILL: lint_command]` | lint | short | yes | all changed surfaces |
| `[REQUIRED_FILL: format_check_command]` | formatting check | short | yes | all changed surfaces |
| `[REQUIRED_FILL: typecheck_command]` | static types | short/medium | yes | contract integration layers |
| `[REQUIRED_FILL: unit_test_command]` | unit suite | medium | yes | `SR-FR-002`, `SR-FR-009` |
| `[REQUIRED_FILL: integration_test_command]` | integration suite | medium/high | yes | `SR-FR-001`, `SR-NFR-001`, `SR-NFR-002` |
| `[REQUIRED_FILL: contract_test_command]` | API contracts | medium | yes | envelope + endpoint schema stability |
| `[REQUIRED_FILL: e2e_test_command]` | critical journeys | high | conditional | `SR-FR-006`, `SR-FR-010` |

## 4. Recommended Execution Order

Fast feedback path:

1. lint
2. format check
3. typecheck
4. targeted unit tests
5. targeted integration tests

Pre-merge path:

1. all above
2. contract suite
3. critical e2e pack

## 5. CI Parity Rules

- Local pre-push command set should mirror CI gate sequence.
- No merge if merge-blocking suites fail.
- Test evidence should map to stable `TC-*` IDs where applicable.

## 6. Flaky Test Policy

- first failure: rerun once
- repeated failure: classify as flaky and open issue with owner
- merge only if policy allows and risk acceptance is documented

## 7. PR Evidence Format

Each PR should attach:

- executed command list
- pass/fail summary
- relevant `TC-*` IDs validated
- known failures and disposition

## 8. Day-1 Critical Focus (From Current Baseline)

Prioritize coverage:

- tenant fail-closed boundaries (`SR-NFR-001`)
- registration intake validation (`SR-FR-002`, `SR-FR-009`)
- duplicate active registration guard (`SR-FR-001`)
- canonical error envelope conformance
