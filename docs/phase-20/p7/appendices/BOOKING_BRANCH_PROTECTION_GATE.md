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

| Required context | Workflow job id | Proof |
| ---------------- | --------------- | ----- |
| **Booking PostgreSQL capacity** | `booking-postgres-capacity` | capacity + approve concurrency + stress |
| **Booking HTTP PostgreSQL** | `booking-http-postgres` | HTTP→Prisma certification matrix |

Canonical list: `scripts/ops/main-branch-required-checks.mjs` (`BOOKING_POSTGRES_REQUIRED_CHECKS`).

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
