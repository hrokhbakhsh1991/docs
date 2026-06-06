# Phase 5 — Verification commands

```yaml
binding: REPO_SCRIPTS_OVER_STALE_MD
prerequisite: pnpm run phase-4:gate
```

## 5.0

```bash
pnpm run phase-4:gate
# verify phase_5_entry_requires per subphases/5.0-entry-gate.md
```

## 5.1 (BLOCKER-P5-001 until schema doc exists)

```bash
# AUTHOR docs/phase-5-canonical-schema.md FIRST
pnpm build
# migration up with DATABASE_URL after DDL in repo
```

## 5.2–5.5

```bash
pnpm --filter @apps/api test
# subphase-specific tests per subphases/*.md
```

## 5.6

```bash
pnpm build
pnpm test
pnpm run phase-5:gate    # stub until full gate — must exit 0 for VERIFIED
# phase-5.contract.spec.ts when package path defined (BLOCKER-P5-003)
pnpm run guard:doc-sync
```
