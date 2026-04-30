# Database Migration and Seed Runbook

Document-ID: MKT-DOC-OPS-DB-MIGRATION-SEED
Version: v1.0
Status: Active
Owner: Backend Platform Lead
Last-Updated: 2026-04-28
Language: English
Canonical-Reference: docs/20-architecture/data_model.md

## 1. Purpose

Define safe, repeatable migration and seed operations for local/dev/staging and release preparation.

## 2. Principles

- Migrations are code and MUST be versioned, reviewed, and tested.
- Never modify already-applied migration files; create new migration files to fix issues.
- Prefer forward-only, expand-migrate-contract changes for risky schema updates.
- Seed logic MUST be idempotent and rerunnable.
- Separate reference seed data from test/demo seed data.

## 3. Migration Strategy

### 3.1 Standard (Low Risk)

1. Create migration file.
2. Review schema diff and constraints.
3. Run locally on clean database.
4. Run locally on populated database snapshot (if available).
5. Apply in staging.

### 3.2 Expand-Migrate-Contract (High Risk)

Use for renames, type changes, or required-field introduction:

1. Expand:
   - add new nullable columns/tables/indexes
2. Migrate:
   - dual write/read fallback where needed
   - backfill in controlled batches
3. Contract:
   - remove old structures after validation window

## 4. Command Workflow

Project tooling is runtime-specific; fill concrete commands from repository:

- create migration: `[REQUIRED_FILL: migration_create_command]`
- apply migration: `[REQUIRED_FILL: migration_apply_command]`
- migration status: `[REQUIRED_FILL: migration_status_command]`
- rollback policy command (if supported): `[REQUIRED_FILL]`

## 5. Seed Workflow

### 5.1 Reference Seed (Stable)

- roles, baseline statuses, config constants
- should be deterministic and safe across environments

### 5.2 Test Seed (Variable)

- generated demo/test entities for local and test runs
- can be regenerated frequently

Required properties:

- idempotent rerun safety (`upsert` or conflict-safe insert patterns)
- compatible with current migration version

Commands:

- reference seed: `[REQUIRED_FILL: reference_seed_command]`
- test seed: `[REQUIRED_FILL: test_seed_command]`

## 6. Verification Checks

After migration/seed, verify:

- [ ] schema version matches expected target
- [ ] registration status enum is canonical:
  - `Pending`, `Accepted`, `Rejected`, `Cancelled`, `NoShow`
- [ ] payment status enum is canonical:
  - `NotPaid`, `Partial`, `Paid`
- [ ] waitlist status enum is canonical:
  - `Waiting`, `Converted`, `Cancelled`
- [ ] uniqueness invariant holds:
  - no duplicate active registration (`Pending`/`Accepted`) for `(user, tour)`
- [ ] tenant scope constraints remain enforced

## 7. Rollback and Repair

Rollback depends on migration phase:

- expand phase: typically reversible
- contract phase: often not fully reversible without restore/backfill

Minimum rollback readiness before high-risk change:

- tested rollback procedure (or documented restore plan)
- backup/snapshot availability
- low-traffic execution window

## 8. Common Failure Modes

1. migration passes on empty DB but fails on real data
2. long-running updates causing locks
3. seed scripts broken after new required columns
4. enum drift from canonical values
5. tenant predicates missing in new query/index paths

## 9. Release Safety Checklist

- [ ] migration tested on production-like volume
- [ ] lock/performance risk reviewed
- [ ] backfill strategy documented for large data changes
- [ ] rollback/restore approach documented
- [ ] post-migration validation queries ready
- [ ] docs updated in same change set
