# Getting Started (Start from Zero)

Document-ID: MKT-DOC-OPS-GETTING-STARTED
Version: v1.0
Status: Active
Owner: Engineering Lead
Last-Updated: 2026-04-28
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

## Who This Guide Is For

This guide is for new developers joining this project who need a safe, practical, day-1 setup path from a clean machine.

You should use this guide if you are:
- onboarding to backend, frontend, or full-stack implementation
- unfamiliar with this product's tenant-scoped model
- starting work on P0 stories and need strict doc-to-code alignment

---

## What This Project Is (Concise Context)

This product is a leader-centric operational system for tours with:
- strict tenant isolation
- dual entry modes:
  - Telegram Mini App
  - Standalone web
- one shared business core across both modes

Core operational domain:
- registration lifecycle (`Pending`, `Accepted`, `Rejected`, `Cancelled`, `NoShow`)
- waitlist lifecycle (`Waiting`, `Converted`, `Cancelled`)
- payment tracking (`NotPaid`, `Partial`, `Paid`)
- role-aware access (`Leader`, `Participant`, limited `Admin` operational scope)

Implementation baseline status:
- documentation gate is `GO`
- final sanity check is `READY_TO_BUILD: YES`
- day-1 implementation scope is active and traceability-locked

Primary references:
- `docs/50-validation/final_pre_dev_sanity_check_v2.md`
- `docs/50-validation/pre_dev_gate_decision_memo_v2.md`
- `docs/30-analysis/step_06_implementation_backlog.md`
- `docs/50-validation/day1_dev_kickoff_execution_plan.md`
- `docs/50-validation/day1_dev_progress_log.md`

---

## Quick Prerequisites Checklist

Minimum tooling (project-specific versions must be filled from runtime files):
- `git` installed and working
- `curl` installed
- one package/runtime toolchain detected from repository files (for example Node/Python/Go)
- local database/runtime dependencies available if required by project services
- terminal + editor ready

Run this detection block first (safe, copy-paste):

```bash
cd /path/to/repo
git --version
curl --version
rg --files -g "package.json" -g "pnpm-lock.yaml" -g "yarn.lock" -g "package-lock.json" -g "pyproject.toml" -g "requirements.txt" -g "go.mod" -g "docker-compose*.yml" .
```

If any expected runtime/config file is missing, mark:
- `project-specific: fill required` and escalate to repo owner before coding.

---

## 10-Minute Quickstart Path

Use this path when you need to start safely without full platform hardening.

### 1) Clone and enter repository

```bash
git clone <project-specific: fill required repo url>
cd <project-specific: fill required repo folder>
```

### 2) Confirm authoritative baseline docs exist

```bash
test -f docs/docs/50-validation/final_pre_dev_sanity_check_v2.md
test -f docs/docs/50-validation/pre_dev_gate_decision_memo_v2.md
test -f docs/docs/30-analysis/step_06_implementation_backlog.md
```

### 3) Confirm local runtime entrypoints (project-specific)

```bash
rg --files -g "package.json" -g "pyproject.toml" -g "go.mod" -g "docker-compose*.yml" .
```

Then set these before running app/services:
- `<PROJECT_INSTALL_COMMAND>` (project-specific: fill required)
- `<PROJECT_DEV_COMMAND>` (project-specific: fill required)
- `<PROJECT_TEST_COMMAND>` (project-specific: fill required)

### 4) Align first task with traceability

Pick one day-1 task from:
- `STORY-01-01`
- `STORY-02-01`
- `STORY-02-02`

Before coding, record:
- story ID
- SR mapping
- test ID mapping
- expected evidence artifact

Source:
- `docs/50-validation/day1_dev_kickoff_execution_plan.md`

---

## Full Setup Path (Operational)

Follow this sequence for full, production-grade local setup:

1. Product and semantics baseline:
   - `docs/20-architecture/canonical_framework.md`
   - `docs/10-product/requirements.md`
2. System requirement and backlog baseline:
   - `docs/30-analysis/step_03_system_requirements.md`
   - `docs/30-analysis/step_06_implementation_backlog.md`
   - `docs/30-analysis/step_08_execution_plan.md`
3. API/contract baseline (backend + frontend integration):
   - `docs/20-architecture/contracts/api_endpoint_contracts_v2.md`
   - `docs/20-architecture/contracts/error_response_taxonomy_v2.md`
   - `docs/20-architecture/contracts/authz_tenant_endpoint_matrix_v2.md`
   - `docs/20-architecture/contracts/participant_intake_schema.md`
