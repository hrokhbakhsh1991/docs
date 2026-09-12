# GitHub — CI & branch protection (Phase 0 + Phase 1 + Booking PostgreSQL)

## Phase 0

**Workflow:** [`.github/workflows/phase-0-gate.yml`](../.github/workflows/phase-0-gate.yml)

| Job                          | Required for merge? | Command parity                                                      |
| ---------------------------- | ------------------- | ------------------------------------------------------------------- |
| **Phase 0 foundation gate**  | **Yes**             | `pnpm run phase-0:covenant-gate` (alias: `phase-0:foundation-gate`) |
| **Phase 0 integration gate** | **Yes**             | `pnpm run phase-0:trunk-gate` (alias: `phase-0:integration-gate`)   |

### Local verification (before push)

```bash
nvm use 24
export PATH="$(dirname "$(nvm which 24)"):$PATH"
cd /home/hamed/Music/docs
pnpm run phase-0:covenant-gate && pnpm run phase-0:trunk-gate
# equivalent: pnpm run phase-0:gate
```

Artifacts: `reports/phase-0-foundation-gate-*.json` (covenant job via SDK tests) · `reports/phase-0-integration-gate-*.json` (trunk job).

---

## Phase 1

**Workflow:** [`.github/workflows/phase-1-gate.yml`](../.github/workflows/phase-1-gate.yml)

| Job                            | Required for merge?                | Command parity          |
| ------------------------------ | ---------------------------------- | ----------------------- |
| **Phase 1 platform-core gate** | **Yes** (recommended with Phase 0) | `pnpm run phase-1:gate` |

### Local verification

```bash
nvm use 24
export PATH="$(dirname "$(nvm which 24)"):$PATH"
cd /home/hamed/Music/docs
pnpm run phase-1:gate
```

Artifact: `reports/phase-1-guard-*.json` · architect sign-off: [`phase-1-architect-signoff-checklist-2026-06-03.md`](phase-1-architect-signoff-checklist-2026-06-03.md)

---

## Booking PostgreSQL (production path)

**Workflow:** [`.github/workflows/booking-postgres-gate.yml`](../.github/workflows/booking-postgres-gate.yml)

| Job                               | Required for merge? | Command parity |
| --------------------------------- | ------------------- | -------------- |
| **Booking PostgreSQL capacity**   | **Yes**             | `pnpm --filter @apps/api run test:booking-capacity-postgres` (+ concurrency + stress in job) |
| **Booking HTTP PostgreSQL**       | **Yes**             | `pnpm --filter @apps/api run test:booking-http-postgres` |

Status check contexts are the **exact job `name:`** strings above (not the workflow file name `booking-postgres-gate`).

Doc: [`docs/phase-20/p7/appendices/BOOKING_BRANCH_PROTECTION_GATE.md`](../docs/phase-20/p7/appendices/BOOKING_BRANCH_PROTECTION_GATE.md)

---

## Branch protection for `main` (admin)

Prerequisite: at least one green run on `main` (or a PR) so GitHub lists the job names.

### Option A — UI

1. Push to `origin` and confirm jobs green under **Actions**.
2. **Settings → Branches → Branch protection rules → `main`** (edit or create):
   - **Require status checks to pass before merging**
   - Enable (exact names):
     - **Phase 0 foundation gate**
     - **Phase 0 integration gate**
     - **Phase 1 platform-core gate**
     - **Booking PostgreSQL capacity**
     - **Booking HTTP PostgreSQL**
3. Save.

### Option B — CLI (after `gh auth login`)

Adds **Phase 0 + Phase 1 + Booking PostgreSQL** required checks while preserving existing contexts:

```bash
gh auth login
cd /home/hamed/Music/docs
pnpm run ops:branch-protection:main
pnpm run ops:branch-protection:verify
```

| Script | Purpose |
| ------ | ------- |
| `pnpm run ops:branch-protection:main` | Apply (merge) required contexts |
| `pnpm run ops:branch-protection:verify` | Fail if any required check missing on `main` |
| `pnpm run ops:branch-protection:dry-run` | Show planned contexts; no write |
| `pnpm run ops:branch-protection:print` | Print canonical names; no network |
| `pnpm run guard:required-check-names` | Assert workflow YAML names match script |

Alias: `pnpm run ops:branch-protection:phase-1` (same apply script).

Requires repo **admin**.

**Prerequisite:** at least one green Actions run on `main` (or a PR) so GitHub exposes the job names above.

---

## Branch protection for `dev` (staging — admin)

`dev` is the staging trunk ([`docs/dev/deployment-branch-model.md`](../docs/dev/deployment-branch-model.md)). Protection blocks direct pushes and requires PR CI gates before merge.

### Required status checks (exact job contexts)

| Check | Workflow |
| ----- | -------- |
| Phase 0 foundation gate | `phase-0-gate.yml` |
| Phase 0 integration gate | `phase-0-gate.yml` |
| Phase 1 platform-core gate | `phase-1-gate.yml` |
| Phase 4 gate (Postgres required) | `phase-4-gate.yml` |
| Phase 5 gate (Postgres required) | `phase-5-gate.yml` |
| Booking PostgreSQL capacity | `booking-postgres-gate.yml` |
| Booking HTTP PostgreSQL | `booking-postgres-gate.yml` |
| marketing-guard | `marketing-guard.yml` |

Also enabled: **require pull request before merging** (0 approvals), **strict** up-to-date branch, **no force push**.

### CLI (after `gh auth login` + repo admin)

```bash
pnpm run guard:dev-required-check-names
pnpm run ops:branch-protection:dev:dry-run
pnpm run ops:branch-protection:dev
pnpm run ops:branch-protection:dev:verify
```

| Script | Purpose |
| ------ | ------- |
| `pnpm run ops:branch-protection:dev` | Apply dev protection (merge contexts + PR-only) |
| `pnpm run ops:branch-protection:dev:verify` | Fail if any dev gate missing on `dev` |
| `pnpm run ops:branch-protection:dev:dry-run` | Planned contexts; no write |
| `pnpm run ops:branch-protection:dev:print` | Print canonical dev names |
| `pnpm run guard:dev-required-check-names` | Assert workflow YAML names match dev script |

Canonical list: `scripts/ops/dev-branch-required-checks.mjs`.

---

## PR hygiene (§12 #8)

```bash
gh pr list --state open   # no out-of-scope Phase 1–3-only PRs blocking Phase 0 closure
```
