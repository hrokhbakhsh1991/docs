# GitHub — CI & branch protection (Phase 0 + Phase 1)

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

## Branch protection for `main` (admin)

Prerequisite: at least one green run on `main` (or a PR) so GitHub lists the job names.

### Option A — UI

1. Push to `origin` and confirm jobs green under **Actions**.
2. **Settings → Branches → Branch protection rules → `main`** (edit or create):
   - **Require status checks to pass before merging**
   - Enable:
     - **Phase 0 foundation gate**
     - **Phase 0 integration gate**
     - **Phase 1 platform-core gate** ← exact job `name:` from workflow
3. Save.

### Option B — CLI (after `gh auth login`)

Adds **Phase 0 + Phase 1** required checks while preserving existing contexts:

```bash
gh auth login
cd /home/hamed/Music/docs
pnpm run ops:branch-protection:main
```

Alias (same script): `pnpm run ops:branch-protection:phase-1`

Requires repo **admin** on `hrokhbakhsh1991/docs`.

**Prerequisite:** at least one green Actions run on `main` (or a PR) so GitHub exposes the job names above.

---

## PR hygiene (§12 #8)

```bash
gh pr list --state open   # no out-of-scope Phase 1–3-only PRs blocking Phase 0 closure
```