4. UX behavior baseline:
   - `docs/10-product/wireflows_must_have_journeys_v2.md`
   - `docs/10-product/screen_state_spec_v2.md`
   - `docs/10-product/form_validation_ux_contract_v2.md`
5. Traceability and gate references:
   - `docs/50-validation/requirement_usecase_screen_flow_contract_traceability_v2.md`
   - `docs/50-validation/test_case_id_traceability_matrix_v2.md`
   - `docs/50-validation/day1_dev_progress_log.md`

Service/components expectation checklist inferred from current contracts:
- Auth/session service:
  - `POST /api/v2/auth/telegram/session`
  - `POST /api/v2/auth/web/session`
  - `POST /api/v2/auth/link-telegram`
- Tour management service:
  - `POST /api/v2/tours`
  - `PATCH /api/v2/tours/{tour_id}`
- Registration service:
  - `POST /api/v2/registrations`
  - `GET /api/v2/registrations/{registrationId}`
  - `PATCH /api/v2/registrations/{registrationId}/status`
  - `PATCH /api/v2/registrations/{registrationId}/payment`
- Waitlist service:
  - `POST /api/v2/waitlist-items`
  - `POST /api/v2/waitlist-items/{waitlistItemId}/convert`
  - `PATCH /api/v2/waitlist-items/{waitlistItemId}/cancel`
- Leader workspace and export:
  - `GET /api/v2/dashboard/leader-workspace`
  - `GET /api/v2/reconciliation/export.csv`
- Frontend surfaces (minimum critical):
  - leader screens `S-LEAD-01..06`
  - participant screens `S-PART-01..05`
  - identity screens `S-ID-01..03`

If any required service/component is missing locally:
- log a `DOC-SYNC-<date>-<seq>` item
- do not silently change behavior

---

## Verification Checklist ("You Are Ready If...")

You are ready to implement when all are true:

- [ ] Authoritative gate docs are present and aligned (`GO` + `READY_TO_BUILD: YES`)
- [ ] You can locate the day-1 target stories and their tasks in `docs/30-analysis/step_06_implementation_backlog.md`
- [ ] For your selected task, you have at least one SR ID and one Test ID mapped
- [ ] You can identify where tenant fail-closed is enforced in your implementation layer
- [ ] You can identify where canonical error envelope is emitted
- [ ] You can identify where registration uniqueness guard lives
- [ ] You know where to log divergence (`docs/50-validation/day1_dev_progress_log.md`, `DOC-SYNC-*`)
- [ ] Local install/dev/test commands are resolved (project-specific values filled)

---

## Common First-Day Mistakes

1. Implementing features before mapping `Story -> SR -> Test ID`.
2. Treating tenant context as optional instead of fail-closed mandatory.
3. Returning non-canonical error payloads instead of the defined envelope.
4. Handling Telegram/web identity as separate products instead of shared business core.
5. Skipping concurrency checks for active registration uniqueness.
6. Updating behavior in code without adding `DOC-SYNC-*` evidence.
7. Assuming status enums from memory instead of canonical documents.

---

## Next Steps (Where to Go in Docs)

Immediate next reads:
- `docs/50-validation/day1_dev_kickoff_execution_plan.md`
- `docs/50-validation/day1_dev_progress_log.md`
- `docs/20-architecture/contracts/api_endpoint_contracts_v2.md`
- `docs/50-validation/test_case_id_traceability_matrix_v2.md`

If you are backend-focused:
- start with tenant enforcement + registration validation + uniqueness stories.

If you are frontend-focused:
- start with `S-PART-02` validation/error handling and `permission_denied` behavior mapping.

If you are QA-focused:
- start with day-1 mapped tests:
  - `TC-SR-NFR-001-01`
  - `TC-SR-NFR-001-02`
  - `TC-SR-FR-002-01`
  - `TC-SR-FR-002-02`
  - `TC-SR-FR-009-01`
  - `TC-SR-FR-001-01`
  - `TC-SR-FR-001-02`

---

## Notes on Best-Practice Structure Used

This guide follows current onboarding patterns used in modern repositories:
- short quickstart path plus full setup path
- explicit readiness verification
- "common mistakes" section to reduce first-day failures
- command-first steps with no invented project runtime commands
- clear separation between confirmed commands and `project-specific: fill required` placeholders
