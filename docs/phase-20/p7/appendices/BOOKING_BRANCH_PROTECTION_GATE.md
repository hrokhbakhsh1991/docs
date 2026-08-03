# Booking PostgreSQL — mandatory merge gate (branch protection)

```yaml
doc_id: BOOKING_BRANCH_PROTECTION_GATE
status: ACTIVE
date: "2026-07-20"
authority:
  - .github/workflows/booking-postgres-gate.yml
  - scripts/ops/configure-main-branch-protection.mjs
  - reports/GITHUB_BRANCH_PROTECTION.md
```

## Goal

A developer must not merge to `main` without Booking **production-path** PostgreSQL proofs.

## Exact GitHub Actions check names

These are the job `name:` fields (status check **contexts**), not workflow file names:

| Required context | Workflow job id (real) | Workflow job id (PR stub) | Proof |
| ---------------- | ---------------------- | ------------------------- | ----- |
| **Booking PostgreSQL capacity** | `booking-postgres-capacity` | `booking-postgres-capacity-stub` | capacity + approve concurrency + stress |
| **Booking HTTP PostgreSQL** | `booking-http-postgres` | `booking-http-postgres-stub` | HTTP→Prisma certification matrix |

Canonical list: `scripts/ops/main-branch-required-checks.mjs` (`BOOKING_POSTGRES_REQUIRED_CHECKS`).

## PR path gating (velocity)

**Do not** use workflow-level `pull_request.paths` — required contexts would never report and merges would pend.

Instead `.github/workflows/booking-postgres-gate.yml`:

1. Job `booking-relevance` diffs the PR (`base...head`) against booking-related paths (bookings, outbox, prisma/SQL, finance-recon/RLS extras in this workflow, contract/core deps used by the listener build, ops required-check scripts, this workflow, lockfile).
2. If relevant (or event is `push` to `main` / `workflow_dispatch`): run the **real** Postgres jobs.
3. Otherwise: run lightweight **stub** jobs that reuse the **same** `name:` values so branch protection and `deploy-vps` waiters still see success.

`push` to `main` and `workflow_dispatch` always set `run_booking=true` (full proofs unchanged).

## Apply (repo admin)

```bash
gh auth login   # once
pnpm run ops:branch-protection:main
pnpm run ops:branch-protection:verify
```

Dry-run (no write): `pnpm run ops:branch-protection:dry-run`  
Print planned names (no network): `pnpm run ops:branch-protection:print`

**MR-P0-004 status (2026-07-20):** in-repo scripts + `guard:required-check-names` + deploy `needs` are landed. **Live** `main` protection apply remains **BLOCKED** until an admin runs `gh auth login` (or `GH_TOKEN` with admin) and `pnpm run ops:branch-protection:main`. Without that, GitHub may still allow merge.

## Deploy gating (independent of branch protection UI)

`.github/workflows/deploy-vps.yml` job **Require release checks** polls the commit until every context in `MAIN_BRANCH_REQUIRED_CHECKS` is `success`, then **Deploy to VPS** runs. Missing VPS secrets **fail** the job (no silent skip). `cancel-in-progress: false` so a new push cannot cancel a mid-flight production deploy.

```bash
# Local / Actions helper
node scripts/ops/wait-for-required-checks.mjs
```

## Drift guard (no GitHub auth)

```bash
pnpm run guard:required-check-names
```

Also runs as a step inside `booking-postgres-gate.yml` so renaming a job without updating the protection script fails CI.

## Acceptance

| Criterion | How to prove |
| --------- | ------------ |
| Booking PostgreSQL capacity required | `ops:branch-protection:verify` lists it with ✓ |
| Booking HTTP PostgreSQL required | same |
| Removing either blocks merge | GitHub Settings → Branches → `main` → required checks; or remove from API and open a PR |
| Docs match reality | this file + `reports/GITHUB_BRANCH_PROTECTION.md` |

## Note on local `gh` auth

Applying / verifying remote protection requires `gh auth login` (or `GH_TOKEN` with admin). Without it, automation is ready but GitHub may still allow merge until an admin runs `ops:branch-protection:main`.

## CD unblock — Actions token 403 (2026-08-03)

**Symptom:** `Deploy VPS (operator stack)` ran on `main` push but never SSHed — job **Require release checks** saw `Booking HTTP PostgreSQL` **failure**. The booking job itself failed on step *Verify live main branch protection (TODO-005)* with:

```text
gh: Resource not accessible by integration (HTTP 403)
Failed to read branch protection: …
```

Default `github.token` cannot `GET /repos/.../branches/main/protection`. That is **not** evidence that required checks are missing; treating it as hard-fail poisoned the required context and blocked `deploy-vps`.

**Fix:**

| Layer | Behavior |
| ----- | -------- |
| Workflow | Prefer `secrets.BRANCH_PROTECTION_TOKEN` (repo-admin PAT) when set; else `github.token` |
| Env | `BRANCH_PROTECTION_VERIFY_SOFT_403=1` on the live-verify step |
| Script | `--verify` + soft-403 → **warn + exit 0** (real missing contexts still fail when the API is readable) |

Optional harden: add repo secret `BRANCH_PROTECTION_TOKEN` with `administration:read` so live verify stays authoritative without soft-skip.

## VPS path flake (secondary CD risk)

On host `89.45.89.206`, pathname lookup for `/opt/app-cloud` occasionally returns `ENOENT` while `openat(/opt, "app-tour")` still works (stale negative dentry). `remote-deploy.sh` recovers with `drop_caches` then a `renameat` cycle before `git fetch`. If SSH deploy still fails after the Booking soft-403 fix, check `journalctl` / deploy logs for the WARN lines above.
